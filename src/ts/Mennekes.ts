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

import type { Chargy }        from './chargy'
import { ACrypt }             from './ACrypt'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import Decimal                from 'decimal.js';

export const MENNEKES_EDL40_XMLNS = "http://www.mennekes.de/Mennekes.EdlVerification.xsd";
export const MENNEKES_EDL40_OBIS  = "1-0:1.17.0*255";

export interface IMennekesMeasurement {
    timestampCustomerIdent?:  string;
    timestamp:                string;
    signature:                string;
    eventCounter:             number;
    meterStatus:              number;
    value:                    number;
    scaler:                   number;
    pagination:               number;
    secondIndex:              number;
}

export interface IMennekesChargingProcess {
    serverId:                 string;
    publicKey:                string;
    meteringPoint?:           string;
    siteAddress?:             chargyInterfaces.IAddress;
    customerIdent:            string;
    timestampCustomerIdent:   string;
    measurementStart:         IMennekesMeasurement;
    measurementEnd:           IMennekesMeasurement;
}

export interface IMennekesBilling {
    chargingProcesses:        IMennekesChargingProcess[];
}

export interface IMennekesMeasurementValue extends chargyInterfaces.IMeasurementValue {
    eventCounter:             number;
    meterStatusNumber:        number;
    originalSignature:        string;
    timestampCustomerIdent?:  string;
    measurement:              IMennekesChargyMeasurement;
}

export interface IMennekesChargyMeasurement extends chargyInterfaces.IMeasurement {
    serverId:                 string;
    publicKey:                string;
    customerIdent:            string;
    timestampCustomerIdent:   string;
    values:                   IMennekesMeasurementValue[];
}

export interface IMennekesCrypt01Result extends chargyInterfaces.ICryptoResult {
    hashValue?:               string;
    signedData?:              string;
    publicKey?:               string;
    publicKeyFormat?:         string;
    signature?:               chargyInterfaces.ISignatureRS;
    serverId?:                string;
    timestamp?:               string;
    meterStatus?:             string;
    secondsIndex?:            string;
    pagination?:              string;
    obis?:                    string;
    unitEncoded?:             string;
    scaler?:                  string;
    value?:                   string;
    logBytes?:                string;
    customerIdent?:           string;
    timestampCustomerIdent?:  string;
}

export class Mennekes {

    private readonly chargy: Chargy;

    constructor(chargy: Chargy) {
        this.chargy = chargy;
    }

    //#region tryToParseMennekesXML(XMLDocument)

    public async tryToParseMennekesXML(XMLDocument: Document) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            const chargingProcesses = extractMennekesChargingProcesses(XMLDocument);

