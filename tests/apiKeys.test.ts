import { createRequire }          from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir }                 from "node:os";
import { join }                   from "node:path";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

type ParsedApiKeyEntry = {
    apiKey:    string;
    roles:     string[];
    notBefore: Date;
    notAfter:  Date;
};

type ApiKeyAuthResult = {
    ok:          boolean;
    reason?:     string;
    credential?: {
        apiKey: string;
        roles:  string[];
    } | null;
};

type ApiKeysModule = {
    ApiKeyRole: {
        EVDriver: string;
        Root:     string;
    };
    authenticateApiKeyHeader: (headerValue: string | string[] | undefined, apiKeyEntries: ParsedApiKeyEntry[], now?: Date) => ApiKeyAuthResult;
    createApiKeyAuthenticator: (apiKeyEntries: ParsedApiKeyEntry[], nowProvider?: () => Date) => ((headerValue: string | string[] | undefined) => ApiKeyAuthResult) | null;
    loadApiKeysFromFile: (fileName: string) => ParsedApiKeyEntry[];
    parseApiKeyEntries: (rawEntries: unknown) => ParsedApiKeyEntry[];
};

const {
    ApiKeyRole,
    authenticateApiKeyHeader,
    createApiKeyAuthenticator,
    loadApiKeysFromFile,
    parseApiKeyEntries
} = require("../src/apiKeys.cjs") as ApiKeysModule;

const rawApiKeys = [
    {
        apiKey:    "driver-secret",
        notBefore: "2026-01-01T00:00:00Z",
        notAfter:  "2026-12-31T23:59:59Z"
    },
    {
        apiKey:    "root-secret",
        roles:     [ "evDriver", "root" ],
        notBefore: "2026-01-01T00:00:00Z",
        notAfter:  "2026-12-31T23:59:59Z"
    }
];

describe("API key parsing", () => {

    test("parses API key entries and defaults roles to evDriver", () => {

        const entries = parseApiKeyEntries(rawApiKeys);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
            apiKey: "driver-secret",
            roles:  [ ApiKeyRole.EVDriver ]
        });
        expect(entries[1]).toMatchObject({
            apiKey: "root-secret",
            roles:  [ ApiKeyRole.EVDriver, ApiKeyRole.Root ]
        });

    });

    test("accepts the legacy role field as string or array", () => {

        const entries = parseApiKeyEntries([
            {
                apiKey:    "root-secret",
                role:      "root",
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            },
            {
                apiKey:    "legacy-multi-role-secret",
                role:      [ "evDriver", "root" ],
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ]);

        expect(entries[0]).toMatchObject({
            apiKey: "root-secret",
            roles:  [ ApiKeyRole.Root ]
        });
        expect(entries[1]).toMatchObject({
            apiKey: "legacy-multi-role-secret",
            roles:  [ ApiKeyRole.EVDriver, ApiKeyRole.Root ]
        });

    });

    test("rejects unsupported roles and invalid timestamps", () => {

        expect(() => parseApiKeyEntries([
            {
                apiKey:    "secret",
                roles:     [ "admin" ],
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("Invalid API key role");

        expect(() => parseApiKeyEntries([
            {
                apiKey:    "secret",
                notBefore: "2026-01-01",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("Invalid API key notBefore timestamp");

    });

    test("rejects empty role arrays", () => {

        expect(() => parseApiKeyEntries([
            {
                apiKey:    "secret",
                roles:     [],
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("API key roles must not be empty");

    });

    test("rejects duplicate keys and inverted validity windows", () => {

        expect(() => parseApiKeyEntries([
            {
                apiKey:    "secret",
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            },
            {
                apiKey:    "secret",
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("Duplicate API key entry");

        expect(() => parseApiKeyEntries([
            {
                apiKey:    "secret",
                notBefore: "2026-12-31T23:59:59Z",
                notAfter:  "2026-01-01T00:00:00Z"
            }
        ])).toThrow("notAfter before notBefore");

    });

    test("loads API key entries from a JSON file", () => {

        const directory = mkdtempSync(join(tmpdir(), "chargy-api-keys-"));
        const fileName  = join(directory, "api-keys.json");

        try
        {
            writeFileSync(fileName, JSON.stringify(rawApiKeys), "utf8");

            const entries = loadApiKeysFromFile(fileName);

            expect(entries).toHaveLength(2);
            expect(entries[0]).toMatchObject({
                apiKey: "driver-secret",
                roles:  [ ApiKeyRole.EVDriver ]
            });
        }
        finally
        {
            rmSync(directory, { recursive: true, force: true });
        }

    });

});

describe("API key authentication", () => {

    const entries = parseApiKeyEntries(rawApiKeys);

    test("accepts known API keys inside their validity window", () => {

        expect(authenticateApiKeyHeader("driver-secret", entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok: true,
            credential: {
                apiKey: "driver-secret",
                roles:  [ ApiKeyRole.EVDriver ]
            }
        });

    });

    test("rejects missing, unknown and expired API keys", () => {

        expect(authenticateApiKeyHeader(undefined, entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "missing"
        });

        expect(authenticateApiKeyHeader("nope", entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "unknown"
        });

        expect(authenticateApiKeyHeader("driver-secret", entries, new Date("2027-01-01T00:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "not-after"
        });

    });

    test("empty configured API key lists still authenticate and reject all keys", () => {

        const authenticator = createApiKeyAuthenticator([]);

        expect(authenticator).not.toBeNull();
        expect(authenticator?.("anything")).toMatchObject({
            ok:     false,
            reason: "unknown"
        });

    });

});
