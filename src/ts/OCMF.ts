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


// Note: More information about implementation details and limitations
//       can be found within ~/documentation/OCMF/README.md!

import { Chargy }             from './chargy'
import { ACrypt }             from './ACrypt'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import Decimal                from 'decimal.js';


export interface IOCMFv1_0MeasurementValue extends IOCMFMeasurementValue
{
    statusMeter:                   string,
    secondsIndex:                  number,
    paginationId:                  string,
    logBookIndex:                  string
}

export interface IOCMFv1_0Result extends chargyInterfaces.ICryptoResult
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

export class OCMFv1_x extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy:  Chargy) {
        super("OCMF",
              chargy);
    }


    async VerifyChargingSession(chargingSession: chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        let sessionResult:chargyInterfaces.SessionVerificationResult = chargyInterfaces.SessionVerificationResult.Unvalidated;

        if (chargingSession.measurements)
        {
            for (var measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values && measurement.values.length > 1)
                {

                    //#region Verify measurements...

                    for (var measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IOCMFv1_0MeasurementValue);
                    }

                    //#endregion

                    //#region Find an overall result...

                    for (var measurementValue of measurement.values)
                    {
                        if (measurementValue.result)
                        {
                            switch (measurementValue.result.status)
                            {

                                // Unvalidated
                                // UnknownCTRFormat

                                case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.EnergyMeterNotFound;
                                    break;

                                case chargyInterfaces.VerificationResult.UnknownSignatureFormat:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSignatureFormat;
                                    break;
    
                                case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.PublicKeyNotFound;
                                    break;

                                case chargyInterfaces.VerificationResult.UnknownPublicKeyFormat:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.UnknownPublicKeyFormat;
                                    break;

                                case chargyInterfaces.VerificationResult.InvalidPublicKey:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.InvalidPublicKey;
                                    break;

                                // InvalidMeasurement
                                // InvalidStartValue
                                // InvalidIntermediateValue
                                // InvalidStopValue

                                case chargyInterfaces.VerificationResult.InvalidSignature:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSignature;
                                    break;

                                // NoOperation
                                // StartValue
                                // IntermediateValue
                                // StopValue

                                case chargyInterfaces.VerificationResult.ValidSignature:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;
                                    break;

                                // ValidStartValue
                                // ValidIntermediateValue
                                // ValidStopValue
                                // ValidationError

                            }
                        }

                        if (sessionResult !== chargyInterfaces.SessionVerificationResult.ValidSignature)
                            break;

                    }

                    //#endregion

                }

                else
                    sessionResult = chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }
        }

        return {
            status:    sessionResult,
            certainty: .5
        } ;

    }

    async VerifyMeasurement(measurementValue: IOCMFv1_0MeasurementValue): Promise<IOCMFv1_0Result>
    {

        measurementValue.method = this;

        // The measurement was already verified by the outer OCMF signature!

        return {
            status: measurementValue.result?.status ?? chargyInterfaces.VerificationResult.Unvalidated
        }

    }


    private PayloadDictionary(Path: string, Key: string): string
    {

        if (Path === "RD")
        {
            switch (Key)
            {

                    case "TM":
                        return "Time";

                    case "TX":
                        return "Transaction";

                    case "RV":
                        return "Reading Value";

                    case "RI":
                        return "Reading Identification";

                    case "RU":
                        return "Reading Unit";

                    case "RT":
                        return "Reading Current Type";

                    case "CL":
                        return "Cumulated Loss";

                    case "EF":
                        return "Error Flags";

                    case "ST":
                        return "Status";


                    default:
                        return Key;

            }
        }

        switch (Key)
        {

            case "FV":
                return "Format Version";

            case "GI":
                return "Gateway Identification";

            case "GS":
                return "Gateway Serial";

            case "GV":
                return "Gateway Version";


            case "PG":
                return "Pagination";


            case "MV":
                return "Meter Vendor";

            case "MM":
                return "Meter Model";

            case "MS":
                return "Meter Serial";

            case "MF":
                return "Meter Firmware";


            case "IS":
                return "Identification Status";

            case "IL":
                return "Identification Level";

            case "IF":
                return "Identification Flags";

            case "IT":
                return "Identification Type";

            case "ID":
                return "Identification Data";

            case "TT":
                return "Tariff Text";


            case "LC":
                return "Loss Compensation";


            case "CT":
                return "Charge Point Identification Type";

            case "CI":
                return "Charge Point Identification";


            case "RD":
                return "Reading";


            default:
                return Key;

        }
    }

    private SignatureDictionary(Path: string, Key: string): string
    {
        switch (Key)
        {

            case "SA":
                return "Signature Algorithm";

            case "SE":
                return "Signature Encoding";

            case "SM":
                return "Signature Mime Type";

            case "SD":
                return "Signature Data";


            default:
                return Key;

        }
    }

    async ViewMeasurement(measurementValue:      IOCMFv1_0MeasurementValue,
                          errorDiv:              HTMLDivElement,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)
    {

        if (!measurementValue.measurement  ||
            !measurementValue.ocmfDocument ||
            !measurementValue.measurement.chargingSession)
        {
            return {
                status: chargyInterfaces.VerificationResult.InvalidMeasurement
            }
        }

        //#region Headline / Introduction

        if (introDiv)
        {
            introDiv.innerHTML = this.chargy.GetLocalizedMessage("The following data of the charging session is relevant for metrological and legal metrological purposes and therefore part of the digital signature").
                                             replace("{methodName}",       "OCMFCrypt01").
                                             replace("{cryptoAlgorithm}",   measurementValue.ocmfDocument.publicKey && typeof(measurementValue.ocmfDocument.publicKey) !== 'string'
                                                                                ? "(" + measurementValue.ocmfDocument.publicKey.algorithm + ") "
                                                                                : "");
        }

        //#endregion

        //#region Plain text

        if (PlainTextDiv)
        {

            if (PlainTextDiv.parentElement &&
                PlainTextDiv.parentElement.children[0])
            {
                PlainTextDiv.parentElement.children[0].innerHTML  = this.chargy.GetLocalizedMessage("Plain text") + " (OCMF|&lt;" + this.chargy.GetLocalizedMessage("payload") + "&gt;|&lt;" + this.chargy.GetLocalizedMessage("signature") + "&gt;)";
            }

            PlainTextDiv.innerText = '';

            //#region Compact OCMF document

            const compactValueDiv = document.createElement('div');
            compactValueDiv.className = "compactValue";
            PlainTextDiv.appendChild(compactValueDiv);

            compactValueDiv.innerHTML = '<span class="ocmfHighlight">OCMF</span>' + (measurementValue.ocmfDocument.raw?.substring(4) ?? "");

            const firstIndex = compactValueDiv.innerHTML.indexOf('|');
            if (firstIndex !== -1) {
                compactValueDiv.innerHTML = compactValueDiv.innerHTML.substring(0, firstIndex) + '<span class="ocmfSeparator">|</span>' + compactValueDiv.innerHTML.substring(firstIndex + 1);
            }

            const lastIndex = compactValueDiv.innerHTML.lastIndexOf('|');
            if (lastIndex !== -1 && lastIndex !== firstIndex) { // Überprüfen, dass es nicht das gleiche Vorkommen ist
                compactValueDiv.innerHTML = compactValueDiv.innerHTML.substring(0, lastIndex) + '<span class="ocmfSeparator">|</span><span class="ocmfHighlight">' + compactValueDiv.innerHTML.substring(lastIndex + 1) + '</span>';
            }

            compactValueDiv.style.fontFamily  = "monospace";
            compactValueDiv.style.maxHeight   = "25vh";
            compactValueDiv.style.overflowY   = "scroll";

            compactValueDiv.onclick = () => {
                compactValueDiv.style.display = 'none';
                prettyValueDiv.style.display  = 'block';
            };

            //#endregion

            //#region Pretty printed OCMF document

            const prettyValueDiv = document.createElement('div');
            prettyValueDiv.className = "prettyValue";
            PlainTextDiv.appendChild(prettyValueDiv);

            //prettyValueDiv.style.whiteSpace  = "pre";

            prettyValueDiv.innerHTML = '<span class="ocmfHighlight">OCMF</span><span class="ocmfSeparator">|</span><br />' + chargyLib.jsonPrettyPrinter(measurementValue.ocmfDocument.payload, this.PayloadDictionary) + '<span class="ocmfSeparator">|</span><br />' + chargyLib.jsonPrettyPrinter(measurementValue.ocmfDocument.signature, this.SignatureDictionary);

            prettyValueDiv.onclick = () => {
                compactValueDiv.style.display = 'block';
                prettyValueDiv.style.display  = 'none';
            };

            //#endregion

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv)
        {

            if (HashedPlainTextDiv.parentElement &&
                HashedPlainTextDiv.parentElement.children[0])
            {
                HashedPlainTextDiv.parentElement.children[0].innerHTML = this.chargy.GetLocalizedMessage("Hashed payload") + " (" + measurementValue.ocmfDocument.hashAlgorithm + ")";
            }

            HashedPlainTextDiv.innerHTML  = measurementValue.ocmfDocument.hashValue?.match(/.{1,8}/g)?.join(" ")
                                                ?? "0x00000000000000000000000000000000000";

        }

        //#endregion

        //#region Public key

        if (PublicKeyDiv && measurementValue.ocmfDocument.publicKey)
        {

            if (PublicKeyDiv.parentElement &&
                PublicKeyDiv.parentElement.children[0])
            {

                PublicKeyDiv.parentElement.children[0].innerHTML = typeof measurementValue.ocmfDocument?.publicKey === 'string'
                                                                       ? this.chargy.GetLocalizedMessage("Public Key")
                                                                       : this.chargy.GetLocalizedMessage("Public Key") + " (" + measurementValue.ocmfDocument.publicKey.algorithm + ", " +
                                                                                                                                measurementValue.ocmfDocument.publicKey.encoding + ")";

            }

            PublicKeyDiv.innerHTML = typeof measurementValue.ocmfDocument.publicKey === 'string'
                                         ? measurementValue.ocmfDocument.publicKey
                                         : "der: "           + (measurementValue.ocmfDocument.publicKey.value?.match(/.{1,8}/g)?.join(" ") ?? "-") + "<br /><br />" +
                                           "x:&nbsp;&nbsp; " +  measurementValue.ocmfDocument.publicKey.x.     match(/.{1,8}/g)?.join(" ") + "<br />" +
                                           "y:&nbsp;&nbsp; " +  measurementValue.ocmfDocument.publicKey.y.     match(/.{1,8}/g)?.join(" ");

        }

        //#endregion

        //#region Public key signatures (optional)

        if (PublicKeyDiv &&
            PublicKeyDiv.parentElement &&
            PublicKeyDiv.parentElement.children[3])
        {

            PublicKeyDiv.parentElement.children[3].innerHTML = "";

            const result = measurementValue.result as IOCMFv1_0Result;

            if (!chargyLib.IsNullOrEmpty(result.publicKeySignatures)) {

                for (const signature of result.publicKeySignatures)
                {

                    try
                    {

                        const signatureDiv = PublicKeyDiv.parentElement.children[3].appendChild(document.createElement('div'));

                        if (signatureDiv)
                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(
                                                               measurementValue.measurement.chargingSession?.chargingStation,
                                                               measurementValue.measurement.chargingSession?.EVSE,
                                                               //@ts-ignore
                                                               measurementValue.measurement.chargingSession.EVSE.meters[0],
                                                               //@ts-ignore
                                                               measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys[0],
                                                               signature
                                                           );

                    }
                    catch (exception)
                    { }

                }

            }

        }

        //#endregion

        //#region Signature expected

        if (SignatureExpectedDiv && measurementValue.ocmfDocument?.signature.SD)
        {

            if (SignatureExpectedDiv.parentElement &&
                SignatureExpectedDiv.parentElement.children[0])
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = this.chargy.GetLocalizedMessage("Expected signature") + " (rs, hex)";
            }

            SignatureExpectedDiv.innerHTML = "der: "           +  measurementValue.ocmfDocument?.signature.SD.                                   match(/.{1,8}/g)?.join(" ") + "<br /><br />" +
                                             "r:&nbsp;&nbsp; " + (measurementValue.ocmfDocument?.signatureRS?.r?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") ?? "-") + "<br />" +
                                             "s:&nbsp;&nbsp; " + (measurementValue.ocmfDocument?.signatureRS?.s?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") ?? "-");

        }

        //#endregion

        //#region Signature check

        if (SignatureCheckDiv && measurementValue.measurement.chargingSession.verificationResult)
        {
            switch (measurementValue.measurement.chargingSession.verificationResult.status)
            {

                case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Public key not found") + '</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Invalid public key") + '</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Invalid signature") + '</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.ValidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Valid signature") + '</div>';
                    break;


                default:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + this.chargy.GetLocalizedMessage("Invalid signature") + '</div>';
                    break;

            }
        }

        //#endregion

    }

}