            if (chargingProcesses.length === 0)
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                    certainty: 0
                };

            return this.toChargeTransparencyRecord(chargingProcesses);

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

    }

    //#endregion

    private toChargeTransparencyRecord(chargingProcesses: IMennekesChargingProcess[]): chargyInterfaces.IChargeTransparencyRecord {

        const sessions = chargingProcesses.map((chargingProcess, index) => this.toChargingSession(chargingProcess, index));

        const ctr: chargyInterfaces.IChargeTransparencyRecord = {
            "@id":              sessions[0]?.["@id"] ?? "",
            "@context":         "https://open.charging.cloud/contexts/CTR+json",
            "begin":            sessions[0]?.begin,
            "end":              sessions[sessions.length - 1]?.end,
            "description": {
                "de":           "Alle Ladevorgaenge",
                "en":           "All charging sessions"
            },
            "contract": {
                "@id":          chargingProcesses[0]?.customerIdent ?? ""
            },
            "chargingPools": [
                {
                    "@id":                 "DE*GEF*POOL*MENNEKES*1",
                    "description":         { "en": "Mennekes EDL40 charging pool" },
                    "chargingStations":    chargingProcesses.map((chargingProcess, index) => this.toChargingStation(chargingProcess, index))
                }
            ],
            "chargingSessions": sessions,
            "certainty":        1,
            "status":           chargyInterfaces.SessionVerificationResult.Unvalidated
        };

        return ctr;

    }

    private toChargingStation(chargingProcess: IMennekesChargingProcess,
                              index:           number): chargyInterfaces.IChargingStation {

        const chargingStationId = "DE*GEF*STATION*MENNEKES*" + String(index + 1);
        const evseId            = this.evseId(chargingProcess, index);
        const meterId           = this.meterId(chargingProcess);

        return {
            "@id":          chargingStationId,
            "description":  { "en": "Mennekes EDL40 charging station" },
            "manufacturer": "MENNEKES",
            "address":      chargingProcess.siteAddress,
            "EVSEs": [
                {
                    "@id":        evseId,
                    "meters": [
                        {
                            "@id":             meterId,
                            "manufacturer":    "MENNEKES",
                            "signatureFormat": "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/MennekesCrypt01",
                            "publicKeys": [
                                {
                                    "value":     chargingProcess.publicKey,
                                    "algorithm": chargyInterfaces.IECCurves.secp192r1,
                                    "format":    chargyInterfaces.PublicKeyFormats.XY,
                                    "encoding":  chargyInterfaces.IEncoding.hex
                                }
                            ]
                        }
                    ]
                }
            ]
        };

    }

    private toChargingSession(chargingProcess: IMennekesChargingProcess,
                              index:           number): chargyInterfaces.IChargingSession {

        const startMeasurement = chargingProcess.measurementStart;
        const endMeasurement   = chargingProcess.measurementEnd;
        const meterId          = this.meterId(chargingProcess);
        const sessionId        = chargingProcess.serverId + "-" + String(startMeasurement.pagination) + "-" + String(endMeasurement.pagination);

        return {
            "@id":                 sessionId,
            "@context":            "https://open.charging.cloud/contexts/SessionSignatureFormats/MennekesCrypt01+json",
            "begin":               startMeasurement.timestamp,
            "end":                 endMeasurement.timestamp,
            "internalSessionId":   sessionId,
            "EVSEId":              this.evseId(chargingProcess, index),
            "meterId":             meterId,

            "authorizationStart": {
                "@id":             chargingProcess.customerIdent,
                "timestamp":       chargingProcess.timestampCustomerIdent
            },

            "measurements": [
                {
                    "energyMeterId":              meterId,
                    "@context":                   "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/MennekesCrypt01+json",
                    "name":                       chargyLib.OBIS2MeasurementName(MENNEKES_EDL40_OBIS),
                    "obis":                       MENNEKES_EDL40_OBIS,
                    "unit":                       "Wh",
                    "unitEncoded":                30,
                    "scale":                      startMeasurement.scaler,
                    "serverId":                   chargingProcess.serverId,
                    "publicKey":                  chargingProcess.publicKey,
                    "customerIdent":              chargingProcess.customerIdent,
                    "timestampCustomerIdent":     chargingProcess.timestampCustomerIdent,
                    "signatureInfos": {
                        "hash":                   chargyInterfaces.CryptoHashAlgorithms.SHA256,
                        "hashTruncation":         24,
                        "algorithm":              chargyInterfaces.CryptoAlgorithms.ECC,
                        "curve":                  chargyInterfaces.IECCurves.secp192r1,
                        "format":                 chargyInterfaces.SignatureFormats.RS,
                        "encoding":               chargyInterfaces.IEncoding.hex
                    },
                    "values": [
                        toMennekesMeasurementValue(startMeasurement),
                        toMennekesMeasurementValue(endMeasurement)
                    ]
                } as IMennekesChargyMeasurement
            ]
        };

    }

    private evseId(chargingProcess: IMennekesChargingProcess,
                   index:           number): string {

        return chargingProcess.meteringPoint ?? "DE*GEF*EVSE*MENNEKES*" + String(index + 1);

    }

    private meterId(chargingProcess: IMennekesChargingProcess): string {
        return chargingProcess.serverId;
    }

}

export class MennekesCrypt01 extends ACrypt {

    constructor(chargy:  Chargy) {
        super("Mennekes EDL40",
              chargy);
    }

    async VerifyChargingSession(chargingSession: chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        let sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSessionFormat;

        if (chargingSession.measurements)
        {
            for (const measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                if (measurement.values && measurement.values.length >= 2)
                {

                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;

                    for (const measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IMennekesMeasurementValue);

                        if (measurementValue.result?.status !== chargyInterfaces.VerificationResult.ValidSignature)
                            sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSignature;
                    }

                    if (sessionResult === chargyInterfaces.SessionVerificationResult.ValidSignature)
                    {
                        const lawErrors = validateMennekesLawConformity(measurement.values as IMennekesMeasurementValue[]);

                        if (lawErrors.length > 0)
                        {
                            measurement.verificationResult = {
                                status:  chargyInterfaces.VerificationResult.InvalidMeasurement,
                                errors:  lawErrors
                            };

                            sessionResult = chargyInterfaces.SessionVerificationResult.InvalidMeasurement;
                        }
                        else
                        {
                            measurement.verificationResult = {
                                status: chargyInterfaces.VerificationResult.ValidSignature
                            };
                        }
                    }

                }
                else
                    sessionResult = chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }
        }

