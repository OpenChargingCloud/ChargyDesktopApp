
interface ICTR
{
    "@id":                      string,
    "@context":                 string,
    begin:                      string,
    end:                        string,
    description:                {},
    contract:                   IContract,
    chargingStationOperators:   Array<IChargingStationOperator>
    chargingPools:              Array<IChargingPool>
    chargingStations:           Array<IChargingStation>
    chargingSessions:           Array<IChargingSession>
    eMobilityProviders:         Array<IEMobilityProvider>
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
    type:                       string,
    manufacturer:               string,
    firmwareVersion:            string,
    chargingStation:            IChargingStation,
    chargingStationId:          string,
    EVSE:                       IEVSE,
    EVSEId:                     string,
    publicKeys:                 Array<IPublicKey>
}

interface ITariff
{
    "@id":                      string,
    "@context":                 string,
    description:                {}
}

interface IEMobilityProvider
{
    "@id":                      string,
    "@context":                 string,
    description:                {},
    tariffs:                    Array<ITariff>
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
    energyMeterId:              string,
    name:                       string,
    obis:                       string,
    unit:                       string,
    unitEncoded:                string,
    valueType:                  string,
    scale:                      string,
    verifyChain:                boolean,
    values:                     Array<IMeasurementValue>
}


interface IMeasurementValue
{
    timestamp:                  string,
    paginationId:               string,
    value:                      string,
    signatures:                 Array<ISignature>
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
    previousValue:              string,
    value:                      string
}

interface IAddress {
    "@context":       string,
    city:             any;
    street:           string;
    houseNumber:      string;
    floorLevel:       string;
    postalCode:       string;
    country:          string;
    comment:          any;
}


enum VerificationResult {
    VerificationFailed,
    InvalidSignature,
    ValidSignature,
}
