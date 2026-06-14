/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
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

import Decimal                          from 'decimal.js';
import { ACrypt }                       from '../ACrypt'
import type { ISignatureRS }            from './chargyInterfaces';
import * as chargyInterfaces            from './chargyInterfaces'
import * as chargyLib                   from '../chargyLib'
import * as chargeTransparencyLiveLink  from './IChargeTransparencyLiveLink'
import * as publicKeyInfo               from './IPublicKeyInfo';


export function IsAChargeTransparencyRecord(data: unknown): data is IChargeTransparencyRecord
{

    if (!chargyLib.isMandatoryJSONObject(data))
        return false;

    const chargeTransparencyRecord = data as IChargeTransparencyRecord;

    return chargeTransparencyRecord.begin            !== undefined &&
           //chargeTransparencyRecord.end              !== undefined &&
           chargeTransparencyRecord.chargingSessions !== undefined;

}


export interface IChargeTransparencyRecord extends chargyLib.JSONObject
{

    "@id":                      string;
    "@context":                 string | Array<string>;
    begin?:                     string;
    end?:                       string;
    description?:               chargyInterfaces.IMultilanguageText;
    contract?:                  chargyInterfaces.IContract;
    chargingStationOperators?:  Array<chargyInterfaces.IChargingStationOperator>;
    chargingPools?:             Array<chargyInterfaces.IChargingPool>;
    chargingStations?:          Array<chargyInterfaces.IChargingStation>;
    chargingTariffs?:           Array<chargyInterfaces.IChargingTariff>;
    publicKeys?:                Array<publicKeyInfo.   IPublicKeyInfo>;
    chargingSessions?:          Array<IChargingSession>;
    eMobilityProviders?:        Array<chargyInterfaces.IEMobilityProvider>;
    mediationServices?:         Array<chargyInterfaces.IMediationService>;
    verificationResult?:        chargyInterfaces.ISessionCryptoResult;
    invalidDataSets?:           Array<IExtendedFileInfo>;

    // How sure we are that this result is correct!
    // (JSON) transparency records might not always include an unambiguously
    // format identifier. So multiple chargy parsers might be candidates, but
    // hopefully one will be the best matching parser.
    certainty:                  number;

    warnings?:                  Array<string>;
    errors?:                    Array<string>;
    status?:                    chargyInterfaces.SessionVerificationResult;

}






export function IsASessionCryptoResult(data: unknown): data is chargyInterfaces.ISessionCryptoResult
{

    if (!chargyLib.isMandatoryJSONObject(data))
        return false;

    const sessionCryptoResult = data as chargyInterfaces.ISessionCryptoResult;

    return sessionCryptoResult.status !== undefined;

}




export interface IChargingSession
{
    "@id":                      string;
    "@context"?:                string;
    ctr?:                       IChargeTransparencyRecord;
    GUI?:                       HTMLDivElement;
    begin:                      string;
    end?:                       string;     // to allow still running sessions!
    internalSessionId?:         string;
    chargingProductRelevance?:  chargyInterfaces.IChargingProductRelevance,
    description?:               chargyInterfaces.IMultilanguageText;
    chargingStationOperatorId?: string;
    chargingStationOperator?:   chargyInterfaces.IChargingStationOperator;
    chargingPoolId?:            string;
    chargingPool?:              chargyInterfaces.IChargingPool;
    chargingStationId?:         string;
    chargingStation?:           chargyInterfaces.IChargingStation;
    EVSEId:                     string;
    EVSE?:                      chargyInterfaces.IEVSE;
    meterId?:                   string;
    meter?:                     chargyInterfaces.IMeter;
    publicKey?:                 publicKeyInfo.IPublicKeyInfo;
    tariffId?:                  string;
    chargingTariffs?:           Array<chargyInterfaces.IChargingTariff>;
    chargingPeriods?:           Array<chargyInterfaces.IChargingPeriod>;
    totalCosts?:                chargyInterfaces.IChargingCosts;
    authorizationStart:         chargyInterfaces.IAuthorization;
    authorizationStop?:         chargyInterfaces.IAuthorization;
    product?:                   chargyInterfaces.IChargingProduct;
    measurements:               Array<IMeasurement>;
    parking?:                   Array<chargyInterfaces.IParking>;
    transparencyInfos?:         chargyInterfaces.ITransparencyInfos;
    method?:                    ACrypt;
    original?:                  string;
    signature?:                 string|chargyInterfaces.ISignatureRS;
    hashValue?:                 string;
    verificationResult?:        chargyInterfaces.ISessionCryptoResult;
}


export interface IMeasurement
{
    "@context"?:                string;
    chargingSession?:           IChargingSession;
    energyMeterId:              string;
    phenomena?:                 any[];
    name:                       string;
    obis:                       string;
    unit?:                      string;
    unitEncoded?:               number;
    valueType?:                 string;
    scale:                      number;
    verifyChain?:               boolean;
    signatureInfos?:            chargyInterfaces.ISignatureInfos;
    values:                     Array<IMeasurementValue>;
    verificationResult?:        chargyInterfaces.ICryptoResult;
}

export interface IMeasurements
{
    "@context"?:                string;
    values:                     Array<IMeasurement>;
    verificationResult?:        chargyInterfaces.ICryptoResult;
}

export interface IMeasurementValue
{

    measurement?:               IMeasurement;
    method?:                    ACrypt;
    previousValue?:             IMeasurementValue;

    timestamp:                  string;
    value:                      Decimal;
    value_displayPrefix?:       chargyInterfaces.DisplayPrefixes;
    value_displayPrecision?:    number;
    statusMeter?:               string;
    secondsIndex?:              number;
    paginationId?:              number | string;
    logBookIndex?:              string;
    statusAdapter?:             string;

    errors?:                    Array<string>;
    warnings?:                  Array<string>;

    signatures?:                Array<chargyInterfaces.ISignature|ISignatureRS>;
    result?:                    chargyInterfaces.ICryptoResult;

}

export interface IExtendedFileInfo extends chargyInterfaces.IFileInfo {

    result:  IChargeTransparencyRecord                              |
             chargeTransparencyLiveLink.IChargeTransparencyLiveLink |
             publicKeyInfo.IPublicKeyInfo                           |
             publicKeyInfo.IPublicKeyLookup                         |
             chargyInterfaces.ISessionCryptoResult

}


export function CloneCTR(CTR: IChargeTransparencyRecord): IChargeTransparencyRecord
{

    // const jsonSerializer = (key:string, value:any) => {
    //     return value instanceof Decimal ? value.toNumber() : value;
    // };

    const clonedCTR = JSON.parse(JSON.stringify(CTR)) as IChargeTransparencyRecord;   //, jsonSerializer));

    if (clonedCTR.chargingSessions)
    {
        for (const session of clonedCTR.chargingSessions) {
            for (const measurement of session.measurements) {
                for (const value of measurement.values) {
                    if (typeof value.value === 'string' || typeof value.value === 'number')
                        value.value = new Decimal(value.value);
                }
            }
        }
    }

    return clonedCTR;

}
