import { createRequire }          from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir }                 from "node:os";
import { join }                   from "node:path";
import { describe, expect, test } from "vitest";
import {
    ApiKeyRole,
    isParsedApiKeyEntry,
    isParsedApiKeyEntryArray,
    isRawApiKeyEntry,
    isRawApiKeyEntryArray,
    type ApiKeyAuthenticationResult,
    type ParsedApiKeyEntry
}                                  from "../src/ts/apiKeys";

const require = createRequire(import.meta.url);

type ApiKeysModule = {
    authenticateApiKeyHeader:  (headerValue:   string | string[] | undefined, apiKeyEntries: ParsedApiKeyEntry[], now?: Date)                   => ApiKeyAuthenticationResult;
    createApiKeyAuthenticator: (apiKeyEntries: ParsedApiKeyEntry[], nowProvider?: () => Date) => ((headerValue: string | string[] | undefined)  => ApiKeyAuthenticationResult) | null;
    findApiKeyEntriesByHeader: (headerValue:   string | string[] | undefined, apiKeyEntries: ParsedApiKeyEntry[])                               => ParsedApiKeyEntry[];
    loadApiKeysFromFile:       (fileName:      string)                                                                                          => ParsedApiKeyEntry[];
    parseApiKeyEntries:        (rawEntries:    unknown)                                                                                         => ParsedApiKeyEntry[];
};

const {
    authenticateApiKeyHeader,
    createApiKeyAuthenticator,
    findApiKeyEntriesByHeader,
    loadApiKeysFromFile,
    parseApiKeyEntries
} = require("../src/apiKeys.cjs") as ApiKeysModule;

const rawApiKeys = [
    {
        token:     "driver-secret",
        notBefore: "2026-01-01T00:00:00Z",
        notAfter:  "2026-12-31T23:59:59Z"
    },
    {
        token:     "root-secret",
        roles:     [ "evDriver", "root" ],
        notBefore: "2026-01-01T00:00:00Z",
        notAfter:  "2026-12-31T23:59:59Z"
    }
];

describe("API key parsing", () => {

    test("exposes TypeScript type guards for raw and parsed API key entries", () => {

        const rawEntry: unknown = {
            token:     "guarded-secret",
            roles:     [ ApiKeyRole.Root ],
            notBefore: "2026-01-01T00:00:00Z"
        };

        expect(isRawApiKeyEntry(rawEntry)).toBe(true);

        if (isRawApiKeyEntry(rawEntry))
        {
            const token: string = rawEntry.token;
            const role:  ApiKeyRole | undefined = rawEntry.roles?.[0];

            expect(token).toBe("guarded-secret");
            expect(role).toBe(ApiKeyRole.Root);
        }

        expect(isRawApiKeyEntryArray([ rawEntry ])).toBe(true);
        expect(isRawApiKeyEntry({ token: "invalid-role", roles: [ "admin" ] })).toBe(false);
        expect(isRawApiKeyEntry({ token: "bad-time", notBefore: "2026-01-01" })).toBe(false);

        const parsedEntries = parseApiKeyEntries([ rawEntry ]);

        expect(isParsedApiKeyEntry(parsedEntries[0])).toBe(true);
        expect(isParsedApiKeyEntryArray(parsedEntries)).toBe(true);
        expect(isParsedApiKeyEntry({ token: "raw-time", roles: [ ApiKeyRole.Root ], notBefore: "2026-01-01T00:00:00Z" })).toBe(false);

    });

    test("parses API key entries and defaults roles to evDriver", () => {

        const entries = parseApiKeyEntries(rawApiKeys);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
            token: "driver-secret",
            roles: [ ApiKeyRole.EVDriver ]
        });
        expect(entries[1]).toMatchObject({
            token: "root-secret",
            roles: [ ApiKeyRole.EVDriver, ApiKeyRole.Root ]
        });

    });

    test("parses entries without validity timestamps", () => {

        const entries = parseApiKeyEntries([
            {
                token: "unbounded-secret"
            }
        ]);

        expect(entries[0]).toMatchObject({
            token: "unbounded-secret",
            roles: [ ApiKeyRole.EVDriver ]
        });
        expect(entries[0]?.notBefore).toBeUndefined();
        expect(entries[0]?.notAfter).toBeUndefined();

    });

    test("rejects legacy apiKey and role fields", () => {

        expect(() => parseApiKeyEntries([
            {
                apiKey: "legacy-secret"
            }
        ])).toThrow("must use token, not apiKey");

        expect(() => parseApiKeyEntries([
            {
                token: "secret",
                role:  "root"
            }
        ])).toThrow("must use roles, not role");

    });

    test("rejects unsupported roles and invalid timestamps", () => {

        expect(() => parseApiKeyEntries([
            {
                token:     "secret",
                roles:     [ "admin" ],
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("Invalid API key role");

        expect(() => parseApiKeyEntries([
            {
                token:     "secret",
                notBefore: "2026-01-01",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("Invalid API key notBefore timestamp");

    });

    test("rejects empty role arrays", () => {

        expect(() => parseApiKeyEntries([
            {
                token:     "secret",
                roles:     [],
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ])).toThrow("API key roles must not be empty");

    });

    test("allows repeated tokens and rejects inverted validity windows", () => {

        const entries = parseApiKeyEntries([
            {
                token:     "secret",
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            },
            {
                token:     "secret",
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ]);

        expect(entries).toHaveLength(2);
        expect(findApiKeyEntriesByHeader("secret", entries)).toHaveLength(2);

        expect(() => parseApiKeyEntries([
            {
                token:     "secret",
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
                token: "driver-secret",
                roles: [ ApiKeyRole.EVDriver ]
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
                token: "driver-secret",
                roles: [ ApiKeyRole.EVDriver ]
            }
        });

    });

    test("accepts known API keys without validity timestamps", () => {

        const unboundedEntries = parseApiKeyEntries([
            {
                token: "unbounded-secret"
            }
        ]);

        expect(authenticateApiKeyHeader("unbounded-secret", unboundedEntries, new Date("2035-01-01T00:00:00Z"))).toMatchObject({
            ok: true,
            credential: {
                token: "unbounded-secret",
                roles: [ ApiKeyRole.EVDriver ]
            }
        });

    });

    test("accepts a repeated token when any matching entry is active", () => {

        const repeatedEntries = parseApiKeyEntries([
            {
                token:    "rotating-secret",
                notAfter: "2025-12-31T23:59:59Z"
            },
            {
                token:     "rotating-secret",
                notBefore: "2026-01-01T00:00:00Z",
                notAfter:  "2026-12-31T23:59:59Z"
            }
        ]);

        expect(authenticateApiKeyHeader("rotating-secret", repeatedEntries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok: true,
            credential: {
                token: "rotating-secret",
                roles: [ ApiKeyRole.EVDriver ]
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
