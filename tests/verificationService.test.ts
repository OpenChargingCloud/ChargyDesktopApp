import { createRequire }          from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

type VerificationResult = {
    status:   string;
    // The core states a message in every language it has, so what arrives here
    // is an I18NString as often as it is a finished sentence.
    message?: string | Record<string, string>;
};

type OutputFormatsModule = {
    multilanguageTextToString: (value: unknown, language?: string) => string | null;
};

type CliVerification = {
    output:   string;
    exitCode: number;
};

type VerificationServiceModule = {
    EXIT_ALL_VALID:       number;
    EXIT_TECHNICAL_ERROR: number;
    EXIT_INVALID_SESSION: number;
    EXIT_UNKNOWN_FORMAT:  number;
    SUPPORTED_OUTPUT_FORMATS: string[];
    normalizeOutputFormat: (value: string | null | undefined) => string | null;
    exitCodeForResults: (results: VerificationResult[] | VerificationResult | null | undefined) => number;
    renderVerificationOutput: (results: VerificationResult[] | VerificationResult, options?: {
        format?:   string;
        language?: string;
        i18n?:     Record<string, Record<string, string>>;
        pretty?:   boolean;
    }) => string;
    renderCliVerification: (results: VerificationResult[] | VerificationResult, options?: {
        output?:   string | null;
        language?: string;
        i18n?:     Record<string, Record<string, string>>;
        pretty?:   boolean;
    }) => CliVerification;
};

const service = require("../src/verificationService.cjs") as VerificationServiceModule;
const cliI18N = require("../src/i18n_CLI.json") as Record<string, Record<string, string>>;

const { multilanguageTextToString } = require("../src/outputFormats.cjs") as OutputFormatsModule;

const {
    EXIT_ALL_VALID,
    EXIT_TECHNICAL_ERROR,
    EXIT_INVALID_SESSION,
    EXIT_UNKNOWN_FORMAT,
    normalizeOutputFormat,
    exitCodeForResults,
    renderVerificationOutput,
    renderCliVerification
} = service;

const valid:   VerificationResult = { status: "ValidSignature" };
const invalid: VerificationResult = { status: "InvalidSignature", message: "boom" };

describe("verification service - output format normalization", () => {

    test("defaults to text and lowercases", () => {
        expect(normalizeOutputFormat(null)).toBe("text");
        expect(normalizeOutputFormat("")).toBe("text");
        expect(normalizeOutputFormat("JSON")).toBe("json");
        expect(normalizeOutputFormat("  Csv ")).toBe("csv");
    });

    test("rejects unsupported and not-yet-implemented formats", () => {
        expect(normalizeOutputFormat("yaml")).toBeNull();
        expect(normalizeOutputFormat("chargy")).toBeNull();
    });

});

describe("verification service - exit codes", () => {

    test("all sessions valid -> 0", () => {
        expect(exitCodeForResults([ valid, valid ])).toBe(EXIT_ALL_VALID);
    });

    test("at least one invalid session -> 2", () => {
        expect(exitCodeForResults([ valid, invalid ])).toBe(EXIT_INVALID_SESSION);
        expect(exitCodeForResults(invalid)).toBe(EXIT_INVALID_SESSION);
    });

    test("only format failures -> 3", () => {
        expect(exitCodeForResults([ { status: "UnknownSessionFormat" } ])).toBe(EXIT_UNKNOWN_FORMAT);
        expect(exitCodeForResults([ { status: "NoChargeTransparencyRecordsFound" } ])).toBe(EXIT_UNKNOWN_FORMAT);
    });

    test("empty / missing results -> 3", () => {
        expect(exitCodeForResults([])).toBe(EXIT_UNKNOWN_FORMAT);
        expect(exitCodeForResults(null)).toBe(EXIT_UNKNOWN_FORMAT);
    });

    test("a valid session mixed with a format failure still counts as verified-but-invalid -> 2", () => {
        expect(exitCodeForResults([ valid, { status: "InvalidSessionFormat" } ])).toBe(EXIT_INVALID_SESSION);
    });

});

