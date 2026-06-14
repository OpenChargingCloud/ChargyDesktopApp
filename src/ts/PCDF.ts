/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Chargy }                from './chargy'
import { ACrypt }                     from './ACrypt'
import * as chargyInterfaces          from './interfaces/chargyInterfaces'
import * as chargeTransparencyRecord  from './interfaces/IChargeTransparencyRecord'
import * as chargyLib                 from './chargyLib'
import Decimal                        from 'decimal.js';


export const PCDF_PREFIX = "128.8.0";

export const PCDF_FIELD_ORDER = [
    "ST",
    "CT",
    "CD",
    "TV",
    "BV",
    "CSC",
    "SP",
    "RV",
    "SI",
    "CS",
    "HW",
    "DT",
    "PK",
    "SG"
] as const;

const PCDF_PUBLIC_KEY_CONTEXT = "https://open.charging.cloud/contexts/publicKey+json";
const PCDF_SESSION_CONTEXT    = "https://open.charging.cloud/contexts/SessionSignatureFormats/PCDF+json";
const PCDF_SPKI_P256_PREFIX   = "3059301306072a8648ce3d020106082a8648ce3d030107034200";

export type PCDFFieldKey = typeof PCDF_FIELD_ORDER[number];

export interface IPCDFRawFields extends Record<PCDFFieldKey, string> {
    ST:  string;
    CT:  string;
    CD:  string;
    TV:  string;
    BV:  string;
    CSC: string;
    SP:  string;
    RV:  string;
    SI:  string;
    CS:  string;
    HW:  string;
    DT:  string;
    PK:  string;
    SG:  string;
}

export interface IPCDFSessionInfo {
    idTag:          string;
    idTagType:      string;
    transactionId:  string;
}

export interface IPCDFValidatedData {
    startTime:              string;
    stopTime:               string;
    durationSeconds:        number;
    timeValid:              boolean;
    billingValid:           boolean;
    chargingSessionCounter: number;
    stopPresent:            boolean;
    readingValue:           Decimal;
    readingUnit:            string;
    session:                IPCDFSessionInfo;
    softwareChecksum:       string;
    hardwareSerial:         string;
    dcMeterType:            number;
    publicKey:              chargyInterfaces.IPublicKeyXY;
    signature:              chargyInterfaces.ISignatureRS;
}

export interface IPCDFDocument {
    "@context":        "PCDF";
    raw:               string;
    fields:            IPCDFRawFields;
    signedPayload:     string;
    hashAlgorithm:     string;
    hashValue:         string;
    data:              IPCDFValidatedData;
    publicKeyHex:      string;
    signatureHex:      string;
    validationStatus:  chargyInterfaces.VerificationResult;
}

export interface IPCDFMeasurementValue extends chargeTransparencyRecord.IMeasurementValue {
    pcdfDocument?: IPCDFDocument;
}

export interface IPCDFMeasurement extends chargeTransparencyRecord.IMeasurement {
    values: Array<IPCDFMeasurementValue>;
}

export interface IPCDFChargingSession extends chargeTransparencyRecord.IChargingSession {
    measurements: Array<IPCDFMeasurement>;
}

export interface IPCDFChargeTransparencyRecord extends chargeTransparencyRecord.IChargeTransparencyRecord {
    pcdf?: {
        chargingSessionCounter: number;
        timeValid:              boolean;
        billingValid:           boolean;
        stopPresent:            boolean;
        chargingDuration:       number;
        dcMeterType:            number;
        softwareChecksum:       string;
    };
    chargingSessions?: Array<IPCDFChargingSession>;
}

export class PCDFParseError extends Error {

    constructor(readonly code: string,
                message:       string,
                readonly field?: PCDFFieldKey) {
        super(message);
        this.name = "PCDFParseError";
    }

}

export class PCDFValidationError extends Error {

    constructor(readonly errors: Array<string>) {
        super(errors.join("; "));
        this.name = "PCDFValidationError";
    }

}

