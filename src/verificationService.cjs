// Pure, Electron-free rendering of CLI verification output and exit codes.
//
// The actual verification still runs in the Chargy renderer; this service only
// turns the resulting session verification results into the requested --output
// format and decides the process exit code. Keeping it pure makes the CLI
// contract testable without starting Electron (see tests/verificationService.test.ts).

const {
    sessionVerificationResultToText,
    verificationRowsToCsv,
    verificationRowsToXml
} = require('./outputFormats.cjs');

// Exit-code contract (also documented in CLI-README.md):
const EXIT_ALL_VALID        = 0; // technically successful, every session has a valid signature
const EXIT_TECHNICAL_ERROR  = 1; // invalid arguments, unreadable file, renderer not ready, ...
const EXIT_INVALID_SESSION  = 2; // technically successful, but at least one session is not valid
const EXIT_UNKNOWN_FORMAT   = 3; // unknown or unsupported transparency data format

// "chargy" is documented as a CLI contract but is not implemented yet, because it
// requires the full Charge Transparency Record plus the export path.
const SUPPORTED_OUTPUT_FORMATS = [ "text", "csv", "json", "xml" ];

// Statuses that mean "no parseable transparency record at all" rather than
// "a record was verified and found invalid".
const FORMAT_FAILURE_STATUSES = new Set([
    "NoChargeTransparencyRecordsFound",
    "UnknownCTRFormat",
    "UnknownSessionFormat",
    "InvalidSessionFormat"
]);

function normalizeOutputFormat(value) {

    if (value == null || value === "")
        return "text";

    const normalized = String(value).trim().toLowerCase();

    return SUPPORTED_OUTPUT_FORMATS.includes(normalized)
               ? normalized
               : null;

}

function toResultArray(results) {

    if (results == null)
        return [];

    return (Array.isArray(results) ? results : [ results ]).filter(result => result != null);

}

function buildRows(results, language, i18n) {

    return toResultArray(results).map((result, index) => ({
        session:    index + 1,
        rawStatus:  result.status,
        status:     sessionVerificationResultToText(result.status, language, i18n),
        message:    result.message ?? null
    }));

}

function exitCodeForResults(results) {

    const resultArray = toResultArray(results);

    // Nothing to verify - treat as "no record found".
    if (resultArray.length === 0)
        return EXIT_UNKNOWN_FORMAT;

    if (resultArray.every(result => result.status === "ValidSignature"))
        return EXIT_ALL_VALID;

    // Only structural/format failures and no actual verification outcome.
    if (resultArray.every(result => FORMAT_FAILURE_STATUSES.has(result.status)))
        return EXIT_UNKNOWN_FORMAT;

    // At least one session was verified and is not valid.
    return EXIT_INVALID_SESSION;

}

function renderVerificationOutput(results, {
    format   = "text",
    language = "en",
    i18n     = {},
    pretty   = false
} = {}) {

    const rows = buildRows(results, language, i18n);

    switch (format)
    {

        case "csv":
            return verificationRowsToCsv(rows);

        case "xml":
            return verificationRowsToXml(rows);

        case "json":
            return JSON.stringify(
                rows.map(row => ({
                    session:  row.session,
                    status:   row.rawStatus,
                    text:     row.status,
                    message:  row.message
                })),
                null,
                pretty ? 2 : 0
            ) + "\n";

        case "text":
        default:
            return rows.map(row => row.status + (row.message != null && row.message !== "" ? " - " + row.message : ""))
                       .join("\n") + "\n";

    }

}

// High-level entry point used by src/main.cjs: turn the renderer's verification
// results and the parsed CLI options into the text to print and the exit code.
function renderCliVerification(results, {
    output   = null,
    language = "en",
    i18n     = {},
    pretty   = false
} = {}) {

    const format = normalizeOutputFormat(output);

    if (format == null) {
        return {
            output:    "Unsupported output format: " + output + "\n",
            exitCode:  EXIT_TECHNICAL_ERROR
        };
    }

    return {
        output:    renderVerificationOutput(results, { format, language, i18n, pretty }),
        exitCode:  exitCodeForResults(results)
    };

}

module.exports = {
    EXIT_ALL_VALID,
    EXIT_TECHNICAL_ERROR,
    EXIT_INVALID_SESSION,
    EXIT_UNKNOWN_FORMAT,
    SUPPORTED_OUTPUT_FORMATS,
    normalizeOutputFormat,
    exitCodeForResults,
    renderVerificationOutput,
    renderCliVerification
};
