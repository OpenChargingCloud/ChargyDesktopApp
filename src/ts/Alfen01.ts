/*
 * Copyright (c) 2018-2024 GraphDefined GmbH <achim.friedland@graphdefined.com>
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
import Decimal                from 'decimal.js';

export class Alfen01  {

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

    //#region TryToParseALFENFormat(Content)

    public async TryToParseALFENFormat(Content: string|string[], ContainerInfos: any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
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

            if (ContainerInfos == null)
                ContainerInfos = {};

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
                    InternalSessionId:          0,
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

                const elements = signedValues[i]?.split(';');

                if (elements?.length != 6 && elements?.length != 7)
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Invalid number of array elements!",
                        certainty: 0
                    };

                const FormatId               = elements[0];                                       //  2 bytes
                const Type                   = elements[1];                                       //  1 byte; "0": start meter value | "1": stop meter value | "2": intermediate value
                const BlobVersion            = elements[2];                                       //  1 byte; "3" (current version)
                const PublicKey:ArrayBuffer  = this.chargy.base32Decode(elements[3], 'RFC4648');  // 25 bytes; base32 encoded; secp192r1
                const DataSet:  ArrayBuffer  = this.chargy.base32Decode(elements[4], 'RFC4648');  // 82 bytes; base32 encoded
                const Signature:ArrayBuffer  = this.chargy.base32Decode(elements[5], 'RFC4648');  // 48 bytes; base32 encoded; secp192r1

                // Verify common public key
                if (common.PublicKey === "")
                    common.PublicKey = elements[3] ?? "";
                else if (elements[3] !== common.PublicKey)
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Inconsistent public keys!",
                        certainty: 0
                    };

                if (FormatId              !== "AP" ||
                    Type?.length          !==  1   ||
                    BlobVersion?.length   !==  1   ||
                    BlobVersion           !== "3"  ||
                    PublicKey.byteLength  !== 25   ||
                    DataSet.byteLength    !== 82   ||
                    Signature.byteLength  !== 48)
                {
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Invalid data format!",
                        certainty: 0
                    };
                }

                switch (PublicKey.byteLength)
                {
                    case 25:
                        common.PublicKeyFormat   = "secp192r1";
                        break;
                }

                // Everything is Little Endian
                let AdapterId            = this.bufferToHex(DataSet.slice( 0, 10));                                                              // 0a 54 65 73 74 44 65 76 00 09
                let AdapterFWVersion     = String.fromCharCode.apply(null, new Uint8Array(DataSet.slice(10, 14)) as any);                        // ASCII: 76 30 31 34 (v014)
                let AdapterFWChecksum    = this.bufferToHex(DataSet.slice(14, 16));                                                              // B9 79
                let MeterId              = this.bufferToHex(DataSet.slice(16, 26));                                                              // 0A 01 44 5A 47 00 33 00 25 02
                let MeterStatus          = this.bufferToHex(DataSet.slice(26, 28), true);                                                        // 00 00
                let AdapterStatus        = this.bufferToHex(DataSet.slice(28, 30), true);                                                        // 00 10
                let SecondIndex          = new DataView(DataSet.slice(30, 34), 0).getInt32(0, true);                                             // 28 71 9A 02 => 43675944 dec
                let Timestamp            = new Date(new DataView(DataSet.slice(34, 38), 0).getInt32(0, true) * 1000).toISOString();              // UNIX timestamp: 91 91 3D 5C => 1547538833 => 2019-01-15T07:53:53Z
                let ObisId               = this.bufferToHex(DataSet.slice(38, 44));                                                              // 01 00 01 08 00 ff
                let UnitEncoded          = this.bufferToNumber(DataSet.slice(44, 45));                                                           // 1e => 30 => Wh
                let Scalar               = this.bufferToHex(DataSet.slice(45, 46));                                                              // 00
                let Value                = new Number(new DataView(DataSet.slice(46, 54), 0).getBigInt64(0, true));                    // 73 29 00 00 00 00 00 00 => 10611 Wh so 10,611 KWh
                let UID                  = String.fromCharCode.apply(null, new Uint8Array(DataSet.slice(54, 74)) as any).replace(/\0.*$/g, '');  // ASCII: 30 35 38 39 38 41 42 42 00 00 00 00 00 00 00 00 00 00 00 00 => UID: 05 89 8A BB
                let InternalSessionId    = new DataView(DataSet.slice(74, 78), 0).getInt32(0, true)                                              // 81 01 00 00 => 385(dec)
                let Paging               = new DataView(DataSet.slice(78, 82), 0).getInt32(0, true);                                             // 47 02 00 00 => 583(dec)


                if (common.AdapterId === "")
                    common.AdapterId = AdapterId;
                else if (AdapterId !== common.AdapterId)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter identification!",
                        certainty: 0
                    };

                if (common.AdapterFWVersion === "")
                    common.AdapterFWVersion = AdapterFWVersion;
                else if (AdapterFWVersion !== common.AdapterFWVersion)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter firmware version!",
                        certainty: 0
                    };

                if (common.AdapterFWChecksum === "")
                    common.AdapterFWChecksum = AdapterFWChecksum;
                else if (AdapterFWChecksum !== common.AdapterFWChecksum)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent adapter firmware checksum!",
                        certainty: 0
                    };

                if (common.MeterId === "")
                    common.MeterId = MeterId;
                else if (MeterId !== common.MeterId)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meter identification!",
                        certainty: 0
                    };

                if (common.ObisId === "")
                    common.ObisId = ObisId;
                else if (ObisId !== common.ObisId)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent OBIS identification!",
                        certainty: 0
                    };

                if (common.UnitEncoded === 0)
                    common.UnitEncoded = UnitEncoded;
                else if (UnitEncoded !== common.UnitEncoded)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent unit (encoded) value!",
                        certainty: 0
                    };

                if (common.Scalar === "")
                    common.Scalar = Scalar;
                else if (Scalar !== common.Scalar)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent measurement scalar!",
                        certainty: 0
                    };

                if (common.UID === "")
                    common.UID = UID;
                else if (UID !== common.UID)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent user identification!",
                        certainty: 0
                    };

                if (common.InternalSessionId === 0)
                    common.InternalSessionId = InternalSessionId;
                else if (InternalSessionId !== common.InternalSessionId)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent internal charging session identification!",
                        certainty: 0
                    };

                if (previousTimestamp !== "" && previousTimestamp > Timestamp)
                    return {
                        status:   chargyInterfaces.SessionVerificationResult.InconsistentTimestamps,
                        message:  "Inconsistent timestamps!",
                        certainty: 0
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
                    "Value":              new Decimal(Value.toString()),  // Workaround for Decimal.js
                    //@ts-ignore
                    "Paging":             Paging,
                    //@ts-ignore
                    "Signature":          this.bufferToHex(Signature)
                });

            }

            var evseId             = ContainerInfos.EVSEId            ?? "DE*GEF*EVSE*CHARGY*1";
            var chargingStationId  = ContainerInfos.ChargingStationId ?? "DE*GEF*STATION*CHARGY*1";
            var n                  = common.dataSets.length-1;

            var _CTR: IAlfenChargeTransparencyRecord = {

                 "@id":              ContainerInfos.chargingSession?.["@id"] ?? common.InternalSessionId,
                 "@context":         "https://open.charging.cloud/contexts/CTR+json",

                 "begin":            common.dataSets[0]["Timestamp"],
                 "end":              common.dataSets[n]["Timestamp"],

                 "description": {
                     "de":           "Alle Ladevorgänge",
                     "en":           "All charging sessions"
                 },

                 "contract": {
                     "@id":          common.UID,
                 },

                 "chargingPools": [
                     {
                         "@id":                      "DE*GEF*POOL*CHARGY*1",
                         "description":              { "en": "GraphDefined CHARGY Virtual Charging Pool 1" },

                         "chargingStations": [
                             {
                                 "@id":                      chargingStationId,
                                 "description":              ContainerInfos.chargingStation?.description,
                                 "manufacturer":             ContainerInfos.chargingStation?.manufacturer,
                                 "model":                    ContainerInfos.chargingStation?.type,
                                 "serialNumber":             ContainerInfos.chargingStation?.serialNumber,
                                 "firmwareVersion":          ContainerInfos.chargingStation?.softwareVersion,
                                 "legalCompliance":          ContainerInfos.chargingStation?.legalCompliance,
                                 "geoLocation":              ContainerInfos.chargingStation?.geoLocation,
                                 "address":                  ContainerInfos.chargingStation?.address,
                                 "EVSEs": [
                                     {
                                         "@id":                      evseId,
                                         "description":              ContainerInfos.EVSE?.description,
                                         "connectors": [ {
                                                 "type":                     ContainerInfos.connector?.type,
                                                 "looses":                   ContainerInfos.connector?.looses
                                          } ],
                                         "meters": [
                                             {
                                                 "@id":                      common.MeterId,
                                                 "manufacturer":             ContainerInfos.energyMeter?.manufacturer,
                                                 "manufacturerURL":          ContainerInfos.energyMeter?.manufacturerURL,
                                                 "model":                    ContainerInfos.energyMeter?.model,
                                                 "modelURL":                 ContainerInfos.energyMeter?.modelURL,
                                                 "hardwareVersion":          ContainerInfos.energyMeter?.hardwareVersion,
                                                 "firmwareVersion":          common.AdapterFWVersion  ?? ContainerInfos.energyMeter?.firmwareVersion,
                                                 "firmwareChecksum":         common.AdapterFWChecksum ?? ContainerInfos.energyMeter?.firmwareChecksum,
                                                 "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/AlfenCrypt01",
                                                 "publicKeys": [
                                                     {
                                                         "value":                    common.PublicKey,
                                                         "algorithm":                common.PublicKeyFormat,
                                                         "format":                   "DER",
                                                         "encoding":                 "base32"
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

                         "@id":                          ContainerInfos.chargingSession?.["@id"] ?? common.InternalSessionId.toString(),
                         "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/AlfenCrypt01+json",
                         "begin":                        common.dataSets[0]["Timestamp"],
                         "end":                          common.dataSets[n]["Timestamp"],
                         "internalSessionId":            common.InternalSessionId.toString(),
                         "EVSEId":                       evseId,

                         "authorizationStart": {
                             "@id":                      common.UID,
                         },

                         "costs":                        ContainerInfos.chargingCosts,

                         "measurements": [

                             {

                                 "energyMeterId":        common.MeterId,
                                 "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/AlfenCrypt03+json",
                                 "name":                 chargyLib.OBIS2MeasurementName(chargyLib.parseOBIS(common.ObisId)),
                                 "obis":                 chargyLib.parseOBIS(common.ObisId),
                                 "unitEncoded":          common.UnitEncoded,
                                 "scale":                parseFloat(common.Scalar),

                                 "adapterId":            common.AdapterId,   // ToDo: Add adapterId to the measurement?!!??
                                 "adapterFWVersion":     common.AdapterFWVersion,
                                 "adapterFWChecksum":    common.AdapterFWChecksum,

                                 "signatureInfos": {
                                     "hash":                 chargyInterfaces.CryptoHashAlgorithms.SHA256,
                                     "algorithm":            chargyInterfaces.CryptoAlgorithms.ECC,
                                     "curve":                common.PublicKeyFormat,
                                     "format":               chargyInterfaces.SignatureFormats.RS,
                                     "encoding":             "base32"
                                 },

                                 "values": [ ]

                             }

                         ]

                     }

                 ],

                 "certainty":        1

            };

            for (var dataSet of common.dataSets)
            {
                if (_CTR["chargingSessions"]?.[0]?.["measurements"]?.[0]?.["values"] != null)
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
                                    "r":  dataSet["Signature"].substring(0, 48),
                                    "s":  dataSet["Signature"].substring(48)
                                }
                            ]
                        }
                    );
            }


            _CTR["status"] = chargyInterfaces.SessionVerificationResult.Unvalidated;

            //await this.processChargeTransparencyRecord(_CTR);
            return _CTR as chargyInterfaces.IChargeTransparencyRecord;

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

    }

    //#endregion


}

export interface IAlfenMeasurement extends chargyInterfaces.IMeasurement
{
    adapterId:                     string,
    adapterFWVersion:              string,
    adapterFWChecksum:             string
}

export interface IAlfenMeasurementValue extends chargyInterfaces.IMeasurementValue
{
    statusMeter:                   string,
    statusAdapter:                 string,
    secondsIndex:                  number,
    sessionId:                     string,
    paginationId:                  number,
    measurement:                   IAlfenMeasurement
}

export interface IAlfenCrypt01Result extends chargyInterfaces.ICryptoResult
{
    adapterId?:                    string
    adapterFWVersion?:             string
    adapterFWChecksum?:            string
    meterId?:                      string,
    meter?:                        chargyInterfaces.IMeter,
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
    signature?:                    chargyInterfaces.ISignatureRS
}


export interface IAlfenChargingSession extends chargyInterfaces.IChargingSession
{
    internalSessionId?:         string;
    meter?:                     chargyInterfaces.IMeter;
    measurements:               Array<IAlfenMeasurement>;
}

export interface IAlfenChargeTransparencyRecord extends chargyInterfaces.IChargeTransparencyRecord
{
    chargingSessions?:          Array<IAlfenChargingSession>;
}




export class AlfenCrypt01 extends ACrypt {

    constructor(chargy:  Chargy) {
        super("Alfen",
              chargy);
    }


    async VerifyChargingSession(chargingSession: chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
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
                        await this.VerifyMeasurement(measurementValue as IAlfenMeasurementValue);
                    }


                    // Find an overall result...
                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;

                    for (var measurementValue of measurement.values)
                    {
                        if (sessionResult                   == chargyInterfaces.SessionVerificationResult.ValidSignature &&
                            measurementValue.result?.status != chargyInterfaces.VerificationResult.ValidSignature)
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
            status:    sessionResult,
            certainty: .5
        }

    }

    async VerifyMeasurement(measurementValue: IAlfenMeasurementValue): Promise<IAlfenCrypt01Result>
    {

        function setResult(verificationResult: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        const buffer        = new ArrayBuffer(82);
        const cryptoBuffer  = new DataView(buffer);

        const cryptoResult:IAlfenCrypt01Result = {
            status:                       chargyInterfaces.VerificationResult.InvalidSignature,
            adapterId:                    chargyLib.SetHex        (cryptoBuffer, measurementValue.measurement.adapterId,                                           0),
            adapterFWVersion:             chargyLib.SetText       (cryptoBuffer, measurementValue.measurement.adapterFWVersion,                                    10),
            adapterFWChecksum:            chargyLib.SetHex        (cryptoBuffer, measurementValue.measurement.adapterFWChecksum,                                   14),
            meterId:                      chargyLib.SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                       16),
            statusMeter:                  chargyLib.SetHex        (cryptoBuffer, measurementValue.statusMeter,                                                     26, true),
            statusAdapter:                chargyLib.SetHex        (cryptoBuffer, measurementValue.statusAdapter,                                                   28, true),
            secondsIndex:                 chargyLib.SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                                    30, true),
            timestamp:                    chargyLib.SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                       34, false),
            obisId:                       chargyLib.SetHex        (cryptoBuffer, chargyLib.OBIS2Hex(measurementValue.measurement.obis),                            38, false),
            unitEncoded:                  chargyLib.SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded ?? 0,                                    44),
            scalar:                       chargyLib.SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                               45),
            value:                        chargyLib.SetUInt64D    (cryptoBuffer, measurementValue.value,                                                           46, true),
            uid:                          chargyLib.SetText       (cryptoBuffer, (measurementValue.measurement.chargingSession?.authorizationStart["@id"] ?? ""),  54),
            sessionId:                    chargyLib.SetUInt32     (cryptoBuffer, parseInt(measurementValue.measurement.chargingSession?.internalSessionId ?? ""),  74, true),
            paging:                       chargyLib.SetUInt32     (cryptoBuffer, measurementValue.paginationId,                                                    78, true)
        };


        const signatureExpected = measurementValue.signatures?.[0] as chargyInterfaces.ISignatureRS;
        if (signatureExpected != null)
        {

            try
            {

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos!.algorithm,
                    format:     measurementValue.measurement.signatureInfos!.format,
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

                            cryptoResult.publicKey            = meter.publicKeys[0]?.value?.toLowerCase();
                            cryptoResult.publicKeyFormat      = meter.publicKeys[0]?.format;
                            cryptoResult.publicKeySignatures  = meter.publicKeys[0]?.signatures;

                            try
                            {

                                const publicKey  = chargyLib.buf2hex(this.chargy.base32Decode(cryptoResult.publicKey?.toUpperCase(), 'RFC4648'));
                                let   result     = false;

                                switch (meter?.publicKeys[0]?.algorithm)
                                {

                                    case "secp192r1":
                                        cryptoResult.hashValue  = (await chargyLib.sha256(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                     case "curve224k1":
                                        cryptoResult.hashValue  = (BigInt("0x" + (await chargyLib.sha256(cryptoBuffer))) >> BigInt(31));//.toString(16);
                                        result                  = this.curve224k1.validate(BigInt("0x" + cryptoResult.hashValue),
                                                                            BigInt("0x" + signatureExpected.r),
                                                                            BigInt("0x" + signatureExpected.s),
                                                                            [ BigInt("0x" + publicKey.substr(2,  56)),
                                                                              BigInt("0x" + publicKey.substr(58, 56)) ])
                                         break;

                                    case "curve256r1":
                                        cryptoResult.hashValue  = (await chargyLib.sha256(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                    case "curve384r1":
                                        cryptoResult.hashValue  = (await chargyLib.sha384(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                    case "curve521r1":
                                        cryptoResult.hashValue  = (await chargyLib.sha512(cryptoBuffer));
                                        result                  = this.curve192r1.keyFromPublic(publicKey, 'hex').
                                                                                  verify       (cryptoResult.hashValue.toUpperCase(),
                                                                                                cryptoResult.signature);
                                        break;

                                }

                                if (result)
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

            this.CreateLine("Adapter Id",                  measurementValue.measurement.adapterId,                                                   result.adapterId              || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Adapter Firmware Version",    measurementValue.measurement.adapterFWVersion,                                            result.adapterFWVersion       || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Adapter Firmware Prüfsumme",  measurementValue.measurement.adapterFWChecksum,                                           result.adapterFWChecksum      || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zählernummer",                measurementValue.measurement.energyMeterId,                                               result.meterId                || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Meter status",                chargyLib.hex2bin(measurementValue.statusMeter, true) + " (" + measurementValue.statusMeter + " hex)<br /><span class=\"statusInfos\">" +
                                                           this.DecodeMeterStatus(measurementValue.statusMeter).join("<br />") + "</span>",
                                                                                                                                                     result.statusMeter            || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Adapter status",              chargyLib.hex2bin(measurementValue.statusAdapter, true) + " (" + measurementValue.statusAdapter + " hex)<br /><span class=\"statusInfos\">" +
                                                           this.DecodeAdapterStatus(measurementValue.statusAdapter).join("<br />") + "</span>",    
                                                                                                                                                     result.statusAdapter          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex",               measurementValue.secondsIndex,                                                            result.secondsIndex           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",                 chargyLib.UTC2human(measurementValue.timestamp),                                          result.timestamp              || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",               measurementValue.measurement.obis,                                                        result.obisId                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",           measurementValue.measurement.unitEncoded ?? 0,                                            result.unitEncoded            || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",                  measurementValue.measurement.scale,                                                       result.scalar                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                    measurementValue.value + " Wh",                                                           result.value                  || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung",              (measurementValue.measurement.chargingSession?.authorizationStart["@id"] ?? "") + " hex",  chargyLib.pad(result.uid, 20) || "",  infoDiv, PlainTextDiv);
            this.CreateLine("SessionId",                  (measurementValue.measurement.chargingSession?.["@id"] ?? ""),                             result.sessionId              || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler",          measurementValue.paginationId,                                                            result.paging                 || "",  infoDiv, PlainTextDiv);

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
                HashedPlainTextDiv.parentElement.children[0].innerHTML  = "Hashed plain text (SHA256, hex)";
            }

            HashedPlainTextDiv.innerHTML                                = result.hashValue.match(/.{1,8}/g).join(" ");

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
                                                                         "base32)";
            }

            if (!chargyLib.IsNullOrEmpty(result.publicKey))
                PublicKeyDiv.innerHTML                                 = result.publicKey.match(/.{1,4}/g)?.join(" ") ?? "";


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
                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(
                                                               measurementValue.measurement.chargingSession?.chargingStation,
                                                               measurementValue.measurement.chargingSession?.EVSE,
                                                               //@ts-ignore
                                                               measurementValue.measurement.chargingSession.EVSE.meters[0],
                                                               //@ts-ignore
                                                               measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys[0],
                                                               signature
                                                           );

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
                SignatureExpectedDiv.parentElement.children[0].innerHTML = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";
            }

            if (result.signature.r && result.signature.s)
                SignatureExpectedDiv.innerHTML = "r: " + result.signature.r.toLowerCase().match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                 "s: " + result.signature.s.toLowerCase().match(/.{1,8}/g)?.join(" ");

            else if (result.signature.value)
                SignatureExpectedDiv.innerHTML = result.signature.value.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

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


    // Helper methods

    //#region Status flags MID meter

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

    //#endregion

    //#region Status flags LMN adapter

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
