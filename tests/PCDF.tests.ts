import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, test, vi } from 'vitest';
import { Chargy } from '../src/ts/chargy';
import {
    IsAChargeTransparencyRecord,
    SessionVerificationResult,
    VerificationResult
} from '../src/ts/chargyInterfaces';
import type { IFileInfo } from '../src/ts/chargyInterfaces';
import {
    PCDF_FIELD_ORDER,
    PCDF_PREFIX,
    PCDFParseError,
    PCDFValidationError,
    normalizePCDFPublicKeyHex,
    parsePCDFDocument,
    parsePCDFSignature,
    validatePCDFFields,
    verifyPCDFDocument
} from '../src/ts/PCDF';

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

type TestPCDFFields = Record<typeof PCDF_FIELD_ORDER[number], string>;

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

function generatePCDF(overrides?: Partial<TestPCDFFields>): {
    pcdf:         string;
    payload:      string;
    publicKeyHex: string;
    fields:       TestPCDFFields;
} {

    const { publicKey, privateKey } = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1'
    });

    const publicKeyDER = publicKey.export({ type: 'spki', format: 'der' });
    const publicKeyHex = publicKeyDER.subarray(publicKeyDER.length - 65).toString('hex');

    const fields: TestPCDFFields = {
        ST:  '260101120000',
        CT:  '260101120500',
        CD:  '000500',
        TV:  '1',
        BV:  '1',
        CSC: '7',
        SP:  '1',
        RV:  '0001.234*kWh',
        SI:  'testuser*1*tx-001',
        CS:  'aabbccdd',
        HW:  '12345678901',
        DT:  '0',
        PK:  publicKeyHex,
        SG:  '',
        ...overrides
    };

    fields.PK = overrides?.PK ?? publicKeyHex;

    const payload = PCDF_PREFIX + PCDF_FIELD_ORDER.
        filter(field => field !== "SG").
        map(field => "(" + field + ":" + fields[field] + ")").
        join("");

    const signer = createSign('SHA256');
    signer.update(payload, 'utf8');
    fields.SG = signer.sign(privateKey).toString('hex');

    return {
        pcdf:         payload + "(SG:" + fields.SG + ")",
        payload:      payload,
        publicKeyHex: publicKeyHex,
        fields:       fields
    };

}

describe('PCDF parser', () => {

    test("parses all mandatory fields and signed payload", () => {

        const generated = generatePCDF();
        const parsed    = parsePCDFDocument(generated.pcdf);

        expect(parsed.fields.ST).toBe('260101120000');
        expect(parsed.fields.RV).toBe('0001.234*kWh');
        expect(parsed.fields.PK).toBe(generated.publicKeyHex);
        expect(parsed.signedPayload).toBe(generated.payload);
        expect(parsed.signedPayload.endsWith("(PK:" + generated.publicKeyHex + ")")).toBe(true);

    });

    test("handles STX/ETX wrapping", () => {

        const generated = generatePCDF();
        const parsed    = parsePCDFDocument("\x02" + generated.pcdf + "\x03");

        expect(parsed.fields.SG).toBe(generated.fields.SG);

    });

    test("rejects non-PCDF input", () => {
        expect(() => parsePCDFDocument("OCMF|{}|{}")).toThrow(PCDFParseError);
    });

    test("rejects missing fields", () => {

        const generated = generatePCDF();
        const withoutST = generated.pcdf.replace("(ST:260101120000)", "");

        expect(() => parsePCDFDocument(withoutST)).toThrow(/Missing fields/);

    });

});

describe('PCDF validation', () => {

    test("validates and normalizes a valid document", () => {

        const parsed    = parsePCDFDocument(generatePCDF().pcdf);
        const validated = validatePCDFFields(parsed.fields);

        expect(validated.stopTime).toBe("2026-01-01T12:05:00.000Z");
        expect(validated.durationSeconds).toBe(300);
        expect(validated.readingValue.toString()).toBe("1.234");
        expect(validated.hardwareSerial).toBe("12345678901");
        expect(validated.publicKey.value).toBe(parsed.fields.PK);

    });

    test("rejects invalid billing and missing stop data", () => {

        const parsed = parsePCDFDocument(generatePCDF({
            BV: "0",
            SP: "0"
        }).pcdf);

        expect(() => validatePCDFFields(parsed.fields)).toThrow(PCDFValidationError);
        expect(() => validatePCDFFields(parsed.fields)).toThrow(/Billing not possible/);
        expect(() => validatePCDFFields(parsed.fields)).toThrow(/last data/);

    });

    test("rejects corrupt timestamps and readings", () => {

        const parsed = parsePCDFDocument(generatePCDF({
            ST: "260231120000",
            RV: "001.234*kWh"
        }).pcdf);

        expect(() => validatePCDFFields(parsed.fields)).toThrow(/Corrupt time information/);
        expect(() => validatePCDFFields(parsed.fields)).toThrow(/Session information is invalid/);

    });

});

