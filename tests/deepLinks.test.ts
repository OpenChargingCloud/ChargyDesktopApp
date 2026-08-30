import { describe, expect, test } from "vitest";

import {
    decodeBase64Url,
    decodeUtf8,
    findExternalURLRule,
    getDeepLinkFileName,
    isWithinURLPrefix,
    parseExternalURLConfig,
    parseExternalURLConfigMode,
    readResponseWithinLimit,
    withDeepLinkVerificationToken
} from "../src/ts/deepLinks";

describe("Deep link helpers", () => {

    test("decodes unpadded Base64URL payloads", () => {

        expect(decodeUtf8(decodeBase64Url("eyJoZWxsbyI6IndvcmxkIn0"))).toBe('{"hello":"world"}');
        expect(decodeUtf8(decodeBase64Url("SGVsbG8td29ybGQ"))).toBe("Hello-world");
        expect(decodeBase64Url("-_8")).toEqual(new Uint8Array([251, 255]));

    });

    test("rejects standard Base64, padding and whitespace", () => {

        expect(() => decodeBase64Url("+/8=")).toThrow("must use unpadded Base64URL");
        expect(() => decodeBase64Url("eyJoZWxsbyI6IndvcmxkIn0=")).toThrow("must use unpadded Base64URL");
        expect(() => decodeBase64Url(" SGVsbG8td29ybGQ")).toThrow("must use unpadded Base64URL");

    });

    test("parses external URL allowlist config", () => {

        const rules = parseExternalURLConfig(`
            # comments and blank lines are ignored
            https://api.example.org/ctrs/ 100
            http://localhost:8080/data/ 1.5
            ftp://api.example.org/nope/ 100
            https://api.example.org/bad-size/ nope
        `);

        expect(rules).toEqual([
            {
                prefix:          "https://api.example.org/ctrs/",
                maxPayloadBytes: 102400
            },
            {
                prefix:          "http://localhost:8080/data/",
                maxPayloadBytes: 1536
            }
        ]);

    });

    test("reads the reload mode, defaulting to open", () => {

        // The mode directive coexists with prefixes and does not become a rule.
        const config = `
            mode strict
            https://api.example.org/ctrs/ 100
        `;

        expect(parseExternalURLConfigMode(config)).toBe("strict");
        expect(parseExternalURLConfig(config)).toEqual([
            { prefix: "https://api.example.org/ctrs/", maxPayloadBytes: 102400 }
        ]);

        expect(parseExternalURLConfigMode("")).toBe("open");
        expect(parseExternalURLConfigMode("https://api.example.org/ctrs/ 100")).toBe("open");
        expect(parseExternalURLConfigMode("mode open")).toBe("open");
        expect(parseExternalURLConfigMode("# mode strict")).toBe("open");   // commented out
        expect(parseExternalURLConfigMode("mode nonsense")).toBe("open");   // unknown value ignored

        // The last directive wins.
        expect(parseExternalURLConfigMode("mode strict\nmode open")).toBe("open");
        expect(parseExternalURLConfigMode("mode open\nmode strict")).toBe("strict");

    });

    test("matches verifyURL only below configured prefixes", () => {

        const rules = parseExternalURLConfig("https://api.example.org/ctrs/ 100");

        expect(findExternalURLRule(new URL("https://api.example.org/ctrs/12345.json"), rules)).not.toBeNull();
        expect(findExternalURLRule(new URL("https://api.example.org/other/12345.json"), rules)).toBeNull();

        // A prefix without a trailing slash still ends at a segment boundary:
        // "/ctrs" may not cover "/ctrsevil".
        const bare = parseExternalURLConfig("https://api.example.org/ctrs 100");

        expect(findExternalURLRule(new URL("https://api.example.org/ctrs/12345.json"), bare)).not.toBeNull();
        expect(findExternalURLRule(new URL("https://api.example.org/ctrsevil/12345.json"), bare)).toBeNull();

    });

    test("prefixes end at component boundaries, not mid-segment", () => {

        expect(isWithinURLPrefix("https://example.com/api",         "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/api/live",    "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/api?token=1", "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/api#part",    "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/apievil",     "https://example.com/api")).toBe(false);
        expect(isWithinURLPrefix("https://example.com/api.evil/x",  "https://example.com/api")).toBe(false);
        expect(isWithinURLPrefix("https://example.com/api/x",       "https://example.com/api/")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/apix",        "https://example.com/api/")).toBe(false);

    });

    test("merges query token into external download URL", () => {

        expect(
            withDeepLinkVerificationToken(
                new URL("https://api.example.org/ctrs/12345.json"),
                "abc123"
            ).href
        ).toBe("https://api.example.org/ctrs/12345.json?token=abc123");

        expect(
            withDeepLinkVerificationToken(
                new URL("https://api.example.org/ctrs/12345.json?format=chargy"),
                "abc123"
            ).href
        ).toBe("https://api.example.org/ctrs/12345.json?format=chargy&token=abc123");

    });

    test("keeps existing URL when no query token was provided", () => {

        expect(
            withDeepLinkVerificationToken(
                new URL("https://api.example.org/ctrs/12345.json?format=chargy"),
                null
            ).href
        ).toBe("https://api.example.org/ctrs/12345.json?format=chargy");

    });

    test("derives useful file names from URL path or content type", () => {

        expect(getDeepLinkFileName(new URL("https://api.example.org/ctrs/12345.json"), "application/json")).toBe("12345.json");
        expect(getDeepLinkFileName(new URL("https://api.example.org/ctrs/12345"), "application/xml")).toBe("12345");

    });

    test("rejects external URLs pointing at directories", () => {

        expect(() => getDeepLinkFileName(new URL("https://api.example.org/ctrs/"), "application/xml")).toThrow("must reference a file");

    });

    test("rejects responses whose Content-Length exceeds configured limit", async () => {

        const response = new Response("ok", {
            headers: {
                "content-length": "101"
            }
        });

        await expect(readResponseWithinLimit(response, 100)).rejects.toThrow("exceeds configured limit");

    });

    test("reads response body within configured limit", async () => {

        const response = new Response("hello");
        const data     = await readResponseWithinLimit(response, 10);

        expect(decodeUtf8(data)).toBe("hello");

    });

    test("aborts streamed responses when configured limit is exceeded", async () => {

        const stream = new ReadableStream<Uint8Array>({
            start(controller): void {
                controller.enqueue(new TextEncoder().encode("hello"));
                controller.enqueue(new TextEncoder().encode("world"));
                controller.close();
            }
        });

        const response = new Response(stream);

        await expect(readResponseWithinLimit(response, 9)).rejects.toThrow("exceeds configured limit");

    });

});
