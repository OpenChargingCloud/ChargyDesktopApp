const http      = require('http');
const stringify = require('safe-stable-stringify');
const {
    normalizeLanguage
}               = require('./cliArguments.cjs');

const DEFAULT_HTTP_API_MAX_CONTENT_SIZE = 20*1024*1024;

function normalizeListenHost(host) {

    if (host.startsWith("[") && host.endsWith("]"))
        return host.substring(1, host.length - 1);

    return host;

}

function getLocalizedText(i18n, language, key, fallback) {

    const translations = i18n?.[key];

    if (translations != null) {
        const localized = translations[language];
        if (typeof localized === "string")
            return localized;

        const english = translations["en"];
        if (typeof english === "string")
            return english;
    }

    return fallback;

}

function normalizeAcceptLanguageHeader(acceptLanguageHeader) {

    if (Array.isArray(acceptLanguageHeader))
        return acceptLanguageHeader.join(",");

    return typeof acceptLanguageHeader === "string"
               ? acceptLanguageHeader
               : "";

}

function normalizeAcceptHeader(acceptHeader) {

    if (Array.isArray(acceptHeader))
        return acceptHeader.join(",");

    return typeof acceptHeader === "string"
               ? acceptHeader
               : "";

}

function parseAcceptHeader(acceptHeader) {

    const header = normalizeAcceptHeader(acceptHeader);

    if (header.trim() === "")
        return [];

    return header.split(",")
                 .map((entry, index) => {

                     const parts = entry.trim().split(";");
                     const mediaType = parts[0]?.trim().toLowerCase() ?? "";

                     let quality = 1;

                     for (const parameter of parts.slice(1)) {
                         const [ rawName, rawValue ] = parameter.split("=");
                         if (rawName?.trim().toLowerCase() === "q") {
                             const parsedQuality = parseFloat(rawValue);
                             if (!isNaN(parsedQuality))
                                 quality = parsedQuality;
                         }
                     }

                     return {
                         index,
                         mediaType,
                         quality
                     };

                 })
                 .filter(entry => entry.mediaType !== "" && entry.quality > 0)
                 .sort((left, right) => right.quality - left.quality || left.index - right.index);

}

function mediaTypeMatches(acceptedMediaType, supportedMediaType) {

    if (acceptedMediaType === "*/*")
        return true;

    if (acceptedMediaType === supportedMediaType)
        return true;

    if (acceptedMediaType.endsWith("/*"))
        return supportedMediaType.startsWith(acceptedMediaType.substring(0, acceptedMediaType.length - 1));

    return false;

}

function negotiateContentType(acceptHeader, supportedMediaTypes, defaultMediaType) {

    const acceptedMediaTypes = parseAcceptHeader(acceptHeader);

    if (acceptedMediaTypes.length === 0)
        return defaultMediaType;

    for (const acceptedMediaType of acceptedMediaTypes) {
        const supportedMediaType = supportedMediaTypes.find(singleSupportedMediaType => mediaTypeMatches(acceptedMediaType.mediaType, singleSupportedMediaType));
        if (supportedMediaType != null)
            return supportedMediaType;
    }

    return null;

}

function parseAcceptLanguage(acceptLanguageHeader) {

    const header = normalizeAcceptLanguageHeader(acceptLanguageHeader);

    if (header.trim() === "")
        return null;

    return header.split(",")
                 .map((entry, index) => {

                     const parts    = entry.trim().split(";");
                     const language = normalizeLanguage(parts[0]);

                     let quality = 1;

                     for (const parameter of parts.slice(1)) {
                         const [ rawName, rawValue ] = parameter.split("=");
                         if (rawName?.trim().toLowerCase() === "q") {
                             const parsedQuality = parseFloat(rawValue);
                             if (!isNaN(parsedQuality))
                                 quality = parsedQuality;
                         }
                     }

                     return {
                         index,
                         language,
                         quality
                     };

                 })
                 .filter(entry => entry.language != null && entry.quality > 0)
                 .sort((left, right) => right.quality - left.quality || left.index - right.index)
                 .map(entry => entry.language)[0] ?? null;

}

