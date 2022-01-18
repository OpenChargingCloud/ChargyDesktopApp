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

///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="ACrypt.ts" />
///<reference path="OCMFTypes.ts" />


interface IOCMFv1_0MeasurementValue extends IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

interface IOCMFv1_0Result extends ICryptoResult
{
    sha256value?:                  any,
    meterId?:                      string,
    meter?:                        IMeter,
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
    signature?:                    IECCSignature
}


class OCMFv1_0 extends ACrypt {

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


    async SignChargingSession  (chargingSession:         IChargingSession,
                                privateKey:              any):              Promise<ISessionCryptoResult>
    {

        return {
            status: SessionVerificationResult.UnknownSessionFormat
        }

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
                        await this.VerifyMeasurement(measurementValue as IOCMFv1_0MeasurementValue);
                    }


                    // Find an overall result...
                    sessionResult = SessionVerificationResult.ValidSignature;

                    for (var measurementValue of measurement.values)
                    {
                        if (sessionResult                   === SessionVerificationResult.ValidSignature &&
                            measurementValue.result?.status !== VerificationResult.ValidSignature)
                        {
                            sessionResult = SessionVerificationResult.InvalidSignature;
                        }
                    }

                }

                else
                    sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsRequired;

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
                status: VerificationResult.InvalidMeasurement
            }
        }

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IOCMFv1_0Result = {
            status:                       VerificationResult.InvalidSignature,
            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                 10),
            infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
            paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obis:                         SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true),
            logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                              39, false),
            authorizationStart:           SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],     41),
            authorizationStartTimestamp:  SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };

        // Only the first 24 bytes/192 bits are used!
        cryptoResult.sha256value  = (await sha256(cryptoBuffer)).substring(0, 48);

        // cryptoResult.publicKey    = publicKey.encode('hex').
        //                                       toLowerCase();

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

    async VerifyMeasurement(measurementValue:  IOCMFv1_0MeasurementValue): Promise<IOCMFv1_0Result>
    {

        function setResult(verificationResult: VerificationResult)
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
            status:                       VerificationResult.ValidSignature,
        };

        return setResult(VerificationResult.ValidSignature);

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

    async ViewMeasurement(measurementValue:        IOCMFv1_0MeasurementValue,
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
                status: VerificationResult.InvalidMeasurement
            }
        }

        const result     = measurementValue.result as IOCMFv1_0Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "OCMFCrypt01 (" + this.description + ")";

        this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                          result.meterId                               || "",  infoDiv, bufferValue);
        this.CreateLine("Zeitstempel",              parseUTC(measurementValue.timestamp),                                                result.timestamp                             || "",  infoDiv, bufferValue);
        this.CreateLine("Status",                   hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)", result.infoStatus                            || "",  infoDiv, bufferValue);
        this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                       result.secondsIndex                          || "",  infoDiv, bufferValue);
        this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                         result.paginationId                          || "",  infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl",            measurementValue.measurement.obis,                                                   result.obis                                  || "",  infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                            result.unitEncoded                           || "",  infoDiv, bufferValue);
        this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                  result.scale                                 || "",  infoDiv, bufferValue);
        this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                      result.value                                 || "",  infoDiv, bufferValue);
        this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                              result.logBookIndex                          || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",     pad(result.authorizationStart,          128) || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt",  parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, bufferValue);


        // Buffer
        bufferValue.parentElement!.children[0].innerHTML             = "Puffer (320 Bytes, hex)";

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
            publicKeyValue.innerHTML                                 = pubKey.startsWith("04") // Add some space after '04' to avoid confused customers
                                                                           ? "<span class=\"leadingFour\">04</span> "
                                                                             + pubKey.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                           :   pubKey.match(/.{1,8}/g)!.join(" ");


        if (!IsNullOrEmpty(result.publicKeySignatures)) {

//            publicKeyValue.parentElement!.children[2].innerHTML = "Bestätigt durch...";
            publicKeyValue.parentElement!.children[3].innerHTML = ""; 

            for (let signature of result.publicKeySignatures)
            {

                try
                {

                    let signatureDiv = publicKeyValue.parentElement!.children[3].appendChild(document.createElement('div'));
                    signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(measurementValue.measurement.chargingSession.chargingStation,
                                                                                            measurementValue.measurement.chargingSession.EVSE,
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


        // Signature
        signatureExpectedValue.parentElement!.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature!.format || "") + ", hex)";

        if (result.signature!.r && result.signature!.s)
            signatureExpectedValue.innerHTML                        = "r: " + result.signature!.r!.toLowerCase().match(/.{1,8}/g)!.join(" ") + "<br />" +
                                                                      "s: " + result.signature!.s!.toLowerCase().match(/.{1,8}/g)!.join(" ");

        else if (result.signature!.value)
            signatureExpectedValue.innerHTML                        = result.signature!.value!.toLowerCase().match(/.{1,8}/g)!.join(" ");


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