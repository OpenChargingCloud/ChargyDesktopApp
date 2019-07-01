/*
 * Copyright (c) 2018-2019 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Mobile App <https://github.com/OpenChargingCloud/ChargyMobileApp>
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


interface IEMHMeasurementValue extends IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

interface IEMHCrypt01Result extends ICryptoResult
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


class EMHCrypt01 extends ACrypt {

    readonly curve = new this.elliptic.ec('p192');
    
    constructor(GetMeter:                      GetMeterFunc,
                CheckMeterPublicKeySignature:  CheckMeterPublicKeySignatureFunc) {

        super("ECC secp192r1",
              GetMeter,
              CheckMeterPublicKeySignature);

    }


    SignMeasurement(measurementValue:  IEMHMeasurementValue,
                    privateKey:        any,
                    publicKey:         any): IEMHCrypt01Result
    {

        // var keypair                      = this.curve.genKeyPair();
        //     privateKey                   = keypair.getPrivate();
        //     publicKey                    = keypair.getPublic();        
        // var privateKeyHEX                = privateKey.toString('hex').toLowerCase();
        // var publicKeyHEX                 = publicKey.encode('hex').toLowerCase();
        
        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IEMHCrypt01Result = {
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
        cryptoResult.sha256value  = this.crypt.createHash ('sha256').
                                               update     (cryptoBuffer).
                                               digest     ('hex').
                                               toLowerCase().
                                               substring  (0, 48);

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


    VerifyChargingSession(chargingSession:   IChargingSession): ISessionCryptoResult
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
                        this.VerifyMeasurement(measurementValue as IEMHMeasurementValue);
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


    VerifyMeasurement(measurementValue:  IEMHMeasurementValue): IEMHCrypt01Result
    {

        function setResult(verificationResult: VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        var buffer        = new ArrayBuffer(320);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IEMHCrypt01Result = {
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

                // Only the first 24 bytes/192 bits are used!
                cryptoResult.sha256value = this.crypt.createHash('sha256').
                                                      update(cryptoBuffer).
                                                      digest('hex').
                                                      substring(0, 48);


                const meter = this.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoResult.meter = meter;

                    var iPublicKey = meter.publicKeys[0] as IPublicKey;
                    if (iPublicKey != null)
                    {

                        try
                        {

                            cryptoResult.publicKey            = iPublicKey.value.toLowerCase();
                            cryptoResult.publicKeyFormat      = iPublicKey.format;
                            cryptoResult.publicKeySignatures  = iPublicKey.signatures;

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

        return {} as IEMHCrypt01Result;

    }

    
    private DecodeStatus(statusValue: string) : Array<string>
    {

        let statusArray:string[] = [];

        try
        {

            let status = parseInt(statusValue);

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
        catch (exception)
        {
            statusArray.push("Invalid status!");
        }

        return statusArray;

    }

    ViewMeasurement(measurementValue:        IEMHMeasurementValue,
                    introDiv:                HTMLDivElement,
                    infoDiv:                 HTMLDivElement,
                    bufferValue:             HTMLDivElement,
                    hashedBufferValue:       HTMLDivElement,
                    publicKeyValue:          HTMLDivElement,
                    signatureExpectedValue:  HTMLDivElement,
                    signatureCheckValue:     HTMLDivElement)
    {

        const result     = measurementValue.result as IEMHCrypt01Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "EMHCrypt01 (" + this.description + ")";

        this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                          result.meterId                                    || "",  infoDiv, bufferValue);
        this.CreateLine("Zeitstempel",              parseUTC(measurementValue.timestamp),                                                result.timestamp                                  || "",  infoDiv, bufferValue);
        this.CreateLine("Status",                   hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
                                                    this.DecodeStatus(measurementValue.infoStatus).join("<br />") + "</span>",           result.infoStatus                                 || "",  infoDiv, bufferValue);
        this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                       result.secondsIndex                               || "",  infoDiv, bufferValue);
        this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                         result.paginationId                               || "",  infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl",            parseOBIS(measurementValue.measurement.obis),                                        result.obis                                       || "",  infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                            result.unitEncoded                                || "",  infoDiv, bufferValue);
        this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                  result.scale                                      || "",  infoDiv, bufferValue);
        this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                      result.value                                      || "",  infoDiv, bufferValue);
        this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                              result.logBookIndex                               || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",     this.pad(result.authorizationStart,          128) || "",  infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt",  parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), this.pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, bufferValue);

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
                    signatureDiv.innerHTML = this.CheckMeterPublicKeySignature(measurementValue.measurement.chargingSession.chargingStation,
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