function sessionVerificationResultToText(status, language = "en", i18n = {}) {

    switch (status)
    {

        case "NoChargeTransparencyRecordsFound":
            return getLocalizedText(i18n, language, "CLISessionVerificationNoChargeTransparencyRecordsFound", "No charge transparency records found");

        case "UnknownSessionFormat":
            return getLocalizedText(i18n, language, "CLISessionVerificationUnknownSessionFormat", "Unknown session format");

        case "InvalidSessionFormat":
            return getLocalizedText(i18n, language, "CLISessionVerificationInvalidSessionFormat", "Invalid session format");

        case "PublicKeyNotFound":
            return getLocalizedText(i18n, language, "CLISessionVerificationPublicKeyNotFound", "Public key not found");

        case "InvalidPublicKey":
            return getLocalizedText(i18n, language, "CLISessionVerificationInvalidPublicKey", "Invalid public key");

        case "InvalidSignature":
            return getLocalizedText(i18n, language, "CLISessionVerificationInvalidSignature", "Invalid signature");

        case "Unvalidated":
            return getLocalizedText(i18n, language, "CLISessionVerificationUnvalidated", "Unvalidated");

        case "ValidSignature":
            return getLocalizedText(i18n, language, "CLISessionVerificationValidSignature", "Valid signature");

        case "InconsistentTimestamps":
            return getLocalizedText(i18n, language, "CLISessionVerificationInconsistentTimestamps", "Inconsistent timestamps");

        case "AtLeastTwoMeasurementsRequired":
            return getLocalizedText(i18n, language, "CLISessionVerificationAtLeastTwoMeasurementsRequired", "At least two measurements required");

        default:
            return status || getLocalizedText(i18n, language, "CLISessionVerificationUnknownSessionFormat", "Unknown session format");

    }

}

function isChargeTransparencyRecord(result) {
    return result != null &&
           Array.isArray(result.chargingSessions);
}

function sendPlainText(response, statusCode, text) {
    response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(text);
}

function sendCsv(response, statusCode, text) {
    response.writeHead(statusCode, { "Content-Type": "text/csv; charset=utf-8" });
    response.end(text);
}

function sendXml(response, statusCode, text) {
    response.writeHead(statusCode, { "Content-Type": "application/xml; charset=utf-8" });
    response.end(text);
}

function sendJson(response, statusCode, value, pretty = false) {
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(stringify(value, null, pretty ? 2 : 0));
}

