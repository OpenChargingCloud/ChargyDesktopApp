// Shared rendering of Chargy session verification results.
//
// Both the HTTP API (src/httpApi.cjs) and the command line verification service
// (src/verificationService.cjs) present the same verification result rows in
// text, CSV, XML and JSON. Keeping that rendering here avoids duplicating - and
// drifting - the exact output formats between the two front ends.
//
// A "row" is { session: <number>, status: <localized status text> }.

const {
    getLocalizedText
} = require('./cliArguments.cjs');

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

function verificationRowsToText(rows) {
    return rows.map(row => row.status).join("\n") + "\n";
}

function verificationRowsToCsv(rows) {
    return [
        "session,status",
        ...rows.map(row => escapeCsvValue(row.session) + "," + escapeCsvValue(row.status))
    ].join("\n") + "\n";
}

function verificationRowsToXml(rows) {
    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<verificationResults>",
        ...rows.map(row => "  <result session=\"" + escapeXmlValue(row.session) + "\">" + escapeXmlValue(row.status) + "</result>"),
        "</verificationResults>",
        ""
    ].join("\n");
}

function verificationRowsToJsonValue(rows) {
    return rows.length > 1
               ? rows.map(row => row.status)
               : rows[0]?.status;
}

module.exports = {
    escapeCsvValue,
    escapeXmlValue,
    sessionVerificationResultToText,
    verificationRowsToText,
    verificationRowsToCsv,
    verificationRowsToXml,
    verificationRowsToJsonValue
};
