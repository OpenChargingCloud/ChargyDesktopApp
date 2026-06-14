/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import { Chargy }                     from './chargy'
import { ACrypt }                     from './ACrypt'
import * as chargyInterfaces          from './interfaces/chargyInterfaces'
import * as chargeTransparencyRecord  from './interfaces/IChargeTransparencyRecord'
import * as chargyLib                 from './chargyLib'
import Decimal                        from 'decimal.js'


// ToDo: Add a chargepoint-specific chargingSessions type, when needed:
//       chargingSessions?: Array<IChargepointChargingSession>;
export type IChargepointChargeTransparencyRecord = chargeTransparencyRecord.IChargeTransparencyRecord;

export class ChargePoint {

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }

    //#region TryToParseChargepointFormat(SomeJSON)

    public TryToParseChargepointFormat(SomeJSON: unknown)

        : chargeTransparencyRecord.IChargeTransparencyRecord |
          chargyInterfaces.        ISessionCryptoResult

    {

        try
        {

            if (!chargyLib.isMandatoryJSONObject(SomeJSON))
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                    certainty: 0
                }

            //#region First CTR format

            if (SomeJSON["company_name"]    !== undefined &&
                SomeJSON["display_unit"]    !== undefined &&
                //SomeJSON["energy"]          !== undefined &&
                //SomeJSON["flat"]            !== undefined &&
                SomeJSON["minMaxAdj"]       !== undefined &&
                //SomeJSON["parking"]         !== undefined &&
                SomeJSON["subtotal"]        !== undefined &&
                SomeJSON["totalAmount"]     !== undefined &&
                SomeJSON["additional_info"] !== undefined)
            {

                //#region Documentation

                // {
                //     "company_name":            "ChargePoint&#32;EU&#32;QA&#32;EUR",
                //     "display_unit":            3600,
                //     "energy": [
                //         {
                //             "active_charging":     0,
                //             "duration":            421,
                //             "end_time":            1543841929,
                //             "end_time_utc":        1543838329,
                //             "line_item_cost":      0,
                //             "seq_num":             1,
                //             "start_time":          1543841508,
                //             "start_time_utc":      1543837908,
                //             "type":                "ENERGY",
                //             "unit_price":          "0.05000",
                //             "units":               0.058999999999999997
                //         },
                //         {
                //             "duration":            421,
                //             "energy_subtotal":     0,
                //             "seq_num":             "SUBTOTAL",
                //             "type":                "ENERGY",
                //             "units":               0.058999999999999997
                //         }
                //     ],
                //     "flat": [
                //         {
                //             "flat_fee":                0,
                //             "flat_fee_subtotal":       0,
                //             "numSubSessions":          1,
                //             "type":                    "FLAT"
                //         }
                //     ],
                //     "minMaxAdj": [
                //         {
                //             "session_length":          0,
                //             "session_min":             0.070000000000000007,
                //             "session_min_adjustment":  0.059999999999999998,
                //             "session_total":           0.01,
                //             "type":                    "SESS_MIN_ADJ"
                //         }
                //     ],
                //     "parking": [
                //         {
                //             "duration":            421,
                //             "end_time":            1543841929,
                //             "end_time_utc":        1543838329,
                //             "line_item_cost":      0.01,
                //             "overstay":            0,
                //             "seq_num":             1,
                //             "start_time":          1543841508,
                //             "start_time_utc":      1543837908,
                //             "type":                "PARKING",
                //             "unit_price":          "0.10",
                //             "units":               421
                //         },
                //         {
                //             "duration":            421,
                //             "parking_subtotal":    0.01,
                //             "seq_num":             "SUBTOTAL",
                //             "type":                "PARKING",
                //             "units":               421
                //         }
                //     ],
                //     "subtotal":                    0.070000000000000007,
                //     "subtotal_before_adjustment":  0.01,
                //     "tax": [
                //         {
                //             "tax":                 0.01,
                //             "taxPercent":          "19.0000",
                //             "taxRuleName":         "MwSt.",
                //             "type":                "TAX"
                //         },
                //         {
                //             "seq_num":             "SUBTOTAL",
                //             "total_tax":           0.01,
                //             "type":                "TAX"
                //         }
                //     ],
                //     "totalAmount":                 0.080000000000000002,
                //     "additional_info": {
                //         "outlet":                  2,
                //         "session_id":              2,
                //         "station_mac":             "0024:b100:0002:e300",
                //         "driver_info":             "urn:nema:5evse:dn:v1:chargepoint.com:cdid:cncp000009afd2",
                //         "meter_serial":            "240008S",
                //         "currency_code":           "EUR",
                //         "meter_startreading":      3078,
                //         "meter_endreading":        3137,
                //         "energy_units":            "Wh"
                //     }
                // }

                //#endregion

                const additionalInfo = chargyLib.asJSONObject(SomeJSON["additional_info"]);
                if (additionalInfo === undefined)
                    throw new Error("Missing or invalid additional information!");

                const energy   = chargyLib.asJSONArray(SomeJSON["energy"]);
                const parking  = chargyLib.asJSONArray(SomeJSON["parking"]);

                let chargingStart: number | undefined;
                let chargingEnd:   number | undefined;

                for (const energyItem of energy ?? [])
                {

                    const energyObj      = chargyLib.asJSONObject(energyItem);
                    const startTimeUTC   = chargyLib.asNumber(energyObj?.["start_time_utc"]);
                    const endTimeUTC     = chargyLib.asNumber(energyObj?.["end_time_utc"]);

                    if (startTimeUTC !== undefined && (chargingStart === undefined || startTimeUTC < chargingStart))
                        chargingStart = startTimeUTC;

                    if (startTimeUTC !== undefined && (chargingEnd   === undefined || startTimeUTC > chargingEnd))
                        chargingEnd   = endTimeUTC;

                }

                let parkingStart: number | undefined;
                let parkingEnd:   number | undefined;

                for (const parkingItem of parking ?? [])
                {

                    const parkingObj     = chargyLib.asJSONObject(parkingItem);
                    const startTimeUTC   = chargyLib.asNumber(parkingObj?.["start_time_utc"]);
                    const endTimeUTC     = chargyLib.asNumber(parkingObj?.["end_time_utc"]);

                    if (startTimeUTC !== undefined && (parkingStart === undefined || startTimeUTC < parkingStart))
                        parkingStart = startTimeUTC;

                    if (startTimeUTC !== undefined && (parkingEnd   === undefined || startTimeUTC > parkingEnd))
                        parkingEnd   = endTimeUTC;

                }

                // Sometimes there is "parking" but no "energy"...
                if (chargingStart === undefined)
                    chargingStart = parkingStart;

                if (chargingEnd   === undefined)
                    chargingEnd   = parkingEnd;


                let sessionStart = (parkingStart !== undefined && (chargingStart === undefined || parkingStart < chargingStart))
                                       ? parkingStart
                                       : chargingStart;

                if (sessionStart === undefined && parkingStart !== undefined)
                    sessionStart = parkingStart;


                let sessionEnd   = (parkingEnd   !== undefined && (chargingEnd   === undefined || parkingEnd   < chargingEnd))
                                       ? parkingEnd
                                       : chargingEnd;

                if (sessionEnd   === undefined && parkingEnd !== undefined)
                    sessionEnd   = parkingEnd;


                const stationMac    = chargyLib.asString(additionalInfo["station_mac"])   ?? "";
                const outlet        = chargyLib.asNumber(additionalInfo["outlet"])        ?? NaN;
                const sessionId     = chargyLib.asNumber(additionalInfo["session_id"])    ?? NaN;
                const driverInfo    = chargyLib.asString(additionalInfo["driver_info"])   ?? "";
                const meterSerial   = chargyLib.asString(additionalInfo["meter_serial"])  ?? "";
                const currencyCode  = chargyLib.asString(additionalInfo["currency_code"]) ?? "";
                const energyUnits   = chargyLib.asString(additionalInfo["energy_units"])  ?? "";
                const evseId        = chargyLib.asString(SomeJSON["EVSEId"]) ?? stationMac + "-" + String(outlet);
                const original      = chargyLib.asString(SomeJSON["original"]);

                // The signature is usually a DER encoded string, but might
                // already be in the rs-format...
                const signature     = chargyLib.asString(SomeJSON["signature"])
                                          ?? chargyLib.asJSONObject(SomeJSON["signature"]) as chargyInterfaces.ISignatureRS | undefined;

                const CTR: IChargepointChargeTransparencyRecord = {

                    "@id":              "chargepoint-" + stationMac     + "-" +
                                                         String(outlet) + "-" +
                                                         String(sessionId),
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.chargy.moment.unix(sessionStart ?? NaN).utc().format(),
                    "end":              this.chargy.moment.unix(sessionEnd   ?? NaN).utc().format(),

                    // "description": {
                    //     "de":           "Alle Ladevorgänge"
                    // },

                    "contract": {
                        "@id":          driverInfo,
                        "type":         "userId"
                    },

                    "chargingStationOperators": [{

                        "@id":                      chargyLib.asString(SomeJSON["company_name"]) ?? "",
                        "description": {
                            "de":                   "chargepoint - Charging Station Operator Services"
                        },

                        "contact": {
                            "email":                    "sales@chargepoint.com",
                            "web":                      "https://www.chargepoint.com",
                            "logoUrl":                  "https://www.chargepoint.com/themes/chargepoint/logo.svg",
                        },

                        "support": {
                            "hotline":                  "+49(69) 95307383",
                            "email":                    "support.eu@chargepoint.com",
                            "web":                      "https://chargepoint.charging.cloud/issues"
                        },

                        "privacy": {
                            "contact":                  "ChargePoint, Attn: Data Protection Officer, ChargePoint Network (Netherlands) B.V., Hoogoorddreef 56E, 1101BE Amsterdam",
                            "email":                    "privacy.eu@chargepoint.com ",
                            "web":                      "https://de.chargepoint.com/privacy_policy"
                        },

                        "chargingStations": [{
                            "@id":                      stationMac,
                            // ToDo: The geo location and address are not validated yet!
                            "geoLocation":              chargyLib.asJSONObject(SomeJSON["geoLocation"]) as chargyInterfaces.IGeoLocation | undefined,
                            "address":                  chargyLib.asJSONObject(SomeJSON["address"])     as chargyInterfaces.IAddress     | undefined,
                            "EVSEs": [{
                                "@id":                      evseId,
                                "meters": [{
                                    "@id":                 meterSerial,
                                    "manufacturer":       "Carlo Gavazzi",
                                    "manufacturerURL":    "https://www.gavazziautomation.com",
                                    "model":              "EM340-DIN.AV2.3.X.S1.X",
                                    "modelURL":           "https://www.gavazziautomation.com/fileadmin/images/PIM/DATASHEET/ENG/EM340_DS_ENG.pdf"
                                    // "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                    // "publicKeys": [
                                    //     {
                                    //         "algorithm":        "secp224k1",
                                    //         "format":           "DER",
                                    //         "value":            null
                                    //     }
                                    // ]
                                }]
                            }]
                        }],

                        "chargingTariffs": [{
                            "@id":                  "default",
                            "currency":             currencyCode,
                            "taxes": [{
                                "@id":          "MwSt",
                                "percentage":   19.0,
                            }]
                        }],

                        "parkingTariffs": [{
                            "@id":                  "default",
                            "currency":             currencyCode,
                            "taxes": [{
                                "@id":          "MwSt",
                                "percentage":   19.0,
                            }]
                        }]

                    }],

                    "chargingSessions": [{

                        "original":                     original,
                        "signature":                    signature,

                        "@id":                          stationMac     + "-" +
                                                        String(outlet) + "-" +
                                                        String(sessionId),
                        "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargePointCrypt01+json",
                        "begin":                        this.chargy.moment.unix(sessionStart ?? NaN).utc().format(),
                        "end":                          this.chargy.moment.unix(sessionEnd   ?? NaN).utc().format(),
                        "EVSEId":                       evseId,

                        "authorizationStart": {
                            "@id":                      driverInfo,
                            "type":                     "userId"
                        },

                        "chargingProductRelevance": {
                            "time":                     chargyInterfaces.InformationRelevance.Informative,
                            "energy":                   chargyInterfaces.InformationRelevance.Important,
                            "parking":                  chargyInterfaces.InformationRelevance.Informative,
                            "sessionFee":               chargyInterfaces.InformationRelevance.Informative,
                        },

                        // "signatureInfos": {
                        //     "hash":                     "SHA512",
                        //     "hashTruncation":           "24",
                        //     "algorithm":                "ECC",
                        //     "curve":                    "secp192r1",
                        //     "format":                   "rs"
                        // },

                        "measurements": [{

                            "energyMeterId":        meterSerial,
                            "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/ChargePointCrypt01+json",
                            "name":                 "Bezogene Energiemenge",
                            "obis":                 "1-0:1.8.0",
                            "unit":                 energyUnits,
                    //        "unitEncoded":          CTRArray[0]["measuredValue"]["unitEncoded"],
                    //        "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                            "scale":                0,

                            // "signatureInfos": {
                            //     "hash":                 "SHA256",
                            // // "hashTruncation":       "24",
                            //     "algorithm":            "ECDSA",
                            //     "curve":                "secp224k1",
                            //     "format":               "rs"
                            // },

                            "values": [
                                {
                                    "timestamp":        this.chargy.moment.unix(chargingStart ?? NaN).utc().format(),
                                    "value":            new Decimal(chargyLib.asNumber(additionalInfo["meter_startreading"]) ?? NaN),
                                    signatures:         []
                                },
                                {
                                    "timestamp":        this.chargy.moment.unix(chargingEnd ?? NaN).utc().format(),
                                    "value":            new Decimal(chargyLib.asNumber(additionalInfo["meter_endreading"]) ?? NaN),
                                    signatures:         []
                                }
                            ]

                        }]

                    }],

                    "certainty":        1,
                    "status":           chargyInterfaces.SessionVerificationResult.Unvalidated

                };


                if (parking && parking.length > 0 && CTR.chargingSessions)
                {

                    const chargingSession = CTR.chargingSessions[0];

                    if (chargingSession !== undefined)
                    {

                        chargingSession.parking = [];

                        for (const parkingItem of parking)
                        {

                            const parkingObj = chargyLib.asJSONObject(parkingItem);

                            if (chargyLib.asString(parkingObj?.["seq_num"]) !== "SUBTOTAL")
                            {
                                chargingSession.parking.push({
                                    "@id":     "-",
                                    begin:     this.chargy.moment.unix(chargyLib.asNumber(parkingObj?.["start_time_utc"]) ?? NaN).utc().format(),
                                    end:       this.chargy.moment.unix(chargyLib.asNumber(parkingObj?.["end_time_utc"])   ?? NaN).utc().format(),
                                    overstay:  chargyLib.asNumber(parkingObj?.["overstay"]) === 1,
                                });
                            }

                        }

                    }

                }

                return CTR;

            }

            //#endregion

            //#region Second CTR format

            if (SomeJSON["outlet"]              !== undefined &&
                SomeJSON["session_id"]          !== undefined &&
                SomeJSON["station_mac"]         !== undefined &&
                SomeJSON["driver_info"]         !== undefined &&
                SomeJSON["meter_serial"]        !== undefined &&
                SomeJSON["meter_startreading"]  !== undefined &&
                SomeJSON["meter_endreading"]    !== undefined &&
                SomeJSON["total_energy"]        !== undefined &&
                SomeJSON["energy_units"]        !== undefined &&
                SomeJSON["start_time"]          !== undefined &&
                SomeJSON["end_time"]            !== undefined) {

                //#region Documentation

                // {
                //     "outlet":              2,
                //     "session_id":          55,
                //     "station_mac":        "0024b1000002e300",
                //     "driver_info":        "b2dd852e99433cab70ccd45dad5aff55",
                //     "meter_serial":       "240008S",
                //     "meter_startreading":  74.6,
                //     "meter_endreading":    86.6,
                //     "total_energy":        12.0,
                //     "energy_units":       "kWh",
                //     "start_time":          1581763758,  // Is this UTC?
                //     "end_time":            1581772802   // Is this UTC?
                // }


                // PEM Public Key: https://report-uri.com/home/pem_decoder

                // Array
                // (
                //     [bits] => 225
                //     [key]  => -----BEGIN PUBLIC KEY-----
                //               ME4wEAYHKoZIzj0CAQYFK4EEACADOgAEQwudsru6AlnW9u2AG88FPIKkO5yUwC8N
                //               hKM53UhVJ6faX1c+EdhUdi6qj0quGVs9emjJ1N95S6Y=
                //               -----END PUBLIC KEY-----
                //     [ec]   => Array (
                //                   [curve_name] => secp224k1
                //                   [curve_oid]  => 1.3.132.0.32
                //                   [x]          => 430b9db2bbba0259d6f6ed801bcf053c82a43b9c94c02f0d84a339dd
                //                   [y]          => 485527a7da5f573e11d854762eaa8f4aae195b3d7a68c9d4df794ba6
                //               )
                //     [type] => 3
                // )

                //#endregion

                const stationMac    = chargyLib.asString(SomeJSON["station_mac"])  ?? "";
                const outlet        = chargyLib.asNumber(SomeJSON["outlet"])       ?? NaN;
                const sessionId     = chargyLib.asNumber(SomeJSON["session_id"])   ?? NaN;
                const driverInfo    = chargyLib.asString(SomeJSON["driver_info"])  ?? "";
                const meterSerial   = chargyLib.asString(SomeJSON["meter_serial"]) ?? "";
                const energyUnits   = chargyLib.asString(SomeJSON["energy_units"]) ?? "";
                const startTime     = chargyLib.asNumber(SomeJSON["start_time"])   ?? NaN;
                const endTime       = chargyLib.asNumber(SomeJSON["end_time"])     ?? NaN;
                const evseId        = chargyLib.asString(SomeJSON["EVSEId"]) ?? (stationMac + "-" + String(outlet));
                const original      = chargyLib.asString(SomeJSON["original"]);

                // The signature is usually a DER encoded string, but might
                // already be in the rs-format...
                const signature     = chargyLib.asString(SomeJSON["signature"])
                                          ?? chargyLib.asJSONObject(SomeJSON["signature"]) as chargyInterfaces.ISignatureRS | undefined;

                const CTR: IChargepointChargeTransparencyRecord = {

                    "@id":              "chargepoint-" + stationMac     + "-" +
                                                         String(outlet) + "-" +
                                                         String(sessionId),
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.chargy.moment.unix(startTime).utc().format(),
                    "end":              this.chargy.moment.unix(endTime).utc().format(),

                    // "description": {
                    //     "de":           "Alle Ladevorgänge"
                    // },

                    "contract": {
                        "@id":          driverInfo,
                        "type":         "userId"
                    },

                    "chargingStationOperators": [{

                        "@id":                      "chargepoint",
                        "description": {
                            "de":                   "chargepoint - Charging Station Operator Services"
                        },

                        "contact": {
                            "email":                    "sales@chargepoint.com",
                            "web":                      "https://www.chargepoint.com",
                            "logoUrl":                  "https://www.chargepoint.com/themes/chargepoint/logo.svg",
                        },

                        "support": {
                            "hotline":                  "+49(69) 95307383",
                            "email":                    "support.eu@chargepoint.com",
                            "web":                      "https://chargepoint.charging.cloud/issues"
                        },

                        "privacy": {
                            "contact":                  "chargepoint, Attn: Data Protection Officer, ChargePoint Network (Netherlands) B.V., Hoogoorddreef 56E, 1101BE Amsterdam",
                            "email":                    "privacy.eu@chargepoint.com ",
                            "web":                      "https://de.chargepoint.com/privacy_policy"
                        },

                        "chargingStations": [{
                            "@id":                      stationMac,
                            // ToDo: The geo location and address are not validated yet!
                            "geoLocation":              chargyLib.asJSONObject(SomeJSON["geoLocation"]) as chargyInterfaces.IGeoLocation | undefined,
                            "address":                  chargyLib.asJSONObject(SomeJSON["address"])     as chargyInterfaces.IAddress     | undefined,
                            "EVSEs": [{
                                "@id":                  evseId,
                                "meters": [{
                                    "@id":                meterSerial,
                                    "manufacturer":       "Carlo Gavazzi",
                                    "manufacturerURL":    "https://www.gavazziautomation.com",
                                    "model":              "EM340-DIN.AV2.3.X.S1.X",
                                    "modelURL":           "https://www.gavazziautomation.com/fileadmin/images/PIM/DATASHEET/ENG/EM340_DS_ENG.pdf",
                                    "signatureFormat":    "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                    "signatureInfos": {
                                            "hash":             "SHA256",
                                            "hashTruncation":    24,
                                            "algorithm":        "ECDSA",
                                            "curve":            "secp224k1",
                                            "format":           "rs"
                                    },
                                    "publicKeys": [{
                                            "algorithm":        "secp224k1",
                                            "format":           "DER",
                                            "encoding":         "hex"
                                    }]
                                }]
                            }]
                        }]

                    }],

                    "chargingSessions": [{

                        "original":               original,
                        "signature":              signature,

                        "@id":                    stationMac     + "-" +
                                                  String(outlet) + "-" +
                                                  String(sessionId),
                        "@context":               "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargePointCrypt01+json",
                        "begin":                  this.chargy.moment.unix(startTime).utc().format(),
                        "end":                    this.chargy.moment.unix(endTime).utc().format(),
                        "EVSEId":                 evseId,

                        "authorizationStart": {
                            "@id":                driverInfo,
                            "type":               "userId"
                        },

                        "chargingProductRelevance": {
                            "time":               chargyInterfaces.InformationRelevance.Informative,
                            "energy":             chargyInterfaces.InformationRelevance.Important,
                            "parking":            chargyInterfaces.InformationRelevance.Informative,
                            "sessionFee":         chargyInterfaces.InformationRelevance.Informative,
                        },

                        "measurements": [{

                            "energyMeterId":  meterSerial,
                            "@context":       "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/ChargePointCrypt01+json",
                            "name":           "Bezogene Energiemenge",
                            "obis":           "1-0:1.8.0",
                            "unit":           energyUnits,
                            "scale":          0,

                            "values": [
                                {
                                    "timestamp":        this.chargy.moment.unix(startTime).utc().format(),
                                    "value":            new Decimal(chargyLib.asNumber(SomeJSON["meter_startreading"]) ?? NaN),
                                    "signatures":       []
                                },
                                {
                                    "timestamp":        this.chargy.moment.unix(endTime).utc().format(),
                                    "value":            new Decimal(chargyLib.asNumber(SomeJSON["meter_endreading"]) ?? NaN),
                                    "signatures":       []
                                }
                            ]

                        }]

                    }],

                    "certainty":  1,
                    "status":     chargyInterfaces.SessionVerificationResult.Unvalidated

                };

                return CTR;

            }

            //#endregion

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : String(exception)),
                certainty: 0
            }
        }

        return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
            certainty: 0
        }

    }

    //#endregion

}