        return {
            status:    sessionResult,
            certainty: .5
        }

    }

    async VerifyMeasurement(measurementValue: IMennekesMeasurementValue): Promise<IMennekesCrypt01Result>
    {

        function setResult(verificationResult: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        const measurement = measurementValue.measurement;

        const cryptoResult: IMennekesCrypt01Result = {
                  status:                chargyInterfaces.VerificationResult.InvalidSignature,
                  serverId:              measurement.serverId,
                  publicKey:             measurement.publicKey,
                  publicKeyFormat:       chargyInterfaces.PublicKeyFormats.XY,
                  signature:             measurementValue.signatures?.[0] as chargyInterfaces.ISignatureRS,
                  timestamp:             measurementValue.timestamp,
                  meterStatus:           String(measurementValue.meterStatusNumber),
                  secondsIndex:          String(measurementValue.secondsIndex ?? ""),
                  pagination:            String(measurementValue.paginationId ?? ""),
                  obis:                  MENNEKES_EDL40_OBIS,
                  unitEncoded:           "30",
                  scaler:                String(measurement.scale),
                  value:                 measurementValue.value.toString(),
                  customerIdent:         measurement.customerIdent,
                  timestampCustomerIdent: measurementValue.timestampCustomerIdent ?? measurement.timestampCustomerIdent
              };

        try
        {

            const meter = this.chargy.GetMeter(measurement.energyMeterId);
            if (meter == null)
                return setResult(chargyInterfaces.VerificationResult.EnergyMeterNotFound);

            if (meter.publicKeys == null || meter.publicKeys.length === 0)
                return setResult(chargyInterfaces.VerificationResult.PublicKeyNotFound);

            const signatureExpected = measurementValue.signatures?.[0] as chargyInterfaces.ISignatureRS | undefined;
            if (signatureExpected?.r == null || signatureExpected.s == null)
                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);

            const signedData = buildMennekesSignatureData(
                                   {
                                       serverId:                 measurement.serverId,
                                       publicKey:                measurement.publicKey,
                                       customerIdent:            measurement.customerIdent,
                                       timestampCustomerIdent:   measurement.timestampCustomerIdent,
                                       measurementStart:         {} as IMennekesMeasurement,
                                       measurementEnd:           {} as IMennekesMeasurement
                                   },
                                   {
                                       timestampCustomerIdent:   measurementValue.timestampCustomerIdent,
                                       timestamp:                measurementValue.timestamp,
                                       signature:                measurementValue.originalSignature,
                                       eventCounter:             measurementValue.eventCounter,
                                       meterStatus:              measurementValue.meterStatusNumber,
                                       value:                    measurementValue.value.toNumber(),
                                       scaler:                   measurement.scale,
                                       pagination:               Number(measurementValue.paginationId),
                                       secondIndex:              measurementValue.secondsIndex ?? 0
                                   }
                               );

            cryptoResult.signedData = bytesToHex(signedData);
            cryptoResult.logBytes   = cryptoResult.signedData.substring(78, 82);

            const signedDataBuffer = signedData.buffer.slice(
                signedData.byteOffset,
                signedData.byteOffset + signedData.byteLength
            );

            cryptoResult.hashValue = (await chargyLib.sha256(new DataView(signedDataBuffer))).substring(0, 48);

            const publicKey = cleanHex(meter.publicKeys[0]?.value ?? measurement.publicKey);

            if (publicKey.length !== 96)
                return setResult(chargyInterfaces.VerificationResult.InvalidPublicKey);

            const result = this.curve192r1.
                               keyFromPublic("04" + publicKey, "hex").
                               verify(cryptoResult.hashValue.toUpperCase(), {
                                   r: signatureExpected.r,
                                   s: signatureExpected.s
                               }
                           );

            return setResult(
                       result
                           ? chargyInterfaces.VerificationResult.ValidSignature
                           : chargyInterfaces.VerificationResult.InvalidSignature
                   );

        }
        catch
        {
            return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
        }

    }

    async ViewMeasurement(measurementValue:      IMennekesMeasurementValue,
                          errorDiv:              HTMLDivElement,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)
    {

        const result = measurementValue.result as IMennekesCrypt01Result;

        if (introDiv)
            introDiv.innerHTML = this.chargy.GetLocalizedMessage("The following data of the charging session is relevant for metrological and legal metrological purposes and therefore part of the digital signature").
                                             replace("{methodName}",       "MennekesCrypt01").
                                             replace("{cryptoAlgorithm}",   this.description);

        if (PlainTextDiv)
        {
            if (PlainTextDiv.parentElement?.children[0])
                PlainTextDiv.parentElement.children[0].innerHTML = this.chargy.GetLocalizedMessage("Plain text") + " (320 Bytes, hex)";

            PlainTextDiv.innerHTML = result.signedData?.match(/.{1,8}/g)?.join(" ") ?? "";
        }

        if (HashedPlainTextDiv)
        {
            if (HashedPlainTextDiv.parentElement?.children[0])
                HashedPlainTextDiv.parentElement.children[0].innerHTML = this.chargy.GetLocalizedMessage("Hashed plain text") + " (SHA256 cropped to 24 Bytes, hex)";

            HashedPlainTextDiv.innerHTML = result.hashValue?.match(/.{1,8}/g)?.join(" ") ?? "";
        }

        if (PublicKeyDiv)
        {
            if (PublicKeyDiv.parentElement?.children[0])
                PublicKeyDiv.parentElement.children[0].innerHTML = this.chargy.GetLocalizedMessage("Public Key") + " (secp192r1, xy, hex)";

            PublicKeyDiv.innerHTML = result.publicKey?.match(/.{1,8}/g)?.join(" ") ?? "";
        }

        if (SignatureExpectedDiv)
        {
            if (SignatureExpectedDiv.parentElement?.children[0])
                SignatureExpectedDiv.parentElement.children[0].innerHTML = this.chargy.GetLocalizedMessage("Expected signature") + " (rs, hex)";

            SignatureExpectedDiv.innerHTML = result.signature?.r && result.signature.s
                                                 ? "r: " + result.signature.r.toLowerCase().match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                   "s: " + result.signature.s.toLowerCase().match(/.{1,8}/g)?.join(" ")
                                                 : "";
        }

        if (SignatureCheckDiv)
            SignatureCheckDiv.innerHTML = result.status === chargyInterfaces.VerificationResult.ValidSignature
                                              ? '<i class="fas fa-check-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Valid signature") + '</div>'
                                              : '<i class="fas fa-times-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Invalid signature") + '</div>';

        void errorDiv;
        void infoDiv;

    }

}

