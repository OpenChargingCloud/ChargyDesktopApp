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

import * as chargyInterfaces  from './chargyInterfaces'
import Decimal                from "decimal.js"

export const enum OCMFTransactionTypes
{
    undefined,
    fiscal,
    transaction
}

export const enum TimeStatusTypes {
    unknown,
    informative,
    syncronized,
    relative
}

export interface IOCMFLossCompensation {
    LN?:        string,
    LI?:        string,
    LR:         string,
    LU:         string
}

export interface IOCMFReading {

    // "RD": [{
    //     "TM": "2019-06-26T08:57:44,337+0000 U",
    //     "TX": "B",
    //     "RV": 268.978,
    //     "RI": "1-b:1.8.0",
    //     "RU": "kWh",
    //     "RT": "AC",
    //     "EF": "",
    //     "ST": "G"
    // }]

    TM:         string,                 // Time:                          Specification to the system time of the reading and synchronization state.
                                        //                                The time is described according to ISO 8601 with a resolution of milliseconds. Accordingly, the format is according to the following scheme:
                                        //                                <yyyy>-<MM>-<dd>T<HH>:<mm>:<ss>,<fff><Time Zone> => 2018-07-24T13:22:04,000+0200
                                        //                                The indication of the time zone consists of a sign and a four-digit indication for hours and minutes.
                                        //                                The synchronization state consists of a capital letter as identifier. This is added to the time, separated by a space:
                                        //
                                        //                                    Identifier   Description
                                        //                                    ------------ ------------------------------------------------------------------------------------------------------
                                        //                                    U            unknown, unsynchronized
                                        //                                    I            informative (info clock)
                                        //                                    S            synchronized
                                        //                                    R            relative time accounting with a calibration law accurate time, based on an info clock.
                                        //                                                 That means, at the beginning of the charging process, a time with informative quality was available.
                                        //                                                 During the charging process, the time (duration) was recorded in accordance with the legal metrology
                                        //                                                 requirements.

    TX?:        string,                 // Transaction:                   Meter reading reason, reference of meter reading to transaction, noted as capital letter:
                                        //                                    B – Begin of transaction
                                        //                                    C – Charging = during charging (can be used optionally)
                                        //                                    X – Exception = Error during charging, transaction continues, time and/or energy are no longer usable from this reading (incl.).
                                        //                                    E – End of transaction, alternatively more precise codes:
                                        //                                    L – Charging process was terminated locally
                                        //                                    R – Charging process was terminated remotely
                                        //                                    A – (Abort) Charging process was aborted by error
                                        //                                    P – (Power) Charging process was terminated by power failure
                                        //                                    S – Suspended = Transaction active, but currently not charging (can be used optionally)
                                        //                                    T – Tariff change
                                        //                                This field is missing if there is no transaction reference (Fiscal Metering).

    RV?:        Decimal,                // Reading Value:                 The value of the meter reading.
                                        //                                Here the JSON data format Number is used, this allows among other things an exact marking of the valid decimal places.
                                        //                                However, the representation must not be transformed by further handling methods (e.g. processing by JSON parser)
                                        //                                (rewriting the number with a different exponent, truncation of decimal places, etc.) since this would change the
                                        //                                representation of the physical quantity and thus potentially the number of valid digits. According to the application
                                        //                                rule, it is recommended to represent the measured value with two decimal places of accuracy, if it is kWh.

    RI?:        string,                 // Reading Identification:        Optional identifier, which quantity was read, according to OBIS code.

    RU?:        string,                 // Reading-Unit:                  Unit of reading, e.g. "kWh", "Wh", "mOhm", "uOhm"

    RT?:        string,                 // Reading-Current-Type:          The optional type of current measured by the meter, e.g. "AC", "DC"

    CL?:        Number,                 // Cumulated Loss:                This parameter is optional and can be added only when RI is indicating an accumulation register reading. The value
                                        //                                reported here represents cumulated loss withdrawned from measurement when computing loss compensation on RV.
                                        //                                CL must be reset at TX=B. CL is given in the same unit as RV which is specified in RU.

    EF?:        string,                 // Error Flags:                   Optional statement about which quantities are no longer usable for billing due to an error. Each character in this
                                        //                                string identifies a quantity. The following characters are defined: "E" – Energy, "t" – Time

