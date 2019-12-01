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
///<reference path="secp224k1.ts" />

interface IChargepointMeasurementValue extends IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

interface IChargepointCrypt01Result extends ICryptoResult
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


class ChargepointCrypt01 extends ACrypt {

    // Koblitz 224-bit curve
    // https://www.secg.org/sec2-v2.pdf
    // For older chargepoint charging station firmwares
    readonly curve224k1 = new secp224k1();

    // NIST/ANSI X9.62 named 256-bit elliptic curve
    // https://www.secg.org/sec2-v2.pdf
    // For newer chargepoint charging station firmwares
    readonly curve256r1 = new this.chargy.elliptic.ec('p256');

    constructor(chargy:  Chargy) {

        super("ECC secp224k1/secp256r1",
              chargy);

    }


    GenerateKeyPair()//options?: elliptic.ec.GenKeyPairOptions)
    {
        return this.curve256r1.genKeyPair();
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

    async VerifyChargingSession(chargingSession:         IChargingSession): Promise<ISessionCryptoResult>
    {

        try
        {

            let sessionResult = SessionVerificationResult.UnknownSessionFormat;
            let publicKeyId   = chargingSession.EVSEId.replace(/:/g, "").replace(/-/g, "_");

            if (chargingSession.ctr.publicKeys != null)
            {
                for (let publicKeyInfo of chargingSession.ctr?.publicKeys)
                {
                    if (publicKeyInfo.id === publicKeyId)
                        chargingSession.publicKey = publicKeyInfo;
                }
            }

            let plainText  = chargingSession.original != null ? atob(chargingSession.original) : "";

            if (chargingSession.publicKey != null && plainText !== "" && chargingSession.signature != null && chargingSession.signature !== "")
            {

                let validated = false;

                switch (chargingSession.publicKey.curve.description)
                {

                    case "secp224k1":
                        let SHA256HashValue        = await sha256(plainText);
                        chargingSession.hashValue  = (BigInt("0x" + SHA256HashValue) >> BigInt(31)).toString(16);
                        validated                  = this.curve224k1.validate(BigInt("0x" + chargingSession.hashValue),
                                                                              BigInt("0x" + chargingSession.signature.substr(8,  56)),
                                                                              BigInt("0x" + chargingSession.signature.substr(68, 56)),
                                                                              [ BigInt("0x" + chargingSession.publicKey.value.substr(2,  56)),
                                                                                BigInt("0x" + chargingSession.publicKey.value.substr(58, 56)) ]);
                        break;

                    case "secp256r1":
                        chargingSession.hashValue  = await sha256(plainText);
                        validated                  = this.curve256r1.keyFromPublic(chargingSession.publicKey.value, 'hex').
                                                                     verify       (chargingSession.hashValue,
                                                                                   chargingSession.signature)
                        break;

                }

                if (validated)
                {

                    sessionResult = SessionVerificationResult.ValidSignature;

                    if (chargingSession.measurements)
                    {
                        for (let measurement of chargingSession.measurements)
                        {

                            measurement.chargingSession = chargingSession;

                            // Must include at least two measurements (start & stop)
                            if (measurement.values && measurement.values.length > 1)
                            {

                                // Validate...
                                for (let measurementValue of measurement.values)
                                {
                                    measurementValue.measurement = measurement;
                                    await this.VerifyMeasurement(measurementValue as IChargepointMeasurementValue);
                                }

                                //#region Find an overall result...

                                for (let measurementValue of measurement.values)
                                {
                                    if (measurementValue.result.status != VerificationResult.ValidSignature &&
                                        measurementValue.result.status != VerificationResult.NoOperation)
                                    {
                                        sessionResult = SessionVerificationResult.InvalidSignature;
                                    }
                                }

                                //#endregion

                                //#region Adapt measurement results

                                if (sessionResult == SessionVerificationResult.ValidSignature)
                                {
                                    for (let i = 0; i < measurement.values.length; i++)
                                    {

                                        // Start value
                                        if (i == 0)
                                        {
                                            switch (measurement.values[i].result.status)
                                            {

                                                case VerificationResult.ValidSignature:
                                                    measurement.values[i].result.status = VerificationResult.ValidStartValue;
                                                    break;

                                                case VerificationResult.NoOperation:
                                                    measurement.values[i].result.status = VerificationResult.StartValue;
                                                    break;

                                            }
                                        }

                                        // Stop value
                                        else if (i = measurement.values.length-1)
                                        {
                                            switch (measurement.values[i].result.status)
                                            {

                                                case VerificationResult.ValidSignature:
                                                    measurement.values[i].result.status = VerificationResult.ValidStopValue;
                                                    break;

                                                case VerificationResult.NoOperation:
                                                    measurement.values[i].result.status = VerificationResult.StopValue;
                                                    break;

                                            }

                                        }

                                        // Intermediate values
                                        else
                                        {
                                            switch (measurement.values[i].result.status)
                                            {

                                                case VerificationResult.ValidSignature:
                                                    measurement.values[i].result.status = VerificationResult.ValidIntermediateValue;
                                                    break;

                                                case VerificationResult.NoOperation:
                                                    measurement.values[i].result.status = VerificationResult.IntermediateValue;
                                                    break;

                                            }

                                        }

                                    }
                                }

                                //#endregion

                            }
                            else
                                sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsExpected;

                        }
                    }
                    else
                        sessionResult = SessionVerificationResult.InvalidSessionFormat;

                }
                else
                    sessionResult = SessionVerificationResult.InvalidSignature;

            }

            return {
                status: sessionResult
            }

        }
        catch (exception)
        {
            return {
                status:  SessionVerificationResult.InvalidSignature,
                message: exception.message
            }
        }

    }


    async SignMeasurement  (measurementValue:  IChargepointMeasurementValue,
                            privateKey:        any): Promise<IChargepointCrypt01Result>
    {

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IChargepointCrypt01Result = {
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

        const signature           = this.curve256r1.keyFromPrivate(privateKey.toString('hex')).
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

    async VerifyMeasurement(measurementValue:  IChargepointMeasurementValue): Promise<IChargepointCrypt01Result>
    {

        // Note: chargepoint does not sign individual measurements!

        function setResult(verificationResult: VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        var cryptoResult:IChargepointCrypt01Result = {
            status: VerificationResult.NoOperation,
        };

        return setResult(VerificationResult.NoOperation);

    }

    async ViewMeasurement(measurementValue:        IChargepointMeasurementValue,
                          introDiv:                HTMLDivElement,
                          infoDiv:                 HTMLDivElement,
                          bufferValue:             HTMLDivElement,
                          hashedBufferValue:       HTMLDivElement,
                          publicKeyValue:          HTMLDivElement,
                          signatureExpectedValue:  HTMLDivElement,
                          signatureCheckValue:     HTMLDivElement)

    {

        const chargingSession  = measurementValue?.measurement?.chargingSession;
        const result           = measurementValue.result as IChargepointCrypt01Result;

        const cryptoSpan       = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML   = "chargepointCrypt01 (" + this.description + ")";

        // this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                          result.meterId                               || "",  infoDiv, bufferValue);
        // this.CreateLine("Zeitstempel",              parseUTC(measurementValue.timestamp),                                                result.timestamp                             || "",  infoDiv, bufferValue);
        // this.CreateLine("Status",                   hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
        //                                             this.DecodeStatus(measurementValue.infoStatus).join("<br />") + "</span>",           result.infoStatus                            || "",  infoDiv, bufferValue);
        // this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                       result.secondsIndex                          || "",  infoDiv, bufferValue);
        // this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                         result.paginationId                          || "",  infoDiv, bufferValue);
        // this.CreateLine("OBIS-Kennzahl",            parseOBIS(measurementValue.measurement.obis),                                        result.obis                                  || "",  infoDiv, bufferValue);
        // this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                            result.unitEncoded                           || "",  infoDiv, bufferValue);
        // this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                  result.scale                                 || "",  infoDiv, bufferValue);
        // this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                      result.value                                 || "",  infoDiv, bufferValue);
        // this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                              result.logBookIndex                          || "",  infoDiv, bufferValue);
        // this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",     pad(result.authorizationStart,          128) || "",  infoDiv, bufferValue);
        // this.CreateLine("Autorisierungszeitpunkt",  parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, bufferValue);


        // Buffer
        if (bufferValue.parentElement != null)
            bufferValue.parentElement.children[0].innerHTML         = "Plain text (secrrct)";
            bufferValue.innerText                                   = atob(chargingSession.original ?? "");

            bufferValue.style.fontFamily = "monospace";
            bufferValue.style.whiteSpace = "pre";
            bufferValue.style.maxHeight  = "25vh";
            bufferValue.style.overflowY  = "scroll";

        // Hashed Buffer
        if (hashedBufferValue.parentElement != null)
            hashedBufferValue.parentElement.children[0].innerHTML   = "Hashed plain text (SHA256, 32 bytes, hex)";
            hashedBufferValue.innerHTML                             = chargingSession.hashValue?.match(/.{1,8}/g)?.join(" ") ?? "-";


        // Public Key
        if (chargingSession.publicKey != null)
        {

            if (publicKeyValue.parentElement != null)
                publicKeyValue.parentElement.children[0].innerHTML  = "Public Key (" +
                                                                         (chargingSession.publicKey.type.description
                                                                              ? chargingSession.publicKey.type.description + ", "
                                                                              : "") +
                                                                         (chargingSession.publicKey.curve.description
                                                                              ? chargingSession.publicKey.curve.description + ", "
                                                                              : "") +
                                                                          "hex)";

            publicKeyValue.innerHTML                                = chargingSession.publicKey.value.startsWith("04") // Add some space after '04' to avoid confused customers
                                                                          ? "<span class=\"leadingFour\">04</span> "
                                                                            + chargingSession.publicKey.value.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                          :   chargingSession.publicKey.value.match(/.{1,8}/g)!.join(" ");


            // Public key signatures
            if (publicKeyValue.parentElement != null)
                publicKeyValue.parentElement.children[3].innerHTML = "";

            if (!IsNullOrEmpty(result.publicKeySignatures)) {

    //            publicKeyValue.parentElement!.children[2].innerHTML = "Bestätigt durch...";
                

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

        }

        // Signature
        if (signatureExpectedValue.parentElement != null)
            signatureExpectedValue.parentElement.children[0].innerHTML  = "Erwartete Signatur (secrrct.sign, rs, hex)";// " + (result.signature?.format ?? "") + ", hex)";

        // if (chargingSession.signature?.r && chargingSession.signature.s)
        if (chargingSession.signature != null)
             signatureExpectedValue.innerHTML                        = "r: " + chargingSession.signature.substr( 8, 64).toLowerCase().match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                                       "s: " + chargingSession.signature.substr(76, 64).toLowerCase().match(/.{1,8}/g)?.join(" ");

        //if (chargingSession.signature != null)
        //    signatureExpectedValue.innerHTML                        = chargingSession.signature.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";


        // Result
        if (chargingSession.verificationResult != null)
        switch (chargingSession.verificationResult.status)
        {

            // case SessionVerificationResult.UnknownCTRFormat:
            //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
            //     break;

            // case SessionVerificationResult.EnergyMeterNotFound:
            //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
            //     break;

            case SessionVerificationResult.PublicKeyNotFound:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case SessionVerificationResult.InvalidPublicKey:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case SessionVerificationResult.InvalidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

            case SessionVerificationResult.ValidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;


            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

        }

    }

    //#region Helper methods

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

    //#endregion

}