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
import { Alfen01 }            from './Alfen01'
import { BSMCrypt01 }         from './BSMCrypt01'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import { ChargyApp }          from './chargyApp'

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


    //#region tryToParseOldChargeITMeterValuesFormat(CTR, evseId, address, geoLocation, signedMeterValues)

    public async tryToParseOldChargeITMeterValuesFormat(CTR:                any,
                                                        evseId:             string,
                                                        address:            any,
                                                        geoLocation:        any,
                                                        signedMeterValues:  Array<any>) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        let CTRArray = [];

        //#region Parse Signed Meter Values

        for (const signedMeterValue of signedMeterValues)
        {

            //#region Data

            const measurementId                              = signedMeterValue.measurementId;
            const timestamp                                  = signedMeterValue.timestamp;
            const transactionId                              = signedMeterValue.transactionId;
            const signature                                  = signedMeterValue.signature;

            const meterInfo                                  = signedMeterValue.meterInfo;
            const meterInfo_meterId                          = meterInfo.meterId;
            const meterInfo_type                             = meterInfo.type;
            const meterInfo_firmwareVersion                  = meterInfo.firmwareVersion;
            const meterInfo_publicKey                        = meterInfo.publicKey;
            const meterInfo_manufacturer                     = meterInfo.manufacturer;

            const meterInfo_publicKeySignatures              = meterInfo.publicKeySignatures;

            const contract                                   = signedMeterValue.contract;
            const contract_id                                = contract.id;
            const contract_type                              = contract.type;
            const contract_timestamp                         = contract.timestamp;

            const contract_timestampLocal                    = contract.timestampLocal;
            const contract_timestampLocal_timestamp          = contract_timestampLocal.timestamp;
            const contract_timestampLocal_localOffset        = contract_timestampLocal.localOffset;
            const contract_timestampLocal_seasonOffset       = contract_timestampLocal.seasonOffset;

            const measuredValue                              = signedMeterValue.measuredValue;
            const measuredValue_value                        = measuredValue.value;
            const measuredValue_unit                         = measuredValue.unit;
            const measuredValue_scale                        = measuredValue.scale;
            const measuredValue_valueType                    = measuredValue.valueType;
            const measuredValue_unitEncoded                  = measuredValue.unitEncoded;

            const measuredValue_timestampLocal               = measuredValue.timestampLocal;
            const measuredValue_timestampLocal_timestamp     = measuredValue_timestampLocal.timestamp;
            const measuredValue_timestampLocal_localOffset   = measuredValue_timestampLocal.localOffset;
            const measuredValue_timestampLocal_seasonOffset  = measuredValue_timestampLocal.seasonOffset;

            const measurand                                  = signedMeterValue.measurand;
            const measurand_id                               = measurand.id;
            const measurand_name                             = measurand.name;

            const additionalInfo                             = signedMeterValue.additionalInfo;
            const additionalInfo_status                      = additionalInfo.status;

            const additionalInfo_indexes                     = additionalInfo.indexes;
            const additionalInfo_indexes_timer               = additionalInfo_indexes.timer;
            const additionalInfo_indexes_logBook             = additionalInfo_indexes.logBook;

            const chargePoint                                = signedMeterValue.chargePoint;
            const chargePoint_softwareVersion                = chargePoint.softwareVersion;

            //#endregion

            if (chargyLib.isMandatoryString    (measurementId)                             &&
                chargyLib.isMandatoryNumber    (timestamp)                                 &&
                chargyLib.isMandatoryString    (transactionId)                             &&
                chargyLib.isMandatoryString    (signature)                                 &&

                chargyLib.isMandatoryJSONObject(meterInfo)                                 &&
                chargyLib.isMandatoryString    (meterInfo_meterId)                         &&
                chargyLib.isMandatoryString    (meterInfo_type)                            &&
                chargyLib.isMandatoryString    (meterInfo_firmwareVersion)                 &&
                chargyLib.isMandatoryString    (meterInfo_publicKey)                       &&
                chargyLib.isMandatoryString    (meterInfo_manufacturer)                    &&

                chargyLib.isOptionalJSONArrayOk(meterInfo_publicKeySignatures)             &&

                chargyLib.isMandatoryJSONObject(contract)                                  &&
                chargyLib.isMandatoryString    (contract_id)                               &&
                chargyLib.isMandatoryString    (contract_type)                             &&
                chargyLib.isMandatoryNumber    (contract_timestamp)                        &&

                chargyLib.isMandatoryJSONObject(contract_timestampLocal)                   &&
                chargyLib.isMandatoryNumber    (contract_timestampLocal_timestamp)         &&
                chargyLib.isMandatoryNumber    (contract_timestampLocal_localOffset)       &&
                chargyLib.isMandatoryNumber    (contract_timestampLocal_seasonOffset)      &&

                chargyLib.isMandatoryJSONObject(measuredValue)                             &&
                chargyLib.isMandatoryString    (measuredValue_value)                       &&
                chargyLib.isMandatoryString    (measuredValue_unit)                        &&
                chargyLib.isMandatoryNumber    (measuredValue_scale)                       &&
                chargyLib.isMandatoryString    (measuredValue_valueType)                   &&
                chargyLib.isMandatoryNumber    (measuredValue_unitEncoded)                 &&

                chargyLib.isMandatoryJSONObject(measuredValue_timestampLocal)              &&
                chargyLib.isMandatoryNumber    (measuredValue_timestampLocal_timestamp)    &&
                chargyLib.isMandatoryNumber    (measuredValue_timestampLocal_localOffset)  &&
                chargyLib.isMandatoryNumber    (measuredValue_timestampLocal_seasonOffset) &&

                chargyLib.isMandatoryJSONObject(measurand)                                 &&
                chargyLib.isMandatoryString    (measurand_id)                              &&
                chargyLib.isMandatoryString    (measurand_name)                            &&

                chargyLib.isMandatoryJSONObject(additionalInfo)                            &&
                chargyLib.isMandatoryString    (additionalInfo_status)                     &&

                chargyLib.isMandatoryJSONObject(additionalInfo_indexes)                    &&
                chargyLib.isMandatoryNumber    (additionalInfo_indexes_timer)              &&
                chargyLib.isMandatoryString    (additionalInfo_indexes_logBook)            &&

                chargyLib.isMandatoryJSONObject(chargePoint)                               &&
                chargyLib.isMandatoryString    (chargePoint_softwareVersion)) {

                    CTRArray.push({
                        "timestamp":            timestamp,
                        "meterInfo": {
                            "firmwareVersion":      meterInfo_firmwareVersion,
                            "publicKey":            meterInfo_publicKey,
                            "publicKeySignatures":  meterInfo_publicKeySignatures,
                            "meterId":              meterInfo_meterId,
                            "type":                 meterInfo_type,
                            "manufacturer":         meterInfo_manufacturer
                        },
                        "transactionId":        transactionId,
                        "contract": {
                            "type":                 contract_type,
                            "timestampLocal": {
                                "timestamp":            contract_timestampLocal_timestamp,
                                "localOffset":          contract_timestampLocal_localOffset,
                                "seasonOffset":         contract_timestampLocal_seasonOffset
                            },
                            "timestamp":            contract_timestamp,
                            "id":                   contract_id
                        },
                        "measurementId":        measurementId,
                        "measuredValue": {
                            "timestampLocal": {
                                "timestamp":            measuredValue_timestampLocal_timestamp,
                                "localOffset":          measuredValue_timestampLocal_localOffset,
                                "seasonOffset":         measuredValue_timestampLocal_seasonOffset
                            },
                            "value":                measuredValue_value,
                            "unit":                 measuredValue_unit,
                            "scale":                measuredValue_scale,
                            "valueType":            measuredValue_valueType,
                            "unitEncoded":          measuredValue_unitEncoded
                        },
                        "measurand": {
                            "id":                   measurand_id,
                            "name":                 measurand_name
                        },
                        "additionalInfo": {
                            "indexes": {
                                "timer":                additionalInfo_indexes_timer,
                                "logBook":              additionalInfo_indexes_logBook
                            },
                            "status":               additionalInfo_status
                        },
                        "chargePoint": {
                            "softwareVersion":      chargePoint_softwareVersion
                        },
                        "signature":            signature
                    });

            }

        }

        //#endregion

        let n = CTRArray.length-1;

        CTR["@id"]  = CTRArray[n]!["transactionId"];
        CTR.begin   = this.chargy.moment.unix(CTRArray[0]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format();
        CTR.end     = this.chargy.moment.unix(CTRArray[n]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format();

        CTR.contract = {
            "@id":       CTRArray[0]!["contract"]["id"],
            "@context":  CTRArray[0]!["contract"]["type"]
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
                    "firmwareVersion":          CTRArray[0]!["chargePoint"]["softwareVersion"],
                    "geoLocation":              { "lat": geoLocation.lat, "lng": geoLocation.lon },
                    "address": {
                        "street":               address.street,
                        "postalCode":           address.zipCode,
                        "city":                 address.town,
                        "country":              address.country
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
                                    "@id":                      CTRArray[0]!["meterInfo"]["meterId"],
                                    "manufacturer":             CTRArray[0]!["meterInfo"]["manufacturer"],
                                    "manufacturerURL":          "https://www.emh-metering.de",
                                    "model":                    CTRArray[0]!["meterInfo"]["type"],
                                    "hardwareVersion":          "1.0",
                                    "firmwareVersion":          CTRArray[0]!["meterInfo"]["firmwareVersion"],
                                    "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                    "publicKeys": [
                                        {
                                            "algorithm":        "secp192r1",
                                            "format":           "DER",
                                            "value":            CTRArray[0]!["meterInfo"]["publicKey"].startsWith("04")
                                                                    ?        CTRArray[0]!["meterInfo"]["publicKey"]
                                                                    : "04" + CTRArray[0]!["meterInfo"]["publicKey"],
                                            "signatures":       CTRArray[0]!["meterInfo"]["publicKeySignatures"]
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

            "@id":                          CTRArray[n]!["transactionId"],
            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json",
            "begin":                        this.chargy.moment.unix(CTRArray[0]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
            "end":                          this.chargy.moment.unix(CTRArray[n]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
            "EVSEId":                       evseId,

            "authorizationStart": {
                "@id":                      CTRArray[0]!["contract"]["id"],
                "type":                     CTRArray[0]!["contract"]["type"],
                "timestamp":                this.chargy.moment.unix(CTRArray[0]!["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                    CTRArray[0]!["contract"]["timestampLocal"]["localOffset"] +
                                                                    CTRArray[0]!["contract"]["timestampLocal"]["seasonOffset"]).format(),
            },

            "measurements": [{

                "energyMeterId":        CTRArray[0]!["meterInfo"]["meterId"],
                "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json",
                "name":                 CTRArray[0]!["measurand"]["name"],
                "obis":                 chargyLib.parseOBIS(CTRArray[0]!["measurand"]["id"]),
                "unit":                 CTRArray[0]!["measuredValue"]["unit"],
                "unitEncoded":          CTRArray[0]!["measuredValue"]["unitEncoded"],
                "valueType":            CTRArray[0]!["measuredValue"]["valueType"],
                "scale":                CTRArray[0]!["measuredValue"]["scale"],

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

        for (const measurement of CTRArray)
        {
            CTR["chargingSessions"][0]!["measurements"][0]!["values"].push({
                "timestamp":     this.chargy.moment.unix(measurement["measuredValue"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                        measurement["measuredValue"]["timestampLocal"]["localOffset"] +
                                                        measurement["measuredValue"]["timestampLocal"]["seasonOffset"]).format(),
                "value":         parseInt(measurement["measuredValue"]["value"]),
                "infoStatus":    measurement["additionalInfo"]["status"],
                "secondsIndex":  measurement["additionalInfo"]["indexes"]["timer"],
                "paginationId":  measurement["measurementId"],
                "logBookIndex":  measurement["additionalInfo"]["indexes"]["logBook"],
                "signatures": [
                    {
                        "r":  measurement["signature"].substring(0, 48),
                        "s":  measurement["signature"].substring(48)
                    }
                ]
            });
        }

        CTR["status"] = chargyInterfaces.SessionVerificationResult.Unvalidated;

        return CTR;

    }

    //#endregion


    //#region tryToParseChargeITContainerFormat(SomeJSON)

    // The chargeIT mobility data format does not always provide context information or format identifiers!
    public async tryToParseChargeITContainerFormat(SomeJSON: any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        const errors    = new Array<String>();
        const warnings  = new Array<String>();

        if (SomeJSON === undefined ||
            SomeJSON === null      ||
            Array.isArray(SomeJSON))
        {
            return {
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                errors:     errors,
                warnings:   warnings,
                certainty:  0
            }
        }

        const oldChargeITContainerFormat   = "oldChargeITContainerFormat";
        const oldChargeITMeterValueFormat  = "oldChargeITMeterValueFormat";

        const containerFormat              = chargyLib.isMandatoryString(SomeJSON["@context"])
                                                 ? SomeJSON["@context"]?.trim()
                                                 : oldChargeITContainerFormat;


        //#region Old chargeIT container format

        if (containerFormat === oldChargeITContainerFormat)
        {

            // How sure we are, that this is really a chargeIT transparency format
            let numberOfFormatChecks  = 14 + 2*39; // At least two signed meter values!
            let secondaryErrors       = 0;

            try
            {

                //#region Validate the container format
                {

                    //#region Validate 'placeInfo'

                    const placeInfo = SomeJSON.placeInfo;
                    if (!chargyLib.isMandatoryJSONObject(placeInfo))
                    {
                        errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidPlaceInfo"));
                        secondaryErrors += 13;
                    }
                    else
                    {

                        const evseId = placeInfo.evseId;
                        if (!chargyLib.isMandatoryString(evseId))
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidEVSEId"));

                        //#region placeInfo.address

                        const address = placeInfo.address;
                        if (!chargyLib.isMandatoryJSONObject(address))
                        {
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddress"));
                            secondaryErrors += 3;
                        }
                        else
                        {

                            if (!chargyLib.isMandatoryString(address.street))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressStreetName"));

                            if (!chargyLib.isMandatoryString(address.zipCode))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressZIPCode"));

                            if (!chargyLib.isMandatoryString(address.town))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressCityName"));

                            //if (!chargyLib.isMandatoryString(address.country))
                            //    errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressCountryName"));

                        }

                        //#endregion

                        //#region placeInfo.geoLocation

                        const geoLocation = placeInfo.geoLocation;
                        if (!chargyLib.isMandatoryJSONObject(geoLocation))
                        {
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocation"));
                            secondaryErrors += 2;
                        }
                        else
                        {

                            if (!chargyLib.isMandatoryNumber(geoLocation.lat))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocationLatitude"));

                            if (!chargyLib.isMandatoryNumber(geoLocation.lon))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocationLongitude"));

                        }

                        //#endregion

                    }

                    //#endregion

                    //#region Validate 'signedMeterValues'

                    const signedMeterValues = SomeJSON.signedMeterValues;
                    if (!chargyLib.isMandatoryJSONArray(signedMeterValues) || signedMeterValues.length < 2) {
                        errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidSignedMeterValues"));
                        secondaryErrors += 2*39;
                    }
                    else
                    {

                        // Additional format checks per measurement
                        // when there are more than 2 signed meter values
                        numberOfFormatChecks += 39 * (signedMeterValues.length - 2);

                        //#region Get and validate consistency of the signedMeterValue context

                        const signedMeterValueContext  = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                                            ? signedMeterValues[0]["@context"]?.trim()
                                                            : oldChargeITMeterValueFormat;


                        let consistent = true;

                        for (const signedMeterValue of signedMeterValues) {
                            if ((signedMeterValue["@context"] ?? oldChargeITMeterValueFormat) !== signedMeterValueContext) {

                                if (consistent)
                                    errors.push(this.chargy.GetLocalizedMessage("InconsistentJSONContextInformation"));

                                consistent = false;

                            }
                        }

                        //#endregion

                        if (consistent) {

                            if (signedMeterValueContext === "https://www.lichtblick.de/contexts/bsm-ws36a-json-v0"         ||
                                signedMeterValueContext === "https://www.lichtblick.de/contexts/bsm-ws36a-json-v1"         ||
                                signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v0"             ||
                                signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v1"             ||
                                signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0" ||
                                signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v1") {

                                //return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, null, signedMeterValues);

                            }

                            else if (signedMeterValueContext.startsWith("ALFEN")) {
                            //     return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));
                            }

                            else if (containerFormat === oldChargeITContainerFormat) {

                            //     let preCTR = null;

                            //     if (signedMeterValues[0].format == "ALFEN")
                            //         preCTR = await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));

                            //     //if (preCTR != null)
                            //     //    return preCTR;

                            }

                            else if (signedMeterValueContext === oldChargeITMeterValueFormat)
                            {

                                let measurementCounter = 0;

                                for (const signedMeterValue of signedMeterValues)
                                {

                                    measurementCounter++;

                                    if (!chargyLib.isMandatoryJSONObject(signedMeterValue)) {
                                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidSignedMeterValueP",                     measurementCounter));
                                        secondaryErrors += 38;
                                    }
                                    else
                                    {

                                        if (!chargyLib.isMandatoryString(signedMeterValue.measurementId))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurementIdP",  measurementCounter));

                                        if (!chargyLib.isMandatoryNumber(signedMeterValue.timestamp))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_TimestampP",      measurementCounter));

                                        if (!chargyLib.isMandatoryString(signedMeterValue.transactionId))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_TransactionIdP",  measurementCounter));

                                        if (!chargyLib.isMandatoryString(signedMeterValue.signature))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_SignatureP",      measurementCounter));

                                        //#region Meter information

                                        const meterInfo = signedMeterValue.meterInfo;
                                        if (!chargyLib.isMandatoryJSONObject(meterInfo))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfoP",                 measurementCounter));
                                            secondaryErrors += 5;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(meterInfo.meterId))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.type))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_TypeP",            measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.firmwareVersion))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_FirmwareVersionP", measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.publicKey))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.manufacturer))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    measurementCounter));

                                            //#region Meter information - PublicKey signatures (optional)

                                            if (chargyLib.isOptionalJSONArrayError(meterInfo.publicKeySignatures))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("Invalid_SignedMeterValue_MeterInfo_PublicKeySignaturesP", measurementCounter));

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region Contract information

                                        const contract = signedMeterValue.contract;
                                        if (!chargyLib.isMandatoryJSONObject(contract))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ContractP",           measurementCounter));
                                            secondaryErrors += 7;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(contract.id))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_IdP",        measurementCounter));

                                            if (!chargyLib.isMandatoryString(contract.type))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TypeP",      measurementCounter));

                                            if (!chargyLib.isMandatoryNumber(contract.timestamp))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampP", measurementCounter));

                                            //#region Contract information - Timestamp local

                                            const timestampLocal = contract.timestampLocal;
                                            if (!chargyLib.isMandatoryJSONObject(timestampLocal))
                                            {
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocalP",              measurementCounter));
                                                secondaryErrors += 3;
                                            }
                                            else
                                            {

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.timestamp))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocal_TimestampP",    measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.localOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocal_LocalOffsetP",  measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.seasonOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocal_SeasonOffsetP", measurementCounter));

                                            }

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region Measured value

                                        const measuredValue = signedMeterValue.measuredValue;
                                        if (!chargyLib.isMandatoryJSONObject(measuredValue))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValueP",                  measurementCounter));
                                            secondaryErrors += 9;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(measuredValue.value))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_ValueP",        measurementCounter));

                                            if (!chargyLib.isMandatoryString(measuredValue.unit))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_UnitP",         measurementCounter));

                                            if (!chargyLib.isMandatoryNumber(measuredValue.scale))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_ScaleP",        measurementCounter));

                                            if (!chargyLib.isMandatoryString(measuredValue.valueType))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_ValueTypeP",    measurementCounter));

                                            if (!chargyLib.isMandatoryNumber(measuredValue.unitEncoded))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_UnitEncodedP",  measurementCounter));

                                            //#region Measured Value - Local timestamp

                                            const timestampLocal = measuredValue.timestampLocal;
                                            if (!chargyLib.isMandatoryJSONObject(timestampLocal))
                                            {
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampLocalP",                  measurementCounter));
                                                secondaryErrors += 3;
                                            }
                                            else
                                            {

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.timestamp))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampLocalTimestampP",     measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.localOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampLocalOffsetP",        measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.seasonOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampSeasonOffsetP",       measurementCounter));

                                            }

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region Measurand

                                        const measurand = signedMeterValue.measurand;
                                        if (!chargyLib.isMandatoryJSONObject(measurand))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurandP",           measurementCounter));
                                            secondaryErrors += 2;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(measurand.id))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Measurand_IdP",    measurementCounter));

                                            if (!chargyLib.isMandatoryString(measurand.name))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Measurand_NameP",  measurementCounter));

                                        }

                                        //#endregion

                                        //#region Additional info

                                        const additionalInfo = signedMeterValue.additionalInfo;
                                        if (!chargyLib.isMandatoryJSONObject(additionalInfo))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformationP",         measurementCounter));
                                            secondaryErrors += 4;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(additionalInfo.status))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_StatusP",  measurementCounter));

                                            //#region Additional info - Indexes

                                            const indexes = additionalInfo.indexes;
                                            if (!chargyLib.isMandatoryJSONObject(indexes))
                                            {
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_IndexesP",         measurementCounter));
                                                secondaryErrors += 2;
                                            }
                                            else
                                            {

                                                if (!chargyLib.isMandatoryNumber(signedMeterValue?.additionalInfo?.indexes?.timer))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_Indexes_TimerP",   measurementCounter));

                                                if (!chargyLib.isMandatoryString(signedMeterValue?.additionalInfo?.indexes?.logBook))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_Indexes_LogBookP", measurementCounter));

                                            }

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region ChargePoint information

                                        const chargePoint = signedMeterValue.chargePoint;
                                        if (!chargyLib.isMandatoryJSONObject(chargePoint))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ChargePointInformationP",                 measurementCounter));
                                            secondaryErrors += 1;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(signedMeterValue?.chargePoint?.softwareVersion))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ChargePointInformation_SoftwareVersionP", measurementCounter));

                                        }

                                        //#endregion

                                    }

                                }

                            }

                        }

                    }

                    //#endregion

                    if (errors.length > 0) return {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        errors:     errors,
                        warnings:   warnings,
                        certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                    }

                }
                //#endregion

                //#region Parse the container format
                {

                    const signedMeterValues  = SomeJSON.signedMeterValues;
                    const placeInfo          = SomeJSON.placeInfo;
                    const evseId             = SomeJSON.placeInfo.evseId;
                    const address            = SomeJSON.placeInfo.address;
                    const address_street     = SomeJSON.placeInfo.address.street;
                    const address_zipCode    = SomeJSON.placeInfo.address.zipCode;
                    const address_town       = SomeJSON.placeInfo.address.town;
                    const address_country    = SomeJSON.placeInfo.address.country ?? "Deutschland"; //ToDo: i18n!
                    const geoLocation        = SomeJSON.placeInfo.geoLocation;
                    const geoLocation_lat    = SomeJSON.placeInfo.geoLocation.lat;
                    const geoLocation_lon    = SomeJSON.placeInfo.geoLocation.lon;


                    if (chargyLib.isMandatoryJSONArray (signedMeterValues) &&

                        chargyLib.isMandatoryJSONObject(placeInfo)         &&

                        chargyLib.isMandatoryString    (evseId)            &&

                        chargyLib.isMandatoryJSONObject(address)           &&
                        chargyLib.isMandatoryString    (address_street)    &&
                        chargyLib.isMandatoryString    (address_zipCode)   &&
                        chargyLib.isMandatoryString    (address_town)      &&
                        chargyLib.isMandatoryString    (address_country)   &&

                        chargyLib.isMandatoryJSONObject(geoLocation)       &&
                        chargyLib.isMandatoryNumber    (geoLocation_lat)   &&
                        chargyLib.isMandatoryNumber    (geoLocation_lon))
                    {

                        SomeJSON.placeInfo.address.country = address_country;

                        //#region Generate default charge transparency record

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
                                            //"description":              { },
                                            //"firmwareVersion":          "", //CTRArray[0]["chargePoint"]["softwareVersion"],
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
                                                    //"connectors":               [  ],
                                                    "meters":                   [ ]
                                                }
                                            ]
                                        }
                                    ]

                                }
                            ],

                            certainty: 0

                        };

                        //#endregion

                        //#region Parse the signedMeterValues

                        const signedMeterValueContext = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                                            ? signedMeterValues[0]["@context"]?.trim()
                                                            : oldChargeITMeterValueFormat;

                        if (signedMeterValueContext === "https://www.lichtblick.de/contexts/bsm-ws36a-json-v0"         ||
                            signedMeterValueContext === "https://www.lichtblick.de/contexts/bsm-ws36a-json-v1"         ||
                            signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v0"             ||
                            signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v1"             ||
                            signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0" ||
                            signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v1") {

                            return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, null, signedMeterValues);

                        }

                        if (signedMeterValueContext.startsWith("ALFEN")) {
                            return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload),
                                         {
                                            EVSEId: evseId,
                                            chargingStation: {
                                               geoLocation: { "lat":    geoLocation_lat, "lng":        geoLocation_lon },
                                               address:     { "street": address_street,  "postalCode": address_zipCode, "city": address_town, "country": address_country }
                                            }
                                         });
                        }

                        if (containerFormat === oldChargeITContainerFormat) {

                            if (signedMeterValues[0].format == "ALFEN")
                                return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload),
                                         {
                                            EVSEId: evseId,
                                            chargingStation: {
                                               geoLocation: { "lat":    geoLocation_lat, "lng":        geoLocation_lon },
                                               address:     { "street": address_street,  "postalCode": address_zipCode, "city": address_town, "country": address_country }
                                            }
                                         });

                        }

                        if (signedMeterValueContext === oldChargeITMeterValueFormat)
                            return await this.tryToParseOldChargeITMeterValuesFormat(CTR,
                                                                                     evseId,
                                                                                     address,
                                                                                     geoLocation,
                                                                                     signedMeterValues);

                        //#endregion

                        return {
                            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                            errors:     errors,
                            warnings:   warnings,
                            certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                        }

                    }

                }

                //#endregion

            }
            catch (exception)
            {
                return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                    errors:     errors,
                    warnings:   warnings,
                    certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                }
            }

        }

        //#endregion

        //#region New chargeIT container format

        if (containerFormat == "https://www.lichtblick.de/contexts/charging-station-json-v0"         ||
            containerFormat == "https://www.lichtblick.de/contexts/charging-station-json-v1"         ||
            containerFormat == "https://www.eneco.com/contexts/charging-station-json-v0"             ||
            containerFormat == "https://www.eneco.com/contexts/charging-station-json-v1"             ||
            containerFormat == "https://www.chargeit-mobility.com/contexts/charging-station-json-v0" ||
            containerFormat == "https://www.chargeit-mobility.com/contexts/charging-station-json-v1")
        {

            let numberOfFormatChecks  = 81;
            let secondaryErrors       = 0;

            try
            {

                const chargingSessionId                          = SomeJSON["@id"];

                const chargePointInfo                            = SomeJSON.chargePointInfo;
                const evseId                                     = SomeJSON.chargePointInfo?.evseId;

                const placeInfo                                  = SomeJSON.chargePointInfo?.placeInfo;
                const geoLocation                                = SomeJSON.chargePointInfo?.placeInfo?.geoLocation;
                const geoLocation_lat                            = SomeJSON.chargePointInfo?.placeInfo?.geoLocation?.lat;
                const geoLocation_lon                            = SomeJSON.chargePointInfo?.placeInfo?.geoLocation?.lon;

                const address                                    = SomeJSON.chargePointInfo?.placeInfo?.address;
                const address_street                             = SomeJSON.chargePointInfo?.placeInfo?.address?.street;
                const address_zipCode                            = SomeJSON.chargePointInfo?.placeInfo?.address?.zipCode;
                const address_town                               = SomeJSON.chargePointInfo?.placeInfo?.address?.town;
                const address_country                            = SomeJSON.chargePointInfo?.placeInfo?.address?.country ?? "";

                const chargingStationInfo                        = SomeJSON.chargingStationInfo;
                const chargingStation_manufacturer               = SomeJSON.chargingStationInfo?.manufacturer;
                const chargingStation_type                       = SomeJSON.chargingStationInfo?.type;
                const chargingStation_serialNumber               = SomeJSON.chargingStationInfo?.serialNumber;
                const chargingStation_controllerSoftwareVersion  = SomeJSON.chargingStationInfo?.controllerSoftwareVersion;
                const chargingStation_compliance                 = SomeJSON.chargingStationInfo?.compliance;
                const chargingStation_complianceURL              = SomeJSON.chargingStationInfo?.complianceURL;
                const chargingStation_conformity                 = SomeJSON.chargingStationInfo?.conformity;
                const chargingStation_conformity_URL             = SomeJSON.chargingStationInfo?.conformityURL;
                const chargingStation_conformity_certificateId   = SomeJSON.chargingStationInfo?.conformityCertificateId;
                const chargingStation_calibration                = SomeJSON.chargingStationInfo?.calibration;
                const chargingStation_calibration_URL            = SomeJSON.chargingStationInfo?.calibrationURL;
                const chargingStation_calibration_certificateId  = SomeJSON.chargingStationInfo?.calibrationCertificateId;

                // meterInfo can also be under the signedMeterValues!
                const meterInfo                                  = SomeJSON.meterInfo;
                const meterInfo_meterId                          = SomeJSON.meterInfo?.meterId;
                const meterInfo_manufacturer                     = SomeJSON.meterInfo?.manufacturer;
                const meterInfo_manufacturerURL                  = SomeJSON.meterInfo?.manufacturerURL;
                const meterInfo_model                            = SomeJSON.meterInfo?.model;
                const meterInfo_modelURL                         = SomeJSON.meterInfo?.modelURL;
                const meterInfo_hardwareVersion                  = SomeJSON.meterInfo?.hardwareVersion;
                const meterInfo_firmwareVersion                  = SomeJSON.meterInfo?.firmwareVersion;
                const meterInfo_publicKey                        = SomeJSON.meterInfo?.publicKey;
                const meterInfo_publicKeyFormat                  = SomeJSON.meterInfo?.publicKeyFormat;
                const meterInfo_publicKeyEncoding                = SomeJSON.meterInfo?.publicKeyEncoding;
                const meterInfo_signatureFormat                  = SomeJSON.meterInfo?.signatureFormat;
                const meterInfo_signatureEncoding                = SomeJSON.meterInfo?.signatureEncoding;

                const connectorInfo                              = SomeJSON.connectorInfo;
                const connectorInfo_type                         = SomeJSON.connectorInfo?.type;
                const connectorInfo_losses                       = SomeJSON.connectorInfo?.losses;

                const chargingCostsInfo                          = SomeJSON.chargingCostsInfo;
                const chargingCostsInfo_total                    = SomeJSON.chargingCostsInfo?.total;
                const chargingCostsInfo_currency                 = SomeJSON.chargingCostsInfo?.currency;
                const chargingCostsInfo_reservation              = SomeJSON.chargingCostsInfo?.reservation;
                const chargingCostsInfo_reservation_cost         = SomeJSON.chargingCostsInfo?.reservation?.cost;
                const chargingCostsInfo_reservation_unit         = SomeJSON.chargingCostsInfo?.reservation?.unit;
                const chargingCostsInfo_energy                   = SomeJSON.chargingCostsInfo?.energy;
                const chargingCostsInfo_energy_cost              = SomeJSON.chargingCostsInfo?.energy?.cost;
                const chargingCostsInfo_energy_unit              = SomeJSON.chargingCostsInfo?.energy?.unit;
                const chargingCostsInfo_time                     = SomeJSON.chargingCostsInfo?.time;
                const chargingCostsInfo_time_cost                = SomeJSON.chargingCostsInfo?.time?.cost;
                const chargingCostsInfo_time_unit                = SomeJSON.chargingCostsInfo?.time?.unit;
                const chargingCostsInfo_idle                     = SomeJSON.chargingCostsInfo?.idle;
                const chargingCostsInfo_idle_cost                = SomeJSON.chargingCostsInfo?.idle?.cost;
                const chargingCostsInfo_idle_unit                = SomeJSON.chargingCostsInfo?.idle?.unit;
                const chargingCostsInfo_flat                     = SomeJSON.chargingCostsInfo?.flat;
                const chargingCostsInfo_flat_cost                = SomeJSON.chargingCostsInfo?.flat?.cost;

                const signedMeterValues                          = SomeJSON.signedMeterValues;


                if (!chargyLib.isMandatoryString(chargingSessionId))
                    errors.push(this.chargy.GetLocalizedMessage("Missing or invalid charge transparency record identification!"));

                //#region chargePointInfo

                if (!chargyLib.isMandatoryJSONObject(chargePointInfo))
                {
                    errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidChargePointInfo"));
                    secondaryErrors += 19;
                }
                else
                {

                    if (!chargyLib.isMandatoryString(evseId))
                        errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidEVSEIdentification"));

                    //#region placeInfo

                    if (!chargyLib.isMandatoryJSONObject(placeInfo))
                    {
                        errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidPlaceInfo"));
                        secondaryErrors += 8;
                    }
                    else
                    {

                        //#region geoLocation

                        if (!chargyLib.isMandatoryJSONObject(geoLocation))
                        {
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocation"));
                            secondaryErrors += 2;
                        }
                        else
                        {

                            if (!chargyLib.isMandatoryNumber(geoLocation_lat))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocationLatitude"));

                            if (!chargyLib.isMandatoryNumber(geoLocation_lon))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocationLongitude"));

                        }

                        //#endregion

                        //#region address

                        if (!chargyLib.isMandatoryJSONObject(address))
                        {
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddress"));
                            secondaryErrors += 4;
                        }
                        else
                        {

                            if (!chargyLib.isMandatoryString(address_street))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressStreetName"));

                            if (!chargyLib.isMandatoryString(address_zipCode))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressZIPCode"));

                            if (!chargyLib.isMandatoryString(address_town))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressCityName"));

                            if (!chargyLib.isMandatoryString(address_country))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressCountryName"));

                        }

                        //#endregion

                    }

                    //#endregion

                }

                //#endregion

                //#region chargingStationInfo

                if (!chargyLib.isMandatoryJSONObject(chargingStationInfo))
                {
                    errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidChargingStationInfo"));
                    secondaryErrors += 5;
                }
                else
                {

                    if (!chargyLib.isOptionalString(chargingStation_manufacturer))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station manufacturer!"));

                    if (!chargyLib.isOptionalString(chargingStation_type))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station type!"));

                    if (!chargyLib.isOptionalString(chargingStation_serialNumber))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station serial number!"));

                    if (!chargyLib.isOptionalString(chargingStation_controllerSoftwareVersion))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station controller software version!"));


                    if (!chargyLib.isOptionalString(chargingStation_compliance))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station compliance!"));

                    if (!chargyLib.isOptionalURL   (chargingStation_complianceURL))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station compliance URL!"));


                    if (!chargyLib.isOptionalString(chargingStation_conformity))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station conformity!"));

                    if (!chargyLib.isOptionalURL   (chargingStation_conformity_URL))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station conformity URL!"));

                    if (!chargyLib.isOptionalURL   (chargingStation_conformity_certificateId))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station conformity certificate identification!"));


                    if (!chargyLib.isOptionalString(chargingStation_calibration))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station calibration!"));

                    if (!chargyLib.isOptionalURL   (chargingStation_calibration_URL))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station calibration URL!"));

                    if (!chargyLib.isOptionalURL   (chargingStation_calibration_certificateId))
                        errors.push(this.chargy.GetLocalizedMessage("Invalid charging station calibration certificate identification!"));

                }

                //#endregion

                //#region meterInfo

                if (meterInfo) {

                    if (!chargyLib.isOptionalString(meterInfo_meterId))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         1));

                    if (!chargyLib.isOptionalString(meterInfo_manufacturer))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    1));

                    if (!chargyLib.isOptionalString(meterInfo_manufacturerURL))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    1));

                    if (!chargyLib.isOptionalString(meterInfo_model))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    1));

                    if (!chargyLib.isOptionalString(meterInfo_modelURL))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    1));

                    if (!chargyLib.isOptionalString(meterInfo_firmwareVersion))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_FirmwareVersionP", 1));

                    if (!chargyLib.isOptionalString(meterInfo_hardwareVersion))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_FirmwareVersionP", 1));


                    if (!chargyLib.isOptionalString(meterInfo_publicKey))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));

                    if (!chargyLib.isOptionalString(meterInfo_publicKeyFormat))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));

                    if (!chargyLib.isOptionalString(meterInfo_publicKeyEncoding))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));


                    if (!chargyLib.isOptionalString(meterInfo_signatureFormat))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));

                    if (!chargyLib.isOptionalString(meterInfo_signatureEncoding))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));

                }

                //#endregion

                //#region connectorInfo

                if (connectorInfo) {

                    if (!chargyLib.isOptionalString(connectorInfo_type))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         1));

                    if (!chargyLib.isOptionalString(connectorInfo_losses))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         1));

                }

                //#endregion

                //#region chargingCostsInfo

                if (chargingCostsInfo)
                {

                    if (!chargyLib.isMandatoryNumber(chargingCostsInfo_total))
                        errors.push(this.chargy.GetLocalizedMessage("Missing or invalid total costs within the charging costs!"));

                    if (!chargyLib.isMandatoryString(chargingCostsInfo_currency))
                        errors.push(this.chargy.GetLocalizedMessage("Missing or invalid currency within the charging costs!"));

                    if (chargingCostsInfo_reservation)
                    {

                        if (!chargyLib.isMandatoryNumber(chargingCostsInfo_reservation_cost))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid reservation cost within the charging costs!"));

                        // ToDo: Check for valid reservation unit
                        if (!chargyLib.isMandatoryString(chargingCostsInfo_reservation_unit))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid reservation unit within the charging costs!"));

                    }

                    if (chargingCostsInfo_energy)
                    {

                        if (!chargyLib.isMandatoryNumber(chargingCostsInfo_energy_cost))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid energy cost within the charging costs!"));

                        // ToDo: Check for valid energy unit
                        if (!chargyLib.isMandatoryString(chargingCostsInfo_energy_unit))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid energy unit within the charging costs!"));

                    }

                    if (chargingCostsInfo_time)
                    {

                        if (!chargyLib.isMandatoryNumber(chargingCostsInfo_time_cost))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid time cost within the charging costs!"));

                        // ToDo: Check for valid time unit
                        if (!chargyLib.isMandatoryString(chargingCostsInfo_time_unit))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid time unit within the charging costs!"));

                    }

                    if (chargingCostsInfo_idle)
                    {

                        if (!chargyLib.isMandatoryNumber(chargingCostsInfo_idle_cost))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid idle cost within the charging costs!"));

                        // ToDo: Check for valid idle unit
                        if (!chargyLib.isMandatoryString(chargingCostsInfo_idle_unit))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid idle unit within the charging costs!"));

                    }

                    if (chargingCostsInfo_flat)
                    {

                        if (!chargyLib.isMandatoryNumber(chargingCostsInfo_flat_cost))
                            errors.push(this.chargy.GetLocalizedMessage("Missing or invalid flat cost within the charging costs!"));

                    }

                }

                //#endregion

                if (!chargyLib.isMandatoryJSONArray(signedMeterValues) || signedMeterValues.length < 2) {
                    errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidSignedMeterValues"));
                    secondaryErrors += 2*39;
                }
                else
                {

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
                            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                            message:    "Inconsistent signed meter value format!",
                            certainty:  1
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
                                            "country":              address_country
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
                        ],

                        certainty: 0

                    };

                    //#endregion

                    if      (smvContext?.startsWith("https://www.chargeit-mobility.com/contexts/bsm-ws36a-json"))
                        return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, chargingStation_controllerSoftwareVersion, signedMeterValues);

                    if (smvContext?.startsWith("ALFEN"))
                        return await new Alfen01(this.chargy).tryToParseALFENFormat(
                                         signedMeterValues.map(value => value.payload),
                                         {
                                             chargingSession: {
                                                "@id":            chargingSessionId
                                             },
                                             EVSEId:              evseId,
                                             chargingStation: {
                                                manufacturer:     chargingStation_manufacturer,
                                                type:             chargingStation_type,
                                                serialNumber:     chargingStation_serialNumber,
                                                firmwareVersion:  chargingStation_controllerSoftwareVersion,
                                                legalCompliance:  {
                                                    conformity: [{

                                                        freeText:  chargingStation_compliance
                                                    }],
                                                    calibration: [{
                                                        freeText:  chargingStation_calibration
                                                    }]
                                                },
                                                geoLocation:      { "lat":    geoLocation_lat, "lng":        geoLocation_lon },
                                                address:          { "street": address_street,  "postalCode": address_zipCode, "city": address_town, "country": address_country }
                                             },
                                            energyMeter:          meterInfo,
                                            connector:            connectorInfo,
                                            chargingCosts:        chargingCostsInfo
                                         });

                }

                return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    errors:     errors,
                    warnings:   warnings,
                    certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                }

            }
            catch (exception)
            {
                return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                    errors:     errors,
                    warnings:   warnings,
                    certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                }
            }

        }

        //#endregion

        return {
            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:    "No chargeIT charge transparency record",
            errors:     errors,
            warnings:   warnings,
            certainty:  0
        }

    }

    //#endregion


}
