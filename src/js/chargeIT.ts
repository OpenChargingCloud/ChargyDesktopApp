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

import { Chargy }             from './chargy.js'
import { Alfen01 }            from './Alfen01.js'
import { BSMCrypt01 }         from './BSMCrypt01.js'
import * as chargyInterfaces  from './chargyInterfaces.js'
import * as chargyLib         from './chargyLib.js'

export class ChargeIT {

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





    //#region tryToParseChargeITJSON(SomeJSON)

    //private async tryToParseAnonymousFormat(SomeJSON: { signedMeterValues: any[]; placeInfo: any; }) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>

    // The chargeIT mobility data format does not always provide context or format identifiers
    public async tryToParseChargeITContainerFormatJSON(SomeJSON: any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        if (SomeJSON === undefined || SomeJSON === null || Array.isArray(SomeJSON))
            return {
                status: chargyInterfaces.SessionVerificationResult.InvalidSessionFormat
            }

        try
        {

            const ctrContext = chargyLib.isMandatoryString(SomeJSON["@context"])
                                   ? SomeJSON["@context"]?.trim()
                                   : "oldChargeITContainerFormat";

            //#region Old container format

            if (ctrContext === "oldChargeITContainerFormat" &&
                SomeJSON.placeInfo         &&
                SomeJSON.signedMeterValues &&
                Array.isArray(SomeJSON.signedMeterValues))
            {

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

                //#region Try to parse 'placeInfo'

                const placeInfo = SomeJSON.placeInfo;

                const evseId = placeInfo["evseId"] as string;
                if (evseId == null || typeof evseId !== 'string')
                    throw "Missing or invalid EVSE Id!"


                // placeInfo.address
                const address = placeInfo["address"];
                if (address == null)
                    throw "Missing or invalid address!"

                const address_street = address["street"];
                if (address_street == null || typeof address_street !== 'string')
                    throw "Missing or invalid address street!"

                const address_zipCode = address["zipCode"];
                if (address_zipCode == null || typeof address_zipCode !== 'string')
                    throw "Missing or invalid address zipCode!"

                const address_town = address["town"];
                if (address_town == null || typeof address_town !== 'string')
                    throw "Missing or invalid address town!"


                // placeInfo.geoLocation
                const geoLocation = placeInfo["geoLocation"];
                if (geoLocation == null)
                    throw "Missing or invalid geoLocation!"

                const geoLocation_lat = geoLocation["lat"];
                if (geoLocation_lat == null || typeof geoLocation_lat !== 'number')
                    throw "Missing or invalid geoLocation latitude!"

                const geoLocation_lon = geoLocation["lon"];
                if (geoLocation_lon == null || typeof geoLocation_lon !== 'number')
                    throw "Missing or invalid geoLocation longitude!"

                //#endregion

                //#region Generate default-transparency record

                let CTR: chargyInterfaces.IChargeTransparencyRecord = {

                    "@id":              "",
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      "chargeITmobilityCSO",
                            "@context":                 "",
                            //"eMobilityIds":             [ "DE*BDO", "DE*LVF", "+49*822" ],
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
                                    //"@context":                 "",
                                    //"description":              { },
                                    //"firmwareVersion":          "", //CTRArray[0]["chargePoint"]["softwareVersion"],
                                    "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                    "address": {
                                        //"@context":             "",
                                        "street":               address_street,
                                        "postalCode":           address_zipCode,
                                        "city":                 address_town,
                                        "country":              "Germany"
                                    },
                                    "EVSEs": [
                                        {
                                            "@id":                      evseId,
                                            //"@context":                 "",
                                            // "description": {
                                            //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                            // },
                                            //"connectors":               [  ],
                                            "meters":                   [ ]
                                        }
                                    ]
                                }
                            ]

                        }
                    ]

                };

                //#endregion

                //#region Try to parse 'signedMeterValues'

                const signedMeterValues = SomeJSON.signedMeterValues as Array<any>;

                if (signedMeterValues != undefined && signedMeterValues.length > 1)
                {

                    //#region Get and validate signedMeterValue context

                    const signedMeterValueContext  = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                                             ? signedMeterValues[0]["@context"]?.trim()
                                                             : "oldChargeITMeterValueFormat";

                    for (const signedMeterValue of signedMeterValues)
                    {
                        if ((signedMeterValue["@context"] ?? "oldChargeITMeterValueFormat") !== signedMeterValueContext)
                        {
                            return {
                                status:  chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message: "Inconsistent '@context' information!"
                            }
                        }
                    }

                    //#endregion


                    if (signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0" ||
                        signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v1") {
                        return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, "", signedMeterValues);
                    }

                    else if (signedMeterValueContext.startsWith("ALFEN")) {
                        return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));
                    }

                    else if (ctrContext === "oldChargeITContainerFormat") {

                        if (SomeJSON.signedMeterValues[0].format == "ALFEN")
                            return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));

                    }

                    if (signedMeterValueContext === "oldChargeITMeterValueFormat")
                    {

                        let CTRArray = [];

                        for (let i = 0; i < signedMeterValues.length; i++)
                        {

                            const signedMeterValue         = signedMeterValues[i];

                            const _timestamp = signedMeterValue["timestamp"] as number;
                            if (_timestamp == null || typeof _timestamp !== 'number')
                                throw "Missing or invalid timestamp[" + i + "]!"
                            const timestamp = chargyLib.parseUTC(_timestamp);

                            const _meterInfo = signedMeterValue["meterInfo"] as string;
                            if (_meterInfo == null || typeof _meterInfo !== 'object')
                                throw "Missing or invalid meterInfo[" + i + "]!"

                            const _meterInfo_firmwareVersion = _meterInfo["firmwareVersion"] as string;
                            if (_meterInfo_firmwareVersion == null || typeof _meterInfo_firmwareVersion !== 'string')
                                throw "Missing or invalid meterInfo firmwareVersion[" + i + "]!"

                            const _meterInfo_publicKey = _meterInfo["publicKey"] as string;
                            if (_meterInfo_publicKey == null || typeof _meterInfo_publicKey !== 'string')
                                throw "Missing or invalid meterInfo publicKey[" + i + "]!"

                            const _meterInfo_publicKeySignatures = _meterInfo["publicKeySignatures"];

                            const _meterInfo_meterId = _meterInfo["meterId"] as string;
                            if (_meterInfo_meterId == null || typeof _meterInfo_meterId !== 'string')
                                throw "Missing or invalid meterInfo meterId[" + i + "]!"

                            const _meterInfo_type = _meterInfo["type"] as string;
                            if (_meterInfo_type == null || typeof _meterInfo_type !== 'string')
                                throw "Missing or invalid meterInfo type[" + i + "]!"

                            const _meterInfo_manufacturer = _meterInfo["manufacturer"] as string;
                            if (_meterInfo_manufacturer == null || typeof _meterInfo_manufacturer !== 'string')
                                throw "Missing or invalid meterInfo manufacturer[" + i + "]!"


                            const _transactionId = signedMeterValue["transactionId"] as string;
                            if (_transactionId == null || typeof _transactionId !== 'string')
                                throw "Missing or invalid transactionId[" + i + "]!"


                            const _contract = signedMeterValue["contract"];
                            if (_contract == null || typeof _contract !== 'object')
                                throw "Missing or invalid contract[" + i + "]!"

                            const _contract_type = _contract["type"] as string;
                            if (_contract_type == null || typeof _contract_type !== 'string')
                                throw "Missing or invalid contract type[" + i + "]!"

                            const _contract_timestampLocal = _contract["timestampLocal"];
                            if (_contract_timestampLocal == null || typeof _contract_timestampLocal !== 'object')
                                throw "Missing or invalid contract timestampLocal[" + i + "]!"

                            const _contract_timestampLocal_timestamp = _contract_timestampLocal["timestamp"] as number;
                            if (_contract_timestampLocal_timestamp == null || typeof _contract_timestampLocal_timestamp !== 'number')
                                throw "Missing or invalid contract timestampLocal timestamp[" + i + "]!"                            

                            const _contract_timestampLocal_localOffset = _contract_timestampLocal["localOffset"] as number;
                            if (_contract_timestampLocal_localOffset == null || typeof _contract_timestampLocal_localOffset !== 'number')
                                throw "Missing or invalid contract timestampLocal localOffset[" + i + "]!"                            

                            const _contract_timestampLocal_seasonOffset = _contract_timestampLocal["seasonOffset"] as number;
                            if (_contract_timestampLocal_seasonOffset == null || typeof _contract_timestampLocal_seasonOffset !== 'number')
                                throw "Missing or invalid contract timestampLocal seasonOffset[" + i + "]!"  

                            const _contract_timestamp = _contract["timestamp"] as number;
                            if (_contract_timestamp == null || typeof _contract_timestamp !== 'number')
                                throw "Missing or invalid contract timestamp[" + i + "]!"

                            const _contract_id = _contract["id"] as string;
                            if (_contract_id == null || typeof _contract_id !== 'string')
                                throw "Missing or invalid contract type[" + i + "]!"


                            const _measurementId = signedMeterValue["measurementId"] as string;
                            if (_measurementId == null || typeof _measurementId !== 'string')
                                throw "Missing or invalid measurementId[" + i + "]!"


                            const _measuredValue = signedMeterValue["measuredValue"];
                            if (_measuredValue == null || typeof _measuredValue !== 'object')
                                throw "Missing or invalid measuredValue[" + i + "]!"

                            const _measuredValue_timestampLocal = _measuredValue["timestampLocal"];
                            if (_measuredValue_timestampLocal == null || typeof _measuredValue_timestampLocal !== 'object')
                                throw "Missing or invalid measuredValue timestampLocal[" + i + "]!"

                            const _measuredValue_timestampLocal_timestamp = _measuredValue_timestampLocal["timestamp"] as number;
                            if (_measuredValue_timestampLocal_timestamp == null || typeof _measuredValue_timestampLocal_timestamp !== 'number')
                                throw "Missing or invalid measuredValue timestampLocal timestamp[" + i + "]!"                            

                            const _measuredValue_timestampLocal_localOffset = _measuredValue_timestampLocal["localOffset"] as number;
                            if (_measuredValue_timestampLocal_localOffset == null || typeof _measuredValue_timestampLocal_localOffset !== 'number')
                                throw "Missing or invalid measuredValue timestampLocal localOffset[" + i + "]!"                            

                            const _measuredValue_timestampLocal_seasonOffset = _measuredValue_timestampLocal["seasonOffset"] as number;
                            if (_measuredValue_timestampLocal_seasonOffset == null || typeof _measuredValue_timestampLocal_seasonOffset !== 'number')
                                throw "Missing or invalid measuredValue timestampLocal seasonOffset[" + i + "]!"                            

                            const _measuredValue_value = _measuredValue["value"] as string;
                            if (_measuredValue_value == null || typeof _measuredValue_value !== 'string')
                                throw "Missing or invalid measuredValue value[" + i + "]!"

                            const _measuredValue_unit = _measuredValue["unit"] as string;
                            if (_measuredValue_unit == null || typeof _measuredValue_unit !== 'string')
                                throw "Missing or invalid measuredValue unit[" + i + "]!"

                            const _measuredValue_scale = _measuredValue["scale"] as number;
                            if (_measuredValue_scale == null || typeof _measuredValue_scale !== 'number')
                                throw "Missing or invalid measuredValue scale[" + i + "]!"

                            const _measuredValue_valueType = _measuredValue["valueType"] as string;
                            if (_measuredValue_valueType == null || typeof _measuredValue_valueType !== 'string')
                                throw "Missing or invalid measuredValue valueType[" + i + "]!"

                            const _measuredValue_unitEncoded = _measuredValue["unitEncoded"] as number;
                            if (_measuredValue_unitEncoded == null || typeof _measuredValue_unitEncoded !== 'number')
                                throw "Missing or invalid measuredValue unitEncoded[" + i + "]!"


                            const _measurand = signedMeterValue["measurand"];
                                if (_measurand == null || typeof _measurand !== 'object')
                                    throw "Missing or invalid measurand[" + i + "]!"

                            const _measurand_id = _measurand["id"] as string;
                            if (_measurand_id == null || typeof _measurand_id !== 'string')
                                throw "Missing or invalid measurand id[" + i + "]!"

                            const _measurand_name = _measurand["name"] as string;
                            if (_measurand_name == null || typeof _measurand_name !== 'string')
                                throw "Missing or invalid measurand name[" + i + "]!"


                            const _additionalInfo = signedMeterValue["additionalInfo"];
                                if (_additionalInfo == null || typeof _additionalInfo !== 'object')
                                    throw "Missing or invalid additionalInfo[" + i + "]!"

                            const _additionalInfo_indexes = _additionalInfo["indexes"];
                            if (_additionalInfo_indexes == null || typeof _additionalInfo_indexes !== 'object')
                                throw "Missing or invalid additionalInfo indexes[" + i + "]!"

                            const _additionalInfo_indexes_timer = _additionalInfo_indexes["timer"] as number;
                            if (_additionalInfo_indexes_timer == null || typeof _additionalInfo_indexes_timer !== 'number')
                                throw "Missing or invalid additionalInfo indexes timer[" + i + "]!"

                            const _additionalInfo_indexes_logBook = _additionalInfo_indexes["logBook"] as string;
                            if (_additionalInfo_indexes_logBook == null || typeof _additionalInfo_indexes_logBook !== 'string')
                                throw "Missing or invalid additionalInfo indexes logBook[" + i + "]!"

                            const _additionalInfo_status = _additionalInfo["status"] as string;
                            if (_additionalInfo_status == null || typeof _additionalInfo_status !== 'string')
                                throw "Missing or invalid additionalInfo status[" + i + "]!"


                            const _chargePoint = signedMeterValue["chargePoint"];
                            if (_chargePoint == null || typeof _chargePoint !== 'object')
                                throw "Missing or invalid chargePoint[" + i + "] information!"

                            const _chargePointSoftwareVersion = _chargePoint["softwareVersion"];
                            if (_chargePointSoftwareVersion == null || typeof _chargePointSoftwareVersion !== 'string')
                                throw "Missing or invalid chargePoint softwareVersion[" + i + "]!"


                            const _signature = signedMeterValue["signature"] as string;
                            if (_signature == null || typeof _signature !== 'string')
                                throw "Missing or invalid signature[" + i + "]!"

                            //const aaa = moment.unix(_contract_timestampLocal_timestamp).utc();

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

                        let n = CTRArray.length-1;

                        CTR["@id"]  = CTRArray[n]["transactionId"];
                        CTR.begin   = this.chargy.moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format();
                        CTR.end     = this.chargy.moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format();

                        CTR.contract = {
                             "@id":       CTRArray[0]["contract"]["id"],
                             "@context":  CTRArray[0]["contract"]["type"]
                        };

                        CTR.chargingStationOperators = [{

                            "@id":              "chargeITmobilityCSO",
                            "description":      { "de": "chargeIT mobility GmbH - Charging Station Operator Services" },

                            "contact": {
                                "email":    "info@chargeit-mobility.com",
                                "web":      "https://www.chargeit-mobility.com",
                                "logoUrl":  "http://www.chargeit-mobility.com/fileadmin/BELECTRIC_Drive/templates/pics/chargeit_logo_408x70.png",
                                "publicKeys": [{
                                    "algorithm":  "secp192r1",
                                    "format":     "DER",
                                    "value":      "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                    //"signatures":   [ ]
                                },
                                {
                                    "algorithm":    "secp256k1",
                                    "format":       "DER",
                                    "value":        "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                    //"signatures":   [ ]
                                }
                            ]},

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
                                        "city":                 address_town,
                                        "country":              "Germany"
                                    },
                                    "EVSEs": [
                                        {
                                            "@id":                      evseId,
                                            // "description": {
                                            //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                            // },
                                            // "connectors": [{ }],
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

                        }];

                        CTR.chargingSessions = [{

                            "@id":                          CTRArray[n]["transactionId"],
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json",
                            "begin":                        this.chargy.moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                            "end":                          this.chargy.moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                            "EVSEId":                       evseId,

                            "authorizationStart": {
                                "@id":                      CTRArray[0]["contract"]["id"],
                                "type":                     CTRArray[0]["contract"]["type"],
                                "timestamp":                this.chargy.moment.unix(CTRArray[0]["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                                    CTRArray[0]["contract"]["timestampLocal"]["localOffset"] +
                                                                                    CTRArray[0]["contract"]["timestampLocal"]["seasonOffset"]).format(),
                            },

                            // "signatureInfos": {
                            //     "hash":                     CryptoHashAlgorithms.SHA256,
                            //     "hashTruncation":           "24",
                            //     "algorithm":                "ECC",
                            //     "curve":                    "secp192r1",
                            //     "format":                   "rs"
                            // },

                            "measurements": [{

                                "energyMeterId":        CTRArray[0]["meterInfo"]["meterId"],
                                "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json",
                                "name":                 CTRArray[0]["measurand"]["name"],
                                "obis":                 chargyLib.parseOBIS(CTRArray[0]["measurand"]["id"]),
                                "unit":                 CTRArray[0]["measuredValue"]["unit"],
                                "unitEncoded":          CTRArray[0]["measuredValue"]["unitEncoded"],
                                "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                                "scale":                CTRArray[0]["measuredValue"]["scale"],

                                "signatureInfos": {
                                    "hash":                 chargyInterfaces.CryptoHashAlgorithms.SHA256,
                                    "hashTruncation":       24,
                                    "algorithm":            chargyInterfaces.CryptoAlgorithms.ECC,
                                    "curve":                "secp192r1",
                                    "format":               chargyInterfaces.SignatureFormats.rs
                                },

                                "values": [ ]

                            }]

                        }];

                        for (let _measurement of CTRArray)
                        {
                            CTR["chargingSessions"][0]["measurements"][0]["values"].push({
                                "timestamp":     this.chargy.moment.unix(_measurement["measuredValue"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                         _measurement["measuredValue"]["timestampLocal"]["localOffset"] +
                                                                         _measurement["measuredValue"]["timestampLocal"]["seasonOffset"]).format(),
                                "value":         parseInt(_measurement["measuredValue"]["value"]),
                                "infoStatus":    _measurement["additionalInfo"]["status"],
                                "secondsIndex":  _measurement["additionalInfo"]["indexes"]["timer"],
                                "paginationId":  _measurement["measurementId"],
                                "logBookIndex":  _measurement["additionalInfo"]["indexes"]["logBook"],
                                "signatures": [
                                    {
                                        "r":  _measurement["signature"].substring(0, 48),
                                        "s":  _measurement["signature"].substring(48)
                                    }
                                ]
                            });
                        }

                        CTR["status"] = chargyInterfaces.SessionVerificationResult.ValidSignature;

                        return CTR;

                    }

                    return {
                        status: chargyInterfaces.SessionVerificationResult.InvalidSessionFormat
                    }

                }

                //#endregion

            }

            //#endregion

            //#region Second format

            else if (ctrContext == "https://www.chargeit-mobility.com/contexts/charging-station-json-v0" ||
                     ctrContext == "https://www.chargeit-mobility.com/contexts/charging-station-json-v1")
            {

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

                const id                                         = SomeJSON["@id"];
                if (!chargyLib.isMandatoryString(id)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Missing or invalid charge transparency record identification!"
                }

                //#region chargePointInfo

                const evseId                                   = SomeJSON?.chargePointInfo?.evseId;
                if (!chargyLib.isMandatoryString(evseId)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Missing or invalid EVSE Id!"
                }


                const geoLocation_lat                          = SomeJSON.chargePointInfo?.placeInfo?.geoLocation?.lat;
                if (!chargyLib.isOptionalNumber(geoLocation_lat)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid geo location latitude!"
                }

                const geoLocation_lon                          = SomeJSON.chargePointInfo?.placeInfo?.geoLocation?.lon;
                if (!chargyLib.isOptionalNumber(geoLocation_lon)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid geo location longitude!"
                }


                const address_street                           = SomeJSON.chargePointInfo?.placeInfo?.address?.street;
                if (!chargyLib.isOptionalString(address_street)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid address street!"
                }

                const address_zipCode                          = SomeJSON.chargePointInfo?.placeInfo?.address?.zipCode;
                if (!chargyLib.isOptionalString(address_zipCode)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid address zipCode!"
                }

                const address_town                             = SomeJSON.chargePointInfo?.placeInfo?.address?.town;
                if (!chargyLib.isOptionalString(address_town)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid address town!"
                }

                const address_country                          = SomeJSON.chargePointInfo?.placeInfo?.address?.country;
                if (!chargyLib.isOptionalString(address_country)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid address country!"
                }

                //#endregion

                //#region chargingStationInfo

                const chargingStation_manufacturer               = SomeJSON.chargingStationInfo?.manufacturer;
                if (!chargyLib.isOptionalString(chargingStation_manufacturer)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid charging station manufacturer!"
                }

                const chargingStation_type                       = SomeJSON.chargingStationInfo?.type;
                if (!chargyLib.isOptionalString(chargingStation_type)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid charging station type!"
                }

                const chargingStation_serialNumber               = SomeJSON.chargingStationInfo?.serialNumber;
                if (!chargyLib.isOptionalString(chargingStation_serialNumber)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid charging station serial number!"
                }

                const chargingStation_controllerSoftwareVersion  = SomeJSON.chargingStationInfo?.controllerSoftwareVersion;
                if (!chargyLib.isOptionalString(chargingStation_controllerSoftwareVersion)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid charging station controller software version!"
                }

                const chargingStation_compliance                 = SomeJSON.chargingStationInfo?.compliance;
                if (!chargyLib.isOptionalString(chargingStation_compliance)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid charging station compliance!"
                }

                //#endregion

                const signedMeterValues                          = SomeJSON?.signedMeterValues as Array<any>;
                if (signedMeterValues == undefined || signedMeterValues == null || !Array.isArray(signedMeterValues)) return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:  "Invalid signed meter values!"
                }

                const smvContext = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                       ? signedMeterValues[0]["@context"]?.trim()
                                       : chargyLib.isMandatoryString(signedMeterValues[0]?.format)
                                             ? signedMeterValues[0]?.format?.trim()
                                             : null;

                for (let i = 1; i < signedMeterValues.length; i++)
                {

                    let context = chargyLib.isMandatoryString(signedMeterValues[i]["@context"])
                                      ? signedMeterValues[i]["@context"]?.trim()
                                      : chargyLib.isMandatoryString(signedMeterValues[i]?.format)
                                            ? signedMeterValues[i]?.format?.trim()
                                            : null;

                    if (smvContext !== context) return {
                        status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:  "Inconsistent signed meter value format!"
                    }

                }


                //#region Generate default-transparency record

                let CTR: chargyInterfaces.IChargeTransparencyRecord = {

                    "@id":              "",
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      "chargeITmobilityCSO",
                            "@context":                 "",
                            //"eMobilityIds":             [ "DE*BDO", "DE*LVF", "+49*822" ],
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
                                    //"@context":                 "",
                                    //"description":              { },
                                    //"firmwareVersion":          "", //CTRArray[0]["chargePoint"]["softwareVersion"],
                                    "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                    "address": {
                                        //"@context":             "",
                                        "street":               address_street,
                                        "postalCode":           address_zipCode,
                                        "city":                 address_town,
                                        "country":              "Germany"
                                    },
                                    "EVSEs": [
                                        {
                                            "@id":                      evseId,
                                            //"@context":                 "",
                                            // "description": {
                                            //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                            // },
                                            //"connectors":               [  ],
                                            "meters":                   [ ]
                                        }
                                    ]
                                }
                            ]

                        }
                    ]

                };

                //#endregion

                if      (smvContext?.startsWith("https://www.chargeit-mobility.com/contexts/bsm-ws36a-json"))
                    return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, chargingStation_controllerSoftwareVersion, signedMeterValues);

                else if (smvContext?.startsWith("ALFEN"))
                    return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));

                else return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                }

            }

            //#endregion


        }
        catch (exception)
        {
            return {
                status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + (exception instanceof Error ? exception.message : exception)
            }
        }

        return {
            status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat
        }

    }

    //#endregion

}
