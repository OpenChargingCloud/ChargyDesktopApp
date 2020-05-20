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
///<reference path="secp224k1.ts" />

class Chargepoint01 {

    private moment:   any;

    constructor() {
        this.moment  = require('moment');
    }

    //#region tryToParseChargepointJSON(SomeJSON)

    public async tryToParseChargepointJSON(SomeJSON: any) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        try
        {

            //#region First CTR format

            if (SomeJSON.company_name    !== undefined &&
                SomeJSON.display_unit    !== undefined &&
                SomeJSON.energy          !== undefined &&
                SomeJSON.flat            !== undefined &&
                SomeJSON.minMaxAdj       !== undefined &&
                SomeJSON.parking         !== undefined &&
                SomeJSON.subtotal        !== undefined &&
                SomeJSON.totalAmount     !== undefined &&
                SomeJSON.additional_info !== undefined &&
                SomeJSON.additional_info !== undefined)
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

                let chargingStart  = "";
                let chargingEnd    = "";

                if (SomeJSON.energy && SomeJSON.energy.length > 0)
                {
                    for (let i=0; i<SomeJSON.energy.length; i++)
                    {
                        if (chargingStart == "" || SomeJSON.energy[i].start_time_utc < chargingStart)
                            chargingStart = SomeJSON.energy[i].start_time_utc;

                        if (chargingEnd   == "" || SomeJSON.energy[i].start_time_utc > chargingEnd)
                            chargingEnd   = SomeJSON.energy[i].end_time_utc;
                    }
                }

                let parkingStart  = "";
                let parkingEnd    = "";

                if (SomeJSON.parking && SomeJSON.parking.length > 0)
                {
                    for (let i=0; i<SomeJSON.parking.length; i++)
                    {
                        if (parkingStart == "" || SomeJSON.parking[i].start_time_utc < parkingStart)
                            parkingStart = SomeJSON.parking[i].start_time_utc;

                        if (parkingEnd   == "" || SomeJSON.parking[i].start_time_utc > parkingEnd)
                            parkingEnd   = SomeJSON.parking[i].end_time_utc;
                    }
                }

                // Sometimes there is "parking" but no "energy"...
                if (chargingStart == "")
                    chargingStart = parkingStart;

                if (chargingEnd   == "")
                    chargingEnd   = parkingEnd;


                let sessionStart = parkingStart < chargingStart ? parkingStart : chargingStart;

                if (sessionStart == "" && chargingStart != "")
                    sessionStart = chargingStart;

                if (sessionStart == "" && parkingStart != "")
                    sessionStart = parkingStart;


                let sessionEnd   = parkingEnd   < chargingEnd   ? parkingEnd   : chargingEnd;

                if (sessionEnd   == "" && chargingEnd != "")
                    sessionEnd   = chargingEnd;

                if (sessionEnd   == "" && parkingEnd != "")
                    sessionEnd   = parkingEnd;


                var _CTR: any = { //IChargeTransparencyRecord = {

                    "@id":              "chargepoint-" + SomeJSON.additional_info.station_mac + "-" +
                                                         SomeJSON.additional_info.outlet      + "-" +
                                                         SomeJSON.additional_info.session_id,
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.moment.unix(sessionStart).utc().format(),
                    "end":              this.moment.unix(sessionEnd).utc().format(),

                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },

                    "contract": {
                        "@id":          SomeJSON.additional_info.driver_info,
                        "type":         "userId"
                        // "username":     "",
                        // "email":        ""
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      SomeJSON.company_name,
                            // "eMobilityIds":             [ ],
                            "description": {
                                "de":                   "Charge Point - Charging Station Operator Services"
                            },

                            "contact": {
                                "email":                    "sales@chargepoint.com",
                                "web":                      "https://www.chargepoint.com",
                                "logoUrl":                  "https://www.chargepoint.com/themes/chargepoint/logo.svg",
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                //         "signatures": [
                                //             {
                                //                 "keyId":      "...",
                                //                 "algorithm":  "secp256r1",
                                //                 "format":     "DER",
                                //                 "value":      "????"
                                //             }
                                //         ]
                                //     },
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "support": {
                                "hotline":                  "+49(69) 95307383",
                                "email":                    "support.eu@chargepoint.com",
                                "web":                      "https://chargepoint.charging.cloud/issues"
                                // "mediationServices":        [ "GraphDefined Mediation" ],
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "privacy": {
                                "contact":                  "ChargePoint, Attn: Data Protection Officer, ChargePoint Network (Netherlands) B.V., Hoogoorddreef 56E, 1101BE Amsterdam",
                                "email":                    "privacy.eu@chargepoint.com ",
                                "web":                      "https://de.chargepoint.com/privacy_policy"
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "chargingStations": [
                                {
                                    "@id":                      SomeJSON.additional_info.station_mac,
                                    "firmwareVersion":          "",
                                    "geoLocation":              null,
                                    "address":                  null,
                                    "EVSEs": [
                                        {
                                            "@id":                      SomeJSON.additional_info.station_mac + "-" + SomeJSON.additional_info.outlet,
                                            "sockets":                  [ { } ],
                                            "meters": [
                                                {
                                                    "@id":                      SomeJSON.additional_info.meter_serial,
                                                    "vendor":                   "Carlo Gavazzi",
                                                    //"vendorURL":                null,
                                                    "model":                    "EM340-DIN.AV2.3.X.S1.X",
                                                    //"hardwareVersion":          null,
                                                    //"firmwareVersion":          null,
                                                    // "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                    // "publicKeys": [
                                                    //     {
                                                    //         "algorithm":        "secp224k1",
                                                    //         "format":           "DER",
                                                    //         "value":            null,
                                                    //         "signatures":       null
                                                    //     }
                                                    // ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ],

                            "chargingTariffs": [{
                                "@id":                  "default",
                                "currency":             SomeJSON.additional_info.currency_code,
                                "taxes": [
                                    {
                                        "@id":          "MwSt",
                                        "percentage":   19.0,
                                    }
                                ]
                            }],

                            "parkingTariffs": [{
                                "@id":                  "default",
                                "currency":             SomeJSON.additional_info.currency_code,
                                "taxes": [
                                    {
                                        "@id":          "MwSt",
                                        "percentage":   19.0,
                                    }
                                ]
                            }]

                        }
                    ],

                    "chargingSessions": [

                        {

                            "original":                     SomeJSON.original,
                            "signature":                    SomeJSON.signature,

                            "@id":                          SomeJSON.additional_info.station_mac + "-" +
                                                            SomeJSON.additional_info.outlet      + "-" +
                                                            SomeJSON.additional_info.session_id,
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargepointCrypt01+json",
                            "begin":                        this.moment.unix(sessionStart).utc().format(),
                            "end":                          this.moment.unix(sessionEnd).utc().format(),
                            "EVSEId":                       SomeJSON.additional_info.station_mac + "-" +
                                                            SomeJSON.additional_info.outlet,

                            "authorizationStart": {
                                "@id":                      SomeJSON.additional_info.driver_info,
                                "type":                     "userId"
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

                                    "energyMeterId":        SomeJSON.additional_info.meter_serial,
                                    "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/ChargepointCrypt01+json",
                                    "name":                 SomeJSON.energy != null && SomeJSON.energy.length > 0 ? SomeJSON.energy[0].type : "ENERGY",
                                    "obis":                 "1-0:1.17.0*255",
                                    "unit":                 SomeJSON.additional_info.energy_units,
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
                                            "timestamp":        this.moment.unix(chargingStart).utc().format(),
                                            "value":            SomeJSON.additional_info.meter_startreading
                                        },
                                        {
                                            "timestamp":        this.moment.unix(chargingEnd).utc().format(),
                                            "value":            SomeJSON.additional_info.meter_endreading
                                        }
                                    ]

                                }

                            ]

                        }

                    ]

                };


                if (SomeJSON.parking && SomeJSON.parking.length > 0)
                {

                    _CTR.chargingSessions[0].parking = [];

                    for (let parking of SomeJSON.parking)
                    {
                        if (parking.seq_num != "SUBTOTAL")
                        {
                            _CTR.chargingSessions[0].parking.push({
                                begin:     this.moment.unix(parking.start_time_utc).utc().format(),
                                end:       this.moment.unix(parking.end_time_utc).utc().format(),
                                overstay:  parking.overstay == 1,
                            });
                        }
                    }

                }

                return _CTR as IChargeTransparencyRecord;

            }

            //#endregion

            //#region Second CTR format

            if (SomeJSON.outlet              !== undefined &&
                SomeJSON.session_id          !== undefined &&
                SomeJSON.station_mac         !== undefined &&
                SomeJSON.driver_info         !== undefined &&
                SomeJSON.meter_serial        !== undefined &&
                SomeJSON.meter_startreading  !== undefined &&
                SomeJSON.meter_endreading    !== undefined &&
                SomeJSON.total_energy        !== undefined &&
                SomeJSON.energy_units        !== undefined &&
                SomeJSON.start_time          !== undefined &&
                SomeJSON.end_time            !== undefined) {

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

                var _CTR: any = { //IChargeTransparencyRecord = {

                    "@id":              "chargepoint-" + SomeJSON.station_mac + "-" +
                                                         SomeJSON.outlet      + "-" +
                                                         SomeJSON.session_id,
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.moment.unix(SomeJSON.start_time).utc().format(),
                    "end":              this.moment.unix(SomeJSON.end_time).utc().format(),

                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },

                    "contract": {
                        "@id":          SomeJSON.driver_info,
                        "type":         "userId"
                        // "username":     "",
                        // "email":        ""
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      "ChargePoint",
                            // "eMobilityIds":             [ ],
                            "description": {
                                "de":                   "Charge Point - Charging Station Operator Services"
                            },

                            "contact": {
                                "email":                    "sales@chargepoint.com",
                                "web":                      "https://www.chargepoint.com",
                                "logoUrl":                  "https://www.chargepoint.com/themes/chargepoint/logo.svg",
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                //         "signatures": [
                                //             {
                                //                 "keyId":      "...",
                                //                 "algorithm":  "secp256r1",
                                //                 "format":     "DER",
                                //                 "value":      "????"
                                //             }
                                //         ]
                                //     },
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "support": {
                                "hotline":                  "+49(69) 95307383",
                                "email":                    "support.eu@chargepoint.com",
                                "web":                      "https://chargepoint.charging.cloud/issues"
                                // "mediationServices":        [ "GraphDefined Mediation" ],
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "privacy": {
                                "contact":                  "ChargePoint, Attn: Data Protection Officer, ChargePoint Network (Netherlands) B.V., Hoogoorddreef 56E, 1101BE Amsterdam",
                                "email":                    "privacy.eu@chargepoint.com ",
                                "web":                      "https://de.chargepoint.com/privacy_policy"
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256r1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "chargingStations": [
                                {
                                    "@id":                      SomeJSON.station_mac,
                                    "firmwareVersion":          "",
                                    "geoLocation":              null,
                                    "address":                  null,
                                    "EVSEs": [
                                        {
                                            "@id":                      SomeJSON.station_mac + "-" + SomeJSON.outlet,
                                            "sockets":                  [ { } ],
                                            "meters": [
                                                {
                                                    "@id":                      SomeJSON.meter_serial,
                                                    "vendor":                   "Carlo Gavazzi",
                                                    //"vendorURL":                null,
                                                    "model":                    "EM340-DIN.AV2.3.X.S1.X",
                                                    //"hardwareVersion":          null,
                                                    //"firmwareVersion":          null,
                                                    // "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                    // "publicKeys": [
                                                    //     {
                                                    //         "algorithm":        "secp224k1",
                                                    //         "format":           "DER",
                                                    //         "value":            null,
                                                    //         "signatures":       null
                                                    //     }
                                                    // ]
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

                            "original":                     SomeJSON.original,
                            "signature":                    SomeJSON.signature,

                            "@id":                          SomeJSON.station_mac + "-" +
                                                            SomeJSON.outlet      + "-" +
                                                            SomeJSON.session_id,
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargepointCrypt01+json",
                            "begin":                        this.moment.unix(SomeJSON.start_time).utc().format(),
                            "end":                          this.moment.unix(SomeJSON.end_time).utc().format(),
                            "EVSEId":                       SomeJSON.station_mac + "-" +
                                                            SomeJSON.outlet,

                            "authorizationStart": {
                                "@id":                      SomeJSON.driver_info,
                                "type":                     "userId"
                            },

                            "signatureInfos": {
                                "hash":                     "SHA256",
                                "hashTruncation":           "24",
                                "algorithm":                "ECDSA",
                                "curve":                    "secp224k1",
                                "format":                   "rs"
                            },

                            "measurements": [

                                {

                                    "energyMeterId":        SomeJSON.meter_serial,
                                    "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/ChargepointCrypt01+json",
                                    "name":                 "ENERGY",
                                    "obis":                 "1-0:1.17.0*255",
                                    "unit":                 SomeJSON.energy_units,
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
                                            "timestamp":        this.moment.unix(SomeJSON.start_time).utc().format(),
                                            "value":            SomeJSON.meter_startreading
                                        },
                                        {
                                            "timestamp":        this.moment.unix(SomeJSON.end_time).utc().format(),
                                            "value":            SomeJSON.meter_endreading
                                        }
                                    ]

                                }

                            ]

                        }

                    ]

                };

                return _CTR as IChargeTransparencyRecord;

            }

            //#endregion

        }
        catch (exception)
        {
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + exception.message
            }
        }

        return {
            status:  SessionVerificationResult.InvalidSessionFormat
        }

    }

    //#endregion

}


interface IChargepointMeasurementValue extends IMeasurementValue
{
    infoStatus:                    string,
    secondsIndex:                  number,
    paginationId:                  string,
    logBookIndex:                  string
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
                        sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsRequired;

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