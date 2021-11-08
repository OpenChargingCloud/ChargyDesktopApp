/*
 * Copyright (c) 2018-2021 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

///<reference path="ACrypt.ts" />

function IsAChargeTransparencyRecord(data: IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult|undefined): data is IChargeTransparencyRecord
{

    if (data == null || data == undefined)
        return false;

    let chargeTransparencyRecord = data as IChargeTransparencyRecord;

    return chargeTransparencyRecord.begin            !== undefined &&
           chargeTransparencyRecord.end              !== undefined &&
           chargeTransparencyRecord.chargingSessions !== undefined;

}

function IsAPublicKeyInfo(data: any): data is IPublicKeyInfo
{

    if (data == null || data == undefined)
        return false;

    let publicKeyInfo = data as IPublicKeyInfo;

    return publicKeyInfo["@context"]  !== undefined &&
           publicKeyInfo.subject      !== undefined &&
           publicKeyInfo.algorithm    !== undefined &&
           publicKeyInfo.value        !== undefined;

}

function IsAPublicKeyLookup(data: IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult|undefined): data is IPublicKeyLookup
{

    if (data == null || data == undefined)
        return false;

    let publicKeyLookup = data as IPublicKeyLookup;

    return publicKeyLookup.publicKeys !== undefined;

}

function IsASessionCryptoResult(data: IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult): data is ISessionCryptoResult
{

    if (data == null || data == undefined)
        return false;

    let sessionCryptoResult = data as ISessionCryptoResult;

    return sessionCryptoResult.status !== undefined;

}

interface GetChargingPoolFunc {
    (Id: string): IChargingPool|null;
}

interface GetChargingStationFunc {
    (Id: string): IChargingStation|null;
}

interface GetEVSEFunc {
    (Id: string): IEVSE|null;
}

interface GetMeterFunc {
    (Id: string): IMeter|null;
}

interface CheckMeterPublicKeySignatureFunc {
    (chargingStation:  any|null,
     evse:             any|null,
     meter:            any|null,
     publicKey:        any|null,
     signature:        any|null): Promise<string>;
}

interface IChargeTransparencyRecord
{
    "@id":                      string;
    "@context":                 string;
    begin?:                     string;
    end?:                       string;
    description?:               {};
    contract?:                  IContract;
    chargingStationOperators?:  Array<IChargingStationOperator>;
    chargingPools?:             Array<IChargingPool>;
    chargingStations?:          Array<IChargingStation>;
    publicKeys?:                Array<IPublicKeyInfo>;
    chargingSessions?:          Array<IChargingSession>;
    eMobilityProviders?:        Array<IEMobilityProvider>;
    mediationServices?:         Array<IMediationService>;
    verificatinResult?:         ISessionCryptoResult;
    invalidDataSets?:           Array<IExtendedFileInfo>;
}

interface IContract
{
    "@id":                      string;
    "@context"?:                string;
    username?:                  string;
    email?:                     string;
}

interface IPublicKeyLookup
{
    publicKeys:                 Array<IPublicKeyInfo>;
}

interface IPublicKeyInfo
{
    "@id":                      string; // Just for merging with IChargeTransparencyRecord!
    "@context":                 string;
    subject:                    string|any;
    type?:                      string|IOIDInfo;
    algorithm:                  string|IOIDInfo;
    value:                      string;
    signatures?:                Array<IPublicKeysignature>;
}

interface IPublicKeysignature
{
    "@id":                      string;
    "@context"?:                string;
    timestamp:                  string;
    keyUsage:                   Array<string>;
}

interface IOIDInfo
{
    oid:                        string;
    name:                       string;
}

function ISOIDInfo(data: any): data is IOIDInfo
{

    if (data == null || data == undefined)
        return false;

    let OIDInfo = data as IOIDInfo;

    return OIDInfo.oid !== undefined;

}


interface IKeyInfo
{
    keyId:                      string;
    keyType:                    string;
    curve:                      string;
    value:                      string;
}

interface IChargingStationOperator
{
    "@id":                      string;
    "@context"?:                string;
    description?:               {};
    contact:                    IContact;
    support:                    ISupport;
    privacy:                    IPrivacy;
    geoLocation?:               IGeoLocation;
    chargingPools?:             Array<IChargingPool>;
    chargingStations?:          Array<IChargingStation>;
    EVSEs?:                     Array<IEVSE>;
    tariffs?:                   Array<ITariff>;
    publicKeys?:                Array<IPublicKey>;
}

interface IContact {
    email:                      string;
    web:                        string;
    logoUrl?:                   string;
    address?:                   IAddress;
    publicKeys?:                Array<IPublicKey>
}

interface ISupport {
    hotline:                    string;
    email:                      string;
    web?:                       string;
    mediationServices?:         Array<string>;
    publicKeys?:                Array<IPublicKey>
}

interface IPrivacy {
    contact:                    string;
    email:                      string;
    web:                        string;
    publicKeys?:                Array<IPublicKey>
}

interface IChargingPool
{
    "@id":                      string;
    "@context"?:                string;
    description:                {};
    address:                    IAddress;
    geoLocation?:               IGeoLocation;
    chargingStationOperator:    IChargingStationOperator;
    chargingStations:           Array<IChargingStation>;
    tariffs:                    Array<ITariff>;
    publicKeys?:                Array<IPublicKey>;
}

interface IChargingStation
{
    "@id":                      string;
    "@context"?:                string;
    description?:               {};
    firmwareVersion?:           string;
    address?:                   IAddress;
    geoLocation?:               IGeoLocation;
    chargingStationOperator?:   IChargingStationOperator;
    chargingPoolId?:            string;
    chargingPool?:              IChargingPool;
    EVSEs:                      Array<IEVSE>;
    EVSEIds?:                   Array<string>;
    meters?:                    Array<IMeter>;
    tariffs?:                   Array<ITariff>;
    publicKeys?:                Array<IPublicKey>;
}

interface IEVSE
{
    "@id":                      string;
    "@context"?:                string;
    description?:               {};
    chargingStation?:           IChargingStation;
    chargingStationId?:         string;
    meters:                     Array<IMeter>;
    tariffs?:                   Array<ITariff>;
    publicKeys?:                Array<IPublicKey>;
    connectors?:                Array<IConnector>;
}

interface IMeter
{
    "@id":                      string;
    "@context"?:                string;
    description?:               {};
    vendor:                     string;
    vendorURL?:                 string;
    model:                      string;
    modelURL?:                  string;
    firmwareVersion:            string;
    hardwareVersion?:           string;
    chargingStation?:           IChargingStation;
    chargingStationId?:         string;
    EVSE?:                      IEVSE;
    EVSEId?:                    string;
    signatureInfos?:            ISignatureInfos;
    signatureFormat:            string;
    publicKeys?:                Array<IPublicKey>;
}

interface IConnector {
    type:                       string;
}

interface IEMobilityProvider
{
    "@id":                      string;
    "@context"?:                string;
    description:                {};
    tariffs:                    Array<ITariff>;
    publicKeys?:                Array<IPublicKey>;
}

interface ITariff
{
    "@id":                      string;
    "@context"?:                string;
    description:                {};
}

interface IMediationService
{
    "@id":                      string;
    "@context"?:                string;
    description:                {};
    publicKeys?:                Array<IPublicKey>;
}

interface IChargingSession
{
    "@id":                      string;
    "@context"?:                string;
    ctr?:                       IChargeTransparencyRecord;
    GUI?:                       HTMLDivElement;
    begin:                      string;
    end?:                       string;     // to allow still running sessions!
    chargingProductRelevance?:  IChargingProductRelevance,
    description?:               {};
    chargingStationOperatorId?: string;
    chargingStationOperator?:   IChargingStationOperator|null;
    chargingPoolId?:            string;
    chargingPool?:              IChargingPool|null;
    chargingStationId?:         string;
    chargingStation?:           IChargingStation|null;
    EVSEId:                     string;
    EVSE?:                      IEVSE|null;
    meterId?:                   string;
    meter?:                     IMeter|null;
    publicKey?:                 IPublicKeyInfo;
    tariffId?:                  string;
    tariff?:                    ITariff|null;
    authorizationStart:         IAuthorization;
    authorizationStop?:         IAuthorization;
    product?:                   IChargingProduct;
    measurements:               Array<IMeasurement>;
    parking?:                   Array<IParking>;
    method?:                    ACrypt;
    original?:                  string;
    signature?:                 string|ISignatureRS;
    hashValue?:                 string;
    verificationResult?:        ISessionCryptoResult;
}

interface ISignatureRS {
    r:                          string;
    s:                          string;
}

interface IChargingProduct
{
    "@id":                      string;
    "@context"?:                string;
}

interface IParking
{
    "@id":                      string;
    "@context"?:                string;
    begin:                      string;
    end?:                       string;
}

interface IAuthorization
{
    "@id":                      string;
    "@context"?:                string;
    type?:                      string;
    timestamp?:                 string;
    chargingStationOperator?:   string;
    roamingNetwork?:            string;
    eMobilityProvider?:         string;
}

interface IMeasurement
{
    "@context"?:                string;
    chargingSession?:           IChargingSession;
    energyMeterId:              string;
    phenomena?:                 any[];
    name:                       string;
    obis:                       string;
    unit:                       string;
    unitEncoded:                number;
    valueType:                  string;
    scale:                      number;
    verifyChain?:               boolean;
    signatureInfos:             ISignatureInfos;
    values:                     Array<IMeasurementValue>;
    verificationResult?:        ICryptoResult;
}

interface IMeasurements
{
    "@context"?:                string;
    values:                     Array<IMeasurement>;
    verificationResult?:        ICryptoResult;
}

interface ISignatureInfos {
    hash:                       CryptoHashAlgorithms;
    hashTruncation:             number;
    algorithm:                  CryptoAlgorithms;
    curve:                      string;
    format:                     SignatureFormats;
}

enum SignatureFormats {
    DER,
    rs
}

enum CryptoAlgorithms {
    RSA,
    ECC
}

enum CryptoHashAlgorithms {
    SHA256,
    SHA512
}


interface IMeasurementValue
{

    measurement?:               IMeasurement;
    method?:                    ACrypt;
    previousValue?:             IMeasurementValue;

    timestamp:                  string;
    value:                      number;
    infoStatus?:                string;
    secondsIndex?:              number;
    paginationId?:              number|string;
    logBookIndex?:              string;

    signatures:                 Array<ISignature|ISignatureRS>;
    result?:                    ICryptoResult;

}

interface ISessionCryptoResult
{
    status:                     SessionVerificationResult;
    message?:                   string;
    exception?:                 any;
}

function isISessionCryptoResult(obj: any): obj is ISessionCryptoResult {
    return obj.status !== undefined
}

interface ICryptoResult
{
    status:                     VerificationResult;
}

function isICryptoResult(obj: any): obj is ICryptoResult {
    return obj.status !== undefined
}

interface IPublicKey
{
    algorithm:                  string;
    format:                     string;
    previousValue?:             string;
    value:                      string;
    signatures?:                any;
}

interface ISignature
{
    algorithm:                  CryptoAlgorithms;
    format:                     SignatureFormats;
    previousValue?:             string;
    value?:                     string;
}

interface IECCSignature extends ISignature
{
    algorithm:                  CryptoAlgorithms;
    format:                     SignatureFormats;
    previousValue?:             string;
    value?:                     string;
    r?:                         string;
    s?:                         string;
}

interface IAddress {
    "@context"?:                string;
    city:                       any;
    street?:                    string;
    houseNumber?:               string;
    floorLevel?:                string;
    postalCode:                 string;
    country:                    string;
    comment?:                   any;
}

interface IGeoLocation {
    lat:                        number;
    lng:                        number;
}

interface IChargingProductRelevance
{
    time?:                      InformationRelevance;
    energy?:                    InformationRelevance;
    parking?:                   InformationRelevance;
    sessionFee?:                InformationRelevance;
}

enum InformationRelevance {
    Unkonwn,
    Ignored,
    Informative,
    Important
}

enum SessionVerificationResult {
    UnknownSessionFormat,
    InvalidSessionFormat,
    PublicKeyNotFound,
    InvalidPublicKey,
    InvalidSignature,
    ValidSignature,
    InconsistentTimestamps,
    AtLeastTwoMeasurementsRequired
}

enum VerificationResult {

    UnknownCTRFormat,
    EnergyMeterNotFound,
    PublicKeyNotFound,
    InvalidPublicKey,

    InvalidSignature,
    InvalidStartValue,
    InvalidIntermediateValue,
    InvalidStopValue,

    NoOperation,
    StartValue,
    IntermediateValue,
    StopValue,

    ValidSignature,
    ValidStartValue,
    ValidIntermediateValue,
    ValidStopValue

}

interface IVersions {
    name:           string,
    description:    any,
    versions:       Array<IVersion>
}

interface IVersion {
    version:        string,
    releaseDate:    string,
    description:    any,
    tags:           Array<string>,
    packages:       Array<IVersionPackage>
}

interface IVersionPackage {
    name:           string,
    description:    any,
    additionalInfo: any,
    cryptoHashes:   ICryptoHashes,
    signatures:     Array<IVersionSignature>,
    downloadURLs:   any
}

interface ICryptoHashes {
    sha256?:        string,
    sha512?:        string
}

interface IVersionSignature {
    signer:         string,
    timestamp:      string,
    publicKey:      string,
    algorithm:      string,
    format:         string,
    signature:      string
}

interface IResult {
    status:         SessionVerificationResult,
    message:        string
}

interface TarInfo {
    data:           Buffer,
    mode:           number,
    mtime:          string,
    path:           string
    type:           string
}

interface IFileInfo {
    name:           string,
    path?:          string,
    data?:          ArrayBuffer,
    error?:         string,
    exception?:     any
}

function isIFileInfo(obj: any): obj is IFileInfo {
    return obj.status !== undefined && obj.name && typeof obj.name === 'string' && obj.data && obj.data instanceof ArrayBuffer;
}

interface IExtendedFileInfo extends IFileInfo {
    result:         IChargeTransparencyRecord|IPublicKeyLookup|ISessionCryptoResult
}