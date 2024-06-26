﻿/*
 * Copyright (c) 2018-2024 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import { ACrypt }  from './ACrypt'
import Decimal     from 'decimal.js';

export function IsAChargeTransparencyRecord(data: IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult|undefined): data is IChargeTransparencyRecord
{

    if (data == null || data == undefined)
        return false;

    let chargeTransparencyRecord = data as IChargeTransparencyRecord;

    return chargeTransparencyRecord.begin            !== undefined &&
           chargeTransparencyRecord.end              !== undefined &&
           chargeTransparencyRecord.chargingSessions !== undefined;

}

export function IsAPublicKeyInfo(data: any): data is IPublicKeyInfo
{

    if (data == null || data == undefined)
        return false;

    let publicKeyInfo = data as IPublicKeyInfo;

    return publicKeyInfo["@context"]  !== undefined &&
           publicKeyInfo.subject      !== undefined &&
           publicKeyInfo.algorithm    !== undefined &&
           publicKeyInfo.value        !== undefined;

}

export function IsAPublicKeyLookup(data: IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult|undefined): data is IPublicKeyLookup
{

    if (data == null || data == undefined)
        return false;

    let publicKeyLookup = data as IPublicKeyLookup;

    return publicKeyLookup.publicKeys !== undefined;

}

export function IsASessionCryptoResult(data: IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult): data is ISessionCryptoResult
{

    if (data == null || data == undefined)
        return false;

    let sessionCryptoResult = data as ISessionCryptoResult;

    return sessionCryptoResult.status !== undefined;

}

export interface GetChargingPoolFunc {
    (Id: string): IChargingPool|null;
}

export interface GetChargingStationFunc {
    (Id: string): IChargingStation|null;
}

export interface GetEVSEFunc {
    (Id: string): IEVSE|null;
}

export interface GetMeterFunc {
    (Id: string): IMeter|null;
}

export interface CheckMeterPublicKeySignatureFunc {
    (chargingStation:  any|null,
     evse:             any|null,
     meter:            any|null,
     publicKey:        any|null,
     signature:        any|null): Promise<string>;
}

export interface IChargeTransparencyRecord
{

    "@id":                      string;
    "@context":                 string | Array<string>;
    begin?:                     string;
    end?:                       string;
    description?:               IMultilanguageText;
    contract?:                  IContract;
    chargingStationOperators?:  Array<IChargingStationOperator>;
    chargingPools?:             Array<IChargingPool>;
    chargingStations?:          Array<IChargingStation>;
    chargingTariffs?:           Array<IChargingTariff>;
    publicKeys?:                Array<IPublicKeyInfo>;
    chargingSessions?:          Array<IChargingSession>;
    eMobilityProviders?:        Array<IEMobilityProvider>;
    mediationServices?:         Array<IMediationService>;
    verificationResult?:        ISessionCryptoResult;
    invalidDataSets?:           Array<IExtendedFileInfo>;

    // How sure we are that this result is correct!
    // (JSON) transparency records might not always include an unambiguously
    // format identifier. So multiple chargy parsers might be candidates, but
    // hopefully one will be the best matching parser.
    certainty:                  number;

    warnings?:                  Array<String>;
    errors?:                    Array<String>;
    status?:                    SessionVerificationResult;

}

export interface IContract
{
    "@id":                      string;
    "@context"?:                string;
    description?:               IMultilanguageText;
    type?:                      string;
    username?:                  string;
    email?:                     string;
}

export interface IPublicKeyLookup
{
    publicKeys:                 Array<IPublicKeyInfo>;
    status?:                    SessionVerificationResult;
}

export interface IPublicKeyInfo
{
    "@id":                      string; // Just for merging with IChargeTransparencyRecord!
    "@context":                 string;
    subject:                    string|any;
    type?:                      string|IOIDInfo;
    algorithm:                  string|IOIDInfo;
    value:                      string;
    encoding?:                  string;
    signatures?:                Array<IPublicKeysignature>;
    certainty:                  number;
}

export interface IPublicKeysignature
{
    "@id":                      string;
    "@context"?:                string;
    timestamp:                  string;
    keyUsage:                   Array<string>;
}

export interface IOIDInfo
{
    oid:                        string;
    name:                       string;
}

export function ISOIDInfo(data: any): data is IOIDInfo
{

    if (data == null || data == undefined)
        return false;

    let OIDInfo = data as IOIDInfo;

    return OIDInfo.oid !== undefined;

}


export interface IKeyInfo
{
    keyId:                      string;
    keyType:                    string;
    curve:                      string;
    value:                      string;
}

export interface IChargingStationOperator
{
    "@id":                      string;
    "@context"?:                string;
    subCSOIds?:                 Array<string>;
    description?:               IMultilanguageText;
    contact:                    IContact;
    support:                    ISupport;
    privacy:                    IPrivacy;
    geoLocation?:               IGeoLocation;
    chargingPools?:             Array<IChargingPool>;
    chargingStations?:          Array<IChargingStation>;
    EVSEs?:                     Array<IEVSE>;
    publicKeys?:                Array<IPublicKey>;

    chargingTariffs?:           Array<IChargingTariff>;
    parkingTariffs?:            Array<IParkingTariff>;

}

export interface IContact {
    email:                      string;
    web:                        string;
    logoUrl?:                   string;
    address?:                   IAddress;
    publicKeys?:                Array<IPublicKey>
}

export interface ISupport {
    hotline:                    string;
    email:                      string;
    web?:                       string;
    mediationServices?:         Array<string>;
    publicKeys?:                Array<IPublicKey>
}

export interface IPrivacy {
    contact:                    string;
    email:                      string;
    web:                        string;
    publicKeys?:                Array<IPublicKey>
}

export interface IChargingPool
{
    "@id":                      string;
    "@context"?:                string;
    description?:               IMultilanguageText;
    address?:                   IAddress;
    geoLocation?:               IGeoLocation;
    chargingStationOperator?:   IChargingStationOperator;
    chargingStations?:          Array<IChargingStation>;
    chargingTariffs?:           Array<IChargingTariff>;
    publicKeys?:                Array<IPublicKey>;
}

export interface IChargingStation
{
    "@id":                      string;
    "@context"?:                string;
    description?:               IMultilanguageText;
    manufacturer?:              string;
    manufacturerURL?:           string;
    model?:                     string;
    modelURL?:                  string;
    firmwareVersion?:           string;
    firmwareChecksum?:          string;
    hardwareVersion?:           string;
    serialNumber?:              string;
    legalCompliance?:           ILegalCompliance;
    address?:                   IAddress;
    geoLocation?:               IGeoLocation;
    chargingStationOperator?:   IChargingStationOperator;
    chargingPoolId?:            string;
    chargingPool?:              IChargingPool;
    EVSEs:                      Array<IEVSE>;
    EVSEIds?:                   Array<string>;
    meters?:                    Array<IMeter>;
    chargingTariffs?:           Array<IChargingTariff>;
    publicKeys?:                Array<IPublicKey>;
}

export interface IEVSE
{
    "@id":                      string;
    "@context"?:                string;
    description?:               IMultilanguageText;
    chargingStation?:           IChargingStation;
    chargingStationId?:         string;
    meters:                     Array<IMeter>;
    chargingTariffs?:           Array<IChargingTariff>;
    publicKeys?:                Array<IPublicKey>;
    connectors?:                Array<IConnector>;
}

export interface IMeter
{
    "@id":                      string;
    "@context"?:                string;
    description?:               IMultilanguageText;
    manufacturer?:              string;
    manufacturerURL?:           string;
    model?:                     string;
    modelURL?:                  string;
    firmwareVersion?:           string;
    firmwareChecksum?:          string;
    hardwareVersion?:           string;
    legalCompliance?:           ILegalCompliance;
    chargingStation?:           IChargingStation;
    chargingStationId?:         string;
    EVSE?:                      IEVSE;
    EVSEId?:                    string;
    signatureInfos?:            ISignatureInfos;
    signatureFormat?:           string;
    publicKeys?:                Array<IPublicKey>;
}

export interface IConnector {
    type:                       string;
    looses:                     number;
}

export interface IConformity {
    certificateId:              string;
    url?:                       string;
    notBefore:                  string;
    notAfter:                   string;
    officialSoftware?:          Array<ITransparencySoftware>;  // The transparency software that is officially part of the charging station.
    compatibleSoftware?:        Array<ITransparencySoftware>;  // Other transparency softwares, that can verify the transparency record, but are not officially part of the charging station.
    freeText:                   string;
}

export interface ICalibration {
    certificateId:              string;
    url?:                       string;
    notBefore:                  string;
    notAfter:                   string;
    freeText:                   string;
}

export interface ILegalCompliance {
    conformity?:                Array<IConformity>;
    calibration?:               Array<ICalibration>;
    url?:                       string;
    freeText:                   string;
}

export interface IEMobilityProvider
{
    "@id":                      string;
    "@context"?:                string;
    description:                IMultilanguageText;
    chargingTariffs:            Array<IChargingTariff>;
    publicKeys?:                Array<IPublicKey>;
}

export interface ITaxes
{
    "@id":                      string;
    "@context"?:                string;
    description?:               IMultilanguageText;
    percentage:                 number;
}

export interface IMediationService
{
    "@id":                      string;
    "@context"?:                string;
    description:                IMultilanguageText;
    publicKeys?:                Array<IPublicKey>;
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
    chargingProductRelevance?:  IChargingProductRelevance,
    description?:               IMultilanguageText;
    chargingStationOperatorId?: string;
    chargingStationOperator?:   IChargingStationOperator;
    chargingPoolId?:            string;
    chargingPool?:              IChargingPool;
    chargingStationId?:         string;
    chargingStation?:           IChargingStation;
    EVSEId:                     string;
    EVSE?:                      IEVSE;
    meterId?:                   string;
    meter?:                     IMeter;
    publicKey?:                 IPublicKeyInfo;
    tariffId?:                  string;
    chargingTariffs?:           Array<IChargingTariff>;
    chargingPeriods?:           Array<IChargingPeriod>;
    totalCosts?:                IChargingCosts;
    authorizationStart:         IAuthorization;
    authorizationStop?:         IAuthorization;
    product?:                   IChargingProduct;
    measurements:               Array<IMeasurement>;
    parking?:                   Array<IParking>;
    transparencyInfos?:         ITransparencyInfos;
    method?:                    ACrypt;
    original?:                  string;
    signature?:                 string|ISignatureRS;
    hashValue?:                 string;
    verificationResult?:        ISessionCryptoResult;
}

export interface IChargingProduct
{
    "@id":                      string;
    "@context"?:                string;
}

export interface IChargingCosts {
    total:                      number;
    currency:                   string;
    reservation?:               ICost;
    energy?:                    ICost;
    time?:                      ICost;
    idle?:                      ICost;
    flat?:                      IFlatCost;
}

export interface ICost {
    amount:                     number;     // Note: The billed amount might be different from the measured amount!
    unit:                       string;
    cost:                       number;
}

export interface IFlatCost {
    cost:                       number;
}

export interface IParking
{
    "@id":                      string;
    "@context"?:                string;
    begin:                      string;
    end?:                       string;
    overstay?:                  boolean;
}

export interface ITransparencySoftware {
    name:                       string;
    version?:                   string;
    manufacturer?:              string;
    downloadURLs?:              Array<string>;
}

export interface ITransparencyInfos {
    chargingSessionURL?:        string;                        // e.g. https://chargeportal.de.mer.eco/transactions/transparency/$sessionId
    officialSoftware?:          Array<ITransparencySoftware>;  // The transparency software that is officially part of the charging station.
    compatibleSoftware?:        Array<ITransparencySoftware>;  // Other transparency softwares, that can verify the transparency record, but are not officially part of the charging station.
    freeText?:                  string;
}

export interface IAuthorization
{
    "@id":                      string;
    "@context"?:                string;
    type?:                      string;
    timestamp?:                 string;
    chargingStationOperator?:   string;
    roamingNetwork?:            string;
    eMobilityProvider?:         string;
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
    signatureInfos?:            ISignatureInfos;
    values:                     Array<IMeasurementValue>;
    verificationResult?:        ICryptoResult;
}

export interface IMeasurements
{
    "@context"?:                string;
    values:                     Array<IMeasurement>;
    verificationResult?:        ICryptoResult;
}

export interface ISignatureInfos {
    hash:                       CryptoHashAlgorithms|string;
    hashTruncation?:                                 number;
    algorithm:                  CryptoAlgorithms    |string;
    curve:                      IECCurves           |string;
    format:                     SignatureFormats    |string;
    encoding?:                  IEncoding           |string;
}

export enum IECCurves {
    secp192r1   = "secp192r1",
    secp224k1   = "secp224k1",
    secp256k1   = "secp256k1",
    secp256r1   = "secp256r1",
    secp384r1   = "secp384r1",
    secp512r1   = "secp512r1"
}

export enum IEncoding {
    hex         = "hex",
    base64      = "base64"
}

export enum PublicKeyFormats {
    DER         = "DER",
    XY          = "XY"
}

export enum SignatureFormats {
    DER         = "DER",
    RS          = "RS"
}

export enum CryptoAlgorithms {
    RSA         = "RSA",
    ECC         = "ECC"
}

export enum CryptoHashAlgorithms {
    SHA256      = "SHA256",
    SHA384      = "SHA384",
    SHA512      = "SHA512"
}

export enum DisplayPrefixes {
    NULL,
    KILO,
    MEGA,
    GIGA
}


export interface IMeasurementValue
{

    measurement?:               IMeasurement;
    method?:                    ACrypt;
    previousValue?:             IMeasurementValue;

    timestamp:                  string;
    value:                      Decimal;
    value_displayPrefix?:       DisplayPrefixes;
    value_displayPrecision?:    number;
    statusMeter?:               string;
    secondsIndex?:              number;
    paginationId?:              number | string;
    logBookIndex?:              string;
    statusAdapter?:             string;

    errors?:                    Array<string>;
    warnings?:                  Array<string>;

    signatures?:                Array<ISignature|ISignatureRS>;
    result?:                    ICryptoResult;

}

export interface ISessionCryptoResult
{

    status:                     SessionVerificationResult;
    message?:                   string;
    exception?:                 any;

    // How sure we are that this result is correct!
    // (JSON) transparency records might not always include an unambiguously
    // format identifier. So multiple chargy parsers might be candidates, but
    // hopefully one will be the best matching parser.
    certainty:                  number;

    warnings?:                  Array<String>;
    errors?:                    Array<String>;

}

export function isISessionCryptoResult1(obj: any): obj is ISessionCryptoResult {
    return obj.status !== undefined
}

export function isISessionCryptoResult2(obj: any): obj is ISessionCryptoResult {
    return obj.status !== undefined &&
           obj.status !== SessionVerificationResult.InvalidSessionFormat
}

export interface ICryptoResult
{
    status:                     VerificationResult;
    errors?:                    Array<string>;
    warnings?:                  Array<string>;
}

export function isICryptoResult(obj: any): obj is ICryptoResult {
    return obj.status !== undefined
}

export function isIPublicKeyXY(obj: any): obj is IPublicKeyXY {
    return obj && typeof obj.x === "string" && typeof obj.y === "string";
}

export interface IPublicKeyXY extends IPublicKey
{
    x:                          string;
    y:                          string;
}

export interface IPublicKey
{
    algorithm:                  string;
    format:                     string;            // e.g. "DER" | "rs"
    encoding:                   IEncoding|string;  // e.g. "hex" | "base64"
    value?:                     string;
    previousValue?:             string;
    signatures?:                any;
}

export interface ISignature
{
    algorithm?:                 CryptoAlgorithms|string;
    format?:                    SignatureFormats|string;
    previousValue?:             string;
    value?:                     string;
}

// export interface IECCSignature extends ISignature
// {
//     //algorithm:                  CryptoAlgorithms|string;
//     //format:                     SignatureFormats|string;
//     //previousValue?:             string;
//     //value?:                     string;
//     r?:                         string;
//     s?:                         string;
// }


export interface ISignatureRS extends ISignature
{
    r?:                         string;
    s?:                         string;
}

export interface IAddress {
    "@context"?:                string;
    city:                       any;
    street?:                    string;
    houseNumber?:               string;
    floorLevel?:                string;
    postalCode:                 string;
    country:                    string;
    comment?:                   any;
}

export interface IGeoLocation {
    lat:                        number;
    lng:                        number;
}

export interface IChargingProductRelevance
{
    time?:                      InformationRelevance|string;
    energy?:                    InformationRelevance|string;
    parking?:                   InformationRelevance|string;
    sessionFee?:                InformationRelevance|string;
}

export enum InformationRelevance {
    Unknown      = "Unknown",
    Ignored      = "Ignored",
    Informative  = "Informative",
    Important    = "Important"
}

// Remember to update main.cjs "setVerificationResult" when you edit this enum!
export enum SessionVerificationResult {

    Unvalidated                       = "Unvalidated",

    UnknownCTRFormat                  = "UnknownCTRFormat",
    NoChargeTransparencyRecordsFound  = "NoChargeTransparencyRecordsFound",

    UnknownSessionFormat              = "UnknownSessionFormat",
    InvalidSessionFormat              = "InvalidSessionFormat",
    AtLeastTwoMeasurementsRequired    = "AtLeastTwoMeasurementsRequired",
    InconsistentTimestamps            = "InconsistentTimestamps",
    MissingStartValue                 = "MissingStartValue",
    InvalidStartValue                 = "InvalidStartValue",
    InvalidIntermediateValue          = "InvalidIntermediateValue",
    MissingStopValue                  = "MissingStopValue",
    InvalidStopValue                  = "InvalidStopValue",

    EnergyMeterNotFound               = "EnergyMeterNotFound",
    InvalidMeasurement                = "InvalidMeasurement",

    PublicKeyNotFound                 = "PublicKeyNotFound",
    UnknownPublicKeyFormat            = "UnknownPublicKeyFormat",
    InvalidPublicKey                  = "InvalidPublicKey",

    UnknownSignatureFormat            = "UnknownSignatureFormat",
    InvalidSignature                  = "InvalidSignature",
    ValidSignature                    = "ValidSignature"

}

export enum VerificationResult {

    Unvalidated               = "Unvalidated",
    NoOperation               = "NoOperation",

    UnknownCTRFormat          = "UnknownCTRFormat",

    EnergyMeterNotFound       = "EnergyMeterNotFound",
    InvalidMeasurement        = "InvalidMeasurement",

    InvalidStartValue         = "InvalidStartValue",
    StartValue                = "StartValue",
    ValidStartValue           = "ValidStartValue",

    InvalidIntermediateValue  = "InvalidIntermediateValue",
    IntermediateValue         = "IntermediateValue",
    ValidIntermediateValue    = "ValidIntermediateValue",

    InvalidStopValue          = "InvalidStopValue",
    StopValue                 = "StopValue",
    ValidStopValue            = "ValidStopValue",

    PublicKeyNotFound         = "PublicKeyNotFound",
    UnknownPublicKeyFormat    = "UnknownPublicKeyFormat",
    InvalidPublicKey          = "InvalidPublicKey",

    UnknownSignatureFormat    = "UnknownSignatureFormat",
    InvalidSignature          = "InvalidSignature",
    ValidSignature            = "ValidSignature",

    ValidationError           = "ValidationError"

}

export interface IVersions {
    name:           string,
    description:    any,
    versions:       Array<IVersion>
}

export interface IVersion {
    version:        string,
    releaseDate:    string,
    description:    any,
    tags:           Array<string>,
    packages:       Array<IVersionPackage>
}

export interface IVersionPackage {
    name:           string,
    description:    any,
    additionalInfo: any,
    cryptoHashes:   ICryptoHashes,
    signatures:     Array<IVersionSignature>,
    downloadURLs:   any
}

export interface ICryptoHashes {
    sha256?:        string,
    sha512?:        string
}

export interface IVersionSignature {
    signer:         string,
    timestamp:      string,
    publicKey:      string,
    algorithm:      string,
    format:         string,
    signature:      string
}

export interface IMultilanguageText {
    [key: string]:  string;
}

export interface IResult {
    status:         SessionVerificationResult,
    message:        string
}

export interface TarInfo {
    data:           Buffer,
    mode:           number,
    mtime:          string,
    path:           string
    type:           string
}

export interface IFileInfo {
    name:           string,
    path?:          string,
    type?:          string,
    data?:          ArrayBuffer,
    info?:          string,
    error?:         string,
    exception?:     any
}

export function isIFileInfo(obj: any): obj is IFileInfo {
    return obj.status !== undefined && obj.name && typeof obj.name === 'string' && obj.data && obj.data instanceof ArrayBuffer;
}

export interface IExtendedFileInfo extends IFileInfo {
    result:                 IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult
}

export interface IChargingPeriod
{
    startTimestamp:                 string,
    stopTimestamp?:                 string,
    endTimestamp?:                  string,
    chargingTariffId:               string,
    activeChargingTariffElement?:   IChargingTariffElement,
    costs:                          IChargingCosts
}

export enum DayOfWeek
{
    Sunday     = 0,
    Monday     = 1,
    Tuesday    = 2,
    Wednesday  = 3,
    Thursday   = 4,
    Friday     = 5,
    Saturday   = 6
}

export interface ITariffRestriction {
    start_time:             string,
    end_time:               string,
    start_date:             string,
    end_date:               string,
    min_kwh:                Decimal,
    max_kwh:                Decimal,
    min_power:              Decimal,
    max_power:              Decimal,
    min_duration:           number,
    max_duration:           number,
    day_of_week:            Array<DayOfWeek>
}

export interface IPriceComponent {
    type:                       string,
    price:                      Decimal,
    step_size:                  number
}

export interface IChargingTariffElement {
    price_components:           Array<IPriceComponent>,
    restrictions:               ITariffRestriction
}

export interface IDisplayText {
    language:                   string,
    text:                       string
}

// OCPI v2.1.1 + extensions
export interface IChargingTariff {

    "@id":                      string;
    "@context"?:                string|Array<string>,
    country_code?:              string,
    party_id?:                  string,
    shortName?:                 IMultilanguageText;
    summary?:               IMultilanguageText;
    tariff_alt_url?:            string,
    currency?:                  string,
    taxes?:                     Array<ITaxes>;
    elements?:                  Array<IChargingTariffElement>

    //energy_mix?:                IEnergyMix,

    not_before?:                string,
    not_after?:                 string,
    created?:                   string,
    last_updated?:              string,

    signatures?:                Array<ISignatureRS>

}

export interface IParkingTariff {

    "@id":                      string;
    "@context"?:                string|Array<string>,
    country_code?:              string,
    party_id?:                  string,
    description?:               IMultilanguageText;
    tariff_alt_text?:           Array<IDisplayText>,
    tariff_alt_url?:            string,
    currency?:                  string,
    taxes?:                     Array<ITaxes>;
    elements?:                  Array<IChargingTariffElement>

    not_before?:                string,
    not_after?:                 string,
    created?:                   string,
    last_updated?:              string,

    signatures?:                Array<ISignatureRS>

}

export type ShowPKIDetailsFunction = (pkiData: any) => void;
