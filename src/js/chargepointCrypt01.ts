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

    readonly curve = new this.chargy.elliptic.ec('p256');

        // $ openssl ec -inform PEM -pubin -in 0024b10000027b29_1.pem -text -noout
        // Public-Key: (225 bit)
        // pub:
        //     04:f6:b9:4d:1d:0d:4c:95:24:41:b9:44:34:ac:41:
        //     3b:0c:3d:97:ee:e7:f1:19:36:9c:ac:3a:07:a2:e8:
        //     12:98:f4:2f:f6:eb:f1:2d:de:16:e1:b5:7d:a1:12:
        //     13:45:70:21:1d:c7:a9:f3:48:9a:e1:a4
        // ASN1 OID: secp224k1
        // read EC key
        //
        // Koblitz 224-bit curve
        // https://www.secg.org/sec2-v2.pdf
        //  this.chargy.elliptic.defineCurve('secp224k1', {
        //     type: 'short',
        //     prime: 'k224',
        //     p: 'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFE56D',
        //     a: '00000000 00000000 00000000 00000000 00000000 00000000 00000000',
        //     b: '00000000 00000000 00000000 00000000 00000000 00000000 00000005',
        //     n: '00000000 00000000 00000000 0001DCE8 D2EC6184 CAF0A971 769FB1F7',
        //     h: 1,
        //     hash: this.chargy.elliptic.hash.sha512,
        //     gRed: false,
        //     g: [
        //         'A1455B33 4DF099DF 30FC28A1 69A467E9 E47075A9 0F7E650E B6B7A45C',
        //         '7E089FED 7FBA3442 82CAFBD6 F7E319F7 C0B0BD59 E2CA4BDB 556D61A5'
        //     ]
        //  });

    constructor(chargy:  Chargy) {

        super("ECC secp256r1",
              chargy);

        // defineCurve('p224', {
        //             type: 'short',
        //             prime: 'p224',
        //             p: 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001',
        //             a: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe',
        //             b: 'b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4',
        //             n: 'ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d',
        //             hash: hash.sha256,
        //             gRed: false,
        //             g: [
        //                 'b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21',
        //                 'bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34'
        //             ]
        //});

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

            let plainText     = chargingSession.original != null ? atob(chargingSession.original) : "";
            let signature     = chargingSession.signature;

            if (chargingSession.publicKey != null && plainText !== "" && signature !== "")
            {

                chargingSession.hashValue = await sha256(plainText);

                if (this.curve.keyFromPublic(chargingSession.publicKey.value, 'hex').
                               verify       (chargingSession.hashValue,
                                             signature))
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