import { describe, expect, test, vi } from "vitest";

import {
    CryptoAlgorithms,
    CryptoHashAlgorithms,
    DisplayPrefixes,
    InformationRelevance,
    isOIDInfo,
    PublicKeyFormats,
    SessionVerificationResult,
    SignatureFormats,
    VerificationResult,
    isICryptoResult,
    isIPublicKeyXY,
    isISessionCryptoResult1,
    isISessionCryptoResult2,
    isIFileInfo
} from '@open-charging-cloud/chargy-core';
import {
    IsAChargeTransparencyRecord,
    IsASessionCryptoResult
} from '@open-charging-cloud/chargy-core';
import {
    IsAPublicKeyLookup,
    IsAPublicKeyInfo
} from '@open-charging-cloud/chargy-core';

import {
  OBIS2Hex,
  OBIS2MeasurementName,
  buf2hex,
  createHexString,
  hexToArrayBuffer,
  intFromBytes,
  measurementName2human,
  parseHexString,
  parseOBIS
} from "@open-charging-cloud/chargy-core";

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
    }
});

describe("Chargy data structure guards", () => {

    test("recognizes a charge transparency record by its required structural fields", () => {
      const ctr = sampleChargeTransparencyRecord();

      expect(IsAChargeTransparencyRecord(ctr)).toBe(true);
      expect(IsAChargeTransparencyRecord({ ...ctr, chargingSessions: undefined })).toBe(false);
      expect(IsAChargeTransparencyRecord(undefined)).toBe(false);
    });

    test("recognizes public key info and rejects incomplete keys", () => {
      expect(IsAPublicKeyInfo(samplePublicKeyInfo())).toBe(true);
      expect(IsAPublicKeyInfo(samplePublicKeyInfo({ value: undefined as unknown as string }))).toBe(false);
    });

    test("recognizes public key lookup containers", () => {
      expect(IsAPublicKeyLookup(samplePublicKeyLookup())).toBe(true);
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
      expect(isOIDInfo({ oid: "1.2.3.4", name: "Example OID" })).toBe(true);
      expect(isOIDInfo({ name: "Missing OID" })).toBe(false);

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
