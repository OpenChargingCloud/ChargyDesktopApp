import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
    CryptoAlgorithms,
    CryptoHashAlgorithms,
    DisplayPrefixes,
    InformationRelevance,
    IsAPublicKeyInfo,
    ISOIDInfo,
    PublicKeyFormats,
    SessionVerificationResult,
    SignatureFormats,
    VerificationResult,
    isICryptoResult,
    isIPublicKeyXY,
    isISessionCryptoResult1,
    isISessionCryptoResult2
} from '../src/ts/interfaces/chargyInterfaces';
import {
    IsAChargeTransparencyRecord,
    IsAPublicKeyLookup,
    IsASessionCryptoResult,
    isIFileInfo
} from '../src/ts/interfaces/IChargeTransparencyRecord';

import type {
    IChargeTransparencyRecord,
    IMeasurement,
    IMeasurementValue
} from '../src/ts/interfaces/IChargeTransparencyRecord';
import type {
    ICryptoResult,
    IFileInfo,
    ISessionCryptoResult
} from '../src/ts/interfaces/chargyInterfaces';

import {
  OBIS2Hex,
  OBIS2MeasurementName,
  ParseJSON_LD,
  buf2hex,
  createHexString,
  hexToArrayBuffer,
  intFromBytes,
  measurementName2human,
  parseHexString,
  parseOBIS
} from "../src/ts/chargyLib";

import {
  sampleChargeTransparencyRecord,
  sampleCryptoResult,
  sampleFileInfo,
  samplePublicKeyInfo,
  samplePublicKeyLookup,
  sampleSessionCryptoResult
} from "./fixtures/dataStructures";

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
const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot      = fileURLToPath(new URL("..", import.meta.url));

function readFixture(fileName: string): string {
    return readFileSync(join(currentDirectory, "fixtures", fileName), "utf8").trim();
}

function readBinaryFixture(fileName: string): Uint8Array {
    return new Uint8Array(readFileSync(join(currentDirectory, "fixtures", fileName)));
}

function archiveMimeType(fileName: string): string {
    if (fileName.endsWith(".zip"))
        return "application/zip";

    if (fileName.endsWith(".tar.gz"))
        return "application/gzip";

    if (fileName.endsWith(".tar.bz2"))
        return "application/x-bzip2";

    if (fileName.endsWith(".tar"))
        return "application/x-tar";

    return fileName.endsWith(".chargy") ? "application/chargy" : "application/json";
}

type ChargyConstructor = typeof import("../src/ts/chargy").Chargy;

let Chargy: ChargyConstructor;

beforeAll(async () => {
    ({ Chargy } = await import("../src/ts/chargy"));
});

