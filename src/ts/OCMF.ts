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
import { createDecipheriv } from 'crypto';


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

    private async tryToParseOCMFv0_1(OCMFDataList:  ocmfTypes.IOCMFData_v0_1,
                                     PublicKey?:    string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        // {
        //     "FV": "0.1",
        //     "VI": "ABL",
        //     "VV": "1.4p3",
        //
        //     "PG": "T12345",
        //
        //     "MV": "Phoenix Contact",
        //     "MM": "EEM-350-D-MCB",
        //     "MS": "BQ27400330016",
        //     "MF": "1.0",
        //
        //     "IS": "VERIFIED",
        //     "IF": ["RFID_PLAIN", "OCPP_RS_TLS"],
        //     "IT": "ISO14443",
        //     "ID": "1F2D3A4F5506C7",
        //
        //     "RD": [{
        //         "TM": "2018-07-24T13:22:04,000+0200 S",
        //         "TX": "B",
        //         "RV": 2935.6,
        //         "RI": "1-b:1.8.e",
        //         "RU": "kWh",
        //         "EI": 567,
        //         "ST": "G"
        //     }]
        // }

        try
        {

            let VendorInformation  :string = OCMFDataList.VI != null ? OCMFDataList.VI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the vendor.
            let VendorVersion      :string = OCMFDataList.VV != null ? OCMFDataList.VV.trim() : ""; // Software version of the vendor.

            let paging             :string = OCMFDataList.PG != null ? OCMFDataList.PG.trim() : ""; // Paging, as this data might be part of a larger context.
            let transactionType     = ocmfTypes.OCMFTransactionTypes.undefined;
            switch (paging[0]?.toLowerCase())
            {

                case 't':
                    transactionType = ocmfTypes.OCMFTransactionTypes.transaction;
                    break;

                case 'f':
                    transactionType = ocmfTypes.OCMFTransactionTypes.fiscal;
                    break

            }
            let pagingId            = paging.substring(1);

            let MeterVendor        :string = OCMFDataList.MV != null ? OCMFDataList.MV.trim() : ""; // Vendor of the device, optional.
            let MeterModel         :string = OCMFDataList.MM != null ? OCMFDataList.MM.trim() : ""; // Model of the device, optional.
            let MeterSerial        :string = OCMFDataList.MS != null ? OCMFDataList.MS.trim() : ""; // Serialnumber of the device, might be optional.
            let MeterFirmware      :string = OCMFDataList.MF != null ? OCMFDataList.MF.trim() : ""; // Software version of the device.

            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                certainty: 0
            }

        } catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

    }

    //#endregion

    //#region tryToParseOCMFv1_0(OCMFDataList, PublicKey?)

    public async tryToParseOCMFv1_0(OCMFDataList:     ocmfTypes.IOCMFData_v1_0_Signed[],
                                    PublicKey?:       string,
                                    ContainerInfos?:  any) : Promise<IOCMFChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            // {
            //
            //     "payload": {
            //
            //       "FV": "1.0",
            //       "GI": "SEAL AG",
            //       "GS": "1850006a",
            //       "GV": "1.34",
            //
            //       "PG": "T9289",
            //
            //       "MV": "Carlo Gavazzi",
            //       "MM": "EM340-DIN.AV2.3.X.S1.PF",
            //       "MS": "******240084S",
            //       "MF": "B4",
            //
            //       "IS": true,
            //       "IL": "TRUSTED",
            //       "IF": ["OCCP_AUTH"],
            //       "IT": "ISO14443",
            //       "ID": "56213C05",
            //
            //       "RD": [{
            //           "TM": "2019-06-26T08:57:44,337+0000 U",
            //           "TX": "B",
            //           "RV": 268.978,
            //           "RI": "1-b:1.8.0",
            //           "RU": "kWh",
            //           "RT": "AC",
            //           "EF": "",
            //           "ST": "G"
            //       }]
            //
            //     },
            //
            //     "signature": {
            //       "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
            //     }
            //
            // }

            for (let ocmf of OCMFDataList)
            {

                // https://github.com/SAFE-eV/OCMF-Open-Charge-Metering-Format/blob/master/OCMF-en.md

                //#region General Information

                const formatVersion                 = ocmf.payload?.FV;    // Format Version:         Optional version of the data format in the representation.
                const gatewayInformation            = ocmf.payload?.GI;    // Gateway Identification: Optional identifier of the manufacturer for the system which has generated the present data (manufacturer, model, variant, etc.).
                const gatewaySerial                 = ocmf.payload?.GS;    // Gateway Serial:         Serial number of the above mentioned system. This field is conditionally mandatory.
                const gatewayVersion                = ocmf.payload?.GV;    // Gateway Version:        Optional version designation of the manufacturer for the software of the above mentioned system.

                //#endregion

                //#region Pagination

                const paging                        = ocmf.payload?.PG;    // Pagination of the entire data set, i.e. the data that is combined in one signature. Format: <indicator><number>
                                                                                //     The string is composed of an identifying letter for the context and a number without leading zeros. There is a separate independent pagination counter for each context. The following indicators are defined:
                                                                                //     T: Transaction – readings in transaction reference    (mandatory)
                                                                                //     F: Fiscal      – readings independent of transactions (optional)
                                                                                //     The respective pagination counter is incremented after each use for a record.

                //#endregion

                //#region Meter Identification

                const meterVendor                   = ocmf.payload?.MV;    // Meter Vendor:           Optional manufacturer identification of the meter, name of the manufacturer.
                const meterModel                    = ocmf.payload?.MM;    // Meter Model:            Optional model identification of the meter.
                const meterSerial                   = ocmf.payload?.MS;    // Meter Serial:           Serial number of the meter.
                const meterFirmware                 = ocmf.payload?.MF;    // Meter Firmware:         Optional firmware version of the meter.

                //#endregion

                //#region User Assignment

                const identificationStatus          = ocmf.payload?.IS;    // Identification Status:  General status for user assignment:
                                                                                //                             true:  user successfully assigned
                                                                                //                             false: user not assigned
                const identificationLevel           = ocmf.payload?.IL;    // Identification Level:   Optional encoded overall status of the user assignment, represented by an identifier:
                                                                                //                             Group                        Status/Error    Description
                                                                                //                           ------------------------------ --------------- ----------------------------------------------------------------------------------------
                                                                                //                             not available                -               The field is not specified.
                                                                                //                             status without assignment    NONE            There is no user assignment. The other data for user assignment have no significance.
                                                                                //                             status with assignment       HEARSAY         The assignment is unsecured; e.g. by reading an RFID UID.
                                                                                //                                                          TRUSTED         The mapping can be trusted to some extent, but there is no absolute reliability.
                                                                                //                                                                          Example: Authorization by backend.
                                                                                //                                                          VERIFIED        The assignment has been verified by the signature component and special measures.
                                                                                //                                                          CERTIFIED       The assignment was verified by the signature component using a cryptographic signature
                                                                                //                                                                          that certifies the assignment.
                                                                                //                                                          SECURE          The mapping was established by a secure feature
                                                                                //                                                                          (e.g. secure RFID card, ISO 15118 with plug and charge, etc.).
                                                                                //                             Error                        MISMATCH        Error; UIDs do not match.
                                                                                //                                                          INVALID         Error; certificate not correct (check negative).
                                                                                //                                                          OUTDATED        Error; referenced trust certificate expired.
                                                                                //                                                          UNKNOWN         Certificate could not be successfully verified (no matching trust certificate found).
                const identificationFlags           = ocmf.payload?.IF;    // Identification Flags:   An enumeration of detailed statements about the user assignment, represented by one or more identifiers.
                                                                                //                         The identifiers are always noted as string elements in an array.
                                                                                //                         Also one or no element must be noted as an array.
                                                                                //
                                                                                //                         RFID_NONE        No assignment via RFID
                                                                                //                         RFID_PLAIN       Assignment via external RFID card reader
                                                                                //                         RFID_RELATED     Assignment via protected RFID card reader
                                                                                //                         RFID_PSK         A previously known shared key (pre-shared key) was used, e.g. with a secured RFID card.
                                                                                //
                                                                                //                         OCPP_NONE        No user assignment by OCPP
                                                                                //                         OCPP_RS          Assignment by OCPP RemoteStart method
                                                                                //                         OCPP_AUTH        Assignment by OCPP Authorize method
                                                                                //                         OCPP_RS_TLS      Assignment by OCPP RemoteStart method, obtained via a secured TLS connection.
                                                                                //                         OCPP_AUTH_TLS    Assignment by OCPP Authorize method, obtained via a secured TLS connection.
                                                                                //                         OCPP_CACHE       Assignment by authorization cache of OCPP
                                                                                //                         OCPP_WHITELIST   Assignment by whitelist from OCPP
                                                                                //                         OCPP_CERTIFIED   A certificate of the backend was used which certifies the user mapping.
                                                                                //
                                                                                //                         ISO15118_NONE    no user assignment by ISO 15118
                                                                                //                         ISO15118_PNC     Plug & Charge was used
                                                                                //
                                                                                //                         PLMN_NONE        no user assignment
                                                                                //                         PLMN_RING        call
                                                                                //                         PLMN_SMS         short message
                const identificationType            = ocmf.payload?.IT;    // Identification Type:    Type of identification data, identifier:
                                                                                //                         describes the possible types of user mappings, which can be used in the Type field as unsigned integer in the Type field.
                                                                                //                         These mappings are based on the specifications from OCPP. OCPP currently (version 1.5) only provides 20 characters for the
                                                                                //                         identification feature. In accordance with the maximum length of an IBAN (34 characters) allocations of up to 40 bytes
                                                                                //                         have been provided for the data area.
                                                                                //                         Token    Identifier      Description
                                                                                //                         -------  --------------- ---------------------------------------------------------------------------------------------------
                                                                                //                          0       NONE            No assignment available
                                                                                //                          1       DENIED          Assignment currently not available (due to two-factor authorization)
                                                                                //                          2       UNDEFINED       Type not specified
                                                                                //                         10       ISO14443        UID of an RFID card according to ISO 14443. Represented as 4 or 7 bytes in hexadecimal notation.
                                                                                //                         11       ISO15693        UID of an RFID card according to ISO 15693. Represented as 8 bytes in hexadecimal notation.
                                                                                //                         20       EMAID           Electro-Mobility-Account-ID according to ISO/IEC 15118 (string with length 14 or 15)
                                                                                //                         21       EVCCID          ID of an electric vehicle according to ISO/IEC 15118 (maximum length 6 characters)
                                                                                //                         30       EVCOID          EV Contract ID according to DIN 91286.
                                                                                //                         40       ISO7812         Identification card format according to ISO/IEC 7812 (credit and bank cards, etc.)
                                                                                //                         50       CARD_TXN_NR     Card transaction number (CardTxNbr) for a payment with credit or bank card used in a terminal at the charging point.
                                                                                //                         60       CENTRAL         Centrally generated ID. No exact format defined, can be e.g. a UUID. (OCPP 2.0)
                                                                                //                         61       CENTRAL_1       Centrally generated ID, e.g. by start via SMS. No exact format defined. (until OCPP 1.6)
                                                                                //                         62       CENTRAL_2       Centrally generated ID, e.g. by operator start. No exact format defined. (until OCPP 1.6)
                                                                                //                         70       LOCAL           Locally generated ID. No exact format defined, might be e.g. a UUID. (OCPP 2.0)
                                                                                //                         71       LOCAL_1         Locally generated ID, e.g. ID generated internally by the charge point. No exact format defined. (until OCPP 1.6)
                                                                                //                         72       LOCAL_2         Locally generated ID, for other cases. No exact format defined. (until OCPP 1.6)
                                                                                //                         80       PHONE_NUMBER    International phone number with leading "+".
                                                                                //                         90       KEY_CODE        User-related private key code. No exact format defined.
                const identificationData            = ocmf.payload?.ID;    // Identification Data:    The optional actual identification data according to the Identification Type, e.g. a hex-coded UID according to ISO 14443.
                const tariffText                    = ocmf.payload?.TT;    // Tariff Text:            An optional textual description used to identify a unique tariff. This field is intended for the tariff designation in "Direct Payment" use case.

                //#endregion

                //#region EVSE Metrologic parameters

                const lossCompensation              = ocmf.payload?.LC;    // Loss Compensation:      Optional characteristics of EVSE's charging cable used for identifying and processing cable loss compensation algorithm.
                                                                                //                         The cable loss data consists in an object under the key "LC". It shall contain Cable Resistance value and may contain optional traceability
                                                                                //                         parameters, as explained in following table.
                                                                                //                         Key  Type            Cardinality     Description
                                                                                //                         --   --------------  --------------  ---------------------------------------------------------------------------------------------------------------------------------
                                                                                //                         LN   String (0..20)  0..1            Optional Loss compensation Naming
                                                                                //                                                                  A meter can use this value for adding a traceability text for justifying cable loss characteristics.
                                                                                //                         LI   Number          0..1            Optional Loss compensation Identification
                                                                                //                                                                  A meter can use this value for adding a traceability ID number for justifying cable loss characteristics
                                                                                //                                                                  from a lookup table specified in meter's documentation.
                                                                                //                         LR   Number          1..1            Loss compensation cable Resistance
                                                                                //                                                                  A meter shall use this value for specifying the cable resistance value used in cable Loss compensation computation.
                                                                                //                         LU   Number          1..1            Loss compensation cable resistance Unit
                                                                                //                                                                  A meter shall use this field for specifying the unit of cable resistance value given by LR field used in cable loss
                                                                                //                                                                  compensation computation. The unit of this value can be traced in OCMF format in addition to meter's documentation.
                                                                                //                                                                  Allowed values are milliohm or microohm:
                                                                                //                                                                  - The LU value for milliohm shall be "mOhm".
                                                                                //                                                                  - The LU value for microohm shall be "µOhm".

                //#endregion

                //#region Assignment of the Charge Point

                const chargePointIdType             = ocmf.payload?.CT;    // Identification Type:    Optional type of the specification for the identification of the charge point, identifier see table 18.
                                                                                //                         Identifier   Description
                                                                                //                         ------------ ----------------------------------------------------------------------------------------------------------
                                                                                //                         EVSEID       EVSE ID
                                                                                //                         CBIDC        Charge box ID and connector ID according to OCPP, a space is used as field separator, e.g. „STEVE_01 1“.
                const chargePointId                 = ocmf.payload?.CI;    // Identification:         Optional identification information for the charge point.

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

                    if (!ocmf.payload.RD || ocmf.payload.RD.length == 0) return {
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
                            "@id":          identificationData,
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
                            "EVSEId":               "DE*BDO*E8025334492*2",

                            "authorizationStart": {
                                "@id":                     identificationData,
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


                    for (const reading of ocmf.payload.RD)
                    {

                        //#region Data

                        const time                   = reading.TM;  // Time:                    Specification to the system time of the reading and synchronization state.
                                                                    //                          The time is described according to ISO 8601 with a resolution of milliseconds. Accordingly, the format is according to the following scheme:
                                                                    //                          <yyyy>-<MM>-<dd>T<HH>:<mm>:<ss>,<fff><Time Zone> => 2018-07-24T13:22:04,000+0200
                                                                    //                          !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                                                                    //                          !! NOTE: This looks much like ISO 8601, but it is in fact NOT ISO 8601 compliant!     !!
                                                                    //                          !!       "2019-06-26T08:57:44.337+00:00" would be valid ISO 8601, but the OCMF format !!
                                                                    //                          !!       uses ',' instead of '.' as the decimal separator for milliseconds and the    !!
                                                                    //                          !!       time zone is not separated by a colon from the hours and minutes!            !!
                                                                    //                          !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                                                                    //                          The indication of the time zone consists of a sign and a four-digit indication for hours and minutes.
                                                                    //                          The synchronization state consists of a capital letter as identifier. This is added to the time, separated by a space:
                                                                    //                              Identifier   Description
                                                                    //                              ------------ ------------------------------------------------------------------------------------------------------
                                                                    //                              U            unknown, unsynchronized
                                                                    //                              I            informative (info clock)
                                                                    //                              S            synchronized
                                                                    //                              R            relative time accounting with a calibration law accurate time, based on an info clock.
                                                                    //                                           That means, at the beginning of the charging process, a time with informative quality was available.
                                                                    //                                           During the charging process, the time (duration) was recorded in accordance with the legal metrology
                                                                    //                                           requirements.
                        const transaction            = reading.TX;  // Transaction:             Meter reading reason, reference of meter reading to transaction, noted as capital letter:
                                                                    //                              B – Begin of transaction
                                                                    //                              C – Charging = during charging (can be used optionally)
                                                                    //                              X – Exception = Error during charging, transaction continues, time and/or energy are no longer usable from this reading (incl.).
                                                                    //                              E – End of transaction, alternatively more precise codes:
                                                                    //                              L – Charging process was terminated locally
                                                                    //                              R – Charging process was terminated remotely
                                                                    //                              A – (Abort) Charging process was aborted by error
                                                                    //                              P – (Power) Charging process was terminated by power failure
                                                                    //                              S – Suspended = Transaction active, but currently not charging (can be used optionally)
                                                                    //                              T – Tariff change
                                                                    //                          This field is missing if there is no transaction reference (Fiscal Metering).
                        const readingValue           = reading.RV;  // Reading Value:           The value of the meter reading.
                                                                    //                          Here the JSON data format Number is used, this allows among other things an exact marking of the valid decimal places.
                                                                    //                          However, the representation must not be transformed by further handling methods (e.g. processing by JSON parser)
                                                                    //                          (rewriting the number with a different exponent, truncation of decimal places, etc.) since this would change the
                                                                    //                          representation of the physical quantity and thus potentially the number of valid digits. According to the application
                                                                    //                          rule, it is recommended to represent the measured value with two decimal places of accuracy, if it is kWh.
                        const readingIdentification  = reading.RI;  // Reading Identification:  Optional identifier, which quantity was read, according to OBIS code.
                        const readingUnit            = reading.RU;  // Reading-Unit:            Unit of reading, e.g. "kWh", "Wh", "mOhm", "uOhm"
                        const readingCurrentType     = reading.RT;  // Reading-Current-Type:    The optional type of current measured by the meter, e.g. "AC", "DC"
                        const cumulatedLoss          = reading.CL;  // Cumulated Loss:          This parameter is optional and can be added only when RI is indicating an accumulation register reading. The value
                                                                    //                          reported here represents cumulated loss withdrawned from measurement when computing loss compensation on RV.
                                                                    //                          CL must be reset at TX=B. CL is given in the same unit as RV which is specified in RU.
                        const errorFlags             = reading.EF;  // Error Flags:             Optional statement about which quantities are no longer usable for billing due to an error. Each character in this
                                                                    //                          string identifies a quantity. The following characters are defined: "E" – Energy, "t" – Time
                        const status                 = reading.ST;  // Status:                  State of the meter at the time of reading. Noted as abbreviation according to table 10.
                                                                    //                              Value   Identifier      Description
                                                                    //                              ------- --------------- --------------------------------------------------------------------------------
                                                                    //                              N       NOT_PRESENT     The meter is not present or has not been found
                                                                    //                              G       OK              Meter is working correctly (Good)
                                                                    //                              T       TIMEOUT         Timeout when trying to control the meter
                                                                    //                              D       DISCONNECTED    Meter was disconnected from the signature component
                                                                    //                              R       NOT_FOUND       Meter no longer found (has already been found at least once before) (Removed)
                                                                    //                              M       MANIPULATED     Manipulation detected
                                                                    //                              X       EXCHANGED       Meter exchanged (serial number no longer matches the last known one)
                                                                    //                              I       INCOMPATIBLE    Meter version or its API not compatible with signature component
                                                                    //                              O       OUT_OF_RANGE    Read value outside the value range
                                                                    //                              S       SUBSTITUTE      A substitute value was formed
                                                                    //                              E       OTHER_ERROR     Other, not further known error
                                                                    //                              F       READ_ERROR      Meter register not read correctly; value of the readout is not valid

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

                            if (CTR.chargingSessions?.[0]?.begin == null)
                                CTR.chargingSessions![0]!.begin = timeStampISO8601;

                            CTR.chargingSessions![0]!.end = timeStampISO8601;

                            // ToDo: There might be multiple OBIS meter readings per timestamp!
                            if (CTR.chargingSessions![0]!.measurements.length == 0)
                                CTR.chargingSessions![0]!.measurements.push({
                                    "name":             "?",    // Fix me!
                                    "scale":            1,      // Fix me!
                                    "energyMeterId":    meterSerial,
                                    "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                                    "obis":             readingIdentification ?? "?",   // OBIS: "1-b:1.8.0"
                                    "unit":             readingUnit,                    // "kWh"
                                    "currentType":      readingCurrentType,             // "AC"
                                    "values":           []
                                });

                            CTR.chargingSessions![0]!.measurements[0]!.values.push({
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
                                    "value":             ocmf.signature["SD"]
                                }]
                            });

                        }

                    }

                    CTR.begin = CTR.chargingSessions![0]!.begin;
                    CTR.end   = CTR.chargingSessions![0]!.end;

                    return CTR;

                }

            }

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
            message:   "Invalid OCMF data!",
            certainty: 0
        }

    }

    //#endregion


    //#region tryToParseOCMF(OCMFValues, PublicKey?)

    public async tryToParseOCMF(OCMFValues:  string|string[],
                                PublicKey?:  string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        //#region Data

        let commonVersion          = "";
        let ocmfDataList:Object[]  = [];

        if (typeof OCMFValues === 'string')
            OCMFValues = [ OCMFValues ];

        //#endregion

        //#region Parse OCMF value(s)

        for (const ocmfValue of OCMFValues)
        {

            // OCMF|{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}

            if (!ocmfValue.startsWith("OCMF|{"))
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("The given OCMF data does not have a valid header!"),
                    certainty: 0
                }

            const splitIndex = ocmfValue.lastIndexOf("|");

            if (splitIndex == -1)
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("The given OCMF data could not be parsed") + "!",
                    certainty: 0
                }

            try
            {

                //#region Documentation

                // http://hers.abl.de/SAFE/Datenformat_OCMF/Datenformat_OCMF_v1.0.pdf
                // Ein Darstellungsformat, JSON-basiert (nachvollziehbar)
                // Ein Übertragungsformat, JSON-basiert (vereinheitlicht)
                //
                // {
                //     "FV": "1.0",
                //     "GI": "SEAL AG",
                //     "GS": "1850006a",
                //     "GV": "1.34",
                //
                //     "PG": "T9289",
                //
                //     "MV": "Carlo Gavazzi",
                //     "MM": "EM340-DIN.AV2.3.X.S1.PF",
                //     "MS": "******240084S",
                //     "MF": "B4",
                //
                //     "IS": true,
                //     "IL": "TRUSTED",
                //     "IF": ["OCCP_AUTH"],
                //     "IT": "ISO14443",
                //     "ID": "56213C05",
                //
                //     "RD": [{
                //         "TM": "2019-06-26T08:57:44,337+0000 U",
                //         "TX": "B",
                //         "RV": 268.978,
                //         "RI": "1-b:1.8.0",
                //         "RU": "kWh",
                //         "RT": "AC",
                //         "EF": "",
                //         "ST": "G"
                //     }]
                // }
                // {
                //     "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
                // }

                //#endregion

                const ocmfPayload    = JSON.parse(ocmfValue.substring(5, splitIndex));
                const ocmfSignature  = JSON.parse(ocmfValue.substring(splitIndex + 1));
                const ocmfVersion    = ocmfPayload["FV"]?.trim();

                if (Object.keys(ocmfPayload).length === 0) return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("The given OCMF measurements could not be parsed!"),
                    certainty: 0
                }

                if (Object.keys(ocmfSignature).length === 0) return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("The given OCMF signature could not be parsed!"),
                    certainty: 0
                }

                if (!chargyLib.isMandatoryString(ocmfVersion)) return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("The given OCMF data does not have a valid version number!"),
                    certainty: 0
                }

                if (commonVersion == "")
                    commonVersion = ocmfVersion;

                if (ocmfVersion != commonVersion) return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("Invalid mixture of different OCMF versions!"),
                    certainty: 0
                }

                ocmfDataList.push({
                               "payload":    ocmfPayload,
                               "signature":  ocmfSignature
                             });

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

        switch (commonVersion)
        {

            // case "0.1":
            //     return await this.tryToParseOCMFv0_1(ocmfDataList as ocmfTypes.IOCMFData_v0_1[], PublicKey);

            case "1.0":
                return await this.tryToParseOCMFv1_0(ocmfDataList as ocmfTypes.IOCMFData_v1_0_Signed[], PublicKey);

            default:
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("Unknown OCMF version!"),
                    certainty: 0
                }

        }

    }

    //#endregion


    //#region Helpers

    private convertToISO8601(timestamp: string): string {
        return timestamp.replace(',', '.').replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');
    }

    //#endregion


}
