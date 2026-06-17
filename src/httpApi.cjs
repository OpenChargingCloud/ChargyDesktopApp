const http      = require('http');
const stringify = require('safe-stable-stringify');
const {
    normalizeLanguage
}               = require('./cliArguments.cjs');
const {
    createMutex
}               = require('./asyncMutex.cjs');
const {
    ApiKeyRole,
    apiKeyEntriesEqual,
    findApiKeyEntriesByAuthorization,
    hasApiKeyEntry,
    parseApiKeyEntry,
    saveApiKeysToFile
}               = require('./apiKeys.cjs');
const {
    sessionVerificationResultToText,
    verificationRowsToText,
    verificationRowsToCsv,
    verificationRowsToXml,
    verificationRowsToJsonValue
}               = require('./outputFormats.cjs');

const DEFAULT_HTTP_API_MAX_CONTENT_SIZE  = 20*1024*1024;
const DEFAULT_HTTP_API_REQUEST_TIMEOUT   = 30*1000;

function normalizeListenHost(host) {

    if (host.startsWith("[") && host.endsWith("]"))
        return host.substring(1, host.length - 1);

    return host;

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

function jsonBuffer(value) {
    return Buffer.from(stringify(value, null, 0), "utf8");
}

function sendAuthorizationRequired(response, message = "Missing, malformed, unknown or expired Authorization header.\n") {
    response.writeHead(401, {
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": "Bearer realm=\"Chargy\", TOTP realm=\"Chargy\""
    });
    response.end(message);
}

function getContentLengthHeader(request) {
    return Array.isArray(request.headers["content-length"])
               ? request.headers["content-length"][0]
               : request.headers["content-length"];
}

function validateContentLengthHeader(contentLengthHeader, maxContentSize) {

    if (contentLengthHeader == null)
        return null;

    const contentLength = parseInt(contentLengthHeader, 10);

    if (isNaN(contentLength))
        return {
            statusCode: 400,
            message:    "The size of the transmitted request body is invalid!"
        };

    if (contentLength > maxContentSize)
        return {
            statusCode: 413,
            message:    "The transmitted request body is too large!"
        };

    return null;

}

function createAuthorizationRequiredResponse(message = "Missing, malformed, unknown or expired Authorization header.\n") {
    return {
        statusCode: 401,
        headers:    {
            "Content-Type":     "text/plain; charset=utf-8",
            "WWW-Authenticate": "Bearer realm=\"Chargy\", TOTP realm=\"Chargy\""
        },
        body:       Buffer.from(message, "utf8")
    };
}

function readRequestBody(request, maxContentSize) {

    return new Promise((resolve, reject) => {

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
                reject({
                    statusCode: 413,
                    message:    "The transmitted request body is too large!"
                });
                request.destroy();
                return;
            }

            binaryData.push(binaryDataChunk);

        });

        request.on("error", exception => {
            if (!rejected)
                reject({
                    statusCode: 400,
                    message:    "Could not read the transmitted request body: " + exception.message
                });
        });

        request.on("end", () => {
            if (!rejected)
                resolve(Buffer.concat(binaryData));
        });

    });

}

function createAddApiKeyResponse({
    authorizationHeader,
    requestBody,
    apiKeyAuthenticator,
    apiKeyEntries,
    apiKeysFileName
}) {

    if (typeof apiKeyAuthenticator !== "function")
        return createAuthorizationRequiredResponse();

    const authentication = apiKeyAuthenticator(authorizationHeader);

    if (authentication == null || authentication.ok !== true)
        return createAuthorizationRequiredResponse();

    if (!Array.isArray(authentication.credential?.roles) ||
        !authentication.credential.roles.includes(ApiKeyRole.Root))
    {
        return {
            statusCode: 403,
            headers:    { "Content-Type": "text/plain; charset=utf-8" },
            body:       Buffer.from("Root authorization is required to add API keys.\n", "utf8")
        };
    }

    if (requestBody.length === 0)
    {
        return {
            statusCode: 400,
            headers:    { "Content-Type": "text/plain; charset=utf-8" },
            body:       Buffer.from("Please upload one API key JSON object.", "utf8")
        };
    }

    let parsedApiKeyEntry;

    try
    {
        parsedApiKeyEntry = parseApiKeyEntry(JSON.parse(requestBody.toString("utf8")));
    }
    catch (exception)
    {
        return {
            statusCode: 400,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: exception.message ?? "Invalid API key JSON object." })
        };
    }

    if (hasApiKeyEntry(apiKeyEntries, parsedApiKeyEntry))
    {
        return {
            statusCode: 409,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: "The API key already exists." })
        };
    }

    apiKeyEntries.push(parsedApiKeyEntry);

    try
    {
        saveApiKeysToFile(apiKeysFileName, apiKeyEntries);
    }
    catch (exception)
    {
        apiKeyEntries.pop();
        return {
            statusCode: 500,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: exception.message ?? "Could not persist API keys." })
        };
    }

    return {
        statusCode: 201,
        headers:    { "Content-Type": "application/json; charset=utf-8" },
        body:       jsonBuffer(parsedApiKeyEntry)
    };

}