    ST:         string                  // Status:                        State of the meter at the time of reading. Noted as abbreviation according to:
                                        //
                                        //                                    Value   Identifier      Description
                                        //                                    ------- --------------- --------------------------------------------------------------------------------
                                        //                                    N       NOT_PRESENT     The meter is not present or has not been found
                                        //                                    G       OK              Meter is working correctly (Good)
                                        //                                    T       TIMEOUT         Timeout when trying to control the meter
                                        //                                    D       DISCONNECTED    Meter was disconnected from the signature component
                                        //                                    R       NOT_FOUND       Meter no longer found (has already been found at least once before) (Removed)
                                        //                                    M       MANIPULATED     Manipulation detected
                                        //                                    X       EXCHANGED       Meter exchanged (serial number no longer matches the last known one)
                                        //                                    I       INCOMPATIBLE    Meter version or its API not compatible with signature component
                                        //                                    O       OUT_OF_RANGE    Read value outside the value range
                                        //                                    S       SUBSTITUTE      A substitute value was formed
                                        //                                    E       OTHER_ERROR     Other, not further known error
                                        //                                    F       READ_ERROR      Meter register not read correctly; value of the readout is not valid

}

export interface IOCMFSignature {

    // {
    //   "SA": "ECDSA-secp256r1-SHA256",
    //   "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
    // }

    SA?:        string,                 // Signature Algorithm:           Optionally selects the algorithm used to create the signature. This includes the signature algorithm, its parameters, and the hash algorithm
                                        //                                that will be applied to the data to be signed. If it is omitted, the default value is effective.
                                        //                                ECDSA-secp256r1-SHA256 is the default since OCMF Version 0.4.
                                        //
                                        // Identifier                         Signature Algorithm   Curve Name and Synonyms                                       Key Length   Hash Algorithm   Block Length
                                        // ---------------------------------- --------------------- ------------------------------------------------------------- ------------ ---------------- --------------
                                        // ECDSA-secp192k1-SHA256             ECDSA                 secp192k1                                                     192 bit      SHA-256          48
                                        // ECDSA-secp256k1-SHA256             ECDSA                 secp256k1                                                     256 bit      SHA-256          64
                                        // ECDSA-secp192r1-SHA256             ECDSA                 secp192r1                                                     192 bit      SHA-256          48
                                        // ECDSA-secp256r1-SHA256 (default)   ECDSA                 secp256r1, NIST P-256, ANSI X9.62 elliptic curve prime256v1   256 bit      SHA-256          64
                                        // ECDSA-brainpool256r1-SHA256        ECDSA                 brainpool256r1                                                256 bit      SHA-256          64
                                        // ECDSA-secp384r1-SHA256             ECDSA                 secp384r1, NIST P-384, ANSI X9.62 elliptic curve prime384v1   384 bit      SHA-256          96
                                        // ECDSA-brainpool384r1-SHA256        ECDSA                 brainpool384r1                                                384 bit      SHA-256          96

                                        // Note: The hash algorithms for 384++ key lengths should be SHA-384 and SHA-512, not SHA-256 to match the security levels of the official crypto standards!

    SE?:        string,                 // Signature Encoding:            Optionally indicates how the signature data is encoded to be stored in the JSON string.
                                        //                                If it is omitted, the default value is effective.
                                        //                                The following values are possible:
                                        //                                    hex:                 The signature data is represented in the JSON string in hexadecimal encoding (default)
                                        //                                    base64:              The signature data is base64 encoded in the JSON string.

    SM?:        string,                 // Signature Mime Type:           Optionally indicates how the signature data is to be interpreted.
                                        //                                If it is omitted, the default value is effective.
                                        //                                The following values are possible:
                                        //                                    application/x-der:   DER encoded ASN.1 structure (default)

    SD:         string                  // Signature Data:                The actual signature data according to the format specification above.


    //#region Components in subsequent processing of data

    A?:         any,                    // Any JSON property starting with "A" is reserved for components in subsequent processing of data.
    B?:         any,                    // Any JSON property starting with "B" is reserved for components in subsequent processing of data.
    C?:         any,                    // Any JSON property starting with "C" is reserved for components in subsequent processing of data.
    D?:         any,                    // Any JSON property starting with "D" is reserved for components in subsequent processing of data.
    E?:         any,                    // Any JSON property starting with "E" is reserved for components in subsequent processing of data.
    F?:         any,                    // Any JSON property starting with "F" is reserved for components in subsequent processing of data.

