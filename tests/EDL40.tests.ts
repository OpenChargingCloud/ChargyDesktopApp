import { readFileSync } from "node:fs";
import { DOMParser } from "@oozcitak/dom";
import { describe, expect, test, vi } from "vitest";
import { Chargy } from "@open-charging-cloud/chargy-core";
import {
    IsAChargeTransparencyRecord,
    isaListNameContext,
    parseEDL40,
    SessionVerificationResult,
    VerificationResult
} from "@open-charging-cloud/chargy-core";
import type {
    IFileInfo
} from "@open-charging-cloud/chargy-core";
import {
    createTestChargy
} from "./chargyTestRuntime";

vi.mock("pdfjs-dist", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
    return pdfjs;
});

vi.stubGlobal("window", {
    navigator: {
        language: "en-US"
    }
});

vi.stubGlobal("DOMParser", DOMParser);

function readFixture(path: string): string {
    return readFileSync(new URL("fixtures/" + path, import.meta.url), "utf8").trim();
}

function signedData(xml: string): string {

    const match = /<signedData[^>]*>([\s\S]*?)<\/signedData>/i.exec(xml);

    if (match?.[1] == null)
        throw new Error("Missing signedData");

    return match[1].trim();

}

async function verifyXML(fileName: string,
                         xml:      string): ReturnType<Chargy["DetectAndConvertContentFormat"]> {

    const fileInfo: IFileInfo = {
        name: fileName,
        type: "application/xml",
        data: new TextEncoder().encode(xml)
    };

    return createTestChargy(Chargy).DetectAndConvertContentFormat([ fileInfo ]);

}

describe("EDL40/ISA SML parser", () => {

    test("parses EDL40 SML fixture and builds the 320 byte signature block", () => {

        const parsed = parseEDL40(signedData(readFixture("EDL40/edl-40-01.xml")));

        expect(parsed.variant).toBe("EDL_40_P");
        expect(parsed.signedData).toHaveLength(320);
        expect(parsed.pagination).toBe(33);

        if (parsed.variant !== "EDL_40_P")
            throw new Error("Expected EDL40");

        expect(parsed.meterValue).toBe(3275n);
        expect(parsed.serverId).toEqual(Uint8Array.from([ 0x09, 0x01, 0x45, 0x53, 0x59, 0x11, 0x03, 0x95, 0x69, 0x40 ]));

    });

    test("parses ISA SML fixture with start and stop meter values", () => {

        const parsed = parseEDL40(signedData(readFixture("ISA_EDL40/isa-edl-40p-ok.xml")));

        expect(parsed.variant).toBe("ISA_EDL_40_P");
        expect(parsed.signedData).toHaveLength(320);

        if (parsed.variant !== "ISA_EDL_40_P")
            throw new Error("Expected ISA");

        expect(parsed.startEcValue).toBe(0x0f50e354n);
        expect(parsed.actualEcValue).toBe(0x0f544b92n);
        expect(isaListNameContext(parsed.listName)).toBe("STOP");

    });

});

describe("EDL40/ISA Chargy integration", () => {

    test("converts SAFE SML_EDL40_P container into a normal CTR", async () => {

        const result = await verifyXML(
            "edl40plus-sml-within-safe-xml-container-01.xml",
            readFixture("EDL40plus/edl40plus-sml-within-safe-xml-container-01.xml")
        );

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (IsAChargeTransparencyRecord(result))
        {
            expect(result.chargingSessions).toHaveLength(1);
            expect(result.chargingSessions?.[0]?.["@context"]).toBe("https://open.charging.cloud/contexts/SessionSignatureFormats/EDL40+json");
            expect(result.chargingSessions?.[0]?.verificationResult?.status).toBe(SessionVerificationResult.ValidSignature);
            expect(result.chargingSessions?.[0]?.measurements?.[0]?.values).toHaveLength(2);
            expect(result.chargingSessions?.[0]?.measurements?.[0]?.values.map(value => value.result?.status)).toEqual([
                VerificationResult.ValidSignature,
                VerificationResult.ValidSignature
            ]);
        }

    });

    test("converts ISA_EDL_40_P SAFE container into start and stop values", async () => {

        const result = await verifyXML(
            "isa-edl-40p-ok.xml",
            readFixture("ISA_EDL40/isa-edl-40p-ok.xml")
        );

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (IsAChargeTransparencyRecord(result))
        {
            const values = result.chargingSessions?.[0]?.measurements?.[0]?.values ?? [];

            expect(values).toHaveLength(2);
            expect(values[0]?.value.toNumber()).toBeCloseTo(25695.9316, 4);
            expect(values[1]?.value.toNumber()).toBeCloseTo(25718.261, 4);
        }

    });

});