export function isPCDFText(input: string | undefined): boolean {

    if (input == null)
        return false;

    const cleaned = stripPCDFControlCharacters(unquotePCDFText(input));

    return cleaned.startsWith(PCDF_PREFIX);

}

export function unquotePCDFText(input: string): string {

    const trimmed = input.trim();

    if (trimmed.startsWith("\"") && trimmed.endsWith("\""))
        return trimmed.substring(1, trimmed.length - 1);

    return trimmed;

}

export function stripPCDFControlCharacters(input: string): string {

    let cleaned = input.trim();

    if (cleaned.charCodeAt(0) === 0x02)
        cleaned = cleaned.substring(1);

    if (cleaned.charCodeAt(cleaned.length - 1) === 0x03)
        cleaned = cleaned.substring(0, cleaned.length - 1);

    return cleaned.trim();

}

export function parsePCDFDocument(input: string): {
    raw:            string;
    fields:         IPCDFRawFields;
    signedPayload:  string;
} {

    let cleaned = stripPCDFControlCharacters(unquotePCDFText(input));
    const prefixIndex = cleaned.indexOf(PCDF_PREFIX);

    if (prefixIndex < 0)
        throw new PCDFParseError("MISSING_PREFIX", "Charging data is not valid");

    cleaned = cleaned.substring(prefixIndex);

    const signatureIndex = cleaned.indexOf("(SG:");

    if (signatureIndex < 0)
        throw new PCDFParseError("MISSING_SIGNATURE", "No signature present in data tuple", "SG");

    const fieldPattern = new RegExp(
        "^" +
        PCDF_PREFIX.replace(/\./g, "\\.") +
        PCDF_FIELD_ORDER.map(field => "\\(" + field + ":([^)]*)\\)").join("") +
        "$"
    );

    const match = cleaned.match(fieldPattern);

    if (match == null)
    {
        const foundFields = new Set<PCDFFieldKey>();
        const fieldRegex  = /\(([A-Z]{2,3}):([^)]*)\)/g;

        let fieldMatch: RegExpExecArray | null;
        while ((fieldMatch = fieldRegex.exec(cleaned)) !== null)
        {
            const field = fieldMatch[1];
            if (PCDF_FIELD_ORDER.includes(field as PCDFFieldKey))
                foundFields.add(field as PCDFFieldKey);
        }

        const missingFields = PCDF_FIELD_ORDER.filter(field => !foundFields.has(field));

        if (missingFields.length > 0)
            throw new PCDFParseError(
                "MISSING_FIELDS",
                "Missing fields in the data tuple: " + missingFields.join(", "),
                missingFields[0]
            );

        throw new PCDFParseError("INVALID_FIELD_ORDER", "Charging data is not valid");
    }

    const fields = {} as IPCDFRawFields;

    for (let i = 0; i < PCDF_FIELD_ORDER.length; i++)
    {
        const value = match[i + 1];
        const field = PCDF_FIELD_ORDER[i];

        if (field == null || value == null)
            throw new PCDFParseError("MISSING_FIELDS", "Missing fields in the data tuple", field);

        fields[field] = value;
    }

    return {
        raw:            cleaned,
        fields:         fields,
        signedPayload:  cleaned.substring(0, signatureIndex)
    };

}