function createDeleteApiKeyResponse({
    authorizationHeader,
    requestBody,
    apiKeyAuthenticator,
    apiKeyEntries,
    apiKeysFileName
}) {

    if (typeof apiKeyAuthenticator !== "function")
        return createAuthorizationRequiredResponse();

    const authentication = apiKeyAuthenticator(authorizationHeader);

    if (authentication == null || authentication.ok !== true)
        return createAuthorizationRequiredResponse();

    if (!Array.isArray(authentication.credential?.roles) ||
        !authentication.credential.roles.includes(ApiKeyRole.Root))
    {
        return {
            statusCode: 403,
            headers:    { "Content-Type": "text/plain; charset=utf-8" },
            body:       Buffer.from("Root authorization is required to delete API keys.\n", "utf8")
        };
    }

    if (requestBody.length === 0)
    {
        return {
            statusCode: 400,
            headers:    { "Content-Type": "text/plain; charset=utf-8" },
            body:       Buffer.from("Please upload one API key JSON object.", "utf8")
        };
    }

    let parsedApiKeyEntry;

    try
    {
        parsedApiKeyEntry = parseApiKeyEntry(JSON.parse(requestBody.toString("utf8")));
    }
    catch (exception)
    {
        return {
            statusCode: 400,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: exception.message ?? "Invalid API key JSON object." })
        };
    }

    const matchingIndexes = apiKeyEntries
        .map((entry, index) => apiKeyEntriesEqual(entry, parsedApiKeyEntry) ? index : -1)
        .filter(index => index >= 0);

    if (matchingIndexes.length === 0)
    {
        return {
            statusCode: 404,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: "The API key does not exist." })
        };
    }

    if (matchingIndexes.length > 1)
    {
        return {
            statusCode: 409,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: "The API key is not unique." })
        };
    }

    const deletedApiKeyEntry = apiKeyEntries.splice(matchingIndexes[0], 1)[0];

    try
    {
        saveApiKeysToFile(apiKeysFileName, apiKeyEntries);
    }
    catch (exception)
    {
        apiKeyEntries.splice(matchingIndexes[0], 0, deletedApiKeyEntry);
        return {
            statusCode: 500,
            headers:    { "Content-Type": "application/json; charset=utf-8" },
            body:       jsonBuffer({ message: exception.message ?? "Could not persist API keys." })
        };
    }

    return {
        statusCode: 200,
        headers:    { "Content-Type": "application/json; charset=utf-8" },
        body:       jsonBuffer(deletedApiKeyEntry)
    };

}

function sendAddApiKeyResponse(response, addApiKeyResponse) {
    response.writeHead(addApiKeyResponse.statusCode, addApiKeyResponse.headers);
    response.end(addApiKeyResponse.body);
}

function writeRawHttpResponse(socket, addApiKeyResponse) {

    const reasonPhrase = {
        201: "Created",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        409: "Conflict",
        413: "Payload Too Large",
        500: "Internal Server Error"
    }[addApiKeyResponse.statusCode] ?? "OK";
    const headers = {
        ...addApiKeyResponse.headers,
        "Content-Length": Buffer.byteLength(addApiKeyResponse.body),
        "Connection":     "close"
    };
    const headerText = Object.entries(headers)
                             .map(([ name, value ]) => name + ": " + value)
                             .join("\r\n");

    socket.end(Buffer.concat([
        Buffer.from(
        "HTTP/1.1 " + addApiKeyResponse.statusCode.toString() + " " + reasonPhrase + "\r\n" +
        headerText + "\r\n\r\n",
        "utf8"
        ),
        addApiKeyResponse.body
    ]));

}

