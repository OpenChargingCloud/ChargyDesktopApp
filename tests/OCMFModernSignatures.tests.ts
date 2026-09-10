import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
    Chargy,
    IsAChargeTransparencyRecord,
    OCMF,
    OCMF_SIGNATURE_ALGORITHMS,
    getOCMFSignatureDisplay,
    SessionVerificationResult,
    type IOCMFChargeTransparencyRecord,
    type IOCMFSignature
} from "@open-charging-cloud/chargy-core";
import { createTestChargy } from "./chargyTestRuntime";

const fixtureRoot = new URL("fixtures/OCMF/BET_TariffTextExtension/001/", import.meta.url);

const modernFixtures = [
    {
        algorithm:        "EdDSA-Ed25519" as const,
        fileName:         "001-01_Ed25519.ocmf",
        publicKeyFileName: "001-01_Ed25519.publicKey.hex",
        publicKeyPEMName:  "001-01_Ed25519.publicKey.pem",
        publicKeyOID:      "1.3.101.112"
    },
    {
        algorithm:        "EdDSA-Ed448" as const,
        fileName:         "001-01_Ed448.ocmf",
        publicKeyFileName: "001-01_Ed448.publicKey.hex",
        publicKeyPEMName:  "001-01_Ed448.publicKey.pem",
        publicKeyOID:      "1.3.101.113"
    },
    {
        algorithm:        "ML-DSA-44" as const,
        fileName:         "001-01_ML-DSA-44.ocmf",
        publicKeyFileName: "001-01_ML-DSA-44.publicKey.hex",
        publicKeyPEMName:  "001-01_ML-DSA-44.publicKey.pem",
        publicKeyOID:      "2.16.840.1.101.3.4.3.17"
    },
    {
        algorithm:        "ML-DSA-65" as const,
        fileName:         "001-01_ML-DSA-65.ocmf",
        publicKeyFileName: "001-01_ML-DSA-65.publicKey.hex",
        publicKeyPEMName:  "001-01_ML-DSA-65.publicKey.pem",
        publicKeyOID:      "2.16.840.1.101.3.4.3.18"
    },
    {
        algorithm:        "ML-DSA-87" as const,
        fileName:         "001-01_ML-DSA-87.ocmf",
        publicKeyFileName: "001-01_ML-DSA-87.publicKey.hex",
        publicKeyPEMName:  "001-01_ML-DSA-87.publicKey.pem",
        publicKeyOID:      "2.16.840.1.101.3.4.3.19"
    }
] as const;

function encodeLength(length: number): Buffer {
    if (length < 0x80)
        return Buffer.from([length]);

    const bytes: number[] = [];
    while (length > 0) {
        bytes.unshift(length & 0xff);
        length >>>= 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeTLV(tag: number, value: Buffer): Buffer {
    return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

function encodeOID(oid: string): Buffer {
    const components = oid.split(".").map(Number);
    const [first = 0, second = 0, ...remainingComponents] = components;
    const bytes      = [40 * first + second];

    for (const component of remainingComponents) {
        const encoded = [component & 0x7f];
        let value     = component >>> 7;
        while (value > 0) {
            encoded.unshift(0x80 | (value & 0x7f));
            value >>>= 7;
        }
        bytes.push(...encoded);
    }

    return encodeTLV(0x06, Buffer.from(bytes));
}

function encodeSubjectPublicKeyInfo(oid: string, publicKey: Buffer): Buffer {
    const algorithmIdentifier = encodeTLV(0x30, encodeOID(oid));
    const subjectPublicKey    = encodeTLV(0x03, Buffer.concat([Buffer.from([0]), publicKey]));
    return encodeTLV(0x30, Buffer.concat([algorithmIdentifier, subjectPublicKey]));
}

describe("Chargy OCMF modern signature extensions", () => {

    test.each([
        [ "001-01_Ed25519.ocmf",   32 ],
        [ "001-01_Ed448.ocmf",     57 ],
        [ "001-01_ML-DSA-44.ocmf", undefined ],
        [ "001-01_ML-DSA-65.ocmf", undefined ],
        [ "001-01_ML-DSA-87.ocmf", undefined ]
    ])("formats the raw signature components of %s", (fileName, componentByteLength) => {

        const document  = readFileSync(new URL(fileName, fixtureRoot), "utf8").trim();
        const signature = JSON.parse(document.split("|")[2] ?? "null") as IOCMFSignature;
        const display   = getOCMFSignatureDisplay(signature, new Uint8Array());

        expect(display.valueLabel).toBe("raw");
        expect(display.value).toBe(signature.SD);

        if (componentByteLength === undefined)
        {
            expect(display.format).toBe("raw, hex");
            expect(display.r).toBeUndefined();
            expect(display.s).toBeUndefined();
        }
        else
        {
            const componentHexLength = componentByteLength * 2;
            expect(display.format).toBe("RS, hex");
            expect(display.r).toBe(signature.SD.substring(0, componentHexLength));
            expect(display.s).toBe(signature.SD.substring(componentHexLength));
        }

    });

    test.each(modernFixtures)("detects and verifies $fileName together with $publicKeyPEMName", async fixture => {

        const result = await createTestChargy(Chargy).DetectAndConvertContentFormat([
            {
                name: fixture.fileName,
                data: new Uint8Array(readFileSync(new URL(fixture.fileName, fixtureRoot)))
            },
            {
                name: fixture.publicKeyPEMName,
                type: "application/x-pem-file",
                data: new Uint8Array(readFileSync(new URL(fixture.publicKeyPEMName, fixtureRoot)))
            }
        ]);

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            throw new Error(`Expected ${fixture.fileName} to produce a charge transparency record.`);

        expect(result.chargingSessions?.[0]?.verificationResult?.status).toBe(SessionVerificationResult.ValidSignature);

    });

    test.each(modernFixtures)("verifies $fileName using $algorithm", async fixture => {

        expect(OCMF_SIGNATURE_ALGORITHMS).toContain(fixture.algorithm);

        const document = readFileSync(new URL(fixture.fileName, fixtureRoot), "utf8").trim();
        const publicKey = readFileSync(new URL(fixture.publicKeyFileName, fixtureRoot), "utf8").trim();
        const result   = await new OCMF(createTestChargy(Chargy)).TryToParseOCMFDocument(
            document,
            publicKey,
            "hex"
        );

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            throw new Error(`Expected ${fixture.fileName} to produce a charge transparency record.`);

        const record = result as IOCMFChargeTransparencyRecord;
        expect(record.status).toBe(SessionVerificationResult.ValidSignature);
        expect(record.ocmf?.tariffText).toBe("001;EUR;0;35;5;30");
        expect(record.chargingSessions?.[0]?.measurements[0]?.values).toHaveLength(2);

    });

    test.each(modernFixtures)("$publicKeyPEMName is the SPKI representation of its raw key", fixture => {

        const rawPublicKey = Buffer.from(
            readFileSync(new URL(fixture.publicKeyFileName, fixtureRoot), "utf8").trim(),
            "hex"
        );
        const pem = readFileSync(new URL(fixture.publicKeyPEMName, fixtureRoot), "utf8");
        const der = Buffer.from(
            pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, ""),
            "base64"
        );

        expect(der).toEqual(encodeSubjectPublicKeyInfo(fixture.publicKeyOID, rawPublicKey));

    });

});