describe('PCDF crypto', () => {

    test("parses DER signatures", () => {

        const parsed    = parsePCDFDocument(generatePCDF().pcdf);
        const signature = parsePCDFSignature(parsed.fields.SG);

        expect(signature.r?.length).toBeGreaterThan(0);
        expect(signature.s?.length).toBeGreaterThan(0);

    });

    test("normalizes SPKI DER public keys to raw points", () => {

        const derPublicKey = readFileSync(new URL("fixtures/OCMF/OCMF-Testdata-01_publicKey.txt", import.meta.url), "utf8").trim();

        expect(normalizePCDFPublicKeyHex(derPublicKey)).toHaveLength(130);

    });

    test("verifies a valid PCDF signature", async () => {

        const generated = generatePCDF();
        const parsed    = parsePCDFDocument(generated.pcdf);
        const data      = validatePCDFFields(parsed.fields);
        const chargy    = createChargy();

        const result = await verifyPCDFDocument({
            "@context":        "PCDF",
            raw:               parsed.raw,
            fields:            parsed.fields,
            signedPayload:     parsed.signedPayload,
            hashAlgorithm:     "SHA256",
            hashValue:         "",
            data:              data,
            publicKeyHex:      generated.publicKeyHex,
            signatureHex:      parsed.fields.SG,
            validationStatus:  VerificationResult.Unvalidated
        }, chargy);

        expect(result).toBe(VerificationResult.ValidSignature);

    });

    test("rejects a tampered PCDF payload", async () => {

        const generated = generatePCDF();
        const parsed    = parsePCDFDocument(generated.pcdf.replace("0001.234*kWh", "0001.235*kWh"));
        const data      = validatePCDFFields(parsed.fields);
        const chargy    = createChargy();

        const result = await verifyPCDFDocument({
            "@context":        "PCDF",
            raw:               parsed.raw,
            fields:            parsed.fields,
            signedPayload:     parsed.signedPayload,
            hashAlgorithm:     "SHA256",
            hashValue:         "",
            data:              data,
            publicKeyHex:      generated.publicKeyHex,
            signatureHex:      parsed.fields.SG,
            validationStatus:  VerificationResult.Unvalidated
        }, chargy);

        expect(result).toBe(VerificationResult.InvalidSignature);

    });

});

describe('PCDF Chargy integration', () => {

    test("detects and converts a valid PCDF record", async () => {

        const generated = generatePCDF();
        const fileInfo: IFileInfo = {
            name: "PCDF-valid-01.pcdf",
            type: "text/plain",
            data: new TextEncoder().encode(generated.pcdf)
        };

        const result = await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (!IsAChargeTransparencyRecord(result))
            return;

        const session     = result.chargingSessions?.[0];
        const measurement = session?.measurements[0];
        const value       = measurement?.values[0];

        expect(session?.verificationResult?.status).toBe(SessionVerificationResult.ValidSignature);
        expect(session?.["@context"]).toContain("PCDF");
        expect(session?.authorizationStart["@id"]).toBe("testuser");
        expect(session?.authorizationStop).toBeUndefined();
        expect(measurement?.obis).toBe(PCDF_PREFIX);
        expect(value?.value.toString()).toBe("1.234");
        expect(value?.result?.status).toBe(VerificationResult.ValidSignature);

    });

    test("detects PCDF records with invalid signatures", async () => {

        const generated = generatePCDF();
        const tampered  = generated.pcdf.replace("0001.234*kWh", "0001.235*kWh");
        const fileInfo: IFileInfo = {
            name: "PCDF-invalid-signature.pcdf",
            type: "text/plain",
            data: new TextEncoder().encode(tampered)
        };

        const result = await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (!IsAChargeTransparencyRecord(result))
            return;

        expect(result.chargingSessions?.[0]?.verificationResult?.status).toBe(SessionVerificationResult.InvalidSignature);
        expect(result.chargingSessions?.[0]?.measurements[0]?.values[0]?.result?.status).toBe(VerificationResult.InvalidSignature);

    });

});
