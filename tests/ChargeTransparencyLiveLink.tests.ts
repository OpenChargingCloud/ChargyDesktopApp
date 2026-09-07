import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

import type {
    IFileInfo
} from "@open-charging-cloud/chargy-core";
import {
    Chargy,
    IsAChargeTransparencyLiveLink
} from "@open-charging-cloud/chargy-core";
import coreI18n  from "@open-charging-cloud/chargy-core/i18n.json";
import localI18n from "../src/i18n.json";
import {
    createTestChargy,
    mergeI18NDictionaries,
    parseJSONRecord
} from "./chargyTestRuntime";

vi.mock("pdfjs-dist", () => ({
    GlobalWorkerOptions: {}
}));

vi.stubGlobal("window", {
    navigator: {
        language: "en"
    }
});

const currentDirectory = fileURLToPath(new URL(".",  import.meta.url));
type DetectionResult   = ReturnType<Chargy["DetectAndConvertContentFormat"]>;

function readFixture(fileName: string): string {
    return readFileSync(join(currentDirectory, "fixtures", fileName), "utf8").trim();
}

async function verifyChargeTransparencyLiveLink(fileName: string): DetectionResult {

    const fileInfo: IFileInfo = {
        name: fileName,
        type: "application/json",
        data: new TextEncoder().encode(readFixture(fileName))
    };

    const i18n = mergeI18NDictionaries(coreI18n, localI18n);

    return createTestChargy(Chargy, { i18n }).DetectAndConvertContentFormat([ fileInfo ]);

}

describe("Charge Transparency LiveLink", () => {

    test("recognizes live links by their JSON-LD context", () => {

        const liveLink = parseJSONRecord(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json"));

        expect(IsAChargeTransparencyLiveLink(liveLink)).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": "https://example.com/other" })).toBe(false);
        expect(IsAChargeTransparencyLiveLink(undefined)).toBe(false);

        // The JSON-LD context identifies the document. Malformed optional
        // transports are dropped by the UI instead of hiding the whole link.
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, liveTransports: [ { type: "ftp", url: "https://example.com" } ] })).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, connector: 42 })).toBe(true);

        // What a live link cannot do without: when it was created, and a list
        // of transports to receive its updates through. A document missing
        // either of the two is not one.
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, created: undefined })).toBe(false);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, liveTransports: "not an array" })).toBe(false);

    });

    test("loads a live link JSON document", async () => {

        const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            expect(report.created).toBe("2026-08-28T11:59:59Z");
            expect(report.liveTransports).toHaveLength(3);
        }

    });

    test("carries verification of signatures over the complete document", async () => {

        const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            expect(report.signatureVerification?.status).toBe("allValid");
            expect(report.signatureVerification?.validCount).toBe(2);
            expect(report.warnings ?? []).toHaveLength(0);
        }

    });

    test("reads the smallest live link there is, and keeps its own timestamp", async () => {

        // A creation timestamp is never filled in for a document that does not
        // state one: it is part of what makes the document a live link, so the
        // timestamp that is read is always the document's own.
        const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_2.json");

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            expect(report.created).toBe("2026-09-06T22:58:14Z");
            expect(report.liveTransports).toHaveLength(1);
        }

    });

});