    //#endregion

    //#region Manufacturer Specific Data

    U?:         any,                    // Any JSON property starting with "U" is reserved for manufacturer-specific data.
    V?:         any,                    // Any JSON property starting with "V" is reserved for manufacturer-specific data.
    W?:         any,                    // Any JSON property starting with "W" is reserved for manufacturer-specific data.
    X?:         any,                    // Any JSON property starting with "X" is reserved for manufacturer-specific data.
    Y?:         any,                    // Any JSON property starting with "Y" is reserved for manufacturer-specific data.
    Z?:         any,                    // Any JSON property starting with "Z" is reserved for manufacturer-specific data.

    //#endregion

}

export interface IOCMFPayload {

    // Source: https://github.com/SAFE-eV/OCMF-Open-Charge-Metering-Format/blob/master/OCMF-en.md

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
    //     "RD": [...]
    //
    // }

    //#region General Information

    FV?:        string,                 // Format Version:                Optional version of the data format in the representation.
                                        //                                The version specification is coded according to the version of this document, i.e. 0.4 corresponds to major 0 and minor 4.
                                        //                                The revision (third digit) is not transmitted, since this does not change anything in the format itself.
    GI?:        string,                 // Gateway Identification:        Optional identifier of the manufacturer for the system which has generated the present data (manufacturer, model, variant, etc.).
    GS?:        string,                 // Gateway Serial:                Optional serial number of the above mentioned system. This field is __conditionally mandatory__!
    GV?:        string,                 // Gateway Version:               Optional version designation of the manufacturer for the software of the above mentioned system.

    //#endregion

    //#region Pagination

    PG:         string,                 // Pagination:                    Pagination of the entire data set, i.e. the data that is combined in one signature. Format: <indicator><number>
                                        //                                The string is composed of an identifying letter for the context and a number without leading zeros.
                                        //                                There is a separate independent pagination counter for each context.
                                        //                                The following indicators are defined:
                                        //                                    T: Transaction       Readings in transaction reference    (mandatory)
                                        //                                    F: Fiscal            Readings independent of transactions (optional)
                                        //                                The respective pagination counter is incremented after each use for a record.

    //#endregion

    //#region Meter Identification

    MV?:        string,                 // Meter Vendor:                  Optional manufacturer identification of the meter, name of the manufacturer.
    MM?:        string,                 // Meter Model:                   Optional model identification of the meter.
    MS:         string,                 // Meter Serial:                  Serial number of the meter.
    MF?:        string,                 // Meter Firmware:                Optional firmware version of the meter.

    //#endregion

    //#region User Assignment

    IS:         boolean,                // Identification Status:         General status for user assignment:
                                        //                                    true:                User successfully assigned
                                        //                                    false:               User not assigned

    IL?:        string,                 // Identification Level:          Optional encoded overall status of the user assignment, represented by an identifier:
                                        //
                                        //                                  Group                        Status/Error    Description
                                        //                                ------------------------------ --------------- ----------------------------------------------------------------------------------------
                                        //                                  not available                -               The field is not specified.
                                        //                                  status without assignment    NONE            There is no user assignment. The other data for user assignment have no significance.
                                        //                                  status with assignment       HEARSAY         The assignment is unsecured; e.g. by reading an RFID UID.
                                        //                                                               TRUSTED         The mapping can be trusted to some extent, but there is no absolute reliability.
                                        //                                                                               Example: Authorization by backend.
                                        //                                                               VERIFIED        The assignment has been verified by the signature component and special measures.
                                        //                                                               CERTIFIED       The assignment was verified by the signature component using a cryptographic signature
                                        //                                                                               that certifies the assignment.
                                        //                                                               SECURE          The mapping was established by a secure feature
                                        //                                                                               (e.g. secure RFID card, ISO 15118 with plug and charge, etc.).
                                        //                                  Error                        MISMATCH        Error; UIDs do not match.
                                        //                                                               INVALID         Error; certificate not correct (check negative).
                                        //                                                               OUTDATED        Error; referenced trust certificate expired.
                                        //                                                               UNKNOWN         Certificate could not be successfully verified (no matching trust certificate found).

