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
    Typ:                        number,
    RCR:                        number,
    TotWhImp:                   number,
    W:                          number,
    MA1:                        string,
    RCnt:                       number,
    OS:                         number,
    Epoch:                      number,
    TZO:                        number,
    EpochSetCnt:                number,
    EpochSetOS:                 number,
    DI:                         number,
    DO:                         number,
    Meta1:                      string,
    Meta2:                      string,
    Meta3:                      string,
    Evt:                        number
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


    public ParseTyp(value: number) : string
    {
        switch (value)
        {
            case 0: return "CURRENT";       // Signed snapshot of the current meter data at the time of its creation.
            case 1: return "TURN ON";       // Signed snapshot created during executing the turn-on sequence for an external contactor.
            case 2: return "TURN OFF";      // Signed snapshot created during the execution of the turn-off sequence for an external contactor.
            case 3: return "START";         // Signed snapshot marking the start of a charging process without executing the turn-on sequence for an external contactor.
            case 4: return "END";           // Signed snapshot marking the end of a charging process without executing the turn-off sequence for an external contactor.
            default: return "<unknown>";
        }
    }

    public ParseEvents(value: number) : string[]
    {

        let events = [];

        if ((value & (1 <<  1)) != 0) events.push("Power Failure");
        if ((value & (1 <<  2)) != 0) events.push("Under Voltage");
        if ((value & (1 <<  3)) != 0) events.push("Low PF");
        if ((value & (1 <<  4)) != 0) events.push("Over Current");
        if ((value & (1 <<  5)) != 0) events.push("Over Voltage");
        if ((value & (1 <<  6)) != 0) events.push("Missing Sensor");

        if ((value & (1 <<  7)) != 0) events.push("Reserved 1");
        if ((value & (1 <<  8)) != 0) events.push("Reserved 2");
        if ((value & (1 <<  9)) != 0) events.push("Reserved 3");
        if ((value & (1 << 10)) != 0) events.push("Reserved 4");
        if ((value & (1 << 11)) != 0) events.push("Reserved 5");
        if ((value & (1 << 12)) != 0) events.push("Reserved 6");
        if ((value & (1 << 13)) != 0) events.push("Reserved 7");
        if ((value & (1 << 14)) != 0) events.push("Reserved 8");

        if ((value & (1 << 15)) != 0) events.push("Meter Fatal Error");
        if ((value & (1 << 16)) != 0) events.push("CM Init Failed");
        if ((value & (1 << 17)) != 0) events.push("CM Firmware Hash Mismatch");
        if ((value & (1 << 18)) != 0) events.push("CM Development Mode");

        if ((value & (1 << 19)) != 0) events.push("OEM 05");
        if ((value & (1 << 20)) != 0) events.push("OEM 06");
        if ((value & (1 << 21)) != 0) events.push("OEM 07");
        if ((value & (1 << 22)) != 0) events.push("OEM 08");
        if ((value & (1 << 23)) != 0) events.push("OEM 09");
        if ((value & (1 << 24)) != 0) events.push("OEM 10");
        if ((value & (1 << 25)) != 0) events.push("OEM 11");
        if ((value & (1 << 26)) != 0) events.push("OEM 12");
        if ((value & (1 << 27)) != 0) events.push("OEM 13");
        if ((value & (1 << 28)) != 0) events.push("OEM 14");
        if ((value & (1 << 29)) != 0) events.push("OEM 15");

        return events;

    }


    //#region tryToParseBSM_WS36aFormat(Content)

    public async tryToParseBSM_WS36aFormat(Content: any) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        if (Array.isArray(Content) || !Array.isArray(Content.signedMeterValues) || Content.signedMeterValues.length < 2)
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

            //#region Define values

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
                    MA1:                         null as string|null,
                    EpochSetCnt:                 -1,
                    EpochSetOS:                  -1,
                    dataSets:                    [] as any[]
                };

            let Typ                 = 0;      // Snapshot Type   // Welchen Typ für Zwischenwerte?!?
            let RCR:          any[] = [];     // !!! Real energy imported since the last execution of the turn-on sequence
            let TotWhImp:     any[] = [];     // !!! Total Real Energy Imported
            let W:            any[] = [];     // !!! Total Real Power
            let MA1:    string|null = null;   // Meter Address 1
            let RCnt                = 0;      // A counter incremented with each snapshot
            let OS                  = 0;      // Operation-Seconds Counter
            let Epoch               = 0;      // Current local time in seconds since 1970
            let TZO                 = 0;      // Timezone offset of local epoch time time to UTC (minutes)
            let EpochSetCnt         = 0;      // How many time epoch time and timezone offset have been set
            let EpochSetOS          = 0;      // Operation-seconds when the time has been set the last time
            let DI                  = 0;      // Status of the digital inputs
            let DO                  = 0;      // Status of the digital outputs
            let Meta1:  string|null = null;   // User metadata 1 => Check text encoding: https://www.npmjs.com/package/iconv
            let Meta2:  string|null = null;   // User metadata 2 => Check text encoding: https://www.npmjs.com/package/iconv
            let Meta3:  string|null = null;   // User metadata 3 => Check text encoding: https://www.npmjs.com/package/iconv
            let Evt                 = 0;      // Meter Event Flags


            let previousId          = "";
            let previousTime        = "";
            let previousValue       = "";

            let previousRCR         = -1;
            let previousRCnt        = -1;
            let previousOS          = -1;
            let previousEpoch       = -1;

            //#endregion

            for (let i=0; i<Content.signedMeterValues.length; i++)
            {

                const currentMeasurement = Content.signedMeterValues[i];

                if (currentMeasurement["@context"] !== common.Context)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent @context!"
                    };

                //#region Validate common values

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

                //#endregion

                //#region Check additional values

                for(const additionalValue of currentMeasurement.additionalValues)
                {
                    switch (additionalValue.measurand?.name)
                    {
                        case "Typ":          Typ          =   additionalValue.measuredValue?.value;       break;
                        case "RCR":          RCR          = [ additionalValue.measurand?.id,
                                                              additionalValue.measuredValue?.scale,
                                                              additionalValue.measuredValue?.unit,
                                                              additionalValue.measuredValue?.unitEncoded,
                                                              additionalValue.measuredValue?.value,
                                                              additionalValue.measuredValue?.valueType ]; break;
                        case "TotWhImp":     TotWhImp     = [ additionalValue.measurand?.id,
                                                              additionalValue.measuredValue?.scale,
                                                              additionalValue.measuredValue?.unit,
                                                              additionalValue.measuredValue?.unitEncoded,
                                                              additionalValue.measuredValue?.value,
                                                              additionalValue.measuredValue?.valueType ]; break;
                        case "W":            W            = [ additionalValue.measurand?.id,
                                                              additionalValue.measuredValue?.scale,
                                                              additionalValue.measuredValue?.unit,
                                                              additionalValue.measuredValue?.unitEncoded,
                                                              additionalValue.measuredValue?.value,
                                                              additionalValue.measuredValue?.valueType ]; break;
                        case "MA1":          MA1          =   additionalValue.measuredValue?.value;       break;
                        case "RCnt":         RCnt         =   additionalValue.measuredValue?.value;       break;
                        case "OS":           OS           =   additionalValue.measuredValue?.value;       break;
                        case "Epoch":        Epoch        =   additionalValue.measuredValue?.value;       break;
                        case "TZO":          TZO          =   additionalValue.measuredValue?.value;       break;
                        case "EpochSetCnt":  EpochSetCnt  =   additionalValue.measuredValue?.value;       break;
                        case "EpochSetOS":   EpochSetOS   =   additionalValue.measuredValue?.value;       break;
                        case "DI":           DI           =   additionalValue.measuredValue?.value;       break;
                        case "DO":           DO           =   additionalValue.measuredValue?.value;       break;
                        case "Meta1":        Meta1        =   additionalValue.measuredValue?.value ?? ""; break;
                        case "Meta2":        Meta2        =   additionalValue.measuredValue?.value ?? ""; break;
                        case "Meta3":        Meta3        =   additionalValue.measuredValue?.value ?? ""; break;
                        case "Evt":          Evt          =   additionalValue.measuredValue?.value;       break;
                    }
                }


                if (previousRCR !== -1 && RCR[4] < previousRCR)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement value!"
                };
                previousRCR = RCR[4];


                if (previousRCnt !== -1 && RCnt != previousRCnt + 1)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement snapshot counter!"
                };
                previousRCnt = RCnt;


                if (previousOS !== -1 && OS <= previousOS)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement operation-seconds counter!"
                };
                previousOS = OS;


                if (previousEpoch !== -1 && Epoch <= previousEpoch)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement epochs!"
                };
                previousEpoch = Epoch;



                if (common.MA1 !== null && MA1 !== common.MA1)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement meter address 1!"
                };
                common.MA1 = MA1;


                if (common.EpochSetCnt !== -1 && EpochSetCnt !== common.EpochSetCnt)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement epoch set counter!"
                };
                common.EpochSetCnt = EpochSetCnt;


                if (common.EpochSetOS !== -1 && EpochSetOS !== common.EpochSetOS)
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Inconsistent measurement epoch set operation-seconds!"
                };
                common.EpochSetOS = EpochSetOS;

                //#endregion

                common.dataSets.push({
                    Typ:             this.ParseTyp(Typ),
                    RCR:             RCR,
                    TotWhImp:        TotWhImp,
                    W:               W,
                    MA1:             MA1,
                    RCnt:            RCnt,
                    OS:              OS,
                    Epoch:           Epoch,
                    TZO:             TZO,          // Must be common? Or may it change e.g. during summer/winter time change?!
                    EpochSetCnt:     EpochSetCnt,
                    EpochSetOS:      EpochSetOS,
                    DI:              DI,
                    DO:              DO,
                    Meta1:           Meta1,
                    Meta2:           Meta2,
                    Meta3:           Meta3,
                    Evt:             this.ParseEvents(Evt),
                    time:            currentMeasurement.time,
                    value:           currentMeasurement.value?.measuredValue?.value,
                    measurementId:   currentMeasurement.measurementId,
                    signature:       currentMeasurement.signature
                });

            }

            //#region Check snapshot types

            var n = common.dataSets.length-1;

            if (common.dataSets[0].Typ !== "START" && common.dataSets[0].Typ !== "TURN ON")
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Invalid start snapshot!"
            };

            for (let i=1; i<Content.signedMeterValues.length-1; i++)
            {
                if (common.dataSets[i].Typ !== "CURRENT")
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid intermediate snapshot!"
                };
            }

            if (common.dataSets[n].Typ !== "END"   && common.dataSets[n].Typ !== "TURN OFF")
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Invalid end snapshot!"
            };

            //#endregion

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
                                 "phenomena": [
                                     {
                                        "name":              "Real Energy Imported",
                                        "obis":              common.ValueMeasurandId,
                                        "unit":              common.MeasuredValueUnit,
                                        "unitEncoded":       common.MeasuredValueUnitEncoded,
                                        "valueType":         common.MeasuredValueValueType,
                                        "value":             "value",
                                        "scale":             common.MeasuredValueScale
                                     },
                                     {
                                        "name":              "Total Watt-hours Imported",
                                        "obis":              TotWhImp[0],
                                        "unit":              TotWhImp[2],
                                        "unitEncoded":       TotWhImp[3],
                                        "valueType":         TotWhImp[5],
                                        "value":             "TotWhImp",
                                        "scale":             TotWhImp[1]
                                     },
                                     {
                                        "name":              "Total Real Power",
                                        "obis":              W[0],
                                        "unit":              W[2],
                                        "unitEncoded":       W[3],
                                        "valueType":         W[5],
                                        "value":             "W",
                                        "scale":             W[1]
                                     }
                                 ],
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
                                             timestamp:     dataSet.time,
                                             type:          dataSet.Typ,
                                             value:         dataSet.value,
                                             //RCR:           dataSet.RCR,
                                             TotWhImp:      dataSet.TotWhImp[4],
                                             W:             dataSet.W[4],
                                             MA1:           dataSet.MA1,
                                             RCnt:          dataSet.RCnt,
                                             OS:            dataSet.OS,
                                             epoch:         dataSet.Epoch,
                                             TZO:           dataSet.TZO,
                                             epochSetCnt:   dataSet.EpochSetCnt,
                                             epochSetOS:    dataSet.EpochSetOS,
                                             DI:            dataSet.DI,
                                             DO:            dataSet.DO,
                                             meta1:         dataSet.Meta1,
                                             meta2:         dataSet.Meta2,
                                             meta3:         dataSet.Meta3,
                                             events:        dataSet.Evt,
                                             signatures: [
                                                 {
                                                     r:  ASN1Signature.r.toString(16),
                                                     s:  ASN1Signature.s.toString(16)
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
            //infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
            //secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
            //paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obis:                         SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true),
            //logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                              39, false),
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

        // https://github.com/chargeITmobility/bsm-python-private/blob/30abc7ba958c936fdb952ed1f121e45d0818419c/doc/examples/snapshots.md#verifying-a-snapshot-with-the-bsm-tool

        measurementValue.method = this;

        var buffer        = new ArrayBuffer(320);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IBSMCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,



            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                 10),
            //infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
            //secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
            //paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obis:                         SetHex        (cryptoBuffer, OBIS2Hex(measurementValue.measurement.obis),                                23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true),
            //logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                              39, false),
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

                cryptoResult.sha256value = (await sha256(cryptoBuffer));


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


            // https://github.com/chargeITmobility/bsm-python-private/blob/30abc7ba958c936fdb952ed1f121e45d0818419c/doc/examples/snapshots.md#verifying-a-snapshot-with-the-bsm-tool

            this.CreateLine("Typ",                      measurementValue.measurement.energyMeterId,                                           result.meterId                               || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",              UTC2human(measurementValue.timestamp),                                                result.timestamp                             || "",  infoDiv, PlainTextDiv);
            //this.CreateLine("Status",                   hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
            //                                            this.DecodeStatus(measurementValue.infoStatus).join("<br />") + "</span>",            result.infoStatus                            || "",  infoDiv, PlainTextDiv);
            //this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                                        result.secondsIndex                          || "",  infoDiv, PlainTextDiv);
            //this.CreateLine("Paginierungszähler",       parseInt(measurementValue.paginationId, 16),                                          result.paginationId                          || "",  infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl",            measurementValue.measurement.obis,                                                    result.obis                                  || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                             result.unitEncoded                           || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                                   result.scale                                 || "",  infoDiv, PlainTextDiv);
            this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                                       result.value                                 || "",  infoDiv, PlainTextDiv);
            //this.CreateLine("Logbuchindex",             measurementValue.logBookIndex + " hex",                                               result.logBookIndex                          || "",  infoDiv, PlainTextDiv);
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