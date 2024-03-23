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

    public async tryToParseOCMFv1_0(OCMFDataList:  ocmfTypes.IOCMFData_v1_0_Signed[],
                                    PublicKey?:    string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            var CTR:any = {

                "@id":       "1554181214441:-1965658344385548683:2",
                "@context":  "https://open.charging.cloud/contexts/CTR+json",
                "begin":     "2019-04-02T05:00:19Z",
                "end":       "2019-04-02T05:13:52Z",
                "description": {
                    "de":        "Alle OCMF-Ladevorgänge"
                },
                "contract": {
                    "@id":       "8057F5AA592904",
                    "type":      "RFID_TAG_ID",
                    "username":  "",
                    "email":     ""
                },

                "EVSEs": [{
                    "@id": "DE*BDO*E8025334492*2",
                    "meters": [{
                        "@id":              "0901454D48000083E076",
                        "vendor":           "EMH",
                        "vendorURL":        "http://www.emh-metering.de",
                        "model":            "eHZ IW8E EMH",
                        "hardwareVersion":  "1.0",
                        "firmwareVersion":  "123",
                        "signatureFormat":  "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                        "publicKeys": [{
                            "algorithm":        "secp192r1",
                            "format":           "DER",
                            "value":            "049EA8697F5C3126E86A37295566D560DE8EA690325791C9CBA79D30612B8EA8E00908FBAD5374812D55DCC3D809C3A36C",
                        }]
                    }]

                }],

                "chargingSessions": [{

                    "@id":                  "1554181214441:-1965658344385548683:2",
                    "@context":             "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json",
                    "begin":                null,
                    "end":                  null,
                    "EVSEId":               "DE*BDO*E8025334492*2",

                    "authorizationStart": {
                        "@id":              "8057F5AA592904",
                        "type":             "RFID_TAG_ID"
                    },

                    "signatureInfos": {
                        "hash":             "SHA512",
                        "hashTruncation":   "24",
                        "algorithm":        "ECC",
                        "curve":            "secp192r1",
                        "format":           "rs"
                    },

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

                }]

             //   }]
            };

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

                const formatVersion                 = ocmf.measurements?.FV;    // Format Version:         Optional version of the data format in the representation.
                const gatewayInformation            = ocmf.measurements?.GI;    // Gateway Identification: Optional identifier of the manufacturer for the system which has generated the present data (manufacturer, model, variant, etc.).
                const gatewaySerial                 = ocmf.measurements?.GS;    // Gateway Serial:         Serial number of the above mentioned system. This field is conditionally mandatory.
                const gatewayVersion                = ocmf.measurements?.GV;    // Gateway Version:        Optional version designation of the manufacturer for the software of the above mentioned system.

                //#endregion

                //#region Pagination

                const paging                        = ocmf.measurements?.PG;    // Pagination of the entire data set, i.e. the data that is combined in one signature. Format: <indicator><number>
                                                                                //     The string is composed of an identifying letter for the context and a number without leading zeros. There is a separate independent pagination counter for each context. The following indicators are defined:
                                                                                //     T: Transaction – readings in transaction reference    (mandatory)
                                                                                //     F: Fiscal      – readings independent of transactions (optional)
                                                                                //     The respective pagination counter is incremented after each use for a record.

                //#endregion

                //#region Meter Identification

                const meterVendor                   = ocmf.measurements?.MV;    // Meter Vendor:           Optional manufacturer identification of the meter, name of the manufacturer.
                const meterModel                    = ocmf.measurements?.MM;    // Meter Model:            Optional model identification of the meter.
                const meterSerial                   = ocmf.measurements?.MS;    // Meter Serial:           Serial number of the meter.
                const meterFirmware                 = ocmf.measurements?.MF;    // Meter Firmware:         Optional firmware version of the meter.

                //#endregion

                //#region User Assignment

                const identificationStatus          = ocmf.measurements?.IS;    // Identification Status:  General status for user assignment:
                                                                                //                             true:  user successfully assigned
                                                                                //                             false: user not assigned
                const identificationLevel           = ocmf.measurements?.IL;    // Identification Level:   Optional encoded overall status of the user assignment, represented by an identifier:
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
                const identificationFlags           = ocmf.measurements?.IF;    // Identification Flags:   An enumeration of detailed statements about the user assignment, represented by one or more identifiers.
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
                const identificationType            = ocmf.measurements?.IT;    // Identification Type:    Type of identification data, identifier:
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
                const identificationData            = ocmf.measurements?.ID;    // Identification Data:    The optional actual identification data according to the Identification Type, e.g. a hex-coded UID according to ISO 14443.
                const tariffText                    = ocmf.measurements?.TT;    // Tariff Text:            An optional textual description used to identify a unique tariff. This field is intended for the tariff designation in "Direct Payment" use case.

                //#endregion

                //#region EVSE Metrologic parameters

                const lossCompensation              = ocmf.measurements?.LC;    // Loss Compensation:      Optional characteristics of EVSE's charging cable used for identifying and processing cable loss compensation algorithm.
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

                const chargePointIdType             = ocmf.measurements?.CT;    // Identification Type:    Optional type of the specification for the identification of the charge point, identifier see table 18.
                                                                                //                         Identifier   Description
                                                                                //                         ------------ ----------------------------------------------------------------------------------------------------------
                                                                                //                         EVSEID       EVSE ID
                                                                                //                         CBIDC        Charge box ID and connector ID according to OCPP, a space is used as field separator, e.g. „STEVE_01 1“.
                const chargePointId                 = ocmf.measurements?.CI;    // Identification:         Optional identification information for the charge point.

                //#endregion

                if (chargyLib.isOptionalString         (formatVersion)        &&
                    chargyLib.isOptionalString         (gatewayInformation)   &&
                    chargyLib.isOptionalString         (gatewaySerial)        &&
                    chargyLib.isOptionalString         (gatewayVersion)       &&

                    chargyLib.isMandatoryString        (paging)               &&

                    chargyLib.isOptionalString         (meterVendor)          &&
                    chargyLib.isOptionalString         (meterModel)           &&
                    chargyLib.isMandatoryString        (meterSerial)          &&
                    chargyLib.isOptionalString         (meterFirmware)        &&

                    chargyLib.isMandatoryBoolean       (identificationStatus) &&
                    chargyLib.isOptionalString         (identificationLevel)  &&
                    chargyLib.isMandatoryArrayOfStrings(identificationFlags)  &&
                    chargyLib.isMandatoryString        (identificationType)   &&
                    chargyLib.isOptionalString         (identificationData)   &&
                    chargyLib.isOptionalString         (tariffText)           &&

                    chargyLib.isOptionalJSONObject     (lossCompensation)     &&

                    chargyLib.isOptionalString         (chargePointIdType)    &&
                    chargyLib.isOptionalString         (chargePointId)        )
                {

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

                    if (!ocmf.measurements.RD || ocmf.measurements.RD.length == 0) return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   this.chargy.GetLocalizedMessage("Each OCMF data set must have at least one meter reading!"),
                        certainty: 0
                    }

                    for (const reading of ocmf.measurements.RD)
                    {

                        let metaTimestamp       = reading.TM.split(' ');
                        let Timestamp           = metaTimestamp[0];
                        let TimeStatus          = metaTimestamp[1];

                        let Transaction         = reading.TX;   // B|C,X|E,L,R,A,P|S|T | null
                        let Value               = reading.RV;   // typeof RV == 'number', but MUST NOT be rounded!
                        let OBIS                = reading.RI;   // OBIS-Code
                        let Unit                = reading.RU;   // Reading-Unit: kWh, ...
                        let CurrentType         = reading.RT;   // Reading-Current-Type
                        let ErrorFlags          = reading.EF;   // Error-Flags
                        let Status              = reading.ST;   // Status

                        if (CTR.chargingSessions[0].begin == null)
                            CTR.chargingSessions[0].begin = Timestamp;

                        CTR.chargingSessions[0].end = Timestamp;

                        if (CTR.chargingSessions[0].measurements.length == 0)
                            CTR.chargingSessions[0].measurements.push({
                                "energyMeterId":    meterSerial,
                                "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                                "obis":             OBIS,        // "1-b:1.8.0"
                                "unit":             Unit,        // "kWh"
                                "currentType":      CurrentType, // "AC"
                                "values":           []
                            });

                        CTR.chargingSessions[0].measurements[0].values.push({
                            "timestamp":        Timestamp,          // "2019-06-26T08:57:44,337+0000"
                            "timeStatus":       TimeStatus,         // "U"
                            "transaction":      Transaction,        // "B"
                            "value":            Value,              // 2935.6
                            "transactionType":  transactionType,    // "T"
                            "pagination":       pagination,         // "9289"
                            "errorFlags":       ErrorFlags,         // ""
                            "status":           Status,             // "G"
                            "signatures": [{
                                "value": ocmf.signature["SD"]
                            }]
                        });

                    }

                    CTR.begin = CTR.chargingSessions[0].begin;
                    CTR.end   = CTR.chargingSessions[0].end;

                    CTR.chargingSessions[0].authorizationStart["@id"]  = ocmf.measurements.ID;
                    CTR.chargingSessions[0].authorizationStart["type"] = ocmf.measurements.IT;
                    CTR.chargingSessions[0].authorizationStart["IS"]   = ocmf.measurements.IS;
                    CTR.chargingSessions[0].authorizationStart["IL"]   = ocmf.measurements.IL;
                    CTR.chargingSessions[0].authorizationStart["IF"]   = ocmf.measurements.IF;

                }

                return CTR;

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


}
