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

import { Chargy }             from './chargy.js'
import { ACrypt }             from './ACrypt.js'
import * as chargyInterfaces  from './chargyInterfaces.js'
import * as chargyLib         from './chargyLib.js'

export interface IGDFMeasurementValue extends chargyInterfaces.IMeasurementValue
{
    prevSignature:                 string,
}

export interface IGDFCrypt01Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  any,
    meterId?:                      string,
    meter?:                        chargyInterfaces.IMeter,
    timestamp?:                    string,
    obis?:                         string,
    unitEncoded?:                  string,
    scale?:                        string,
    value?:                        string,
    authorizationStart?:           string,
    authorizationStartTimestamp?:  string,
    publicKey?:                    string,
    publicKeyFormat?:              string,
    publicKeySignatures?:          any,
    signature?:                    chargyInterfaces.IECCSignature
}

export class GDFCrypt01 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy:  Chargy) {

        super("ECC secp256r1",
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

    async VerifyChargingSession(chargingSession:         chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
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
                        await this.VerifyMeasurement(measurementValue as IGDFMeasurementValue);
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


    async SignMeasurement(measurementValue:  IGDFMeasurementValue,
                          privateKey:        any): Promise<IGDFCrypt01Result>
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

        var cryptoResult:IGDFCrypt01Result = {
            status:                       chargyInterfaces.VerificationResult.InvalidSignature,
            meterId:                      chargyLib.SetText     (cryptoBuffer, measurementValue.measurement.energyMeterId,                                   0),
            timestamp:                    chargyLib.SetTimestamp(cryptoBuffer, measurementValue.timestamp,                                                  10),
            obis:                         chargyLib.SetHex      (cryptoBuffer, measurementValue.measurement.obis,                                           23, false),
            unitEncoded:                  chargyLib.SetInt8     (cryptoBuffer, measurementValue.measurement.unitEncoded,                                    29),
            scale:                        chargyLib.SetInt8     (cryptoBuffer, measurementValue.measurement.scale,                                          30),
            value:                        chargyLib.SetUInt64   (cryptoBuffer, measurementValue.value,                                                      31, true),
            authorizationStart:           chargyLib.SetHex      (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],      41),
            authorizationStartTimestamp:  chargyLib.SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp,  169)
        };

        cryptoResult.sha256value  = await chargyLib.sha256(cryptoBuffer);

        // cryptoResult.publicKey    = publicKey.encode('hex').
        //                                       toLowerCase();

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

    async VerifyMeasurement(measurementValue:  IGDFMeasurementValue): Promise<IGDFCrypt01Result>
    {

        function setResult(vr: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status     = vr;
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

        var buffer        = new ArrayBuffer(320);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IGDFCrypt01Result = {
            status:                       chargyInterfaces.VerificationResult.InvalidSignature,
            meterId:                      chargyLib.SetText     (cryptoBuffer, measurementValue.measurement.energyMeterId,                                   0),
            timestamp:                    chargyLib.SetTimestamp(cryptoBuffer, measurementValue.timestamp,                                                  10),
            obis:                         chargyLib.SetHex      (cryptoBuffer, measurementValue.measurement.obis,                                           23, false),
            unitEncoded:                  chargyLib.SetInt8     (cryptoBuffer, measurementValue.measurement.unitEncoded,                                    29),
            scale:                        chargyLib.SetInt8     (cryptoBuffer, measurementValue.measurement.scale,                                          30),
            value:                        chargyLib.SetUInt64   (cryptoBuffer, measurementValue.value,                                                      31, true),
            authorizationStart:           chargyLib.SetHex      (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],      41),
            authorizationStartTimestamp:  chargyLib.SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp,  169)
        };

