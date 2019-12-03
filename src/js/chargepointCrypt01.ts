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

    // For older chargepoint charging station firmwares
    // Koblitz 224-bit curve: secp224k1
    // https://www.secg.org/sec2-v2.pdf
    readonly curve224k1 = new secp224k1();

    // For newer chargepoint charging station firmwares
    // NIST/ANSI X9.62 named 256-bit elliptic curve: secp256r1
    // https://www.secg.org/sec2-v2.pdf
    readonly curve256r1 = new this.chargy.elliptic.ec('p256');

    // Not used yet!
    readonly curve384r1 = new this.chargy.elliptic.ec('p384');

    // Not used yet!
    readonly curve512r1 = new this.chargy.elliptic.ec('p521');


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

    async VerifyChargingSession(chargingSession: IChargingSession): Promise<ISessionCryptoResult>
    {

        try
        {

            let sessionResult  = SessionVerificationResult.UnknownSessionFormat;
            let plainText      = chargingSession.original != null ? atob(chargingSession.original) : "";
            let publicKeyId    = chargingSession.EVSEId.replace(/:/g, "").replace(/-/g, "_");

            //#region Find public key

            if (chargingSession.ctr.publicKeys != null)
            {
                for (let publicKeyInfo of chargingSession.ctr?.publicKeys)
                {
                    if (publicKeyInfo.id === publicKeyId)
                        chargingSession.publicKey = publicKeyInfo;
                }
            }

            //#endregion

            //#region Convert signature into rs-format...

            if (chargingSession.signature         !=  null &&
                chargingSession.signature         !== ""   &&
                typeof(chargingSession.signature) === 'string')
            {

                const ASN1                  = require('asn1.js');
                const ASN1_SignatureSchema  = ASN1.define('Signature', function() {
                    //@ts-ignore
                    this.seq().obj(
                        //@ts-ignore
                        this.key('r').int(),
                        //@ts-ignore
                        this.key('s').int()
                    );
                });

                const ASN1Signature         = ASN1_SignatureSchema.decode(Buffer.from(chargingSession.signature, 'hex'), 'der');

                chargingSession.signature   = { r: ASN1Signature.r.toString(16),
                                                s: ASN1Signature.s.toString(16) };

            }

            //#endregion


            //#region Validate signature

            if (chargingSession.publicKey !=  null &&
                plainText                 !== ""   &&
                chargingSession.signature !=  null &&
                chargingSession.signature !== "")
            {

                switch (chargingSession.publicKey.curve.description)
                {

                    case "secp224k1":
                        let SHA256HashValue        = await sha256(plainText);
                        chargingSession.hashValue  = (BigInt("0x" + SHA256HashValue) >> BigInt(31)).toString(16);
                        sessionResult              = this.curve224k1.validate(BigInt("0x" + chargingSession.hashValue),
                                                                              BigInt("0x" + chargingSession.signature.r),
                                                                              BigInt("0x" + chargingSession.signature.s),
                                                                              [ BigInt("0x" + chargingSession.publicKey.value.substr(2,  56)),
                                                                                BigInt("0x" + chargingSession.publicKey.value.substr(58, 56)) ])
                                                         ? SessionVerificationResult.ValidSignature
                                                         : SessionVerificationResult.InvalidSignature;
                        break;

                    case "secp256r1":
                        chargingSession.hashValue  = await sha256(plainText);
                        sessionResult              = this.curve256r1.keyFromPublic(chargingSession.publicKey.value, 'hex').
                                                                     verify       (chargingSession.hashValue,
                                                                                   chargingSession.signature)
                                                        ? SessionVerificationResult.ValidSignature
                                                        : SessionVerificationResult.InvalidSignature;
                        break;

                    case "secp384r1":
                        chargingSession.hashValue  = await sha384(plainText);
                        sessionResult              = this.curve384r1.keyFromPublic(chargingSession.publicKey.value, 'hex').
                                                                     verify       (chargingSession.hashValue,
                                                                                   chargingSession.signature)
                                                        ? SessionVerificationResult.ValidSignature
                                                        : SessionVerificationResult.InvalidSignature;
                        break;

                    case "secp521r1":
                        chargingSession.hashValue  = await sha512(plainText);
                        sessionResult              = this.curve512r1.keyFromPublic(chargingSession.publicKey.value, 'hex').
                                                                     verify       (chargingSession.hashValue,
                                                                                   chargingSession.signature)
                                                        ? SessionVerificationResult.ValidSignature
                                                        : SessionVerificationResult.InvalidSignature;
                        break;

                }

            }

            //#endregion

            //#region Validate measurements

            if (chargingSession.measurements)
            {
                for (let measurement of chargingSession.measurements)
                {

                    measurement.chargingSession = chargingSession;

                    // Must include at least two measurements (start & stop)
                    if (measurement.values && measurement.values.length > 1)
                    {

                        //#region Validate measurements...

                        for (let measurementValue of measurement.values)
                        {
                            measurementValue.measurement = measurement;
                            await this.VerifyMeasurement(measurementValue as IChargepointMeasurementValue);
                        }

                        //#endregion

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

                        for (let i = 0; i < measurement.values.length; i++)
                        {

                            //#region Adapt start value

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

                                    case VerificationResult.InvalidSignature:
                                        measurement.values[i].result.status = VerificationResult.InvalidStartValue;
                                        break;

                                }
                            }

                            //#endregion

                            //#region Adapt stop value

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

                                    case VerificationResult.InvalidSignature:
                                        measurement.values[i].result.status = VerificationResult.InvalidStopValue;
                                        break;

                                }

                            }

                            //#endregion

                            //#region Adapt intermediate values

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

                                    case VerificationResult.InvalidSignature:
                                        measurement.values[i].result.status = VerificationResult.InvalidStopValue;
                                        break;

                                }

                            }

                            //#endregion

                        }

                    }
                    else
                        sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsExpected;

                }
            }
            else
                sessionResult = SessionVerificationResult.InvalidSessionFormat;

            //#endregion


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

    async VerifyMeasurement(measurementValue: IChargepointMeasurementValue): Promise<IChargepointCrypt01Result>
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

    async ViewMeasurement(measurementValue:      IChargepointMeasurementValue,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)

    {

        let chargingSession    = measurementValue?.measurement?.chargingSession;
        let result             = measurementValue.result as IChargepointCrypt01Result;
        let cryptoAlgorithm    = chargingSession?.publicKey?.curve.description != null
                                     ? " (" + chargingSession?.publicKey?.curve.description + ")"
                                     : "";

        let cryptoSpan         = introDiv?.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML   = "chargepointCrypt01" + cryptoAlgorithm;

        //#region Plain text

        if (PlainTextDiv != null)
        {

            if (PlainTextDiv.parentElement != null)
                PlainTextDiv.parentElement.children[0].innerHTML         = "Plain text (secrrct)";
            PlainTextDiv.innerText                                       = atob(chargingSession.original ?? "");

            PlainTextDiv.style.fontFamily  = "monospace";
            PlainTextDiv.style.whiteSpace  = "pre";
            PlainTextDiv.style.maxHeight   = "25vh";
            PlainTextDiv.style.overflowY   = "scroll";

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv != null)
        {

            let hashInfo = "";

            switch (chargingSession.publicKey?.curve.description)
            {

                case "secp224k1":
                    hashInfo  = "SHA256, 225 Bits, ";
                    break;

                case "secp256r1":
                    hashInfo  = "SHA256, 256 Bits, ";
                    break;

                case "secp384r1":
                    hashInfo  = "SHA384, 384 Bits, ";
                    break;

                case "secp512r1":
                    hashInfo  = "SHA512, 512 Bits, ";
                    break;

            }

            if (HashedPlainTextDiv.parentElement != null)
                HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text (" + hashInfo + " hex)";
                HashedPlainTextDiv.innerHTML                             = chargingSession.hashValue?.match(/.{1,8}/g)?.join(" ")
                                                                               ?? "0x00000000000000000000000000000000000";

        }

        //#endregion

        //#region Public Key

        if (PublicKeyDiv != null && chargingSession.publicKey != null)
        {

            if (PublicKeyDiv.parentElement != null)
                PublicKeyDiv.parentElement.children[0].innerHTML  = "Public Key (" +
                                                                         (chargingSession.publicKey.type.description
                                                                              ? chargingSession.publicKey.type.description + ", "
                                                                              : "") +
                                                                         (chargingSession.publicKey.curve.description
                                                                              ? chargingSession.publicKey.curve.description + ", "
                                                                              : "") +
                                                                          "hex)";

            PublicKeyDiv.innerHTML                                = chargingSession.publicKey.value.startsWith("04") // Add some space after '04' to avoid confused customers
                                                                          ? "<span class=\"leadingFour\">04</span> "
                                                                            + chargingSession.publicKey.value.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                          :   chargingSession.publicKey.value.match(/.{1,8}/g)!.join(" ");


            // Public key signatures

            if (PublicKeyDiv.parentElement != null)
                PublicKeyDiv.parentElement.children[3].innerHTML = "";

            if (!IsNullOrEmpty(result.publicKeySignatures)) {

                for (let signature of result.publicKeySignatures)
                {

                    try
                    {

                        let signatureDiv = PublicKeyDiv.parentElement!.children[3].appendChild(document.createElement('div'));
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

        //#endregion

        //#region Signature expected

        if (SignatureExpectedDiv != null && chargingSession.signature != null)
        {

            if (SignatureExpectedDiv.parentElement != null)
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (secrrct.sign, rs, hex)";// " + (result.signature?.format ?? "") + ", hex)";

            if (typeof chargingSession.signature != 'string')
                SignatureExpectedDiv.innerHTML                            = "r: " + chargingSession.signature.r.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                                            "s: " + chargingSession.signature.s.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ");

            else if (chargingSession.signature)
                SignatureExpectedDiv.innerHTML                            = chargingSession.signature.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

        }

        //#endregion

        //#region Signature check

        if (SignatureCheckDiv != null && chargingSession.verificationResult != null)
        {
            switch (chargingSession.verificationResult.status)
            {

                // case SessionVerificationResult.UnknownCTRFormat:
                //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                //     break;

                // case SessionVerificationResult.EnergyMeterNotFound:
                //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                //     break;

                case SessionVerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case SessionVerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case SessionVerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

                case SessionVerificationResult.ValidSignature:
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