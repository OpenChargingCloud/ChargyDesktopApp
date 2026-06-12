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

import Decimal  from 'decimal.js';


export function IsAPublicKeyInfo(data: unknown): data is IPublicKeyInfo
{

    if (data == null || data == undefined)
        return false;

    const publicKeyInfo = data as IPublicKeyInfo;

    return publicKeyInfo["@context"]  !== undefined &&
           publicKeyInfo.subject      !== undefined &&
           publicKeyInfo.algorithm    !== undefined &&
           publicKeyInfo.value        !== undefined;

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
    (chargingStation:  IChargingStation | null | undefined,
     evse:             IEVSE            | null | undefined,
     meter:            IMeter           | null | undefined,
     publicKey:        IPublicKey       | null | undefined,
     signature:        unknown): Promise<string>;
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
    subject:                    string;
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

export function ISOIDInfo(data: unknown): data is IOIDInfo
{

    if (data == null || data == undefined)
        return false;

    const OIDInfo = data as IOIDInfo;

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


export interface ISessionCryptoResult
{

    status:                     SessionVerificationResult;
    message?:                   string;
    exception?:                 unknown;

    // How sure we are that this result is correct!
    // (JSON) transparency records might not always include an unambiguously
    // format identifier. So multiple chargy parsers might be candidates, but
    // hopefully one will be the best matching parser.
    certainty:                  number;

    warnings?:                  Array<string>;
    errors?:                    Array<string>;

}

export function isISessionCryptoResult1(obj: unknown): obj is ISessionCryptoResult {
    return typeof obj === 'object' && obj !== null &&
           (obj as ISessionCryptoResult).status !== undefined
}

export function isISessionCryptoResult2(obj: unknown): obj is ISessionCryptoResult {
    return typeof obj === 'object' && obj !== null &&
           (obj as ISessionCryptoResult).status !== undefined &&
           (obj as ISessionCryptoResult).status !== SessionVerificationResult.InvalidSessionFormat
}

export interface ICryptoResult
{
    status:                     VerificationResult;
    errors?:                    Array<string>;
    warnings?:                  Array<string>;
}

export function isICryptoResult(obj: unknown): obj is ICryptoResult {
    return typeof obj === 'object' && obj !== null &&
           (obj as ICryptoResult).status !== undefined
}

export function isIPublicKeyXY(obj: unknown): obj is IPublicKeyXY {
    return typeof obj === 'object' && obj !== null   &&
           typeof (obj as IPublicKeyXY).x === "string" &&
           typeof (obj as IPublicKeyXY).y === "string";
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
    signatures?:                Array<unknown>;
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
    city:                       string;
    street?:                    string;
    houseNumber?:               string;
    floorLevel?:                string;
    postalCode:                 string;
    country:                    string;
    comment?:                   string | IMultilanguageText;
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
    description:    IMultilanguageText,
    versions:       Array<IVersion>
}

export interface IVersion {
    version:        string,
    releaseDate:    string,
    description:    IMultilanguageText,
    tags:           Array<string>,
    packages:       Array<IVersionPackage>
}

export interface IVersionPackage {
    name:           string,
    description:    IMultilanguageText,
    additionalInfo: unknown,
    cryptoHashes:   ICryptoHashes,
    signatures:     Array<IVersionSignature>,
    downloadURLs:   Record<string, string>
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

// The i18n.json dictionary: message key => language => localized text
export interface I18NDictionary {
    [key: string]:  IMultilanguageText;
}

export interface IResult {
    status:         SessionVerificationResult,
    message:        string
}

export interface TarInfo {
    data:           ArrayBuffer|Uint8Array,
    mode:           number,
    mtime:          string,
    path:           string
    type:           string
}

export interface IFileInfo {
    name:           string,
    path?:          string,
    type?:          string,
    data?:          ArrayBuffer|Uint8Array,
    info?:          string,
    error?:         string,
    exception?:     unknown
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

export type ShowPKIDetailsFunction = (pkiData: unknown) => void;
