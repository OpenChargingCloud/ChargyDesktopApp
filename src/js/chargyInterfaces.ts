/*
 * Copyright (c) 2018-2019 GraphDefined GmbH <achim.friedland@graphdefined.com>
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
    begin:                      string;
    end:                        string;
    description:                {};
    contract:                   IContract;
    chargingStationOperators:   Array<IChargingStationOperator>;
    chargingPools:              Array<IChargingPool>;
    chargingStations:           Array<IChargingStation>;
    chargingSessions:           Array<IChargingSession>;
    eMobilityProviders:         Array<IEMobilityProvider>;
    mediationServices:          Array<IMediationService>;
}

interface IContract
{
    "@id":                      string;
    username:                   string;
    email:                      string
}

interface IChargingStationOperator
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
    address:                    IAddress;
    geoLocation?:               IGeoLocation;
    chargingPools:              Array<IChargingPool>;
    chargingStations:           Array<IChargingStation>;
    EVSEs:                      Array<IEVSE>;
    tariffs:                    Array<ITariff>;
}

interface IChargingPool
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
    address:                    IAddress;
    geoLocation?:               IGeoLocation;
    chargingStationOperator:    IChargingStationOperator;
    chargingStations:           Array<IChargingStation>;
    tariffs:                    Array<ITariff>;
}

interface IChargingStation
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
    firmwareVersion:            string;
    address:                    IAddress;
    geoLocation?:               IGeoLocation;
    chargingStationOperator:    IChargingStationOperator;
    chargingPoolId:             string;
    chargingPool:               IChargingPool;
    EVSEs:                      Array<IEVSE>;
    EVSEIds:                    Array<string>;
    meters:                     Array<IMeter>;
    tariffs:                    Array<ITariff>;
}

interface IEVSE
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
    chargingStation:            IChargingStation;
    chargingStationId:          string;
    meters:                     Array<IMeter>;
    tariffs:                    Array<ITariff>;
}

interface IMeter
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
    model:                      string;
    vendor:                     string;
    firmwareVersion:            string;
    chargingStation:            IChargingStation;
    chargingStationId:          string;
    EVSE:                       IEVSE;
    EVSEId:                     string;
    publicKeys:                 Array<IPublicKey>;
}

interface IEMobilityProvider
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
    tariffs:                    Array<ITariff>;
}

interface ITariff
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
}

interface IMediationService
{
    "@id":                      string;
    "@context":                 string;
    description:                {};
}

interface IChargingSession
{
    "@id":                      string;
    "@context":                 string;
    GUI:                        HTMLDivElement;
    begin:                      string;
    end:                        string;
    description:                {};
    chargingPoolId:             string;
    chargingPool?:              IChargingPool|null;
    chargingStationId:          string;
    chargingStation?:           IChargingStation|null;
    EVSEId:                     string;
    EVSE?:                      IEVSE|null;
    tariff?:                    ITariff|null;
    authorizationStart:         IAuthorization;
    authorizationStop:          IAuthorization;
    product:                    IChargingProduct;
    measurements:               Array<IMeasurement>;
    method:                     ACrypt;
}

interface IChargingProduct
{
    "@id":                      string;
    "@context":                 string;
}

interface IAuthorization
{
    "@id":                      string;
    "@context":                 string;
    type:                       string;
    timestamp:                  string;
    chargingStationOperator:    string;
    roamingNetwork:             string;
    eMobilityProvider:          string;
}

interface IMeasurement
{
    "@context":                 string;
    chargingSession:            IChargingSession;
    energyMeterId:              string;
    name:                       string;
    obis:                       string;
    unit:                       string;
    unitEncoded:                number;
    valueType:                  string;
    scale:                      number;
    verifyChain:                boolean;
    signatureInfos:             ISignatureInfos;
    values:                     Array<IMeasurementValue>;
}

interface ISignatureInfos {
    hash:                       string;
    hashTruncation:             number;
    algorithm:                  string;
    curve:                      string;
    format:                     SignatureFormats;
}

enum SignatureFormats {
    DER,
    rs
}

interface IMeasurementValue
{
    measurement:                IMeasurement;
    method:                     ACrypt;
    result:                     ICryptoResult;

    timestamp:                  string;
    value:                      number;
    signatures:                 Array<ISignature>;
}

interface ISessionCryptoResult
{
    status:                     SessionVerificationResult;
}

interface ICryptoResult
{
    status:                     VerificationResult;
}

interface IPublicKey
{
    algorithm:                  string;
    format:                     string;
    previousValue:              string;
    value:                      string;
    signatures:                 any;
}

interface ISignature
{
    algorithm:                  string;
    format:                     SignatureFormats;
    previousValue?:             string;
    value?:                     string;
}

interface IECCSignature extends ISignature
{
    algorithm:                  string;
    format:                     SignatureFormats;
    previousValue?:             string;
    value?:                     string;
    r?:                         string;
    s?:                         string;
}

interface IAddress {
    "@context":                 string;
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


enum SessionVerificationResult {
    UnknownSessionFormat,
    PublicKeyNotFound,
    InvalidPublicKey,
    InvalidSignature,
    ValidSignature,
    AtLeastTwoMeasurementsExpected
}

enum VerificationResult {
    UnknownCTRFormat,
    EnergyMeterNotFound,
    PublicKeyNotFound,
    InvalidPublicKey,
    InvalidSignature,
    ValidSignature
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