export function validatePCDFFields(fields: IPCDFRawFields): IPCDFValidatedData {

    const errors = new Array<string>();

    const startTime              = parsePCDFTimestamp(fields.ST, "ST", errors);
    const stopTime               = parsePCDFTimestamp(fields.CT, "CT", errors);
    const durationSeconds        = parsePCDFDuration(fields.CD, errors);
    const timeValid              = parsePCDFFlag(fields.TV, "TV", errors);
    const billingValid           = parsePCDFFlag(fields.BV, "BV", errors);
    const chargingSessionCounter = parsePCDFInteger(fields.CSC, "CSC", errors);
    const stopPresent            = parsePCDFFlag(fields.SP, "SP", errors);
    const reading                = parsePCDFReadingValue(fields.RV, errors);
    const session                = parsePCDFSessionInfo(fields.SI, errors);
    const dcMeterType            = parsePCDFInteger(fields.DT, "DT", errors);

    if (startTime != null && stopTime != null && stopTime < startTime)
        errors.push("Corrupt time information: CT must be greater than or equal to ST");

    if (billingValid === false)
        errors.push("Billing not possible. DCMeter error");

    if (stopPresent !== true)
        errors.push("Charge session does not include the last data");

    if (!/^[0-9a-fA-F]{8}$/.test(fields.CS))
        errors.push("CS must be exactly 8 hex characters");

    if (fields.HW.length !== 11)
        errors.push("HW must be exactly 11 characters");

    let publicKey: chargyInterfaces.IPublicKeyXY | undefined;
    let publicKeyHex = "";

    try
    {
        publicKeyHex = normalizePCDFPublicKeyHex(fields.PK);
        publicKey    = parsePCDFPublicKey(publicKeyHex);
    }
    catch (exception)
    {
        errors.push(exception instanceof Error ? exception.message : "Invalid public key");
    }

    let signature: chargyInterfaces.ISignatureRS | undefined;

    try
    {
        signature = parsePCDFSignature(fields.SG);
    }
    catch (exception)
    {
        errors.push(exception instanceof Error ? exception.message : "Invalid signature");
    }

    if (errors.length > 0 ||
        startTime == null ||
        stopTime == null ||
        durationSeconds == null ||
        timeValid == null ||
        billingValid == null ||
        chargingSessionCounter == null ||
        stopPresent == null ||
        reading == null ||
        session == null ||
        dcMeterType == null ||
        publicKey == null ||
        signature == null)
    {
        throw new PCDFValidationError(errors.length > 0 ? errors : [ "Session information is invalid" ]);
    }

    return {
        startTime:              startTime.toISOString(),
        stopTime:               stopTime.toISOString(),
        durationSeconds:        durationSeconds,
        timeValid:              timeValid,
        billingValid:           billingValid,
        chargingSessionCounter: chargingSessionCounter,
        stopPresent:            stopPresent,
        readingValue:           reading.value,
        readingUnit:            reading.unit,
        session:                session,
        softwareChecksum:       fields.CS.toLowerCase(),
        hardwareSerial:         fields.HW,
        dcMeterType:            dcMeterType,
        publicKey:              publicKey,
        signature:              signature
    };

}

export function normalizePCDFPublicKeyHex(publicKeyHex: string): string {

    const normalized = publicKeyHex.replace(/\s+/g, "").toLowerCase();
    const rawPoint   = normalized.startsWith(PCDF_SPKI_P256_PREFIX)
                           ? normalized.substring(PCDF_SPKI_P256_PREFIX.length)
                           : normalized;

    if (!/^[0-9a-f]+$/.test(rawPoint))
        throw new Error("Invalid public key encoding");

    if (rawPoint.length !== 130)
        throw new Error("Invalid public key length");

    if (!rawPoint.startsWith("04"))
        throw new Error("Invalid public key format");

    return rawPoint;

}

export function parsePCDFPublicKey(publicKeyHex: string): chargyInterfaces.IPublicKeyXY {

    const normalized = normalizePCDFPublicKeyHex(publicKeyHex);

    return {
        algorithm:  "secp256r1",
        format:     "XY",
        encoding:   chargyInterfaces.IEncoding.hex,
        value:      normalized,
        x:          normalized.substring( 2, 66),
        y:          normalized.substring(66, 130)
    };

}

export function parsePCDFSignature(signatureHex: string): chargyInterfaces.ISignatureRS {

    const bytes = hexToBytes(signatureHex, "Invalid signature encoding");
    let offset  = 0;

    if (bytes[offset++] !== 0x30)
        throw new Error("Invalid signature");

    const sequenceLength = readDERLength(bytes, () => offset, newOffset => offset = newOffset);

    if (offset + sequenceLength !== bytes.length)
        throw new Error("Invalid signature");

    const r = readDERInteger(bytes, () => offset, newOffset => offset = newOffset);
    const s = readDERInteger(bytes, () => offset, newOffset => offset = newOffset);

    if (offset !== bytes.length)
        throw new Error("Invalid signature");

    return {
        algorithm:  chargyInterfaces.CryptoAlgorithms.ECC,
        format:     chargyInterfaces.SignatureFormats.RS,
        r:          r,
        s:          s
    };

}

