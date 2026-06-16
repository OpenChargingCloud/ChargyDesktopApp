import { createRequire }          from "node:module";
import { readFileSync }           from "node:fs";
import type { AddressInfo }       from "node:net";
import { request as httpClientRequest } from "node:http";
import type { Server }            from "node:http";
import { describe, expect, test } from "vitest";
import { createChargy }           from './testHelper';
import {
    ApiKeyRole,
    type ApiKeyAuthenticationResult,
    type ParsedApiKeyEntry
}                                  from "../src/ts/apiKeys";

const require = createRequire(import.meta.url);

type HttpDispatchRequest = {
    operation:    string;
    pretty:       boolean;
    contentType?: string;
    data:         Buffer;
};

type HttpDispatchResponse = {
    ok:       boolean;
    message?: string;
    result?:  unknown;
};

type HttpApiModule = {
    negotiateContentType: (acceptHeader: string | string[] | undefined, supportedMediaTypes: string[], defaultMediaType: string) => string | null;
    parseAcceptLanguage: (acceptLanguageHeader?: string | string[]) => string | null;
    startChargyHttpServer: (options: {
        host?:               string;
        port:                number;
        dispatchHttpRequest: (request: HttpDispatchRequest) => Promise<HttpDispatchResponse> | HttpDispatchResponse;
        language?:           string;
        i18n?:               Record<string, Record<string, string>>;
        maxContentSize?:     number;
        requestTimeoutMs?:   number;
        serializeDispatch?:  boolean;
        apiKeyAuthenticator?: (headerValue: string | string[] | undefined) => ApiKeyAuthenticationResult;
        apiKeyEntries?:      ParsedApiKeyEntry[];
        log?:                (message: string) => void;
    }) => Server;
};

type ApiKeysModule = {
    createApiKeyAuthenticator: (
        apiKeyEntries: ParsedApiKeyEntry[],
        nowProvider?: () => Date
    ) => ((headerValue: string | string[] | undefined) => ApiKeyAuthenticationResult) | null;
    parseApiKeyEntries: (rawEntries: unknown) => ParsedApiKeyEntry[];
};

const {
    negotiateContentType,
    parseAcceptLanguage,
    startChargyHttpServer
} = require("../src/httpApi.cjs") as HttpApiModule;

const {
    createApiKeyAuthenticator,
    parseApiKeyEntries
} = require("../src/apiKeys.cjs") as ApiKeysModule;

const cliI18N = require("../src/i18n_CLI.json") as Record<string, Record<string, string>>;

const chargeTransparencyRecord = {
    chargingSessions: [
        {
            verificationResult: {
                status: "ValidSignature"
            }
        }
    ]
};

const rawApiKeys = [
    {
        token:    "driver-secret",
        notAfter: "2025-12-31T23:59:59Z"
    },
    {
        token:     "driver-secret",
        notBefore: "2027-01-01T00:00:00Z"
    },
    {
        token:     "root-secret",
        roles:     [ "root" ],
        notBefore: "2026-01-01T00:00:00Z",
        notAfter:  "2026-12-31T23:59:59Z"
    }
];

async function dispatchToChargyCore(request: HttpDispatchRequest): Promise<HttpDispatchResponse> {

    const result = await createChargy().DetectAndConvertContentFormat([
        {
            name: "uploaded-transparency-record.png",
            type: request.contentType ?? "application/octet-stream",
            data: new Uint8Array(request.data)
        }
    ]);

    return {
        ok: true,
        result
    };

}

async function withHttpServer(
    dispatchHttpRequest: (request: HttpDispatchRequest) => Promise<HttpDispatchResponse> | HttpDispatchResponse,
    testCase: (baseUrl: string) => Promise<void>,
    options: {
        language?:       string;
        i18n?:           Record<string, Record<string, string>>;
        maxContentSize?: number;
        apiKeyAuthenticator?: (headerValue: string | string[] | undefined) => ApiKeyAuthenticationResult;
        apiKeyEntries?:      ParsedApiKeyEntry[];
    } = {}
): Promise<void> {

    const server = startChargyHttpServer({
        host: "127.0.0.1",
        port: 0,
        dispatchHttpRequest,
        language: options.language,
        i18n: options.i18n,
        maxContentSize: options.maxContentSize,
        apiKeyAuthenticator: options.apiKeyAuthenticator,
        apiKeyEntries: options.apiKeyEntries,
        log: () => {}
    });

    await new Promise<void>(resolve => server.once("listening", resolve));

    const address = server.address() as AddressInfo;

    try
    {
        await testCase(`http://127.0.0.1:${address.port}`);
    }
    finally
    {
        await new Promise<void>((resolve, reject) => {
            server.close(exception => exception != null ? reject(exception) : resolve());
        });
    }

}

