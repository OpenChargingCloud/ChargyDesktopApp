import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from 'vitest';
import { Chargy } from '@open-charging-cloud/chargy-core';
import {
    IsAChargeTransparencyRecord
} from '@open-charging-cloud/chargy-core';
import {
    SessionVerificationResult,
    VerificationResult
} from '@open-charging-cloud/chargy-core';
import {
    buildMennekesSignatureData,
    dateToMennekesLocalEpochSeconds,
    extractMennekesChargingProcesses,
    hexToBytes
} from '@open-charging-cloud/chargy-core';
import type {
    IFileInfo
} from '@open-charging-cloud/chargy-core';
import {
    createTestChargy,
    parseTestXML
} from "./chargyTestRuntime";


type DetectionResult = ReturnType<Chargy["DetectAndConvertContentFormat"]>;

vi.mock('pdfjs-dist', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
    return pdfjs;
});

vi.stubGlobal('window', {
    navigator: {
        language: 'en-US'
    }
});

function readFixture(fileName: string): string {
    return readFileSync(new URL("fixtures/Mennekes/" + fileName, import.meta.url), "utf8").trim();
}

function parseXML(xml: string): Document {
    return parseTestXML(xml);
}

async function verifyMennekesXML(fileName: string, xml: string): DetectionResult {

    const fileInfo: IFileInfo = {
        name:  fileName,
        type:  "application/xml",
        data:  new TextEncoder().encode(xml)
    };

    return createTestChargy(Chargy).DetectAndConvertContentFormat([ fileInfo ]);

}

describe('Mennekes EDL40 Tests', () => {

    test("parses standalone ChargingProcess without namespace", () => {

        const chargingProcesses = extractMennekesChargingProcesses(parseXML(readFixture("test1.xml")));

        expect(chargingProcesses).toHaveLength(1);
        expect(chargingProcesses[0]).toMatchObject({
            serverId:               "0901454D4800005BAE2F",
            publicKey:              "6DACB9C5466A25B3EB9F6466B53457C84A27448B01A64A278C0A28DAC95F2B45DF39B79918A9A4D2E3551F3FE925D09D",
            meteringPoint:          "DE*PWC*E00003*005",
            customerIdent:          "874AD0FE",
            timestampCustomerIdent: "2018-09-04T12:22:10+02:00"
        });
        expect(chargingProcesses[0]?.measurementStart).toMatchObject({
            timestamp:    "2018-09-04T12:22:14+02:00",
            eventCounter: 8,
            meterStatus:  65800,
            value:        519116,
            scaler:       -1,
            pagination:   25,
            secondIndex:  74650
        });

    });

    test("parses Billing wrapper with Mennekes namespace", () => {

        const chargingProcesses = extractMennekesChargingProcesses(parseXML(readFixture("test2.xml")));

        expect(chargingProcesses).toHaveLength(1);
        expect(chargingProcesses[0]?.measurementEnd).toMatchObject({
            timestamp:    "2018-09-04T12:26:45+02:00",
            eventCounter: 8,
            meterStatus:  65800,
            value:        520535,
            scaler:       -1,
            pagination:   26,
            secondIndex:  74921
        });

    });

    test("converts Mennekes local timestamp like the Java reference", () => {

        expect(dateToMennekesLocalEpochSeconds("2018-09-04T12:22:14+02:00")).toBe(1536063734);

    });

    test("builds the 320 byte extended SML signature data at documented offsets", () => {

        const chargingProcess = extractMennekesChargingProcesses(parseXML(readFixture("test1.xml"))).at(0);

        if (chargingProcess === undefined)
            throw new Error("Missing Mennekes charging process");

        const signedData      = buildMennekesSignatureData(chargingProcess, chargingProcess.measurementStart);

        expect(signedData).toHaveLength(320);
        expect(Array.from(signedData.subarray(0, 10))).toEqual(Array.from(hexToBytes("0901454D4800005BAE2F")));
        expect(signedData[14]).toBe(0x08);
        expect(Array.from(signedData.subarray(15, 19))).toEqual([ 0x9A, 0x23, 0x01, 0x00 ]);
        expect(Array.from(signedData.subarray(19, 23))).toEqual([ 0x19, 0x00, 0x00, 0x00 ]);
        expect(Array.from(signedData.subarray(23, 29))).toEqual([ 0x01, 0x00, 0x01, 0x11, 0x00, 0xFF ]);
        expect(signedData[29]).toBe(30);
        expect(signedData[30]).toBe(0xFF);
        expect(Array.from(signedData.subarray(39, 41))).toEqual([ 0x00, 0x08 ]);
        expect(Array.from(signedData.subarray(41, 45))).toEqual(Array.from(hexToBytes("874AD0FE")));
        expect(Array.from(signedData.subarray(173))).toEqual(new Array(147).fill(0));

    });

    test("verifies standalone Mennekes XML through Chargy", async () => {

        const result = await verifyMennekesXML("test1.xml", readFixture("test1.xml"));

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (IsAChargeTransparencyRecord(result))
        {
            expect(result.chargingSessions).toHaveLength(1);
            expect(result.chargingSessions?.[0]?.verificationResult?.status).toBe(SessionVerificationResult.ValidSignature);
            expect(result.chargingSessions?.[0]?.measurements?.[0]?.verificationResult?.status).toBe(VerificationResult.ValidSignature);
            expect(result.chargingSessions?.[0]?.measurements?.[0]?.values.map(value => value.result?.status)).toEqual([
                VerificationResult.ValidSignature,
                VerificationResult.ValidSignature
            ]);
        }

    });

    test("verifies Billing wrapped Mennekes XML through Chargy", async () => {

        const result = await verifyMennekesXML("test2.xml", readFixture("test2.xml"));

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (IsAChargeTransparencyRecord(result))
            expect(result.chargingSessions?.[0]?.verificationResult?.status).toBe(SessionVerificationResult.ValidSignature);

    });

    test("rejects a tampered Mennekes measurement value", async () => {

        const tamperedXML = readFixture("test1.xml").replace("<Value>519116</Value>", "<Value>519117</Value>");
        const result      = await verifyMennekesXML("test1-tampered.xml", tamperedXML);

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (IsAChargeTransparencyRecord(result))
        {
            expect(result.chargingSessions?.[0]?.verificationResult?.status).toBe(SessionVerificationResult.InvalidSignature);
            expect(result.chargingSessions?.[0]?.measurements?.[0]?.values[0]?.result?.status).toBe(VerificationResult.InvalidSignature);
        }

    });

});