//#region OCMF as a well-defined JSON document

export const enum OCMFTransactionTypes
{
    undefined     = "undefined",
    fiscal        = "fiscal",
    transaction   = "transaction"
}

export const enum TimeStatusTypes {
    unknown       = "unknown",
    informative   = "informative",
    syncronized   = "syncronized",
    relative      = "relative"
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

export interface IOCMFJSONDocument {

    "@context":          string|string[],

    raw?:                string,        // The raw OCMF document is used for visualization only.
    rawPayload?:         string,        // The raw OCMF payload can be used for calculating the signature, as OCMF does
                                        // not define a canonical format for calculating the signature which prevents a
                                        // meaningful interoperability of the signature verification process!
                                        // When the payload JSON was canonicalized, the rawPayload field is not needed.
    hashAlgorithm:       string,
    hashValue:           string,

    payload:             IOCMFPayload,
    signature:           IOCMFSignature,
    signatureRS?:        chargyInterfaces.ISignatureRS,
    publicKey?:          string|chargyInterfaces.IPublicKeyXY,
    publicKeyEncoding?:  string,

    validationStatus?:   chargyInterfaces.VerificationResult

}

//#endregion

//#region OCMF Charge Transparency Record Extensions

export interface IOCMFMeasurementValue extends chargyInterfaces.IMeasurementValue
{
    measurement?:               IOCMFMeasurement;
    timeSync:                   string;
    transaction?:               string;
    transactionType:            OCMFTransactionTypes;
    pagination:                 number;
    errorFlags?:                string;
    cumulatedLoss?:             Decimal;
    status:                     string;
    ocmfDocument?:              IOCMFJSONDocument;
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

//#endregion

export class OCMF {

    private readonly chargy: Chargy;

    constructor(chargy: Chargy) {
        this.chargy  = chargy;
    }

    //#region (private) tryToParseOCMFv1_0(OCMFDataList, PublicKey?)

    private async tryToParseOCMFv1_0(OCMFJSONDocuments:   IOCMFJSONDocument[],
                                     PublicKey?:          string|chargyInterfaces.IPublicKeyXY,
                                     PublicKeyEncoding?:  string,
                                     ContainerInfos?:     any) : Promise<IOCMFChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
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
                    chargyLib.isOptionalString          (chargePointId))
                {

                    //#region Validate pagination and transaction type

                    const paginationPrefix              = paging.length > 0
                                                              ? paging[0]?.toLowerCase()
                                                              : null;
                    const transactionType               = paginationPrefix === 't'
                                                              ? OCMFTransactionTypes.transaction
                                                              : paginationPrefix === 'f'
                                                                    ? OCMFTransactionTypes.fiscal
                                                                    : OCMFTransactionTypes.undefined;
                    const pagination                    = paging.length > 1
                                                              ? chargyLib.parseNumber(paging.substring(1))
                                                              : null;

                    if (transactionType === OCMFTransactionTypes.undefined) return {
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
                                            "encoding":                     "?",
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

                            "measurements": [ ]

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
                                const timeSyncText        = timeSplit[1];
                                let   timeSync            = TimeStatusTypes.unknown;

                                if (!chargyLib.isMandatoryString (timeSyncText) || !["U", "I", "S", "R"].includes(timeSyncText)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid time sync format!"),
                                    certainty: 0
                                }

                                switch (timeSyncText) {

                                    case "U":
                                        timeSync = TimeStatusTypes.unknown;
                                        break;

                                    case "I":
                                        timeSync = TimeStatusTypes.informative;
                                        break;

                                    case "S":
                                        timeSync = TimeStatusTypes.syncronized;
                                        break;

                                    case "R":
                                        timeSync = TimeStatusTypes.relative;
                                        break;

                                    default:
                                        return {
                                            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                            message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid time sync format!"),
                                            certainty: 0
                                        }

                                }

                                if (transaction && !["B", "C", "X", "E", "L", "R", "A", "P", "S", "T"].includes(transaction)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid transaction type!"),
                                    certainty: 0
                                }

                                if (!["kWh", "Wh", "mOhm", "uOhm"].includes(readingUnit)) return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   this.chargy.GetLocalizedMessage("The given OCMF meter value does not have a valid current type!"),
                                    certainty: 0
                                }

                                if (readingCurrentType && !["AC", "DC"].includes(readingCurrentType)) return {
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
                                        "name":            chargyLib.OBIS2MeasurementName(readingIdentification ?? ""),
                                        "scale":           1,      // Fix me!
                                        "energyMeterId":   meterSerial,
                                        "@context":        "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                                        "obis":            readingIdentification ?? "?",   // OBIS: "1-b:1.8.0"
                                        "unit":            readingUnit,                    // "kWh"
                                        "currentType":     readingCurrentType,             // "AC"
                                        "values":          []
                                    });

                                CTR!.chargingSessions![0]!.measurements[0]!.values.push({
                                    "timestamp":           timeStampISO8601,            // "2019-06-26T08:57:44,337+0000"
                                    "timeSync":            timeSync,                    // "U"|"I"|"S"|"R"
                                    "transaction":         transaction,                 // "B"|"C"|"X"|"E"|"L"|"R"|"A"|"P"|"S"|"T"|null
                                    "value":               new Decimal(readingValue),   // 2935.6
                                    "transactionType":     transactionType,             // "T"     ToDo: Serialize this to a string!
                                    "pagination":          pagination,                  // "9289"
                                    "errorFlags":          errorFlags,                  // ""
                                    "cumulatedLoss":       cumulatedLoss                // 0.0
                                                               ? new Decimal(cumulatedLoss)
                                                               : undefined,
                                    "status":              status,                      // "G"
                                    // "signatures":          [{
                                    //                            "value":  ocmfJSONDocument.signature["SD"]
                                    //                        }],
                                    "result":              {
                                                               "status": ocmfJSONDocument.validationStatus ?? chargyInterfaces.VerificationResult.Unvalidated
                                                           },
                                    "ocmfDocument":        ocmfJSONDocument
                                });

                            }

                        }
                    }


                    CTR.status = (OCMFJSONDocuments.every(ocmfJSONDocument => ocmfJSONDocument.validationStatus === chargyInterfaces.VerificationResult.ValidSignature)
                                     ? chargyInterfaces.SessionVerificationResult.ValidSignature
                                     : chargyInterfaces.SessionVerificationResult.InvalidSignature) as chargyInterfaces.SessionVerificationResult;


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


    //#region (private) validateOCMFSignature(OCMFJSONDocument, PublicKey, PublicKeyEncoding?)

    private async validateOCMFSignature(OCMFJSONDocument:    IOCMFJSONDocument,
                                        PublicKey:           string|chargyInterfaces.IPublicKeyXY,
                                        PublicKeyEncoding?:  string): Promise<chargyInterfaces.VerificationResult>
    {

        // Note: We could also get the ECC curve from the DER-encoded public key!

        try
        {

            //#region Setup crypto

            const plaintext      = OCMFJSONDocument.rawPayload ?? JSON.stringify(OCMFJSONDocument.payload);

            let   curve:any      = null;
            let   publicKey:any  = null;

            try
            {

                switch (OCMFJSONDocument.signature.SA)
                {

                    case "ECDSA-secp192k1-SHA256":
                        break;

                    case "ECDSA-secp192r1-SHA256":
                        break;

                    case "ECDSA-secp256k1-SHA256":
                        curve = new this.chargy.elliptic.ec('secp256k1');
                        break;

                    case "ECDSA-secp256k1-SHA256":
                        break;

                    case "ECDSA-brainpool256r1-SHA256":
                        break;

                    // Note: Cryptographical wrong hash algorithm!
                    case "ECDSA-secp384r1-SHA256":
                        curve = new this.chargy.elliptic.ec('p384');
                        break;

                    // Note: Cryptographical wrong hash algorithm!
                    case "ECDSA-brainpool384r1-SHA256":
                        break;

                    // Not an OCMF standard!
                    case "ECDSA-secp384r1-SHA384":
                        curve = new this.chargy.elliptic.ec('p384');
                        break;

                    // Not an OCMF standard!
                    case "ECDSA-brainpool384r1-SHA384":
                        break;

                    // Not an OCMF standard!
                    case "ECDSA-secp521r1-SHA512":
                        curve = new this.chargy.elliptic.ec('p521');
                        break;

                    // ECDSA-secp256r1-SHA256
                    default:
                        curve = new this.chargy.elliptic.ec('p256');
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

                let publicKeyBytes:ArrayBuffer|null = null;

                if (typeof OCMFJSONDocument.publicKey === 'string')
                {

                    //#region Define an ASN.1 structure for an ECC public key

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

                    //#endregion

                    //#region Try to determine the public key encoding format

                    if (PublicKeyEncoding)
                    {
                        switch (PublicKeyEncoding.toLowerCase())
                        {

                            case 'hex':
                                publicKeyBytes = Buffer.from(OCMFJSONDocument.publicKey, 'hex');
                                break;

                            case "base32":
                                publicKeyBytes = Buffer.from(this.chargy.base32Decode(publicKeyBytes, 'RFC4648'));
                                break;

                            case 'base64':
                                publicKeyBytes = Buffer.from(OCMFJSONDocument.publicKey, 'base64');
                                break;

                        }
                    }

                    // Try to guess the encoding format
                    if (publicKeyBytes == null)
                    {

                        const hexRegex     = /^[0-9A-Fa-f]+$/;
                        const base32Regex  = /^(?:[A-Z2-7]{8})*(?:[A-Z2-7]{2}={6}|[A-Z2-7]{4}={4}|[A-Z2-7]{5}={3}|[A-Z2-7]{7}=)?$/;
                        const base64Regex  = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;

                        if (hexRegex.test(OCMFJSONDocument.publicKey))
                        {
                            PublicKeyEncoding  = 'hex';
                            publicKeyBytes     = Buffer.from(OCMFJSONDocument.publicKey, 'hex');
                        }

                        else if (base32Regex.test(OCMFJSONDocument.publicKey))
                        {
                            PublicKeyEncoding  = 'base32';
                            publicKeyBytes     = Buffer.from(this.chargy.base32Decode(publicKeyBytes, 'RFC4648'));
                        }

                        else if (base64Regex.test(OCMFJSONDocument.publicKey))
                        {
                            PublicKeyEncoding  = 'base64';
                            publicKeyBytes     = Buffer.from(OCMFJSONDocument.publicKey, 'base64');
                        }

                    }

                    // Or fail...
                    if (!publicKeyBytes)
                    {
                        OCMFJSONDocument.validationStatus = chargyInterfaces.VerificationResult.UnknownPublicKeyFormat;
                        return OCMFJSONDocument.validationStatus;
                    }

                    //#endregion

                    //#region Parse the DER-encoded public key

                    const publicKeyASN1  = ECPoint.decode(publicKeyBytes, 'der');

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

                    //#endregion

                    OCMFJSONDocument.publicKey = {
                                                     algorithm:   OCMFJSONDocument.signature.SA
                                                                      ? OCMFJSONDocument.signature.SA.substring(
                                                                            OCMFJSONDocument.signature.SA.indexOf('-') + 1,
                                                                            OCMFJSONDocument.signature.SA.lastIndexOf('-')
                                                                        )
                                                                      : 'secp256r1',
                                                     encoding:    PublicKeyEncoding ?? 'hex',
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

            //#region Verify the signature

            try
            {

                OCMFJSONDocument.validationStatus = publicKey.verify(OCMFJSONDocument.hashValue, OCMFJSONDocument.signatureRS)
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

    //#region (private) parseOCMFJSONDocuments(OCMFDocuments, PublicKey?, PublicKeyEncoding?, ContainerInfos?)

    private async parseOCMFJSONDocuments(OCMFDocuments:       string[],
                                         PublicKey?:          string|chargyInterfaces.IPublicKeyXY,
                                         PublicKeyEncoding?:  string,
                                         ContainerInfos?:     any): Promise<IOCMFJSONDocument[] | string>
    {

        //#region Data

        const combinedOCMF            = OCMFDocuments.join('\n');

        let   ocmfStructure           =  0;
        let   ocmfRAWPayload:string   = "";
        let   ocmfPayload:any         = {};
        let   ocmfSignature:any       = {};

        let   depth                   =  0;
        let   ocmfStartIndex          = -1;
        let   startIndex              = -1;
        let   endIndex                = -1;

        let   ocmfJSONDocuments: Array<IOCMFJSONDocument> = [];

        //#endregion

        try
        {

            for (let i = 0; i < combinedOCMF.length; i++)
            {

                //#region OCMF header

                if (ocmfStructure   == 0 &&
                    i               >= 3 &&
                    combinedOCMF[i] === 'F' && combinedOCMF[i-1] === 'M' && combinedOCMF[i-2] === 'C' && combinedOCMF[i-3] === 'O')
                {
                    ocmfStructure    = 1;
                    ocmfStartIndex  = i-3;
                    continue;
                }

                //#endregion

                //#region |

                if (ocmfStructure == 1 || ocmfStructure == 3)
                {
                    if (combinedOCMF[i] === '|') {
                        ocmfStructure++;
                        continue;
                    }
                }

                //#endregion

                if (ocmfStructure == 2 || ocmfStructure == 4)
                {

                    //#region {

                    if (combinedOCMF[i] === '{')
                    {

                        depth++;

                        if (depth === 1)
                            startIndex = i;

                        continue;

                    }

                    //#endregion

                    if (combinedOCMF[i] === '}')
                    {

                        depth--;

                        if (depth === 0)
                        {

                            endIndex = i;

                            //#region Copy OCMF

                            if (startIndex !== -1 && endIndex !== -1) {

                                //#region Copy payload

                                if (ocmfStructure == 2)
                                {
                                    try
                                    {
                                        ocmfRAWPayload  = combinedOCMF.substring(startIndex, endIndex + 1);
                                        ocmfPayload     = JSON.parse(ocmfRAWPayload);
                                    }
                                    catch (exception)
                                    {
                                        return "The " + (ocmfJSONDocuments.length + 1) + ". OCMF payload is not a valid JSON document!";
                                    }
                                }

                                //#endregion

                                //#region Copy signature

                                if (ocmfStructure == 4)
                                {

                                    //#region Copy signature

                                    try
                                    {
                                        ocmfSignature = JSON.parse(combinedOCMF.substring(startIndex, endIndex + 1));
                                    }
                                    catch (exception)
                                    {
                                        return "The " + (ocmfJSONDocuments.length + 1) + ". OCMF signature is not a valid JSON document!";
                                    }

                                    //#endregion

                                    //#region Hash the payload

                                    let hashAlgorithm:     string                                     = "?";
                                    let hashValue:         string                                     = "?";
                                    let validationStatus:  chargyInterfaces.VerificationResult|null   = null;

                                    const plaintext = ocmfRAWPayload ?? JSON.stringify(ocmfPayload);

                                    try
                                    {

                                        switch (ocmfSignature.SA)
                                        {

                                            case "ECDSA-secp192k1-SHA256":
                                                hashAlgorithm  = "SHA256";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            case "ECDSA-secp192r1-SHA256":
                                                hashAlgorithm  = "SHA256";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            case "ECDSA-secp256k1-SHA256":
                                                hashAlgorithm  = "SHA256, 256 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            case "ECDSA-secp256k1-SHA256":
                                                hashAlgorithm  = "SHA256, 256 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            case "ECDSA-brainpool256r1-SHA256":
                                                hashAlgorithm  = "SHA256, 256 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            // Note: Cryptographical wrong hash algorithm!
                                            case "ECDSA-secp384r1-SHA256":
                                                hashAlgorithm  = "SHA256, 256 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            // Note: Cryptographical wrong hash algorithm!
                                            case "ECDSA-brainpool384r1-SHA256":
                                                hashAlgorithm  = "SHA256, 256 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            // Not an OCMF standard!
                                            case "ECDSA-secp384r1-SHA384":
                                                hashAlgorithm  = "SHA384, 384 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            // Not an OCMF standard!
                                            case "ECDSA-brainpool384r1-SHA384":
                                                hashAlgorithm  = "SHA384, 384 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            // Not an OCMF standard!
                                            case "ECDSA-secp521r1-SHA512":
                                                hashAlgorithm  = "SHA512, 512 Bits, hex";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                            // ECDSA-secp256r1-SHA256
                                            default:
                                                hashAlgorithm  = "SHA256";
                                                hashValue      = (await chargyLib.sha256(plaintext));
                                                break;

                                        }

                                    }
                                    catch (exception)
                                    {
                                        validationStatus = chargyInterfaces.VerificationResult.UnknownSignatureFormat;
                                    }

                                    //#endregion

                                    const ocmfJSONDocument:IOCMFJSONDocument = {
                                        "@context":        "OCMF",
                                        raw:                combinedOCMF.substring(ocmfStartIndex, endIndex + 1),
                                        rawPayload:         ocmfRAWPayload,
                                        payload:            ocmfPayload,
                                        signature:          ocmfSignature,
                                        hashAlgorithm:      hashAlgorithm,
                                        hashValue:          hashValue,
                                        publicKey:          PublicKey,
                                        publicKeyEncoding:  PublicKeyEncoding,
                                        validationStatus:   validationStatus
                                                                ? validationStatus
                                                                : PublicKey
                                                                      ? chargyInterfaces.VerificationResult.Unvalidated
                                                                      : chargyInterfaces.VerificationResult.PublicKeyNotFound
                                    }

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

                                        switch (ocmfJSONDocument.signature.SE?.toLowerCase() ?? "")
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
                                                ocmfJSONDocument.validationStatus = chargyInterfaces.VerificationResult.UnknownSignatureFormat;

                                        }

                                        // Parse the DER-encoded signature
                                        const signatureObj = ECDSASignature.decode(Buffer.from(ocmfJSONDocument.signature.SD, bufferEncoding), 'der');

                                        // Extract the r and s components of the signature
                                        ocmfJSONDocument.signatureRS =  {
                                            value:  ocmfJSONDocument.signature.SD,
                                            r:      signatureObj.r.toString(16),
                                            s:      signatureObj.s.toString(16)
                                        };

                                    }
                                    catch (exception)
                                    {
                                        ocmfJSONDocument.validationStatus = chargyInterfaces.VerificationResult.InvalidSignature;
                                    }

                                    //#endregion

                                    if (PublicKey && ocmfJSONDocument.validationStatus === chargyInterfaces.VerificationResult.Unvalidated)
                                        await this.validateOCMFSignature(ocmfJSONDocument,
                                                                         PublicKey,
                                                                         PublicKeyEncoding);

                                    ocmfJSONDocuments.push(ocmfJSONDocument);

                                }

                                //#endregion

                            }

                            //#endregion

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

    //#region TryToParseOCMFDocument (OCMFDocument,  PublicKey?, PublicKeyEncoding?, ContainerInfos?)

    public async TryToParseOCMFDocument(OCMFDocument:        string,
                                        PublicKey?:          string|chargyInterfaces.IPublicKeyXY,
                                        PublicKeyEncoding?:  string,
                                        ContainerInfos?:     any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {
        return await this.TryToParseOCMFDocuments([ OCMFDocument ], PublicKey, PublicKeyEncoding, ContainerInfos);
    }

    //#endregion

    //#region TryToParseOCMFDocuments(OCMFDocuments, PublicKey?, PublicKeyEncoding?, ContainerInfos?)

    public async TryToParseOCMFDocuments(OCMFDocuments:       string[],
                                         PublicKey?:          string|chargyInterfaces.IPublicKeyXY,
                                         PublicKeyEncoding?:  string,
                                         ContainerInfos?:     any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        //#region Data

        if (OCMFDocuments.length == 0) return {
             status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
             message:   this.chargy.GetLocalizedMessage("The given OCMF data could not be parsed") + "!",
             certainty: 0
         }

        const ocmfJSONDocumentGroups  = new Map<String, Array<IOCMFJSONDocument>>();
        const ocmfCTRs                = new Array<IOCMFChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>();

        //#endregion

        const ocmfJSONDocuments = await this.parseOCMFJSONDocuments(
                                            OCMFDocuments,
                                            PublicKey,
                                            PublicKeyEncoding,
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

                    if (!ocmfJSONDocumentGroups.has(groupingKey))
                        ocmfJSONDocumentGroups.set(groupingKey, new Array<IOCMFJSONDocument>());

                    ocmfJSONDocumentGroups.get(groupingKey)!.push(ocmfJSONDocument);

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
            for (const ocmfJSONDocumentGroup of ocmfJSONDocumentGroups.values())
            {

                if (PublicKey)
                    for (const ocmfJSONDocument of ocmfJSONDocumentGroup)
                        if (ocmfJSONDocument.validationStatus === chargyInterfaces.VerificationResult.Unvalidated)
                            await this.validateOCMFSignature(ocmfJSONDocument, PublicKey);

                // Switch over the Format Version of the first OCMF document within the group
                if (ocmfJSONDocumentGroup[0])
                {
                    switch (ocmfJSONDocumentGroup[0].payload.FV)
                    {

                        case "1.0":
                        case "1.1":
                        case "1.2":
                            ocmfCTRs.push(await this.tryToParseOCMFv1_0(ocmfJSONDocumentGroup, PublicKey, ContainerInfos));
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
