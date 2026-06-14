import { expect, vi }     from 'vitest';
import { Chargy }         from '../src/ts/chargy';
import { readFileSync }   from "node:fs";
import { createRequire }  from "node:module";
import {
    IsAChargeTransparencyRecord
} from '../src/ts/interfaces/IChargeTransparencyRecord';
import type {
    IChargeTransparencyRecord,
    IMeasurement,
    IMeasurementValue
} from '../src/ts/interfaces/IChargeTransparencyRecord';
import type {
    IChargeTransparencyLiveLink
} from '../src/ts/interfaces/IChargeTransparencyLiveLink';
import {
    IsAChargeTransparencyLiveLink
} from '../src/ts/interfaces/IChargeTransparencyLiveLink';
import type {
    ICryptoResult,
    IFileInfo,
    ISessionCryptoResult
} from '../src/ts/interfaces/chargyInterfaces';
import type {
    IPublicKeyInfo
} from '../src/ts/interfaces/IPublicKeyInfo';

export {
    expectVerificationReport,
    expectVerificationReportInline,
    expectBinaryVerificationReport,
    expectArchiveVerificationReport,
    expectMultiArchiveVerificationReport,
    expectVerificationReportWithPublicKey
}

const require = createRequire(import.meta.url);
const { DOMParser } = require("@oozcitak/dom");

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

    if (fileName.endsWith(".png"))
        return "image/png";

    if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg"))
        return "image/jpeg";

    if (fileName.endsWith(".svg"))
        return "image/svg+xml";

    if (fileName.endsWith(".webp"))
        return "image/webp";

    if (fileName.endsWith(".gif"))
        return "image/gif";

    if (fileName.endsWith(".bmp"))
        return "image/bmp";

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
        expect.soft(summaryLines[i], "verification report line " + ((i + 1).toString())).toBe(expectedLines[i]);

}

async function expectVerificationReport(inputFixture: string, expectedFixture: string) {

    const input    = readFixture(inputFixture);
    const expected = readFixture(expectedFixture);

    const report   = await verifyChargeData(inputFixture, input);
    const summary  = formatChargeDataVerificationReport(report);

    expectReportLines(summary, expected);

}

async function expectVerificationReportInline(inputFixture: string, expected: any) {

    const input  = readFixture(inputFixture);
    const report = await verifyChargeData(inputFixture, input);

    expect(report).toMatchObject(expected);

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

async function expectMultiArchiveVerificationReport(inputFixtures: string[], expectedFixture: string) {

    const expected = readFixture(expectedFixture);

    const report   = await verifyChargeDataFiles(
        inputFixtures.map(inputFixture => ({
            name:  inputFixture,
            type:  archiveMimeType(inputFixture),
            data:  readBinaryFixture(inputFixture)
        }))
    );

    const summary  = formatChargeDataVerificationReport(report);

    expectReportLines(summary, expected);

}

async function expectBinaryVerificationReport(inputFixture: string, expectedFixture: string) {

    const input    = readBinaryFixture(inputFixture);
    const expected = readFixture(expectedFixture);

    const report   = await verifyChargeData(
                               inputFixture,
                               input,
                               archiveMimeType(inputFixture)
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

async function verifyChargeData(fileName:  string,
                                input:     string | Uint8Array,
                                type?:     string)

    : Promise<IChargeTransparencyRecord   |
              IChargeTransparencyLiveLink |
              IPublicKeyInfo              |
              ISessionCryptoResult>

{

    const fileInfo: IFileInfo = {
        name: fileName,
        type: type ?? archiveMimeType(fileName),
        data: typeof input === "string"
            ? new TextEncoder().encode(input)
            : input
    };

    return await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

}

async function verifyChargeDataFiles(fileInfos: IFileInfo[])

    : Promise<IChargeTransparencyRecord   |
              IChargeTransparencyLiveLink |
              IPublicKeyInfo              |
              ISessionCryptoResult>

{
    return await createChargy().DetectAndConvertContentFormat(fileInfos);
}

function formatChargeDataVerificationReport(report: IChargeTransparencyRecord | IChargeTransparencyLiveLink | IPublicKeyInfo | ISessionCryptoResult): string {

    if (IsAChargeTransparencyLiveLink(report))
        return [
            "format: charge-transparency-live-link",
            "timestamp: "  +  (report.timestamp ?? ""),
            "transports: " + ((report.transports?.length ?? 0).toString())
        ].join("\n");

    if (!IsAChargeTransparencyRecord(report))
        return [
            "format: session-result",
            "status: "  +  report.status,
            "message: " + (report.message ?? "")
        ].join("\n");

    const sessions = report.chargingSessions ?? [];
    const lines    = [
        "format: ctr",
        "sessions: " + sessions.length.toString()
    ];

    for (const [sessionIndex, session] of sessions.entries()) {

        const measurements = session.measurements;
        const meterId      = session.meterId ?? measurements[0]?.energyMeterId ?? "";

        lines.push("session " + ((sessionIndex + 1).toString()) + ": " + session["@id"]);
        lines.push("session " + ((sessionIndex + 1).toString()) + " evseId: " + session.EVSEId);
        lines.push("session " + ((sessionIndex + 1).toString()) + " meterId: " + meterId);
        lines.push("session " + ((sessionIndex + 1).toString()) + " status: " + (session.verificationResult?.status ?? "unknown"));
        lines.push("session " + ((sessionIndex + 1).toString()) + " measurements: " + measurements.length.toString());

        for (const [measurementIndex, measurement] of measurements.entries())
            appendMeasurementLines(lines, sessionIndex + 1, measurementIndex + 1, measurement);

    }

    return lines.join("\n");

}

function appendMeasurementLines(lines:              string[],
                                sessionNumber:      number,
                                measurementNumber:  number,
                                measurement:        IMeasurement) {

    lines.push("measurement " + sessionNumber.toString() + "." + measurementNumber.toString() + " name: " + measurement.name);
    lines.push("measurement " + sessionNumber.toString() + "." + measurementNumber.toString() + " obis: " + measurement.obis);
    lines.push("measurement " + sessionNumber.toString() + "." + measurementNumber.toString() + " status: " + formatCryptoResult(measurement.verificationResult));
    lines.push("measurement " + sessionNumber.toString() + "." + measurementNumber.toString() + " values: " + measurement.values.length.toString());

    for (const [valueIndex, value] of measurement.values.entries())
        appendMeasurementValueLines(lines, sessionNumber, measurementNumber, valueIndex + 1, value);

}

function appendMeasurementValueLines(lines:              string[],
                                     sessionNumber:      number,
                                     measurementNumber:  number,
                                     valueNumber:        number,
                                     value:              IMeasurementValue) {

    const prefix = "value " + sessionNumber.toString() + "." + measurementNumber.toString() + "." + valueNumber.toString();

    lines.push(prefix + " timestamp: " + value.timestamp);
    lines.push(prefix + " value: " + value.value.toString());
    lines.push(prefix + " signatures: " + ((value.signatures?.length ?? 0).toString()));
    lines.push(prefix + " status: " + formatCryptoResult(value.result));

}

function formatCryptoResult(result: ICryptoResult | undefined): string {
    return result?.status ?? "unknown";
}
