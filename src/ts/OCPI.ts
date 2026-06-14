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
import { Alfen }                      from './Alfen'
import { BSMCrypt01 }                 from './BSMCrypt01'
import * as chargyInterfaces          from './interfaces/chargyInterfaces'
import * as chargeTransparencyRecord  from './interfaces/IChargeTransparencyRecord'
import * as chargyLib                 from './chargyLib'
import { OCMF }                       from './OCMF'


export class OCPI {

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }


    private bufferToHex(buffer: ArrayBuffer, Reverse?: boolean) : string {
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


    //#region tryToParseChargeITContainerFormat(SomeJSON)

    // The chargeIT mobility data format does not always provide context information or format identifiers!
    public async tryToParseOCPIFormat(SomeJSON: unknown) : Promise<chargeTransparencyRecord.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        const errors    = new Array<string>();
        const warnings  = new Array<string>();

        if (!chargyLib.isMandatoryJSONObject(SomeJSON))
        {
            return {
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                errors:     errors,
                warnings:   warnings,
                certainty:  0
            }
        }

        const jsonContextInformation = chargyLib.asString(SomeJSON["@context"])?.trim() ?? "";


        //#region Old chargeIT container format

        if (jsonContextInformation === "")
        {

            const encoding_method = SomeJSON["encoding_method"];
            const public_key      = SomeJSON["public_key"];
            const signed_values   = SomeJSON["signed_values"];

            if (!chargyLib.isMandatoryString(encoding_method))
                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidEncodingMethod"));

            if (!chargyLib.isMandatoryString(public_key))
                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidPublicKey"));

            if (!chargyLib.isMandatoryJSONArray(signed_values))
                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidSignedValues"));

            if (errors.length > 0)
                return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    errors:     errors,
                    warnings:   warnings,
                    certainty:  0
                }

            if (encoding_method === "OCMF"                    &&
                chargyLib.isMandatoryJSONArray(signed_values) &&
                signed_values.length > 0)
            {

                const firstSignedData = chargyLib.asString(chargyLib.asJSONObject(signed_values[0])?.["signed_data"]);

                if (firstSignedData)
                {

                    //#region Optional container infos (placeInfo, meterInfo, ...)

                    // Convert the optional place and meter information of the
                    // container into the common container info format, so that
                    // the OCMF parser can merge it into the resulting charge
                    // transparency record.

                    const placeInfo    = chargyLib.asJSONObject(SomeJSON["placeInfo"]);
                    const geoLocation  = chargyLib.asJSONObject(placeInfo?.["geoLocation"]);
                    const address      = chargyLib.asJSONObject(placeInfo?.["address"]);

                    const geoLat       = chargyLib.asNumber(geoLocation?.["lat"]);
                    const geoLon       = chargyLib.asNumber(geoLocation?.["lon"]);

                    const containerInfos = {

                        EVSEId:           chargyLib.asString(placeInfo?.["evseId"]),

                        chargingStation:  {
                            geoLocation:  geoLat !== undefined && geoLon !== undefined
                                              ? { lat: geoLat, lng: geoLon }
                                              : undefined,
                            address:      address
                                              ? {
                                                    street:      chargyLib.asString(address["street"]),
                                                    postalCode:  chargyLib.asString(address["zipCode"]) ?? "",
                                                    city:        chargyLib.asString(address["town"]),
                                                    country:     chargyLib.asString(address["country"]) ?? ""
                                                }
                                              : undefined
                        },

                        energyMeter:      chargyLib.asJSONObject(SomeJSON["meterInfo"])

                    };

                    //#endregion

                    return await new OCMF(this.chargy).TryToParseOCMFDocument(firstSignedData,
                                                                              chargyLib.asString(public_key),
                                                                              encoding_method,
                                                                              containerInfos);

                }

            }

        }

        //#endregion

        //#region New chargeIT container format

        if (jsonContextInformation == "https://open.charging.cloud/contexts/ocpi-2.1")
        {

            const numberOfFormatChecks  = 81;
            let   secondaryErrors       = 0;

            try
            {

                const chargingSessionId                          = SomeJSON["@id"];

                const chargePointInfo                            = chargyLib.asJSONObject(SomeJSON["chargePointInfo"]);
                const evseId                                     = chargePointInfo?.["evseId"];

                const placeInfo                                  = chargyLib.asJSONObject(chargePointInfo?.["placeInfo"]);
                const geoLocation                                = chargyLib.asJSONObject(placeInfo?.["geoLocation"]);
                const geoLocation_lat                            = geoLocation?.["lat"];
                const geoLocation_lon                            = geoLocation?.["lon"];

                const address                                    = chargyLib.asJSONObject(placeInfo?.["address"]);
                const address_street                             = address?.["street"];
                const address_zipCode                            = address?.["zipCode"];
                const address_town                               = address?.["town"];
                const address_country                            = address?.["country"] ?? "";

                const chargingStationInfo                        = chargyLib.asJSONObject(SomeJSON["chargingStationInfo"]);
                const chargingStation_manufacturer               = chargingStationInfo?.["manufacturer"];
                const chargingStation_type                       = chargingStationInfo?.["type"];
                const chargingStation_serialNumber               = chargingStationInfo?.["serialNumber"];
                const chargingStation_controllerSoftwareVersion  = chargingStationInfo?.["controllerSoftwareVersion"];
                const chargingStation_compliance                 = chargingStationInfo?.["compliance"];
                const chargingStation_complianceURL              = chargingStationInfo?.["complianceURL"];
                const chargingStation_conformity                 = chargingStationInfo?.["conformity"];
                const chargingStation_conformity_URL             = chargingStationInfo?.["conformityURL"];
                const chargingStation_conformity_certificateId   = chargingStationInfo?.["conformityCertificateId"];
                const chargingStation_calibration                = chargingStationInfo?.["calibration"];
                const chargingStation_calibration_URL            = chargingStationInfo?.["calibrationURL"];
                const chargingStation_calibration_certificateId  = chargingStationInfo?.["calibrationCertificateId"];

                // meterInfo can also be under the signedMeterValues!
                const meterInfo                                  = chargyLib.asJSONObject(SomeJSON["meterInfo"]);
                const meterInfo_meterId                          = meterInfo?.["meterId"];
                const meterInfo_manufacturer                     = meterInfo?.["manufacturer"];
                const meterInfo_manufacturerURL                  = meterInfo?.["manufacturerURL"];
                const meterInfo_model                            = meterInfo?.["model"];
                const meterInfo_modelURL                         = meterInfo?.["modelURL"];
                const meterInfo_hardwareVersion                  = meterInfo?.["hardwareVersion"];
                const meterInfo_firmwareVersion                  = meterInfo?.["firmwareVersion"];
                const meterInfo_publicKey                        = meterInfo?.["publicKey"];
                const meterInfo_publicKeyFormat                  = meterInfo?.["publicKeyFormat"];
                const meterInfo_publicKeyEncoding                = meterInfo?.["publicKeyEncoding"];
                const meterInfo_signatureFormat                  = meterInfo?.["signatureFormat"];
                const meterInfo_signatureEncoding                = meterInfo?.["signatureEncoding"];

                const connectorInfo                              = chargyLib.asJSONObject(SomeJSON["connectorInfo"]);
                const connectorInfo_type                         = connectorInfo?.["type"];
                const connectorInfo_losses                       = connectorInfo?.["losses"];

                const chargingCostsInfo                          = chargyLib.asJSONObject(SomeJSON["chargingCostsInfo"]);
                const chargingCostsInfo_total                    = chargingCostsInfo?.["total"];
                const chargingCostsInfo_currency                 = chargingCostsInfo?.["currency"];
                const chargingCostsInfo_reservation              = chargyLib.asJSONObject(chargingCostsInfo?.["reservation"]);
                const chargingCostsInfo_reservation_cost         = chargingCostsInfo_reservation?.["cost"];
                const chargingCostsInfo_reservation_unit         = chargingCostsInfo_reservation?.["unit"];
                const chargingCostsInfo_energy                   = chargyLib.asJSONObject(chargingCostsInfo?.["energy"]);
                const chargingCostsInfo_energy_cost              = chargingCostsInfo_energy?.["cost"];
                const chargingCostsInfo_energy_unit              = chargingCostsInfo_energy?.["unit"];
                const chargingCostsInfo_time                     = chargyLib.asJSONObject(chargingCostsInfo?.["time"]);
                const chargingCostsInfo_time_cost                = chargingCostsInfo_time?.["cost"];
                const chargingCostsInfo_time_unit                = chargingCostsInfo_time?.["unit"];
                const chargingCostsInfo_idle                     = chargyLib.asJSONObject(chargingCostsInfo?.["idle"]);
                const chargingCostsInfo_idle_cost                = chargingCostsInfo_idle?.["cost"];
                const chargingCostsInfo_idle_unit                = chargingCostsInfo_idle?.["unit"];
                const chargingCostsInfo_flat                     = chargyLib.asJSONObject(chargingCostsInfo?.["flat"]);
                const chargingCostsInfo_flat_cost                = chargingCostsInfo_flat?.["cost"];

                const signedMeterValues                          = SomeJSON["signedMeterValues"];


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

                    const firstSMV   = chargyLib.asJSONObject(signedMeterValues[0]);
                    const smvContext = chargyLib.asString(firstSMV?.["@context"])?.trim()
                                           ?? chargyLib.asString(firstSMV?.["format"])?.trim()
                                           ?? null;

                    for (let i = 1; i < signedMeterValues.length; i++)
                    {

                        const currentSMV = chargyLib.asJSONObject(signedMeterValues[i]);
                        const context    = chargyLib.asString(currentSMV?.["@context"])?.trim()
                                               ?? chargyLib.asString(currentSMV?.["format"])?.trim()
                                               ?? null;

                        if (smvContext !== context) return {
                            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                            message:    "Inconsistent signed meter value format!",
                            certainty:  1
                        }

                    }


                    //#region Generate default-transparency record

                    const evseIdStr = chargyLib.asString(evseId) ?? "";

                    const CTR: chargeTransparencyRecord.IChargeTransparencyRecord = {

                        "@id":              "",
                        "@context":         "https://open.charging.cloud/contexts/CTR+json",

                        "description": {
                            "de":           "Alle Ladevorgänge",
                            "en":           "All charging sessions"
                        },

                        "chargingStationOperators": [
                            {

                                "@id":                      "chargeITmobilityCSO",
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
                                            "encoding":         "hex",
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
                                            "encoding":         "hex",
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
                                        "@id":                      evseIdStr.substring(0, evseIdStr.lastIndexOf("*")),
                                        //"@context":                 "",
                                        //"description":              { },
                                        //"firmwareVersion":          "", //CTRArray[0]["chargePoint"]["softwareVersion"],
                                        "geoLocation":              { "lat": chargyLib.asNumber(geoLocation_lat) ?? 0, "lng": chargyLib.asNumber(geoLocation_lon) ?? 0 },
                                        "address": {
                                            //"@context":             "",
                                            "street":               chargyLib.asString(address_street),
                                            "postalCode":           chargyLib.asString(address_zipCode) ?? "",
                                            "city":                 chargyLib.asString(address_town) ?? "",
                                            "country":              chargyLib.asString(address_country) ?? ""
                                        },
                                        "EVSEs": [
                                            {
                                                "@id":                      evseIdStr,
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
                        return new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseIdStr, chargyLib.asString(chargingStation_controllerSoftwareVersion) ?? null, signedMeterValues);

                    if (smvContext?.startsWith("ALFEN"))
                        return new Alfen(this.chargy).TryToParseALFENFormat(
                                   signedMeterValues.map(value => chargyLib.asString(chargyLib.asJSONObject(value)?.["payload"]) ?? ""),
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
                    message:    "Exception occured: " + (exception instanceof Error ? exception.message : String(exception)),
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
