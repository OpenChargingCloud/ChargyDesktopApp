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
import * as ocmfTypes         from './OCMFTypes'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import Decimal                from 'decimal.js';

// Note: OCMF is not really about signed meter values, but a container format for signed meter values.
//       The signature is not about the meter values, but about the entire container.
//       This has implications how OCMF is embeded within EV roaming protocols like OICP or OCPI,
//       that expect signed meter values only!

export interface IOCMFMeasurementValue extends chargyInterfaces.IMeasurementValue
{
    measurement?:               IOCMFMeasurement;
    timeSync:                   string;
    transaction?:               string;
    transactionType:            ocmfTypes.OCMFTransactionTypes;
    pagination:                 number;
    errorFlags?:                string;
    cumulatedLoss?:             Decimal;
    status:                     string;
}

export interface IOCMFMeasurement extends chargyInterfaces.IMeasurement
{
    currentType?:               string;
    values:                     Array<IOCMFMeasurementValue>;
}

export interface IOCMFAuthorization extends chargyInterfaces.IAuthorization
{
    identificationStatus?:      boolean;
    identificationLevel?:       string;
    identificationFlags?:       Array<string>;
}

export interface IOCMFChargingSession extends chargyInterfaces.IChargingSession
{
    internalSessionId?:         string;
    authorizationStart:         IOCMFAuthorization;
    meter?:                     chargyInterfaces.IMeter;
    measurements:               Array<IOCMFMeasurement>;
}

export interface IOCMFCTRExtensions {
    formatVersion?:             string,
    gatewayInformation?:        string,
    gatewaySerial?:             string,
    gatewayVersion?:            string
}

export interface IOCMFChargeTransparencyRecord extends chargyInterfaces.IChargeTransparencyRecord
{
    ocmf?:                      IOCMFCTRExtensions;
    chargingSessions?:          Array<IOCMFChargingSession>;
}