describe("Chargy HTTP API", () => {

    test("negotiates the best supported Accept content type", () => {

        expect(negotiateContentType(
            "application/xml;q=0.4, text/plain;q=0.9, application/json;q=0.8",
            [ "application/json", "text/plain", "application/xml" ],
            "application/json"
        )).toBe("text/plain");

        expect(negotiateContentType(
            "application/*;q=0.7",
            [ "application/json" ],
            "application/json"
        )).toBe("application/json");

        expect(negotiateContentType(
            "image/png",
            [ "application/json" ],
            "application/json"
        )).toBeNull();

    });

    test("parses the best supported Accept-Language value", () => {

        expect(parseAcceptLanguage("fr-CH, de-DE;q=0.9, en;q=0.8")).toBe("de");
        expect(parseAcceptLanguage("en-US;q=0.4, de;q=0.8")).toBe("de");
        expect(parseAcceptLanguage("fr, *;q=0.5")).toBeNull();

    });

    test("serves HTTP help via GET / without dispatching to the renderer", async () => {

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/`);

                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toContain("text/plain");

                const text = await response.text();

                expect(text).toContain("This is a Chargy HTTP service");
                expect(text).toContain("POST /verify");
                expect(text).toContain("POST /convert");
                expect(text).toContain("GET /apiKeys");
            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("rejects GET /apiKeys without API-Key", async () => {

        const apiKeyEntries       = parseApiKeyEntries(rawApiKeys);
        const apiKeyAuthenticator = createApiKeyAuthenticator(
            apiKeyEntries,
            () => new Date("2026-06-15T12:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/apiKeys`);

                expect(response.status).toBe(401);
                expect(response.headers.get("www-authenticate")).toBe("API-Key");
                expect(await response.text()).toContain("API key");
            },
            {
                apiKeyAuthenticator: apiKeyAuthenticator ?? undefined,
                apiKeyEntries
            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("returns matching API keys via GET /apiKeys for known non-root tokens outside their validity window", async () => {

        const apiKeyEntries       = parseApiKeyEntries(rawApiKeys);
        const apiKeyAuthenticator = createApiKeyAuthenticator(
            apiKeyEntries,
            () => new Date("2026-06-15T12:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/apiKeys`, {
                    headers: {
                        "API-Key": "driver-secret"
                    }
                });

                expect(response.status).toBe(200);

                const apiKeys = await response.json() as Array<{
                    token:      string;
                    roles:      string[];
                    notBefore?: string;
                    notAfter?:  string;
                }>;

                expect(apiKeys).toEqual([
                    {
                        token:    "driver-secret",
                        roles:    [ ApiKeyRole.EVDriver ],
                        notAfter: "2025-12-31T23:59:59.000Z"
                    },
                    {
                        token:     "driver-secret",
                        roles:     [ ApiKeyRole.EVDriver ],
                        notBefore: "2027-01-01T00:00:00.000Z"
                    }
                ]);
            },
            {
                apiKeyAuthenticator: apiKeyAuthenticator ?? undefined,
                apiKeyEntries
            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("returns configured API keys via GET /apiKeys for API keys with the root role", async () => {

        const apiKeyEntries       = parseApiKeyEntries(rawApiKeys);
        const apiKeyAuthenticator = createApiKeyAuthenticator(
            apiKeyEntries,
            () => new Date("2026-06-15T12:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/apiKeys`, {
                    headers: {
                        "API-Key": "root-secret"
                    }
                });

                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toContain("application/json");

                const apiKeys = await response.json() as Array<{
                    token:     string;
                    roles:     string[];
                    notBefore?: string;
                    notAfter?:  string;
                }>;

                expect(apiKeys).toEqual([
                    {
                        token:    "driver-secret",
                        roles:    [ ApiKeyRole.EVDriver ],
                        notAfter: "2025-12-31T23:59:59.000Z"
                    },
                    {
                        token:     "driver-secret",
                        roles:     [ ApiKeyRole.EVDriver ],
                        notBefore: "2027-01-01T00:00:00.000Z"
                    },
                    {
                        token:     "root-secret",
                        roles:     [ ApiKeyRole.Root ],
                        notBefore: "2026-01-01T00:00:00.000Z",
                        notAfter:  "2026-12-31T23:59:59.000Z"
                    }
                ]);
            },
            {
                apiKeyAuthenticator: apiKeyAuthenticator ?? undefined,
                apiKeyEntries
            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("keeps GET / reachable without API-Key when API key authentication is enabled", async () => {

        const apiKeyAuthenticator = createApiKeyAuthenticator(
            parseApiKeyEntries([
                {
                    token:     "driver-secret",
                    notBefore: "2026-01-01T00:00:00Z",
                    notAfter:  "2026-12-31T23:59:59Z"
                }
            ]),
            () => new Date("2026-06-15T12:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/`);

                expect(response.status).toBe(200);
                expect(await response.text()).toContain("This is a Chargy HTTP service");
            },
            { apiKeyAuthenticator: apiKeyAuthenticator ?? undefined }
        );

        expect(dispatchCount).toBe(0);

    });

    test("rejects POST /verify without API-Key when API key authentication is enabled", async () => {

        const apiKeyAuthenticator = createApiKeyAuthenticator(
            parseApiKeyEntries([
                {
                    token:     "driver-secret",
                    notBefore: "2026-01-01T00:00:00Z",
                    notAfter:  "2026-12-31T23:59:59Z"
                }
            ]),
            () => new Date("2026-06-15T12:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method: "POST",
                    body:   Buffer.from("transparency-record")
                });

                expect(response.status).toBe(401);
                expect(response.headers.get("www-authenticate")).toBe("API-Key");
                expect(await response.text()).toContain("API key");
            },
            { apiKeyAuthenticator: apiKeyAuthenticator ?? undefined }
        );

        expect(dispatchCount).toBe(0);

    });

    test("rejects POST /convert without API-Key when API key authentication is enabled", async () => {

        const apiKeyAuthenticator = createApiKeyAuthenticator(
            parseApiKeyEntries([
                {
                    token:     "driver-secret",
                    notBefore: "2026-01-01T00:00:00Z",
                    notAfter:  "2026-12-31T23:59:59Z"
                }
            ]),
            () => new Date("2026-06-15T12:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/convert`, {
                    method: "POST",
                    body:   Buffer.from("transparency-record")
                });

                expect(response.status).toBe(401);
                expect(await response.text()).toContain("API key");
            },
            { apiKeyAuthenticator: apiKeyAuthenticator ?? undefined }
        );

        expect(dispatchCount).toBe(0);

    });

    test("accepts POST /verify with a valid API-Key", async () => {

        const apiKeyAuthenticator = createApiKeyAuthenticator(
            parseApiKeyEntries([
                {
                    token:     "driver-secret",
                    notBefore: "2026-01-01T00:00:00Z",
                    notAfter:  "2026-12-31T23:59:59Z"
                }
            ]),
            () => new Date("2026-06-15T12:00:00Z")
        );

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "API-Key": "driver-secret"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(await response.json()).toBe("Valid signature");
            },
            { apiKeyAuthenticator: apiKeyAuthenticator ?? undefined }
        );

    });

    test("rejects POST /verify with an expired API-Key", async () => {

        const apiKeyAuthenticator = createApiKeyAuthenticator(
            parseApiKeyEntries([
                {
                    token:     "driver-secret",
                    notBefore: "2026-01-01T00:00:00Z",
                    notAfter:  "2026-12-31T23:59:59Z"
                }
            ]),
            () => new Date("2027-01-01T00:00:00Z")
        );

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "API-Key": "driver-secret"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(401);
            },
            { apiKeyAuthenticator: apiKeyAuthenticator ?? undefined }
        );

        expect(dispatchCount).toBe(0);

    });

    test("starts an HTTP server and routes POST /verify to the renderer dispatcher", async () => {

        const dispatchedRequests: HttpDispatchRequest[] = [];

        await withHttpServer(
            request => {
                dispatchedRequests.push(request);
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method: "POST",
                    body:   Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(await response.json()).toBe("Valid signature");
            }
        );

        expect(dispatchedRequests).toHaveLength(1);
        expect(dispatchedRequests[0]).toMatchObject({
            operation: "verify",
            pretty:    false
        });
        expect(dispatchedRequests[0]?.data.toString("utf-8")).toBe("transparency-record");

    });

    test("returns POST /verify as text/plain when requested via Accept", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept": "text/plain"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toContain("text/plain");
                expect(await response.text()).toBe("Valid signature\n");
            }
        );

    });

    test("returns POST /verify as CSV when requested via Accept", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept": "text/csv"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toContain("text/csv");
                expect(await response.text()).toBe("session,status\n1,Valid signature\n");
            }
        );

    });

    test("returns POST /verify as XML when requested via Accept", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept": "application/xml"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toContain("application/xml");
                expect(await response.text()).toContain("<result session=\"1\">Valid signature</result>");
            }
        );

    });

    test("verifies an uploaded QR-code PNG transparency record through the real Chargy core", async () => {

        const pngFixture = readFileSync(new URL("fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png", import.meta.url));

        await withHttpServer(
            dispatchToChargyCore,
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept":       "text/plain",
                        "Content-Type": "image/png"
                    },
                    body:    pngFixture
                });

                expect(response.status).toBe(200);
                expect(await response.text()).toBe("Valid signature\n");
            }
        );

    });

    test("converts an uploaded QR-code PNG transparency record through the real Chargy core", async () => {

        const pngFixture = readFileSync(new URL("fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png", import.meta.url));

        await withHttpServer(
            dispatchToChargyCore,
            async baseUrl => {
                const response = await fetch(`${baseUrl}/convert?pretty`, {
                    method:  "POST",
                    headers: {
                        "Accept":       "application/json",
                        "Content-Type": "image/png"
                    },
                    body:    pngFixture
                });

                expect(response.status).toBe(200);

                const result = await response.json();

                expect(result.chargingSessions).toHaveLength(1);
                expect(result.chargingSessions[0].verificationResult.status).toBe("ValidSignature");
                expect(result.chargingSessions[0].EVSEId).toBe("DE*GEF*EVSE*CHARGY*1");
            }
        );

    });

    test("rejects POST /verify when no requested response content type is supported", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept": "image/png"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(406);
                expect(await response.text()).toContain("No acceptable response content type found for /verify");
            }
        );

    });

    test("localizes POST /verify status text with the configured CLI language", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method: "POST",
                    body:   Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(await response.json()).toBe("Gültige Signatur");
            },
            {
                language: "de",
                i18n:     cliI18N
            }
        );

    });

    test("uses Accept-Language as per-request override for POST /verify status text", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept-Language": "fr-CH, de-DE;q=0.9, en;q=0.8"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(await response.json()).toBe("Gültige Signatur");
            },
            {
                language: "en",
                i18n:     cliI18N
            }
        );

    });

    test("falls back to the configured CLI language when Accept-Language is unsupported", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method:  "POST",
                    headers: {
                        "Accept-Language": "fr-CH, es;q=0.9"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(200);
                expect(await response.json()).toBe("Gültige Signatur");
            },
            {
                language: "de",
                i18n:     cliI18N
            }
        );

    });

    test("rejects POST /convert when JSON is not accepted", async () => {

        await withHttpServer(
            () => ({
                ok:     true,
                result: chargeTransparencyRecord
            }),
            async baseUrl => {
                const response = await fetch(`${baseUrl}/convert`, {
                    method:  "POST",
                    headers: {
                        "Accept": "text/plain"
                    },
                    body:    Buffer.from("transparency-record")
                });

                expect(response.status).toBe(406);
                expect(await response.text()).toContain("No acceptable response content type found for /convert");
            }
        );

    });

    test("routes POST /convert to the renderer dispatcher and returns the converted record", async () => {

        let dispatchedRequest: HttpDispatchRequest | undefined;

        await withHttpServer(
            request => {
                dispatchedRequest = request;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/convert?pretty`, {
                    method:  "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body:    Buffer.from("{\"payload\":true}")
                });

                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toContain("application/json");
                expect(await response.json()).toEqual(chargeTransparencyRecord);
            }
        );

        expect(dispatchedRequest).toMatchObject({
            operation:   "convert",
            pretty:      true,
            contentType: "application/json"
        });
        expect(dispatchedRequest?.data.toString("utf-8")).toBe("{\"payload\":true}");

    });

    test("rejects unsupported methods and endpoints before dispatching to the renderer", async () => {

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method: "GET"
                });

                expect(response.status).toBe(400);
                expect(await response.text()).toContain("Please use POST /verify");
            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("rejects empty request bodies before dispatching to the renderer", async () => {

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/convert`, {
                    method: "POST"
                });

                expect(response.status).toBe(400);
                expect(await response.text()).toContain("Please upload any kind of transparency record");
            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("rejects oversized requests via the Content-Length header with 413", async () => {

        let dispatchCount = 0;

        await withHttpServer(
            () => {
                dispatchCount++;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method: "POST",
                    body:   Buffer.alloc(64, 0x41)
                });

                expect(response.status).toBe(413);
                expect(await response.text()).toContain("too large");
            },
            { maxContentSize: 16 }
        );

        expect(dispatchCount).toBe(0);

    });

    test("returns 500 when the renderer dispatcher throws", async () => {

        await withHttpServer(
            () => {
                throw new Error("renderer exploded");
            },
            async baseUrl => {
                const response = await fetch(`${baseUrl}/verify`, {
                    method: "POST",
                    body:   Buffer.from("transparency-record")
                });

                expect(response.status).toBe(500);
                expect((await response.json() as { message: string }).message).toBe("renderer exploded");
            }
        );

    });

    test("serializes concurrent dispatches against the shared renderer", async () => {

        const events: string[]  = [];
        let   active            = 0;
        let   maxActive         = 0;

        await withHttpServer(
            async request => {
                active++;
                maxActive = Math.max(maxActive, active);
                events.push("start:" + request.data.toString("utf-8"));
                await new Promise<void>(resolve => setTimeout(resolve, 25));
                events.push("end:" + request.data.toString("utf-8"));
                active--;
                return {
                    ok:     true,
                    result: chargeTransparencyRecord
                };
            },
            async baseUrl => {
                await Promise.all([
                    fetch(`${baseUrl}/convert`, { method: "POST", body: Buffer.from("A") }),
                    fetch(`${baseUrl}/convert`, { method: "POST", body: Buffer.from("B") })
                ]);
            }
        );

        // Never two verifications in flight at the same time...
        expect(maxActive).toBe(1);
        // ...and every start is immediately followed by its own end (no interleaving).
        expect(events).toHaveLength(4);

        const [ firstStart, firstEnd, secondStart, secondEnd ] = events;

        expect(firstStart?.startsWith("start:")).toBe(true);
        expect(firstEnd).toBe("end:" + String(firstStart).slice("start:".length));
        expect(secondStart?.startsWith("start:")).toBe(true);
        expect(secondEnd).toBe("end:" + String(secondStart).slice("start:".length));

    });

});

