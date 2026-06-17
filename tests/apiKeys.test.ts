import { createRequire }          from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir }                 from "node:os";
import { join }                   from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { generateTOTPs }          from "@open-charging-cloud/totp";
import {
    ApiKeyRole,
    isParsedApiKeyEntry,
    isParsedApiKeyEntryArray,
    isRawApiKeyEntry,
    isRawApiKeyEntryArray,
    type ApiKeyAuthenticationResult,
    type ITOTPApiKeyConfiguration,
    type ParsedApiKeyEntry
}                                  from "../src/ts/apiKeys";

const require = createRequire(import.meta.url);

type ApiKeysModule = {
    authenticateAuthorizationHeader:  (headerValue:   string | string[] | undefined, apiKeyEntries: ParsedApiKeyEntry[], now?: Date)                  => ApiKeyAuthenticationResult;
    createApiKeyAuthenticator:        (apiKeyEntries: ParsedApiKeyEntry[], nowProvider?: () => Date) => ((headerValue: string | string[] | undefined) => ApiKeyAuthenticationResult) | null;
    findApiKeyEntriesByAuthorization: (headerValue:   string | string[] | undefined, apiKeyEntries: ParsedApiKeyEntry[], now?: Date)                  => ParsedApiKeyEntry[];
    generateTOTPApiKeyValue:          (totpConfiguration: ITOTPApiKeyConfiguration, now?: Date, slotOffset?: number)                                   => string;
    initializeTOTPGenerator:           () => Promise<void>;
    loadApiKeysFromFile:              (fileName:      string)                                                                                         => ParsedApiKeyEntry[];
    parseApiKeyEntries:               (rawEntries:    unknown)                                                                                        => ParsedApiKeyEntry[];
};

const {
    authenticateAuthorizationHeader,
    createApiKeyAuthenticator,
    findApiKeyEntriesByAuthorization,
    generateTOTPApiKeyValue,
    initializeTOTPGenerator,
    loadApiKeysFromFile,
    parseApiKeyEntries
} = require("../src/apiKeys.cjs") as ApiKeysModule;

