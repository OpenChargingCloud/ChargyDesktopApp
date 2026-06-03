import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test, vi } from 'vitest';
import { Chargy } from '../src/ts/chargy';
import {
    IsAChargeTransparencyRecord,
    isIFileInfo
} from '../src/ts/chargyInterfaces';
import type {
    IChargeTransparencyRecord,
    ICryptoResult,
    IFileInfo,
    IMeasurement,
    IMeasurementValue,
    ISessionCryptoResult
} from '../src/ts/chargyInterfaces';

export {
    expectVerificationReport,
    expectArchiveVerificationReport,
    expectVerificationReportWithPublicKey
}

const require = createRequire(import.meta.url);
const { DOMParser } = require("@oozcitak/dom");

vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {},
    getDocument: () => {
        throw new Error("PDF fixtures are not supported by this test setup.");
    }
}));

vi.stubGlobal('window', {
    navigator: {
        language: 'en-US'
    }
});

vi.stubGlobal('DOMParser', DOMParser);

function readFixture(fileName: string): string {
    return readFileSync(new URL("fixtures/" + fileName, import.meta.url), "utf8").trim();
}

function readBinaryFixture(fileName: string): Uint8Array {
    return new Uint8Array(readFileSync(new URL("fixtures/" + fileName, import.meta.url)));
}

function archiveMimeType(fileName: string): string {

    if (fileName.endsWith(".chargy"))
        return "application/chargy";

    if (fileName.endsWith(".json"))
        return "application/json";

    if (fileName.endsWith(".xml"))
        return "application/xml";

    if (fileName.endsWith(".zip"))
        return "application/zip";

    if (fileName.endsWith(".tar.gz"))
        return "application/gzip";

    if (fileName.endsWith(".tar.bz2"))
        return "application/x-bzip2";

    if (fileName.endsWith(".tar"))
        return "application/x-tar";

    if (fileName.endsWith(".pdf"))
        return "application/pdf";

    return "binary/octet-stream";

}

function createChargy(): Chargy {

    return new Chargy(
        {},
        "en",
        require("elliptic"),
        require("moment"),
        require("asn1.js"),
        require("base32-decode"),
        () => ""
    );

}


function expectReportLines(summary: string, expected: string) {

    const summaryLines  = summary. split(/\r?\n/);
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

async function expectVerificationReportWithPublicKey(inputFixture: string, publicKeyFixture: string, expectedFixture: string) {

    const input    = readBinaryFixture(inputFixture);
    const expected = readFixture(expectedFixture);

    const report   = await verifyChargeDataFiles([
        {
            name:  inputFixture,
            type:  archiveMimeType(inputFixture),
            data:  input
        },
        {
            name:  publicKeyFixture,
            type:  archiveMimeType(publicKeyFixture),
            data:  readBinaryFixture(publicKeyFixture)
        }
    ]);

    const summary   = formatChargeDataVerificationReport(report);

    expectReportLines(summary, expected);

}

async function verifyChargeData(fileName: string, input: string | Uint8Array, type?: string): Promise<IChargeTransparencyRecord | ISessionCryptoResult> {

    const fileInfo: IFileInfo = {
        name: fileName,
        type: type ?? archiveMimeType(fileName),
        data: typeof input === "string"
            ? new TextEncoder().encode(input)
            : input
    };

    return await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

}

async function verifyChargeDataFiles(fileInfos: IFileInfo[]): Promise<IChargeTransparencyRecord | ISessionCryptoResult> {
    return await createChargy().DetectAndConvertContentFormat(fileInfos);
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
