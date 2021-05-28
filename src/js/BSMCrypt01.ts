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

///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="ACrypt.ts" />


interface IBSMMeasurementValue extends IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

interface IBSMCrypt01Result extends ICryptoResult
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


class BSMCrypt01 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy:  Chargy) {

        super("ECC secp256r1",
              chargy);

    }


    //#region tryToParseBSM_WS36aFormat(Content)

    public async tryToParseBSM_WS36aFormat(Content: any) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        if (Array.isArray(Content) || !Array.isArray(Content.signedMeterValues))
            return {
                status: SessionVerificationResult.InvalidSessionFormat
            }

        //#region Documentation

        // {
        //     "@context":    "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0",
        //     "@id":         "001BZR1521070003-18899",
        //     "time":        "2021-05-26T15:55:56+02:00",
        //     "meterInfo": {
        //         "firmwareVersion":  "1.8:33C4:DB63, 08d1aa3",
        //         "publicKey":        "3059301306072a8648ce3d020106082a8648ce3d030107034200044bfd02c1d85272ceea9977db26d72cc401d9e5602faeee7ec7b6b62f9c0cce34ad8d345d5ac0e8f65deb5ff0bb402b1b87926bd1b7fc2dbc3a9774e8e70c7254",
        //         "meterId":          "001BZR1521070003",
        //         "manufacturer":     "BAUER Electronic",
        //         "type":             "BSM-WS36A-H01-1311-0000"
        //     },
        //     "operatorInfo": "See https://www.chargeit-mobility.com/wp-content/uploads/chargeIT-Baumusterpr%C3%BCfbescheinigung-Lades%C3%A4ule-Online.pdf for type examination certificate",
        //     "contract": {
        //         "id":                "chargeIT up 12*4, id: 12345678abcdef"
        //     },
        //     "measurementId":         18899,
        //     "value": {
        //         "measurand": {
        //             "id":            "1-0:1.8.0*198",
        //             "name":          "RCR"
        //         },
        //         "measuredValue": {
        //             "scale":         0,
        //             "unit":          "WATT_HOUR",
        //             "unitEncoded":   30,
        //             "value":         0,
        //             "valueType":     "UnsignedInteger32"
        //         }
        //     },

        //#region Additional values

        //   "additionalValues": [
        //     {
        //       "measurand": {
        //         "name": "Typ"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unitEncoded": 255,
        //         "value": 1,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "id": "1-0:1.8.0*198",
        //         "name": "RCR"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unit": "WATT_HOUR",
        //         "unitEncoded": 30,
        //         "value": 0,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "id": "1-0:1.8.0*255",
        //         "name": "TotWhImp"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unit": "WATT_HOUR",
        //         "unitEncoded": 30,
        //         "value": 77890,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "id": "1-0:1.7.0*255",
        //         "name": "W"
        //       },
        //       "measuredValue": {
        //         "scale": 1,
        //         "unit": "WATT",
        //         "unitEncoded": 27,
        //         "value": 0,
        //         "valueType": "Integer32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "id": "1-0:0.0.0*255",
        //         "name": "MA1"
        //       },
        //       "measuredValue": {
        //         "unitEncoded": 255,
        //         "value": "001BZR1521070003",
        //         "valueType": "String",
        //         "valueEncoding": "ISO-8859-1"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "RCnt"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unitEncoded": 255,
        //         "value": 18899,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "OS"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unit": "SECOND",
        //         "unitEncoded": 7,
        //         "value": 1266738,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "Epoch"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unit": "SECOND",
        //         "unitEncoded": 7,
        //         "value": 1602145359,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "TZO"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unit": "MINUTE",
        //         "unitEncoded": 6,
        //         "value": 120,
        //         "valueType": "Integer32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "EpochSetCnt"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unitEncoded": 255,
        //         "value": 10189,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "EpochSetOS"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unit": "SECOND",
        //         "unitEncoded": 7,
        //         "value": 1266706,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "DI"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unitEncoded": 255,
        //         "value": 1,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "DO"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unitEncoded": 255,
        //         "value": 0,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "Meta1"
        //       },
        //       "measuredValue": {
        //         "unitEncoded": 255,
        //         "value": "chargeIT up 12*4, id: 12345678abcdef",
        //         "valueType": "String",
        //         "valueEncoding": "ISO-8859-1"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "Meta2"
        //       },
        //       "measuredValue": {
        //         "unitEncoded": 255,
        //         "value": "demo data 2",
        //         "valueType": "String",
        //         "valueEncoding": "ISO-8859-1"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "Meta3"
        //       },
        //       "measuredValue": {
        //         "unitEncoded": 255,
        //         "valueType": "String",
        //         "valueEncoding": "ISO-8859-1"
        //       }
        //     },
        //     {
        //       "measurand": {
        //         "name": "Evt"
        //       },
        //       "measuredValue": {
        //         "scale": 0,
        //         "unitEncoded": 255,
        //         "value": 0,
        //         "valueType": "UnsignedInteger32"
        //       }
        //     }
        //   ],

        //#endregion

        //     "signature": "30460221009ada646742da37b27485b4887c2bd7262e2fc56e4dceb864221cddb2d31b19420221008d78ac0b205f18746c0c6d9c8f6fb53154082f167193685159e9af44ca4d9b59"
        // }

        //#endregion

        try
        {

            let common = {
                    Context:                     Content.signedMeterValues[0]["@context"],
                    MeterFirmwareVersion:        Content.meterInfo?.firmwareVersion        ?? Content.signedMeterValues[0].meterInfo?.firmwareVersion,
                    MeterPublicKey:              Content.meterInfo?.publicKey              ?? Content.signedMeterValues[0].meterInfo?.publicKey,
                    MeterId:                     Content.meterInfo?.meterId                ?? Content.signedMeterValues[0].meterInfo?.meterId,
                    MeterManufacturer:           Content.meterInfo?.manufacturer           ?? Content.signedMeterValues[0].meterInfo?.manufacturer,
                    MeterType:                   Content.meterInfo?.type                   ?? Content.signedMeterValues[0].meterInfo?.type,
                    OperatorInfo:                Content.operatorInfo                      ?? Content.signedMeterValues[0].operatorInfo,
                    ContractId:                  Content.contract?.id                      ?? Content.signedMeterValues[0].contract?.id,
                    ValueMeasurandId:            Content.value?.measurand?.id              ?? Content.signedMeterValues[0].value?.measurand?.id, // OBIS Id
                    ValueMeasurandName:          Content.value?.measurand?.name            ?? Content.signedMeterValues[0].value?.measurand?.name,
                    MeasuredValueScale:          Content.value?.measuredValue?.scale       ?? Content.signedMeterValues[0].value?.measuredValue?.scale,
                    MeasuredValueUnit:           Content.value?.measuredValue?.unit        ?? Content.signedMeterValues[0].value?.measuredValue?.unit,
                    MeasuredValueUnitEncoded:    Content.value?.measuredValue?.unitEncoded ?? Content.signedMeterValues[0].value?.measuredValue?.unitEncoded,
                    MeasuredValueValueType:      Content.value?.measuredValue?.valueType   ?? Content.signedMeterValues[0].value?.measuredValue?.valueType,
                    ChargePointSoftwareVersion:  Content.chargePoint?.softwareVersion      ?? Content.signedMeterValues[0].chargePoint?.softwareVersion,
                    dataSets:                  [] as any[]
                };

            let previousId     = "";
            let previousTime   = "";
            let previousValue  = "";

            for (let i=0; i<Content.signedMeterValues.length; i++)
            {

                const currentMeasurement = Content.signedMeterValues[i];

                if (currentMeasurement["@context"] !== common.Context)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent @context!"
                    };


                if (previousId !== "" && currentMeasurement["@id"] <= previousId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent measurement identifications!"
                    };
                previousId   = currentMeasurement["@id"];


                if (previousTime !== "" && currentMeasurement.time <= previousTime)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent measurement timestamps!"
                    };
                previousTime = currentMeasurement.time;


                if (previousValue !== "" && currentMeasurement.value?.measuredValue?.value < previousValue)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent measurement values!"
                    };
                previousValue = currentMeasurement.value?.measuredValue?.value;


                if (currentMeasurement.meterInfo)
                {

                    if (currentMeasurement.meterInfo?.firmwareVersion    !== common.MeterFirmwareVersion)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent meterInfo.firmwareVersion!"
                        };

                    if (currentMeasurement.meterInfo?.publicKey          !== common.MeterPublicKey)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent meterInfo.publicKey!"
                        };

                    if (currentMeasurement.meterInfo?.meterId            !== common.MeterId)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent meterInfo.meterId!"
                        };

                    if (currentMeasurement.meterInfo?.manufacturer       !== common.MeterManufacturer)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent meterInfo.manufacturer!"
                        };

                    if (currentMeasurement.meterInfo?.type               !== common.MeterType)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent meterInfo.type!"
                        };

                }

                if (currentMeasurement.operatorInfo)
                {
                    if (currentMeasurement.operatorInfo                  !== common.OperatorInfo)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent operatorInfo!"
                        };
                }

                if (currentMeasurement.contract)
                {
                    if (currentMeasurement.contract?.id                  !== common.ContractId)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent contract.id!"
                        };
                }

                if (currentMeasurement.measurand)
                {

                    if (currentMeasurement.measurand?.firmwareVersion    !== common.ValueMeasurandId)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent measurand.id!"
                        };

                    if (currentMeasurement.measurand?.name               !== common.ValueMeasurandName)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent measurand.name!"
                        };

                }

                if (currentMeasurement.measuredValue)
                {

                    if (currentMeasurement.measuredValue?.scale          !== common.MeasuredValueScale)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent measuredValue.scale!"
                        };

                    if (currentMeasurement.measuredValue?.unit           !== common.MeasuredValueUnit)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent measuredValue.unit!"
                        };

                    if (currentMeasurement.measuredValue?.unitEncoded    !== common.MeasuredValueUnitEncoded)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent measuredValue.unitEncoded!"
                        };

                    if (currentMeasurement.measuredValue?.valueType      !== common.MeasuredValueValueType)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent measuredValue.valueType!"
                        };

                }

                if (currentMeasurement.chargePoint)
                {
                    if (currentMeasurement.chargePoint?.softwareVersion  !== common.ChargePointSoftwareVersion)
                        return {
                            status:   SessionVerificationResult.InvalidSessionFormat,
                            message:  "Inconsistent chargePoint.softwareVersion!"
                        };
                }


                // ToDo: Check additional values!


                common.dataSets.push({
                    //@ts-ignore
                    //"StatusMeter":        MeterStatus,
                    //@ts-ignore
                    //"StatusAdapter":      AdapterStatus,
                    //@ts-ignore
                    //"SecondIndex":        SecondIndex,
                    //@ts-ignore
                    "time":               currentMeasurement.time,
                    //@ts-ignore
                    "value":              currentMeasurement.value?.measuredValue?.value,
                    //@ts-ignore
                    "measurementId":      currentMeasurement.measurementId,
                    //@ts-ignore
                    //"Paging":             Paging,
                    //@ts-ignore
                    "signature":          currentMeasurement.signature
                });

            }





            var n = common.dataSets.length-1;
            var _CTR: any = { //IChargeTransparencyRecord = {

                 "@id":              Content["@id"],
                 "@context":         "https://open.charging.cloud/contexts/CTR+json",

                 "begin":            common.dataSets[0].time,
                 "end":              common.dataSets[n].time,

                 "description": {
                     "de":           "Alle Ladevorgänge"
                 },

                 "contract": {
                     "@id":          common.ContractId
                     //"type":         CTRArray[0]["contract"]["type"],
                     //"username":     "",
                     //"email":        ""
                 },

                 "chargingPools": [
                     {
                         //"@id":                      "DE*GEF*POOL*1",
                         //"description":              { "de": "GraphDefined Virtual Charging Pool - CI-Tests Pool 1" },
                         "chargingStations": [
                             {
                                 //"@id":                      "DE*GEF*STATION*1*A",
                                 //"description":              { "de": "GraphDefined Virtual Charging Station - CI-Tests Pool 1 / Station A" },
                                 "firmwareVersion":          common.ChargePointSoftwareVersion,
                                 "geoLocation": {
                                     "lat":                  Content.placeInfo?.geoLocation?.lat,
                                     "lng":                  Content.placeInfo?.geoLocation?.lon
                                 },
                                 "address": {
                                     "street":               Content.placeInfo?.address?.street,
                                     "postalCode":           Content.placeInfo?.address?.zipCode,
                                     "city":                 Content.placeInfo?.address?.town
                                 },
                                 "manufacturer": {
                                     //"hardwareVersion":      "",
                                     //"firmwareVersion":      "",
                                     "calibrationLaw":       common.OperatorInfo,
                                 },

                                 "EVSEs": [
                                     {
                                         "@id":                      Content.placeInfo.evseId,
                                         //"description":              { "de": "GraphDefined Virtual Charging Station - CI-Tests Pool 1 / Station A / EVSE 1" },
                                         //"sockets": [
                                         //    {
                                         //        "type":             "type2",
                                         //        "cableAttached":    false
                                         //    }
                                         //],
                                         "meters": [
                                             {
                                                 "@id":                      common.MeterId,
                                                 "vendor":                   common.MeterManufacturer,  //ToDo: Change me to "manufacturer", but check other implementations!
                                                 //"vendorURL":                "http://www.emh-metering.de",
                                                 "model":                    common.MeterType,
                                                 //"hardwareVersion":          "1.0",
                                                 "firmwareVersion":          common.MeterFirmwareVersion,
                                                 //"adapterId":                common.AdapterId,
                                                 //"adapterFWVersion":         common.MeterFirmwareVersion,
                                                 //"adapterFWChecksum":        common.AdapterFWChecksum,
                                                 "signatureFormat":          common.Context,            //ToDo: Move me into "signatureInfos"!
                                                 "signatureInfos": {
                                                    "hash":                  "SHA256",
                                                    "algorithm":             "ECC",
                                                    "curve":                 "secp256r1",
                                                    "format":                "rs",
                                                    "encoding":              "hex"
                                                 },                                                 
                                                 "publicKeys": [
                                                     {
                                                         "value":            common.MeterPublicKey,
                                                         "algorithm":        "secp256r1",
                                                         "format":           "DER",
                                                         "encoding":         "HEX"
                                                         //"signatures":       CTRArray[0]["meterInfo"]["publicKeySignatures"]
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

                         "@id":                          Content["@id"],
                         "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/bsm-ws36a-v0+json",
                         "begin":                        common.dataSets[0].time,
                         "end":                          common.dataSets[n].time,
                         "EVSEId":                       Content.placeInfo.evseId,

                         "authorizationStart": {
                             "@id":                      common.ContractId,
                            //  "type":                     CTRArray[0]["contract"]["type"],
                            //  "timestamp":                this.moment.unix(CTRArray[0]["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                            //                                               CTRArray[0]["contract"]["timestampLocal"]["localOffset"] +
                            //                                               CTRArray[0]["contract"]["timestampLocal"]["seasonOffset"]).format(),
                         },

                         "measurements": [
                             {
                                 "energyMeterId":        common.MeterId,
                                 //"@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/bsm-ws36a-v0+json",
                                 "name":                 OBIS2MeasurementName(common.ValueMeasurandId),
                                 "obis":                 common.ValueMeasurandId,
                                 "unit":                 common.MeasuredValueUnit,
                                 "unitEncoded":          common.MeasuredValueUnitEncoded,
                                 "valueType":            common.MeasuredValueValueType,
                                 "scale":                common.MeasuredValueScale,
                                 "values": [ ]
                             }
                         ]

                     }
                 ]

            };


            const ASN1_SignatureSchema = this.chargy.asn1.define('Signature', function() {
                //@ts-ignore
                this.seq().obj(
                    //@ts-ignore
                    this.key('r').int(),
                    //@ts-ignore
                    this.key('s').int()
                );
            });

            for (let dataSet of common.dataSets)
            {

                let ASN1Signature = ASN1_SignatureSchema.decode(Buffer.from(dataSet.signature, 'hex'), 'der');

                 _CTR["chargingSessions"][0]["measurements"][0]["values"].push(
                                         {
                                             "timestamp":          dataSet.time,
                                             "value":              dataSet.value,
                                            //  "statusMeter":    dataSet["StatusMeter"],
                                            //  "statusAdapter":  dataSet["StatusAdapter"],
                                            //  "secondsIndex":   dataSet["SecondIndex"],
                                            //  "paginationId":   dataSet["Paging"],
                                             "signatures": [
                                                 {
                                                     "r":          ASN1Signature.r.toString(16),
                                                     "s":          ASN1Signature.s.toString(16)
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
                        await this.VerifyMeasurement(measurementValue as IBSMMeasurementValue);
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


    async SignMeasurement  (measurementValue:  IBSMMeasurementValue,
                            privateKey:        any): Promise<IBSMCrypt01Result>
    {

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IBSMCrypt01Result = {
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

    async VerifyMeasurement(measurementValue:  IBSMMeasurementValue): Promise<IBSMCrypt01Result>
    {

        function setResult(verificationResult: VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        var buffer        = new ArrayBuffer(320);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IBSMCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,
            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                 10),
            infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
            paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obis:                         SetHex        (cryptoBuffer, OBIS2Hex(measurementValue.measurement.obis),                                23, false),
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
                cryptoResult.sha256value = (await sha256(cryptoBuffer)).substring(0, 48);


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

        return {} as IBSMCrypt01Result;

    }

    async ViewMeasurement(measurementValue:      IBSMMeasurementValue,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)
    {

        const result     = measurementValue.result as IBSMCrypt01Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "BSMCrypt01 (" + this.description + ")";

        //#region Plain text

        if (PlainTextDiv != null)
        {

            if (PlainTextDiv.parentElement != null)
                PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (204 Bytes, hex)";

            PlainTextDiv.style.fontFamily  = "";
            PlainTextDiv.style.whiteSpace  = "";
            PlainTextDiv.style.maxHeight   = "";
            PlainTextDiv.style.overflowY   = "";

            this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                           result.meterId                               || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",              UTC2human(measurementValue.timestamp),                                                result.timestamp                             || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Status",                   hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
                                                        this.DecodeStatus(measurementValue.infoStatus).join("<br />") + "</span>",            result.infoStatus                            || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                        result.secondsIndex                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                          result.paginationId                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",            measurementValue.measurement.obis,                                                    result.obis                                  || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                             result.unitEncoded                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                   result.scale                                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                       result.value                                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                               result.logBookIndex                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung",            measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex",      pad(result.authorizationStart,          128) || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierungszeitpunkt",  UTC2human(measurementValue.measurement.chargingSession.authorizationStart.timestamp), pad(result.authorizationStartTimestamp, 151) || "",  infoDiv, PlainTextDiv);

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