export async function verifyPCDFDocument(document: IPCDFDocument,
                                         chargy:   Chargy): Promise<chargyInterfaces.VerificationResult> {

    try
    {

        const curve     = new chargy.elliptic.ec('p256');
        const publicKey = curve.keyFromPublic(document.publicKeyHex, 'hex');

        document.hashValue = await chargyLib.sha256(document.signedPayload);

        return publicKey.verify(document.hashValue, document.data.signature)
                   ? chargyInterfaces.VerificationResult.ValidSignature
                   : chargyInterfaces.VerificationResult.InvalidSignature;

    }
    catch
    {
        return chargyInterfaces.VerificationResult.InvalidSignature;
    }

}

export class PCDFCrypt01 extends ACrypt {

    constructor(chargy: Chargy) {
        super("PCDF",
              chargy);
    }

    async VerifyChargingSession(chargingSession: chargeTransparencyRecord.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        let sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;
        let valueCount    = 0;

        for (const measurement of chargingSession.measurements)
        {
            measurement.chargingSession = chargingSession;

            for (const measurementValue of measurement.values)
            {
                valueCount++;
                measurementValue.measurement = measurement;

                const result = await this.VerifyMeasurement(measurementValue);

                if (result.status !== chargyInterfaces.VerificationResult.ValidSignature)
                    sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSignature;
            }
        }

        if (valueCount === 0)
            sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSessionFormat;

        return {
            status:    sessionResult,
            certainty: .9
        };

    }

    async VerifyMeasurement(measurementValue: IPCDFMeasurementValue): Promise<chargyInterfaces.ICryptoResult>
    {

        measurementValue.method = this;

        const result: IPCDFCrypt01Result = {
            status: chargyInterfaces.VerificationResult.InvalidMeasurement
        };

        if (measurementValue.pcdfDocument == null)
        {
            measurementValue.result = result;
            return result;
        }

        result.status      = measurementValue.pcdfDocument.validationStatus;
        result.hashValue   = measurementValue.pcdfDocument.hashValue;
        result.publicKey   = measurementValue.pcdfDocument.publicKeyHex;
        result.signature   = measurementValue.pcdfDocument.data.signature;

        measurementValue.result = result;

        return Promise.resolve(result);

    }

    async ViewMeasurement(measurementValue:      IPCDFMeasurementValue,
                          errorDiv:              HTMLDivElement,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement) : Promise<Error | undefined>
    {

        void errorDiv;
        void infoDiv;
        void SignatureCheckDiv;

        if (measurementValue.measurement === undefined)
            return new Error("Invalid measurement!");

        introDiv.innerHTML              = this.chargy.GetLocalizedMessage("The following data of the charging session is relevant for metrological and legal metrological purposes and therefore part of the digital signature").
                                                      replace("{methodName}",      "PCDF").
                                                      replace("{cryptoAlgorithm}", "ECDSA secp256r1 SHA256");

        PlainTextDiv.innerText          = measurementValue.pcdfDocument?.signedPayload ?? "";

        HashedPlainTextDiv.innerHTML    = measurementValue.pcdfDocument?.hashValue.match(/.{1,8}/g)?.join(" ") ?? "";

        PublicKeyDiv.innerHTML          = measurementValue.pcdfDocument?.publicKeyHex.match(/.{1,8}/g)?.join(" ") ?? "";

        SignatureExpectedDiv.innerHTML  = measurementValue.pcdfDocument?.signatureHex.match(/.{1,8}/g)?.join(" ") ?? "";

        return Promise.resolve(undefined);

    }

}