function parseRawHttpRequest(rawRequest, maxContentSize) {

    const headerEnd = rawRequest.indexOf("\r\n\r\n");

    if (headerEnd < 0)
        return { status: "incomplete" };

    const headerText = rawRequest.subarray(0, headerEnd).toString("latin1");
    const lines      = headerText.split("\r\n");
    const [ method, path ] = (lines[0] ?? "").split(/\s+/u);
    const headers = {};

    for (const line of lines.slice(1))
    {
        const separatorIndex = line.indexOf(":");

        if (separatorIndex <= 0)
            continue;

        headers[line.substring(0, separatorIndex).trim().toLowerCase()] = line.substring(separatorIndex + 1).trim();
    }

    const contentLengthValidation = validateContentLengthHeader(headers["content-length"], maxContentSize);

    if (contentLengthValidation != null)
        return {
            status:   "error",
            response: {
                statusCode: contentLengthValidation.statusCode,
                headers:    { "Content-Type": "text/plain; charset=utf-8" },
                body:       Buffer.from(contentLengthValidation.message, "utf8")
            }
        };

    const contentLength = headers["content-length"] != null
                              ? parseInt(headers["content-length"], 10)
                              : rawRequest.length - headerEnd - 4;
    const bodyStart = headerEnd + 4;
    const bodyEnd   = bodyStart + contentLength;

    if (rawRequest.length < bodyEnd)
        return { status: "incomplete" };

    return {
        status:  "ready",
        request: {
            method,
            path,
            headers,
            body: rawRequest.subarray(bodyStart, bodyEnd)
        }
    };

}

function createHttpHelpText() {

    return [
        "This is a Chargy HTTP service",
        "GET / - Show this help text.",
        "GET /apiKeys - Return matching API keys as JSON; root tokens return all configured API keys.",
        "ADD /apiKeys - Add one API key from a JSON request body; requires root authorization.",
        "DELETE /apiKeys - Delete one exactly matching API key from a JSON request body; requires root authorization.",
        "POST /verify - Verify a transparency record and return session verification results.",
        "POST /convert - Convert a transparency record and return the Charge Transparency Record as JSON.",
        "",
        "Request headers:",
        "Authorization: Bearer <static-api-secret> or TOTP <token> <totp>; required for /apiKeys, /verify and /convert when the server was started with --apiKeys.",
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
            sendPlainText(response, 200, verificationRowsToText(rows));
            return;

        case "text/csv":
            sendCsv(response, 200, verificationRowsToCsv(rows));
            return;

        case "application/xml":
            sendXml(response, 200, verificationRowsToXml(rows));
            return;

        default:
            sendJson(response, 200, verificationRowsToJsonValue(rows));
            return;

    }

}

