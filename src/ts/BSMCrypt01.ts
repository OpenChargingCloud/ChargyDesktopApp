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
import { ACrypt }                     from './ACrypt'
import * as chargyInterfaces          from './interfaces/chargyInterfaces'
import * as chargeTransparencyRecord  from './interfaces/IChargeTransparencyRecord'
import * as chargyLib                 from './chargyLib'
import Decimal                        from 'decimal.js'


interface IASN1Signature
{
    r: { toString(base: number): string };
    s: { toString(base: number): string };
}

export interface IBSMMeasurementValue extends chargeTransparencyRecord.IMeasurementValue
{

    Typ:                        number,

    RCR:                        number,
    RCR_SF:                     number,
    RCR_Unit:                   string,
    RCR_Prefix:                 chargyInterfaces.DisplayPrefixes,
    RCR_Precision:              number,

    TotWhImp:                   number,
    TotWhImp_SF:                number,
    TotWhImp_Unit:              string,
    TotWhImp_Prefix:            chargyInterfaces.DisplayPrefixes,
    TotWhImp_Precision:         number,

    W:                          number,
    W_SF:                       number,
    W_Unit:                     string,
    W_Prefix:                   chargyInterfaces.DisplayPrefixes,
    W_Precision:                number,

    MA1:                        string,
    RCnt:                       number,
    OS:                         number,
    Epoch:                      number,
    TZO:                        number,
    EpochSetCnt:                number,
    EpochSetOS:                 number,
    DI:                         number,
    DO:                         number,
    Meta1:                      string,
    Meta2:                      string,
    Meta3:                      string,
    Evt:                        number

}

// A single entry of the "additionalValues" array of a BSM-WS36A
// snapshot, flattened and type-checked for easier consumption.
interface IBSMAdditionalValue
{
    measurandId:                string | undefined;
    measurandName:              string | undefined;
    scale:                      number | undefined;
    unit:                       string | undefined;
    unitEncoded:                number | undefined;
    value:                      unknown;   // string or number, depending on the measurand
    valueType:                  string | undefined;
    prefix:                     string | undefined;
    precision:                  number | undefined;
}

// The intermediate per-snapshot data collected while validating
// the consistency of all signed meter values.
interface IBSMDataSet
{
    Typ:                        number;
    TypParsed:                  string;
    RCR:                        IBSMAdditionalValue | undefined;
    TotWhImp:                   IBSMAdditionalValue | undefined;
    W:                          IBSMAdditionalValue | undefined;
    MA1:                        string | null;
    RCnt:                       number;
    OS:                         number;
    Epoch:                      number;
    TZO:                        number;
    EpochSetCnt:                number;
    EpochSetOS:                 number;
    DI:                         number;
    DO:                         number;
    Meta1:                      string | null;
    Meta2:                      string | null;
    Meta3:                      string | null;
    Evt:                        number;
    time:                       string;
    value:                      unknown;
    valuePrefix:                chargyInterfaces.DisplayPrefixes;
    valuePrecision:             number;
    measurementId:              unknown;
    signature:                  string;
    errors:                     string[];
    warnings:                   string[];
}

export interface IBSMCrypt01Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  string,
    meterId?:                      string,
    meter?:                        chargyInterfaces.IMeter,
    timestamp?:                    string,

    ArraySize:                     number,
    Typ:                           string,
    RCR:                           string,
    TotWhImp:                      string,
    W:                             string,
    MA1:                           string,
    RCnt:                          string,
    OS:                            string,
    Epoch:                         string,
    TZO:                           string,
    EpochSetCnt:                   string,
    EpochSetOS:                    string,
    DI:                            string,
    DO:                            string,
    Meta1:                         string,
    Meta2:                         string,
    Meta3:                         string,
    Evt:                           string,

    //infoStatus?:                   string,
    //secondsIndex?:                 string,
    //paginationId?:                 string,
    //obis?:                         string,
    //unitEncoded?:                  string,
    //scale?:                        string,
    //value?:                        string,
    //logBookIndex?:                 string,
    //authorizationStart?:           string,
    //authorizationStop?:            string,
    //authorizationStartTimestamp?:  string,

    publicKey?:                    string,
    publicKeyFormat?:              string,
    publicKeySignatures?:          Array<unknown>,
    signature?:                    chargyInterfaces.ISignatureRS
}