export interface IPCDFCrypt01Result extends chargyInterfaces.ICryptoResult {
    hashValue?:  string;
    publicKey?:  string;
    signature?:  chargyInterfaces.ISignatureRS;
}

export class PCDF {

    constructor(private readonly chargy: Chargy) {
    }

    public async TryToParsePCDFDocument(PCDFDocument:       string,
                                        externalPublicKey?: string): Promise<IPCDFChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {
            const parsed    = parsePCDFDocument(PCDFDocument);
            const validated = validatePCDFFields(parsed.fields);
            const publicKey = normalizePCDFPublicKeyHex(parsed.fields.PK);

            if (externalPublicKey != null &&
                normalizePCDFPublicKeyHex(externalPublicKey) !== publicKey)
            {
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidPublicKey,
                    message:   "Wrong Public Key",
                    certainty: 1
                };
            }

            const pcdfDocument: IPCDFDocument = {
                "@context":        "PCDF",
                raw:               parsed.raw,
                fields:            parsed.fields,
                signedPayload:     parsed.signedPayload,
                hashAlgorithm:     "SHA256",
                hashValue:         "",
                data:              validated,
                publicKeyHex:      publicKey,
                signatureHex:      parsed.fields.SG,
                validationStatus:  chargyInterfaces.VerificationResult.Unvalidated
            };

            pcdfDocument.validationStatus = await verifyPCDFDocument(pcdfDocument, this.chargy);

            return this.createChargeTransparencyRecord(pcdfDocument);
        }
        catch (exception)
        {
            return {
                status:    exception instanceof PCDFParseError
                               ? chargyInterfaces.SessionVerificationResult.InvalidSessionFormat
                               : chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   exception instanceof Error
                               ? exception.message
                               : String(exception),
                certainty: 0
            };
        }

    }

    private createChargeTransparencyRecord(document: IPCDFDocument): IPCDFChargeTransparencyRecord {

        const data                = document.data;
        const virtualPoolId       = "DE*GEF*POOL*CHARGY*1";
        const virtualStationId    = "DE*GEF*STATION*CHARGY*1";
        const virtualEVSEId       = "DE*GEF*EVSE*CHARGY*1";
        const meterId             = data.hardwareSerial;
        const transactionId       = data.session.transactionId || String(data.chargingSessionCounter);

        return {
            "@id":       "PCDF:" + transactionId,
            "@context":  "https://open.charging.cloud/contexts/CTR+json",
            "begin":     data.startTime,
            "end":       data.stopTime,
            "description": {
                "de": "Porsche Charging Data Format Ladevorgang",
                "en": "Porsche Charging Data Format charging session"
            },
            "contract": {
                "@id":   data.session.idTag,
                "type":  data.session.idTagType
            },
            "pcdf": {
                "chargingSessionCounter": data.chargingSessionCounter,
                "timeValid":              data.timeValid,
                "billingValid":           data.billingValid,
                "stopPresent":            data.stopPresent,
                "chargingDuration":       data.durationSeconds,
                "dcMeterType":            data.dcMeterType,
                "softwareChecksum":       data.softwareChecksum
            },
            "chargingPools": [{
                "@id":          virtualPoolId,
                "description":  { "en": "GraphDefined CHARGY Virtual Charging Pool 1" },
                "chargingStations": [{
                    "@id":          virtualStationId,
                    "description":  { "en": "GraphDefined CHARGY Virtual Charging Station 1" },
                    "EVSEs": [{
                        "@id":          virtualEVSEId,
                        "description":  { "en": "GraphDefined CHARGY Virtual EVSE 1" },
                        "meters": [{
                            "@id":              meterId,
                            "manufacturer":     "Porsche",
                            "model":            data.dcMeterType === 0 ? "PES DCMeter EU" : "Unknown DC Meter",
                            "firmwareChecksum": data.softwareChecksum,
                            "signatureFormat":  "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/PCDF+json",
                            "publicKeys": [{
                                "algorithm": "secp256r1",
                                "encoding":  chargyInterfaces.IEncoding.hex,
                                "format":    "XY",
                                "value":     document.publicKeyHex
                            }]
                        }]
                    }]
                }]
            }],
            "publicKeys": [{
                "@id":       meterId,
                "@context":  PCDF_PUBLIC_KEY_CONTEXT,
                "subject":   meterId,
                "algorithm": "secp256r1",
                "encoding":  chargyInterfaces.IEncoding.hex,
                "value":     document.publicKeyHex,
                "certainty": 1
            }],
            "chargingSessions": [{
                "@id":                  transactionId,
                "@context":             PCDF_SESSION_CONTEXT,
                "begin":                data.startTime,
                "end":                  data.stopTime,
                "internalSessionId":    String(data.chargingSessionCounter),
                "EVSEId":               virtualEVSEId,
                "meterId":              meterId,
                "authorizationStart": {
                    "@id":   data.session.idTag,
                    "type":  data.session.idTagType
                },
                "measurements": [{
                    "energyMeterId":  meterId,
                    "name":           "ENERGY_TOTAL",
                    "obis":           PCDF_PREFIX,
                    "unit":           data.readingUnit,
                    "scale":          -3,
                    "signatureInfos": {
                        "hash":       chargyInterfaces.CryptoHashAlgorithms.SHA256,
                        "algorithm":  chargyInterfaces.CryptoAlgorithms.ECC,
                        "curve":      chargyInterfaces.IECCurves.secp256r1,
                        "format":     chargyInterfaces.SignatureFormats.DER,
                        "encoding":   chargyInterfaces.IEncoding.hex
                    },
                    "values": [{
                        "timestamp":     data.stopTime,
                        "value":         data.readingValue,
                        "statusMeter":   data.stopPresent ? "G" : "E",
                        "signatures":    [ data.signature ],
                        "pcdfDocument":  document,
                        "result": {
                            "status": document.validationStatus
                        }
                    }]
                }]
            }],
            "certainty": 1
        };

    }

}