export interface IChargepointMeasurementValue extends chargeTransparencyRecord.IMeasurementValue
{
    statusMeter:                   string,
    secondsIndex:                  number,
    paginationId:                  string,
    logBookIndex:                  string
}

export interface IChargePointCrypt01Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  string,
    meterId?:                      string,
    meter?:                        chargyInterfaces.IMeter,
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
    publicKeySignatures?:          Array<unknown>,
    signature?:                    chargyInterfaces.ISignatureRS
}


export class ChargePointCrypt01 extends ACrypt {

    // For older chargepoint charging station firmwares
    // Koblitz 224-bit curve: secp224k1
    // https://www.secg.org/sec2-v2.pdf

    // For newer chargepoint charging station firmwares
    // NIST/ANSI X9.62 named 256-bit elliptic curve: secp256r1
    // https://www.secg.org/sec2-v2.pdf

    constructor(chargy:  Chargy) {
        super("ECC secp224k1/secp256r1",
              chargy);
    }


    async VerifyChargingSession(chargingSession: chargeTransparencyRecord.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        if (chargingSession.ctr === undefined)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSignature,
                message:   this.chargy.GetLocalizedMessage("InvalidSignature"),
                certainty: 0
            }
        }

        try
        {

            let   sessionResult  = chargyInterfaces.SessionVerificationResult.UnknownSessionFormat;
            const plainText      = chargingSession.original != null ? atob(chargingSession.original) : "";

            //#region Convert signature into rs-format...

            if (chargingSession.signature         !=  null &&
                chargingSession.signature         !== ""   &&
                typeof(chargingSession.signature) === 'string')
            {

                const ASN1_SignatureSchema  = this.chargy.asn1.define('Signature', function() {
                    this.seq().obj(
                        this.key('r').int(),
                        this.key('s').int()
                    );
                });

                const ASN1Signature         = ASN1_SignatureSchema.decode<{ r: { toString(base: number): string }, s: { toString(base: number): string } }>(Buffer.from(chargingSession.signature, 'hex'), 'der');

                chargingSession.signature   = { r: ASN1Signature.r.toString(16),
                                                s: ASN1Signature.s.toString(16) };

            }

            //#endregion

            //#region Find public key, or use all available public keys

            const publicKeyId  = chargingSession.EVSEId.replace(/:/g, "").replace(/-/g, "_");
            const publicKeys   = [];

            if (chargingSession.ctr.publicKeys != null)
            {

                for (const publicKeyInfo of chargingSession.ctr.publicKeys)
                {
                    if (publicKeyInfo["@id"] === publicKeyId)
                        publicKeys.push(publicKeyInfo);
                }

                if (publicKeys.length == 0)
                {
                    for (const publicKeyInfo of chargingSession.ctr.publicKeys)
                    {
                        publicKeys.push(publicKeyInfo);
                    }
                }

            }

            if (publicKeys.length == 0)
                return {
                    status:    chargyInterfaces.SessionVerificationResult.PublicKeyNotFound,
                    message:   this.chargy.GetLocalizedMessage("Public key notFound"),
                    certainty: 0
                }

            //#endregion

            //#region Validate session

            if (plainText                 !== ""   &&
                chargingSession.signature !=  null &&
                chargingSession.signature !== "")
            {

                let sha225Value: string|null = null;
                let sha256Value: string|null = null;
                let sha385Value: string|null = null;
                let sha512Value: string|null = null;

                for (const publicKey of publicKeys)
                {

                    const algorithm = (typeof publicKey.algorithm === "object")
                                        ? publicKey.algorithm.name
                                        : publicKey.algorithm;

                    switch (algorithm)
                    {

                        case "secp224k1":

                            sha225Value          = sha225Value ?? (BigInt("0x" + (await chargyLib.sha256(plainText))) >> BigInt(31)).toString(16);
                            sessionResult        = this.curve224k1.validate(BigInt("0x" + sha225Value),
                                                                            BigInt("0x" + (chargingSession.signature.r ?? "00")),
                                                                            BigInt("0x" + (chargingSession.signature.s ?? "00")),
                                                                          [ BigInt("0x" + publicKey.value.slice( 2,  58)),
                                                                            BigInt("0x" + publicKey.value.slice(58, 114)) ])
                                                       ? chargyInterfaces.SessionVerificationResult.ValidSignature
                                                       : chargyInterfaces.SessionVerificationResult.InvalidSignature;
                            break;

                        case "secp256r1":
                            sha256Value          = sha256Value ?? await chargyLib.sha256(plainText);
                            sessionResult        = this.curve256r1.keyFromPublic(publicKey.value, 'hex').
                                                                   verify       (sha256Value,
                                                                                 chargingSession.signature)
                                                       ? chargyInterfaces.SessionVerificationResult.ValidSignature
                                                       : chargyInterfaces.SessionVerificationResult.InvalidSignature;
                            break;

                        case "secp384r1":
                            sha385Value          = sha385Value ?? await chargyLib.sha384(plainText);
                            sessionResult        = this.curve384r1.keyFromPublic(publicKey.value, 'hex').
                                                                   verify       (sha385Value,
                                                                                 chargingSession.signature)
                                                       ? chargyInterfaces.SessionVerificationResult.ValidSignature
                                                       : chargyInterfaces.SessionVerificationResult.InvalidSignature;
                            break;

                        case "secp521r1":
                            sha512Value          = sha512Value ?? await chargyLib.sha512(plainText);
                            sessionResult        = this.curve521r1.keyFromPublic(publicKey.value, 'hex').
                                                                   verify       (sha512Value,
                                                                                 chargingSession.signature)
                                                       ? chargyInterfaces.SessionVerificationResult.ValidSignature
                                                       : chargyInterfaces.SessionVerificationResult.InvalidSignature;
                            break;

                    }

                    if (sessionResult == chargyInterfaces.SessionVerificationResult.ValidSignature)
                    {

                        chargingSession.publicKey = publicKey;

                        switch (algorithm)
                        {

                            case "secp224k1":
                                chargingSession.hashValue = sha225Value ?? "";
                                break;

                            case "secp256r1":
                                chargingSession.hashValue = sha256Value ?? "";
                                break;

                            case "secp384r1":
                                chargingSession.hashValue = sha385Value ?? "";
                                break;

                            case "secp521r1":
                                chargingSession.hashValue = sha512Value ?? "";
                                break;

                        }

                    }

                }

            }

            //#endregion

            //#region Validate measurements

            for (const measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values.length > 1)
                {

                    //#region Validate measurements...

                    for (const measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IChargepointMeasurementValue);
                    }

                    //#endregion

                    //#region Find an overall result...

                    for (const measurementValue of measurement.values)
                    {
                        if (measurementValue.result?.status !== chargyInterfaces.VerificationResult.ValidSignature &&
                            measurementValue.result?.status !== chargyInterfaces.VerificationResult.NoOperation)
                        {
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSignature,
                                message:   this.chargy.GetLocalizedMessage("InvalidSignature"),
                                certainty: 0
                            }
                        }
                    }

                    //#endregion

                    for (let i = 0; i < measurement.values.length; i++)
                    {

                        const currentResult = measurement.values[i]?.result;

                        if (currentResult !== undefined) {

                            //#region Adapt start value

                            if (i == 0)
                            {
                                switch (currentResult.status)
                                {

                                    case chargyInterfaces.VerificationResult.ValidSignature:
                                        currentResult.status = chargyInterfaces.VerificationResult.ValidStartValue;
                                        break;

                                    case chargyInterfaces.VerificationResult.NoOperation:
                                        currentResult.status = chargyInterfaces.VerificationResult.StartValue;
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidSignature:
                                        currentResult.status = chargyInterfaces.VerificationResult.InvalidStartValue;
                                        break;

                                }
                            }

                            //#endregion

                            //#region Adapt stop value

                            else if (i == measurement.values.length-1)
                            {
                                switch (currentResult.status)
                                {

                                    case chargyInterfaces.VerificationResult.ValidSignature:
                                        currentResult.status = chargyInterfaces.VerificationResult.ValidStopValue;
                                        break;

                                    case chargyInterfaces.VerificationResult.NoOperation:
                                        currentResult.status = chargyInterfaces.VerificationResult.StopValue;
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidSignature:
                                        currentResult.status = chargyInterfaces.VerificationResult.InvalidStopValue;
                                        break;

                                }
                            }

                            //#endregion

                            //#region Adapt intermediate values

                            else
                            {
                                switch (currentResult.status)
                                {

                                    case chargyInterfaces.VerificationResult.ValidSignature:
                                        currentResult.status = chargyInterfaces.VerificationResult.ValidIntermediateValue;
                                        break;

                                    case chargyInterfaces.VerificationResult.NoOperation:
                                        currentResult.status = chargyInterfaces.VerificationResult.IntermediateValue;
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidSignature:
                                        currentResult.status = chargyInterfaces.VerificationResult.InvalidStopValue;
                                        break;

                                }

                            }

                            //#endregion

                        }

                    }

                }
                else
                    sessionResult = chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }

            //#endregion

            return {
                status:    sessionResult,
                certainty: .5
            }

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSignature,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : String(exception)),
                certainty: 0
            }
        }

    }

    async VerifyMeasurement(measurementValue: IChargepointMeasurementValue): Promise<IChargePointCrypt01Result>
    {

        // Note: chargepoint does not sign individual measurements!

        function setResult(verificationResult: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status     = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        measurementValue.method = this;

        const cryptoResult:IChargePointCrypt01Result = {
            status: chargyInterfaces.VerificationResult.NoOperation,
        };

        return await Promise.resolve(setResult(chargyInterfaces.VerificationResult.NoOperation));

    }

    async ViewMeasurement(measurementValue:      IChargepointMeasurementValue,
                          errorDiv:              HTMLDivElement,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement) : Promise<Error | undefined>

    {

        if (measurementValue.measurement?.chargingSession === undefined)
            return new Error("Invalid measurement!");


        const chargingSession    = measurementValue.measurement.chargingSession;
        const result             = measurementValue.result as IChargePointCrypt01Result;
        const algorithmName      = (typeof chargingSession.publicKey?.algorithm === "object")
                                         ? chargingSession.publicKey.algorithm.name 
                                         : chargingSession.publicKey?.algorithm      ?? "";
        const algorithmType      = (typeof chargingSession.publicKey?.type      === "object")
                                         ? chargingSession.publicKey.type.name
                                         : chargingSession.publicKey?.type;

        //#region Headline / Introduction

        introDiv.innerHTML = this.chargy.GetLocalizedMessage("The following data of the charging session is relevant for metrological and legal metrological purposes and therefore part of the digital signature").
                                        replace("{methodName}",       "ChargePointCrypt01").
                                        replace("{cryptoAlgorithm}",   algorithmName);

        //#endregion


        //#region Plain text

        if (PlainTextDiv.parentElement             != undefined &&
            PlainTextDiv.parentElement.children[0] != undefined)
        {
            PlainTextDiv.parentElement.children[0].innerHTML  = "Plain text (secrrct)";
        }

        PlainTextDiv.innerText                                = atob(chargingSession.original ?? "");

        PlainTextDiv.style.fontFamily  = "monospace";
        PlainTextDiv.style.whiteSpace  = "pre";
        PlainTextDiv.style.maxHeight   = "25vh";
        PlainTextDiv.style.overflowY   = "scroll";

        //#endregion

        //#region Hashed plain text

        let hashInfo = "";

        switch (algorithmName)
        {

            case "secp224k1":
                hashInfo  = "(SHA256, 225 Bits, hex)";
                break;

            case "secp256r1":
                hashInfo  = "(SHA256, 256 Bits, hex)";
                break;

            case "secp384r1":
                hashInfo  = "(SHA384, 384 Bits, hex)";
                break;

            case "secp512r1":
                hashInfo  = "(SHA512, 512 Bits, hex)";
                break;

        }

        if (HashedPlainTextDiv.parentElement             != undefined &&
            HashedPlainTextDiv.parentElement.children[0] != undefined)
        {
            HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text " + hashInfo;
        }

        HashedPlainTextDiv.innerHTML  = chargingSession.hashValue?.match(/.{1,8}/g)?.join(" ")
                                            ?? "0x00000000000000000000000000000000000";

        //#endregion

        //#region Public Key

        if (chargingSession.publicKey != null)
        {

            if (PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[0] != undefined)
            {
                PublicKeyDiv.parentElement.children[0].innerHTML  = "Public Key (" +
                                                                         (algorithmType
                                                                              ? algorithmType + ", "
                                                                              : "") +
                                                                         (algorithmName
                                                                              ? algorithmName + ", "
                                                                              : "") +
                                                                          "hex)";
            }

            PublicKeyDiv.innerHTML  = chargingSession.publicKey.value.startsWith("04") // Add some space after '04' to avoid confused customers
                                          ? "<span class=\"leadingFour\">04</span> "
                                            + (chargingSession.publicKey.value.substring(2).match(/.{1,8}/g)?.join(" ") ?? "")
                                          :   (chargingSession.publicKey.value.             match(/.{1,8}/g)?.join(" ") ?? "");


            //#region Public key signatures

            if (PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[3] != undefined)
            {
                PublicKeyDiv.parentElement.children[3].innerHTML = "";
            }

            if (result.publicKeySignatures) {

                for (const signature of result.publicKeySignatures)
                {

                    try
                    {

                        const signatureDiv = PublicKeyDiv.parentElement?.children[3]?.appendChild(document.createElement('div'));

                        if (signatureDiv != null)
                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(measurementValue.measurement.chargingSession.chargingStation,
                                                                                                    measurementValue.measurement.chargingSession.EVSE,
                                                                                                    measurementValue.measurement.chargingSession.EVSE?.meters[0],
                                                                                                    measurementValue.measurement.chargingSession.EVSE?.meters[0]?.publicKeys?.[0],
                                                                                                    signature);

                    }
                    catch
                    {
                        // Optional public key signature metadata is displayed only when available.
                    }

                }

            }

            //#endregion

        }

        //#endregion

        //#region Signature expected

        if (chargingSession.signature != null)
        {

            if (SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement.children[0] != undefined)
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (secrrct.sign, rs, hex)";// " + (result.signature?.format ?? "") + ", hex)";
            }

            if (typeof chargingSession.signature != 'string')
                SignatureExpectedDiv.innerHTML                            = "r: " + (chargingSession.signature.r?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") ?? "") + "<br />" +
                                                                            "s: " + (chargingSession.signature.s?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") ?? "");

            else if (chargingSession.signature)
                SignatureExpectedDiv.innerHTML                            = chargingSession.signature.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

        }

        //#endregion


        //#region Signature check

        if (chargingSession.verificationResult != null)
        {
            switch (chargingSession.verificationResult.status)
            {

                // case SessionVerificationResult.UnknownCTRFormat:
                //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                //     break;

                // case SessionVerificationResult.EnergyMeterNotFound:
                //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                //     break;

                case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.ValidSignature:
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