    IF?:        string[],               // Identification Flags:          An optional enumeration of detailed statements about the user assignment, represented by one or more identifiers.
                                        //                                The identifiers are always noted as string elements in an array.
                                        //                                Also one or no element must be noted as an array.
                                        //
                                        //                                Note: Some vendors send a null value in the case of an empty array, others do not sent the field at all.
                                        //
                                        //                                    RFID_NONE        No assignment via RFID
                                        //                                    RFID_PLAIN       Assignment via external RFID card reader
                                        //                                    RFID_RELATED     Assignment via protected RFID card reader
                                        //                                    RFID_PSK         A previously known shared key (pre-shared key) was used, e.g. with a secured RFID card.
                                        //
                                        //                                    OCPP_NONE        No user assignment by OCPP
                                        //                                    OCPP_RS          Assignment by OCPP RemoteStart method
                                        //                                    OCPP_AUTH        Assignment by OCPP Authorize method
                                        //                                    OCPP_RS_TLS      Assignment by OCPP RemoteStart method, obtained via a secured TLS connection.
                                        //                                    OCPP_AUTH_TLS    Assignment by OCPP Authorize method, obtained via a secured TLS connection.
                                        //                                    OCPP_CACHE       Assignment by authorization cache of OCPP
                                        //                                    OCPP_WHITELIST   Assignment by whitelist from OCPP
                                        //                                    OCPP_CERTIFIED   A certificate of the backend was used which certifies the user mapping.
                                        //
                                        //                                    ISO15118_NONE    no user assignment by ISO 15118
                                        //                                    ISO15118_PNC     Plug & Charge was used
                                        //
                                        //                                    PLMN_NONE        no user assignment
                                        //                                    PLMN_RING        call
                                        //                                    PLMN_SMS         short message

    IT:         string,                 // Identification Type:           Describes the possible types of user mappings, which can be used in the Type field as unsigned integer in the Type field.
                                        //                                These mappings are based on the specifications from OCPP. OCPP currently (version 1.5) only provides 20 characters for the
                                        //                                identification feature. In accordance with the maximum length of an IBAN (34 characters) allocations of up to 40 bytes
                                        //                                have been provided for the data area.
                                        //
                                        //                                    Token    Identifier      Description
                                        //                                    -------  --------------- -------------------------------------------------------
                                        //                                     0       NONE            No assignment available
                                        //                                     1       DENIED          Assignment currently not available (due to two-factor a
                                        //                                     2       UNDEFINED       Type not specified
                                        //                                    10       ISO14443        UID of an RFID card according to ISO 14443. Represented
                                        //                                    11       ISO15693        UID of an RFID card according to ISO 15693. Represented
                                        //                                    20       EMAID           Electro-Mobility-Account-ID according to ISO/IEC 15118 
                                        //                                    21       EVCCID          ID of an electric vehicle according to ISO/IEC 15118 (m
                                        //                                    30       EVCOID          EV Contract ID according to DIN 91286.
                                        //                                    40       ISO7812         Identification card format according to ISO/IEC 7812 (c
                                        //                                    50       CARD_TXN_NR     Card transaction number (CardTxNbr) for a payment with 
                                        //                                    60       CENTRAL         Centrally generated ID. No exact format defined, can be
                                        //                                    61       CENTRAL_1       Centrally generated ID, e.g. by start via SMS. No exact
                                        //                                    62       CENTRAL_2       Centrally generated ID, e.g. by operator start. No exac
                                        //                                    70       LOCAL           Locally generated ID. No exact format defined, might be
                                        //                                    71       LOCAL_1         Locally generated ID, e.g. ID generated internally by t
                                        //                                    72       LOCAL_2         Locally generated ID, for other cases. No exact format 
                                        //                                    80       PHONE_NUMBER    International phone number with leading "+".
                                        //                                    90       KEY_CODE        User-related private key code. No exact format defined.

    ID?:        string,                 // Identification Data:           The actual identification data according to the <Identification Type>, e.g. a hex-coded UID according to ISO 14443.

