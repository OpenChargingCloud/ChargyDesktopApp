import { createRequire }          from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

type ParsedHttpArguments = {
    enabled: boolean;
    host:    string;
    port:    number;
    raw:     string;
    error?:  string;
};

type ParsedCliArguments = {
    switches:  Map<string, string | null>;
    files:     string[];
    help:      boolean;
    helpTopic: string | null;
    language:  string;
    version:   boolean;
    inspect:   boolean;
    noGUI:     boolean;
    http:      ParsedHttpArguments;
};

type CliArgumentsModule = {
    parseCliArguments(args: string[], environment?: Record<string, string | undefined>): ParsedCliArguments;
    createMainHelpText(applicationFileName: string, version: string, applicationEdition: string, copyright: string, language?: string, i18n?: Record<string, Record<string, string>>): string;
    createOutputHelpText(applicationFileName: string, version: string, applicationEdition: string, copyright: string, language?: string, i18n?: Record<string, Record<string, string>>): string;
};

type ApplicationMetadataModule = {
    applicationEdition: string;
    applicationVersion: string;
    copyright: string;
};

const {
    parseCliArguments,
    createMainHelpText,
    createOutputHelpText
} = require("../src/cliArguments.cjs") as CliArgumentsModule;

const {
    applicationEdition,
    applicationVersion,
    copyright
} = require("../src/applicationMetadata.cjs") as ApplicationMetadataModule;

const cliI18N = require("../src/i18n_CLI.json") as Record<string, Record<string, string>>;


describe("CLI argument parsing", () => {

    test("detects --help without treating it as an input file", () => {

        const parsed = parseCliArguments(["--help"]);

        expect(parsed.help).toBe(true);
        expect(parsed.helpTopic).toBeNull();
        expect(parsed.files).toEqual([]);

    });

    test("detects --help output as a help topic", () => {

        const parsed = parseCliArguments(["--help", "output"]);

        expect(parsed.help).toBe(true);
        expect(parsed.helpTopic).toBe("output");
        expect(parsed.files).toEqual([]);

    });

    test("detects --version", () => {

        const parsed = parseCliArguments(["--version"]);

        expect(parsed.version).toBe(true);
        expect(parsed.help).toBe(false);
        expect(parsed.files).toEqual([]);

    });

    test("normalizes switch names for --noGUI", () => {

        const parsed = parseCliArguments(["--noGUI", "session.chargy"]);

        expect(parsed.noGUI).toBe(true);
        expect(parsed.files).toEqual(["session.chargy"]);

    });

    test("keeps non-switch arguments as input files", () => {

        const parsed = parseCliArguments([
            "--nogui",
            "payload.tar.bz2",
            "public-key.pem"
        ]);

        expect(parsed.noGUI).toBe(true);
        expect(parsed.files).toEqual([
            "payload.tar.bz2",
            "public-key.pem"
        ]);

    });

    test("parses --http without value as localhost:8080", () => {

        const parsed = parseCliArguments(["--http"]);

        expect(parsed.http).toMatchObject({
            enabled: true,
            host:    "localhost",
            port:    8080,
            raw:     ""
        });

    });

    test("parses --http with a port only", () => {

        const parsed = parseCliArguments(["--http=18080"]);

        expect(parsed.http).toMatchObject({
            enabled: true,
            host:    "localhost",
            port:    18080,
            raw:     "18080"
        });

    });

    test("parses --http with host and port", () => {

        const parsed = parseCliArguments(["--http=127.0.0.1:18080"]);

        expect(parsed.http).toMatchObject({
            enabled: true,
            host:    "127.0.0.1",
            port:    18080,
            raw:     "127.0.0.1:18080"
        });

    });

    test("reports invalid --http ports", () => {

        const parsed = parseCliArguments(["--http=localhost:not-a-port"]);

        expect(parsed.http.enabled).toBe(true);
        expect(parsed.http.error).toBe("Invalid TCP port for chargy HTTP API: localhost:not-a-port");

    });

    test("parses --lang values", () => {

        const parsed = parseCliArguments(["--lang=de"], {});

        expect(parsed.language).toBe("de");

    });

    test("uses LANG as default language when no CLI language is set", () => {

        const parsed = parseCliArguments([], {
            LANG: "de_DE.UTF-8"
        });

        expect(parsed.language).toBe("de");

    });

    test("falls back to English for unsupported explicit languages", () => {

        const parsed = parseCliArguments(["--lang=fr"], {
            LANG: "de_DE.UTF-8"
        });

        expect(parsed.language).toBe("en");

    });

});

describe("CLI help text", () => {

    test("renders main help with version and implemented switches", () => {

        const helpText = createMainHelpText(
            "Chargy Transparenzsoftware.exe",
            applicationVersion,
            applicationEdition,
            copyright
        );

        expect(helpText).toContain(`Chargy E-Mobility Transparency Software ${applicationEdition} v${applicationVersion}`);
        expect(helpText).toContain("Usage: Chargy Transparenzsoftware.exe [switches] file1, file2, ...");
        expect(helpText).toContain("--help");
        expect(helpText).toContain("--lang=de|en");
        expect(helpText).toContain("--inspect");
        expect(helpText).toContain("--nogui");
        expect(helpText).toContain("--http[=host:port]");

    });

    test("renders output help as not-yet-implemented contract", () => {

        const helpText = createOutputHelpText(
            "Chargy Transparenzsoftware.exe",
            applicationVersion,
            applicationEdition,
            copyright
        );

        expect(helpText).toContain("--output=[text (default)|csv|json|xml|chargy]");
        expect(helpText).toContain("not implemented yet");

    });

    test("renders main help in German when requested", () => {

        const helpText = createMainHelpText(
            "Chargy Transparenzsoftware.exe",
            applicationVersion,
            applicationEdition,
            copyright,
            "de",
            cliI18N
        );

        expect(helpText).toContain("Aufruf: Chargy Transparenzsoftware.exe [switches] file1, file2, ...");
        expect(helpText).toContain("Optionen:");
        expect(helpText).toContain("--lang=de|en");
        expect(helpText).toContain("CLI-Sprache setzen");

    });

    test("renders output help in German when requested", () => {

        const helpText = createOutputHelpText(
            "Chargy Transparenzsoftware.exe",
            applicationVersion,
            applicationEdition,
            copyright,
            "de",
            cliI18N
        );

        expect(helpText).toContain("Aufruf: Chargy Transparenzsoftware.exe --output=[text (default)|csv|json|xml|chargy]");
        expect(helpText).toContain("Hinweis: Diese Ausgabeformate sind als CLI-Vertrag dokumentiert, aber noch nicht implementiert.");

    });

});
