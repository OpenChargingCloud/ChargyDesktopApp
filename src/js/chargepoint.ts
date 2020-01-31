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

class Chargepoint {

    private moment:   any;

    constructor() {
        this.moment  = require('moment');
    }

    //#region tryToParseChargepointJSON(SomeJSON)

    public async tryToParseChargepointJSON(SomeJSON: any) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        try
        {

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
                            "de":                   "chargepoint - Charging Station Operator Services"
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

                                "signatureInfos": {
                                    "hash":                 "SHA256",
                                   // "hashTruncation":       "24",
                                    "algorithm":            "ECDSA",
                                    "curve":                "secp224k1",
                                    "format":               "rs"
                                },

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
