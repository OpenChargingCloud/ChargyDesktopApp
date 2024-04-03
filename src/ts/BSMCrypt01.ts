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


export interface IBSMMeasurementValue extends chargyInterfaces.IMeasurementValue
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

export interface IBSMCrypt01Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  any,
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
    publicKeySignatures?:          any,
    signature?:                    chargyInterfaces.ISignatureRS
}


export class BSMCrypt01 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy: Chargy) {
        super("ECC secp256r1",
              chargy);
    }


    public async tryToParseBSM_WS36aMeasurements(CTR:                   chargyInterfaces.IChargeTransparencyRecord,
                                                 ExpectedEVSEId:        string,
                                                 ExpectedCscSwVersion:  string|null,
                                                 Measurements:          Array<any>) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
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

        const errors    = new Array<String>();
        const warnings  = new Array<String>();

        // How sure we are, that this is really a BSM meter value format
        let numberOfFormatChecks  = 2*39; // At least two signed meter values!
        let secondaryErrors       = 0;

        //#endregion

        try
        {

            //#region Validate values

            if (!chargyLib.isMandatoryString(firstMeasurement["@context"]))
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_JSONContextP",               1));


            const meterInfo = firstMeasurement.meterInfo;
            if (!chargyLib.isMandatoryJSONObject(meterInfo))
            {
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfoP", 1));
                secondaryErrors += 5;
            }
            else
            {

                if (!chargyLib.isMandatoryString(meterInfo.firmwareVersion))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_FirmwareVersionP", 1));

                if (!chargyLib.isMandatoryString(meterInfo.publicKey))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       1));

                if (!chargyLib.isMandatoryString(meterInfo.meterId))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         1));

                if (!chargyLib.isMandatoryString(meterInfo.manufacturer))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    1));

                if (!chargyLib.isMandatoryString(meterInfo.type))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_TypeP",            1));

            }

            const contract = firstMeasurement.contract;
            if (!chargyLib.isMandatoryJSONObject(contract))
            {
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ContractP", 1));
                secondaryErrors += 2;
            }
            else
            {

                if (!chargyLib.isMandatoryString(contract.id))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_IdP",               1));

                if (!chargyLib.isOptionalString(contract.type))
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TypeP",             1));

            }

            const value = firstMeasurement.value;
            if (!chargyLib.isMandatoryJSONObject(value))
            {
                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ValueP",                         1));
                secondaryErrors += 8;
            }
            else
            {

                const measurand = value.measurand;
                if (!chargyLib.isMandatoryJSONObject(measurand))
                {
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurandP",                 1));
                    secondaryErrors += 2;
                }
                else
                {

                    if (!chargyLib.isMandatoryString(measurand.id))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_Measurand_IdentificationP",               1));

                    if (!chargyLib.isMandatoryString(measurand.name))
                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_Measurand_NameP",                         1));

                }

                const measuredValue = value.measuredValue;
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


            let common = {

                context:                           firstMeasurement["@context"],

                meterInfo_firmwareVersion:         firstMeasurement.meterInfo?.firmwareVersion,
                meterInfo_publicKey:               firstMeasurement.meterInfo?.publicKey,
                meterInfo_meterId:                 firstMeasurement.meterInfo?.meterId,
                meterInfo_manufacturer:            firstMeasurement.meterInfo?.manufacturer,
                meterInfo_type:                    firstMeasurement.meterInfo?.type,

                contract_id:                       firstMeasurement.contract?.id,
                contract_type:                     firstMeasurement.contract?.type,

                value_measurand_id:                firstMeasurement.value?.measurand?.id,               // OBIS Id
                value_measurand_name:              firstMeasurement.value?.measurand?.name,

                value_measuredValue_scale:         firstMeasurement.value?.measuredValue?.scale,
                value_measuredValue_unit:          firstMeasurement.value?.measuredValue?.unit,
                value_measuredValue_unitEncoded:   firstMeasurement.value?.measuredValue?.unitEncoded,
                value_measuredValue_valueType:     firstMeasurement.value?.measuredValue?.valueType,

                value_displayedFormat_prefix:      firstMeasurement.value?.displayedFormat?.prefix,     // "kilo"
                value_displayedFormat_precision:   firstMeasurement.value?.displayedFormat?.precision,  // 2

                chargePoint_softwareVersion:       firstMeasurement.chargePoint?.softwareVersion,
                MA1:                               null as string|null,
                epochSetCnt:                       -1,
                epochSetOS:                        -1,
                dataSets:                          [] as any[]

            };

            //#endregion

            //#region Data

            let Typ                     = 0;      // Snapshot Type
            let RCR:          any[]     = [];     // !!! Real energy imported since the last execution of the turn-on sequence
            let TotWhImp:     any[]     = [];     // !!! Total Real Energy Imported
            let W:            any[]     = [];     // !!! Total Real Power
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


            let previousId              = "";
            let previousTime            = "";
            let previousMeasurementId   = "";
            let previousValue           = "";

            let previousRCR             = -1;
            let previousRCnt            = -1;
            let previousOS              = -1;
            let previousEpoch           = -1;

            let previousCscSwVersion: string|null = null;

            let measurementCounter      = 0;

            //#endregion

            for (const currentMeasurement of Measurements)
            {

                let currentErrors:   Array<string>  = [];
                let currentWarnings: Array<string>  = [];

                measurementCounter++;

                //#region Validate common values

                if (currentMeasurement["@context"] !== common.context)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_JSONContextP", measurementCounter));

                let currentId = currentMeasurement["@id"];
                if (previousId !== "" && typeof currentId === 'string')
                {
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


                if (previousTime !== "" && currentMeasurement.time <= previousTime)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_TimestampP", measurementCounter));
                previousTime = currentMeasurement.time;

                if (previousValue !== "" && currentMeasurement.value?.measuredValue?.value < previousValue)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurement_ValueP", measurementCounter));
                previousValue = currentMeasurement.value?.measuredValue?.value;


                if (currentMeasurement.meterInfo)
                {

                    if (currentMeasurement.meterInfo?.firmwareVersion    !== common.meterInfo_firmwareVersion)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_FirmwareVersionP", measurementCounter));

                    if (currentMeasurement.meterInfo?.publicKey          !== common.meterInfo_publicKey)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_PublicKeyP",       measurementCounter));

                    if (currentMeasurement.meterInfo?.meterId            !== common.meterInfo_meterId)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_MeterIdP",         measurementCounter));

                    if (currentMeasurement.meterInfo?.meterId            !== currentMeasurement.additionalValues?.filter((element: any) => element?.measurand?.name === "MA1")[0]?.measuredValue?.value)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_MeterIdP",         measurementCounter));

                    if (currentMeasurement.meterInfo?.manufacturer       !== common.meterInfo_manufacturer)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_MeterInfo_ManufacturerP",    measurementCounter));

                    if (currentMeasurement.meterInfo?.type               !== common.meterInfo_type)
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

                if (currentMeasurement.contract)
                {

                    if (currentMeasurement.additionalValues?.filter((element: any) => element?.measurand?.name?.startsWith('Meta') && element?.measuredValue?.value?.startsWith('contract-id:')).length == 0)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",      measurementCounter));

                    if (currentMeasurement.contract.id   !== common.contract_id)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",      measurementCounter));

                    if (currentMeasurement.contract.type !== common.contract_type)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_TypeP",    measurementCounter));

                    let contractInfo = currentMeasurement.additionalValues?.filter((element: any) => element?.measurand?.name?.startsWith('Meta') && element?.measuredValue?.value?.startsWith('contract-id:'))[0]?.measuredValue?.value;
                    if (contractInfo != null)
                    {

                        if ( currentMeasurement.contract.type && contractInfo !== "contract-id: " + common.contract_type + ":" + common.contract_id)
                            currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",  measurementCounter));

                        if (!currentMeasurement.contract.type && contractInfo !== "contract-id: " + common.contract_id)
                            currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_Contract_IdP",  measurementCounter));

                    }

                }


                // Cross-check that value matches the common value (besides
                // measuredValue.value) and is identical to the signed RCR from
                // the additional values array.

                const rcrInAdditional = currentMeasurement.additionalValues?.find((element: any) => element.measurand.name == 'RCR')

                if (currentMeasurement.value.measurand)
                {

                    const measurand = currentMeasurement.value.measurand

                    if (measurand.id   !== common.value_measurand_id   || measurand.id   !== rcrInAdditional.measurand.id)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurand_IdentificationP", measurementCounter));

                    if (measurand.name !== common.value_measurand_name || measurand.name !== rcrInAdditional.measurand.name)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurand_NameP",           measurementCounter));

                }

                if (currentMeasurement.value.measuredValue)
                {

                    const measuredValue = currentMeasurement.value.measuredValue;

                    if (measuredValue.value       !== rcrInAdditional.measuredValue.value)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValueP",             measurementCounter));

                    if (measuredValue.scale       !== common.value_measuredValue_scale       || measuredValue.scale       !== rcrInAdditional.measuredValue.scale)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_ScaleP",       measurementCounter));

                    if (measuredValue.unit        !== common.value_measuredValue_unit        || measuredValue.unit        !== rcrInAdditional.measuredValue.unit)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_UnitP",        measurementCounter));

                    if (measuredValue.unitEncoded !== common.value_measuredValue_unitEncoded || measuredValue.unitEncoded !== rcrInAdditional.measuredValue.unitEncoded)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_UnitEncodedP", measurementCounter));

                    if (measuredValue.valueType   !== common.value_measuredValue_valueType   || measuredValue.valueType   !== rcrInAdditional.measuredValue.valueType)
                        currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_SignedMeterValue_TypeP",        measurementCounter));

                }

                if (currentMeasurement.chargePoint && currentMeasurement.chargePoint.softwareVersion !== common.chargePoint_softwareVersion)
                    currentErrors.push(this.chargy.GetLocalizedMessage("Inconsistent_ChargingStation_FirmwareVersion"));

                //#region Find "evse-id:"        within the "Meta" data blocks

                let signedEVSEId = currentMeasurement.additionalValues?.filter((element: any) => element.measurand.name?.startsWith('Meta') && element.measuredValue.value?.startsWith('evse-id:'));
                if (signedEVSEId.length == 1)
                {

                    const evse__id = (signedEVSEId[0].measuredValue.value as String).replace('evse-id:', '').trim();

                    if (evse__id !== 'unknown' && ExpectedEVSEId !== evse__id)
                        currentErrors.push(this.chargy.GetLocalizedMessage("Inconsistent_EVSE_Identification"));

                }

                //#endregion

                //#region Find "csc-sw-version:" within the "Meta" data blocks

                let signedCSCSWVersion = currentMeasurement.additionalValues?.filter((element: any) => element.measurand.name?.startsWith('Meta') && element.measuredValue.value?.startsWith('csc-sw-version:'));
                if (signedCSCSWVersion.length == 1)
                {

                    const csc_sw_version = (signedCSCSWVersion[0]?.measuredValue?.value as String)?.replace('csc-sw-version:', '')?.trim();

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

                for(const additionalValue of currentMeasurement.additionalValues)
                {
                    switch (additionalValue.measurand?.name)
                    {
                        case "Typ":          Typ          =   additionalValue.measuredValue?.value;         break;
                        case "RCR":          RCR          = [ additionalValue.measurand?.id,
                                                              additionalValue.measuredValue?.scale,
                                                              additionalValue.measuredValue?.unit,
                                                              additionalValue.measuredValue?.unitEncoded,
                                                              additionalValue.measuredValue?.value,
                                                              additionalValue.measuredValue?.valueType,
                                                              additionalValue.displayedFormat?.prefix,
                                                              additionalValue.displayedFormat?.precision ];   break;
                        case "TotWhImp":     TotWhImp     = [ additionalValue.measurand?.id,
                                                              additionalValue.measuredValue?.scale,
                                                              additionalValue.measuredValue?.unit,
                                                              additionalValue.measuredValue?.unitEncoded,
                                                              additionalValue.measuredValue?.value,
                                                              additionalValue.measuredValue?.valueType,
                                                              additionalValue.displayedFormat?.prefix,
                                                              additionalValue.displayedFormat?.precision ]; break;
                        case "W":            W            = [ additionalValue.measurand?.id,
                                                              additionalValue.measuredValue?.scale,
                                                              additionalValue.measuredValue?.unit,
                                                              additionalValue.measuredValue?.unitEncoded,
                                                              additionalValue.measuredValue?.value,
                                                              additionalValue.measuredValue?.valueType,
                                                              additionalValue.displayedFormat?.prefix,
                                                              additionalValue.displayedFormat?.precision ]; break;
                        case "MA1":          MA1          =   additionalValue.measuredValue?.value;         break;
                        case "RCnt":         RCnt         =   additionalValue.measuredValue?.value;         break;
                        case "OS":           OS           =   additionalValue.measuredValue?.value;         break;
                        case "Epoch":        Epoch        =   additionalValue.measuredValue?.value;         break;
                        case "TZO":          TZO          =   additionalValue.measuredValue?.value;         break;
                        case "EpochSetCnt":  EpochSetCnt  =   additionalValue.measuredValue?.value;         break;
                        case "EpochSetOS":   EpochSetOS   =   additionalValue.measuredValue?.value;         break;
                        case "DI":           DI           =   additionalValue.measuredValue?.value;         break;
                        case "DO":           DO           =   additionalValue.measuredValue?.value;         break;
                        case "Meta1":        Meta1        =   additionalValue.measuredValue?.value ?? "";   break;
                        case "Meta2":        Meta2        =   additionalValue.measuredValue?.value ?? "";   break;
                        case "Meta3":        Meta3        =   additionalValue.measuredValue?.value ?? "";   break;
                        case "Evt":          Evt          =   additionalValue.measuredValue?.value;         break;
                    }
                }


                if (previousRCR !== -1 && RCR[4] < previousRCR)
                    currentErrors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_Measurement_ValueP", measurementCounter));
                previousRCR = RCR[4];

                if (RCnt !== currentMeasurement.measurementId)
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

                if (currentMeasurement.time !== measurementTimestamp3)
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
                    time:            currentMeasurement.time,
                    value:           currentMeasurement.value?.measuredValue?.  value,
                    valuePrefix:     this.PrefixConverter(currentMeasurement.value?.displayedFormat?.prefix ?? "kilo"),
                    valuePrecision:  currentMeasurement.value?.displayedFormat?.precision                   ?? 2,
                    measurementId:   currentMeasurement.measurementId,
                    signature:       currentMeasurement.signature,
                    errors:          currentErrors,
                    warnings:        currentWarnings
                }); // as IBSMMeasurementValue);

            }

            //#region Validate consistency of snapshot types

            var n = common.dataSets.length-1;

            if (common.dataSets[0].TypParsed !== "START" && common.dataSets[0].TypParsed !== "TURN ON")
                errors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_EnergyMeterValueP", 1));

            for (let i=1; i<common.dataSets.length-1; i++) {
                if (common.dataSets[i].TypParsed !== "CURRENT")
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_EnergyMeterValueP", measurementCounter + 1));
            }

            if (common.dataSets[n].TypParsed !== "END"   && common.dataSets[n].TypParsed !== "TURN OFF")
                errors.push(this.chargy.GetLocalizedMessageWithParameter("Inconsistent_EnergyMeterValueP", n+1));

            //#endregion

            //#region Set charging session information

            if (CTR.chargingSessions == undefined || CTR.chargingSessions == null)
                CTR.chargingSessions = [];

            const ASN1_SignatureSchema = this.chargy.asn1.define('Signature', function() {
                //@ts-ignore
                this.seq().obj(
                    //@ts-ignore
                    this.key('r').int(),
                    //@ts-ignore
                    this.key('s').int()
                );
            });

            let session = {

                "@id":                          common.meterInfo_meterId + "-" + common.dataSets[0]["Epoch"],
                "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/bsm-ws36a-v0+json",
                "begin":                        common.dataSets[0].time,
                "end":                          common.dataSets[n].time,
                "EVSEId":                       CTR.chargingStationOperators![0]!["chargingStations"]![0]!["EVSEs"]![0]!["@id"],

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
                                "obis":              TotWhImp[0],
                                "unit":              this.UnitConverter  (TotWhImp[2]),
                                "unitEncoded":       TotWhImp[3],
                                "valueType":         TotWhImp[5],
                                "value":             "TotWhImp",
                                "scale":             TotWhImp[1],
                                "formatPrefix":      this.PrefixConverter(TotWhImp[6]),
                                "formatPrecision":   TotWhImp[7],
                             },
                             {
                                "name":              "Total Real Power",
                                "obis":              W[0],
                                "unit":              this.UnitConverter  (W[2]),
                                "unitEncoded":       W[3],
                                "valueType":         W[5],
                                "value":             "W",
                                "scale":             W[1],
                                "formatPrefix":      this.PrefixConverter(W[6]),
                                "formatPrecision":   W[7]
                             }
                         ],
                         "values": [ ]
                    }
                ]

            };

            for (let dataSet of common.dataSets)
            {

                let ASN1Signature:any = {};

                try
                {

                    ASN1Signature = ASN1_SignatureSchema.decode(Buffer.from(dataSet.signature, 'hex'), 'der');

                }
                catch (exception)
                {
                    // Note: Some manipulations will not result in an invalid signature and
                    //       may also not cause an invalid signature validation. This is caused
                    //       by the mathematical nature of these big numbers and not a bug!
                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_SignatureP", 1))
                }

                let bsmMeasurementValue: IBSMMeasurementValue = {

                    timestamp:                                 dataSet.time,
                    Typ:                                       dataSet.Typ,
                    value:                                     dataSet.value,
                    value_displayPrefix:                       dataSet.valuePrefix,
                    value_displayPrecision:                    dataSet.valuePrecision,

                    RCR:                                       dataSet.RCR[4],
                    RCR_SF:                                    dataSet.RCR[1],
                    RCR_Unit:             this.UnitConverter  (dataSet.RCR[2]),
                    RCR_Prefix:           this.PrefixConverter(dataSet.RCR[6]),
                    RCR_Precision:                             dataSet.RCR[7],

                    TotWhImp:                                  dataSet.TotWhImp[4],
                    TotWhImp_SF:                               dataSet.TotWhImp[1],
                    TotWhImp_Unit:        this.UnitConverter  (dataSet.TotWhImp[2]),
                    TotWhImp_Prefix:      this.PrefixConverter(dataSet.TotWhImp[6]),
                    TotWhImp_Precision:                        dataSet.TotWhImp[7],

                    W:                                         dataSet.W[4],
                    W_SF:                                      dataSet.W[1],
                    W_Unit:               this.UnitConverter  (dataSet.W[2]),
                    W_Prefix:             this.PrefixConverter(dataSet.W[6]),
                    W_Precision:                               dataSet.W[7],

                    MA1:                                       dataSet.MA1,
                    RCnt:                                      dataSet.RCnt,
                    OS:                                        dataSet.OS,
                    Epoch:                                     dataSet.Epoch,
                    TZO:                                       dataSet.TZO,
                    EpochSetCnt:                               dataSet.EpochSetCnt,
                    EpochSetOS:                                dataSet.EpochSetOS,
                    DI:                                        dataSet.DI,
                    DO:                                        dataSet.DO,
                    Meta1:                                     dataSet.Meta1,
                    Meta2:                                     dataSet.Meta2,
                    Meta3:                                     dataSet.Meta3,
                    Evt:                                       dataSet.Evt,

                    errors:                                    dataSet.errors,
                    warnings:                                  dataSet.warnings,

                    signatures: [{
                        r:  ASN1Signature?.r?.toString(16) ?? "-",
                        s:  ASN1Signature?.s?.toString(16) ?? "-"
                    }]

                };

                (session.measurements[0]!.values as any[])?.push(bsmMeasurementValue);

            }

            CTR.chargingSessions.push(session as any as chargyInterfaces.IChargingSession);

            //#endregion

            //#region Set other CTR information

            CTR["@id"] = common.dataSets[0]

            if (CTR.chargingSessions)
            {

                if (CTR.begin == undefined || CTR.begin === "" || CTR.begin > CTR.chargingSessions[0]!["begin"])
                    CTR.begin =   CTR.chargingSessions[0]?.begin;

                var end = CTR.chargingSessions[CTR.chargingSessions.length - 1]?.end;
                if (end !== undefined)
                {
                    if (CTR.end == undefined || CTR.end === "" || CTR.end < end)
                        CTR.end = CTR.chargingSessions[CTR.chargingSessions.length - 1]?.end;
                }

            }

            if (CTR.contract == null || CTR.contract == undefined)
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

            (CTR!.chargingStationOperators![0]!.chargingStations![0]!.EVSEs[0]?.meters)?.push({
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
            errors.push("Exception occured: " + (exception instanceof Error ? exception.message : exception));
        }

        return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            errors:    errors,
            warnings:  warnings,
            certainty: 0
        }

    }


    async VerifyChargingSession(chargingSession: chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        var sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSessionFormat;

        if (chargingSession.measurements)
        {
            for (var measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values && measurement.values.length > 1)
                {

                    // Validate...
                    for (var measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IBSMMeasurementValue);
                    }

                    // Find an overall result...
                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;

                    for (var measurementValue of measurement.values)
                    {
                        if (sessionResult                   == chargyInterfaces.SessionVerificationResult.ValidSignature &&
                            measurementValue.result!.status != chargyInterfaces.VerificationResult.ValidSignature)
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

        function setErrorResult(errorMessage: string)
        {
            cryptoResult.status        = chargyInterfaces.VerificationResult.ValidationError;
            cryptoResult.errors?.push(errorMessage);
            measurementValue.result    = cryptoResult;
            return cryptoResult;
        }

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

        let MA1_length    = new TextEncoder().encode(measurementValue.MA1  ).length + 4;
        let Meta1_length  = new TextEncoder().encode(measurementValue.Meta1).length + 4;
        let Meta2_length  = new TextEncoder().encode(measurementValue.Meta2).length + 4;
        let Meta3_length  = new TextEncoder().encode(measurementValue.Meta3).length + 4;
        let requiredSize  = 13*6 + MA1_length + Meta1_length + Meta2_length + Meta3_length;
        let buffer        = new ArrayBuffer(requiredSize);
        let cryptoBuffer  = new DataView(buffer);

        // TODO: Use units and scale factors from input data instead of making
        // assumptions about them.
        let cryptoResult:IBSMCrypt01Result = {
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

        var signatureExpected = measurementValue.signatures?.[0] as chargyInterfaces.ISignatureRS;
        if (signatureExpected != null)
        {

            try
            {

                cryptoResult.sha256value = (await chargyLib.sha256(cryptoBuffer));

                const meter = this.chargy.GetMeter(measurementValue.measurement!.energyMeterId);

                cryptoResult.signature = {
                    algorithm:  (measurementValue.measurement!.signatureInfos ?? meter?.signatureInfos)?.algorithm!,
                    format:     (measurementValue.measurement!.signatureInfos ?? meter?.signatureInfos)?.format!,
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

                            cryptoResult.publicKey            = meter?.publicKeys[0]?.value;
                            cryptoResult.publicKeyFormat      = meter?.publicKeys[0]?.format;
                            cryptoResult.publicKeySignatures  = meter?.publicKeys[0]?.signatures;
                            let publicKey                     = cryptoResult.publicKey;

                            if (cryptoResult.publicKeyFormat == "DER")
                            {

                                // https://lapo.it/asn1js/ for a visual check...
                                // https://github.com/indutny/asn1.js
                                const ASN1_OIDs      = this.chargy.asn1.define('OIDs', function() {
                                    //@ts-ignore
                                    this.key('oid').objid()
                                });

                                const ASN1_PublicKey = this.chargy.asn1.define('PublicKey', function() {
                                    //@ts-ignore
                                    this.seq().obj(
                                        //@ts-ignore
                                        this.key('oids').seqof(ASN1_OIDs),
                                        //@ts-ignore
                                        this.key('publicKey').bitstr()
                                    );
                                });

                                const publicKeyDER = ASN1_PublicKey.decode(Buffer.from(meter?.publicKeys[0]?.value ?? "", 'hex'), 'der');
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
                            catch (exception)
                            {
                                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
                            }

                        }
                        catch (exception)
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
            catch (exception)
            {
                return setResult(chargyInterfaces.VerificationResult.InvalidSignature);
            }

        }

        return {} as IBSMCrypt01Result;

    }

    async ViewMeasurement(measurementValue:      IBSMMeasurementValue,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)
    {

        const result     = measurementValue.result as IBSMCrypt01Result;

        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML = "BSMCrypt01 (" + this.description + ")";

        //#region Plain text

        if (PlainTextDiv != null)
        {

            if (PlainTextDiv                           != undefined &&
                PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement             != undefined &&
                PlainTextDiv.parentElement.children[0] != undefined)
            {
                PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (" + (measurementValue.result as IBSMCrypt01Result)?.ArraySize + " Bytes, hex)";
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
            this.CreateLine("RCR",          measurementValue.RCR      * 10 + " " + measurementValue.RCR_Unit,       result.RCR         || "", infoDiv, PlainTextDiv);
            this.CreateLine("TotWhImp",     measurementValue.TotWhImp * 10 + " " + measurementValue.TotWhImp_Unit,  result.TotWhImp    || "", infoDiv, PlainTextDiv);
            this.CreateLine("W",            measurementValue.W             + " " + measurementValue.W_Unit,         result.W           || "", infoDiv, PlainTextDiv);
            this.CreateLine("MA1",          measurementValue.MA1,                                                                                                            result.MA1         || "", infoDiv, PlainTextDiv);
            this.CreateLine("RCnt",         measurementValue.RCnt,                                                                                                           result.RCnt        || "", infoDiv, PlainTextDiv);
            this.CreateLine("OS",           measurementValue.OS,                                                                                                             result.OS          || "", infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel",  chargyLib.UTC2human(measurementValue.Epoch),                                                                                     result.Epoch       || "", infoDiv, PlainTextDiv);
            this.CreateLine("TZO",          measurementValue.TZO + " Minuten",                                                                                               result.TZO         || "", infoDiv, PlainTextDiv);
            this.CreateLine("EpochSetCnt",  measurementValue.EpochSetCnt,                                                                                                    result.EpochSetCnt || "", infoDiv, PlainTextDiv);
            this.CreateLine("EpochSetOS",   measurementValue.EpochSetOS,                                                                                                     result.EpochSetOS  || "", infoDiv, PlainTextDiv);
            this.CreateLine("DI",           measurementValue.DI,                                                                                                             result.DI          || "", infoDiv, PlainTextDiv);
            this.CreateLine("DO",           measurementValue.DO,                                                                                                             result.DO          || "", infoDiv, PlainTextDiv);
            this.CreateLine("Meta1",        measurementValue.Meta1,                                                                                                          result.Meta1       || "", infoDiv, PlainTextDiv);
            this.CreateLine("Meta2",        measurementValue.Meta2,                                                                                                          result.Meta2       || "", infoDiv, PlainTextDiv);
            this.CreateLine("Meta3",        measurementValue.Meta3,                                                                                                          result.Meta3       || "", infoDiv, PlainTextDiv);
            this.CreateLine("Evt",          this.ParseEvents(measurementValue.Evt).join("<br>"),                                                                             result.Evt         || "", infoDiv, PlainTextDiv);

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv != null)
        {

            if (HashedPlainTextDiv                           != undefined &&
                HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement             != undefined &&
                HashedPlainTextDiv.parentElement.children[0] != undefined)
            {
                HashedPlainTextDiv.parentElement.children[0].innerHTML  = "Hashed plain text (SHA256, hex)";
            }

            HashedPlainTextDiv.innerHTML                                = result.sha256value.match(/.{1,8}/g).join(" ");

        }

        //#endregion

        //#region Public Key

        if (PublicKeyDiv     != null &&
            result.publicKey != null &&
            result.publicKey != "")
        {

            if (PublicKeyDiv                           != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
                PublicKeyDiv.parentElement             != undefined &&
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
                                                                           + result.publicKey.substring(2).match(/.{1,8}/g)!.join(" ")
                                                                       :   result.publicKey.match(/.{1,8}/g)!.join(" ");


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

        if (SignatureExpectedDiv != null && result.signature != null)
        {

            if (SignatureExpectedDiv                           != undefined &&
                SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement             != undefined &&
                SignatureExpectedDiv.parentElement.children[0] != undefined)
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";
            }

            if (result.signature.r && result.signature.s)
                SignatureExpectedDiv.innerHTML  = "r: " + result.signature.r.toLowerCase().match(/.{1,8}/g)?.join(" ") + "<br />" +
                                                  "s: " + result.signature.s.toLowerCase().match(/.{1,8}/g)?.join(" ");

            else if (result.signature.value)
                SignatureExpectedDiv.innerHTML  = result.signature.value.toLowerCase().match(/.{1,8}/g)?.join(" ") ?? "-";

        }

        //#endregion

        //#region Signature check

        if (SignatureCheckDiv != null)
        {
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
        }

        //#endregion

    }


    //#region Helper methods

    private PrefixConverter(input: string): chargyInterfaces.DisplayPrefixes {
        switch(input?.toLowerCase()) {
            case "kilo":  return chargyInterfaces.DisplayPrefixes.KILO; break;
            case "mega":  return chargyInterfaces.DisplayPrefixes.MEGA; break;
            case "giga":  return chargyInterfaces.DisplayPrefixes.GIGA; break;
            default:      return chargyInterfaces.DisplayPrefixes.NULL;
        }
    }

    private UnitConverter(input: string): string{
        switch(input?.toUpperCase()) {
            case "WATT_HOUR":  return "Wh"; break;
            case "WATT":       return "W";  break;
            default:           return "";
        }
    }

    public ParseTyp(value: number) : string
    {
        switch (value)
        {
            case 0: return "CURRENT";       // Signed snapshot of the current meter data at the time of its creation.
            case 1: return "TURN ON";       // Signed snapshot created during executing the turn-on sequence for an external contactor.
            case 2: return "TURN OFF";      // Signed snapshot created during the execution of the turn-off sequence for an external contactor.
            case 3: return "START";         // Signed snapshot marking the start of a charging process without executing the turn-on sequence for an external contactor.
            case 4: return "END";           // Signed snapshot marking the end of a charging process without executing the turn-off sequence for an external contactor.
            default: return "<unknown>";
        }
    }

    public ParseEvents(value: number) : string[]
    {

        let events: string[] = [];

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

        let statusArray:string[] = [];

        try
        {

            let status = parseInt(statusValue);

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
        catch (exception)
        {
            statusArray.push("Invalid status!");
        }

        return statusArray;

    }

    //#endregion

}