export function extractMennekesChargingProcesses(XMLDocument: Document): IMennekesChargingProcess[] {

    const root = XMLDocument.documentElement;

    if (root == null)
        return [];

    if (isLocalName(root, "ChargingProcess"))
        return [ parseChargingProcessElement(root) ];

    if (isLocalName(root, "Billing"))
        return chargyLib.getElementsByLocalName(root, "ChargingProcess").
                            map(chargingProcessElement => parseChargingProcessElement(chargingProcessElement));

    return [];

}

export function parseMennekesXMLDocument(XMLDocument: Document): IMennekesBilling | IMennekesChargingProcess {

    const chargingProcesses = extractMennekesChargingProcesses(XMLDocument);

    if (chargingProcesses.length === 0)
        throw new Error("No Mennekes ChargingProcess element found!");

    if (isLocalName(XMLDocument.documentElement, "ChargingProcess"))
        return chargingProcesses[0]!;

    return {
        chargingProcesses
    };

}

export function buildMennekesSignatureData(chargingProcess:  IMennekesChargingProcess,
                                           measurement:      IMennekesMeasurement): Uint8Array {

    const signatureBytes = hexToBytes(measurement.signature);

    if (signatureBytes.length !== 48 && signatureBytes.length !== 50)
        throw new Error("Mennekes signatures must contain 48 or 50 bytes!");

    const signedData = new Uint8Array(320);

    setBytes(signedData, 0,   hexToBytes(chargingProcess.serverId), 10);
    setBytes(signedData, 10,  timestampToMennekesBytes(measurement.timestamp), 4);
    signedData[14] = measurement.meterStatus & 0xFF;
    setBytes(signedData, 15,  numberToReversedBytes(measurement.secondIndex, 4), 4);
    setBytes(signedData, 19,  numberToReversedBytes(measurement.pagination, 4), 4);
    setBytes(signedData, 23,  new Uint8Array([ 0x01, 0x00, 0x01, 0x11, 0x00, 0xFF ]), 6);
    signedData[29] = 30;
    signedData[30] = measurement.scaler & 0xFF;
    setBytes(signedData, 31,  numberToReversedBytes(measurement.value, 8), 8);

    if (signatureBytes.length > 48)
        setBytes(signedData, 39, signatureBytes.subarray(48, 50), 2);
    else
        setBytes(signedData, 39, numberToBytesBE(measurement.eventCounter, 2), 2);

    const customerIdentBytes = hexToBytes(chargingProcess.customerIdent);
    if (customerIdentBytes.length > 128)
        throw new Error("Mennekes CustomerIdent must not exceed 128 bytes!");

    setBytes(signedData, 41,  customerIdentBytes, customerIdentBytes.length);
    setBytes(signedData, 169, timestampToMennekesBytes(measurement.timestampCustomerIdent ?? chargingProcess.timestampCustomerIdent), 4);

    return signedData;

}