function parsePCDFTimestamp(value:   string,
                            field:   string,
                            errors:  Array<string>): Date | undefined {

    if (!/^\d{12}$/.test(value))
    {
        errors.push("Corrupt time information: " + field);
        return undefined;
    }

    const year   = Number.parseInt(value.substring( 0,  2), 10);
    const month  = Number.parseInt(value.substring( 2,  4), 10);
    const day    = Number.parseInt(value.substring( 4,  6), 10);
    const hour   = Number.parseInt(value.substring( 6,  8), 10);
    const minute = Number.parseInt(value.substring( 8, 10), 10);
    const second = Number.parseInt(value.substring(10, 12), 10);

    if (year   < 19 ||
        month  <  1 || month > 12 ||
        day    <  1 || day   > 31 ||
        hour   > 23 ||
        minute > 59 ||
        second > 59)
    {
        errors.push("Corrupt time information: " + field);
        return undefined;
    }

    const timestamp = new Date(Date.UTC(2000 + year, month - 1, day, hour, minute, second));

    if (timestamp.getUTCFullYear() !== 2000 + year ||
        timestamp.getUTCMonth()    !== month - 1   ||
        timestamp.getUTCDate()     !== day         ||
        timestamp.getUTCHours()    !== hour        ||
        timestamp.getUTCMinutes()  !== minute      ||
        timestamp.getUTCSeconds()  !== second)
    {
        errors.push("Corrupt time information: " + field);
        return undefined;
    }

    return timestamp;

}

function parsePCDFDuration(value:   string,
                           errors:  Array<string>): number | undefined {

    if (!/^\d{6}$/.test(value))
    {
        errors.push("Charging duration is invalid");
        return undefined;
    }

    const hours   = Number.parseInt(value.substring(0, 2), 10);
    const minutes = Number.parseInt(value.substring(2, 4), 10);
    const seconds = Number.parseInt(value.substring(4, 6), 10);

    if (minutes > 59 || seconds > 59)
    {
        errors.push("Charging duration is invalid");
        return undefined;
    }

    return hours * 3600 + minutes * 60 + seconds;

}