function createChargy(): InstanceType<ChargyConstructor> {

    const i18n = JSON.parse(readFileSync(join(projectRoot, "i18n.json"), "utf8"));

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







describe("Chargy data structure guards", () => {

    function expectReportLines(summary: string, expected: string) {
        const summaryLines  = summary.split(/\r?\n/);
        const expectedLines = expected.split(/\r?\n/);
        const maxLength     = Math.max(summaryLines.length, expectedLines.length);

        for (let i = 0; i < maxLength; i++)
            expect.soft(summaryLines[i], "verification report line " + (i + 1)).toBe(expectedLines[i]);
    }

    async function expectVerificationReport(inputFixture: string, expectedFixture: string) {

        const input    = readFixture(inputFixture);
        const expected = readFixture(expectedFixture);

        const report   = await verifyChargeData(inputFixture, input);
        const summary  = formatChargeDataVerificationReport(report);

        expectReportLines(summary, expected);

    }

    async function expectArchiveVerificationReport(archiveFixture: string, expectedFixture: string) {

        const archive  = readBinaryFixture(archiveFixture);
        const expected = readFixture(expectedFixture);

        const report   = await verifyChargeData(
            archiveFixture,
            archive,
            archiveMimeType(archiveFixture)
        );
        const summary  = formatChargeDataVerificationReport(report);

        expectReportLines(summary, expected);

    }

    async function verifyChargeData(fileName: string, input: string | Uint8Array, type?: string): Promise<IChargeTransparencyRecord | ISessionCryptoResult> {

        const fileInfo: IFileInfo = {
            name: fileName,
            type: type ?? (fileName.endsWith(".chargy") ? "application/chargy" : "application/json"),
            data: typeof input === "string"
                ? new TextEncoder().encode(input)
                : input
        };

        return await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

    }

    function formatChargeDataVerificationReport(report: IChargeTransparencyRecord | ISessionCryptoResult): string {

        if (!IsAChargeTransparencyRecord(report))
            return [
                "format: session-result",
                "status: " + report.status,
                "message: " + (report.message ?? "")
            ].join("\n");

        const sessions = report.chargingSessions ?? [];
        const lines = [
            "format: ctr",
            "sessions: " + sessions.length
        ];

        for (const [sessionIndex, session] of sessions.entries()) {

            const measurements = session.measurements ?? [];
            const meterId      = session.meterId ?? measurements[0]?.energyMeterId ?? "";

            lines.push("session " + (sessionIndex + 1) + ": " + (session["@id"] ?? ""));
            lines.push("session " + (sessionIndex + 1) + " evseId: " + (session.EVSEId ?? ""));
            lines.push("session " + (sessionIndex + 1) + " meterId: " + meterId);
            lines.push("session " + (sessionIndex + 1) + " status: " + (session.verificationResult?.status ?? "unknown"));
            lines.push("session " + (sessionIndex + 1) + " measurements: " + measurements.length);

            for (const [measurementIndex, measurement] of measurements.entries())
                appendMeasurementLines(lines, sessionIndex + 1, measurementIndex + 1, measurement);

        }

        return lines.join("\n");

    }

    function appendMeasurementLines(lines: string[], sessionNumber: number, measurementNumber: number, measurement: IMeasurement) {

        lines.push("measurement " + sessionNumber + "." + measurementNumber + " name: " + measurement.name);
        lines.push("measurement " + sessionNumber + "." + measurementNumber + " obis: " + measurement.obis);
        lines.push("measurement " + sessionNumber + "." + measurementNumber + " status: " + formatCryptoResult(measurement.verificationResult));
        lines.push("measurement " + sessionNumber + "." + measurementNumber + " values: " + measurement.values.length);

        for (const [valueIndex, value] of measurement.values.entries())
            appendMeasurementValueLines(lines, sessionNumber, measurementNumber, valueIndex + 1, value);

    }

    function appendMeasurementValueLines(lines: string[],
                                         sessionNumber: number,
                                         measurementNumber: number,
                                         valueNumber: number,
                                         value: IMeasurementValue) {

        const prefix = "value " + sessionNumber + "." + measurementNumber + "." + valueNumber;

        lines.push(prefix + " timestamp: " + value.timestamp);
        lines.push(prefix + " value: " + value.value.toString());
        lines.push(prefix + " signatures: " + (value.signatures?.length ?? 0));
        lines.push(prefix + " status: " + formatCryptoResult(value.result));

    }

    function formatCryptoResult(result: ICryptoResult | undefined): string {
        return result?.status ?? "unknown";
    }



    test("recognizes a charge transparency record by its required structural fields", () => {
      const ctr = sampleChargeTransparencyRecord();

      expect(IsAChargeTransparencyRecord(ctr)).toBe(true);
      expect(IsAChargeTransparencyRecord({ ...ctr, chargingSessions: undefined })).toBe(false);
      expect(IsAChargeTransparencyRecord(undefined)).toBe(false);
    });

    test("recognizes public key info and rejects incomplete keys", () => {
      expect(IsAPublicKeyInfo(samplePublicKeyInfo())).toBe(true);
      expect(IsAPublicKeyInfo(samplePublicKeyInfo({ value: undefined as unknown as string }))).toBe(false);
      expect(IsAPublicKeyInfo(null)).toBe(false);
    });

    test("recognizes public key lookup containers", () => {
      expect(IsAPublicKeyLookup(samplePublicKeyLookup())).toBe(true);
      expect(IsAPublicKeyLookup(sampleChargeTransparencyRecord())).toBe(false);
    });

    test("recognizes session and measurement crypto results", () => {
      const validSessionResult   = sampleSessionCryptoResult();
      const invalidSessionResult = sampleSessionCryptoResult({
        status: SessionVerificationResult.InvalidSessionFormat
      });

      expect(IsASessionCryptoResult(validSessionResult)).toBe(true);
      expect(isISessionCryptoResult1(validSessionResult)).toBe(true);
      expect(isISessionCryptoResult2(validSessionResult)).toBe(true);
      expect(isISessionCryptoResult2(invalidSessionResult)).toBe(false);
      expect(isICryptoResult(sampleCryptoResult())).toBe(true);
    });

    test("recognizes OID, XY public keys and in-memory file infos", () => {
      expect(ISOIDInfo({ oid: "1.2.3.4", name: "Example OID" })).toBe(true);
      expect(ISOIDInfo({ name: "Missing OID" })).toBe(false);

      expect(isIPublicKeyXY({ x: "aa", y: "bb" })).toBe(true);
      expect(isIPublicKeyXY({ x: "aa" })).toBe(false);

      expect(isIFileInfo(sampleFileInfo(new Uint8Array([1, 2, 3])))).toBe(true);
      expect(isIFileInfo(sampleFileInfo(new Uint8Array([1, 2, 3]).buffer))).toBe(true);
      expect(isIFileInfo({ name: "missing-data.chargy" })).toBe(false);
    });
  });



describe("Chargy enum values", () => {

    test("keeps verification result strings stable for persisted and displayed results", () => {
      expect(SessionVerificationResult.ValidSignature).toBe("ValidSignature");
      expect(SessionVerificationResult.InvalidSignature).toBe("InvalidSignature");
      expect(VerificationResult.ValidStartValue).toBe("ValidStartValue");
      expect(VerificationResult.ValidationError).toBe("ValidationError");
    });

    test("keeps crypto and display enum values stable", () => {
      expect(CryptoAlgorithms.ECC).toBe("ECC");
      expect(CryptoHashAlgorithms.SHA256).toBe("SHA256");
      expect(PublicKeyFormats.XY).toBe("XY");
      expect(SignatureFormats.RS).toBe("RS");
      expect(InformationRelevance.Important).toBe("Important");
      expect(DisplayPrefixes.KILO).toBe(1);
    });

});



describe("Chargy data formatting helpers", () => {

    test("converts OBIS values between human and hex forms", () => {
      expect(OBIS2Hex("1-0:1.8.0*255")).toBe("0100010800ff");
      expect(parseOBIS("0100010800ff")).toBe("1-0:1.8.0*255");
      expect(OBIS2MeasurementName("1-0:1.8.0*255")).toBe("ENERGY_TOTAL");
      expect(measurementName2human("ENERGY_TOTAL")).toBe("Bezogene Energiemenge");
    });

    test("round-trips byte arrays and hex strings", () => {
      const bytes = [0, 1, 15, 16, 254, 255];
      const hex = "00010f10feff";

      expect(parseHexString(hex)).toEqual(bytes);
      expect(createHexString(bytes)).toBe(hex);
      expect(buf2hex(hexToArrayBuffer(hex))).toBe(hex);
      expect(intFromBytes([0x01, 0x00, 0x00])).toBe(65536);
    });

    test("rejects odd-length hex strings before creating an ArrayBuffer", () => {
      expect(() => hexToArrayBuffer("abc")).toThrow(RangeError);
    });

});