beforeAll(async () => {
    await initializeTOTPGenerator();
});

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
        expect(isRawApiKeyEntry({
            token: "totp-guarded-secret",
            totp:  {
                sharedSecrect: "secureChargingSecret2026",
                validityTime:  10,
                length:        24,
                alphabet:      "0123456789abcdef"
            }
        })).toBe(true);
        expect(isRawApiKeyEntry({ token: "legacy-secret", apiKey: "legacy-secret" })).toBe(false);
        expect(isRawApiKeyEntry({ token: "legacy-secret", role: "root" })).toBe(false);
        expect(isRawApiKeyEntry({ token: "invalid-role",  roles: [ "admin" ] })).toBe(false);
        expect(isRawApiKeyEntry({ token: "bad-time",      notBefore: "2026-01-01" })).toBe(false);

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

    test("parses TOTP API key entries with defaults", () => {

        const entries = parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect: "secureChargingSecret2026",
                    length:        24
                }
            }
        ]);

        expect(entries[0]).toMatchObject({
            token: "totp-driver",
            totp:  {
                sharedSecrect: "secureChargingSecret2026",
                validityTime:  10,
                length:        24,
                hashAlgorithm: "sha256"
            },
            roles: [ ApiKeyRole.EVDriver ]
        });
        expect(entries[0]?.totp?.alphabet).toContain("0123456789");
        expect(isParsedApiKeyEntry(entries[0])).toBe(true);

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

    test("rejects invalid TOTP API key configurations", () => {

        expect(() => parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect: "too-short",
                    length:        24
                }
            }
        ])).toThrow("sharedSecrect must contain at least 16 characters");

        expect(() => parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect: "secure Charging Secret 2026",
                    length:        24
                }
            }
        ])).toThrow("sharedSecrect must not contain whitespace");

        expect(() => parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect: "secureChargingSecret2026",
                    length:        16
                }
            }
        ])).toThrow("TOTP length must be greater than 16");

        expect(() => parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect: "secureChargingSecret2026",
                    length:        24,
                    alphabet:      "aabc"
                }
            }
        ])).toThrow("must not contain duplicate characters");

        expect(() => parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect:  "secureChargingSecret2026",
                    length:         24,
                    encoding:       "0123456789abcdef"
                }
            }
        ])).toThrow("must use alphabet, not encoding");

        expect(() => parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect:  "secureChargingSecret2026",
                    length:         24,
                    hashAlgorithm:  "HMACSHA512"
                }
            }
        ])).toThrow("Unsupported TOTP hashAlgorithm");

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
        expect(findApiKeyEntriesByAuthorization("Bearer secret", entries)).toHaveLength(2);

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

        expect(authenticateAuthorizationHeader("Bearer driver-secret", entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
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

        expect(authenticateAuthorizationHeader("Bearer unbounded-secret", unboundedEntries, new Date("2035-01-01T00:00:00Z"))).toMatchObject({
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

        expect(authenticateAuthorizationHeader("Bearer rotating-secret", repeatedEntries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok: true,
            credential: {
                token: "rotating-secret",
                roles: [ ApiKeyRole.EVDriver ]
            }
        });

    });

    test("accepts TOTP API keys from the previous, current and next time slot", () => {

        const now     = new Date("2026-06-15T12:00:05Z");
        const entries = parseApiKeyEntries([
            {
                token: "totp-driver",
                totp:  {
                    sharedSecrect: "secureChargingSecret2026",
                    validityTime:  10,
                    length:        24,
                    alphabet:      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                }
            }
        ]);

        const totp = entries[0]?.totp;

        expect(totp).toBeDefined();

        if (totp == null)
            throw new Error("Missing parsed TOTP configuration.");

        const previousTOTP = generateTOTPApiKeyValue(totp, now, -1);
        const currentTOTP  = generateTOTPApiKeyValue(totp, now);
        const nextTOTP     = generateTOTPApiKeyValue(totp, now, 1);
        const oldTOTP      = generateTOTPApiKeyValue(totp, now, -2);
        const packageTOTPs = generateTOTPs({
            sharedSecret: totp.sharedSecrect,
            validityTime: totp.validityTime,
            totpLength:   totp.length,
            alphabet:     totp.alphabet,
            timestamp:    now
        });

        expect(currentTOTP).toHaveLength(24);
        expect(currentTOTP).not.toBe("totp-driver");
        expect(previousTOTP).toBe(packageTOTPs.previous);
        expect(currentTOTP).toBe(packageTOTPs.current);
        expect(nextTOTP).toBe(packageTOTPs.next);

        expect(findApiKeyEntriesByAuthorization("TOTP totp-driver " + currentTOTP, entries, now)).toHaveLength(1);
        expect(findApiKeyEntriesByAuthorization("Bearer totp-driver", entries, now)).toHaveLength(0);

        for (const acceptedTOTP of [ previousTOTP, currentTOTP, nextTOTP ])
        {
            expect(authenticateAuthorizationHeader("TOTP totp-driver " + acceptedTOTP, entries, now)).toMatchObject({
                ok: true,
                credential: {
                    token: "totp-driver",
                    roles: [ ApiKeyRole.EVDriver ]
                }
            });
        }

        expect(authenticateAuthorizationHeader("Bearer totp-driver", entries, now)).toMatchObject({
            ok:     false,
            reason: "unknown"
        });
        expect(authenticateAuthorizationHeader("TOTP totp-driver " + oldTOTP, entries, now)).toMatchObject({
            ok:     false,
            reason: "unknown"
        });

    });

    test("generates TOTP API keys with SHA-384 and SHA-512 when configured", () => {

        const now = new Date("2026-06-15T12:00:05Z");
        const entries = parseApiKeyEntries([
            {
                token: "totp-driver-sha384",
                totp:  {
                    sharedSecrect:  "secureChargingSecret2026",
                    validityTime:   10,
                    length:         24,
                    hashAlgorithm:  "sha384",
                    alphabet:       "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                }
            },
            {
                token: "totp-driver-sha512",
                totp:  {
                    sharedSecrect:  "secureChargingSecret2026",
                    validityTime:   10,
                    length:         24,
                    hashAlgorithm:  "sha512",
                    alphabet:       "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                }
            }
        ]);

        const sha384TOTP = entries[0]?.totp;
        const sha512TOTP = entries[1]?.totp;

        expect(sha384TOTP).toBeDefined();
        expect(sha512TOTP).toBeDefined();

        if (sha384TOTP == null || sha512TOTP == null)
            throw new Error("Missing parsed TOTP configuration.");

        expect(generateTOTPApiKeyValue(sha384TOTP, now)).toBe(generateTOTPs({
            sharedSecret:   sha384TOTP.sharedSecrect,
            validityTime:   sha384TOTP.validityTime,
            totpLength:     sha384TOTP.length,
            alphabet:       sha384TOTP.alphabet,
            timestamp:      now,
            hashAlgorithm:  "sha384"
        }).current);

        expect(generateTOTPApiKeyValue(sha512TOTP, now)).toBe(generateTOTPs({
            sharedSecret:   sha512TOTP.sharedSecrect,
            validityTime:   sha512TOTP.validityTime,
            totpLength:     sha512TOTP.length,
            alphabet:       sha512TOTP.alphabet,
            timestamp:      now,
            hashAlgorithm:  "sha512"
        }).current);

    });

    test("rejects missing, unknown and expired API keys", () => {

        expect(authenticateAuthorizationHeader(undefined, entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "missing"
        });

        expect(authenticateAuthorizationHeader("nope", entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "malformed"
        });

        expect(authenticateAuthorizationHeader("Bearer nope", entries, new Date("2026-06-15T12:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "unknown"
        });

        expect(authenticateAuthorizationHeader("Bearer driver-secret", entries, new Date("2027-01-01T00:00:00Z"))).toMatchObject({
            ok:     false,
            reason: "not-after"
        });

    });

    test("empty configured API key lists still authenticate and reject all keys", () => {

        const authenticator = createApiKeyAuthenticator([]);

        expect(authenticator).not.toBeNull();
        expect(authenticator?.("Bearer anything")).toMatchObject({
            ok:     false,
            reason: "unknown"
        });

    });

});
