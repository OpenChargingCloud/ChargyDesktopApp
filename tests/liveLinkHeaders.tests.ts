import { describe, expect, test, vi } from "vitest";

import { generateTOTPs } from "@open-charging-cloud/totp";

import {
    customRequestHeaders,
    maximumCustomHeaderNameLength,
    maximumCustomHeaderValueLength,
    maximumCustomHeaders,
    resolveRequestHeaders
} from "../src/ts/liveLinkHeaders";

// What a document asks for, resolved as one request would resolve it.
function headersFor(customHeaders: unknown,
                    now:           Date = new Date()): Record<string, string> {
    return resolveRequestHeaders(customRequestHeaders(customHeaders), now);
}

describe("Live link custom request headers", () => {

    //#region What a document may ask for

    test("takes the literal headers a live link asks for", () => {

        expect(headersFor({
            "X-Key1":    "headerValue1",
            "X-Tenant":  "DE*GEF"
        })).toEqual({
            "X-Key1":    "headerValue1",
            "X-Tenant":  "DE*GEF"
        });

        // Nothing to take is not an error, it is simply no headers.
        expect(headersFor(undefined)).toEqual({});
        expect(headersFor(null)).toEqual({});
        expect(headersFor("X-Key1: headerValue1")).toEqual({});
        expect(headersFor([ "X-Key1" ])).toEqual({});

    });

    test("drops what is not a well-formed header", () => {

        // A name that is not an RFC 9110 token, and a value carrying a line
        // break, are the shape of a request smuggled into the request.
        expect(headersFor({
            "X-Bad Name":  "value",
            "X-Colon:":    "value",
            "X-Newline":   "value\r\nX-Injected: yes",
            "X-Control":   "value\u0000",
            "X-Unicode":   "wert-mit-ü",
            "":            "value",
            "X-Empty":     "   ",
            "X-Number":    42,
            "X-Array":     [ "value" ],
            "X-Null":      null,
            "X-Good":      "value"
        })).toEqual({ "X-Good": "value" });

        // Every character RFC 9110 allows in a token is a name, though.
        expect(headersFor({ "!#$%&'*+-.^_`|~0aZ": "value" })).toEqual({ "!#$%&'*+-.^_`|~0aZ": "value" });

        // Leading and trailing whitespace is not part of a header value.
        expect(headersFor({ "X-Key1": "  headerValue1  " })).toEqual({ "X-Key1": "headerValue1" });

    });

    test("drops the names that are not a document's to set", () => {

        // Electron's main process is not a browser and would happily send most
        // of these. A document has no business writing this application's Host,
        // Origin or Cookie, so they are dropped here - and again in the main
        // process, which is what opens the connection.
        expect(headersFor({
            "Host":            "evil.example.com",
            "Origin":          "https://evil.example.com",
            "Cookie":          "session=1",
            "Referer":         "https://evil.example.com",
            "Content-Length":  "0",
            "Sec-Fetch-Site":  "same-origin",
            "Proxy-Authorization": "Basic x",
            "X-Good":          "value"
        })).toEqual({ "X-Good": "value" });

        // Their case does not save them, and a name that merely looks similar
        // is not on the list.
        expect(headersFor({ "cOoKiE": "session=1" })).toEqual({});
        expect(headersFor({ "X-Host": "value"     })).toEqual({ "X-Host": "value" });

    });

    test("keeps the first of two names HTTP considers the same", () => {

        // A Headers object would join these into one comma-separated value.
        expect(headersFor({ "X-Key1": "first", "x-key1": "second" })).toEqual({ "X-Key1": "first" });

    });

    test("caps how much a document may add to every request", () => {

        const many: Record<string, string> = {};

        for (let i = 0; i < maximumCustomHeaders + 10; i++)
            many["X-Key" + i.toString()] = "value";

        expect(Object.keys(headersFor(many))).toHaveLength(maximumCustomHeaders);

        expect(headersFor({
            [ "X-" + "n".repeat(maximumCustomHeaderNameLength) ]:  "value",
            "X-TooLong":                                           "v".repeat(maximumCustomHeaderValueLength + 1),
            "X-Fine":                                              "v".repeat(maximumCustomHeaderValueLength)
        })).toEqual({ "X-Fine": "v".repeat(maximumCustomHeaderValueLength) });

    });

    //#endregion

    //#region The value providers

    const sharedSecret = "abcdefghijklmnopqrstuvwxyz1234567890";
    const moment       = new Date("2026-09-05T12:00:00.000Z");

    test("computes a TOTP header from the document's parameters", () => {

        const headers = headersFor({
                            "X-Key1": "headerValue1",
                            "X-TOTP": {
                                          valueProvider: "TOTP",
                                          parameters:    { sharedSecret: sharedSecret }
                                      }
                        }, moment);

        // The literal header beside it is untouched, and the computed one is
        // exactly what the generator produces for that moment.
        expect(headers["X-Key1"]).toBe("headerValue1");
        expect(headers["X-TOTP"]).toBe(generateTOTPs({ sharedSecret: sharedSecret, timestamp: moment }).current);

    });

    test("wires every parameter the generator takes", () => {

        const parameters = {
            sharedSecret:   sharedSecret,
            validityTime:   10,
            totpLength:     8,
            alphabet:       "0123456789",
            hashAlgorithm:  "sha512"
        };

        const value = headersFor({ "X-TOTP": { valueProvider: "TOTP", parameters } }, moment)["X-TOTP"];

        expect(value).toBe(generateTOTPs({
            sharedSecret:   sharedSecret,
            validityTime:   10,
            totpLength:     8,
            alphabet:       "0123456789",
            hashAlgorithm:  "sha512",
            timestamp:      moment
        }).current);

        // ... and they really do reach the generator: the parameters above
        // must not produce what the defaults would.
        expect(value).toHaveLength(8);
        expect(value).toMatch(/^[0-9]{8}$/);
        expect(value).not.toBe(generateTOTPs({ sharedSecret: sharedSecret, timestamp: moment }).current);

    });

    test("computes the value again for every request, never once for the series", () => {

        const document  = { "X-TOTP": { valueProvider: "TOTP", parameters: { sharedSecret: sharedSecret, validityTime: 10 } } };
        const headers   = customRequestHeaders(document);

        // The same header specification, two moments a slot apart: two
        // passwords. A value computed once and reused would be stale by the
        // second request, which is the one thing a one-time password must not
        // be.
        const first     = resolveRequestHeaders(headers, moment)["X-TOTP"];
        const later     = resolveRequestHeaders(headers, new Date(moment.getTime() + 30_000))["X-TOTP"];

        expect(first).toBeDefined();
        expect(later).toBeDefined();
        expect(first).not.toBe(later);

    });

    test("uses the current password, not the neighbouring slots", () => {

        const totps = generateTOTPs({ sharedSecret: sharedSecret, timestamp: moment });
        const value = headersFor({ "X-TOTP": { valueProvider: "TOTP", parameters: { sharedSecret: sharedSecret } } }, moment)["X-TOTP"];

        expect(value).toBe(totps.current);
        expect(value).not.toBe(totps.previous);
        expect(value).not.toBe(totps.next);

    });

    test("sends no header rather than a broken one", () => {

        vi.spyOn(console, "log").mockImplementation(() => { /* quiet */ });

        // An unknown provider, a missing secret, a secret the generator
        // refuses, parameters that are not an object at all: no header, and
        // the literal one beside it still goes out.
        for (const provider of [
            { valueProvider: "HOTP",  parameters: { sharedSecret: sharedSecret } },
            { valueProvider: "TOTP",  parameters: { sharedSecret: "" } },
            { valueProvider: "TOTP",  parameters: { sharedSecret: "short" } },
            { valueProvider: "TOTP",  parameters: "abc" },
            { valueProvider: "TOTP" },
            { valueProvider: "",      parameters: { sharedSecret: sharedSecret } },
            { parameters: { sharedSecret: sharedSecret } }
        ])
        {
            expect(headersFor({ "X-TOTP": provider, "X-Key1": "headerValue1" }, moment)).toEqual({ "X-Key1": "headerValue1" });
        }

        vi.restoreAllMocks();

    });

    test("does not let a document freeze the moment", () => {

        // A timestamp in the document would be a one-time password valid
        // forever. It is not a parameter, and stating one changes nothing.
        const withTimestamp = headersFor({
                                  "X-TOTP": {
                                      valueProvider: "TOTP",
                                      parameters:    { sharedSecret: sharedSecret, timestamp: 0 }
                                  }
                              }, moment)["X-TOTP"];

        expect(withTimestamp).toBe(generateTOTPs({ sharedSecret: sharedSecret, timestamp: moment }).current);

    });

    test("names the provider case-insensitively", () => {

        for (const name of [ "TOTP", "totp", "Totp" ])
            expect(headersFor({ "X-TOTP": { valueProvider: name, parameters: { sharedSecret } } }, moment)["X-TOTP"]).
                toBe(generateTOTPs({ sharedSecret: sharedSecret, timestamp: moment }).current);

    });

    //#endregion

});