function escapeCsvValue(value) {

    const text = value == null
                     ? ""
                     : String(value);

    if (/[",\r\n]/.test(text))
        return "\"" + text.replace(/"/g, "\"\"") + "\"";

    return text;

}

function escapeXmlValue(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}

function createHttpHelpText() {

    return [
        "This is a Chargy HTTP service",
        "GET / - Show this help text.",
        "POST /verify - Verify a transparency record and return session verification results.",
        "POST /convert - Convert a transparency record and return the Charge Transparency Record as JSON.",
        "",
        "Request headers:",
        "Accept: application/json, text/plain, text/csv, application/xml for /verify; application/json for /convert.",
        "Accept-Language: de or en for localized /verify status text.",
        ""
    ].join("\n");

}

function createVerificationResultRows(chargeTransparencyRecord, language, i18n) {

    return chargeTransparencyRecord.chargingSessions
                                  .map((session, index) => ({
                                      session: index + 1,
                                      status:  session.verificationResult != null
                                                   ? sessionVerificationResultToText(session.verificationResult.status, language, i18n)
                                                   : null
                                  }))
                                  .filter(row => row.status != null);

}

function sendVerificationResults(response, contentType, rows) {

    switch (contentType)
    {

        case "text/plain":
            sendPlainText(response, 200, rows.map(row => row.status).join("\n") + "\n");
            return;

        case "text/csv":
            sendCsv(response, 200, [
                "session,status",
                ...rows.map(row => escapeCsvValue(row.session) + "," + escapeCsvValue(row.status))
            ].join("\n") + "\n");
            return;

        case "application/xml":
            sendXml(response, 200, [
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
                "<verificationResults>",
                ...rows.map(row => "  <result session=\"" + escapeXmlValue(row.session) + "\">" + escapeXmlValue(row.status) + "</result>"),
                "</verificationResults>",
                ""
            ].join("\n"));
            return;

        default:
            sendJson(response, 200, rows.length > 1 ? rows.map(row => row.status) : rows[0]?.status);
            return;

    }

}

function createChargyHttpRequestHandler({
    dispatchHttpRequest,
    language = "en",
    i18n = {},
    maxContentSize = DEFAULT_HTTP_API_MAX_CONTENT_SIZE
}) {

    if (typeof dispatchHttpRequest !== "function")
        throw new Error("dispatchHttpRequest must be a function.");

    return async function handleChargyHttpRequest(request, response) {

        const requestUrl = new URL(request.url || "/", "http://localhost");
        const requestLanguage = parseAcceptLanguage(request.headers["accept-language"]) ??
                                normalizeLanguage(language) ??
                                "en";

        if (request.method === "GET" && requestUrl.pathname === "/")
        {
            sendPlainText(response, 200, createHttpHelpText());
            return;
        }

        if (request.method !== "POST" ||
            (requestUrl.pathname !== "/verify" && requestUrl.pathname !== "/convert"))
        {
            sendPlainText(response, 400, "Please use POST /verify for the verification of transparency records or POST /convert for conversion.");
            return;
        }

        const contentLengthHeader = Array.isArray(request.headers["content-length"])
                                        ? request.headers["content-length"][0]
                                        : request.headers["content-length"];

        if (contentLengthHeader != null)
        {
            const contentLength = parseInt(contentLengthHeader, 10);

            if (isNaN(contentLength))
            {
                sendPlainText(response, 400, "The size of the transmitted transparency record is invalid!");
                return;
            }

            if (contentLength > maxContentSize)
            {
                sendPlainText(response, 413, "The size of the transmitted transparency record is too large!");
                return;
            }
        }

        const binaryData = [];
        let contentSize  = 0;
        let rejected     = false;

        request.on("data", binaryDataChunk => {

            if (rejected)
                return;

            contentSize += binaryDataChunk.length;

            if (contentSize > maxContentSize)
            {
                rejected = true;
                sendPlainText(response, 413, "The size of the transmitted transparency record is too large!");
                request.destroy();
                return;
            }

            binaryData.push(binaryDataChunk);

        });

        request.on("error", exception => {
            if (!response.headersSent)
                sendPlainText(response, 400, "Could not read the transmitted transparency record: " + exception.message);
        });

        request.on("end", async () => {

            if (rejected)
                return;

            if (contentSize === 0)
            {
                sendPlainText(response, 400, "Please upload any kind of transparency record(s) for verification.");
                return;
            }

            try
            {
                const rendererResponse = await dispatchHttpRequest({
                    operation:    requestUrl.pathname.substring(1),
                    pretty:       requestUrl.searchParams.has("pretty"),
                    contentType:  Array.isArray(request.headers["content-type"])
                                      ? request.headers["content-type"][0]
                                      : request.headers["content-type"],
                    data:         Buffer.concat(binaryData)
                });

                if (!rendererResponse.ok)
                {
                    sendJson(response, 400, { message: rendererResponse.message ?? "Invalid transparency format!" });
                    return;
                }

                const result = rendererResponse.result;

                if (!isChargeTransparencyRecord(result))
                {
                    sendJson(response, 400, { message: result?.message ?? "Invalid transparency format!" });
                    return;
                }

                if (requestUrl.pathname === "/verify")
                {
                    const contentType = negotiateContentType(
                        request.headers["accept"],
                        [ "application/json", "text/plain", "text/csv", "application/xml" ],
                        "application/json"
                    );

                    if (contentType == null)
                    {
                        sendPlainText(response, 406, "No acceptable response content type found for /verify.");
                        return;
                    }

                    sendVerificationResults(response, contentType, createVerificationResultRows(result, requestLanguage, i18n));
                    return;
                }

                const contentType = negotiateContentType(
                    request.headers["accept"],
                    [ "application/json" ],
                    "application/json"
                );

                if (contentType == null)
                {
                    sendPlainText(response, 406, "No acceptable response content type found for /convert.");
                    return;
                }

                sendJson(response, 200, result, requestUrl.searchParams.has("pretty"));

            }
            catch (exception)
            {
                sendJson(response, 500, { message: exception.message ?? "Could not process transparency record!" });
            }

        });

    };

}

function startChargyHttpServer({
    host = "",
    port,
    dispatchHttpRequest,
    language,
    i18n,
    maxContentSize,
    log = console.log
}) {

    const listenHost = host !== ""
                           ? normalizeListenHost(host)
                           : undefined;

    const server = http.createServer(
        createChargyHttpRequestHandler({
            dispatchHttpRequest,
            language,
            i18n,
            maxContentSize
        })
    );

    server.on("error", exception => {
        log("Could not start HTTP API: " + exception);
    });

    server.listen(port, listenHost, () => {
        log("Chargy HTTP API listening on " + (host !== "" ? host : "*") + ":" + port);
    });

    return server;

}

module.exports = {
    DEFAULT_HTTP_API_MAX_CONTENT_SIZE,
    createChargyHttpRequestHandler,
    createHttpHelpText,
    negotiateContentType,
    normalizeListenHost,
    parseAcceptHeader,
    parseAcceptLanguage,
    sessionVerificationResultToText,
    startChargyHttpServer
};
