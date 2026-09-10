import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

import type { IFileInfo, SimpleURL } from "@open-charging-cloud/chargy-core";
import { Chargy, IsAURL, IsValidURL, URLContext } from "@open-charging-cloud/chargy-core";

// The flat index carries two unrelated IURL types. The one the URL module and
// chargyApp work with is the one behind the SimpleURL namespace.
type IURL = SimpleURL.IURL;
import { createTestChargy } from "./chargyTestRuntime";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));

async function detectText(text: string): ReturnType<Chargy["DetectAndConvertContentFormat"]> {

    const fileInfo: IFileInfo = {
        name: "url.txt",
        type: "text/plain",
        data: new TextEncoder().encode(text)
    };

    return createTestChargy(Chargy).DetectAndConvertContentFormat([ fileInfo ]);

}

describe("Simple URLs", () => {

    test("recognizes HTTP and HTTPS URLs", () => {
        expect(IsValidURL("https://chargy.charging.cloud/charging-session?id=123#details")).toBe(true);
        expect(IsValidURL("http://example.com/path")).toBe(true);
        expect(IsValidURL("chargy.charging.cloud")).toBe(false);
        expect(IsValidURL("javascript:alert(1)")).toBe(false);
        expect(IsValidURL("ordinary text")).toBe(false);
    });

    test("converts a URL string into an IURL object", async () => {

        const result = await detectText("https://chargy.charging.cloud/charging-session?id=123#details");

        expect(result).toEqual({
            "@context": URLContext,
            "url":      "https://chargy.charging.cloud/charging-session?id=123#details"
        });
        expect(IsAURL(result)).toBe(true);

    });

    test("validates the optional IURL properties", () => {
        expect(IsAURL({
            "@context":  URLContext,
            "url":       "https://chargy.charging.cloud/",
            "method":    "GET",
            "acceptType": "application/json",
            "actions":   [ "open", "copy" ],
            "serviceTypes": [ "chargy" ],
            "serviceData":  { "version": 1 }
        })).toBe(true);
        expect(IsAURL({
            "@context": URLContext,
            "url":      "https://chargy.charging.cloud/",
            "actions":  [ "open", 42 ]
        })).toBe(false);
    });

    test("resolves URLs as application/chargy when enabled", async () => {

        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
            JSON.stringify({
                "name":    "Chargy service",
                "version": 1
            }),
            {
                status:  200,
                headers: {
                    "Content-Type": "application/chargy; charset=utf-8"
                }
            }
        ));
        vi.stubGlobal("fetch", fetchMock);

        try
        {
            const fileInfo: IFileInfo = {
                name: "url.txt",
                type: "text/plain",
                data: new TextEncoder().encode("https://chargy.charging.cloud/service")
            };
            const result = await createTestChargy(Chargy, { resolveURLs: true }).
                                     DetectAndConvertContentFormat([ fileInfo ]);

            expect(fetchMock).toHaveBeenCalledWith(
                "https://chargy.charging.cloud/service",
                {
                    method:  "GET",
                    headers: {
                        "Accept": "application/chargy"
                    }
                }
            );
            expect(result).toEqual({
                "@context":    URLContext,
                "url":         "https://chargy.charging.cloud/service",
                "serviceTypes": [ "chargy" ],
                "serviceData": {
                    "name":    "Chargy service",
                    "version": 1
                }
            });
        }
        finally
        {
            vi.unstubAllGlobals();
        }

    });

    test("does not request detected URLs by default", async () => {

        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        try
        {
            await detectText("https://chargy.charging.cloud/service");
            expect(fetchMock).not.toHaveBeenCalled();
        }
        finally
        {
            vi.unstubAllGlobals();
        }

    });

    test("allows the complete URL resolution to be replaced", async () => {

        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        const serviceLookup = new Map<string, {
            serviceTypes: Array<string>;
            serviceData:  Record<string, unknown>;
        }>([
            [
                "https://chargy.charging.cloud/service",
                {
                    serviceTypes: [ "chargy" ],
                    serviceData:  { "source": "static lookup" }
                }
            ]
        ]);
        const urlResolver = vi.fn((url: IURL) => {
            const service = serviceLookup.get(url.url);

            return service == null
                       ? url
                       : {
                             ...url,
                             ...service
                         };
        });

        try
        {
            const fileInfo: IFileInfo = {
                name: "url.txt",
                type: "text/plain",
                data: new TextEncoder().encode("https://chargy.charging.cloud/service")
            };
            const result = await createTestChargy(Chargy, {
                resolveURLs: true,
                urlResolver
            }).DetectAndConvertContentFormat([ fileInfo ]);

            expect(urlResolver).toHaveBeenCalledWith({
                "@context": URLContext,
                "url":      "https://chargy.charging.cloud/service"
            });
            expect(fetchMock).not.toHaveBeenCalled();
            expect(result).toEqual({
                "@context":    URLContext,
                "url":         "https://chargy.charging.cloud/service",
                "serviceTypes": [ "chargy" ],
                "serviceData":  { "source": "static lookup" }
            });
        }
        finally
        {
            vi.unstubAllGlobals();
        }

    });

    test("recognizes a URL read from the existing QR code fixture", async () => {

        const data = readFileSync(join(
            currentDirectory,
            "fixtures",
            "SimpleURLs",
            "chargy.charging.cloud_QRCode.png"
        ));
        const fileInfo: IFileInfo = {
            name: "chargy.charging.cloud_QRCode.png",
            type: "image/png",
            data
        };

        const result = await createTestChargy(Chargy).DetectAndConvertContentFormat([ fileInfo ]);

        expect(result).toEqual({
            "@context": URLContext,
            "url":      "https://chargy.charging.cloud/"
        });

    });

});