function createChargyHttpRequestHandler({
    dispatchHttpRequest,
    language = "en",
    i18n = {},
    maxContentSize   = DEFAULT_HTTP_API_MAX_CONTENT_SIZE,
    requestTimeoutMs = DEFAULT_HTTP_API_REQUEST_TIMEOUT,
    serializeDispatch = true,
    apiKeyAuthenticator = null,
    apiKeyEntries = [],
    apiKeysFileName = null
}) {

    if (typeof dispatchHttpRequest !== "function")
        throw new Error("dispatchHttpRequest must be a function.");

    // Serialize all verification/conversion dispatches against the single shared
    // Chargy renderer, so concurrent requests cannot interleave on shared state.
    const dispatchMutex = createMutex();

    const dispatch = serializeDispatch
                         ? httpRequest => dispatchMutex.runExclusive(() => dispatchHttpRequest(httpRequest))
                         : dispatchHttpRequest;

    return async function handleChargyHttpRequest(request, response) {

        // Bound the time a single connection may occupy, independent of its size,
        // to guard against slow-loris style clients holding the request open.
        if (requestTimeoutMs > 0) {
            request.setTimeout(requestTimeoutMs, () => {
                if (!response.headersSent)
                    sendPlainText(response, 408, "The transparency record was not transmitted in time.");
                request.destroy();
            });
        }

        const requestUrl = new URL(request.url || "/", "http://localhost");
        const requestLanguage = parseAcceptLanguage(request.headers["accept-language"]) ??
                                normalizeLanguage(language) ??
                                "en";

        if (request.method === "GET" && requestUrl.pathname === "/")
        {
            sendPlainText(response, 200, createHttpHelpText());
            return;
        }

        const isApiKeysRequest = request.method === "GET" && requestUrl.pathname === "/apiKeys";

        if (isApiKeysRequest)
        {
            const matchingApiKeyEntries = findApiKeyEntriesByAuthorization(request.headers["authorization"], apiKeyEntries);

            if (matchingApiKeyEntries.length === 0)
            {
                sendAuthorizationRequired(response, "Missing or unknown Authorization header.\n");
                return;
            }

            const hasRootRole = matchingApiKeyEntries.some(entry => Array.isArray(entry.roles) && entry.roles.includes(ApiKeyRole.Root));
            const matchingToken = matchingApiKeyEntries[0]?.token;
            const visibleApiKeyEntries = hasRootRole
                                             ? apiKeyEntries
                                             : apiKeyEntries.filter(entry => entry.token === matchingToken);

            sendJson(response, 200, visibleApiKeyEntries);
            return;
        }

        const isAddApiKeyRequest = request.method === "ADD" && requestUrl.pathname === "/apiKeys";

        if (isAddApiKeyRequest)
        {
            const contentLengthValidation = validateContentLengthHeader(getContentLengthHeader(request), maxContentSize);

            if (contentLengthValidation != null)
            {
                sendPlainText(response, contentLengthValidation.statusCode, contentLengthValidation.message);
                return;
            }

            let requestBody;

            try
            {
                requestBody = await readRequestBody(request, maxContentSize);
            }
            catch (exception)
            {
                if (!response.headersSent)
                    sendPlainText(response, exception.statusCode ?? 400, exception.message ?? "Could not read the transmitted request body.");
                return;
            }

            sendAddApiKeyResponse(response, createAddApiKeyResponse({
                authorizationHeader: request.headers["authorization"],
                requestBody,
                apiKeyAuthenticator,
                apiKeyEntries,
                apiKeysFileName
            }));
            return;
        }

        const isDeleteApiKeyRequest = request.method === "DELETE" && requestUrl.pathname === "/apiKeys";

        if (isDeleteApiKeyRequest)
        {
            const contentLengthValidation = validateContentLengthHeader(getContentLengthHeader(request), maxContentSize);

            if (contentLengthValidation != null)
            {
                sendPlainText(response, contentLengthValidation.statusCode, contentLengthValidation.message);
                return;
            }

            let requestBody;

            try
            {
                requestBody = await readRequestBody(request, maxContentSize);
            }
            catch (exception)
            {
                if (!response.headersSent)
                    sendPlainText(response, exception.statusCode ?? 400, exception.message ?? "Could not read the transmitted request body.");
                return;
            }

            sendAddApiKeyResponse(response, createDeleteApiKeyResponse({
                authorizationHeader: request.headers["authorization"],
                requestBody,
                apiKeyAuthenticator,
                apiKeyEntries,
                apiKeysFileName
            }));
            return;
        }

        let authentication = null;

        if (typeof apiKeyAuthenticator === "function")
        {
            authentication = apiKeyAuthenticator(request.headers["authorization"]);

            if (authentication == null || authentication.ok !== true)
            {
                sendAuthorizationRequired(response);
                return;
            }
        }

        if (request.method !== "POST" ||
            (requestUrl.pathname !== "/verify" && requestUrl.pathname !== "/convert"))
        {
            sendPlainText(response, 400, "Please use POST /verify for the verification of transparency records or POST /convert for conversion.");
            return;
        }

        const contentLengthHeader = getContentLengthHeader(request);

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
                const rendererResponse = await dispatch({
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

function handleRawAddApiKeysClientError({
    exception,
    socket,
    maxContentSize,
    requestTimeoutMs,
    apiKeyAuthenticator,
    apiKeyEntries,
    apiKeysFileName
}) {

    let rawRequest = exception.rawPacket != null
                         ? Buffer.from(exception.rawPacket)
                         : Buffer.alloc(0);
    let completed = false;

    const finish = addApiKeyResponse => {
        if (completed)
            return;

        completed = true;
        writeRawHttpResponse(socket, addApiKeyResponse);
    };

    const attempt = () => {

        const parsedRequest = parseRawHttpRequest(rawRequest, maxContentSize);

        if (parsedRequest.status === "incomplete")
            return false;

        if (parsedRequest.status === "error")
        {
            finish(parsedRequest.response);
            return true;
        }

        if (parsedRequest.request.method !== "ADD" ||
            parsedRequest.request.path   !== "/apiKeys")
        {
            finish({
                statusCode: 400,
                headers:    { "Content-Type": "text/plain; charset=utf-8" },
                body:       Buffer.from("Unsupported HTTP method.\n", "utf8")
            });
            return true;
        }

        finish(createAddApiKeyResponse({
            authorizationHeader: parsedRequest.request.headers["authorization"],
            requestBody:         parsedRequest.request.body,
            apiKeyAuthenticator,
            apiKeyEntries,
            apiKeysFileName
        }));
        return true;

    };

    if (attempt())
        return;

    if (requestTimeoutMs > 0)
        socket.setTimeout(requestTimeoutMs, () => {
            finish({
                statusCode: 408,
                headers:    { "Content-Type": "text/plain; charset=utf-8" },
                body:       Buffer.from("The API key request was not transmitted in time.", "utf8")
            });
        });

    socket.on("data", chunk => {

        if (completed)
            return;

        rawRequest = Buffer.concat([ rawRequest, chunk ]);

        if (rawRequest.length > maxContentSize + 16*1024)
        {
            finish({
                statusCode: 413,
                headers:    { "Content-Type": "text/plain; charset=utf-8" },
                body:       Buffer.from("The transmitted request body is too large!", "utf8")
            });
            return;
        }

        attempt();

    });

    socket.on("end", () => {
        if (!completed)
            attempt();
    });

}

function startChargyHttpServer({
    host = "",
    port,
    dispatchHttpRequest,
    language,
    i18n,
    maxContentSize,
    requestTimeoutMs = DEFAULT_HTTP_API_REQUEST_TIMEOUT,
    serializeDispatch,
    apiKeyAuthenticator,
    apiKeyEntries,
    apiKeysFileName,
    log = console.log
}) {

    const listenHost = host !== ""
                           ? normalizeListenHost(host)
                           : undefined;
    const effectiveMaxContentSize = maxContentSize ?? DEFAULT_HTTP_API_MAX_CONTENT_SIZE;
    const effectiveRequestTimeout = requestTimeoutMs ?? DEFAULT_HTTP_API_REQUEST_TIMEOUT;

    const server = http.createServer(
        createChargyHttpRequestHandler({
            dispatchHttpRequest,
            language,
            i18n,
            maxContentSize:     effectiveMaxContentSize,
            requestTimeoutMs:   effectiveRequestTimeout,
            serializeDispatch,
            apiKeyAuthenticator,
            apiKeyEntries,
            apiKeysFileName
        })
    );

    // Bound how long the server waits for a complete request, as a second line of
    // defence behind the per-request socket timeout above.
    if (effectiveRequestTimeout > 0)
        server.requestTimeout = effectiveRequestTimeout;

    server.on("error", exception => {
        log("Could not start HTTP API: " + exception);
    });

    server.on("clientError", (exception, socket) => {
        if (exception.code === "HPE_INVALID_METHOD")
        {
            handleRawAddApiKeysClientError({
                exception,
                socket,
                maxContentSize:     effectiveMaxContentSize,
                requestTimeoutMs:   effectiveRequestTimeout,
                apiKeyAuthenticator,
                apiKeyEntries,
                apiKeysFileName
            });
            return;
        }

        socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    });

    // A bound-but-network-exposed endpoint (e.g. --http=0.0.0.0:8080) makes the
    // verification API reachable from the network. Warn so this is never silent.
    if (host !== "" && host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "[::1]")
        log("Warning: The Chargy HTTP API is bound to " + host + " and may be reachable from the network. Use localhost to restrict access to this machine.");

    server.listen(port, listenHost, () => {
        log("Chargy HTTP API listening on " + (host !== "" ? host : "*") + ":" + port);
    });

    return server;

}

module.exports = {
    DEFAULT_HTTP_API_MAX_CONTENT_SIZE,
    DEFAULT_HTTP_API_REQUEST_TIMEOUT,
    createChargyHttpRequestHandler,
    createHttpHelpText,
    negotiateContentType,
    normalizeListenHost,
    parseAcceptHeader,
    parseAcceptLanguage,
    sessionVerificationResultToText,
    startChargyHttpServer
};
