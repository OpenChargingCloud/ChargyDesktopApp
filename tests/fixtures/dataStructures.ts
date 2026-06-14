import Decimal from "decimal.js";
import {
    CryptoAlgorithms,
    CryptoHashAlgorithms,
    SessionVerificationResult,
    SignatureFormats,
    VerificationResult
} from '../../src/ts/interfaces/chargyInterfaces';

import type {
    IChargeTransparencyRecord,
    IMeasurement,
    IMeasurementValue
} from '../../src/ts/interfaces/IChargeTransparencyRecord';
import type {
    IPublicKeyInfo,
    IPublicKeyLookup
} from '../../src/ts/interfaces/IPublicKeyInfo';
import type {
    ICryptoResult,
    IFileInfo,
    ISessionCryptoResult
} from '../../src/ts/interfaces/chargyInterfaces';

export function samplePublicKeyInfo(overrides: Partial<IPublicKeyInfo> = {}): IPublicKeyInfo {
  return {
    "@id": "public-key/example-meter",
    "@context": "https://open.charging.cloud/contexts/PublicKeyInfo+json",
    subject: "DE*GDF*E12345678",
    algorithm: {
      oid: "1.2.840.10045.2.1",
      name: CryptoAlgorithms.ECC
    },
    encoding: "hex",
    value: "04" + "a1".repeat(32) + "b2".repeat(32),
    certainty: 1,
    ...overrides
  };
}

export function samplePublicKeyLookup(publicKeys: IPublicKeyInfo[] = [samplePublicKeyInfo()]): IPublicKeyLookup {
  return {
    publicKeys,
    status: SessionVerificationResult.Unvalidated
  };
}

export function sampleCryptoResult(overrides: Partial<ICryptoResult> = {}): ICryptoResult {
  return {
    status: VerificationResult.ValidSignature,
    ...overrides
  };
}

export function sampleSessionCryptoResult(overrides: Partial<ISessionCryptoResult> = {}): ISessionCryptoResult {
  return {
    status: SessionVerificationResult.ValidSignature,
    certainty: 1,
    ...overrides
  };
}

export function sampleMeasurementValue(overrides: Partial<IMeasurementValue> = {}): IMeasurementValue {
  return {
    timestamp: "2024-01-02T03:04:05Z",
    value: new Decimal("12.345"),
    signatures: [
      {
        algorithm: CryptoAlgorithms.ECC,
        format: SignatureFormats.RS,
        r: "11".repeat(32),
        s: "22".repeat(32)
      }
    ],
    result: sampleCryptoResult(),
    ...overrides
  };
}

export function sampleMeasurement(overrides: Partial<IMeasurement> = {}): IMeasurement {
  return {
    energyMeterId: "meter-123",
    name: "ENERGY_TOTAL",
    obis: "1-0:1.8.0*255",
    unit: "kWh",
    scale: -3,
    signatureInfos: {
      hash: CryptoHashAlgorithms.SHA256,
      algorithm: CryptoAlgorithms.ECC,
      curve: "secp256r1",
      format: SignatureFormats.RS,
      encoding: "hex"
    },
    values: [sampleMeasurementValue()],
    verificationResult: sampleCryptoResult(),
    ...overrides
  };
}

export function sampleChargeTransparencyRecord(
  overrides: Partial<IChargeTransparencyRecord> = {}
): IChargeTransparencyRecord {
  return {
    "@id": "ctr/example-session",
    "@context": "https://open.charging.cloud/contexts/CTR+json",
    begin: "2024-01-02T03:04:05Z",
    end: "2024-01-02T04:04:05Z",
    chargingSessions: [
      {
        "@id": "session/example",
        begin: "2024-01-02T03:04:05Z",
        end: "2024-01-02T04:04:05Z",
        EVSEId: "DE*GDF*E12345678*1",
        authorizationStart: {
          "@id": "authorization/start",
          timestamp: "2024-01-02T03:04:05Z"
        },
        measurements: [sampleMeasurement()]
      }
    ],
    publicKeys: [samplePublicKeyInfo()],
    verificationResult: sampleSessionCryptoResult(),
    certainty: 1,
    status: SessionVerificationResult.ValidSignature,
    ...overrides
  };
}

export function sampleFileInfo(data: ArrayBuffer | Uint8Array = new Uint8Array([0xca, 0xfe])): IFileInfo {
  return {
    name: "example.chargy",
    type: "application/x-chargy",
    data
  };
}