describe("Chargy HTTP API - robustness via raw sockets", () => {

    function withDirectServer(
        options: {
            maxContentSize?:   number;
            requestTimeoutMs?: number;
        },
        dispatchHttpRequest: (request: HttpDispatchRequest) => Promise<HttpDispatchResponse> | HttpDispatchResponse,
        testCase: (port: number) => Promise<void>
    ): Promise<void> {

        const server = startChargyHttpServer({
            host: "127.0.0.1",
            port: 0,
            dispatchHttpRequest,
            log:  () => {},
            ...options
        });

        return new Promise<void>(resolve => server.once("listening", resolve))
            .then(async () => {
                const address = server.address() as AddressInfo;
                try
                {
                    await testCase(address.port);
                }
                finally
                {
                    await new Promise<void>(resolve => {
                        server.close(() => { resolve(); });
                    });
                }
            });

    }

    test("rejects oversized streamed bodies without a Content-Length", async () => {

        let dispatchCount = 0;

        await withDirectServer(
            { maxContentSize: 16 },
            () => {
                dispatchCount++;
                return { ok: true, result: chargeTransparencyRecord };
            },
            async port => {

                const outcome = await new Promise<string>(resolve => {

                    const clientRequest = httpClientRequest(
                        { host: "127.0.0.1", port, method: "POST", path: "/verify" },
                        response => {
                            response.resume();
                            resolve("status:" + String(response.statusCode));
                        }
                    );

                    clientRequest.on("error", () => { resolve("error"); });

                    // No Content-Length -> Node uses chunked transfer encoding, so the
                    // server must reject via the streaming size guard.
                    clientRequest.write(Buffer.alloc(64, 0x41));
                    clientRequest.end();

                });

                // Either the 413 response is received, or the connection is reset mid-stream.
                expect(outcome === "status:413" || outcome === "error").toBe(true);

            }
        );

        expect(dispatchCount).toBe(0);

    });

    test("disconnects slow clients via the request timeout", async () => {

        let dispatchCount = 0;

        await withDirectServer(
            { requestTimeoutMs: 120 },
            () => {
                dispatchCount++;
                return { ok: true, result: chargeTransparencyRecord };
            },
            async port => {

                const outcome = await new Promise<string>(resolve => {

                    const clientRequest = httpClientRequest(
                        {
                            host:    "127.0.0.1",
                            port,
                            method:  "POST",
                            path:    "/verify",
                            headers: { "Content-Length": "1000" }
                        },
                        response => {
                            response.resume();
                            response.on("end", () => { resolve("status:" + String(response.statusCode)); });
                        }
                    );

                    clientRequest.on("error", () => { resolve("error"); });

                    // Announce 1000 bytes but only ever send a few and never finish.
                    clientRequest.write("partial");

                });

                expect(outcome === "status:408" || outcome === "error").toBe(true);

            }
        );

        expect(dispatchCount).toBe(0);

    });

});