export function dateToMennekesLocalEpochSeconds(isoTimestamp: string): number {

    const date = new Date(isoTimestamp);

    if (!Number.isFinite(date.getTime()))
        throw new Error("Invalid Mennekes timestamp: " + isoTimestamp);

    const offsetMatch = isoTimestamp.trim().match(/([+-])(\d{2}):(\d{2})$/);

    if (offsetMatch == null)
        return Math.floor(date.getTime() / 1000);

    const sign          = offsetMatch[1] === "+" ? 1 : -1;
    const offsetSeconds = sign * (Number(offsetMatch[2]) * 3600 + Number(offsetMatch[3]) * 60);

    return Math.floor(date.getTime() / 1000) + offsetSeconds;

}

export function cleanHex(hex: string): string {
    return hex.replace(/\s+/g, "");
}

export function hexToBytes(hex: string): Uint8Array {

    const cleanedHex = cleanHex(hex);

    if (cleanedHex.length % 2 !== 0)
        throw new Error("Hex strings must have even length!");

    if (!/^[0-9a-fA-F]*$/.test(cleanedHex))
        throw new Error("Invalid hexadecimal string!");

    const bytes = new Uint8Array(cleanedHex.length / 2);

    for (let index = 0; index < cleanedHex.length; index += 2)
        bytes[index / 2] = Number.parseInt(cleanedHex.substring(index, index + 2), 16);

    return bytes;

}

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function parseChargingProcessElement(chargingProcessElement: Element): IMennekesChargingProcess {

    const siteAddressElement = child(chargingProcessElement, "SiteAddress");

    return {
        serverId:                cleanHex(requiredText(chargingProcessElement, "ServerId")),
        publicKey:               cleanHex(requiredText(chargingProcessElement, "PublicKey")),
        meteringPoint:           optionalText(chargingProcessElement, "MeteringPoint"),
        siteAddress:             siteAddressElement != null
                                     ? {
                                           "@context":  "https://open.charging.cloud/contexts/address+json",
                                           "country":   "DE",
                                           "postalCode": optionalText(siteAddressElement, "ZipCode") ?? "",
                                           "street":     optionalText(siteAddressElement, "Street"),
                                           "city":       optionalText(siteAddressElement, "Town") ?? ""
                                       }
                                     : undefined,
        customerIdent:           cleanHex(requiredText(chargingProcessElement, "CustomerIdent")),
        timestampCustomerIdent:  requiredText(chargingProcessElement, "TimestampCustomerIdent"),
        measurementStart:        parseMeasurementElement(requiredChild(chargingProcessElement, "MeasurementStart")),
        measurementEnd:          parseMeasurementElement(requiredChild(chargingProcessElement, "MeasurementEnd"))
    };

}