        var signatureExpected = measurementValue.signatures[0] as chargyInterfaces.IECCSignature;
        if (signatureExpected != null)
        {

            try
            {

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    r:          signatureExpected.r,
                    s:          signatureExpected.s
                };

                cryptoResult.sha256value = await chargyLib.sha256(cryptoBuffer);


                const meter = this.chargy.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoResult.meter = meter;

                    if (meter.publicKeys != null && meter.publicKeys.length > 0)
                    {

                        try
                        {

                            cryptoResult.publicKey            = meter.publicKeys[0].value.toLowerCase();
                            cryptoResult.publicKeyFormat      = meter.publicKeys[0].format;
                            cryptoResult.publicKeySignatures  = meter.publicKeys[0].signatures;

                            try
                            {

                                if (this.curve.keyFromPublic(cryptoResult.publicKey, 'hex').
                                               verify       (cryptoResult.sha256value,
                                                             cryptoResult.signature))
                                {
                                    return setResult(chargyInterfaces.VerificationResult.ValidSignature);
                                }

                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);

                            }
                            catch (exception)
                            {
                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
                            }

                        }
                        catch (exception)
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
            catch (exception)
            {
                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
            }

        }

        return {} as IGDFCrypt01Result;

    }

    async ViewMeasurement(measurementValue:        chargyInterfaces.IMeasurementValue,
                          introDiv:                HTMLDivElement,
                          infoDiv:                 HTMLDivElement,
                          bufferValue:             HTMLDivElement,
                          hashedBufferValue:       HTMLDivElement,
                          publicKeyValue:          HTMLDivElement,
                          signatureExpectedValue:  HTMLDivElement,
                          signatureCheckValue:     HTMLDivElement)
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

        const result    = measurementValue.result as IGDFCrypt01Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "GDFCrypt01 (" + this.description + ")";

        this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                                    result.meterId                     || "",  infoDiv, bufferValue);
        this.CreateLine("Zeitstempel",              chargyLib.parseUTC(measurementValue.timestamp),                                                result.timestamp                   || "",  infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl",            chargyLib.parseOBIS(measurementValue.measurement.obis),                                        result.obis                        || "",  infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                                      result.unitEncoded                 || "",  infoDiv, bufferValue);
        this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                            result.scale                       || "",  infoDiv, bufferValue);
        this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                                result.value                       || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",               result.authorizationStart          || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt",  chargyLib.parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), result.authorizationStartTimestamp || "",  infoDiv, bufferValue);

        // Buffer
        bufferValue.parentElement!.children[0].innerHTML             = "Puffer (hex)";

        // Hashed Buffer
        hashedBufferValue.parentElement!.children[0].innerHTML       = "Hashed Puffer (SHA256, 24 bytes, hex)";
        hashedBufferValue.innerHTML                                  = result.sha256value.match(/.{1,8}/g).join(" ");;


        // Public Key
        publicKeyValue.parentElement!.children[0].innerHTML          = "Public Key (" +
                                                                       (result.publicKeyFormat
                                                                           ? result.publicKeyFormat + ", "
                                                                           : "") +
                                                                       "hex)";

        var pubKey = chargyLib.WhenNullOrEmpty(result.publicKey, "");

        if (!chargyLib.IsNullOrEmpty(result.publicKey))
            publicKeyValue.innerHTML                                 = pubKey.startsWith("04")
                                                                           ? "04 " + pubKey.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                           : pubKey.match(/.{1,8}/g)!.join(" ");


        // Signature
        signatureExpectedValue.parentElement!.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature!.format || "") + ", hex)";

        if (result.signature!.r && result.signature!.s)
            signatureExpectedValue.innerHTML                         = "r: " + result.signature!.r!.toLowerCase().match(/.{1,8}/g)!.join(" ") + "<br />" +
                                                                       "s: " + result.signature!.s!.toLowerCase().match(/.{1,8}/g)!.join(" ");

        else if (result.signature!.value)
            signatureExpectedValue.innerHTML                         = result.signature!.value!.toLowerCase().match(/.{1,8}/g)!.join(" ");


        // Result
        switch (result.status)
        {

            case chargyInterfaces.VerificationResult.UnknownCTRFormat:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                break;

            case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                break;

            case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case chargyInterfaces.VerificationResult.InvalidPublicKey:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case chargyInterfaces.VerificationResult.InvalidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

            case chargyInterfaces.VerificationResult.ValidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;


            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

        }

    }

}