describe("verification service - output rendering", () => {

    test("text output uses localized status and appends messages", () => {
        expect(renderVerificationOutput([ valid ])).toBe("Valid signature\n");
        expect(renderVerificationOutput([ invalid ])).toBe("Invalid signature - boom\n");
    });

    test("text output is localized via i18n", () => {
        expect(renderVerificationOutput([ valid ], { format: "text", language: "de", i18n: cliI18N }))
            .toBe("Gültige Signatur\n");
    });

    test("csv output matches the shared session,status format", () => {
        expect(renderVerificationOutput([ valid, invalid ], { format: "csv" }))
            .toBe("session,status\n1,Valid signature\n2,Invalid signature\n");
    });

    test("xml output matches the shared verificationResults format", () => {
        const xml = renderVerificationOutput([ valid ], { format: "xml" });
        expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        expect(xml).toContain("<result session=\"1\">Valid signature</result>");
    });

    test("json output carries session, raw status, localized text and message", () => {
        const json = JSON.parse(renderVerificationOutput([ invalid ], { format: "json" })) as Array<{
            session: number;
            status:  string;
            text:    string;
            message: string | null;
        }>;
        expect(json).toEqual([
            { session: 1, status: "InvalidSignature", text: "Invalid signature", message: "boom" }
        ]);
    });

});

describe("verification service - renderCliVerification", () => {

    test("valid result renders text and exit code 0", () => {
        expect(renderCliVerification([ valid ])).toEqual({
            output:   "Valid signature\n",
            exitCode: EXIT_ALL_VALID
        });
    });

    test("invalid result renders requested format and exit code 2", () => {
        const { output, exitCode } = renderCliVerification([ invalid ], { output: "csv" });
        expect(output).toBe("session,status\n1,Invalid signature\n");
        expect(exitCode).toBe(EXIT_INVALID_SESSION);
    });

    test("unsupported output format is a technical error (exit 1)", () => {
        const { output, exitCode } = renderCliVerification([ valid ], { output: "yaml" });
        expect(output).toContain("Unsupported output format: yaml");
        expect(exitCode).toBe(EXIT_TECHNICAL_ERROR);
    });

});

describe("a message the core stated in every language it has", () => {

    const message = {
        de: "Unbekanntes oder ungültiges Ladevorgangsformat!",
        en: "Unknown or invalid charging session format!"
    };

    test("is answered in the language being answered in", () => {
        expect(multilanguageTextToString(message, "de")).toBe(message.de);
        expect(multilanguageTextToString(message, "en")).toBe(message.en);
    });

    test("falls back to English, then to whatever it does carry", () => {

        expect(multilanguageTextToString(message, "fr")).toBe(message.en);
        expect(multilanguageTextToString({ fr: "Format inconnu" }, "de")).toBe("Format inconnu");

        // A sentence that is already one is left alone.
        expect(multilanguageTextToString("boom", "de")).toBe("boom");

    });

    test("is null when there is nothing to say, so the caller keeps its fallback", () => {
        for (const nothing of [ undefined, null, "", {}, { de: "" }, [ "x" ], 42 ])
            expect(multilanguageTextToString(nothing, "de")).toBeNull();
    });

    // What the text output used to print instead: "[object Object]".
    test("reaches the rendered CLI output as a sentence", () => {

        const results = [ { status: "InvalidSessionFormat", message } ];

        expect(renderCliVerification(results, { language: "de", i18n: cliI18N }).output).
            toBe("Ungültiges Sitzungsformat - " + message.de + "\n");

        expect(renderVerificationOutput(results, { format: "json", language: "en", i18n: cliI18N })).
            toContain("\"message\":\"" + message.en + "\"");

    });

});
