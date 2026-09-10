import { describe, expect, test, vi } from "vitest";
import { ec as EC }                   from "elliptic";
import Decimal                        from "decimal.js";

import {
    Chargy,
    EMHCrypt01,
    VerificationResult
} from "@open-charging-cloud/chargy-core";
import type {
    ICryptoResult,
    IEMHMeasurementValue,
    IEnergyMeter,
    IMeasurement,
    IChargingSession,
    ISignatureRS
} from "@open-charging-cloud/chargy-core";

import { createTestChargy, mergeI18NDictionaries } from "./chargyTestRuntime";
import coreI18n  from "@open-charging-cloud/chargy-core/i18n.json";
import localI18n from "../src/i18n.json";

vi.stubGlobal("window", {
    navigator: {
        language: "en"
    }
});

const i18n   = mergeI18NDictionaries(coreI18n, localI18n);
const chargy = createTestChargy(Chargy, { i18n });
const crypt  = new EMHCrypt01(chargy);

// DecodeStatus and AddVerificationError are non-public, DOM-free helpers,
// exercised here directly.
type EMHCrypt01Internals = {
    DecodeStatus(statusValue: string): string[];
    AddVerificationError(cryptoResult: ICryptoResult, reasonKey: string, detail?: unknown): void;
};

function decodeStatus(statusValue: string): string[] {
    return (crypt as unknown as EMHCrypt01Internals).DecodeStatus(statusValue);
}

function makeMeasurementValue(signatures: ISignatureRS[]): IEMHMeasurementValue {

    const chargingSession: IChargingSession = { "@id": "session-1" };

    const measurement: IMeasurement = {
        energyMeterId:  "METER-1",
        name:           "ENERGY_TOTAL",
        obis:           "1-0:1.8.0*255",
        scale:          0,
        unitEncoded:    30,
        values:         [],
        chargingSession
    };

    return {
        measurement,
        timestamp:     "2024-01-01T00:00:00Z",
        value:         new Decimal(123000),
        infoStatus:    "08",
        secondsIndex:  0,
        paginationId:  "00000001",
        logBookIndex:  "0000",
        signatures
    };

}

function withMeter(publicKeyValue: string): void {

    const meter: IEnergyMeter = {
        "@id":       "METER-1",
        publicKeys:  [{ algorithm: "secp192r1", format: "rs", value: publicKeyValue }]
    };

    chargy.GetMeter = (): IEnergyMeter => meter;

}

function errorCodes(result: ICryptoResult): Array<string | undefined> {
    return (result.errors ?? []).map(error => error.code);
}

describe("EMHCrypt01.DecodeStatus", () => {

    test("interprets the info status as a hexadecimal value", () => {
        // 0x40 = 64 sets bit 64 ('Magnetfeld erkannt').
        // Parsing "40" as decimal (the previous bug) yields 0b101000 and never sets bit 64.
        expect(decodeStatus("40")).toContain("Magnetfeld erkannt");
    });

    test("decodes hexadecimal digits A-F", () => {
        // 0x1A = 26 = 0b11010 sets bits 2, 8 and 16.
        // parseInt("1A") without radix 16 stops at 'A' and yields 1 ('Fehler erkannt').
        const flags = decodeStatus("1A");

        expect(flags).toContain("Synchrone Messwertübermittlung"); // bit 2
        expect(flags).toContain("System-Uhr ist synchron");        // bit 8
        expect(flags).toContain("Rücklaufsperre aktiv");           // bit 16
        expect(flags).not.toContain("Fehler erkannt");             // bit 1 must stay unset
    });

});

describe("EMHCrypt01 verification diagnostics", () => {

    test("records a structured reason (i18n key + raw detail) for a verification error", () => {

        const cryptoResult: ICryptoResult = { status: VerificationResult.InvalidSignature };

        (crypt as unknown as EMHCrypt01Internals).AddVerificationError(
            cryptoResult,
            "Verification_SignatureMismatch",
            new Error("boom")
        );

        const error = cryptoResult.errors?.[0];

        expect(error?.code).toBe("Verification_SignatureMismatch");            // stable, machine-switchable
        expect(error?.details).toBe("boom");                                   // raw technical detail
        expect(error?.message["en"]).toBe("The signature does not match the signed data!");
        expect(error?.message["de"]).toBe("Die Signatur passt nicht zu den signierten Daten!");

    });

    test("reports an undecodable public key as PublicKeyDecodingFailed", async () => {

        withMeter("ff".repeat(20));

        const result = await crypt.VerifyMeasurement(makeMeasurementValue([{ r: "01", s: "01" }]));

        expect(result.status).toBe(VerificationResult.InvalidPublicKey);
        expect(errorCodes(result)).toContain("Verification_PublicKeyDecodingFailed");

    });

    test("reports a public key that is not on the curve as PublicKeyNotOnCurve", async () => {

        withMeter("04" + "00".repeat(48));

        const result = await crypt.VerifyMeasurement(makeMeasurementValue([{ r: "01", s: "01" }]));

        expect(result.status).toBe(VerificationResult.InvalidPublicKey);
        expect(errorCodes(result)).toContain("Verification_PublicKeyNotOnCurve");

    });

    test("distinguishes a genuine signature mismatch from malformed input", async () => {

        const keyPair        = new EC("p192").genKeyPair();
        const otherSignature = keyPair.sign("ab".repeat(24)); // a valid signature over unrelated data

        withMeter(keyPair.getPublic("hex"));

        const result = await crypt.VerifyMeasurement(makeMeasurementValue([{
            r: otherSignature.r.toString(16),
            s: otherSignature.s.toString(16)
        }]));

        expect(result.status).toBe(VerificationResult.InvalidSignature);
        expect(errorCodes(result)).toContain("Verification_SignatureMismatch");

        // A genuine cryptographic mismatch carries no exception detail.
        const mismatch = result.errors?.find(error => error.code === "Verification_SignatureMismatch");
        expect(mismatch?.details).toBeUndefined();

    });

});
