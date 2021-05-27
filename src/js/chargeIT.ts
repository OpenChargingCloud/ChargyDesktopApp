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

class ChargeIT {

    private moment:   any;

    constructor() {
        this.moment  = require('moment');
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

            var common = {
                    Context:                   Content.signedMeterValues[0]["@context"],
                    MeterFirmwareVersion:      Content.signedMeterValues[0].meterInfo?.firmwareVersion,
                    MeterPublicKey:            Content.signedMeterValues[0].meterInfo?.publicKey,
                    MeterId:                   Content.signedMeterValues[0].meterInfo?.meterId,
                    MeterManufacturer:         Content.signedMeterValues[0].meterInfo?.manufacturer,
                    MeterType:                 Content.signedMeterValues[0].meterInfo?.type,
                    OperatorInfo:              Content.signedMeterValues[0].operatorInfo,
                    ContractId:                Content.signedMeterValues[0].contract?.id,
                    ValueMeasurandId:          Content.signedMeterValues[0].value?.measurand?.id, // OBIS Id
                    ValueMeasurandName:        Content.signedMeterValues[0].value?.measurand?.name,
                    MeasuredValueScale:        Content.signedMeterValues[0].value?.measuredValue?.scale,
                    MeasuredValueUnit:         Content.signedMeterValues[0].value?.measuredValue?.unit,
                    MeasuredValueUnitEncoded:  Content.signedMeterValues[0].value?.measuredValue?.unitEncoded,
                    MeasuredValueValueType:    Content.signedMeterValues[0].value?.measuredValue?.valueType,
                    dataSets:                  [] as any[]
                };

            const base32Decode = require('base32-decode');

            let previousTimestamp = "";

            for (let i=0; i<Content.signedMeterValues.length; i++)
            {

                const currentMeasurement = Content.signedMeterValues[i];

                if (currentMeasurement["@context"]                !== common.Context)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent @context!"
                    };

                if (currentMeasurement.meterInfo?.firmwareVersion !== common.MeterFirmwareVersion)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meterInfo.firmwareVersion!"
                    };

