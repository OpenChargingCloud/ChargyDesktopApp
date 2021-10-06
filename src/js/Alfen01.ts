/*
 * Copyright (c) 2018-2021 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }

    private bufferToHex(buffer: ArrayBuffer, Reverse?: Boolean) : string {
        return (Reverse
                    ? Array.from(new Uint8Array(buffer)).reverse()
                    : Array.from(new Uint8Array(buffer))
               ).map (b => b.toString(16).padStart(2, "0")).join("");
    }

    private bufferToNumber(buffer: ArrayBuffer) : number {
        return parseInt(Array
            .from(new Uint8Array(buffer))
            .map (b => b.toString(16).padStart(2, "0"))
            .join(""), 16);
    }

    //#region tryToParseALFENFormat(Content)

    public async tryToParseALFENFormat(Content: string|string[]) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

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

            var common = {
                    PublicKey:          "",
                    PublicKeyFormat:    "",
                    AdapterId:          "",
                    AdapterFWVersion:   "",
                    AdapterFWChecksum:  "",
                    MeterId:            "",
                    ObisId:             "",
                    UnitEncoded:        0,
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

                let FormatId               = elements[0];                                  //  2 bytes
                let Type                   = elements[1];                                  //  1 byte; "0": start meter value | "1": stop meter value | "2": intermediate value
                let BlobVersion            = elements[2];                                  //  1 byte; "3" (current version)
                let PublicKey:ArrayBuffer  = this.chargy.base32Decode(elements[3], 'RFC4648');  // 25 bytes; base32 encoded; secp192r1
                let DataSet:  ArrayBuffer  = this.chargy.base32Decode(elements[4], 'RFC4648');  // 82 bytes; base32 encoded
                let Signature:ArrayBuffer  = this.chargy.base32Decode(elements[5], 'RFC4648');  // 48 bytes; base32 encoded; secp192r1

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

                switch (PublicKey.byteLength)
                {
                    case 25:
                        common.PublicKeyFormat   = "secp192r1";
                        break;
                }

                // Everything is Little Endian
                let AdapterId            = this.bufferToHex(DataSet.slice( 0, 10));                                        // 0a 54 65 73 74 44 65 76 00 09
                let AdapterFWVersion     = String.fromCharCode.apply(null, new Uint8Array(DataSet.slice(10, 14)) as any);  // ASCII: 76 30 31 34 (v014)
                let AdapterFWChecksum    = this.bufferToHex(DataSet.slice(14, 16));                                        // B9 79
                let MeterId              = this.bufferToHex(DataSet.slice(16, 26));                                        // 0A 01 44 5A 47 00 33 00 25 02
                let MeterStatus          = this.bufferToHex(DataSet.slice(26, 28), true);                                  // 00 00
                let AdapterStatus        = this.bufferToHex(DataSet.slice(28, 30), true);                                  // 00 10
                let SecondIndex          = new DataView(DataSet.slice(30, 34), 0).getInt32(0, true);                       // 28 71 9A 02 => 43675944 dec
                let Timestamp            = new Date(new DataView(DataSet.slice(34, 38), 0).getInt32(0, true) * 1000).      // UNIX timestamp: 91 91 3D 5C => 1547538833 => 2019-01-15T07:53:53Z
                                                  toISOString();
                let ObisId               = this.bufferToHex(DataSet.slice(38, 44));                                        // 01 00 01 08 00 ff
                let UnitEncoded          = this.bufferToNumber(DataSet.slice(44, 45));                                     // 1e => 30 => Wh
                let Scalar               = this.bufferToHex(DataSet.slice(45, 46));                                        // 00
                let Value                = new Number(new DataView(DataSet.slice(46, 54), 0).getBigInt64(0, true));        // 73 29 00 00 00 00 00 00 => 10611 Wh so 10,611 KWh
                let UID                  = String.fromCharCode.apply(null, new Uint8Array(DataSet.slice(54, 74)) as any).  // ASCII: 30 35 38 39 38 41 42 42 00 00 00 00 00 00 00 00 00 00 00 00 => UID: 05 89 8A BB
                                                  replace(/\0.*$/g, '');
                let SessionId            = new DataView(DataSet.slice(74, 78), 0).getInt32(0, true)                        // 81 01 00 00 => 385(dec)
                let Paging               = new DataView(DataSet.slice(78, 82), 0).getInt32(0, true);                       // 47 02 00 00 => 583(dec)


                if (common.AdapterId === "")
                    common.AdapterId = AdapterId;
                else if (AdapterId !== common.AdapterId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter identification!"
                    };

                if (common.AdapterFWVersion === "")
                    common.AdapterFWVersion = AdapterFWVersion;
                else if (AdapterFWVersion !== common.AdapterFWVersion)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter firmware version!"
                    };

                if (common.AdapterFWChecksum === "")
                    common.AdapterFWChecksum = AdapterFWChecksum;
                else if (AdapterFWChecksum !== common.AdapterFWChecksum)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter firmware checksum!"
                    };

                if (common.MeterId === "")
                    common.MeterId = MeterId;
                else if (MeterId !== common.MeterId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meter identification!"
                    };

                if (common.ObisId === "")
                    common.ObisId = ObisId;
                else if (ObisId !== common.ObisId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent OBIS identification!"
                    };

                if (common.UnitEncoded === 0)
                    common.UnitEncoded = UnitEncoded;
                else if (UnitEncoded !== common.UnitEncoded)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent unit (encoded) value!"
                    };

                if (common.Scalar === "")
                    common.Scalar = Scalar;
                else if (Scalar !== common.Scalar)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent measurement scaler!"
                    };

                if (common.UID === "")
                    common.UID = UID;
                else if (UID !== common.UID)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent user identification!"
                    };

                if (common.SessionId === 0)
                    common.SessionId = SessionId;
                else if (SessionId !== common.SessionId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent charging session identification!"
                    };

                if (previousTimestamp !== "" && previousTimestamp > Timestamp)
                    return {
                        status:   SessionVerificationResult.InconsistentTimestamps,
                        message:  "Inconsistent timestamps!"
                    };
                else
                    previousTimestamp = Timestamp;


                common.dataSets.push({
                    //@ts-ignore
                    "StatusMeter":        MeterStatus,
                    //@ts-ignore
                    "StatusAdapter":      AdapterStatus,
                    //@ts-ignore
                    "SecondIndex":        SecondIndex,
                    //@ts-ignore
                    "Timestamp":          Timestamp,
                    //@ts-ignore
                    "Value":              Value,
                    //@ts-ignore
                    "Paging":             Paging,
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

                 "chargingPools": [
                     {
                         "@id":                      "DE*GEF*POOL*1",
                         "description":              { "de": "GraphDefined Virtual Charging Pool - CI-Tests Pool 1" },

                         "chargingStations": [
                             {
                                 "@id":                      "DE*GEF*STATION*1*A",
                                 "description":              { "de": "GraphDefined Virtual Charging Station - CI-Tests Pool 1 / Station A" },
            //                     "firmwareVersion":          CTRArray[0]["Alfen"]["softwareVersion"],
            //                     "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
            //                     "address": {
            //                         "street":               address_street,
            //                         "postalCode":           address_zipCode,
            //                         "city":                 address_town
            //                     },
                                 "EVSEs": [
                                     {
                                         "@id":                      "DE*GEF*EVSE*1*A*1",
                                         "description":              { "de": "GraphDefined Virtual Charging Station - CI-Tests Pool 1 / Station A / EVSE 1" },
                                         "sockets":                  [ { } ],
                                         "meters": [
                                             {
                                                 "@id":                      common.MeterId,
            //                                     "vendor":                   CTRArray[0]["meterInfo"]["manufacturer"],
            //                                     "vendorURL":                "http://www.emh-metering.de",
            //                                     "model":                    CTRArray[0]["meterInfo"]["type"],
            //                                     "hardwareVersion":          "1.0",
            //                                     "firmwareVersion":          CTRArray[0]["meterInfo"]["firmwareVersion"],
            //                                     "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                 "publicKeys": [
                                                     {
                                                         "value":            common.PublicKey,
                                                         "algorithm":        common.PublicKeyFormat,
                                                         "format":           "DER",
                                                         "encoding":         "base32"
                                                      //   "signatures":       CTRArray[0]["meterInfo"]["publicKeySignatures"]
                                                     }
                                                 ]
                                             }
                                         ]
                                     }
                                 ]
                             }
                         ],
                     }
                 ],

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

                         "measurements": [

                             {

                                 "energyMeterId":        common.MeterId,
                                 "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/AlfenCrypt03+json",
                                 "name":                 OBIS2MeasurementName(parseOBIS(common.ObisId)),
                                 "obis":                 parseOBIS(common.ObisId),
            //                     "unit":                 CTRArray[0]["measuredValue"]["unit"],
                                 "unitEncoded":          common.UnitEncoded,
            //                     "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                                 "scale":                common.Scalar,

                                 "adapterId":            common.AdapterId,
                                 "adapterFWVersion":     common.AdapterFWVersion,
                                 "adapterFWChecksum":    common.AdapterFWChecksum,

                                 "signatureInfos": {
                                     "hash":                 "SHA256",
                                     "algorithm":            "ECC",
                                     "curve":                common.PublicKeyFormat,
                                     "format":               "rs",
                                     "encoding":             "base32"
                                 },

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
                                             "statusMeter":    dataSet["StatusMeter"],
                                             "statusAdapter":  dataSet["StatusAdapter"],
                                             "secondsIndex":   dataSet["SecondIndex"],
                                             "paginationId":   dataSet["Paging"],
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
                message:  "Exception occured: " + (exception instanceof Error ? exception.message : exception)
            }
        }

    }

    //#endregion


}

interface IAlfenMeasurement extends IMeasurement
{
    adapterId:                     string,
    adapterFWVersion:              string,
    adapterFWChecksum:             string
}

interface IAlfenMeasurementValue extends IMeasurementValue
{
    statusMeter:                   string,
    statusAdapter:                 string,
    secondsIndex:                  number,
    sessionId:                     string,
    paginationId:                  number,
    measurement:                   IAlfenMeasurement
}

interface IAlfenCrypt01Result extends ICryptoResult
{
    adapterId?:                    string
    adapterFWVersion?:             string
    adapterFWChecksum?:            string
    meterId?:                      string,
    meter?:                        IMeter,
    statusMeter?:                  string,
    statusAdapter?:                string,
    secondsIndex?:                 string,
    timestamp?:                    string,
    obisId?:                       string,
    unitEncoded?:                  string,
    scalar?:                       string,
    value?:                        string,
    uid?:                          string,
    sessionId?:                    string,
    paging?:                       string,

    hashValue?:                    any,
    publicKey?:                    string,
    publicKeyFormat?:              string,
    publicKeySignatures?:          any,
    signature?:                    IECCSignature
}


class AlfenCrypt01 extends ACrypt {

    constructor(chargy:  Chargy) {

        super("Alfen",
              chargy);

    }


    GenerateKeyPair()//options?: elliptic.ec.GenKeyPairOptions)
    {
        return this.curve192r1.genKeyPair();
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
            statusMeter:                  SetHex        (cryptoBuffer, measurementValue.statusMeter,                                               14, false),
            statusAdapter:                SetHex        (cryptoBuffer, measurementValue.statusAdapter,                                             15, false),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              16, true),
            paging:                       SetUInt32     (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obisId:                       SetHex        (cryptoBuffer, OBIS2Hex(measurementValue.measurement.obis),                                23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scalar:                       SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true)
        };

        // Only the first 24 bytes/192 bits are used!
        cryptoResult.hashValue  = (await sha256(cryptoBuffer)).substring(0, 48);

        // cryptoResult.publicKey    = publicKey.encode('hex').
        //                                       toLowerCase();

        const signature           = this.curve192r1.keyFromPrivate(privateKey.toString('hex')).
                                                    sign(cryptoResult.hashValue);

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

        var buffer        = new ArrayBuffer(82);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IAlfenCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,
            adapterId:                    SetHex        (cryptoBuffer, measurementValue.measurement.adapterId,                                   0),
            adapterFWVersion:             SetText       (cryptoBuffer, measurementValue.measurement.adapterFWVersion,                           10),
            adapterFWChecksum:            SetHex        (cryptoBuffer, measurementValue.measurement.adapterFWChecksum,                          14),
            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                              16),
            statusMeter:                  SetHex        (cryptoBuffer, measurementValue.statusMeter,                                            26, true),
            statusAdapter:                SetHex        (cryptoBuffer, measurementValue.statusAdapter,                                          28, true),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                           30, true),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                              34, false),
            obisId:                       SetHex        (cryptoBuffer, OBIS2Hex(measurementValue.measurement.obis),                             38, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                44),
            scalar:                       SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                      45),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                  46, true),
            uid:                          SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],  54),
            sessionId:                    SetUInt32     (cryptoBuffer, parseInt(measurementValue.measurement.chargingSession["@id"]),           74, true),
            paging:                       SetUInt32     (cryptoBuffer, measurementValue.paginationId,                                           78, true)
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

                                const publicKey  = buf2hex(this.chargy.base32Decode(cryptoResult.publicKey.toUpperCase(), 'RFC4648'));
                                let   result     = false;

                                switch (meter.publicKeys[0].algorithm)
                                {

                                    case "secp192r1":
                                        cryptoResult.hashValue  = (await sha256(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                     case "curve224k1":
                                        cryptoResult.hashValue  = (BigInt("0x" + (await sha256(cryptoBuffer))) >> BigInt(31));//.toString(16);
                                        result                  = this.curve224k1.validate(BigInt("0x" + cryptoResult.hashValue),
                                                                            BigInt("0x" + signatureExpected.r),
                                                                            BigInt("0x" + signatureExpected.s),
                                                                            [ BigInt("0x" + publicKey.substr(2,  56)),
                                                                              BigInt("0x" + publicKey.substr(58, 56)) ])
                                         break;

                                    case "curve256r1":
                                        cryptoResult.hashValue  = (await sha256(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                    case "curve384r1":
                                        cryptoResult.hashValue  = (await sha384(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                    case "curve521r1":
                                        cryptoResult.hashValue  = (await sha512(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                }

                                if (result)
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

        return {} as IAlfenCrypt01Result;

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

            this.CreateLine("Adapter Id",                  measurementValue.measurement.adapterId,                                           result.adapterId                             || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Adapter Firmware Version",    measurementValue.measurement.adapterFWVersion,                                    result.adapterFWVersion                      || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Adapter Firmware Prüfsumme",  measurementValue.measurement.adapterFWChecksum,                                   result.adapterFWChecksum                     || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zählernummer",                measurementValue.measurement.energyMeterId,                                       result.meterId                               || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Meter status",                hex2bin(measurementValue.statusMeter, true) + " (" + measurementValue.statusMeter + " hex)<br /><span class=\"statusInfos\">" +
                                                           this.DecodeMeterStatus(measurementValue.statusMeter).join("<br />") + "</span>",
                                                                                                                                             result.statusMeter                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Adapter status",              hex2bin(measurementValue.statusAdapter, true) + " (" + measurementValue.statusAdapter + " hex)<br /><span class=\"statusInfos\">" +
                                                           this.DecodeAdapterStatus(measurementValue.statusAdapter).join("<br />") + "</span>",
                                                                                                                                             result.statusAdapter                         || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex",               measurementValue.secondsIndex,                                                    result.secondsIndex                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",                 UTC2human(measurementValue.timestamp),                                            result.timestamp                             || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",               measurementValue.measurement.obis,                                                result.obisId                                || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",           measurementValue.measurement.unitEncoded,                                         result.unitEncoded                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",                  measurementValue.measurement.scale,                                               result.scalar                                || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                    measurementValue.value + " Wh",                                                   result.value                                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung",               measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",  pad(result.uid,                          20) || "",  infoDiv, PlainTextDiv);
            this.CreateLine("SessionId",                   measurementValue.measurement.chargingSession["@id"],                              result.sessionId                             || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler",          measurementValue.paginationId,                                                    result.paging                                || "",  infoDiv, PlainTextDiv);

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv != null)
        {

            if (HashedPlainTextDiv.parentElement != null)
                HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text (SHA256, hex)";

            HashedPlainTextDiv.innerHTML                                 = result.hashValue.match(/.{1,8}/g).join(" ");

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
                                                                         "base32)";

            if (!IsNullOrEmpty(result.publicKey))
                PublicKeyDiv.innerHTML                                 = result.publicKey.match(/.{1,4}/g)?.join(" ") ?? "";


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


    //#region Helper methods

    // Status flags MID meter
    private DecodeMeterStatus(statusValueHex: string) : Array<string>
    {

        let statusArray:string[] = [];

        try
        {

            let status = parseInt(statusValueHex, 16);

            //#region Status flags MID meter   (Bit  0-15)

            // see also: DZG DVH4013 paragraph 13.2.1

            if ((status &    1) ==    1)
                statusArray.push("RTC error");          // Non-fatal error

            if ((status &    2) ==    2)
                statusArray.push("EEPROM error");       // Fatal error!

            if ((status &    4) ==    4)
                statusArray.push("Dataflash error");    // Fatal error!

            // reserved     8
            // reserved    16
            // reserved    32
            // reserved    64
            // reserved   128

            if ((status &  256) ==  256)
                statusArray.push("Phase L1 failure");

            if ((status &  512) ==  512)
                statusArray.push("Phase L2 failure");

            if ((status & 1024) == 1024)
                statusArray.push("Phase L3 failure");

            if ((status & 2048) == 2048)
                statusArray.push("Phase sequence wrong");

            // reserved  4096
            // reserved  8192
            // reserved 16384
            // reserved 32768

            //#endregion

        }
        catch (exception)
        {
            statusArray.push("Invalid meter status!");
        }

        return statusArray;

    }


    // Status flags LMN adapter
    private DecodeAdapterStatus(statusValueHex: string) : Array<string>
    {

        let statusArray:string[] = [];

        try
        {

            let status = parseInt(statusValueHex, 16);

            //#region Status flags LMN adapter (Bit 16-31)

            if ((status & 1) == 1)
                statusArray.push("Adapter fatal error");

            // reserved     2
            // reserved     4
            // reserved     8
            // reserved    16
            // reserved    32
            // reserved    64
            // reserved   128
            // reserved   256
            // reserved   512

            // Ensures, that no energy has been consumed between charging sessions!
            if ((status &  1024) ==  1024)
                statusArray.push("Stop and Start Meter reading mismatch");

            if ((status &  2048) ==  2048)
                statusArray.push("Intermediate command");

            if ((status &  4096) ==  4096)
                statusArray.push("Stop charge command");

            if ((status &  8192) ==  8192)
                statusArray.push("Start charge command");

            if ((status & 16384) == 16384)
                statusArray.push("Adapter memory error");

            if ((status & 32768) == 32768)
                statusArray.push("Meter communication error");

            //#endregion

        }
        catch (exception)
        {
            statusArray.push("Invalid status!");
        }

        return statusArray;

    }

    //#endregion

}
