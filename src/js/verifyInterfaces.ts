
interface IChargeTransparencyRecord
{
    "@id":                      string,
    "@context":                 string,
    begin:                      string,
    end:                        string,
    description:                {},
    contract:                   IContract,
    chargingStationOperators:   Array<IChargingStationOperator>,
    chargingPools:              Array<IChargingPool>,
    chargingStations:           Array<IChargingStation>,
    chargingSessions:           Array<IChargingSession>,
    eMobilityProviders:         Array<IEMobilityProvider>,
    mediationServices:          Array<IMediationService>
}

interface IContract
{
    "@id":                      string,
    username:                   string,
    email:                      string
}

interface IChargingStationOperator
{
    "@id":                      string,
    "@context":                 string,
    description:                {},
    address:                    IAddress,
    chargingPools:              Array<IChargingPool>,
    chargingStations:           Array<IChargingStation>,
    EVSEs:                      Array<IEVSE>,
    tariffs:                    Array<ITariff>
}

interface IChargingPool
{
    "@id":                      string,
    "@context":                 string,
    description:                {},
    address:                    IAddress,
    chargingStationOperator:    IChargingStationOperator,
    chargingStations:           Array<IChargingStation>,
    tariffs:                    Array<ITariff>
}

interface IChargingStation
{
    "@id":                      string,
    "@context":                 string,
    begin:                      string,
    end:                        string,
    description:                {},
    address:                    IAddress,
    chargingStationOperator:    IChargingStationOperator,
    chargingPoolId:             string,
    chargingPool:               IChargingPool,
    EVSEs:                      Array<IEVSE>,
    EVSEIds:                    Array<string>,
    meters:                     Array<IMeter>,
    tariffs:                    Array<ITariff>
}

interface IEVSE
{
    "@id":                      string,
    "@context":                 string,
    description:                {},
    chargingStation:            IChargingStation,
    chargingStationId:          string,
    meters:                     Array<IMeter>,
    tariffs:                    Array<ITariff>
}

interface IMeter
{
    "@id":                      string,
    "@context":                 string,
    description:                {},
    model:                       string,
    vendor:                     string,
    firmwareVersion:            string,
    chargingStation:            IChargingStation,
    chargingStationId:          string,
    EVSE:                       IEVSE,
    EVSEId:                     string,
    publicKeys:                 Array<IPublicKey>
}

interface GetMeterFunc {
    (Id: String): IMeter;
}

interface IEMobilityProvider
{
    "@id":                      string,
    "@context":                 string,
    description:                {},
    tariffs:                    Array<ITariff>
}

interface ITariff
{
    "@id":                      string,
    "@context":                 string,
    description:                {}
}

interface IMediationService
{
    "@id":                      string,
    "@context":                 string,
    description:                {}
}

interface IChargingSession
{
    "@id":                      string,
    "@context":                 string,
    begin:                      string,
    end:                        string,
    description:                {},
    chargingPoolId:             string,
    chargingPool:               IChargingPool,
    chargingStationId:          string,
    chargingStation:            IChargingStation,
    EVSEId:                     string,
    EVSE:                       IEVSE,
    tariff:                     ITariff,
    authorization:              IAuthorization
    measurements:               Array<IMeasurement>
}

interface IAuthorization
{
    "@id":                      string,
    "@context":                 string,
    type:                       string,
    timestamp:                  string,
    chargingStationOperator:    string,
    roamingNetwork:             string,
    eMobilityProvider:          string
}

interface IMeasurement
{
    "@context":                 string,
    chargingSession:            IChargingSession;
    energyMeterId:              string,
    name:                       string,
    obis:                       string,
    unit:                       string,
    unitEncoded:                number,
    valueType:                  string,
    scale:                      number,
    verifyChain:                boolean,
    values:                     Array<IMeasurementValue>
}

interface IMeasurementValue
{
    measurement:                IMeasurement;
    timestamp:                  string,
    value:                      number,
    signatures:                 Array<ISignature>
}

interface ICryptoResult
{
    status:                     string
}

interface IPublicKey
{
    algorithm:                  string,
    format:                     string,
    previousValue:              string,
    value:                      string
}

interface ISignature
{
    algorithm:                  string,
    format:                     string,
    previousValue?:             string,
    value?:                     string
}

interface IECCSignature extends ISignature
{
    algorithm:                  string,
    format:                     string,
    previousValue?:             string,
    value?:                     string,
    r?:                         string,
    s?:                         string
}

interface IAddress {
    "@context":         	    string,
    city:                       any;
    street:                     string;
    houseNumber:                string;
    floorLevel:                 string;
    postalCode:                 string;
    country:                    string;
    comment:                    any;
}


enum VerificationResult {
    VerificationFailed,
    InvalidSignature,
    ValidSignature,
}