                if (currentMeasurement.meterInfo?.publicKey       !== common.MeterPublicKey)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meterInfo.publicKey!"
                    };

                if (currentMeasurement.meterInfo?.meterId         !== common.MeterId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meterInfo.meterId!"
                    };

                if (currentMeasurement.meterInfo?.manufacturer    !== common.MeterManufacturer)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meterInfo.manufacturer!"
                    };

                if (currentMeasurement.meterInfo?.type            !== common.MeterType)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent meterInfo.type!"
                    };

                if (currentMeasurement.operatorInfo               !== common.OperatorInfo)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent operatorInfo!"
                    };

                if (currentMeasurement.contract?.id               !== common.ContractId)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent contract.id!"
                    };



                // Everything is Little Endian
                // let AdapterId            = this.bufferToHex(DataSet.slice( 0, 10));                                        // 0a 54 65 73 74 44 65 76 00 09
                // let AdapterFWVersion     = String.fromCharCode.apply(null, new Uint8Array(DataSet.slice(10, 14)) as any);  // ASCII: 76 30 31 34 (v014)
                // let AdapterFWChecksum    = this.bufferToHex(DataSet.slice(14, 16));                                        // B9 79
                // let MeterId              = this.bufferToHex(DataSet.slice(16, 26));                                        // 0A 01 44 5A 47 00 33 00 25 02
                // let MeterStatus          = this.bufferToHex(DataSet.slice(26, 28), true);                                  // 00 00
                // let AdapterStatus        = this.bufferToHex(DataSet.slice(28, 30), true);                                  // 00 10
                // let SecondIndex          = new DataView(DataSet.slice(30, 34), 0).getInt32(0, true);                       // 28 71 9A 02 => 43675944 dec
                // let Timestamp            = new Date(new DataView(DataSet.slice(34, 38), 0).getInt32(0, true) * 1000).      // UNIX timestamp: 91 91 3D 5C => 1547538833 => 2019-01-15T07:53:53Z
                //                                   toISOString();
                // let ObisId               = this.bufferToHex(DataSet.slice(38, 44));                                        // 01 00 01 08 00 ff
                // let UnitEncoded          = this.bufferToNumber(DataSet.slice(44, 45));                                     // 1e => 30 => Wh
                // let Scalar               = this.bufferToHex(DataSet.slice(45, 46));                                        // 00
                // let Value                = new Number(new DataView(DataSet.slice(46, 54), 0).getBigInt64(0, true));        // 73 29 00 00 00 00 00 00 => 10611 Wh so 10,611 KWh
                // let UID                  = String.fromCharCode.apply(null, new Uint8Array(DataSet.slice(54, 74)) as any).  // ASCII: 30 35 38 39 38 41 42 42 00 00 00 00 00 00 00 00 00 00 00 00 => UID: 05 89 8A BB
                //                                   replace(/\0.*$/g, '');
                // let SessionId            = new DataView(DataSet.slice(74, 78), 0).getInt32(0, true)                        // 81 01 00 00 => 385(dec)
                // let Paging               = new DataView(DataSet.slice(78, 82), 0).getInt32(0, true);                       // 47 02 00 00 => 583(dec)



                // if (previousTimestamp !== "" && previousTimestamp > Timestamp)
                //     return {
                //         status:   SessionVerificationResult.InconsistentTimestamps,
                //         message:  "Inconsistent timestamps!"
                //     };
                // else
                //     previousTimestamp = Timestamp;


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
            //             "@id":                      "DE*GEF*POOL*1",
            //             "description":              { "de": "GraphDefined Virtual Charging Pool - CI-Tests Pool 1" },
                         "chargingStations": [
                             {
            //                     "@id":                      "DE*GEF*STATION*1*A",
            //                     "description":              { "de": "GraphDefined Virtual Charging Station - CI-Tests Pool 1 / Station A" },
            //                     "firmwareVersion":          CTRArray[0]["Alfen"]["softwareVersion"],
                                 "geoLocation": {
                                     "lat":                  Content.placeInfo?.geoLocation?.lat,
                                     "lng":                  Content.placeInfo?.geoLocation?.lon
                                 },
                                 "address": {
                                     "street":               Content.placeInfo?.address?.street,
                                     "postalCode":           Content.placeInfo?.address?.zipCode,
                                     "city":                 Content.placeInfo?.address?.town
                                 },

                                 "EVSEs": [
                                     {
                                         "@id":                      Content.placeInfo.evseId,
            //                             "description":              { "de": "GraphDefined Virtual Charging Station - CI-Tests Pool 1 / Station A / EVSE 1" },
                                         "sockets":                  [ { } ],
                                         "meters": [
                                             {
                                                 "@id":                      common.MeterId,
                                                 "vendor":                   common.MeterManufacturer,
            //                                     "vendorURL":                "http://www.emh-metering.de",
                                                 "model":                    common.MeterType,
            //                                     "hardwareVersion":          "1.0",
                                                 "firmwareVersion":          common.MeterFirmwareVersion,
                                                 "signatureFormat":          common.Context,
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
                                 "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/bsm-ws36a-v0+json",
                                 "name":                 OBIS2MeasurementName(common.ValueMeasurandId),
                                 "obis":                 common.ValueMeasurandId,
            //                     "unit":                 CTRArray[0]["measuredValue"]["unit"],
                                 "unitEncoded":          common.MeasuredValueUnitEncoded,
            //                     "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                                 "scale":                common.MeasuredValueScale,
                                 "operatorInfo":         common.OperatorInfo,

                                //  "adapterId":            common.AdapterId,
                                 "adapterFWVersion":     common.MeterFirmwareVersion,
                                //  "adapterFWChecksum":    common.AdapterFWChecksum,

                                //ToDo: Move me to EVSEs/.../meters/...
                                 "signatureInfos": {
                                     "hash":                 "SHA256",
                                     "algorithm":            "ECC",
                                     "curve":                "secp256r1",
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
                                             "timestamp":      dataSet.time,
                                             "value":          dataSet.value,
                                            //  "statusMeter":    dataSet["StatusMeter"],
                                            //  "statusAdapter":  dataSet["StatusAdapter"],
                                            //  "secondsIndex":   dataSet["SecondIndex"],
                                            //  "paginationId":   dataSet["Paging"],
                                             "signatures": [
                                                 {
                                                     "r":          dataSet.signature.substring(0, 48),
                                                     "s":          dataSet.signature.substring(48)
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
















    //#region tryToParseChargeITJSON(SomeJSON)

    //private async tryToParseAnonymousFormat(SomeJSON: { signedMeterValues: any[]; placeInfo: any; }) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>

    // The chargeIT mobility data format does not always provide context or format identifiers
    public async tryToParseChargeITJSON(SomeJSON: any) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        if (Array.isArray(SomeJSON))
            return {
                status: SessionVerificationResult.InvalidSessionFormat
            }

        try
        {

            //#region Common format

            //#region documentation

            // {
            //     "placeInfo": {
            //         "evseId": "DE*BDO*74778874*1",
            //         "address": {
            //             "street": "Musterstraße 12",
            //             "zipCode": "74789",
            //             "town": "Stadt" 
            //         },
            //         "geoLocation": {
            //             "lat": 12.3774,
            //             "lon": 1.3774
            //         }
            //     },
            //
            //     "signedMeterValues":[{
            //         [...]
            //     }]
            // }

            //#endregion

            var placeInfo          = SomeJSON.placeInfo;
            var signedMeterValues  = SomeJSON.signedMeterValues as Array<any>;

            var evseId = placeInfo["evseId"] as string;
            if (evseId == null || typeof evseId !== 'string')
                throw "Missing or invalid EVSE Id!"


            var address = placeInfo["address"];
            if (address == null)
                throw "Missing or invalid address!"

            var address_street = address["street"];
            if (address_street == null || typeof address_street !== 'string')
                throw "Missing or invalid address street!"

            var address_zipCode = address["zipCode"];
            if (address_zipCode == null || typeof address_zipCode !== 'string')
                throw "Missing or invalid address zipCode!"

            var address_town = address["town"];
            if (address_town == null || typeof address_town !== 'string')
                throw "Missing or invalid address town!"


            var geoLocation = placeInfo["geoLocation"];
            if (geoLocation == null)
                throw "Missing or invalid geoLocation!"

            var geoLocation_lat = geoLocation["lat"];
            if (geoLocation_lat == null || typeof geoLocation_lat !== 'number')
                throw "Missing or invalid geoLocation latitude!"

            var geoLocation_lon = geoLocation["lon"];
            if (geoLocation_lon == null || typeof geoLocation_lon !== 'number')
                throw "Missing or invalid geoLocation longitude!"

            //#endregion


            //#region First format

            //#region documentation

            // {
            //     "placeInfo": {
            //         "evseId": "DE*BDO*74778874*1",
            //         "address": {
            //             "street": "Musterstraße 12",
            //             "zipCode": "74789",
            //             "town": "Stadt" 
            //         },
            //         "geoLocation": {
            //             "lat": 12.3774,
            //             "lon": 1.3774
            //         }
            //     },
            //
            //     "signedMeterValues":[{
            //         "timestamp": 1550533285,
            //         "meterInfo": {
            //            "firmwareVersion": "123",
            //            "publicKey": "08A56CF3B51DABA44F38607BB884F62FB8BE84B4EF39D09624AB9E0910354398590DC59A5B40F43FE68A9F416F65EC76",
            //            "publicKeySignatures": [],
            //            "meterId": "0901454D4800007F9F3E",
            //            "type": "eHZ IW8E EMH",
            //            "manufacturer": "EMH"
            //         },
            //         "transactionId": "1546933282548:-7209653592192971037:1",
            //         "contract": {
            //            "type": "RFID_TAG_ID",
            //            "timestampLocal": {
            //               "timestamp": 1546933284,
            //               "localOffset": 60,
            //               "seasonOffset": 0
            //            },
            //            "timestamp": 1550533284,
            //            "id": "235DD5BB"
            //         },
            //         "measurementId": "00000007",
            //         "measuredValue": {
            //            "timestampLocal": {
            //               "timestamp": 1546933285,
            //               "localOffset": 60,
            //               "seasonOffset": 0
            //            },
            //            "value": "60077",
            //            "unit": "WATT_HOUR",
            //            "scale": -1,
            //            "valueType": "Integer64",
            //            "unitEncoded": 30
            //         },
            //         "measurand": {
            //            "id": "0100011100FF",
            //            "name": "ENERGY_TOTAL"
            //         },
            //         "additionalInfo": {
            //            "indexes": {
            //               "timer": 1730275,
            //               "logBook": "0004"
            //            },
            //            "status": "88"
            //         },
            //         "signature": "13493BBB43DA1E26C88B21ADB7AA53A7AE4FC7F6F6B916E67AD3E168421D180F021D6DD458612C53FF167781892A9DF3"
            //     }]
            //
            // }

            //#endregion

            if (signedMeterValues[0].signedMeterValue)
            {

                let CTRArray = [];

                for (let i = 0; i < signedMeterValues.length; i++) {

                    let signedMeterValue = signedMeterValues[i];

                    let _timestamp = signedMeterValue["timestamp"] as number;
                    if (_timestamp == null || typeof _timestamp !== 'number')
                        throw "Missing or invalid timestamp[" + i + "]!"
                    let timestamp = parseUTC(_timestamp);

                    let _meterInfo = signedMeterValue["meterInfo"] as string;
                    if (_meterInfo == null || typeof _meterInfo !== 'object')
                        throw "Missing or invalid meterInfo[" + i + "]!"

                    let _meterInfo_firmwareVersion = _meterInfo["firmwareVersion"] as string;
                    if (_meterInfo_firmwareVersion == null || typeof _meterInfo_firmwareVersion !== 'string')
                        throw "Missing or invalid meterInfo firmwareVersion[" + i + "]!"

                    let _meterInfo_publicKey = _meterInfo["publicKey"] as string;
                    if (_meterInfo_publicKey == null || typeof _meterInfo_publicKey !== 'string')
                        throw "Missing or invalid meterInfo publicKey[" + i + "]!"

                    let _meterInfo_publicKeySignatures = _meterInfo["publicKeySignatures"];

                    let _meterInfo_meterId = _meterInfo["meterId"] as string;
                    if (_meterInfo_meterId == null || typeof _meterInfo_meterId !== 'string')
                        throw "Missing or invalid meterInfo meterId[" + i + "]!"

                    let _meterInfo_type = _meterInfo["type"] as string;
                    if (_meterInfo_type == null || typeof _meterInfo_type !== 'string')
                        throw "Missing or invalid meterInfo type[" + i + "]!"

                    let _meterInfo_manufacturer = _meterInfo["manufacturer"] as string;
                    if (_meterInfo_manufacturer == null || typeof _meterInfo_manufacturer !== 'string')
                        throw "Missing or invalid meterInfo manufacturer[" + i + "]!"


                    let _transactionId = signedMeterValue["transactionId"] as string;
                    if (_transactionId == null || typeof _transactionId !== 'string')
                        throw "Missing or invalid transactionId[" + i + "]!"


                    let _contract = signedMeterValue["contract"];
                    if (_contract == null || typeof _contract !== 'object')
                        throw "Missing or invalid contract[" + i + "]!"

                    let _contract_type = _contract["type"] as string;
                    if (_contract_type == null || typeof _contract_type !== 'string')
                        throw "Missing or invalid contract type[" + i + "]!"

                    let _contract_timestampLocal = _contract["timestampLocal"];
                    if (_contract_timestampLocal == null || typeof _contract_timestampLocal !== 'object')
                        throw "Missing or invalid contract timestampLocal[" + i + "]!"

                    let _contract_timestampLocal_timestamp = _contract_timestampLocal["timestamp"] as number;
                    if (_contract_timestampLocal_timestamp == null || typeof _contract_timestampLocal_timestamp !== 'number')
                        throw "Missing or invalid contract timestampLocal timestamp[" + i + "]!"                            

                    let _contract_timestampLocal_localOffset = _contract_timestampLocal["localOffset"] as number;
                    if (_contract_timestampLocal_localOffset == null || typeof _contract_timestampLocal_localOffset !== 'number')
                        throw "Missing or invalid contract timestampLocal localOffset[" + i + "]!"                            

                    let _contract_timestampLocal_seasonOffset = _contract_timestampLocal["seasonOffset"] as number;
                    if (_contract_timestampLocal_seasonOffset == null || typeof _contract_timestampLocal_seasonOffset !== 'number')
                        throw "Missing or invalid contract timestampLocal seasonOffset[" + i + "]!"  

                    let _contract_timestamp = _contract["timestamp"] as number;
                    if (_contract_timestamp == null || typeof _contract_timestamp !== 'number')
                        throw "Missing or invalid contract timestamp[" + i + "]!"

                    let _contract_id = _contract["id"] as string;
                    if (_contract_id == null || typeof _contract_id !== 'string')
                        throw "Missing or invalid contract type[" + i + "]!"


                    let _measurementId = signedMeterValue["measurementId"] as string;
                    if (_measurementId == null || typeof _measurementId !== 'string')
                        throw "Missing or invalid measurementId[" + i + "]!"


                    let _measuredValue = signedMeterValue["measuredValue"];
                    if (_measuredValue == null || typeof _measuredValue !== 'object')
                        throw "Missing or invalid measuredValue[" + i + "]!"

                    let _measuredValue_timestampLocal = _measuredValue["timestampLocal"];
                    if (_measuredValue_timestampLocal == null || typeof _measuredValue_timestampLocal !== 'object')
                        throw "Missing or invalid measuredValue timestampLocal[" + i + "]!"

                    let _measuredValue_timestampLocal_timestamp = _measuredValue_timestampLocal["timestamp"] as number;
                    if (_measuredValue_timestampLocal_timestamp == null || typeof _measuredValue_timestampLocal_timestamp !== 'number')
                        throw "Missing or invalid measuredValue timestampLocal timestamp[" + i + "]!"                            

                    let _measuredValue_timestampLocal_localOffset = _measuredValue_timestampLocal["localOffset"] as number;
                    if (_measuredValue_timestampLocal_localOffset == null || typeof _measuredValue_timestampLocal_localOffset !== 'number')
                        throw "Missing or invalid measuredValue timestampLocal localOffset[" + i + "]!"                            

                    let _measuredValue_timestampLocal_seasonOffset = _measuredValue_timestampLocal["seasonOffset"] as number;
                    if (_measuredValue_timestampLocal_seasonOffset == null || typeof _measuredValue_timestampLocal_seasonOffset !== 'number')
                        throw "Missing or invalid measuredValue timestampLocal seasonOffset[" + i + "]!"                            

                    let _measuredValue_value = _measuredValue["value"] as string;
                    if (_measuredValue_value == null || typeof _measuredValue_value !== 'string')
                        throw "Missing or invalid measuredValue value[" + i + "]!"

                    let _measuredValue_unit = _measuredValue["unit"] as string;
                    if (_measuredValue_unit == null || typeof _measuredValue_unit !== 'string')
                        throw "Missing or invalid measuredValue unit[" + i + "]!"

                    let _measuredValue_scale = _measuredValue["scale"] as number;
                    if (_measuredValue_scale == null || typeof _measuredValue_scale !== 'number')
                        throw "Missing or invalid measuredValue scale[" + i + "]!"

                    let _measuredValue_valueType = _measuredValue["valueType"] as string;
                    if (_measuredValue_valueType == null || typeof _measuredValue_valueType !== 'string')
                        throw "Missing or invalid measuredValue valueType[" + i + "]!"

                    let _measuredValue_unitEncoded = _measuredValue["unitEncoded"] as number;
                    if (_measuredValue_unitEncoded == null || typeof _measuredValue_unitEncoded !== 'number')
                        throw "Missing or invalid measuredValue unitEncoded[" + i + "]!"


                    let _measurand = signedMeterValue["measurand"];
                        if (_measurand == null || typeof _measurand !== 'object')
                            throw "Missing or invalid measurand[" + i + "]!"

                    let _measurand_id = _measurand["id"] as string;
                    if (_measurand_id == null || typeof _measurand_id !== 'string')
                        throw "Missing or invalid measurand id[" + i + "]!"

                    let _measurand_name = _measurand["name"] as string;
                    if (_measurand_name == null || typeof _measurand_name !== 'string')
                        throw "Missing or invalid measurand name[" + i + "]!"


                    let _additionalInfo = signedMeterValue["additionalInfo"];
                        if (_additionalInfo == null || typeof _additionalInfo !== 'object')
                            throw "Missing or invalid additionalInfo[" + i + "]!"

                    let _additionalInfo_indexes = _additionalInfo["indexes"];
                    if (_additionalInfo_indexes == null || typeof _additionalInfo_indexes !== 'object')
                        throw "Missing or invalid additionalInfo indexes[" + i + "]!"

                    let _additionalInfo_indexes_timer = _additionalInfo_indexes["timer"] as number;
                    if (_additionalInfo_indexes_timer == null || typeof _additionalInfo_indexes_timer !== 'number')
                        throw "Missing or invalid additionalInfo indexes timer[" + i + "]!"

                    let _additionalInfo_indexes_logBook = _additionalInfo_indexes["logBook"] as string;
                    if (_additionalInfo_indexes_logBook == null || typeof _additionalInfo_indexes_logBook !== 'string')
                        throw "Missing or invalid additionalInfo indexes logBook[" + i + "]!"
                        
                    let _additionalInfo_status = _additionalInfo["status"] as string;
                    if (_additionalInfo_status == null || typeof _additionalInfo_status !== 'string')
                        throw "Missing or invalid additionalInfo status[" + i + "]!"


                    let _chargePoint = signedMeterValue["chargePoint"];
                    if (_chargePoint == null || typeof _chargePoint !== 'object')
                        throw "Missing or invalid chargePoint[" + i + "] information!"

                    let _chargePointSoftwareVersion = _chargePoint["softwareVersion"];
                    if (_chargePointSoftwareVersion == null || typeof _chargePointSoftwareVersion !== 'string')
                        throw "Missing or invalid chargePoint softwareVersion[" + i + "]!"


                    let _signature = signedMeterValue["signature"] as string;
                    if (_signature == null || typeof _signature !== 'string')
                        throw "Missing or invalid signature[" + i + "]!"

                    //let aaa = moment.unix(_contract_timestampLocal_timestamp).utc();

                    CTRArray.push({
                                "timestamp": _timestamp,
                                "meterInfo": {
                                    "firmwareVersion": _meterInfo_firmwareVersion,
                                    "publicKey": _meterInfo_publicKey,
                                    "publicKeySignatures": _meterInfo_publicKeySignatures,
                                    "meterId": _meterInfo_meterId,
                                    "type": _meterInfo_type,
                                    "manufacturer": _meterInfo_manufacturer
                                },
                                "transactionId": _transactionId,
                                "contract": {
                                    "type": _contract_type,
                                    "timestampLocal": {
                                        "timestamp": _contract_timestampLocal_timestamp,
                                        "localOffset": _contract_timestampLocal_localOffset,
                                        "seasonOffset": _contract_timestampLocal_seasonOffset
                                    },
                                    "timestamp": _contract_timestamp,
                                    "id": _contract_id
                                },
                                "measurementId": _measurementId,
                                "measuredValue": {
                                    "timestampLocal": {
                                        "timestamp": _measuredValue_timestampLocal_timestamp,
                                        "localOffset": _measuredValue_timestampLocal_localOffset,
                                        "seasonOffset": _measuredValue_timestampLocal_seasonOffset
                                    },
                                    "value": _measuredValue_value,
                                    "unit": _measuredValue_unit,
                                    "scale": _measuredValue_scale,
                                    "valueType": _measuredValue_valueType,
                                    "unitEncoded": _measuredValue_unitEncoded
                                },
                                "measurand": {
                                    "id": _measurand_id,
                                    "name": _measurand_name
                                },
                                "additionalInfo": {
                                    "indexes": {
                                        "timer": _additionalInfo_indexes_timer,
                                        "logBook": _additionalInfo_indexes_logBook
                                    },
                                    "status": _additionalInfo_status
                                },
                                "chargePoint": {
                                    "softwareVersion": _chargePointSoftwareVersion
                                },
                                "signature": _signature
                    });

                }

                var n = CTRArray.length-1;
                var _CTR: any = { //IChargeTransparencyRecord = {

                    "@id":              CTRArray[n]["transactionId"],
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                    "end":              this.moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),

                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },

                    "contract": {
                        "@id":          CTRArray[0]["contract"]["id"],
                        "type":         CTRArray[0]["contract"]["type"],
                        "username":     "",
                        "email":        ""
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      "chargeITmobilityCSO",
                            "eMobilityIds":             [ "DE*BDO", "DE*LVF", "+49*822" ],
                            "description": {
                                "de":                   "chargeIT mobility GmbH - Charging Station Operator Services"
                            },

                            "contact": {
                                "email":                    "info@chargeit-mobility.com",
                                "web":                      "https://www.chargeit-mobility.com",
                                "logoUrl":                  "http://www.chargeit-mobility.com/fileadmin/BELECTRIC_Drive/templates/pics/chargeit_logo_408x70.png",
                                "publicKeys": [
                                    {
                                        "algorithm":        "secp192r1",
                                        "format":           "DER",
                                        "value":            "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                        "signatures": [
                                            {
                                                "keyId":      "...",
                                                "algorithm":  "secp192r1",
                                                "format":     "DER",
                                                "value":      "????"
                                            }
                                        ]
                                    },
                                    {
                                        "algorithm":        "secp256k1",
                                        "format":           "DER",
                                        "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                        "signatures":       [ ]
                                    }
                                ]
                            },

                            "support": {
                                "hotline":                  "+49 9321 / 2680 - 700",
                                "email":                    "service@chargeit-mobility.com",
                                "web":                      "https://cso.chargeit.charging.cloud/issues"
                                // "mediationServices":        [ "GraphDefined Mediation" ],
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256k1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "privacy": {
                                "contact":                  "Dr. iur. Christian Borchers, datenschutz süd GmbH",
                                "email":                    "datenschutz@chargeit-mobility.com",
                                "web":                      "http://www.chargeit-mobility.com/de/datenschutz/"
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256k1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "chargingStations": [
                                {
                                    "@id":                      evseId.substring(0, evseId.lastIndexOf("*")),
                                    // "description": {
                                    //     "de":                   "GraphDefined Charging Station - CI-Tests Pool 3 / Station A"
                                    // },
                                    "firmwareVersion":          CTRArray[0]["chargePoint"]["softwareVersion"],
                                    "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                    "address": {
                                        "street":               address_street,
                                        "postalCode":           address_zipCode,
                                        "city":                 address_town
                                    },
                                    "EVSEs": [
                                        {
                                            "@id":                      evseId,
                                            // "description": {
                                            //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                            // },
                                            "sockets":                  [ { } ],
                                            "meters": [
                                                {
                                                    "@id":                      CTRArray[0]["meterInfo"]["meterId"],
                                                    "vendor":                   CTRArray[0]["meterInfo"]["manufacturer"],
                                                    "vendorURL":                "http://www.emh-metering.de",
                                                    "model":                    CTRArray[0]["meterInfo"]["type"],
                                                    "hardwareVersion":          "1.0",
                                                    "firmwareVersion":          CTRArray[0]["meterInfo"]["firmwareVersion"],
                                                    "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                    "publicKeys": [
                                                        {
                                                            "algorithm":        "secp192r1",
                                                            "format":           "DER",
                                                            "value":            CTRArray[0]["meterInfo"]["publicKey"].startsWith("04")
                                                                                    ?        CTRArray[0]["meterInfo"]["publicKey"]
                                                                                    : "04" + CTRArray[0]["meterInfo"]["publicKey"],
                                                            "signatures":       CTRArray[0]["meterInfo"]["publicKeySignatures"]
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]

                        }
                    ],

                    "chargingSessions": [

                        {

                            "@id":                          CTRArray[n]["transactionId"],
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json",
                            "begin":                        this.moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                            "end":                          this.moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                            "EVSEId":                       evseId,

                            "authorizationStart": {
                                "@id":                      CTRArray[0]["contract"]["id"],
                                "type":                     CTRArray[0]["contract"]["type"],
                                "timestamp":                this.moment.unix(CTRArray[0]["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                                CTRArray[0]["contract"]["timestampLocal"]["localOffset"] +
                                                                                CTRArray[0]["contract"]["timestampLocal"]["seasonOffset"]).format(),
                            },

                            "signatureInfos": {
                                "hash":                     "SHA512",
                                "hashTruncation":           "24",
                                "algorithm":                "ECC",
                                "curve":                    "secp192r1",
                                "format":                   "rs"
                            },

                            "measurements": [

                                {

                                    "energyMeterId":        CTRArray[0]["meterInfo"]["meterId"],
                                    "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json",
                                    "name":                 CTRArray[0]["measurand"]["name"],
                                    "obis":                 parseOBIS(CTRArray[0]["measurand"]["id"]),
                                    "unit":                 CTRArray[0]["measuredValue"]["unit"],
                                    "unitEncoded":          CTRArray[0]["measuredValue"]["unitEncoded"],
                                    "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                                    "scale":                CTRArray[0]["measuredValue"]["scale"],

                                    "signatureInfos": {
                                        "hash":                 "SHA512",
                                        "hashTruncation":       "24",
                                        "algorithm":            "ECC",
                                        "curve":                "secp192r1",
                                        "format":               "rs"
                                    },

                                    "values": [ ]

                                }

                            ]

                        }

                    ]

                };

                for (var _measurement of CTRArray)
                {

                    _CTR["chargingSessions"][0]["measurements"][0]["values"].push(

                                            {
                                                "timestamp":      this.moment.unix(_measurement["measuredValue"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                                _measurement["measuredValue"]["timestampLocal"]["localOffset"] +
                                                                                _measurement["measuredValue"]["timestampLocal"]["seasonOffset"]).format(),
                                                "value":          _measurement["measuredValue"]["value"],
                                                "infoStatus":     _measurement["additionalInfo"]["status"],
                                                "secondsIndex":   _measurement["additionalInfo"]["indexes"]["timer"],
                                                "paginationId":   _measurement["measurementId"],
                                                "logBookIndex":   _measurement["additionalInfo"]["indexes"]["logBook"],
                                                "signatures": [
                                                    {
                                                        "r":          _measurement["signature"].substring(0, 48),
                                                        "s":          _measurement["signature"].substring(48)
                                                    }
                                                ]
                                            }

                    );

                }

                // await this.processChargeTransparencyRecord(_CTR);
                // return true;
                return _CTR as IChargeTransparencyRecord;

            }

            //#endregion

            //#region Second format

            //#region documentation

            // {
            //     "placeInfo": {
            //         "geoLocation": {
            //             "lat": 49.731421,
            //             "lon": 10.147718
            //         },
            //         "address": {
            //             "street": "Steigweg 24",
            //             "town": "Kitzingen",
            //             "zipCode": "97318"
            //         },
            //         "evseId": "DE*BDO*E2323234064*1"
            //     },
            //     "signedMeterValues": [
            //         {
            //             "payload": "AP;0;3;AJ2J7LYMGCIWT4AHUJPPFIIVB3FGRV2JQ2HVZG2I;BIHEIWSHAAA2WZUZOYYDCNWTWAFACRC2I4ADGAEDQ4AAAABABMI5UAEVRZFV4AIAAEEAB7Y6AD4N2AIAAAAAAABQGQ3DKNCGIZATKOJVGU4DAAAAAAAAAAAWAAAAAKYAAAAA====;X7KCDU5IJHGUW64LDYHYR7IXRPPSKCMWAMQOVZVRNGRX6BEIHX3TFKUDJGEMUI5W5CJFTPDEWR7F6===;",
            //             "format": "ALFEN",
            //             "formatVersion": "0",
            //             "encoding": "HEX",
            //             "manufacturer": "Alfen BV"
            //         },
            //         {
            //             "payload": "AP;1;3;AJ2J7LYMGCIWT4AHUJPPFIIVB3FGRV2JQ2HVZG2I;BIHEIWSHAAA2WZUZOYYDCNWTWAFACRC2I4ADGAEDQ4AAAAAQFRGNUAFWZFFV4AIAAEEAB7Y6AA7ASAQAAAAAAABQGQ3DKNCGIZATKOJVGU4DAAAAAAAAAAAWAAAAALAAAAAA====;FXINYN5UF2LKAS633476F7V2GQGBP22KBCZD3TOSJCFLCFGYAAYTVJFIA7637NKQ22CZSEB2AOJJO===;",
            //             "format": "ALFEN",
            //             "formatVersion": "0",
            //             "encoding": "HEX",
            //             "manufacturer": "Alfen BV"
            //         }
            //     ]
            // }

            //#endregion

            var _CTR: any = {};

            if (signedMeterValues[0]["@context"])
            {
                switch (signedMeterValues[0]["@context"])
                {

                    case "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0":
                        _CTR = await this.tryToParseBSM_WS36aFormat(SomeJSON);
                        break;

                }
            }

            else if (signedMeterValues[0].format)
            {
                switch (signedMeterValues[0].format)
                {

                    case "ALFEN":
                        _CTR = await new Alfen01().tryToParseALFENFormat(signedMeterValues.map(value => value.payload));
                        break;

                }
            }


            if (_CTR.chargingSessions)
            {

                _CTR.chargingPools[0].chargingStations[0].geoLocation = {
                    "lat":        placeInfo.geoLocation.lat,
                    "lng":        placeInfo.geoLocation.lon
                };

                _CTR.chargingPools[0].chargingStations[0].address = {
                    "street":     placeInfo.address.street,
                    "postalCode": placeInfo.address.zipCode,
                    "city":       placeInfo.address.town
                };

                _CTR.chargingPools[0].chargingStations[0].EVSEs[0]["@id"] = placeInfo.evseId;
                delete _CTR.chargingPools[0].chargingStations[0].EVSEs[0].description;

                _CTR.chargingSessions[0].EVSEId = placeInfo.evseId;

            }

            return _CTR as IChargeTransparencyRecord;

            //#endregion


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
