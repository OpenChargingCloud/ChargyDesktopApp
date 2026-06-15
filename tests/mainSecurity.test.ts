import { createRequire }          from "node:module";
import { isAbsolute }             from "node:path";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

type PathAllowList = {
    allow(fileName: string): string;
    has(normalizedPath: string): boolean;
    isAllowed(fileName: string): boolean;
};

type MainSecurityModule = {
    normalizePath: (fileName: unknown) => string;
    isAllowedWebUrl: (url: string) => boolean;
    createPathAllowList: () => PathAllowList;
    isVideoOnlyMediaPermission: (permission: string, details: unknown) => boolean;
};

const {
    normalizePath,
    isAllowedWebUrl,
    createPathAllowList,
    isVideoOnlyMediaPermission
} = require("../src/mainSecurity.cjs") as MainSecurityModule;

describe("mainSecurity - normalizePath", () => {

    test("returns empty string for non-strings and blanks", () => {
        expect(normalizePath(undefined)).toBe("");
        expect(normalizePath(null)).toBe("");
        expect(normalizePath("")).toBe("");
        expect(normalizePath("   ")).toBe("");
    });

    test("resolves to an absolute path and strips a file:// prefix", () => {
        const resolved = normalizePath("some/relative/record.chargy");
        expect(isAbsolute(resolved)).toBe(true);

        expect(normalizePath("file:///tmp/record.chargy")).toBe(normalizePath("/tmp/record.chargy"));
    });

});

describe("mainSecurity - isAllowedWebUrl", () => {

    test("permits https, mailto and tel", () => {
        expect(isAllowedWebUrl("https://example.com")).toBe(true);
        expect(isAllowedWebUrl("mailto:info@example.com")).toBe(true);
        expect(isAllowedWebUrl("tel:+49123456")).toBe(true);
    });

    test("rejects http, file, javascript and garbage", () => {
        expect(isAllowedWebUrl("http://example.com")).toBe(false);
        expect(isAllowedWebUrl("file:///etc/passwd")).toBe(false);
        expect(isAllowedWebUrl("javascript:alert(1)")).toBe(false);
        expect(isAllowedWebUrl("not a url")).toBe(false);
    });

});

describe("mainSecurity - createPathAllowList", () => {

    test("only a granted path is allowed", () => {
        const list = createPathAllowList();

        expect(list.isAllowed("records/a.chargy")).toBe(false);

        const normalized = list.allow("records/a.chargy");

        expect(list.has(normalized)).toBe(true);
        expect(list.isAllowed("records/a.chargy")).toBe(true);
        expect(list.isAllowed("records/b.chargy")).toBe(false);
    });

    test("granting equivalent paths is deduplicated and blanks are ignored", () => {
        const list = createPathAllowList();

        expect(list.allow("")).toBe("");
        expect(list.has("")).toBe(false);

        const viaPlain = list.allow("/tmp/x.chargy");
        const viaFileUrl = normalizePath("file:///tmp/x.chargy");
        expect(list.has(viaFileUrl)).toBe(true);
        expect(viaFileUrl).toBe(viaPlain);
    });

});

describe("mainSecurity - isVideoOnlyMediaPermission", () => {

    test("permits a video-only media request on the main frame", () => {
        expect(isVideoOnlyMediaPermission("media", { mediaTypes: [ "video" ] })).toBe(true);
        expect(isVideoOnlyMediaPermission("media", { mediaType: "video" })).toBe(true);
        expect(isVideoOnlyMediaPermission("media", { mediaTypes: [ "video" ], isMainFrame: true })).toBe(true);
    });

    test("rejects audio, non-media, subframes and empty media types", () => {
        expect(isVideoOnlyMediaPermission("media", { mediaTypes: [ "video", "audio" ] })).toBe(false);
        expect(isVideoOnlyMediaPermission("geolocation", { mediaTypes: [ "video" ] })).toBe(false);
        expect(isVideoOnlyMediaPermission("media", { mediaTypes: [ "video" ], isMainFrame: false })).toBe(false);
        expect(isVideoOnlyMediaPermission("media", {})).toBe(false);
    });

});