function parseMeasurementElement(measurementElement: Element): IMennekesMeasurement {

    return {
        timestampCustomerIdent:  optionalText(measurementElement, "TimestampCustomerIdent"),
        timestamp:               requiredText(measurementElement, "Timestamp"),
        signature:               cleanHex(requiredText(measurementElement, "Signature")),
        eventCounter:            requiredNumber(measurementElement, "EventCounter"),
        meterStatus:             requiredNumber(measurementElement, "MeterStatus"),
        value:                   requiredNumber(measurementElement, "Value"),
        scaler:                  requiredNumber(measurementElement, "Scaler"),
        pagination:              requiredNumber(measurementElement, "Pagination"),
        secondIndex:             requiredNumber(measurementElement, "SecondIndex")
    };

}

function toMennekesMeasurementValue(measurement: IMennekesMeasurement): IMennekesMeasurementValue {

    const signature = cleanHex(measurement.signature);
    const signatureForVerification = signature.length === 100
                                         ? signature.substring(0, 96)
                                         : signature;

    return {
        "timestamp":              measurement.timestamp,
        "value":                  new Decimal(measurement.value),
        "statusMeter":            String(measurement.meterStatus),
        "secondsIndex":           measurement.secondIndex,
        "paginationId":           measurement.pagination,
        "logBookIndex":           String(measurement.eventCounter),
        "eventCounter":           measurement.eventCounter,
        "meterStatusNumber":      measurement.meterStatus,
        "originalSignature":      signature,
        "timestampCustomerIdent": measurement.timestampCustomerIdent,
        "signatures": [
            {
                "algorithm":       chargyInterfaces.CryptoAlgorithms.ECC,
                "format":          chargyInterfaces.SignatureFormats.RS,
                "value":           signatureForVerification,
                "r":               signatureForVerification.substring(0, 48),
                "s":               signatureForVerification.substring(48, 96)
            }
        ],
        "errors":                 [],
        "warnings":               [],
        "method":                 undefined,
        "measurement":            undefined as unknown as IMennekesChargyMeasurement
    };

}

function validateMennekesLawConformity(measurementValues: IMennekesMeasurementValue[]): string[] {

    const errors = new Array<string>();
    const start  = measurementValues[0];
    const end    = measurementValues[measurementValues.length - 1];

    if (start == null || end == null)
        return [ "Mennekes EDL40 requires at least two measurement values." ];

    if (start.eventCounter !== end.eventCounter)
        errors.push("Event counter mismatch.");

    if (Number(start.paginationId) >= Number(end.paginationId))
        errors.push("Pagination must increase from start to end.");

    if (start.value.gt(end.value))
        errors.push("Meter value must not decrease.");

    return errors;

}

function child(parent: Element, localName: string): Element | undefined {
    return chargyLib.getDirectChildByLocalName(parent, localName);
}

function requiredChild(parent: Element, localName: string): Element {

    const element = child(parent, localName);

    if (element == null)
        throw new Error("Missing Mennekes XML element: " + localName);

    return element;

}

function optionalText(parent: Element, localName: string): string | undefined {
    return chargyLib.getTrimmedTextContent(child(parent, localName));
}

function requiredText(parent: Element, localName: string): string {

    const text = optionalText(parent, localName);

    if (text == null)
        throw new Error("Missing Mennekes XML text: " + localName);

    return text;

}

function requiredNumber(parent: Element, localName: string): number {

    const value = Number(requiredText(parent, localName));

    if (!Number.isFinite(value))
        throw new Error("Invalid Mennekes numeric XML text: " + localName);

    return value;

}

function isLocalName(element: Element | undefined | null, localName: string): boolean {
    return element?.localName === localName || element?.nodeName === localName;
}

function setBytes(target: Uint8Array,
                  offset: number,
                  source: Uint8Array,
                  length: number): void {

    if (source.length < length)
        throw new Error("Not enough bytes for Mennekes signature field!");

    target.set(source.subarray(0, length), offset);

}

function timestampToMennekesBytes(isoTimestamp: string): Uint8Array {
    return numberToReversedBytes(dateToMennekesLocalEpochSeconds(isoTimestamp), 4);
}

function numberToReversedBytes(value: number,
                               length: number): Uint8Array {

    return numberToBytesBE(value, length).reverse();

}

function numberToBytesBE(value: number,
                         length: number): Uint8Array {

    let remaining = BigInt(value);

    if (remaining < 0)
        remaining = BigInt.asUintN(length * 8, remaining);

    const bytes = new Uint8Array(length);

    for (let index = length - 1; index >= 0; index--)
    {
        bytes[index] = Number(remaining & BigInt(255));
        remaining >>= BigInt(8);
    }

    return bytes;

}