    TT?:        string,                 // Tariff Text:                   An optional textual description used to identify a unique tariff.
                                        //                                This field is intended for the tariff designation in "Direct Payment" use case.

    //#endregion

    //#region EVSE Metrologic parameters

    CF?:        string,                 // Controller Firmware:           Firmware version of the charge controller on the EVSE.
                                        //                                This optional value is, e.g., required by (some) notified bodies to ensure traceability of any OCMF data set to the
                                        //                                documentation of the corresponding Schalt-Mess-Koordination ("switch-measure-coordination").

    LC?:        IOCMFLossCompensation,  // Loss Compensation:             Optional characteristics of EVSE's charging cable used for identifying and processing cable loss compensation algorithm.
                                        //                                The cable loss data consists in an object under the key "LC". It shall contain Cable Resistance value and may contain optional traceability
                                        //                                parameters, as explained in following table.
                                        //
                                        //                                    Key  Type            Cardinality     Description
                                        //                                    --   --------------  --------------  ---------------------------------------------------------------------------------------------------------------------------------
                                        //                                    LN   String (0..20)  0..1            Optional Loss compensation Naming
                                        //                                                                             A meter can use this value for adding a traceability text for justifying cable loss characteristics.
                                        //                                    LI   Number          0..1            Optional Loss compensation Identification
                                        //                                                                             A meter can use this value for adding a traceability ID number for justifying cable loss characteristics
                                        //                                                                             from a lookup table specified in meter's documentation.
                                        //                                    LR   Number          1..1            Loss compensation cable Resistance
                                        //                                                                             A meter shall use this value for specifying the cable resistance value used in cable Loss compensation computation.
                                        //                                    LU   Number          1..1            Loss compensation cable resistance Unit
                                        //                                                                             A meter shall use this field for specifying the unit of cable resistance value given by LR field used in cable loss
                                        //                                                                             compensation computation. The unit of this value can be traced in OCMF format in addition to meter's documentation.
                                        //                                                                             Allowed values are milliohm or microohm:
                                        //                                                                             - The LU value for milliohm shall be "mOhm".
                                        //                                                                             - The LU value for microohm shall be "µOhm".

    //#endregion

    //#region Assignment of the Charge Point

    CT?:        string,                 // Charge Point Type:             Optional type of the specification for the identification of the charge point:
                                        //
                                        //                                    Identifier   Description
                                        //                                    ------------ ----------------------------------------------------------------------------------------------------------
                                        //                                    EVSEID       EVSE ID
                                        //                                    CBIDC        Charge box ID and connector ID according to OCPP, a space is used as field separator, e.g. „STEVE_01 1“.

    CI?:        string,                 // Charge Point Identification:   Optional identification information for the charge point.

    //#endregion

    //#region Readings

    RD:         Array<IOCMFReading>,

    //#endregion


    //#region Manufacturer Specific Data

    U?:         any,                    // Any JSON property starting with "U" is reserved for manufacturer-specific data.
    V?:         any,                    // Any JSON property starting with "V" is reserved for manufacturer-specific data.
    W?:         any,                    // Any JSON property starting with "W" is reserved for manufacturer-specific data.
    X?:         any,                    // Any JSON property starting with "X" is reserved for manufacturer-specific data.
    Y?:         any,                    // Any JSON property starting with "Y" is reserved for manufacturer-specific data.
    Z?:         any,                    // Any JSON property starting with "Z" is reserved for manufacturer-specific data.

    //#endregion

}

// OCMF as a well-defined JSON document
export interface IOCMFJSONDocument {

    "@context":          string|string[],

    raw?:                string,        // The raw OCMF document is used for visualization only.
    rawPayload?:         string,        // The raw OCMF payload can be used for calculating the signature, as OCMF does
                                        // not define a canonical format for calculating the signature which prevents a
                                        // meaningful interoperability of the signature verification process!
                                        // When the payload JSON was canonicalized, the rawPayload field is not needed.
    hashAlgorithm?:      string,
    hashValue?:          string,

    payload:             IOCMFPayload,
    signature:           IOCMFSignature,
    signatureRS?:        chargyInterfaces.ISignatureRS,
    publicKey?:          string|chargyInterfaces.IPublicKeyXY,

    validationStatus?:   chargyInterfaces.VerificationResult

}
