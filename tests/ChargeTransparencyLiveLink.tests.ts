import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test, vi } from "vitest";

import type {
    IFileInfo
} from "../src/ts/interfaces/chargyInterfaces";
import {
    IsAChargeTransparencyLiveLink
} from "../src/ts/interfaces/IChargeTransparencyLiveLink";

vi.mock("pdfjs-dist", () => ({
    GlobalWorkerOptions: {}
}));

vi.stubGlobal("window", {
    navigator: {
        language: "en"
    },
    chargyElectron: {
        openExternal: () => Promise.resolve()
    }
});

const require          = createRequire(import.meta.url);
const currentDirectory = fileURLToPath(new URL(".",  import.meta.url));
const projectRoot      = fileURLToPath(new URL("..", import.meta.url));

type ChargyConstructor = typeof import("../src/ts/chargy").Chargy;

let Chargy: ChargyConstructor;

beforeAll(async () => {
    ({ Chargy } = await import("../src/ts/chargy"));
});

function readFixture(fileName: string): string {
    return readFileSync(join(currentDirectory, "fixtures", fileName), "utf8").trim();
}

function createChargy(): InstanceType<ChargyConstructor> {

    const i18n = JSON.parse(readFileSync(join(projectRoot, "src", "i18n.json"), "utf8"));

    return new Chargy(
        i18n,
        "en",
        require("elliptic"),
        require("moment"),
        require("asn1.js"),
        require("base32-decode"),
        () => ""
    );

}

async function verifyChargeTransparencyLiveLink(fileName: string) {

    const fileInfo: IFileInfo = {
        name: fileName,
        type: "application/json",
        data: new TextEncoder().encode(readFixture(fileName))
    };

    return await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

}

describe("Charge Transparency LiveLink", () => {

    test("recognizes live links by their JSON-LD context", () => {

        const liveLink = JSON.parse(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json"));

        expect(IsAChargeTransparencyLiveLink(liveLink)).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": "https://example.com/other" })).toBe(false);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, transports: [ { type: "ftp", url: "https://example.com" } ] })).toBe(false);
        expect(IsAChargeTransparencyLiveLink(undefined)).toBe(false);

    });

    test("loads a live link JSON document", async () => {

        const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            expect(report.timestamp).toBe("2026-06-12T14:03:12Z");
            expect(report.transports).toHaveLength(3);
        }

    });

    test("adds the current UTC timestamp when a live link has none", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-13T10:11:12.000Z"));

        try
        {
            const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_2.json");

            expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

            if (IsAChargeTransparencyLiveLink(report))
                expect(report.timestamp).toBe("2026-06-13T10:11:12.000Z");
        }
        finally
        {
            vi.useRealTimers();
        }
    });

});
