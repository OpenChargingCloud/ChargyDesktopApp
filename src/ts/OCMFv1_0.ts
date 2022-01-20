/*
 * Copyright (c) 2018-2022 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import { Chargy }             from './chargy'
import { ACrypt }             from './ACrypt'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'

export interface IOCMFv1_0MeasurementValue extends chargyInterfaces.IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

export interface IOCMFv1_0Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  any,
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
    publicKeySignatures?:          any,
    signature?:                    chargyInterfaces.IECCSignature
}


export class OCMFv1_0 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy:  Chargy) {

        super("ECC secp192r1",
              chargy);

    }


    GenerateKeyPair()//options?: elliptic.ec.GenKeyPairOptions)
    {
        return this.curve.genKeyPair();
        // privateKey     = keypair.getPrivate();
        // publicKey      = keypair.getPublic();
        // privateKeyHEX  = privateKey.toString('hex').toLowerCase();
        // publicKeyHEX   = publicKey.encode('hex').toLowerCase();
    }


    async SignChargingSession  (chargingSession:         chargyInterfaces.IChargingSession,
                                privateKey:              any):              Promise<chargyInterfaces.ISessionCryptoResult>
    {

        return {
            status: chargyInterfaces.SessionVerificationResult.UnknownSessionFormat
        }

    }

    async VerifyChargingSession(chargingSession:   chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        var sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSessionFormat;

        if (chargingSession.measurements)
        {
            for (var measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values && measurement.values.length > 1)
                {

                    // Validate...
                    for (var measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IOCMFv1_0MeasurementValue);
                    }


                    // Find an overall result...
                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;

                    for (var measurementValue of measurement.values)
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
            status: sessionResult
        } ;

    }


    async SignMeasurement(measurementValue:  IOCMFv1_0MeasurementValue,
                          privateKey:        any): Promise<IOCMFv1_0Result>
    {

        if (measurementValue.measurement                 === undefined ||
            measurementValue.measurement.chargingSession === undefined)
        {
            return {
                status: chargyInterfaces.VerificationResult.InvalidMeasurement
            }
        }

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IOCMFv1_0Result = {
            status:                       chargyInterfaces.VerificationResult.InvalidSignature,
            meterId:                      chargyLib.SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                   0),
            timestamp:                    chargyLib.SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                  10),
            infoStatus:                   chargyLib.SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                 14, false),
            secondsIndex:                 chargyLib.SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                               15, true),
            paginationId:                 chargyLib.SetHex        (cryptoBuffer, measurementValue.paginationId,                                               19, true),
            obis:                         chargyLib.SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                           23, false),
            unitEncoded:                  chargyLib.SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                    29),
            scale:                        chargyLib.SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                          30),
            value:                        chargyLib.SetUInt64     (cryptoBuffer, measurementValue.value,                                                      31, true),
            logBookIndex:                 chargyLib.SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                               39, false),
            authorizationStart:           chargyLib.SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],      41),
            authorizationStartTimestamp:  chargyLib.SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp,  169)
        };

        // Only the first 24 bytes/192 bits are used!
        cryptoResult.sha256value  = (await chargyLib.sha256(cryptoBuffer)).substring(0, 48);

        const signature           = this.curve.keyFromPrivate(privateKey.toString('hex')).
                                               sign(cryptoResult.sha256value);

        switch (measurementValue.measurement.signatureInfos.format)
        {

            case chargyInterfaces.SignatureFormats.DER:

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    value:      signature.toDER('hex')
                };

                return cryptoResult;


            case chargyInterfaces.SignatureFormats.rs:

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    r:          signature.r,
                    s:          signature.s
                };

                return cryptoResult;

        }

    }

    async VerifyMeasurement(measurementValue:  IOCMFv1_0MeasurementValue): Promise<IOCMFv1_0Result>
    {

        function setResult(verificationResult: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        // {
        //
        //     "FV": "1.0",
        //     "GI": "SEAL AG",
        //     "GS": "1850006a",
        //     "GV": "1.34",
        //
        //     "PG": "T9289",
        //
        //     "MV": "Carlo Gavazzi",
        //     "MM": "EM340-DIN.AV2.3.X.S1.PF",
        //     "MS": "******240084S",
        //     "MF": "B4",
        //
        //     "IS": true,
        //     "IL": "TRUSTED",
        //     "IF": ["OCCP_AUTH"],
        //     "IT": "ISO14443",
        //     "ID": "56213C05",
        //
        //     "RD": [{
        //         "TM": "2019-06-26T08:57:44,337+0000 U",
        //         "TX": "B",
        //         "RV": 268.978,
        //         "RI": "1-b:1.8.0",
        //         "RU": "kWh",
        //         "RT": "AC",
        //         "EF": "",
        //         "ST": "G"
        //     }]
        //
        // }

        var reading = {

           "FV": "1.0",
           "GI": "SEAL AG",
           "GS": "1850006a",
           "GV": "1.34",

           "PG": "T9289",

           "MV": "Carlo Gavazzi",
           "MM": "EM340-DIN.AV2.3.X.S1.PF",
           "MS": "******240084S",
           "MF": "B4",

           "IS": true,
           "IL": "TRUSTED",
           "IF": ["OCCP_AUTH"],
           "IT": "ISO14443",
           "ID": "56213C05",

           "RD": [{
               "TM": "2019-06-26T08:57:44,337+0000 U",
               "TX": "B",
               "RV": 268.978,
               "RI": "1-b:1.8.0",
               "RU": "kWh",
               "RT": "AC",
               "EF": "",
               "ST": "G"
           }]

        };


        var serialized = JSON.stringify(reading);

        var cryptoResult:IOCMFv1_0Result = {
            status:                       chargyInterfaces.VerificationResult.ValidSignature,
        };

        return setResult(chargyInterfaces.VerificationResult.ValidSignature);

        // var buffer        = new ArrayBuffer(320);
        // var cryptoBuffer  = new DataView(buffer);

        // var cryptoResult:IOCMFv1_0Result = {
        //     status:                       VerificationResult.InvalidSignature,
        //     meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
        //     timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                 10),
        //     infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
        //     secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
        //     paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
        //     obis:                         SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
        //     unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
        //     scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
        //     value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true),
        //     logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                              39, false),
        //     authorizationStart:           SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],     41),
        //     authorizationStartTimestamp:  SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        // };

        // var signatureExpected = measurementValue.signatures[0] as IECCSignature;
        // if (signatureExpected != null)
        // {

        //     try
        //     {

        //         cryptoResult.signature = {
        //             algorithm:  measurementValue.measurement.signatureInfos.algorithm,
        //             format:     measurementValue.measurement.signatureInfos.format,
        //             r:          signatureExpected.r,
        //             s:          signatureExpected.s
        //         };

        //         // Only the first 24 bytes/192 bits are used!
        //         cryptoResult.sha256value = (await this.sha256(cryptoBuffer)).substring(0, 48);


        //         const meter = this.GetMeter(measurementValue.measurement.energyMeterId);
        //         if (meter != null)
        //         {

        //             cryptoResult.meter = meter;

        //             var iPublicKey = meter.publicKeys[0] as IPublicKey;
        //             if (iPublicKey != null)
        //             {

        //                 try
        //                 {

        //                     cryptoResult.publicKey            = iPublicKey.value.toLowerCase();
        //                     cryptoResult.publicKeyFormat      = iPublicKey.format;
        //                     cryptoResult.publicKeySignatures  = iPublicKey.signatures;

        //                     try
        //                     {

        //                         if (this.curve.keyFromPublic(cryptoResult.publicKey, 'hex').
        //                                        verify       (cryptoResult.sha256value,
        //                                                      cryptoResult.signature))
        //                         {
        //                             return setResult(VerificationResult.ValidSignature);
        //                         }
                                
        //                         return setResult(VerificationResult.InvalidSignature);

        //                     }
        //                     catch (exception)
        //                     {
        //                         return setResult(VerificationResult.InvalidSignature);
        //                     }

        //                 }
        //                 catch (exception)
        //                 {
        //                     return setResult(VerificationResult.InvalidPublicKey);
        //                 }

        //             }

        //             else
        //                 return setResult(VerificationResult.PublicKeyNotFound);

        //         }

        //         else
        //             return setResult(VerificationResult.EnergyMeterNotFound);

        //     }
        //     catch (exception)
        //     {
        //         return setResult(VerificationResult.InvalidSignature);
        //     }

        // }

        // return {} as IOCMFv1_0Result;

    }

    async ViewMeasurement(measurementValue:      IOCMFv1_0MeasurementValue,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)
    {

        if (measurementValue.measurement                                              === undefined ||
            measurementValue.measurement.chargingSession                              === undefined ||
            measurementValue.measurement.chargingSession.authorizationStart           === undefined ||
            measurementValue.measurement.chargingSession.authorizationStart.timestamp === undefined)
        {
            return {
                status: chargyInterfaces.VerificationResult.InvalidMeasurement
            }
        }

        const result     = measurementValue.result as IOCMFv1_0Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "OCMFCrypt01 (" + this.description + ")";

        //#region Plain text

        if (PlainTextDiv != null)
        {

            if (PlainTextDiv                           != undefined &&
                PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement.children[0] != undefined)
            {
                PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (320 Bytes, hex)";
            }

            PlainTextDiv.style.fontFamily  = "";
            PlainTextDiv.style.whiteSpace  = "";
            PlainTextDiv.style.maxHeight   = "";
            PlainTextDiv.style.overflowY   = "";

            this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                                    result.meterId                                         || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",              chargyLib.parseUTC(measurementValue.timestamp),                                                result.timestamp                                       || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Status",                   chargyLib.hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)", result.infoStatus                                      || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                                 result.secondsIndex                                    || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                                   result.paginationId                                    || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",            measurementValue.measurement.obis,                                                             result.obis                                            || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                                      result.unitEncoded                                     || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                            result.scale                                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                                result.value                                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                                        result.logBookIndex                                    || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",               chargyLib.pad(result.authorizationStart,          128) || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierungszeitpunkt",  chargyLib.parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), chargyLib.pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, PlainTextDiv);

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv != null)
        {

            if (HashedPlainTextDiv                           != undefined &&
                HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement.children[0] != undefined)
            {
                HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text (SHA256, 24 bytes, hex)";
            }

            HashedPlainTextDiv.innerHTML                                 = result.sha256value.match(/.{1,8}/g).join(" ");

        }

        //#endregion

        //#region Public Key

        if (PublicKeyDiv     != null &&
            result.publicKey != null &&
            result.publicKey != "")
        {

            if (PublicKeyDiv                           != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
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
                                                                                + result.publicKey.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                            :   result.publicKey.match(/.{1,8}/g)!.join(" ");

            //#region Public key signatures

            if (PublicKeyDiv                           != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[3] != undefined)
            {
                PublicKeyDiv.parentElement.children[3].innerHTML = "";
            }

            if (!chargyLib.IsNullOrEmpty(result.publicKeySignatures)) {

                for (const signature of result.publicKeySignatures)
                {

                    try
                    {

                        const signatureDiv = PublicKeyDiv?.parentElement?.children[3]?.appendChild(document.createElement('div'));

                        if (signatureDiv != null)
                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(measurementValue.measurement.chargingSession?.chargingStation,
                                                                                                    measurementValue.measurement.chargingSession?.EVSE,
                                                                                                    //@ts-ignore
                                                                                                    measurementValue.measurement.chargingSession.EVSE.meters[0],
                                                                                                    //@ts-ignore
                                                                                                    measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys[0],
                                                                                                    signature);

                    }
                    catch (exception)
                    { }

                }

            }

            //#endregion

        }

        //#endregion

        //#region Signature expected

        if (SignatureExpectedDiv != null && result.signature != null)
        {

            if (SignatureExpectedDiv                           != undefined &&
                SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement.children[0] != undefined)
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";
            }

            if (result.signature.r && result.signature.s)
                SignatureExpectedDiv.innerHTML                            = "r: " + result.signature.r.toLowerCase().match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                                            "s: " + result.signature.s.toLowerCase().match(/.{1,8}/g)?.join(" ");

            else if (result.signature.value)
                SignatureExpectedDiv.innerHTML                            = result.signature.value.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

        }

        //#endregion

        //#region Signature check

        if (SignatureCheckDiv != null)
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

}
