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


export interface IChargepointChargeTransparencyRecord extends chargyInterfaces.IChargeTransparencyRecord
{
    //chargingSessions?:          Array<IAlfenChargingSession>;
}

export class Chargepoint01 {

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }

    //#region tryToParseChargepointFormat(SomeJSON)

    public async tryToParseChargepointFormat(SomeJSON: any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            //#region First CTR format

            if (SomeJSON.company_name    !== undefined &&
                SomeJSON.display_unit    !== undefined &&
                //SomeJSON.energy          !== undefined &&
                //SomeJSON.flat            !== undefined &&
                SomeJSON.minMaxAdj       !== undefined &&
                //SomeJSON.parking         !== undefined &&
                SomeJSON.subtotal        !== undefined &&
                SomeJSON.totalAmount     !== undefined &&
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


                var _CTR: IChargepointChargeTransparencyRecord = {

                    "@id":              "chargepoint-" + SomeJSON.additional_info.station_mac + "-" +
                                                         SomeJSON.additional_info.outlet      + "-" +
                                                         SomeJSON.additional_info.session_id,
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.chargy.moment.unix(sessionStart).utc().format(),
                    "end":              this.chargy.moment.unix(sessionEnd).utc().format(),

                    // "description": {
                    //     "de":           "Alle Ladevorgänge"
                    // },

                    "contract": {
                        "@id":          SomeJSON.additional_info.driver_info,
                        "type":         "userId"
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      SomeJSON.company_name,
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

                            "chargingStations": [
                                {
                                    "@id":                      SomeJSON.additional_info.station_mac,
                                    "geoLocation":              SomeJSON.geoLocation,
                                    "address":                  SomeJSON.address,
                                    "EVSEs": [
                                        {
                                            "@id":                      SomeJSON.EVSEId ?? SomeJSON.additional_info.station_mac + "-" + SomeJSON.additional_info.outlet,
                                            "meters": [
                                                {
                                                    "@id":                 SomeJSON.additional_info.meter_serial,
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
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargePointCrypt01+json",
                            "begin":                        this.chargy.moment.unix(sessionStart).utc().format(),
                            "end":                          this.chargy.moment.unix(sessionEnd).utc().format(),
                            "EVSEId":                       SomeJSON.EVSEId ?? SomeJSON.additional_info.station_mac + "-" + SomeJSON.additional_info.outlet,

                            "authorizationStart": {
                                "@id":                      SomeJSON.additional_info.driver_info,
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

                            "measurements": [

                                {

                                    "energyMeterId":        SomeJSON.additional_info.meter_serial,
                                    "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/ChargePointCrypt01+json",
                                    "name":                 "Bezogene Energiemenge",//SomeJSON.energy != null && SomeJSON.energy.length > 0 ? SomeJSON.energy[0].type : "Bezogene Energiemenge",
                                    "obis":                 "1-0:1.8.0",
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
                                            "timestamp":        this.chargy.moment.unix(chargingStart).utc().format(),
                                            "value":            SomeJSON.additional_info.meter_startreading,
                                            signatures:         []
                                        },
                                        {
                                            "timestamp":        this.chargy.moment.unix(chargingEnd).utc().format(),
                                            "value":            SomeJSON.additional_info.meter_endreading,
                                            signatures:         []
                                        }
                                    ]

                                }

                            ]

                        }

                    ],

                    "certainty":        1,
                    "status":           chargyInterfaces.SessionVerificationResult.Unvalidated

                };


                if (SomeJSON.parking && SomeJSON.parking.length > 0)
                {

                    _CTR.chargingSessions![0]!.parking = [];

                    for (let parking of SomeJSON.parking)
                    {
                        if (parking.seq_num != "SUBTOTAL")
                        {
                            _CTR.chargingSessions![0]!.parking.push({
                                "@id":     "-",
                                begin:     this.chargy.moment.unix(parking.start_time_utc).utc().format(),
                                end:       this.chargy.moment.unix(parking.end_time_utc).utc().format(),
                                overstay:  parking.overstay == 1,
                            });
                        }
                    }

                }

                return _CTR;

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

                var _CTR: IChargepointChargeTransparencyRecord = {

                    "@id":              "chargepoint-" + SomeJSON.station_mac + "-" +
                                                         SomeJSON.outlet      + "-" +
                                                         SomeJSON.session_id,
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "begin":            this.chargy.moment.unix(SomeJSON.start_time).utc().format(),
                    "end":              this.chargy.moment.unix(SomeJSON.end_time).utc().format(),

                    // "description": {
                    //     "de":           "Alle Ladevorgänge"
                    // },

                    "contract": {
                        "@id":          SomeJSON.driver_info,
                        "type":         "userId"
                    },

                    "chargingStationOperators": [
                        {

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

                            "chargingStations": [
                                {
                                    "@id":                      SomeJSON.station_mac,
                                    "geoLocation":              SomeJSON.geoLocation,
                                    "address":                  SomeJSON.address,
                                    "EVSEs": [
                                        {
                                            "@id":                  SomeJSON.EVSEId ?? SomeJSON.station_mac + "-" + SomeJSON.outlet,
                                            "meters": [
                                                {
                                                    "@id":                SomeJSON.meter_serial,
                                                    "manufacturer":       "Carlo Gavazzi",
                                                    "manufacturerURL":    "https://www.gavazziautomation.com",
                                                    "model":              "EM340-DIN.AV2.3.X.S1.X",
                                                    "modelURL":           "https://www.gavazziautomation.com/fileadmin/images/PIM/DATASHEET/ENG/EM340_DS_ENG.pdf",
                                                    "signatureFormat":    "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                    "signatureInfos": {
                                                         "hash":              "SHA256",
                                                         "hashTruncation":     24,
                                                         "algorithm":         "ECDSA",
                                                         "curve":             "secp224k1",
                                                         "format":            "rs"
                                                    },
                                                    "publicKeys": [
                                                        {
                                                             "algorithm":        "secp224k1",
                                                             "format":           "DER"
                                                             //"value":            null
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

                            "original":                     SomeJSON.original,
                            "signature":                    SomeJSON.signature,

                            "@id":                          SomeJSON.station_mac + "-" +
                                                            SomeJSON.outlet      + "-" +
                                                            SomeJSON.session_id,
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargePointCrypt01+json",
                            "begin":                        this.chargy.moment.unix(SomeJSON.start_time).utc().format(),
                            "end":                          this.chargy.moment.unix(SomeJSON.end_time).utc().format(),
                            "EVSEId":                       SomeJSON.EVSEId ?? SomeJSON.station_mac + "-" + SomeJSON.outlet,

                            "authorizationStart": {
                                "@id":                      SomeJSON.driver_info,
                                "type":                     "userId"
                            },

                            "chargingProductRelevance": {
                                "time":                     chargyInterfaces.InformationRelevance.Informative,
                                "energy":                   chargyInterfaces.InformationRelevance.Important,
                                "parking":                  chargyInterfaces.InformationRelevance.Informative,
                                "sessionFee":               chargyInterfaces.InformationRelevance.Informative,
                            },

                            "measurements": [

                                {

                                    "energyMeterId":        SomeJSON.meter_serial,
                                    "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/ChargePointCrypt01+json",
                                    "name":                 "Bezogene Energiemenge",
                                    "obis":                 "1-0:1.8.0",
                                    "unit":                 SomeJSON.energy_units,
                                    "scale":                0,

                                    "values": [
                                        {
                                            "timestamp":        this.chargy.moment.unix(SomeJSON.start_time).utc().format(),
                                            "value":            SomeJSON.meter_startreading,
                                            "signatures":       []
                                        },
                                        {
                                            "timestamp":        this.chargy.moment.unix(SomeJSON.end_time).utc().format(),
                                            "value":            SomeJSON.meter_endreading,
                                            "signatures":       []
                                        }
                                    ]

                                }

                            ]

                        }

                    ],

                    "certainty":        1,
                    "status":           chargyInterfaces.SessionVerificationResult.Unvalidated

                };

                return _CTR as chargyInterfaces.IChargeTransparencyRecord;

            }

            //#endregion

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
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


export interface IChargepointMeasurementValue extends chargyInterfaces.IMeasurementValue
{
    statusMeter:                   string,
    secondsIndex:                  number,
    paginationId:                  string,
    logBookIndex:                  string
}

export interface IChargePointCrypt01Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  any,
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
    publicKeySignatures?:          any,
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


    async VerifyChargingSession(chargingSession: chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        if (chargingSession     === undefined ||
            chargingSession.ctr === undefined)
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

            //#region Find public key, or use all available public keys

            const publicKeyId  = chargingSession.EVSEId.replace(/:/g, "").replace(/-/g, "_");
            const publicKeys   = [];

            if (chargingSession.ctr.publicKeys != null)
            {

                for (let publicKeyInfo of chargingSession.ctr?.publicKeys)
                {
                    if (publicKeyInfo["@id"] === publicKeyId)
                        publicKeys.push(publicKeyInfo);
                }

                if (publicKeys.length == 0)
                {
                    for (const publicKeyInfo of chargingSession.ctr?.publicKeys)
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

                    let algorithm = (typeof publicKey.algorithm === "object")
                                        ? publicKey.algorithm.name
                                        : publicKey.algorithm;

                    switch (algorithm)
                    {

                        case "secp224k1":

                            sha225Value          = sha225Value ?? (BigInt("0x" + (await chargyLib.sha256(plainText))) >> BigInt(31)).toString(16);
                            sessionResult        = this.curve224k1.validate(BigInt("0x" + sha225Value),
                                                                            BigInt("0x" + chargingSession.signature.r),
                                                                            BigInt("0x" + chargingSession.signature.s),
                                                                            [ BigInt("0x" + publicKey.value.substr(2,  56)),
                                                                              BigInt("0x" + publicKey.value.substr(58, 56)) ])
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

                                else if (i = measurement.values.length-1)
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
            }
            else
                sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSessionFormat;

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
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
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

        var cryptoResult:IChargePointCrypt01Result = {
            status: chargyInterfaces.VerificationResult.NoOperation,
        };

        return setResult(chargyInterfaces.VerificationResult.NoOperation);

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

        if (measurementValue.measurement                                    === undefined ||
            measurementValue.measurement.chargingSession                    === undefined ||
            measurementValue.measurement.chargingSession.authorizationStart === undefined)
        {
            return {
                status: chargyInterfaces.VerificationResult.InvalidMeasurement
            }
        }


        const chargingSession    = measurementValue?.measurement?.chargingSession;
        const result             = measurementValue.result as IChargePointCrypt01Result;
        const algorithmName      = (typeof chargingSession?.publicKey?.algorithm === "object")
                                        ? chargingSession?.publicKey?.algorithm.name
                                        : chargingSession?.publicKey?.algorithm;
        const algorithmType      = (typeof chargingSession?.publicKey?.type      === "object")
                                        ? chargingSession?.publicKey?.type.name
                                        : chargingSession?.publicKey?.type;

        const cryptoSpan         = introDiv?.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML   = "ChargePointCrypt01 (" + algorithmName + ")";

        //#region Plain text

        if (PlainTextDiv != null)
        {

            if (PlainTextDiv                           != undefined &&
                PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement.children[0] != undefined)
            {
                PlainTextDiv.parentElement.children[0].innerHTML  = "Plain text (secrrct)";
            }

            PlainTextDiv.innerText                                = atob(chargingSession.original ?? "");

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

            if (HashedPlainTextDiv                           != undefined &&
                HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement.children[0] != undefined)
            {
                HashedPlainTextDiv.parentElement.children[0].innerHTML   = "Hashed plain text " + hashInfo;
            }

            HashedPlainTextDiv.innerHTML  = chargingSession.hashValue?.match(/.{1,8}/g)?.join(" ")
                                                ?? "0x00000000000000000000000000000000000";

        }

        //#endregion

        //#region Public Key

        if (PublicKeyDiv != null && chargingSession.publicKey != null)
        {

            if (PublicKeyDiv                           != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
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
                                            + chargingSession.publicKey.value.substring(2).match(/.{1,8}/g)!.join(" ")
                                          :   chargingSession.publicKey.value.match(/.{1,8}/g)!.join(" ");


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
                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(measurementValue.measurement!.chargingSession!.chargingStation,
                                                                                                    measurementValue.measurement!.chargingSession!.EVSE,
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

        if (SignatureExpectedDiv != null && chargingSession.signature != null)
        {

            if (SignatureExpectedDiv                           != undefined &&
                SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement.children[0] != undefined)
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (secrrct.sign, rs, hex)";// " + (result.signature?.format ?? "") + ", hex)";
            }

            if (typeof chargingSession.signature != 'string')
                SignatureExpectedDiv.innerHTML                            = "r: " + chargingSession.signature.r?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                                            "s: " + chargingSession.signature.s?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ");

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