export class BSMCrypt01 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy: Chargy) {
        super("ECC secp256r1",
              chargy);
    }


    public tryToParseBSM_WS36aMeasurements(CTR:                   chargeTransparencyRecord.IChargeTransparencyRecord,
                                           ExpectedEVSEId:        string,
                                           ExpectedCscSwVersion:  string|null,
                                           Measurements:          Array<unknown>)

        : chargeTransparencyRecord.IChargeTransparencyRecord |
          chargyInterfaces.        ISessionCryptoResult

    {

        //#region Initial checks

        if (!Array.isArray(Measurements)) return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   this.chargy.GetLocalizedMessage("MissingOrInvalidSignedMeterValues"),
            certainty: 0
        }

        if (Measurements.length < 2) return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   this.chargy.GetLocalizedMessage("AtLeastTwoSignedMeterValuesRequired"),
            certainty: 0
        }

        const firstMeasurement = Measurements[0];

        if (!chargyLib.isMandatoryJSONObject(firstMeasurement)) return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidSignedMeterValueP", 1),
            certainty: 0
        }

        const errors    = new Array<string>();
        const warnings  = new Array<string>();

        // How sure we are, that this is really a BSM meter value format
        const numberOfFormatChecks  = 2*39; // At least two signed meter values!
        let secondaryErrors       = 0;

        //#endregion

        try
        {

            //#region Validate values

            if (!chargyLib.isMandatoryString(firstMeasurement["@context"]))
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_JSONContextP",               1));


            const meterInfo = firstMeasurement["meterInfo"];
            if (!chargyLib.isMandatoryJSONObject(meterInfo))
            {
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfoP", 1));
                secondaryErrors += 5;
            }
            else
            {

                if (!chargyLib.isMandatoryString(meterInfo["firmwareVersion"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_FirmwareVersionP", 1));

                if (!chargyLib.isMandatoryString(meterInfo["publicKey"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));

                if (!chargyLib.isMandatoryString(meterInfo["meterId"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         1));

                if (!chargyLib.isMandatoryString(meterInfo["manufacturer"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    1));

                if (!chargyLib.isMandatoryString(meterInfo["type"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_TypeP",            1));

            }

            const contract = firstMeasurement["contract"];
            if (!chargyLib.isMandatoryJSONObject(contract))
            {
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ContractP", 1));
                secondaryErrors += 2;
            }
            else
            {

                if (!chargyLib.isMandatoryString(contract["id"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_IdP",               1));

                if (!chargyLib.isOptionalString(contract["type"]))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TypeP",             1));

            }

            const value = firstMeasurement["value"];
            if (!chargyLib.isMandatoryJSONObject(value))
            {
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ValueP",                         1));
                secondaryErrors += 8;
            }
            else
            {

                const measurand = value["measurand"];
                if (!chargyLib.isMandatoryJSONObject(measurand))
                {
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurandP",                 1));
                    secondaryErrors += 2;
                }
                else
                {

                    if (!chargyLib.isMandatoryString(measurand["id"]))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_Measurand_IdentificationP",               1));

                    if (!chargyLib.isMandatoryString(measurand["name"]))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_Measurand_NameP",                         1));

                }

                const measuredValue = value["measuredValue"];
                if (!chargyLib.isMandatoryJSONObject(measuredValue))
                {
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValueP",             1));
                    secondaryErrors += 4;
                }
                else
                {

                    //    MeasuredValueScale:          Content.value?.measuredValue?.scale       ?? Content.signedMeterValues[0].value?.measuredValue?.scale,
                    //    MeasuredValueUnit:           Content.value?.measuredValue?.unit        ?? Content.signedMeterValues[0].value?.measuredValue?.unit,
                    //    MeasuredValueUnitEncoded:    Content.value?.measuredValue?.unitEncoded ?? Content.signedMeterValues[0].value?.measuredValue?.unitEncoded,
                    //    MeasuredValueValueType:      Content.value?.measuredValue?.valueType   ?? Content.signedMeterValues[0].value?.measuredValue?.valueType,

                }

                //ToDo: Verify optional displayedFormat

                // const displayedFormat = value.displayedFormat;
                // if (!chargyLib.isMandatoryJSONObject(displayedFormat))
                // {
                //     errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurandP",                 1));
                //     secondaryErrors += 2;
                // }
                // else
                // {

                //     if (!chargyLib.isMandatoryString(measurand.id))
                //         errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_Measurand_IdentificationP",               1));

                //     if (!chargyLib.isMandatoryString(measurand.name))
                //         errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_Measurand_NameP",                         1));

                // }

            }

            //    MA1:                         null as string|null,
            //    EpochSetCnt:                 -1,
            //    EpochSetOS:                  -1,
            //    dataSets:                    [] as any[]

            if (errors.length > 0) return {
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                errors:     errors,
                warnings:   warnings,
                certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
            }


            // The early return above guarantees, that all mandatory values
            // have been validated. The optional values stay undefined when
            // they are missing or have an unexpected type.
            const meterInfoObj        = chargyLib.asJSONObject(firstMeasurement["meterInfo"]);
            const contractObj         = chargyLib.asJSONObject(firstMeasurement["contract"]);
            const valueObj            = chargyLib.asJSONObject(firstMeasurement["value"]);
            const measurandObj        = chargyLib.asJSONObject(valueObj?.["measurand"]);
            const measuredValueObj    = chargyLib.asJSONObject(valueObj?.["measuredValue"]);
            const displayedFormatObj  = chargyLib.asJSONObject(valueObj?.["displayedFormat"]);
            const chargePointObj      = chargyLib.asJSONObject(firstMeasurement["chargePoint"]);

            const common = {

                context:                           chargyLib.asString(firstMeasurement["@context"])         ?? "",

                meterInfo_firmwareVersion:         chargyLib.asString(meterInfoObj?.["firmwareVersion"])    ?? "",
                meterInfo_publicKey:               chargyLib.asString(meterInfoObj?.["publicKey"])          ?? "",
                meterInfo_meterId:                 chargyLib.asString(meterInfoObj?.["meterId"])            ?? "",
                meterInfo_manufacturer:            chargyLib.asString(meterInfoObj?.["manufacturer"])       ?? "",
                meterInfo_type:                    chargyLib.asString(meterInfoObj?.["type"])               ?? "",

                contract_id:                       chargyLib.asString(contractObj?.["id"])                  ?? "",
                contract_type:                     chargyLib.asString(contractObj?.["type"]),

                value_measurand_id:                chargyLib.asString(measurandObj?.["id"])                 ?? "",  // OBIS Id
                value_measurand_name:              chargyLib.asString(measurandObj?.["name"])               ?? "",

                value_measuredValue_scale:         chargyLib.asNumber(measuredValueObj?.["scale"]),
                value_measuredValue_unit:          chargyLib.asString(measuredValueObj?.["unit"])           ?? "",
                value_measuredValue_unitEncoded:   chargyLib.asNumber(measuredValueObj?.["unitEncoded"]),
                value_measuredValue_valueType:     chargyLib.asString(measuredValueObj?.["valueType"]),

                value_displayedFormat_prefix:      chargyLib.asString(displayedFormatObj?.["prefix"])       ?? "",  // "kilo"
                value_displayedFormat_precision:   chargyLib.asNumber(displayedFormatObj?.["precision"]),           // 2

                chargePoint_softwareVersion:       chargyLib.asString(chargePointObj?.["softwareVersion"]),
                MA1:                               null as string|null,
                epochSetCnt:                       -1,
                epochSetOS:                        -1,
                dataSets:                          new Array<IBSMDataSet>()

            };

            //#endregion

            //#region Data

            let Typ                     = 0;      // Snapshot Type
            let RCR:        IBSMAdditionalValue | undefined;   // !!! Real energy imported since the last execution of the turn-on sequence
            let TotWhImp:   IBSMAdditionalValue | undefined;   // !!! Total Real Energy Imported
            let W:          IBSMAdditionalValue | undefined;   // !!! Total Real Power
            let MA1:    string|null     = null;   // Meter Address 1
            let RCnt                    = 0;      // A counter incremented with each snapshot
            let OS                      = 0;      // Operation-Seconds Counter
            let Epoch                   = 0;      // Current local time in seconds since 1970
            let TZO                     = 0;      // Timezone offset of local epoch time time to UTC (minutes)
            let EpochSetCnt             = 0;      // How many time epoch time and timezone offset have been set
            let EpochSetOS              = 0;      // Operation-seconds when the time has been set the last time
            let DI                      = 0;      // Status of the digital inputs
            let DO                      = 0;      // Status of the digital outputs
            let Meta1:  string|null     = null;   // User metadata 1 => Check text encoding: https://www.npmjs.com/package/iconv
            let Meta2:  string|null     = null;   // User metadata 2 => Check text encoding: https://www.npmjs.com/package/iconv
            let Meta3:  string|null     = null;   // User metadata 3 => Check text encoding: https://www.npmjs.com/package/iconv
            let Evt                     = 0;      // Meter Event Flags


            let previousId: unknown     = "";
            let previousTime            = "";
            //const previousMeasurementId   = "";
            let previousValue: number | undefined;

            let previousRCR             = -1;
            let previousRCnt            = -1;
            let previousOS              = -1;
            let previousEpoch           = -1;

            let previousCscSwVersion: string|null = null;

            let measurementCounter      = 0;

            //#endregion

            for (const measurementRaw of Measurements)
            {

                const currentErrors:   Array<string>  = [];
                const currentWarnings: Array<string>  = [];

                measurementCounter++;

                const currentMeasurement = chargyLib.asJSONObject(measurementRaw);
                if (currentMeasurement === undefined)
                    throw new Error(`Invalid signed meter value #${String(measurementCounter)}!`);

                //#region Validate common values

                if (currentMeasurement["@context"] !== common.context)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_JSONContextP", measurementCounter));

                const currentId = currentMeasurement["@id"];
                if (previousId !== "" && typeof currentId === 'string')
                {

                    if (typeof previousId !== 'string')
                        throw new Error(`Invalid identification of signed meter value #${String(measurementCounter - 1)}!`);

                    // IDs from the BSM-WS36A are in the form of "PREFIX-COUNTER". Check that prefixes
                    // match match and the counters are stricly increasing.

                    const previousParts = previousId.split("-");
                    const currentParts  = currentId. split("-");

                    if (previousParts.length !== 2               ||
                        currentParts. length !== 2               ||
                        previousParts[0]     !== currentParts[0] ||
                        previousParts[1]     === undefined       ||
                        currentParts[1]      === undefined       ||
                        // parseInt returns NaN in case parsing fails which in turn does not match
                        // anything (not even NaN). This way we are checking that both counter values
                        // are numeric too.
                        parseInt(previousParts[1], 10) >= parseInt(currentParts[1], 10))
                    {
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeasurementIdP", measurementCounter));
                    }

                }
                previousId = currentId;


                const valueObj            = chargyLib.asJSONObject(currentMeasurement["value"]);
                const measuredValueObj    = chargyLib.asJSONObject(valueObj?.["measuredValue"]);
                const displayedFormatObj  = chargyLib.asJSONObject(valueObj?.["displayedFormat"]);
                const currentTime         = chargyLib.asString    (currentMeasurement["time"]) ?? "";

                if (previousTime !== "" && currentTime <= previousTime)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_TimestampP", measurementCounter));
                previousTime = currentTime;

                const currentValue = chargyLib.asNumber(measuredValueObj?.["value"]);
                if (previousValue !== undefined && currentValue !== undefined && currentValue < previousValue)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurement_ValueP", measurementCounter));
                previousValue = currentValue;

                //#region Flatten and validate the additional values

                const additionalValuesRaw = currentMeasurement["additionalValues"];
                if (!chargyLib.isMandatoryJSONArray(additionalValuesRaw))
                    throw new Error(`Missing or invalid additional values within signed meter value #${String(measurementCounter)}!`);

                const additionalValues = additionalValuesRaw.map((element, index) => {

                    const elementObj       = chargyLib.asJSONObject(element);
                    const measurand        = chargyLib.asJSONObject(elementObj?.["measurand"]);
                    const measuredValue    = chargyLib.asJSONObject(elementObj?.["measuredValue"]);
                    const displayedFormat  = chargyLib.asJSONObject(elementObj?.["displayedFormat"]);

                    if (elementObj === undefined || measurand === undefined)
                        throw new Error(`Invalid additional value #${String(index + 1)} within signed meter value #${String(measurementCounter)}!`);

                    return {
                        measurandId:    chargyLib.asString(measurand["id"]),
                        measurandName:  chargyLib.asString(measurand["name"]),
                        scale:          chargyLib.asNumber(measuredValue?.["scale"]),
                        unit:           chargyLib.asString(measuredValue?.["unit"]),
                        unitEncoded:    chargyLib.asNumber(measuredValue?.["unitEncoded"]),
                        value:          measuredValue?.["value"],
                        valueType:      chargyLib.asString(measuredValue?.["valueType"]),
                        prefix:         chargyLib.asString(displayedFormat?.["prefix"]),
                        precision:      chargyLib.asNumber(displayedFormat?.["precision"])
                    } satisfies IBSMAdditionalValue;

                });

                //#endregion

                if (currentMeasurement["meterInfo"])
                {

                    const meterInfoObj = chargyLib.asJSONObject(currentMeasurement["meterInfo"]);

                    if (meterInfoObj?.["firmwareVersion"]    !== common.meterInfo_firmwareVersion)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_FirmwareVersionP", measurementCounter));

                    if (meterInfoObj?.["publicKey"]          !== common.meterInfo_publicKey)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_PublicKeyP",       measurementCounter));

                    if (meterInfoObj?.["meterId"]            !== common.meterInfo_meterId)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_MeterIdP",         measurementCounter));

                    if (meterInfoObj?.["meterId"]            !== additionalValues.filter(element => element.measurandName === "MA1")[0]?.value)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_MeterIdP",         measurementCounter));

                    if (meterInfoObj?.["manufacturer"]       !== common.meterInfo_manufacturer)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_ManufacturerP",    measurementCounter));

                    if (meterInfoObj?.["type"]               !== common.meterInfo_type)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_TypeP",            measurementCounter));

                }

                // if (currentMeasurement.operatorInfo)
                // {
                //     if (currentMeasurement.operatorInfo                  !== common.operatorInfo)
                //         return {
                //             status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                //             message:  "Inconsistent operatorInfo!",
                //             certainty: 0
                //         };
                // }

                if (currentMeasurement["contract"])
                {

                    const contractObj = chargyLib.asJSONObject(currentMeasurement["contract"]);

                    if (additionalValues.filter(element => element.measurandName?.startsWith('Meta') && chargyLib.asString(element.value)?.startsWith('contract-id:')).length == 0)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",      measurementCounter));

                    if (contractObj?.["id"]   !== common.contract_id)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",      measurementCounter));

                    if (contractObj?.["type"] !== common.contract_type)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_TypeP",    measurementCounter));

                    const contractInfo = additionalValues.filter(element => element.measurandName?.startsWith('Meta') && chargyLib.asString(element.value)?.startsWith('contract-id:'))[0]?.value;
                    if (contractInfo != null)
                    {

                        if ( contractObj?.["type"] && contractInfo !== "contract-id: " + (common.contract_type ?? "-") + ":" + common.contract_id)
                            currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",  measurementCounter));

                        if (!contractObj?.["type"] && contractInfo !== "contract-id: " + common.contract_id)
                            currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",  measurementCounter));

                    }

                }


                // Cross-check that value matches the common value (besides
                // measuredValue.value) and is identical to the signed RCR from
                // the additional values array.

                const rcrInAdditional = additionalValues.find(element => element.measurandName == 'RCR');

                if (currentMeasurement["value"] == null)
                    throw new Error(`Missing value within signed meter value #${String(measurementCounter)}!`);

                if ((valueObj?.["measurand"] || valueObj?.["measuredValue"]) && rcrInAdditional === undefined)
                    throw new Error(`Missing 'RCR' within the additional values of signed meter value #${String(measurementCounter)}!`);

                if (valueObj?.["measurand"])
                {

                    const measurandObj = chargyLib.asJSONObject(valueObj["measurand"]);

                    if (measurandObj?.["id"]   !== common.value_measurand_id   || measurandObj["id"]   !== rcrInAdditional?.measurandId)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurand_IdentificationP", measurementCounter));

                    if (measurandObj?.["name"] !== common.value_measurand_name || measurandObj["name"] !== rcrInAdditional?.measurandName)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurand_NameP",           measurementCounter));

                }

                if (valueObj?.["measuredValue"])
                {

                    if (measuredValueObj?.["value"]       !== rcrInAdditional?.value)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValueP",             measurementCounter));

                    if (measuredValueObj?.["scale"]       !== common.value_measuredValue_scale       || measuredValueObj?.["scale"]       !== rcrInAdditional?.scale)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_ScaleP",       measurementCounter));

                    if (measuredValueObj?.["unit"]        !== common.value_measuredValue_unit        || measuredValueObj  ["unit"]        !== rcrInAdditional?.unit)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_UnitP",        measurementCounter));

                    if (measuredValueObj?.["unitEncoded"] !== common.value_measuredValue_unitEncoded || measuredValueObj?.["unitEncoded"] !== rcrInAdditional?.unitEncoded)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_UnitEncodedP", measurementCounter));

                    if (measuredValueObj?.["valueType"]   !== common.value_measuredValue_valueType   || measuredValueObj?.["valueType"]   !== rcrInAdditional?.valueType)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_TypeP",        measurementCounter));

                }

                if (currentMeasurement["chargePoint"] && chargyLib.asJSONObject(currentMeasurement["chargePoint"])?.["softwareVersion"] !== common.chargePoint_softwareVersion)
                    currentErrors.push(this.chargy.GetLocalizedMessage("Inconsistent_ChargingStation_FirmwareVersion"));

                //#region Find "evse-id:"        within the "Meta" data blocks

                const signedEVSEId = additionalValues.filter(element => element.measurandName?.startsWith('Meta') && chargyLib.asString(element.value)?.startsWith('evse-id:'));
                if (signedEVSEId.length == 1)
                {

                    const evse__id = (chargyLib.asString(signedEVSEId[0]?.value) ?? "").replace('evse-id:', '').trim();

                    if (evse__id !== 'unknown' && ExpectedEVSEId !== evse__id)
                        currentErrors.push(this.chargy.GetLocalizedMessage("Inconsistent_EVSE_Identification"));

                }

                //#endregion

                //#region Find "csc-sw-version:" within the "Meta" data blocks

                const signedCSCSWVersion = additionalValues.filter(element => element.measurandName?.startsWith('Meta') && chargyLib.asString(element.value)?.startsWith('csc-sw-version:'));
                if (signedCSCSWVersion.length == 1)
                {

                    const csc_sw_version = chargyLib.asString(signedCSCSWVersion[0]?.value)?.replace('csc-sw-version:', '').trim() ?? null;

                    // Just check that all measurements are done with the same
                    // charging controller software version.
                    if (previousCscSwVersion !== null && previousCscSwVersion !== csc_sw_version)
                        currentErrors.push(this.chargy.GetLocalizedMessage("Inconsistent_ChargingStation_FirmwareVersion"));

                    // The document header also contains this information but
                    // in a combined form of the actual version and a build
                    // timestamp. As this information is not signed and just
                    // informative, we are ignoring it as a sound comparison of
                    // software versions is hard to do when it comes to suffixs
                    // for release candidates, betas, ...
                    if (ExpectedCscSwVersion !== null && ExpectedCscSwVersion !== csc_sw_version)
                        currentWarnings.push(this.chargy.GetLocalizedMessage("Inconsistent_ChargingStation_FirmwareVersion"));

                    previousCscSwVersion = csc_sw_version;

                }

                //#endregion

                //#endregion

                //#region Check additional values

                for(const additionalValue of additionalValues)
                {
                    switch (additionalValue.measurandName)
                    {
                        case "Typ":          Typ          = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "RCR":          RCR          = additionalValue;                                     break;
                        case "TotWhImp":     TotWhImp     = additionalValue;                                     break;
                        case "W":            W            = additionalValue;                                     break;
                        case "MA1":          MA1          = chargyLib.asString(additionalValue.value) ?? null;   break;
                        case "RCnt":         RCnt         = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "OS":           OS           = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "Epoch":        Epoch        = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "TZO":          TZO          = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "EpochSetCnt":  EpochSetCnt  = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "EpochSetOS":   EpochSetOS   = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "DI":           DI           = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "DO":           DO           = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                        case "Meta1":        Meta1        = chargyLib.asString(additionalValue.value) ?? "";     break;
                        case "Meta2":        Meta2        = chargyLib.asString(additionalValue.value) ?? "";     break;
                        case "Meta3":        Meta3        = chargyLib.asString(additionalValue.value) ?? "";     break;
                        case "Evt":          Evt          = chargyLib.asNumber(additionalValue.value) ?? NaN;    break;
                    }
                }


                const currentRCRValue = chargyLib.asNumber(RCR?.value) ?? NaN;

                if (previousRCR !== -1 && currentRCRValue < previousRCR)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurement_ValueP", measurementCounter));
                previousRCR = currentRCRValue;

                if (RCnt !== currentMeasurement["measurementId"])
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeasurementIdP", measurementCounter));

                // Snapshot counter
                if (previousRCnt !== -1 && RCnt != previousRCnt + 1)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_CounterP", measurementCounter));
                previousRCnt = RCnt;

                // Uptime counter
                if (previousOS !== -1 && OS <= previousOS)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_OperationSecondsCounterP", measurementCounter));
                previousOS = OS;

                if (previousEpoch !== -1 && Epoch <= previousEpoch)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_UNIXEpochP", measurementCounter));
                previousEpoch = Epoch;


                const measurementTimestamp1 = new Date(Epoch * 1000 + TZO * 60000).toISOString();
                const measurementTimestamp2 = measurementTimestamp1.substring(0, measurementTimestamp1.indexOf('.'));
                const measurementTimestamp3 = measurementTimestamp2 + (TZO > 0 ? "+" : "-") + (Math.abs(TZO) / 60).toString().padStart(2, '0') + ":" + (Math.abs(TZO) % 60).toString().padStart(2, '0');

                if (currentTime !== measurementTimestamp3)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_TimestampP", measurementCounter));

                // Meter Address 1 == Meter Id
                if (common.MA1 !== null && MA1 !== common.MA1)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_MeterIdP", measurementCounter));
                common.MA1 = MA1;

                if (common.epochSetCnt !== -1 && EpochSetCnt !== common.epochSetCnt)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_EpochSet_CounterP", measurementCounter));
                common.epochSetCnt = EpochSetCnt;

                if (common.epochSetOS !== -1 && EpochSetOS !== common.epochSetOS)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_EpochSet_OperationSecondsP", measurementCounter));
                common.epochSetOS = EpochSetOS;

                //#endregion

                common.dataSets.push({
                    Typ:             Typ,
                    TypParsed:       this.ParseTyp(Typ),
                    RCR:             RCR,
                    TotWhImp:        TotWhImp,
                    W:               W,
                    MA1:             MA1,
                    RCnt:            RCnt,
                    OS:              OS,
                    Epoch:           Epoch,
                    TZO:             TZO,          // Must be common? Or may it change e.g. during summer/winter time change?!
                    EpochSetCnt:     EpochSetCnt,
                    EpochSetOS:      EpochSetOS,
                    DI:              DI,
                    DO:              DO,
                    Meta1:           Meta1,
                    Meta2:           Meta2,
                    Meta3:           Meta3,
                    Evt:             Evt,
                    time:            currentTime,
                    value:           measuredValueObj?.["value"],
                    valuePrefix:     this.PrefixConverter(chargyLib.asString(displayedFormatObj?.["prefix"]) ?? "kilo"),
                    valuePrecision:  chargyLib.asNumber(displayedFormatObj?.["precision"]) ?? 2,
                    measurementId:   currentMeasurement["measurementId"],
                    signature:       chargyLib.asString(currentMeasurement["signature"]) ?? "",
                    errors:          currentErrors,
                    warnings:        currentWarnings
                });

            }

            //#region Validate consistency of snapshot types

            const n             = common.dataSets.length-1;

            // At least two signed meter values are validated above!
            const firstDataSet  = common.dataSets[0];
            const lastDataSet   = common.dataSets[n];

            if (firstDataSet === undefined || (firstDataSet.TypParsed !== "START" && firstDataSet.TypParsed !== "TURN ON"))
                throw new Error(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_EnergyMeterValueP", 1));

            for (let i=1; i<common.dataSets.length-1; i++) {
                if (common.dataSets[i]?.TypParsed !== "CURRENT")
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_EnergyMeterValueP", measurementCounter + 1));
            }

            if (lastDataSet === undefined || (lastDataSet.TypParsed !== "END"   && lastDataSet.TypParsed !== "TURN OFF"))
                throw new Error(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_EnergyMeterValueP", n+1));

            //#endregion

            //#region Set charging session information

            if (CTR.chargingSessions == null)
                CTR.chargingSessions = [];

            const ASN1_SignatureSchema = this.chargy.asn1.define('Signature', function() {
                this.seq().obj(
                    this.key('r').int(),
                    this.key('s').int()
                );
            });

            const session = {

                "@id":                          common.meterInfo_meterId + "-" + String(firstDataSet.Epoch),
                "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/bsm-ws36a-v0+json",
                "begin":                        firstDataSet.time,
                "end":                          lastDataSet.time,
                "EVSEId":                       CTR.chargingStationOperators?.[0]?.["chargingStations"]?.[0]?.["EVSEs"][0]?.["@id"],

                "authorizationStart": {
                    "@id":                      common.contract_id,
                    "@context":                 common.contract_type
                },

                "measurements": [
                    {
                         "energyMeterId":        common.meterInfo_meterId,
                    //     //"@context":             "https://open.charging.cloud/contexts/energyMeter/signatureFormat/bsm-ws36a-v0+json",
                         "phenomena": [
                             {
                                "name":              "Real Energy Imported",
                                "obis":              common.value_measurand_id,
                                "unit":              this.UnitConverter  (common.value_measuredValue_unit),
                                "unitEncoded":       common.value_measuredValue_unitEncoded,
                                "valueType":         common.value_measuredValue_valueType,
                                "value":             "value",
                                "scale":             common.value_measuredValue_scale,
                                "formatPrefix":      this.PrefixConverter(common.value_displayedFormat_prefix),
                                "formatPrecision":   common.value_displayedFormat_precision
                             },
                             {
                                "name":              "Total Watt-hours Imported",
                                "obis":              TotWhImp?.measurandId,
                                "unit":              this.UnitConverter  (TotWhImp?.unit   ?? ""),
                                "unitEncoded":       TotWhImp?.unitEncoded,
                                "valueType":         TotWhImp?.valueType,
                                "value":             "TotWhImp",
                                "scale":             TotWhImp?.scale,
                                "formatPrefix":      this.PrefixConverter(TotWhImp?.prefix ?? ""),
                                "formatPrecision":   TotWhImp?.precision,
                             },
                             {
                                "name":              "Total Real Power",
                                "obis":              W?.measurandId,
                                "unit":              this.UnitConverter  (W?.unit   ?? ""),
                                "unitEncoded":       W?.unitEncoded,
                                "valueType":         W?.valueType,
                                "value":             "W",
                                "scale":             W?.scale,
                                "formatPrefix":      this.PrefixConverter(W?.prefix ?? ""),
                                "formatPrecision":   W?.precision
                             }
                         ],
                         "values": new Array<IBSMMeasurementValue>()
                    }
                ]

            };

            for (const dataSet of common.dataSets)
            {

                let ASN1Signature: IASN1Signature | undefined;

                try
                {

                    ASN1Signature = ASN1_SignatureSchema.decode<IASN1Signature>(Buffer.from(dataSet.signature, 'hex'), 'der');

                }
                catch (exception)
                {
                    // Note: Some manipulations will not result in an invalid signature and
                    //       may also not cause an invalid signature validation. This is caused
                    //       by the mathematical nature of these big numbers and not a bug!
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_SignatureP", 1) + ": " + (exception instanceof Error ? exception.message : String(exception)));          }

                const bsmMeasurementValue: IBSMMeasurementValue = {

                    timestamp:                                 dataSet.time,
                    Typ:                                       dataSet.Typ,
                    value:                                     new Decimal(chargyLib.asNumber(dataSet.value) ?? NaN),
                    value_displayPrefix:                       dataSet.valuePrefix,
                    value_displayPrecision:                    dataSet.valuePrecision,

                    RCR:                  chargyLib.asNumber  (dataSet.RCR?.value) ?? NaN,
                    RCR_SF:                                    dataSet.RCR?.scale  ?? NaN,
                    RCR_Unit:             this.UnitConverter  (dataSet.RCR?.unit   ?? ""),
                    RCR_Prefix:           this.PrefixConverter(dataSet.RCR?.prefix ?? ""),
                    RCR_Precision:                             dataSet.RCR?.precision ?? NaN,

                    TotWhImp:             chargyLib.asNumber  (dataSet.TotWhImp?.value) ?? NaN,
                    TotWhImp_SF:                               dataSet.TotWhImp?.scale  ?? NaN,
                    TotWhImp_Unit:        this.UnitConverter  (dataSet.TotWhImp?.unit   ?? ""),
                    TotWhImp_Prefix:      this.PrefixConverter(dataSet.TotWhImp?.prefix ?? ""),
                    TotWhImp_Precision:                        dataSet.TotWhImp?.precision ?? NaN,

                    W:                    chargyLib.asNumber  (dataSet.W?.value) ?? NaN,
                    W_SF:                                      dataSet.W?.scale  ?? NaN,
                    W_Unit:               this.UnitConverter  (dataSet.W?.unit   ?? ""),
                    W_Prefix:             this.PrefixConverter(dataSet.W?.prefix ?? ""),
                    W_Precision:                               dataSet.W?.precision ?? NaN,

                    MA1:                                       dataSet.MA1   ?? "",
                    RCnt:                                      dataSet.RCnt,
                    OS:                                        dataSet.OS,
                    Epoch:                                     dataSet.Epoch,
                    TZO:                                       dataSet.TZO,
                    EpochSetCnt:                               dataSet.EpochSetCnt,
                    EpochSetOS:                                dataSet.EpochSetOS,
                    DI:                                        dataSet.DI,
                    DO:                                        dataSet.DO,
                    Meta1:                                     dataSet.Meta1 ?? "",
                    Meta2:                                     dataSet.Meta2 ?? "",
                    Meta3:                                     dataSet.Meta3 ?? "",
                    Evt:                                       dataSet.Evt,

                    errors:                                    dataSet.errors,
                    warnings:                                  dataSet.warnings,

                    signatures: [{
                        r:  ASN1Signature?.r.toString(16) ?? "-",
                        s:  ASN1Signature?.s.toString(16) ?? "-"
                    }]

                };

                session.measurements[0]?.values.push(bsmMeasurementValue);

            }

            CTR.chargingSessions.push(session as unknown as chargeTransparencyRecord.IChargingSession);

            //#endregion

            //#region Set other CTR information

            CTR["@id"] = common.meterInfo_meterId + "-" + String(firstDataSet.Epoch);

            {

                const firstChargingSession = CTR.chargingSessions[0];
                const lastChargingSession  = CTR.chargingSessions[CTR.chargingSessions.length - 1];

                if (firstChargingSession !== undefined &&
                    (CTR.begin == undefined || CTR.begin === "" || CTR.begin > firstChargingSession.begin))
                {
                    CTR.begin = firstChargingSession.begin;
                }

                if (lastChargingSession?.end !== undefined)
                {
                    if (CTR.end == undefined || CTR.end === "" || CTR.end < lastChargingSession.end)
                        CTR.end = lastChargingSession.end;
                }

            }

            if (CTR.contract == null)
                CTR.contract = {
                    "@id":       common.contract_id,
                    "@context":  common.contract_type,
                };
            else
            {
                //ToDo: What to do when there are different values?!
                CTR.contract["@id"]      = common.contract_id;
                CTR.contract["@context"] = common.contract_type;
            }

            (CTR.chargingStationOperators?.[0]?.chargingStations?.[0]?.EVSEs[0]?.meters)?.push({
                "@id":               common.meterInfo_meterId,
                model:               common.meterInfo_type,
                manufacturer:        common.meterInfo_manufacturer,
                manufacturerURL:     "https://www.bzr-bauer.de",
                firmwareVersion:     common.meterInfo_firmwareVersion,
                //hardwareVersion?:    string;
                signatureInfos:      {
                                         hash:            chargyInterfaces.CryptoHashAlgorithms.SHA256,
                                         hashTruncation:  0,
                                         algorithm:       chargyInterfaces.CryptoAlgorithms.ECC,
                                         curve:           "secp256r1",
                                         format:          chargyInterfaces.SignatureFormats.RS
                                     },
                signatureFormat:     "BSMCrypt01",
                publicKeys:          [{
                                         algorithm:       "secp256r1",
                                         format:          "DER",
                                         encoding:        "hex",
                                         value:           common.meterInfo_publicKey
                                     }]
            });

            //#endregion

            CTR.status     = errors.length == 0
                                 ? chargyInterfaces.SessionVerificationResult.Unvalidated
                                 : chargyInterfaces.SessionVerificationResult.InvalidSessionFormat;

            CTR.certainty  = 1 - errors.length/numberOfFormatChecks;

            return CTR;

        }
        catch (exception)
        {
            errors.push("Exception occured: " + (exception instanceof Error ? exception.message : String(exception)));
        }

        return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            errors:    errors,
            warnings:  warnings,
            certainty: 0
        }

    }


    async VerifyChargingSession(chargingSession: chargeTransparencyRecord.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        let sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSessionFormat;

        {
            for (const measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values.length > 1)
                {

                    // Validate...
                    for (const measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IBSMMeasurementValue);
                    }

                    // Find an overall result...
                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;

                    for (const measurementValue of measurement.values)
                    {
                        if (sessionResult                   == chargyInterfaces.SessionVerificationResult.ValidSignature &&
                            measurementValue.result?.status != chargyInterfaces.VerificationResult.ValidSignature)
                        {
                            sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSignature;
                        }
                    }

                }

                else
                    sessionResult = chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }
        }

        return {
            status:    sessionResult,
            certainty: 0
        }

    }

    async VerifyMeasurement(measurementValue: IBSMMeasurementValue): Promise<IBSMCrypt01Result>
    {

        function setResult(verificationResult: chargyInterfaces.VerificationResult)
        {
            cryptoResult.status        = verificationResult;
            measurementValue.result    = cryptoResult;
            return cryptoResult;
        }

        // function setErrorResult(errorMessage: string)
        // {
        //     cryptoResult.status        = chargyInterfaces.VerificationResult.ValidationError;
        //     cryptoResult.errors?.push(errorMessage);
        //     measurementValue.result    = cryptoResult;
        //     return cryptoResult;
        // }


        // https://github.com/chargeITmobility/bsm-python-private/blob/30abc7ba958c936fdb952ed1f121e45d0818419c/doc/examples/snapshots.md#snapshot-creation

        // Typ         (0)                 => 00000000 00 ff
        // RCR         (150 Wh)            => 00000096 00 1e
        // TotWhImp    (88350 Wh)          => 0001591e 00 1e
        // W           (0.0 W)             => 00000000 01 1b
        // MA1         (001BZR1521070003)  => 00000010 303031425a5231353231303730303033
        // RCnt        (22111)             => 0000565f 00 ff
        // OS          (1840464 s)         => 001c1550 00 07
        // Epoch       (1602156057 s)      => 5f7ef619 00 07
        // TZO         (120 min)           => 00000078 00 06
        // EpochSetCnt (12174)             => 00002f8e 00 ff
        // EpochSetOS  (1829734 s)         => 001beb66 00 07
        // DI          (1)                 => 00000001 00 ff
        // DO          (0)                 => 00000000 00 ff
        // Meta1       (demo data 1)       => 0000000b 64656d6f20646174612031
        // Meta2       ()                  => 00000000
        // Meta3       ()                  => 00000000
        // Evt         (0)                 => 00000000 00 ff

        // Byte array to be hashed: 0000000000ff00000096001e0001591e001e00000000011b00000010303031425a52313532313037303030330000565f00ff001c155000075f7ef619000700000078000600002f8e00ff001beb6600070000000100ff0000000000ff0000000b64656d6f2064617461203100000000000000000000000000ff
        // SHA256 value:            cfbc3ac362fe24e1913ec5651f69dd4744ba256de990fa767a9c58279b47353b
        // Public Key:              3059301306072a8648ce3d020106082a8648ce3d030107034200044bfd02c1d85272ceea9977db26d72cc401d9e5602faeee7ec7b6b62f9c0cce34ad8d345d5ac0e8f65deb5ff0bb402b1b87926bd1b7fc2dbc3a9774e8e70c7254
        // Signature:               3045022100895b68a977654fc052988310dc92aad5f7191ec936acbb7bfa322130171ff06002205de10b55b48e2e08c59e03108d67e5f3e72ed62b10b77b705cae6d3e73ce73b9

        // measurementValue.Typ           = 0;
        // measurementValue.RCR           = 150;
        // measurementValue.TotWhImp      = 88350;
        // measurementValue.W             = 0;
        // measurementValue.MA1           = "001BZR1521070003";
        // measurementValue.RCnt          = 22111;
        // measurementValue.OS            = 1840464;
        // measurementValue.Epoch         = 1602156057;
        // measurementValue.TZO           = 120;
        // measurementValue.EpochSetCnt   = 12174;
        // measurementValue.EpochSetOS    = 1829734;
        // measurementValue.DI            = 1;
        // measurementValue.DO            = 0;
        // measurementValue.Meta1         = "demo data 1";
        // measurementValue.Meta2         = "";
        // measurementValue.Meta3         = "";
        // measurementValue.Evt           = 0;

        // # Numerical Values
        // 
        // `vvvvvvvv ss uu` means:
        // - A 32 bit representation of the numerical value `vvvvvvvv`
        // - A signed 8 bit scale factor exponent `ss`
        // - The unsigned 8 bit representation `uu` of the DLMS code for its unit (OBIS)
        // 
        // For example...
        // - In its base unit Wh: 36.6 kWh = 36600 Wh = 0x8ef8 Wh
        // - This would require a scale factor of 1 = 10^0, thus the scale factor exponent 0
        // - The DLMS unit code for Wh 30 = 0x1e
        // - Which results in 00008ef8 00 1e

        // # String Values
        // 
        // String values are represented by:
        // - Its length as an unsigned 32 bit value
        // - Catenated with its actual data bytes
        // 
        // For example...
        // - The string `ABC` will be represented as `00000003 414243`

        measurementValue.method = this;

        const MA1_length    = new TextEncoder().encode(measurementValue.MA1  ).length + 4;
        const Meta1_length  = new TextEncoder().encode(measurementValue.Meta1).length + 4;
        const Meta2_length  = new TextEncoder().encode(measurementValue.Meta2).length + 4;
        const Meta3_length  = new TextEncoder().encode(measurementValue.Meta3).length + 4;
        const requiredSize  = 13*6 + MA1_length + Meta1_length + Meta2_length + Meta3_length;
        const buffer        = new ArrayBuffer(requiredSize);
        const cryptoBuffer  = new DataView(buffer);

        // TODO: Use units and scale factors from input data instead of making
        // assumptions about them.
        const cryptoResult:IBSMCrypt01Result = {
            status:        chargyInterfaces.VerificationResult.InvalidSignature,
            ArraySize:     requiredSize,
            Typ:           chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.Typ,          0, 255,   0),
            RCR:           chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.RCR,          measurementValue.RCR_SF,  30,   6),
            TotWhImp:      chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.TotWhImp,     measurementValue.TotWhImp_SF,  30,  12),
            W:             chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.W,            measurementValue.W_SF,  27,  18),
            MA1:           chargyLib.SetText_withLength(cryptoBuffer, measurementValue.MA1,                   24),
            RCnt:          chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.RCnt,         0, 255,  24 + MA1_length),
            OS:            chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.OS,           0,   7,  30 + MA1_length),
            Epoch:         chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.Epoch,        0,   7,  36 + MA1_length),
            TZO:           chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.TZO,          0,   6,  42 + MA1_length),
            EpochSetCnt:   chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.EpochSetCnt,  0, 255,  48 + MA1_length),
            EpochSetOS:    chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.EpochSetOS,   0,   7,  54 + MA1_length),
            DI:            chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.DI,           0, 255,  60 + MA1_length),
            DO:            chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.DO,           0, 255,  66 + MA1_length),
            Meta1:         chargyLib.SetText_withLength(cryptoBuffer, measurementValue.Meta1,                 72 + MA1_length),
            Meta2:         chargyLib.SetText_withLength(cryptoBuffer, measurementValue.Meta2,                 72 + MA1_length + Meta1_length),
            Meta3:         chargyLib.SetText_withLength(cryptoBuffer, measurementValue.Meta3,                 72 + MA1_length + Meta1_length + Meta2_length),
            Evt:           chargyLib.SetUInt32_withCode(cryptoBuffer, measurementValue.Evt,          0, 255,  72 + MA1_length + Meta1_length + Meta2_length + Meta3_length),
        };

        const firstSignature = measurementValue.signatures?.[0];
        if (firstSignature != null)
        {

            const signatureExpected = firstSignature as chargyInterfaces.ISignatureRS;

            try
            {

                cryptoResult.sha256value = (await chargyLib.sha256(cryptoBuffer));

                const meter = measurementValue.measurement !== undefined
                                  ? this.chargy.GetMeter(measurementValue.measurement.energyMeterId)
                                  : undefined;

                cryptoResult.signature = {
                    algorithm:  (measurementValue.measurement?.signatureInfos ?? meter?.signatureInfos)?.algorithm,
                    format:     (measurementValue.measurement?.signatureInfos ?? meter?.signatureInfos)?.format,
                    r:          signatureExpected.r,
                    s:          signatureExpected.s
                };

                if (meter != null)
                {

                    cryptoResult.meter = meter;

                    if (meter.publicKeys != null && meter.publicKeys.length > 0)
                    {

                        try
                        {

                            cryptoResult.publicKey            = meter.publicKeys[0]?.value;
                            cryptoResult.publicKeyFormat      = meter.publicKeys[0]?.format;
                            cryptoResult.publicKeySignatures  = meter.publicKeys[0]?.signatures;
                            let publicKey                     = cryptoResult.publicKey ?? "";

                            if (cryptoResult.publicKeyFormat == "DER")
                            {

                                // https://lapo.it/asn1js/ for a visual check...
                                // https://github.com/indutny/asn1.js
                                const ASN1_OIDs      = this.chargy.asn1.define('OIDs', function() {
                                    this.key('oid').objid()
                                });

                                const ASN1_PublicKey = this.chargy.asn1.define('PublicKey', function() {
                                    this.seq().obj(
                                        this.key('oids').seqof(ASN1_OIDs),
                                        this.key('publicKey').bitstr()
                                    );
                                });

                                const publicKeyDER = ASN1_PublicKey.decode<{ publicKey: { data: ArrayBuffer | Uint8Array } }>(Buffer.from(meter.publicKeys[0]?.value ?? "", 'hex'), 'der');
                                publicKey = chargyLib.buf2hex(publicKeyDER.publicKey.data).toLowerCase();

                            }

                            try
                            {

                                if (this.curve.keyFromPublic(publicKey, 'hex').
                                               verify       (cryptoResult.sha256value,
                                                             cryptoResult.signature))
                                {

                                    if (measurementValue.errors && measurementValue.errors.length > 0)
                                        return setResult(chargyInterfaces.VerificationResult.ValidationError);

                                    return setResult(chargyInterfaces.VerificationResult.ValidSignature);

                                }

                                if (measurementValue.errors && measurementValue.errors.length > 0)
                                    return setResult(chargyInterfaces.VerificationResult.ValidationError);

                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);

                            }
                            catch
                            {
                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
                            }

                        }
                        catch
                        {
                            return setResult(chargyInterfaces.VerificationResult.InvalidPublicKey);
                        }

                    }

                    else
                        return setResult(chargyInterfaces.VerificationResult.PublicKeyNotFound);

                }

                else
                    return setResult(chargyInterfaces.VerificationResult.EnergyMeterNotFound);

            }
            catch
            {
                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
            }

        }

        return {} as IBSMCrypt01Result;

    }

    async ViewMeasurement(measurementValue:      IBSMMeasurementValue,
                          errorDiv:              HTMLDivElement,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement) : Promise<Error | undefined>
    {

        if (measurementValue.measurement === undefined)
            return new Error("Invalid measurement!");

        const result = measurementValue.result as IBSMCrypt01Result;

        //#region Headline / Introduction

        introDiv.innerHTML = this.chargy.GetLocalizedMessage("The following data of the charging session is relevant for metrological and legal metrological purposes and therefore part of the digital signature").
                                         replace("{methodName}",       "BSMCrypt01").
                                         replace("{cryptoAlgorithm}",   this.description);

        //#endregion


        //#region Plain text

        if (PlainTextDiv.parentElement     != undefined &&
            PlainTextDiv.parentElement.children[0] != undefined)
        {
            PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (" + (measurementValue.result as IBSMCrypt01Result).ArraySize.toString() + " Bytes, hex)";
        }

        PlainTextDiv.style.fontFamily  = "";
        PlainTextDiv.style.whiteSpace  = "";
        PlainTextDiv.style.maxHeight   = "";
        PlainTextDiv.style.overflowY   = "";

        // https://github.com/chargeITmobility/bsm-python-private/blob/30abc7ba958c936fdb952ed1f121e45d0818419c/doc/examples/snapshots.md#verifying-a-snapshot-with-the-bsm-tool

        this.CreateLine("Snapshot-Typ", this.ParseTyp(measurementValue.Typ),                                                                                             result.Typ         || "", infoDiv, PlainTextDiv);
        //this.CreateLine("RCR",         (measurementValue.RCR      * 10).toFixed(measurementValue.RCR_Precision)      + " " + measurementValue.RCR_Prefix      + "Wh",    result.RCR         || "", infoDiv, PlainTextDiv);
        //this.CreateLine("TotWhImp",    (measurementValue.TotWhImp * 10).toFixed(measurementValue.TotWhImp_Precision) + " " + measurementValue.TotWhImp_Prefix + "Wh",    result.TotWhImp    || "", infoDiv, PlainTextDiv);
        //this.CreateLine("W",            measurementValue.W.             toFixed(measurementValue.W_Precision)        + " " + measurementValue.W_Prefix        + "Watt",  result.W           || "", infoDiv, PlainTextDiv);
        this.CreateLine("RCR",         (measurementValue.RCR      * (10 ** measurementValue.RCR_SF     )).toString() + " " + measurementValue.RCR_Unit,                  result.RCR         || "", infoDiv, PlainTextDiv);
        this.CreateLine("TotWhImp",    (measurementValue.TotWhImp * (10 ** measurementValue.TotWhImp_SF)).toString() + " " + measurementValue.TotWhImp_Unit,             result.TotWhImp    || "", infoDiv, PlainTextDiv);
        this.CreateLine("W",           (measurementValue.W        * (10 ** measurementValue.W_SF       )).toString() + " " + measurementValue.W_Unit,                    result.W           || "", infoDiv, PlainTextDiv);
        this.CreateLine("MA1",          measurementValue.MA1,                                                                                                            result.MA1         || "", infoDiv, PlainTextDiv);
        this.CreateLine("RCnt",         measurementValue.RCnt,                                                                                                           result.RCnt        || "", infoDiv, PlainTextDiv);
        this.CreateLine("OS",           measurementValue.OS,                                                                                                             result.OS          || "", infoDiv, PlainTextDiv);
        this.CreateLine("Zeitstempel",  chargyLib.UTC2human(measurementValue.Epoch),                                                                                     result.Epoch       || "", infoDiv, PlainTextDiv);
        this.CreateLine("TZO",          measurementValue.TZO.toString() + " Minuten",                                                                                    result.TZO         || "", infoDiv, PlainTextDiv);
        this.CreateLine("EpochSetCnt",  measurementValue.EpochSetCnt,                                                                                                    result.EpochSetCnt || "", infoDiv, PlainTextDiv);
        this.CreateLine("EpochSetOS",   measurementValue.EpochSetOS,                                                                                                     result.EpochSetOS  || "", infoDiv, PlainTextDiv);
        this.CreateLine("DI",           measurementValue.DI,                                                                                                             result.DI          || "", infoDiv, PlainTextDiv);
        this.CreateLine("DO",           measurementValue.DO,                                                                                                             result.DO          || "", infoDiv, PlainTextDiv);
        this.CreateLine("Meta1",        measurementValue.Meta1,                                                                                                          result.Meta1       || "", infoDiv, PlainTextDiv);
        this.CreateLine("Meta2",        measurementValue.Meta2,                                                                                                          result.Meta2       || "", infoDiv, PlainTextDiv);
        this.CreateLine("Meta3",        measurementValue.Meta3,                                                                                                          result.Meta3       || "", infoDiv, PlainTextDiv);
        this.CreateLine("Evt",          this.ParseEvents(measurementValue.Evt).join("<br>"),                                                                             result.Evt         || "", infoDiv, PlainTextDiv);

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv.parentElement != undefined &&
            HashedPlainTextDiv.parentElement.children[0] != undefined)
        {
            HashedPlainTextDiv.parentElement.children[0].innerHTML  = "Hashed plain text (SHA256, hex)";
        }

        HashedPlainTextDiv.innerHTML                                = result.sha256value?.match(/.{1,8}/g)?.join(" ") ?? "";

        //#endregion

        //#region Public Key

        if (result.publicKey != null &&
            result.publicKey != "")
        {

            if (PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[0] != undefined)
            {
                PublicKeyDiv.parentElement.children[0].innerHTML  = "Public Key (" +
                                                                    (result.publicKeyFormat
                                                                        ? result.publicKeyFormat + ", "
                                                                        : "") +
                                                                    "hex)";
            }

            if (!chargyLib.IsNullOrEmpty(result.publicKey))
                PublicKeyDiv.innerHTML                            = result.publicKey.startsWith("04") // Add some space after '04' to avoid confused customers
                                                                        ? "<span class=\"leadingFour\">04</span> "
                                                                              + (result.publicKey.substring(2).match(/.{1,8}/g)?.join(" ") ?? "-")
                                                                        :        result.publicKey.             match(/.{1,8}/g)?.join(" ") ?? "-";


            //#region Public key signatures

            if (PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement.children[3] != undefined)
            {
                PublicKeyDiv.parentElement.children[3].innerHTML = "";
            }

            if (result.publicKeySignatures) {

                for (const signature of result.publicKeySignatures)
                {

                    try
                    {

                        const signatureDiv = PublicKeyDiv.parentElement?.children[3]?.appendChild(document.createElement('div'));

                        if (signatureDiv                                                                  != null &&
                            measurementValue.measurement.chargingSession                                  != null &&
                            measurementValue.measurement.chargingSession.EVSE                             != null &&
                            measurementValue.measurement.chargingSession.EVSE.meters.length                > 0    &&
                            measurementValue.measurement.chargingSession.EVSE.meters[0]                   != null &&
                            measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys        != null &&
                            measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys.length  > 0)
                        {

                            signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(
                                                               measurementValue.measurement.chargingSession.chargingStation,
                                                               measurementValue.measurement.chargingSession.EVSE,
                                                               measurementValue.measurement.chargingSession.EVSE.meters[0],
                                                               measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys[0],
                                                               signature
                                                           );

                        }

                    }
                    catch (exception)
                    {
                        return new Error("Error while checking public key signature: " + (exception instanceof Error ? exception.message : String(exception)));
                    }

                }

            }

            //#endregion

        }

        //#endregion

        //#region Signature expected

        if (result.signature != null)
        {

            if (SignatureExpectedDiv.parentElement != undefined &&
                SignatureExpectedDiv.parentElement.children[0] != undefined)
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";
            }

            if (result.signature.r && result.signature.s)
                SignatureExpectedDiv.innerHTML  = "r: " + (result.signature.r.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-") + "<br />" +
                                                  "s: " + (result.signature.s.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-");

            else if (result.signature.value)
                SignatureExpectedDiv.innerHTML  = result.signature.value.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

        }

        //#endregion


        //#region Signature check

        switch (result.status)
        {

            case chargyInterfaces.VerificationResult.UnknownCTRFormat:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                break;

            case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                break;

            case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case chargyInterfaces.VerificationResult.InvalidPublicKey:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                break;

            case chargyInterfaces.VerificationResult.InvalidSignature:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

            case chargyInterfaces.VerificationResult.ValidSignature:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;


            default:
                SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                break;

        }

        //#endregion

    }


    //#region Helper methods

    private PrefixConverter(input: string): chargyInterfaces.DisplayPrefixes {
        switch(input.toLowerCase()) {
            case "kilo":  return chargyInterfaces.DisplayPrefixes.KILO;
            case "mega":  return chargyInterfaces.DisplayPrefixes.MEGA;
            case "giga":  return chargyInterfaces.DisplayPrefixes.GIGA;
            default:      return chargyInterfaces.DisplayPrefixes.NULL;
        }
    }

    private UnitConverter(input: string): string{
        switch(input.toUpperCase()) {
            case "WATT_HOUR":  return "Wh";
            case "WATT":       return "W";
            default:           return "";
        }
    }

    public ParseTyp(value: number) : string
    {
        switch (value)
        {
            case 0:   return "CURRENT";    // Signed snapshot of the current meter data at the time of its creation.
            case 1:   return "TURN ON";    // Signed snapshot created during executing the turn-on sequence for an external contactor.
            case 2:   return "TURN OFF";   // Signed snapshot created during the execution of the turn-off sequence for an external contactor.
            case 3:   return "START";      // Signed snapshot marking the start of a charging process without executing the turn-on sequence for an external contactor.
            case 4:   return "END";        // Signed snapshot marking the end of a charging process without executing the turn-off sequence for an external contactor.
            default:  return "<unknown>";
        }
    }

    public ParseEvents(value: number) : string[]
    {

        const events: string[] = [];

        if ((value & (1 <<  1)) != 0) events.push("Power Failure");
        if ((value & (1 <<  2)) != 0) events.push("Under Voltage");
        if ((value & (1 <<  3)) != 0) events.push("Low PF");
        if ((value & (1 <<  4)) != 0) events.push("Over Current");
        if ((value & (1 <<  5)) != 0) events.push("Over Voltage");
        if ((value & (1 <<  6)) != 0) events.push("Missing Sensor");

        if ((value & (1 <<  7)) != 0) events.push("Reserved 1");
        if ((value & (1 <<  8)) != 0) events.push("Reserved 2");
        if ((value & (1 <<  9)) != 0) events.push("Reserved 3");
        if ((value & (1 << 10)) != 0) events.push("Reserved 4");
        if ((value & (1 << 11)) != 0) events.push("Reserved 5");
        if ((value & (1 << 12)) != 0) events.push("Reserved 6");
        if ((value & (1 << 13)) != 0) events.push("Reserved 7");
        if ((value & (1 << 14)) != 0) events.push("Reserved 8");

        if ((value & (1 << 15)) != 0) events.push("Meter Fatal Error");
        if ((value & (1 << 16)) != 0) events.push("CM Init Failed");
        if ((value & (1 << 17)) != 0) events.push("CM Firmware Hash Mismatch");
        if ((value & (1 << 18)) != 0) events.push("CM Development Mode");

        if ((value & (1 << 19)) != 0) events.push("OEM 05");
        if ((value & (1 << 20)) != 0) events.push("OEM 06");
        if ((value & (1 << 21)) != 0) events.push("OEM 07");
        if ((value & (1 << 22)) != 0) events.push("OEM 08");
        if ((value & (1 << 23)) != 0) events.push("OEM 09");
        if ((value & (1 << 24)) != 0) events.push("OEM 10");
        if ((value & (1 << 25)) != 0) events.push("OEM 11");
        if ((value & (1 << 26)) != 0) events.push("OEM 12");
        if ((value & (1 << 27)) != 0) events.push("OEM 13");
        if ((value & (1 << 28)) != 0) events.push("OEM 14");
        if ((value & (1 << 29)) != 0) events.push("OEM 15");

        return events;

    }

    private DecodeStatus(statusValue: string) : Array<string>
    {

        const statusArray:string[] = [];

        try
        {

            const status = parseInt(statusValue);

            if ((status &  1) ==  1)
                statusArray.push("Fehler erkannt");

            if ((status &  2) ==  2)
                statusArray.push("Synchrone Messwertübermittlung");

            // Bit 3 is reserved!

            if ((status &  8) ==  8)
                statusArray.push("System-Uhr ist synchron");
            else
                statusArray.push("System-Uhr ist nicht synchron");

            if ((status & 16) == 16)
                statusArray.push("Rücklaufsperre aktiv");

            if ((status & 32) == 32)
                statusArray.push("Energierichtung -A");

            if ((status & 64) == 64)
                statusArray.push("Magnetfeld erkannt");

        }
        catch
        {
            statusArray.push("Invalid status!");
        }

        return statusArray;

    }

    //#endregion

}
