import { expect, vi }     from 'vitest';
import { Chargy }         from '@open-charging-cloud/chargy-core';
import { readFileSync }   from "node:fs";
import {
    createTestChargy,
    ensureChargyTestDOM,
    mergeI18NDictionaries,
    parseValidationRules
} from "./chargyTestRuntime";
import {
    IsAChargeTransparencyRecord,
    IsAChargeTransparencyLiveLink
} from '@open-charging-cloud/chargy-core';
import type {
    IChargeTransparencyRecord,
    IMeasurement,
    IMeasurementValue,
    I18NString,
    ICryptoResult,
    IFileInfo,
    ISessionCryptoResult,
    IValidationRules,
    IPublicKey,
    IChargeTransparencyLiveLink
} from '@open-charging-cloud/chargy-core';

import coreI18n  from '@open-charging-cloud/chargy-core/i18n.json';
import localI18n from '../src/i18n.json';


export {
    createVerificationChargy,
    expectVerificationReport,
    expectVerificationReportInline,
    expectBinaryVerificationReport,
    expectArchiveVerificationReport,
    expectMultiArchiveVerificationReport,
    expectVerificationReportWithPublicKey,
    expectVerificationReportWithValidationRules
}

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

ensureChargyTestDOM();

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

function createVerificationChargy(validationRules?: IValidationRules): Chargy {

    const i18n = mergeI18NDictionaries(coreI18n, localI18n);

    return validationRules === undefined
               ? createTestChargy(Chargy, { i18n })
               : createTestChargy(Chargy, { i18n, validationRules });

}

function expectReportLines(summary: string, expected: string): void {

    const summaryLines  = summary. split(/\r?\n/);
    const expectedLines = expected.split(/\r?\n/);
    const maxLength     = Math.max(summaryLines.length, expectedLines.length);

    for (let i = 0; i < maxLength; i++)
        expect.soft(summaryLines[i], "verification report line " + ((i + 1).toString())).toBe(expectedLines[i]);

}

async function expectVerificationReport(inputFixture: string, expectedFixture: string): Promise<void> {

    const input    = readFixture(inputFixture);
    const expected = readFixture(expectedFixture);

    const report   = await verifyChargeData(inputFixture, input);
    const summary  = formatChargeDataVerificationReport(report);

    expectReportLines(summary, expected);

}

async function expectVerificationReportWithValidationRules(inputFixture:           string,
                                                           expectedFixture:        string,
                                                           validationRulesFixture: string): Promise<void> {

    const input           = readFixture(inputFixture);
    const expected        = readFixture(expectedFixture);
    const validationRules = parseValidationRules(readFixture(validationRulesFixture));

    const report          = await verifyChargeData(inputFixture, input, undefined, validationRules);
    const summary         = formatChargeDataVerificationReport(report);

    expectReportLines(summary, expected);

}

async function expectVerificationReportInline(inputFixture: string, expected: object | unknown[]): Promise<void> {

    const input  = readFixture(inputFixture);
    const report = await verifyChargeData(inputFixture, input);

    expect(report).toMatchObject(expected);

}

async function expectArchiveVerificationReport(archiveFixture: string, expectedFixture: string): Promise<void> {

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

async function expectMultiArchiveVerificationReport(inputFixtures: string[], expectedFixture: string): Promise<void> {

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

async function expectBinaryVerificationReport(inputFixture: string, expectedFixture: string): Promise<void> {

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

async function expectVerificationReportWithPublicKey(inputFixture: string, publicKeyFixture: string, expectedFixture: string): Promise<void> {

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
                                type?:     string,
                                validationRules?: IValidationRules)

    : Promise<IChargeTransparencyRecord   |
              IChargeTransparencyLiveLink |
              IPublicKey                  |
              ISessionCryptoResult>

{

    const fileInfo: IFileInfo = {
        name: fileName,
        type: type ?? archiveMimeType(fileName),
        data: typeof input === "string"
            ? new TextEncoder().encode(input)
            : input
    };

    return createVerificationChargy(validationRules).DetectAndConvertContentFormat([ fileInfo ]);

}

async function verifyChargeDataFiles(fileInfos: IFileInfo[],
                                     validationRules?: IValidationRules)

    : Promise<IChargeTransparencyRecord   |
              IChargeTransparencyLiveLink |
              IPublicKey                  |
              ISessionCryptoResult>

{
    return createVerificationChargy(validationRules).DetectAndConvertContentFormat(fileInfos);
}

function formatChargeDataVerificationReport(report: IChargeTransparencyRecord | IChargeTransparencyLiveLink | IPublicKey | ISessionCryptoResult): string {

    if (IsAChargeTransparencyLiveLink(report))
        return [
            "format: charge-transparency-live-link",
            "timestamp: "  +  (report.timestamp ?? ""),
            "transports: " + ((report.transports?.length ?? 0).toString())
        ].join("\n");

    if (!IsAChargeTransparencyRecord(report)) {
        const sessionResult = report as ISessionCryptoResult;

        return [
            "format: session-result",
            "status: "  +  sessionResult.status,
            "message: " + formatOptionalMultilanguageText(sessionResult.message)
        ].join("\n");
    }

    const sessions = report.chargingSessions ?? [];
    const lines    = [
        "format: ctr",
        "sessions: " + sessions.length.toString()
    ];

    if (report.warnings && report.warnings.length > 0) {
        lines.push("warnings: " + report.warnings.length.toString());

        for (const [warningIndex, warning] of report.warnings.entries())
            lines.push("warning " + ((warningIndex + 1).toString()) + ": " + formatWarning(warning));
    }

    for (const [sessionIndex, session] of sessions.entries()) {

        const measurements = session.measurements ?? [];
        const meterId      = session.meterId
                                ?? measurements[0]?.energyMeterId
                                ?? "";

        lines.push("session " + ((sessionIndex + 1).toString()) + ": " + session["@id"]);
        lines.push("session " + ((sessionIndex + 1).toString()) + " evseId: " + (session.EVSEId ?? "unknown"));
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
                                measurement:        IMeasurement): void {

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
                                     value:              IMeasurementValue): void {

    const prefix = "value " + sessionNumber.toString() + "." + measurementNumber.toString() + "." + valueNumber.toString();

    lines.push(prefix + " timestamp: " + value.timestamp);
    lines.push(prefix + " value: " + value.value.toString());
    lines.push(prefix + " signatures: " + ((value.signatures?.length ?? 0).toString()));
    lines.push(prefix + " status: " + formatCryptoResult(value.result));

}

function formatCryptoResult(result: ICryptoResult | undefined): string {
    return result?.status ?? "unknown";
}

function formatWarning(warning: { level: string; message: I18NString }): string {

    return warning.level + ": " + formatMultilanguageText(warning.message);

}

function formatMultilanguageText(text: I18NString): string {

    return text['en'] ?? Object.values(text)[0] ?? "";

}

function formatOptionalMultilanguageText(text: I18NString | undefined): string {

    if (text == null)
        return "";

    return formatMultilanguageText(text);

}
