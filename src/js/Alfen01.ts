/*
 * Copyright (c) 2018-2020 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

///<reference path="certificates.ts" />
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="ACrypt.ts" />

class Alfen01  {

    private bufferToHex (buffer: ArrayBuffer) : string {
        return Array
            .from (new Uint8Array (buffer))
            .map (b => b.toString (16).padStart (2, "0"))
            .join ("");
    }

    //#region tryToParseALFENFormat(Content)

    public async tryToParseALFENFormat(Content: string|string[]) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        const base32Decode = require('base32-decode');

        // AP;
        // 0;
        // 3;
        // AJ2J7LYMGCIWT4AHUJPPFIIVB3FGRV2JQ2HVZG2I;
        // BIHEIWSHAAA2WZUZOYYDCNWTWAFACRC2I4ADGAEDQ4AAAABASMBFSAHY2JWF2AIAAEEAB7Y6ABUVEAAAAAAAAABQGQ2EMNCFIVATANRVII4DAAAAAAAAAAADAAAAABIAAAAA====;
        // S27J5BHL22ZBNFYTHTK433G7VU7Z6NN4JKO5DNPE7FNMT3SM3ZJGVWJ6ZKUOKE2LK4W63JYP4E6CY===;

        // AP;
        // 1;
        // 3;
        // AJ2J7LYMGCIWT4AHUJPPFIIVB3FGRV2JQ2HVZG2I;
        // BIHEIWSHAAA2WZUZOYYDCNWTWAFACRC2I4ADGAEDQ4AAAAAQEMWVSAASAAAAAAIAAEEAB7Y6ABXFEAAAAAAAAABQGQ2EMNCFIVATANRVII4DAAAAAAAAAAADAAAAABQAAAAA====;
        // MVYFHY24SFHI35DSXBSXRFMQP4OLYVO77TIQ6REROGCPWHY36AXIU4FD4W4Q2AHBZSNJXWCIRXAGS===;

        try
        {

            var   common = {
                      PublicKey:          "",
                      AdapterId:          "",
                      AdapterFWVersion:   "",
                      AdapterFWChecksum:  "",
                      MeterId:            "",
                      ObisId:             "",
                      Unit:               "",
                      Scalar:             "",
                      UID:                "",
                      SessionId:          0,
                      dataSets:           [] as any[]
            };

            let signedValues:string[] = [];
            if (typeof (Content) === 'string')
                signedValues = Content.split(/\r\n|\r|\n/g);
            else
                signedValues = Content;

            let previousTimestamp = "";

            for (let i=0; i<signedValues.length; i++)
            {

                let elements = signedValues[i].split(';');

                if (elements.length != 6 && elements.length != 7)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Invalid number of array elements!"
                    };

                let FormatId               = elements[0];                           //  2 bytes
                let Type                   = elements[1];                           //  1 byte; "0" | "1" | "2"
                let BlobVersion            = elements[2];                           //  1 byte
                let PublicKey:ArrayBuffer  = base32Decode(elements[3], 'RFC4648');  // 25 bytes; base32 encoded
                let DataSet:  ArrayBuffer  = base32Decode(elements[4], 'RFC4648');  // 82 bytes; base32 encoded
                let Signature:ArrayBuffer  = base32Decode(elements[5], 'RFC4648');  // 48 bytes; base32 encoded; secp192r1

                // Verify common public key
                if (common.PublicKey === "")
                    common.PublicKey = elements[3];
                else if (elements[3] !== common.PublicKey)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent public keys!"
                    };

                if (FormatId              !== "AP" ||
                    Type.length           !==  1   ||
                    BlobVersion.length    !==  1   ||
                    BlobVersion           !== "3"  ||
                    PublicKey.byteLength  !== 25   ||
                    DataSet.byteLength    !== 82   ||
                    Signature.byteLength  !== 48)
                {
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Invalid data format!"
                    };
                }

                // Everything is Little Endian
                let AdapterId            = DataSet.slice( 0, 10);  // 0a 54 65 73 74 44 65 76 00 09
                let AdapterFWVersion     = DataSet.slice(10, 14);  // ASCII: 76 30 31 34 (v014)
                let AdapterFWChecksum    = DataSet.slice(14, 16);  // B9 79
                let MeterId              = DataSet.slice(16, 26);  // 0A 01 44 5A 47 00 33 00 25 02
                let Status               = DataSet.slice(26, 30);  // 00 00 00 10
                let SecondIndex          = DataSet.slice(30, 34);  // 28 71 9A 02 => 43675944 dec
                let Timestamp            = DataSet.slice(34, 38);  // UNIX timestamp: 91 91 3D 5C => 1547538833 => 2019-01-15T07:53:53Z
                let ObisId               = DataSet.slice(38, 44);  // 01 00 01 08 00 ff
                let Unit                 = DataSet.slice(44, 45);  // 1e == Wh
                let Scalar               = DataSet.slice(45, 46);  // 00
                let Value                = DataSet.slice(46, 54);  // 73 29 00 00 00 00 00 00 => 10611 Wh so 10,611 KWh
                let UID                  = DataSet.slice(54, 74);  // ASCII: 30 35 38 39 38 41 42 42 00 00 00 00 00 00 00 00 00 00 00 00 => UID: 05 89 8A BB
                let SessionId            = DataSet.slice(74, 78);  // 81 01 00 00 => 385(dec)
                let Paging               = DataSet.slice(78, 82);  // 47 02 00 00 => 583(dec)

                let _AdapterId           = this.bufferToHex(AdapterId);
                let _AdapterFWVersion    = String.fromCharCode.apply(null, new Uint8Array(AdapterFWVersion) as any);
                let _AdapterFWChecksum   = this.bufferToHex(AdapterFWChecksum);
                let _MeterId             = this.bufferToHex(MeterId);
                let _Status              = this.bufferToHex(Status);
                let _SecondIndex         = new DataView(SecondIndex, 0).getInt32   (0, true);
                let _Timestamp           = new Date(new DataView(Timestamp, 0).getInt32(0, true) * 1000).toISOString(); // this.moment.unix(timestamp).utc().format(),
                let _ObisId              = this.bufferToHex(ObisId);
                let _Unit                = this.bufferToHex(Unit);
                let _Scalar              = this.bufferToHex(Scalar);
                let _Value               = new Number(new DataView(Value,     0).getBigInt64(0, true));
                let _UID                 = String.fromCharCode.apply(null, new Uint8Array(UID) as any).replace(/\0.*$/g, '');
                let _SessionId           = new DataView(SessionId, 0).getInt32   (0, true);
                let _Paging              = new DataView(Paging,    0).getInt32   (0, true);


                if (common.AdapterId === "")
                    common.AdapterId = _AdapterId;
                else if (_AdapterId !== common.AdapterId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter identification!"
                    };

                if (common.AdapterFWVersion === "")
                    common.AdapterFWVersion = _AdapterFWVersion;
                else if (_AdapterFWVersion !== common.AdapterFWVersion)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter firmware version!"
                    };

                if (common.AdapterFWChecksum === "")
                    common.AdapterFWChecksum = _AdapterFWChecksum;
                else if (_AdapterFWChecksum !== common.AdapterFWChecksum)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter firmware checksum!"
                    };

                if (common.MeterId === "")
                    common.MeterId = _MeterId;
                else if (_MeterId !== common.MeterId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meter identification!"
                    };

                if (common.ObisId === "")
                    common.ObisId = _ObisId;
                else if (_ObisId !== common.ObisId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent OBIS identification!"
                    };

                if (common.Unit === "")
                    common.Unit = _Unit;
                else if (_Unit !== common.Unit)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent unit value!"
                    };

                if (common.Scalar === "")
                    common.Scalar = _Scalar;
                else if (_Scalar !== common.Scalar)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent measurement scaler!"
                    };

                if (common.UID === "")
                    common.UID = _UID;
                else if (_UID !== common.UID)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent user identification!"
                    };

                if (common.SessionId === 0)
                    common.SessionId = _SessionId;
                else if (_SessionId !== common.SessionId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent charging session identification!"
                    };

                if (previousTimestamp !== "" && previousTimestamp > _Timestamp)
                    return {
                        status:   SessionVerificationResult.InconsistentTimestamps,
                        message:  "Inconsistent timestamps!"
                    };
                else
                    previousTimestamp = _Timestamp;


                common.dataSets.push({
                    //@ts-ignore
                    "Status":             _Status,
                    //@ts-ignore
                    "SecondIndex":        _SecondIndex,
                    //@ts-ignore
                    "Timestamp":          _Timestamp,
                    //@ts-ignore
                    "Value":              _Value,
                    //@ts-ignore
                    "Paging":             _Paging,
                    //@ts-ignore
                    "Signature":          this.bufferToHex(Signature)
                });

            }


            var n = common.dataSets.length-1;
            var _CTR: any = { //IChargeTransparencyRecord = {

                 "@id":              common.SessionId,
                 "@context":         "https://open.charging.cloud/contexts/CTR+json",

                 "begin":            common.dataSets[0]["Timestamp"],
                 "end":              common.dataSets[n]["Timestamp"],

                 "description": {
                     "de":           "Alle Ladevorgänge"
                 },

                 "contract": {
                     "@id":          common.UID,
                     //"type":         CTRArray[0]["contract"]["type"],
                     "username":     "",
                     "email":        ""
                 },

            //             "chargingStations": [
            //                 {
            //                     "@id":                      evseId.substring(0, evseId.lastIndexOf("*")),
            //                     // "description": {
            //                     //     "de":                   "GraphDefined Charging Station - CI-Tests Pool 3 / Station A"
            //                     // },
            //                     "firmwareVersion":          CTRArray[0]["Alfen"]["softwareVersion"],
            //                     "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
            //                     "address": {
            //                         "street":               address_street,
            //                         "postalCode":           address_zipCode,
            //                         "city":                 address_town
            //                     },
            //                     "EVSEs": [
            //                         {
            //                             "@id":                      evseId,
            //                             // "description": {
            //                             //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
            //                             // },
            //                             "sockets":                  [ { } ],
            //                             "meters": [
            //                                 {
            //                                     "@id":                      CTRArray[0]["meterInfo"]["meterId"],
            //                                     "vendor":                   CTRArray[0]["meterInfo"]["manufacturer"],
            //                                     "vendorURL":                "http://www.emh-metering.de",
            //                                     "model":                    CTRArray[0]["meterInfo"]["type"],
            //                                     "hardwareVersion":          "1.0",
            //                                     "firmwareVersion":          CTRArray[0]["meterInfo"]["firmwareVersion"],
            //                                     "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
            //                                     "publicKeys": [
            //                                         {
            //                                             "algorithm":        "secp192r1",
            //                                             "format":           "DER",
            //                                             "value":            CTRArray[0]["meterInfo"]["publicKey"].startsWith("04")
            //                                                                     ?        CTRArray[0]["meterInfo"]["publicKey"]
            //                                                                     : "04" + CTRArray[0]["meterInfo"]["publicKey"],
            //                                             "signatures":       CTRArray[0]["meterInfo"]["publicKeySignatures"]
            //                                         }
            //                                     ]
            //                                 }
            //                             ]
            //                         }
            //                     ]
            //                 }

                 "chargingSessions": [

                     {

                         "@id":                          common.SessionId,
                         "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/AlfenCrypt01+json",
                         "begin":                        common.dataSets[0]["Timestamp"],
                         "end":                          common.dataSets[n]["Timestamp"],
            //             "EVSEId":                       evseId,

                         "authorizationStart": {
                             "@id":                      common.UID,
                            //  "type":                     CTRArray[0]["contract"]["type"],
                            //  "timestamp":                this.moment.unix(CTRArray[0]["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                            //                                               CTRArray[0]["contract"]["timestampLocal"]["localOffset"] +
                            //                                               CTRArray[0]["contract"]["timestampLocal"]["seasonOffset"]).format(),
                         },

            //             "signatureInfos": {
            //                 "hash":                     "SHA256",
            //                 "hashTruncation":           "24",
            //                 "algorithm":                "ECC",
            //                 "curve":                    "secp192r1",
            //                 "format":                   "rs"
            //             },

                         "measurements": [

                             {

                                 "energyMeterId":        common.MeterId,
                                 "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/AlfenCrypt03+json",
            //                     "name":                 CTRArray[0]["measurand"]["name"],
                                 "obis":                 common.ObisId,
            //                     "unit":                 CTRArray[0]["measuredValue"]["unit"],
                                 "unitEncoded":          common.Unit,
            //                     "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                                 "scale":                common.Scalar,

            //                     "signatureInfos": {
            //                         "hash":                 "SHA512",
            //                         "hashTruncation":       "24",
            //                         "algorithm":            "ECC",
            //                         "curve":                "secp192r1",
            //                         "format":               "rs"
            //                     },

                                 "values": [ ]

                             }

                         ]

                     }

                 ]

            };

            for (var dataSet of common.dataSets)
            {

                 _CTR["chargingSessions"][0]["measurements"][0]["values"].push(

                                         {
                                             "timestamp":      dataSet["Timestamp"],
                                             "value":          dataSet["Value"],
                                             "infoStatus":     dataSet["Status"],
                                             "secondsIndex":   dataSet["SecondIndex"],
                                             "paginationId":   dataSet["Paging"],
            //                                 "logBookIndex":   _measurement["additionalInfo"]["indexes"]["logBook"],
                                             "signatures": [
                                                 {
                                                     "r":          dataSet["Signature"].substring(0, 48),
                                                     "s":          dataSet["Signature"].substring(48)
                                                 }
                                             ]
                                         }

                 );

            }

            //await this.processChargeTransparencyRecord(_CTR);
            return _CTR as IChargeTransparencyRecord;

        }
        catch (exception)
        {
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + exception.message
            }
        }

    }

    //#endregion


}

interface IAlfenMeasurementValue extends IMeasurementValue
{
    infoStatus:                    string,
    secondsIndex:                  number,
    paginationId:                  string,
    logBookIndex:                  string
}

interface IAlfenCrypt01Result extends ICryptoResult
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


class AlfenCrypt01 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p192');

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

    async VerifyChargingSession(chargingSession: IChargingSession): Promise<ISessionCryptoResult>
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
                        await this.VerifyMeasurement(measurementValue as IAlfenMeasurementValue);
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
                    sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }
        }

        return {
            status: sessionResult
        }

    }


    async SignMeasurement  (measurementValue:  IAlfenMeasurementValue,
                            privateKey:        any): Promise<IAlfenCrypt01Result>
    {

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IAlfenCrypt01Result = {
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

    async VerifyMeasurement(measurementValue: IAlfenMeasurementValue): Promise<IAlfenCrypt01Result>
    {

        function setResult(verificationResult: VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        var cryptoResult:IAlfenCrypt01Result = {
            status: VerificationResult.NoOperation,
        };

        return setResult(VerificationResult.NoOperation);

    }

    async ViewMeasurement(measurementValue:      IAlfenMeasurementValue,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)

    {

        const result     = measurementValue.result as IAlfenCrypt01Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "AlfenCrypt01 (" + this.description + ")";

        //#region Plain text

        if (PlainTextDiv != null)
        {

            if (PlainTextDiv.parentElement != null)
                PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (320 Bytes, hex)";

            PlainTextDiv.style.fontFamily  = "";
            PlainTextDiv.style.whiteSpace  = "";
            PlainTextDiv.style.maxHeight   = "";
            PlainTextDiv.style.overflowY   = "";

            this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                          result.meterId                               || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",              parseUTC(measurementValue.timestamp),                                                result.timestamp                             || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Status",                   hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
                                                        //this.DecodeStatus(measurementValue.infoStatus).join("<br />") +
                                                        "</span>",           result.infoStatus                            || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                       result.secondsIndex                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                         result.paginationId                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",            parseOBIS(measurementValue.measurement.obis),                                        result.obis                                  || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                            result.unitEncoded                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                  result.scale                                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                      result.value                                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                              result.logBookIndex                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",     pad(result.authorizationStart,          128) || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierungszeitpunkt",  parseUTC(measurementValue.measurement.chargingSession.authorizationStart.timestamp), pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, PlainTextDiv);

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv != null)
        {

            if (HashedPlainTextDiv.parentElement != null)
                HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text (SHA256, 24 bytes, hex)";

            HashedPlainTextDiv.innerHTML                                 = result.sha256value.match(/.{1,8}/g).join(" ");

        }

        //#endregion

        //#region Public Key

        if (PublicKeyDiv     != null &&
            result.publicKey != null &&
            result.publicKey != "")
        {

            if (PublicKeyDiv.parentElement != null)
                PublicKeyDiv.parentElement.children[0].innerHTML       = "Public Key (" +
                                                                         (result.publicKeyFormat
                                                                             ? result.publicKeyFormat + ", "
                                                                             : "") +
                                                                         "hex)";

            if (!IsNullOrEmpty(result.publicKey))
                PublicKeyDiv.innerHTML                                 = result.publicKey.startsWith("04") // Add some space after '04' to avoid confused customers
                                                                            ? "<span class=\"leadingFour\">04</span> "
                                                                                + result.publicKey.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                            :   result.publicKey.match(/.{1,8}/g)!.join(" ");


            //#region Public key signatures

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

            //#endregion

        }

        //#endregion

        //#region Signature expected

        if (SignatureExpectedDiv != null && result.signature != null)
        {

            if (SignatureExpectedDiv.parentElement != null)
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";

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

                case VerificationResult.UnknownCTRFormat:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                    break;

                case VerificationResult.EnergyMeterNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                    break;

                case VerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case VerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case VerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

                case VerificationResult.ValidSignature:
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
