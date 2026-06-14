/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
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

import { Chargy }                     from './chargy'
import { ACrypt }                     from './ACrypt'
import * as chargyInterfaces          from './interfaces/chargyInterfaces'
import * as chargeTransparencyRecord  from './interfaces/IChargeTransparencyRecord'
import * as chargyLib                 from './chargyLib'


export interface IEMHMeasurementValue extends chargeTransparencyRecord.IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

export interface IEMHCrypt01Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  string,
    meterId?:                      string,
    meter?:                        chargyInterfaces.IMeter,
    timestamp?:                    string,
    infoStatus?:                   string,
    secondsIndex?:                 string,
    paginationId?:                 string,
    obis?:                         string,
    unitEncoded?:                  string,
    scale?:                        string,
    value?:                        string,
    logBookIndex?:                 string,
    authorizationStart?:           string,
    authorizationStop?:            string,
    authorizationStartTimestamp?:  string,
    publicKey?:                    string,
    publicKeyFormat?:              string,
    publicKeySignatures?:          Array<unknown>,
    signature?:                    chargyInterfaces.ISignatureRS
}


export class EMHCrypt01 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p192');

    constructor(chargy:  Chargy) {
        super("ECC secp192r1",
              chargy);
    }


    async VerifyChargingSession(chargingSession: chargeTransparencyRecord.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        let sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSessionFormat;

        {
            for (const measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values.length > 1)
                {

                    // Validate...
                    for (const measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IEMHMeasurementValue);
                    }


                    // Find an overall result...
                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;

                    for (const measurementValue of measurement.values)
                    {
                        if (sessionResult                   === chargyInterfaces.SessionVerificationResult.ValidSignature &&
                            measurementValue.result?.status !== chargyInterfaces.VerificationResult.ValidSignature)
                        {
                            sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSignature;
                        }
                    }

                }

                else
                    sessionResult = chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }
        }

        return {
            status:    sessionResult,
            certainty: 1
        }

    }

    async VerifyMeasurement(measurementValue: IEMHMeasurementValue): Promise<IEMHCrypt01Result>
    {

        function setResult(verificationResult: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        if (measurementValue.measurement                 === undefined ||
            measurementValue.measurement.chargingSession === undefined)
        {
            return {
                status: chargyInterfaces.VerificationResult.InvalidMeasurement
            }
        }

        measurementValue.method = this;

        const buffer        = new ArrayBuffer(320);
        const cryptoBuffer  = new DataView(buffer);

        const cryptoResult:IEMHCrypt01Result = {
            status:                       chargyInterfaces.VerificationResult.InvalidSignature,
            meterId:                      chargyLib.SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                   0),
            timestamp:                    chargyLib.SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                  10),
            infoStatus:                   chargyLib.SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                 14, false),
            secondsIndex:                 chargyLib.SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                               15, true),
            paginationId:                 chargyLib.SetHex        (cryptoBuffer, measurementValue.paginationId,                                               19, true),
            obis:                         chargyLib.SetHex        (cryptoBuffer, chargyLib.OBIS2Hex(measurementValue.measurement.obis),                       23, false),
            unitEncoded:                  chargyLib.SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded ?? 0,                               29),
            scale:                        chargyLib.SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                          30),
            value:                        chargyLib.SetUInt64D    (cryptoBuffer, measurementValue.value,                                                      31, true),
            logBookIndex:                 chargyLib.SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                               39, false),
            authorizationStart:           chargyLib.SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],      41),
            authorizationStartTimestamp:  chargyLib.SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp,  169)
        };

        const firstSignature = measurementValue.signatures?.[0];
        if (firstSignature != null)
        {

            const signatureExpected = firstSignature as chargyInterfaces.ISignatureRS;

            try
            {

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos?.algorithm,
                    format:     measurementValue.measurement.signatureInfos?.format,
                    r:          signatureExpected.r,
                    s:          signatureExpected.s
                };

                // Only the first 24 bytes/192 bits are used!
                cryptoResult.sha256value = (await chargyLib.sha256(cryptoBuffer)).substring(0, 48);


                const meter = this.chargy.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoResult.meter = meter;

                    if (meter.publicKeys != null && meter.publicKeys.length > 0)
                    {

                        try
                        {

                            cryptoResult.publicKey            = meter.publicKeys[0]?.value?.toLowerCase();
                            cryptoResult.publicKeyFormat      = meter.publicKeys[0]?.format;
                            cryptoResult.publicKeySignatures  = meter.publicKeys[0]?.signatures;

                            try
                            {

                                if (this.curve.keyFromPublic(cryptoResult.publicKey ?? "", 'hex').
                                               verify       (cryptoResult.sha256value,
                                                             cryptoResult.signature))
                                {
                                    return setResult(chargyInterfaces.VerificationResult.ValidSignature);
                                }

                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);

                            }
                            catch
                            {
                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
                            }

                        }
                        catch
                        {
                            return setResult(chargyInterfaces.VerificationResult.InvalidPublicKey);
                        }

                    }

                    else
                        return setResult(chargyInterfaces.VerificationResult.PublicKeyNotFound);

                }

                else
                    return setResult(chargyInterfaces.VerificationResult.EnergyMeterNotFound);

            }
            catch
            {
                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
            }

        }

        return {} as IEMHCrypt01Result;

    }

    async ViewMeasurement(measurementValue:      IEMHMeasurementValue,
                          errorDiv:              HTMLDivElement,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement) : Promise<Error | undefined>
    {

        if (measurementValue.measurement                              === undefined ||
            measurementValue.measurement.chargingSession              === undefined ||
            measurementValue.measurement.chargingSession.authorizationStart.timestamp === undefined)
        {
            return new Error("Invalid measurement!");
        }

        const result = measurementValue.result as IEMHCrypt01Result;

        //#region Headline / Introduction

        introDiv.innerHTML = this.chargy.GetLocalizedMessage("The following data of the charging session is relevant for metrological and legal metrological purposes and therefore part of the digital signature").
                                        replace("{methodName}",       "EMHCrypt01").
                                        replace("{cryptoAlgorithm}",   this.description);

        //#endregion


        //#region Plain text

        {

            if (PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement.children[0] != undefined)
            {
                PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (320 Bytes, hex)";
            }

            PlainTextDiv.style.fontFamily  = "";
            PlainTextDiv.style.whiteSpace  = "";
            PlainTextDiv.style.maxHeight   = "";
            PlainTextDiv.style.overflowY   = "";

            this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                                     result.meterId                                         || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",              chargyLib.UTC2human(measurementValue.timestamp),                                                result.timestamp                                       || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Status",                   chargyLib.hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
                                                        this.DecodeStatus(measurementValue.infoStatus).join("<br />") + "</span>",                      result.infoStatus                                      || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                                  result.secondsIndex                                    || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                                    result.paginationId                                    || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",            measurementValue.measurement.obis,                                                              result.obis                                            || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded ?? 0,                                                  result.unitEncoded                                     || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                             result.scale                                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                 measurementValue.value.toString() + " Wh",                                                      result.value                                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                                         result.logBookIndex                                    || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",                chargyLib.pad(result.authorizationStart,          128) || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierungszeitpunkt",  chargyLib.UTC2human(measurementValue.measurement.chargingSession.authorizationStart.timestamp), chargyLib.pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, PlainTextDiv);

        }

        //#endregion

        //#region Hashed plain text

        {

            if (HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement.children[0] != undefined)
            {
                HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text (SHA256, 24 bytes, hex)";
            }

            HashedPlainTextDiv.innerHTML                                 = result.sha256value?.match(/.{1,8}/g)?.join(" ") ?? "";

        }

        //#endregion

        //#region Public Key

        if (result.publicKey != null &&
            result.publicKey != "")
        {

            if (PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[0] != undefined)
            {
                PublicKeyDiv.parentElement.children[0].innerHTML       = "Public Key (" +
                                                                         (result.publicKeyFormat
                                                                             ? result.publicKeyFormat + ", "
                                                                             : "") +
                                                                         "hex)";
            }

            if (!chargyLib.IsNullOrEmpty(result.publicKey))
                PublicKeyDiv.innerHTML                                 = result.publicKey.startsWith("04") // Add some space after '04' to avoid confused customers
                                                                            ? "<span class=\"leadingFour\">04</span> "
                                                                                + (result.publicKey.substring(2).match(/.{1,8}/g)?.join(" ") ?? "")
                                                                            :   (result.publicKey.match(/.{1,8}/g)?.join(" ") ?? "");


            //#region Public key signatures

            if (PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[3] != undefined)
            {
                PublicKeyDiv.parentElement.children[3].innerHTML = "";
            }

            if (result.publicKeySignatures) {

                for (const signature of result.publicKeySignatures)
                {

                    try
                    {

                        const signatureDiv = PublicKeyDiv.parentElement?.children[3]?.appendChild(document.createElement('div'));

                        if (signatureDiv)
                        {

                            signatureDiv.classList.add("signature");

                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(
                                                               measurementValue.measurement.chargingSession.chargingStation,
                                                               measurementValue.measurement.chargingSession.EVSE,
                                                               measurementValue.measurement.chargingSession.EVSE?.meters[0],
                                                               measurementValue.measurement.chargingSession.EVSE?.meters[0]?.publicKeys?.[0],
                                                               signature
                                                           );

                            signatureDiv.onclick  = () => {
                                this.chargy.showPKIDetails({});
                            }

                        }

                    }
                    catch (exception)
                    {
                        console.error("Error while checking public key signature: " + (exception instanceof Error ? exception.message : String(exception)));
                    }

                }

            }

            //#endregion

        }

        //#endregion

        //#region Signature expected

        if (result.signature != null)
        {

            if (SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement.children[0] != undefined)
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";
            }

            if (result.signature.r && result.signature.s)
                SignatureExpectedDiv.innerHTML                            = "r: " + (result.signature.r.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "") + "<br />" +
                                                                            "s: " + (result.signature.s.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "");

            else if (result.signature.value)
                SignatureExpectedDiv.innerHTML                            = result.signature.value.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

        }

        //#endregion


        //#region Signature check

        {
            switch (result.status)
            {

                case chargyInterfaces.VerificationResult.UnknownCTRFormat:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                    break;

                case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                    break;

                case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case chargyInterfaces.VerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case chargyInterfaces.VerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

                case chargyInterfaces.VerificationResult.ValidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                    break;


                default:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

            }
        }

        //#endregion

    }


    //#region Helper methods

    private DecodeStatus(statusValue: string) : Array<string>
    {

        const statusArray:string[] = [];

        try
        {

            const status = parseInt(statusValue);

            if ((status &  1) ==  1)
                statusArray.push("Fehler erkannt");

            if ((status &  2) ==  2)
                statusArray.push("Synchrone Messwertübermittlung");

            // Bit 3 is reserved!

            if ((status &  8) ==  8)
                statusArray.push("System-Uhr ist synchron");
            else
                statusArray.push("System-Uhr ist nicht synchron");

            if ((status & 16) == 16)
                statusArray.push("Rücklaufsperre aktiv");

            if ((status & 32) == 32)
                statusArray.push("Energierichtung -A");

            if ((status & 64) == 64)
                statusArray.push("Magnetfeld erkannt");

        }
        catch
        {
            statusArray.push("Invalid status!");
        }

        return statusArray;

    }

    //#endregion

}