export class OCMF {

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }

    //#region tryToParseOCMFv0_1(OCMFDataList, PublicKey?)

    // private async tryToParseOCMFv0_1(OCMFDataList:  ocmfTypes.IOCMFData_v0_1,
    //                                  PublicKey?:    string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    // {

    //     // {
    //     //     "FV": "0.1",
    //     //     "VI": "ABL",
    //     //     "VV": "1.4p3",
    //     //
    //     //     "PG": "T12345",
    //     //
    //     //     "MV": "Phoenix Contact",
    //     //     "MM": "EEM-350-D-MCB",
    //     //     "MS": "BQ27400330016",
    //     //     "MF": "1.0",
    //     //
    //     //     "IS": "VERIFIED",
    //     //     "IF": ["RFID_PLAIN", "OCPP_RS_TLS"],
    //     //     "IT": "ISO14443",
    //     //     "ID": "1F2D3A4F5506C7",
    //     //
    //     //     "RD": [{
    //     //         "TM": "2018-07-24T13:22:04,000+0200 S",
    //     //         "TX": "B",
    //     //         "RV": 2935.6,
    //     //         "RI": "1-b:1.8.e",
    //     //         "RU": "kWh",
    //     //         "EI": 567,
    //     //         "ST": "G"
    //     //     }]
    //     // }

    //     try
    //     {

    //         let VendorInformation  :string = OCMFDataList.VI != null ? OCMFDataList.VI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the vendor.
    //         let VendorVersion      :string = OCMFDataList.VV != null ? OCMFDataList.VV.trim() : ""; // Software version of the vendor.

    //         let paging             :string = OCMFDataList.PG != null ? OCMFDataList.PG.trim() : ""; // Paging, as this data might be part of a larger context.
    //         let transactionType     = ocmfTypes.OCMFTransactionTypes.undefined;
    //         switch (paging[0]?.toLowerCase())
    //         {

    //             case 't':
    //                 transactionType = ocmfTypes.OCMFTransactionTypes.transaction;
    //                 break;

    //             case 'f':
    //                 transactionType = ocmfTypes.OCMFTransactionTypes.fiscal;
    //                 break

    //         }
    //         let pagingId            = paging.substring(1);

    //         let MeterVendor        :string = OCMFDataList.MV != null ? OCMFDataList.MV.trim() : ""; // Vendor of the device, optional.
    //         let MeterModel         :string = OCMFDataList.MM != null ? OCMFDataList.MM.trim() : ""; // Model of the device, optional.
    //         let MeterSerial        :string = OCMFDataList.MS != null ? OCMFDataList.MS.trim() : ""; // Serialnumber of the device, might be optional.
    //         let MeterFirmware      :string = OCMFDataList.MF != null ? OCMFDataList.MF.trim() : ""; // Software version of the device.

    //         return {
    //             status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
    //             message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
    //             certainty: 0
    //         }

    //     } catch (exception)
    //     {
    //         return {
    //             status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
    //             message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
    //             certainty: 0
    //         }
    //     }

    // }

    //#endregion

    //#region (private) tryToParseOCMFv1_0(OCMFDataList, PublicKey?)

    private async tryToParseOCMFv1_0(OCMFJSONDocuments:  ocmfTypes.IOCMFJSONDocument[],
                                     PublicKey?:         string|chargyInterfaces.IPublicKeyXY,
                                     ContainerInfos?:    any) : Promise<IOCMFChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            const firstOCMDJSONDocument = OCMFJSONDocuments[0];

            if (firstOCMDJSONDocument != undefined)
            {

                //#region General Information

                const formatVersion                 = firstOCMDJSONDocument.payload?.FV;
                const gatewayInformation            = firstOCMDJSONDocument.payload?.GI;
                const gatewaySerial                 = firstOCMDJSONDocument.payload?.GS;
                const gatewayVersion                = firstOCMDJSONDocument.payload?.GV;

                //#endregion

                //#region Pagination

                const paging                        = firstOCMDJSONDocument.payload?.PG;

                //#endregion

                //#region Meter Identification

                const meterVendor                   = firstOCMDJSONDocument.payload?.MV;
                const meterModel                    = firstOCMDJSONDocument.payload?.MM;
                const meterSerial                   = firstOCMDJSONDocument.payload?.MS;
                const meterFirmware                 = firstOCMDJSONDocument.payload?.MF;

                //#endregion

                //#region User Assignment

                const identificationStatus          = firstOCMDJSONDocument.payload?.IS;
                const identificationLevel           = firstOCMDJSONDocument.payload?.IL;
                const identificationFlags           = firstOCMDJSONDocument.payload?.IF;
                const identificationType            = firstOCMDJSONDocument.payload?.IT;
                const identificationData            = firstOCMDJSONDocument.payload?.ID;
                const tariffText                    = firstOCMDJSONDocument.payload?.TT;

                //#endregion

                //#region EVSE Metrologic parameters

                const controlerFirmwareVersion      = firstOCMDJSONDocument.payload?.CF;
                const lossCompensation              = firstOCMDJSONDocument.payload?.LC;

                //#endregion

                //#region Assignment of the Charge Point

                const chargePointIdType             = firstOCMDJSONDocument.payload?.CT;
                const chargePointId                 = firstOCMDJSONDocument.payload?.CI;

                //#endregion

                if (chargyLib.isOptionalString          (formatVersion)        &&
                    chargyLib.isOptionalString          (gatewayInformation)   &&
                    chargyLib.isOptionalString          (gatewaySerial)        &&
                    chargyLib.isOptionalString          (gatewayVersion)       &&

                    chargyLib.isMandatoryString         (paging)               &&

                    chargyLib.isOptionalString          (meterVendor)          &&
                    chargyLib.isOptionalString          (meterModel)           &&
                    chargyLib.isMandatoryString         (meterSerial)          &&
                    chargyLib.isOptionalString          (meterFirmware)        &&

                    chargyLib.isMandatoryBoolean        (identificationStatus) &&
                    chargyLib.isOptionalString          (identificationLevel)  &&
                    //chargyLib.isMandatoryArrayOfStrings (identificationFlags)  &&
                    chargyLib.isOptionalArrayOfStrings  (identificationFlags)  &&  // Note: Some vendors do not use this MANDATORY field!
                    chargyLib.isMandatoryString         (identificationType)   &&
                    chargyLib.isOptionalString          (identificationData)   &&
                    chargyLib.isOptionalString          (tariffText)           &&

                    chargyLib.isOptionalJSONObject      (lossCompensation)     &&

                    chargyLib.isOptionalString          (chargePointIdType)    &&
                    chargyLib.isOptionalString          (chargePointId)        )
                {

                    //#region Validate pagination and transaction type

                    const paginationPrefix              = paging.length > 0
                                                              ? paging[0]?.toLowerCase()
                                                              : null;
                    const transactionType               = paginationPrefix === 't'
                                                              ? ocmfTypes.OCMFTransactionTypes.transaction
                                                              : paginationPrefix === 'f'
                                                                    ? ocmfTypes.OCMFTransactionTypes.fiscal
                                                                    : ocmfTypes.OCMFTransactionTypes.undefined;
                    const pagination                    = paging.length > 1
                                                              ? chargyLib.parseNumber(paging.substring(1))
                                                              : null;

                    if (transactionType === ocmfTypes.OCMFTransactionTypes.undefined) return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   this.chargy.GetLocalizedMessage("The given OCMF data does not have a valid transaction type!"),
                        certainty: 0
                    }

                    if (!chargyLib.isMandatoryNumber(pagination)) return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   this.chargy.GetLocalizedMessage("The given OCMF data does not have a valid pagination counter!"),
                        certainty: 0
                    }

                    //#endregion

                    if (!firstOCMDJSONDocument.payload.RD || firstOCMDJSONDocument.payload.RD.length == 0) return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   this.chargy.GetLocalizedMessage("Each OCMF data set must have at least one meter reading!"),
                        certainty: 0
                    }

                    var CTR:IOCMFChargeTransparencyRecord = {

                        "@id":       "?",
                        "@context":  "https://open.charging.cloud/contexts/CTR+json",
                        //"@context":  [ "https://open.charging.cloud/contexts/CTR+json", "https://open.charging.cloud/contexts/CTR_OCMF+json" ],
                        "begin":     "?",
                        "end":       "?",
                        "description": {
                            "de":        "Alle OCMF-Ladevorgänge"
                        },

                        "contract": {
                            "@id":          identificationData ?? "?",
                            "type":         identificationType
                        },

                        "ocmf": {
                            "formatVersion":       formatVersion,
                            "gatewayInformation":  gatewayInformation,
                            "gatewaySerial":       gatewaySerial,
                            "gatewayVersion":      gatewayVersion
                        },

                        // "contract": {
                            // "@id":       identificationData,
                            // "type":      "?"
                        // },

                    //    "chargingStationOperators": [{

                        "chargingPools":  [{
                            "@id":                      "DE*GEF*POOL*CHARGY*1",
                            "description":              { "en": "GraphDefined CHARGY Virtual Charging Pool 1" },

                            "chargingStations": [{
                                "@id":                      "DE*GEF*STATION*CHARGY*1",
                                "description":              { "en": "GraphDefined CHARGY Virtual Charging Station 1" },

                                "EVSEs": [{
                                    "@id":                      "DE*GEF*EVSE*CHARGY*1",
                                    "description":              { "en": "GraphDefined CHARGY Virtual EVSE 1" },
                                    "meters": [{
                                        "@id":                          meterSerial,
                                        "manufacturer":                 meterVendor,
                                        "model":                        meterModel,
                                        //"hardwareVersion":              "1.0",
                                        "firmwareVersion":              meterFirmware,
                                        "signatureFormat":              "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                                        "publicKeys": [{
                                            "algorithm":                    "?",
                                            "format":                       "?",
                                            "value":                        "?",
                                        }]
                                    }]
        
                                }],

                            }]

                        }],

                        "chargingSessions": [{

                            "@id":                  "1554181214441:-1965658344385548683:2",
                            "@context":             "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json",
                            "begin":                "?",
                            "end":                  "?",
                            "EVSEId":               "DE*GEF*EVSE*CHARGY*1",

                            "authorizationStart": {
                                "@id":                     identificationData ?? "?",
                                "type":                    identificationType,
                                "identificationStatus":    identificationStatus,
                                "identificationLevel":     identificationLevel,
                                "identificationFlags":     identificationFlags ?? []   // Note: The OCMF documentation expects an empty array!
                            },

                            // "signatureInfos": {
                            //     "hash":             "SHA512",
                            //     "hashTruncation":   "24",
                            //     "algorithm":        "ECC",
                            //     "curve":            "secp192r1",
                            //     "format":           "rs"
                            // },

                            "measurements": [//{

                                // "energyMeterId":    "0901454D48000083E076",
                                // "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                                // "name":             "ENERGY_TOTAL",
                                // "obis":             "0100011100FF",
                                // "unit":             "WATT_HOUR",
                                // "unitEncoded":      30,
                                // "valueType":        "Integer64",
                                // "scale":            -1,
            
                                // "signatureInfos": {
                                //     "hash":            "SHA512",
                                //     "hashTruncation":  "24",
                                //     "algorithm":       "ECC",
                                //     "curve":           "secp192r1",
                                //     "format":          "rs"
                                // },

                                // "values": [
                                // {
                                //     "timestamp":        "2019-04-02T07:00:19+02:00",
                                //     "value":            "66260",
                                //     "infoStatus":       "08",
                                //     "secondsIndex":     65058,
                                //     "paginationId":     "00000012",
                                //     "logBookIndex":     "0006",
                                //     "signatures": [{
                                //         "r":    "71F76A80F170F87675AAEB19606BBD298355FDA7B0851700",
                                //         "s":    "2FAD322FA073255BD8B971BD69BFF051BCA9330703172E3C"
                                //     }]
                                // },
                                // {
                                //     "timestamp":        "2019-04-02T07:13:52+02:00",
                                //     "value":            "67327",
                                //     "infoStatus":       "08",
                                //     "secondsIndex":     65871,
                                //     "paginationId":     "00000013",
                                //     "logBookIndex":     "0006",
                                //     "signatures": [{
                                //         "r":    "6DF01D7603CB49BB76141F8E67B371351BF1F87C1F8D38AE",
                                //         "s":    "B3600A9432B8CE0A378126D4FB9D9581457651A5D208AD9E"
                                //     }]
                                // }
                            ]

                        }],

                        "certainty":        1

                    };

                    for (const ocmfJSONDocument of OCMFJSONDocuments)
                    {

                        // ToDo: Validate the pagination!

                        for (const reading of ocmfJSONDocument.payload.RD)
                        {

                            //#region Data

                            const time                   = reading.TM;
                            const transaction            = reading.TX;
                            const readingValue           = reading.RV;
                            const readingIdentification  = reading.RI;
                            const readingUnit            = reading.RU;
                            const readingCurrentType     = reading.RT;
                            const cumulatedLoss          = reading.CL;
                            const errorFlags             = reading.EF;
                            const status                 = reading.ST;

                            //#endregion

                            if (chargyLib.isMandatoryString  (time)                  &&
                                chargyLib.isOptionalString   (transaction)           &&
                                chargyLib.isMandatoryDecimal (readingValue)          &&   // Note: Some vendors use a JSON string here!
                                chargyLib.isOptionalString   (readingIdentification) &&
                                chargyLib.isMandatoryString  (readingUnit)           &&
                                chargyLib.isOptionalString   (readingCurrentType)    &&
                                chargyLib.isOptionalDecimal  (cumulatedLoss)         &&
                                chargyLib.isOptionalString   (errorFlags)            &&
                                chargyLib.isOptionalString   (status))
                            {

                                //#region Meter Reading Validation

                                const timeSplit           = time.split(" ");

                                if (timeSplit.length != 2) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid time format!"),
                                    certainty: 0
                                }

                                const timeRegEx           = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2},\d{3}[+-]\d{4}$/;
                                const timeStamp           = timeSplit[0];

                                if (!chargyLib.isMandatoryString (timeStamp) || !timeRegEx.test(timeStamp)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid time sync format!"),
                                    certainty: 0
                                }

                                const timeStampISO8601    = this.convertToISO8601(timeStamp);
                                const timeSync            = timeSplit[1];

                                if (!chargyLib.isMandatoryString (timeSync) || !["U", "I", "S", "R"].includes(timeSync)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid time sync format!"),
                                    certainty: 0
                                }

                                if (transaction != null && !["B", "C", "X", "E", "L", "R", "A", "P", "S", "T"].includes(transaction)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid transaction type!"),
                                    certainty: 0
                                }

                                if (!["kWh", "Wh", "mOhm", "uOhm"].includes(readingUnit)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid current type!"),
                                    certainty: 0
                                }

                                if (readingCurrentType != null && !["AC", "DC"].includes(readingCurrentType)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid current type!"),
                                    certainty: 0
                                }

                                //#endregion

                                if (CTR!.chargingSessions?.[0]?.begin === "?")
                                    CTR!.chargingSessions![0]!.begin = timeStampISO8601;

                                CTR!.chargingSessions![0]!.end = timeStampISO8601;

                                // ToDo: There might be multiple OBIS meter readings per timestamp!
                                if (CTR!.chargingSessions![0]!.measurements.length == 0)
                                    CTR!.chargingSessions![0]!.measurements.push({
                                        "name":             chargyLib.OBIS2MeasurementName(readingIdentification ?? ""),
                                        "scale":            1,      // Fix me!
                                        "energyMeterId":    meterSerial,
                                        "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                                        "obis":             readingIdentification ?? "?",   // OBIS: "1-b:1.8.0"
                                        "unit":             readingUnit,                    // "kWh"
                                        "currentType":      readingCurrentType,             // "AC"
                                        "values":           []
                                    });

                                CTR!.chargingSessions![0]!.measurements[0]!.values.push({
                                    "timestamp":         timeStampISO8601,            // "2019-06-26T08:57:44,337+0000"
                                    "timeSync":          timeSync,                    // "U"|"I"|"S"|"R"
                                    "transaction":       transaction,                 // "B"|"C"|"X"|"E"|"L"|"R"|"A"|"P"|"S"|"T"|null
                                    "value":             new Decimal(readingValue),   // 2935.6
                                    "transactionType":   transactionType,             // "T"     ToDo: Serialize this to a string!
                                    "pagination":        pagination,                  // "9289"
                                    "errorFlags":        errorFlags,                  // ""
                                    "cumulatedLoss":     cumulatedLoss                // 0.0
                                                                ? new Decimal(cumulatedLoss)
                                                                : undefined,
                                    "status":            status,                      // "G"
                                    "signatures": [{
                                        "value":             ocmfJSONDocument.signature["SD"]
                                    }]
                                });

                            }

                        }
                    }

                    if (CTR.chargingSessions        != null &&
                        CTR.chargingSessions.length  > 0    &&
                        CTR.chargingSessions[0]     != null)
                    {

                        CTR.begin = CTR.chargingSessions[0].begin;
                        CTR.end   = CTR.chargingSessions[0].end;

                        return CTR;

                    }

                }

            }

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Invalid OCMF data: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

        return {
            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            certainty:  0
        }

    }

    //#endregion


    //#region (private) mergeOCMFSessions(CTRs)

    private mergeOCMFSessions(CTRs: Array<IOCMFChargeTransparencyRecord>): IOCMFChargeTransparencyRecord
    {

        const mergedCTR:IOCMFChargeTransparencyRecord = {
            "@id":       "",
            "@context":  "",
            certainty:    1
        };

        for (const ctr of CTRs)
        {

            if (mergedCTR["@id"] === "")
                mergedCTR["@id"] = ctr["@id"];

            if (mergedCTR["@context"] === "")
                mergedCTR["@context"] = ctr["@context"];

            if (!mergedCTR.begin || (mergedCTR.begin && ctr.begin && mergedCTR.begin > ctr.begin))
                mergedCTR.begin = ctr.begin;

            if (!mergedCTR.end || (mergedCTR.end && ctr.end && mergedCTR.end < ctr.end))
                mergedCTR.end = ctr.end;

            if (!mergedCTR.description)
                mergedCTR.description = ctr.description;

            //ToDo: Is this a really good idea? Or should we fail, whenever this information is different?
            if (!mergedCTR.contract)
                mergedCTR.contract = ctr.contract;


            if (!mergedCTR.chargingStationOperators)
                mergedCTR.chargingStationOperators = ctr.chargingStationOperators;
            else if (ctr.chargingStationOperators)
                for (const chargingStationOperator of ctr.chargingStationOperators)
                    mergedCTR.chargingStationOperators.push(chargingStationOperator);

            if (!mergedCTR.chargingPools)
                mergedCTR.chargingPools = ctr.chargingPools;
            else if (ctr.chargingPools)
                for (const chargingPool of ctr.chargingPools)
                    mergedCTR.chargingPools.push(chargingPool);

            if (!mergedCTR.chargingStations)
                mergedCTR.chargingStations = ctr.chargingStations;
            else if (ctr.chargingStations)
                for (const chargingStation of ctr.chargingStations)
                    mergedCTR.chargingStations.push(chargingStation);

            // publicKeys

            if (!mergedCTR.chargingSessions)
                mergedCTR.chargingSessions = ctr.chargingSessions;
            else if (ctr.chargingSessions)
                for (const chargingSession of ctr.chargingSessions)
                    mergedCTR.chargingSessions.push(chargingSession);

            if (!mergedCTR.eMobilityProviders)
                mergedCTR.eMobilityProviders = ctr.eMobilityProviders;
            else if (ctr.eMobilityProviders)
                for (const eMobilityProvider of ctr.eMobilityProviders)
                    mergedCTR.eMobilityProviders.push(eMobilityProvider);

            if (!mergedCTR.mediationServices)
                mergedCTR.mediationServices = ctr.mediationServices;
            else if (ctr.mediationServices)
                for (const mediationService of ctr.mediationServices)
                    mergedCTR.mediationServices.push(mediationService);

        }

        return mergedCTR;

    }

    //#endregion

    //#region (private) mergeChargeTransparencyRecords(CTRs)

    private mergeChargeTransparencyRecords(CTRs: Array<IOCMFChargeTransparencyRecord>): IOCMFChargeTransparencyRecord
    {

        const mergedCTR:IOCMFChargeTransparencyRecord = {
            "@id":       "",
            "@context":  "",
            certainty:    1
        };

        for (const ctr of CTRs)
        {

            if (mergedCTR["@id"] === "")
                mergedCTR["@id"] = ctr["@id"];

            if (mergedCTR["@context"] === "")
                mergedCTR["@context"] = ctr["@context"];

            if (!mergedCTR.begin || (mergedCTR.begin && ctr.begin && mergedCTR.begin > ctr.begin))
                mergedCTR.begin = ctr.begin;

            if (!mergedCTR.end || (mergedCTR.end && ctr.end && mergedCTR.end < ctr.end))
                mergedCTR.end = ctr.end;

            if (!mergedCTR.description)
                mergedCTR.description = ctr.description;

            //ToDo: Is this a really good idea? Or should we fail, whenever this information is different?
            if (!mergedCTR.contract)
                mergedCTR.contract = ctr.contract;


            if (!mergedCTR.chargingStationOperators)
                mergedCTR.chargingStationOperators = ctr.chargingStationOperators;
            else if (ctr.chargingStationOperators)
                for (const chargingStationOperator of ctr.chargingStationOperators)
                    mergedCTR.chargingStationOperators.push(chargingStationOperator);

            if (!mergedCTR.chargingPools)
                mergedCTR.chargingPools = ctr.chargingPools;
            else if (ctr.chargingPools)
                for (const chargingPool of ctr.chargingPools)
                    mergedCTR.chargingPools.push(chargingPool);

            if (!mergedCTR.chargingStations)
                mergedCTR.chargingStations = ctr.chargingStations;
            else if (ctr.chargingStations)
                for (const chargingStation of ctr.chargingStations)
                    mergedCTR.chargingStations.push(chargingStation);

            // publicKeys

            if (!mergedCTR.chargingSessions)
                mergedCTR.chargingSessions = ctr.chargingSessions;
            else if (ctr.chargingSessions)
                for (const chargingSession of ctr.chargingSessions)
                    mergedCTR.chargingSessions.push(chargingSession);

            if (!mergedCTR.eMobilityProviders)
                mergedCTR.eMobilityProviders = ctr.eMobilityProviders;
            else if (ctr.eMobilityProviders)
                for (const eMobilityProvider of ctr.eMobilityProviders)
                    mergedCTR.eMobilityProviders.push(eMobilityProvider);

            if (!mergedCTR.mediationServices)
                mergedCTR.mediationServices = ctr.mediationServices;
            else if (ctr.mediationServices)
                for (const mediationService of ctr.mediationServices)
                    mergedCTR.mediationServices.push(mediationService);

        }

        return mergedCTR;

    }

    //#endregion


    //#region (private) validateOCMFSignature(OCMFJSONDocument, PublicKey)

    private async validateOCMFSignature(OCMFJSONDocument:  ocmfTypes.IOCMFJSONDocument,
                                        PublicKey:         string|chargyInterfaces.IPublicKeyXY): Promise<chargyInterfaces.VerificationResult>
    {

        // Note: We could also get the ECC curve from the DER-encoded public key!

        try
        {

            //#region Setup crypto

            const plaintext  = JSON.stringify(OCMFJSONDocument.payload);

            let   curve      = null;
            let   publicKey  = null;
            let   hashValue  = null;
            let   signature  = null;

            try
            {

                switch (OCMFJSONDocument.signature.SA)
                {

                    case "ECDSA-secp192k1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        break;

                    case "ECDSA-secp256k1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        break;

                    case "ECDSA-secp256k1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        break;

                    case "ECDSA-secp192r1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        break;

                    case "ECDSA-brainpool256r1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        break;

                    case "ECDSA-secp384r1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        curve      = new this.chargy.elliptic.ec('p384');
                        break;

                    case "ECDSA-brainpool384r1-SHA256":
                        hashValue  = (await chargyLib.sha256(plaintext));
                        break;

                    default: // ECDSA-secp256r1-SHA256
                        hashValue  = (await chargyLib.sha256(plaintext));
                        curve      = new this.chargy.elliptic.ec('p256');
                        break;

                }

            }
            catch (exception)
            {
                OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.UnknownSignatureFormat;
                return OCMFJSONDocument.validationStatus;
            }

            //#endregion

            //#region Parse the public key

            try
            {

                //#region Public Key from string

                OCMFJSONDocument.publicKey ??= PublicKey;

                if (typeof OCMFJSONDocument.publicKey === 'string')
                {

                    // Define an ASN.1 structure for an ECC public key
                    const ECPoint = this.chargy.asn1.define('ECPoint', function () {
                        //@ts-ignore
                        this.seq().obj(
                            //@ts-ignore
                            this.key('algorithm').seq().obj(
                                //@ts-ignore
                                this.key('id').objid(),
                                //@ts-ignore
                                this.key('curve').objid()
                            ),
                            //@ts-ignore
                            this.key('pubKey').bitstr()
                        );
                    });

                    // We assume the public key is encoded the same way as the signature!
                    let bufferEncoding: BufferEncoding = 'hex';

                    switch (OCMFJSONDocument.signature.SE?.toLowerCase() ?? "")
                    {

                        case "":
                            break;

                        case "hex":
                            bufferEncoding = 'hex';
                            break;

                        case 'base64':
                            bufferEncoding = 'base64';
                            break;

                        default:
                            OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.UnknownPublicKeyFormat;
                            return OCMFJSONDocument.validationStatus;

                    }

                    // Parse the DER-encoded public key
                    const publicKeyASN1  = ECPoint.decode(Buffer.from(OCMFJSONDocument.publicKey, bufferEncoding), 'der');

                                           // "1.2.840.10045.2.1"   => ECDSA and ECDH Public Key, https://www.alvestrand.no/objectid/1.2.840.10045.2.1.html
                    const _id            = publicKeyASN1.algorithm.id.join('.');

                                           // "1.2.840.10045.3.1.7" => ECC (NIST) P-256 / secp256r1, https://www.alvestrand.no/objectid/1.2.840.10045.3.1.7.html
                    const _curve         = publicKeyASN1.algorithm.curve.join('.');

                    // Assuming the public key is an uncompressed point
                    // The first byte is 0x04 (indicating an uncompressed point), followed by the x and y coordinates
                    const coordinates    = publicKeyASN1.pubKey.data.slice(1); // Remove the first byte
                    const halfLength     = coordinates.length / 2;
                    const publicKeyXY    = {
                                               x: coordinates.slice(0, halfLength).toString('hex'),
                                               y: coordinates.slice(   halfLength).toString('hex')
                                           }
                                           // Will fail when the public key does not match the curve!
                    publicKey            = curve.keyFromPublic(publicKeyXY, 'hex');

                    OCMFJSONDocument.publicKey = {
                                                     algorithm:   OCMFJSONDocument.signature.SA!,
                                                     format:      'XY',
                                                     value:       OCMFJSONDocument.publicKey,
                                                     x:           publicKeyXY.x,
                                                     y:           publicKeyXY.y
                                                 };

                }

                //#endregion

                //#region Public Key from XY

                else if (chargyInterfaces.isIPublicKeyXY(OCMFJSONDocument.publicKey))
                {
                    publicKey  = curve.keyFromPublic({
                                     x:   OCMFJSONDocument.publicKey.x,
                                     y:   OCMFJSONDocument.publicKey.y
                                 }, 'hex');
                }

                //#endregion

            }
            catch (exception)
            {
                OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.InvalidPublicKey;
                return OCMFJSONDocument.validationStatus;
            }

            //#endregion

            //#region Parse the signature

            try
            {

                // Define an ASN.1 structure for an ECDSA signature
                const ECDSASignature = this.chargy.asn1.define('ECDSASignature', function () {
                    //@ts-ignore
                    this.seq().obj(
                        //@ts-ignore
                        this.key('r').int(),
                        //@ts-ignore
                        this.key('s').int()
                    );
                });

                let bufferEncoding: BufferEncoding = 'hex';

                switch (OCMFJSONDocument.signature.SE?.toLowerCase() ?? "")
                {

                    case "":
                        break;

                    case "hex":
                        bufferEncoding = 'hex';
                        break;

                    case 'base64':
                        bufferEncoding = 'base64';
                        break;

                    default:
                        OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.UnknownSignatureFormat;
                        return OCMFJSONDocument.validationStatus;

                }

                // Parse the DER-encoded signature
                const signatureObj = ECDSASignature.decode(Buffer.from(OCMFJSONDocument.signature.SD, bufferEncoding), 'der');

                // Extract the r and s components of the signature
                signature = {
                    r: signatureObj.r.toString(16),
                    s: signatureObj.s.toString(16)
                };

            }
            catch (exception)
            {
                OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.InvalidSignature;
                return OCMFJSONDocument.validationStatus;
            }

            //#endregion

            //#region Verify the signature

            try
            {

                OCMFJSONDocument.validationStatus = publicKey.verify(hashValue, signature)
                                                        ? chargyInterfaces.VerificationResult.ValidSignature
                                                        : chargyInterfaces.VerificationResult.InvalidSignature;

                return OCMFJSONDocument.validationStatus;

            }
            catch (exception)
            {
                OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.InvalidSignature;
                return OCMFJSONDocument.validationStatus;
            }

            //#endregion

        }
        catch (exception)
        {
            OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.InvalidSignature;
            return OCMFJSONDocument.validationStatus;
        }

    }

    //#endregion

    //#region (private) parseAndConvertOCMF(OCMFValues, PublicKey?, ContainerInfos?)

    private parseAndConvertOCMF(OCMFValues:       string[],
                                PublicKey?:       string|chargyInterfaces.IPublicKeyXY,
                                ContainerInfos?:  any): ocmfTypes.IOCMFJSONDocument[] | string
    {

        // OCMF can be on a singe line or on multiple lines even within the embedded JSON!
        // Only for calculating the signature, the OCMF data must be on a single line!

        // OCMF|<payload>|<signature>
        //
        // OCMF|{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}
        //
        // OCMF|
        // {"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|
        // {"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}

        // Multiple OCMF documents within a text are possible, e.g. for signed START and STOP meter values of a charging session:
        //
        // OCMF|<payload1>|<signature1>
        // OCMF|<payload2>|<signature2>
        //
        // OCMF|
        // <payload1>|
        // <signature1>
        // OCMF|
        // <payload2>|
        // <signature2>

        const combinedOCMF       = OCMFValues.join('\n');

        let   ocmfStructure      =  0;
        let   ocmfPayload:any    = {};
        let   ocmfSignature:any  = {};

        let   depth              =  0;
        let   startIndex         = -1;
        let   endIndex           = -1;

        let   ocmfJSONDocuments: Array<ocmfTypes.IOCMFJSONDocument> = [];

        try
        {

            for (let i = 0; i < combinedOCMF.length; i++)
            {

                if (ocmfStructure   == 0 &&
                    i               >= 3 &&
                    combinedOCMF[i] === 'F' && combinedOCMF[i-1] === 'M' && combinedOCMF[i-2] === 'C' && combinedOCMF[i-3] === 'O')
                {
                    ocmfStructure = 1;
                    continue;
                }

                if (ocmfStructure == 1 || ocmfStructure == 3)
                {
                    if (combinedOCMF[i] === '|') {
                        ocmfStructure++;
                        continue;
                    }
                }

                if (ocmfStructure == 2 || ocmfStructure == 4)
                {

                    if (combinedOCMF[i] === '{')
                    {

                        depth++;

                        if (depth === 1)
                            startIndex = i;

                        continue;

                    }

                    if (combinedOCMF[i] === '}')
                    {

                        depth--;

                        if (depth === 0)
                        {

                            endIndex = i;

                            if (startIndex !== -1 && endIndex !== -1) {

                                if (ocmfStructure == 2)
                                {
                                    try
                                    {
                                        ocmfPayload   = JSON.parse(combinedOCMF.substring(startIndex, endIndex + 1));
                                    }
                                    catch (exception)
                                    {
                                        return "The " + (ocmfJSONDocuments.length + 1) + ". OCMF payload is not a valid JSON document!";
                                    }
                                }

                                if (ocmfStructure == 4)
                                {

                                    try
                                    {
                                        ocmfSignature = JSON.parse(combinedOCMF.substring(startIndex, endIndex + 1));
                                    }
                                    catch (exception)
                                    {
                                        return "The " + (ocmfJSONDocuments.length + 1) + ". OCMF signature is not a valid JSON document!";
                                    }

                                    ocmfJSONDocuments.push({
                                        "@context":        "OCMF",
                                        payload:            ocmfPayload,
                                        signature:          ocmfSignature,
                                        publicKey:          PublicKey,
                                        validationStatus:   chargyInterfaces.VerificationResult.Unvalidated
                                    });

                                }

                            }

                            ocmfStructure++;

                            if (ocmfStructure == 5)
                                ocmfStructure = 0;

                            continue;

                        }

                    }

                }

            }

            return ocmfJSONDocuments.length > 0
                      ? ocmfJSONDocuments
                      : "No valid OCMF data found!";

        }
        catch (exception)
        {

            if (exception instanceof Error)
                return exception.message;

            if (typeof exception === 'string')
                return exception;

            return "Unknown error!";

        }

    }

    //#endregion

    //#region TryToParseOCMF(OCMFValues, PublicKey?, ContainerInfos?)

    public async TryToParseOCMF(OCMFValues:       string|string[],
                                PublicKey?:       string|chargyInterfaces.IPublicKeyXY,
                                ContainerInfos?:  any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        //#region Data

        if (OCMFValues.length == 0) return {
             status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
             message:   this.chargy.GetLocalizedMessage("The given OCMF data could not be parsed") + "!",
             certainty: 0
         }

        const ocmfGroups  = new Map<String, Array<ocmfTypes.IOCMFJSONDocument>>();
        const ocmfCTRs    = new Array<IOCMFChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>();

        //#endregion

        const ocmfJSONDocuments = this.parseAndConvertOCMF(
                                      typeof OCMFValues === 'string'
                                          ? [ OCMFValues ]
                                          : OCMFValues,
                                      PublicKey,
                                      ContainerInfos
                                  );

        if (typeof ocmfJSONDocuments !== 'string')
        {

            //#region Group OCMF data

            for (const ocmfJSONDocument of ocmfJSONDocuments)
            {
                try
                {

                    const groupingKey    = (ocmfJSONDocument.payload.FV ?? "") + "|" +
                                           (ocmfJSONDocument.payload.GI ?? "") + "|" +
                                           (ocmfJSONDocument.payload.GS ?? "") + "|" +
                                           (ocmfJSONDocument.payload.GV ?? "") + "|" +

                                           (ocmfJSONDocument.payload.MV ?? "") + "|" +
                                           (ocmfJSONDocument.payload.MM ?? "") + "|" +
                                            ocmfJSONDocument.payload.MS        + "|" +
                                           (ocmfJSONDocument.payload.MF ?? "") + "|" +

                                           (ocmfJSONDocument.payload.IS ? "1|" : "0|") +
                                           (ocmfJSONDocument.payload.IL ?? "") + "|" +
                                           (ocmfJSONDocument.payload.IF ?? "") + "|" +
                                            ocmfJSONDocument.payload.IT        + "|" +
                                           (ocmfJSONDocument.payload.ID ?? "") + "|" +
                                           (ocmfJSONDocument.payload.TT ?? "") + "|" +

                                           (ocmfJSONDocument.payload.CF ?? "") + "|" +

                                           (ocmfJSONDocument.payload.CT ?? "") + "|" +
                                           (ocmfJSONDocument.payload.CI ?? "");

                    if (!ocmfGroups.has(groupingKey))
                        ocmfGroups.set(groupingKey, new Array<ocmfTypes.IOCMFJSONDocument>());

                    ocmfGroups.get(groupingKey)!.push(ocmfJSONDocument);

                }
                catch (exception)
                {
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   this.chargy.GetLocalizedMessage("The given OCMF data could not be parsed") + ": " + exception,
                        certainty: 0
                    }
                }
            }

            //#endregion

            //ToDo: Order groups by timestamp!
            for (const ocmfGroup of ocmfGroups.values())
            {

                if (PublicKey)
                    for (const ocmfJSON of ocmfGroup)
                        await this.validateOCMFSignature(ocmfJSON, PublicKey);

                // Switch over the Firmware Version of the first OCMF within the group
                switch (ocmfGroup[0]!.payload.FV)
                {

                    // case "0.1":
                    //     return await this.tryToParseOCMFv0_1(ocmfDataList as ocmfTypes.IOCMFData_v0_1[], PublicKey);

                    case "1.0":
                        ocmfCTRs.push(await this.tryToParseOCMFv1_0(ocmfGroup, PublicKey, ContainerInfos));
                        break;

                    default:
                        ocmfCTRs.push({
                            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                            message:   this.chargy.GetLocalizedMessage("Unknown OCMF version!"),
                            certainty: 0
                        });
                        break;

                }

            }

            if (ocmfCTRs.length > 0 && ocmfCTRs[0])
                return ocmfCTRs[0];

        }

        return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   this.chargy.GetLocalizedMessage("The given OCMF data could not be parsed") + ": " + ocmfJSONDocuments,
            certainty: 0
        }

    }

    //#endregion


    //#region Helpers

    private convertToISO8601(timestamp: string): string {
        return timestamp.replace(',', '.').replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');
    }

    //#endregion

}
