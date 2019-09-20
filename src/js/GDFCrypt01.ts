/*
 * Copyright (c) 2018-2019 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="ACrypt.ts" />


interface IGDFMeasurementValue extends IMeasurementValue
{
    prevSignature:                 string,
}

interface IGDFCrypt01Result extends ICryptoResult
{
    sha256value?:                  any,
    meterId?:                      string,
    meter?:                        IMeter,
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
    signature?:                    IECCSignature
}

class GDFCrypt01 extends ACrypt {

    readonly curve = new this.elliptic.ec('p256');

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

    async SignMeasurement(measurementValue:  IGDFMeasurementValue,
                          privateKey:        any,
                          publicKey:         any): Promise<IGDFCrypt01Result>
    {

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IGDFCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,
            meterId:                      SetText     (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp(cryptoBuffer, measurementValue.timestamp,                                                 10),
            obis:                         SetHex      (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
            unitEncoded:                  SetInt8     (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8     (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64   (cryptoBuffer, measurementValue.value,                                                     31, true),
            authorizationStart:           SetHex      (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],     41),
            authorizationStartTimestamp:  SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };

        cryptoResult.sha256value  = await sha256(cryptoBuffer);

        cryptoResult.publicKey    = publicKey.encode('hex').
                                              toLowerCase();

        const signature           = this.curve.keyFromPrivate(privateKey.toString('hex')).
                                               sign(cryptoResult.sha256value);

        switch (measurementValue.measurement.signatureInfos.format)
        {

            case SignatureFormats.DER:

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    value:      signature.toDER('hex')
                };

                return cryptoResult;


            case SignatureFormats.rs:

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    r:          signature.r,
                    s:          signature.s
                };

                return cryptoResult;


            //default:


        }

        cryptoResult.status = VerificationResult.ValidSignature;
        return cryptoResult;

    }


    async VerifyChargingSession(chargingSession:   IChargingSession): Promise<ISessionCryptoResult>
    {

        var sessionResult = SessionVerificationResult.UnknownSessionFormat;

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
                    sessionResult = SessionVerificationResult.ValidSignature;

                    for (var measurementValue of measurement.values)
                    {
                        if (sessionResult                  == SessionVerificationResult.ValidSignature &&
                            measurementValue.result.status != VerificationResult.ValidSignature)
                        {
                            sessionResult = SessionVerificationResult.InvalidSignature;
                        }
                    }

                }

                else
                    sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsExpected;

            }
        }

        return {
            status: sessionResult
        } ;

    }


    async VerifyMeasurement(measurementValue:  IGDFMeasurementValue): Promise<IGDFCrypt01Result>
    {

        function setResult(vr: VerificationResult)
        {
            cryptoResult.status     = vr;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        var buffer        = new ArrayBuffer(320);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IGDFCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,
            meterId:                      SetText     (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp(cryptoBuffer, measurementValue.timestamp,                                                 10),
            obis:                         SetHex      (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
            unitEncoded:                  SetInt8     (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8     (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64   (cryptoBuffer, measurementValue.value,                                                     31, true),
            authorizationStart:           SetHex      (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],     41),
            authorizationStartTimestamp:  SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };

        var signatureExpected = measurementValue.signatures[0] as IECCSignature;
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

                cryptoResult.sha256value = await sha256(cryptoBuffer);


                const meter = this.chargy.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoResult.meter = meter;

                    var iPublicKey = meter.publicKeys[0] as IPublicKey;
                    if (iPublicKey != null)
                    {

                        try
                        {

                            cryptoResult.publicKey        = iPublicKey.value.toLowerCase();
                            cryptoResult.publicKeyFormat  = iPublicKey.format;

                            try
                            {

                                if (this.curve.keyFromPublic(cryptoResult.publicKey, 'hex').
                                               verify       (cryptoResult.sha256value,
                                                             cryptoResult.signature))
                                {
                                    return setResult(VerificationResult.ValidSignature);
                                }

                                return setResult(VerificationResult.InvalidSignature);

                            }
                            catch (exception)
                            {
                                return setResult(VerificationResult.InvalidSignature);
                            }

                        }
                        catch (exception)
                        {
                            return setResult(VerificationResult.InvalidPublicKey);
                        }

                    }

                    else
                        return setResult(VerificationResult.PublicKeyNotFound);

                }

                else
                    return setResult(VerificationResult.EnergyMeterNotFound);

            }
            catch (exception)
            {
                return setResult(VerificationResult.InvalidSignature);
            }

        }

        return {} as IGDFCrypt01Result;

    }


    async ViewMeasurement(measurementValue:        IMeasurementValue,
                          introDiv:                HTMLDivElement,
                          infoDiv:                 HTMLDivElement,
                          bufferValue:             HTMLDivElement,
                          hashedBufferValue:       HTMLDivElement,
                          publicKeyValue:          HTMLDivElement,
                          signatureExpectedValue:  HTMLDivElement,
                          signatureCheckValue:     HTMLDivElement)
    {

        const result    = measurementValue.result as IGDFCrypt01Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "GDFCrypt01 (" + this.description + ")";

        this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                          result.meterId                     || "",  infoDiv, bufferValue);
        this.CreateLine("Zeitstempel",              parseUTC(measurementValue.timestamp),                                                result.timestamp                   || "",  infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl",            parseOBIS(measurementValue.measurement.obis),                                        result.obis                        || "",  infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                            result.unitEncoded                 || "",  infoDiv, bufferValue);
        this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                  result.scale                       || "",  infoDiv, bufferValue);
        this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                      result.value                       || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",     result.authorizationStart          || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt",  parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), result.authorizationStartTimestamp || "",  infoDiv, bufferValue);

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

        var pubKey = WhenNullOrEmpty(result.publicKey, "");

        if (!IsNullOrEmpty(result.publicKey))
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

            case VerificationResult.UnknownCTRFormat:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                break;

            case VerificationResult.EnergyMeterNotFound:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                break;

            case VerificationResult.PublicKeyNotFound:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case VerificationResult.InvalidPublicKey:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case VerificationResult.InvalidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

            case VerificationResult.ValidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;


            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

        }

    }

}