function parsePCDFFlag(value:   string,
                       field:   string,
                       errors:  Array<string>): boolean | undefined {

    if (value === "0")
        return false;

    if (value === "1")
        return true;

    errors.push(field + " must be 0 or 1");

    return undefined;

}

function parsePCDFInteger(value:   string,
                          field:   string,
                          errors:  Array<string>): number | undefined {

    if (!/^\d+$/.test(value))
    {
        errors.push(field + " must be an integer");
        return undefined;
    }

    return Number.parseInt(value, 10);

}

function parsePCDFReadingValue(value:   string,
                               errors:  Array<string>): { value: Decimal; unit: string } | undefined {

    const match = value.match(/^(\d{4})\.(\d{3})\*kWh$/);

    if (match == null)
    {
        errors.push("Session information is invalid");
        return undefined;
    }

    return {
        value: new Decimal(String(match[1]) + "." + String(match[2])),
        unit:  "kWh"
    };

}

function parsePCDFSessionInfo(value:   string,
                              errors:  Array<string>): IPCDFSessionInfo | undefined {

    const parts = value.split("*");

    if (parts.length !== 3)
    {
        errors.push("Session information is invalid");
        return undefined;
    }

    const idTag         = parts[0] ?? "";
    const idTagType     = parts[1] ?? "";
    const transactionId = parts[2] ?? "";

    if (idTag.length < 1 ||
        idTag.length > 36 ||
        idTagType.length !== 1 ||
        !/^[1-5]$/.test(idTagType) ||
        transactionId.length < 1 ||
        transactionId.length > 36 ||
        value.length < 5 ||
        value.length > 75)
    {
        errors.push("Session information is invalid");
        return undefined;
    }

    return {
        idTag:          idTag,
        idTagType:      idTagType,
        transactionId:  transactionId
    };

}

function hexToBytes(hex:           string,
                    errorMessage:  string): Uint8Array {

    const normalized = hex.replace(/\s+/g, "").toLowerCase();

    if (normalized.length === 0 ||
        normalized.length % 2 !== 0 ||
        !/^[0-9a-f]+$/.test(normalized))
    {
        throw new Error(errorMessage);
    }

    const bytes = new Uint8Array(normalized.length / 2);

    for (let i = 0; i < normalized.length; i += 2)
        bytes[i / 2] = Number.parseInt(normalized.substring(i, i + 2), 16);

    return bytes;

}

function readDERLength(bytes: Uint8Array,
                       getOffset: () => number,
                       setOffset: (offset: number) => void): number {

    let offset = getOffset();
    const b    = bytes[offset++];

    if (b == null)
        throw new Error("Invalid signature");

    if ((b & 0x80) === 0)
    {
        setOffset(offset);
        return b;
    }

    const octets = b & 0x7f;

    if (octets < 1 || octets > 2 || offset + octets > bytes.length)
        throw new Error("Invalid signature");

    let length = 0;

    for (let i = 0; i < octets; i++)
    {
        const value = bytes[offset++];
        if (value == null)
            throw new Error("Invalid signature");

        length = (length << 8) + value;
    }

    setOffset(offset);
    return length;

}

function readDERInteger(bytes: Uint8Array,
                        getOffset: () => number,
                        setOffset: (offset: number) => void): string {

    let offset = getOffset();

    if (bytes[offset++] !== 0x02)
        throw new Error("Invalid signature");

    const length = readDERLength(bytes, () => offset, newOffset => offset = newOffset);

    if (length < 1 || offset + length > bytes.length)
        throw new Error("Invalid signature");

    const value = bytes.slice(offset, offset + length);
    offset += length;
    setOffset(offset);

    let hex = Array.from(value).
                    map(byte => byte.toString(16).padStart(2, "0")).
                    join("").
                    replace(/^00+/, "");

    if (hex.length === 0)
        hex = "0";

    return hex;

}
