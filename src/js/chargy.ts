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

///<reference path="certificates.ts" />
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />

class Chargy {

    //#region Data

    private elliptic: any;
    private moment:   any;

    private chargingStationOperators  = new Array<IChargingStationOperator>();
    private chargingPools             = new Array<IChargingPool>();
    private chargingStations          = new Array<IChargingStation>();
    private EVSEs                     = new Array<IEVSE>();
    private meters                    = new Array<IMeter>();
    private chargingSessions          = new Array<IChargingSession>();

    private eMobilityProviders        = new Array<IEMobilityProvider>();
    private mediationServices         = new Array<IMediationService>();

    public  currentCTR                = {} as IChargeTransparencyRecord;

    //#endregion

    constructor(elliptic: any,
                moment:   any) {

        this.elliptic  = elliptic;
        this.moment    = moment;

    }

    //#region GetMethods...

    public GetChargingPool: GetChargingPoolFunc = (Id: string) => {

        for (var chargingPool of this.chargingPools)
        {
            if (chargingPool["@id"] === Id)
                return chargingPool;
        }

        return null;

    }

    public GetChargingStation: GetChargingStationFunc = (Id: string) => {

        for (var chargingStation of this.chargingStations)
        {
            if (chargingStation["@id"] === Id)
                return chargingStation;
        }

        return null;

    }

    public GetEVSE: GetEVSEFunc = (Id: string) => {

        for (var evse of this.EVSEs)
        {
            if (evse["@id"] === Id)
                return evse;
        }

        return null;

    }

    public GetMeter: GetMeterFunc = (Id: string) => {

        for (var meter of this.meters)
        {
            if (meter["@id"] === Id)
                return meter;
        }

        return null;

    }

    //#endregion


    //#region CheckMeterPublicKeySignature(...)

    public async CheckMeterPublicKeySignature(chargingStation:  any,
                                              evse:             any,
                                              meter:            any,
                                              publicKey:        any,
                                              signature:        any): Promise<string>
    {

        // For now: Do not enforce this feature!
        if (chargingStation == null || evse == null || meter == null || publicKey == null || signature == null)
            return "";// "<i class=\"fas fa-exclamation-circle\"></i> Unbekannter Public Key!";

        try
        {

            var toCheck = {

                "@id":                  chargingStation["@id"],
                "description":          chargingStation.description,
                "geoLocation":          chargingStation.geoLocation,
                "address":              chargingStation.address,
                "softwareVersion":      chargingStation.softwareVersion,

                "EVSE": {
                    "@id":                      evse["@id"],
                    "description":              evse.description,
                    "sockets":                  evse.sockets,

                    "meter": {
                        "@id":                      meter["@id"],
                        "vendor":                   meter.vendor,
                        "model":                    meter.model,
                        "firmwareVersion":          meter.firmwareVersion,
                        "signatureFormat":          meter.signatureFormat,

                        "publicKey": {
                            "algorithm":                publicKey.algorithm,
                            "format":                   publicKey.format,
                            "value":                    publicKey.value,

                            "signature": {
                                "signer":                   signature.signer,
                                "timestamp":                signature.timestamp,
                                "comment":                  signature.comment,
                                "algorithm":                signature.algorithm,
                                "format":                   signature.format
                            }

                        }

                    }

                }
 
            };

            //ToDo: Checking the timestamp might be usefull!

            var sha256value = await sha256(JSON.stringify(toCheck));
                              //this.crypt.createHash('sha256').
                              //           update(Input, 'utf8').
                              //           digest('hex');

            var result = new this.elliptic.ec('secp256k1').
                                  keyFromPublic(signature.publicKey, 'hex').
                                  verify       (sha256value,
                                                signature.signature);


            if (result)
                return "<i class=\"fas fa-check-circle\"></i>" + signature.signer;


        }
        catch (exception)
        { }

        return "<i class=\"fas fa-times-circle\"></i>" + signature.signer;

    }

    //#endregion


    //#region detectContentFormat(Content)

    public async detectContentFormat(Content: string): Promise<IChargeTransparencyRecord|ISessionCryptoResult> {

        //#region Clean data

        if (Content == null)
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Unknown data format!"
            }

        Content = Content.trim();

        // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
        // conversion translates it to FEFF (UTF-16 BOM)
        if (Content.charCodeAt(0) === 0xFEFF)
            Content = Content.substr(1);

        //#endregion

        //@ts-ignore
        let result: IChargeTransparencyRecord|ISessionCryptoResult = null;

        //#region XML processing...

        if (Content.startsWith("<?xml"))
        {
            try
            {

                let XMLDocument  = new DOMParser().parseFromString(Content, "text/xml");

                //#region XML namespace found...

                let xmlns        = XMLDocument.lookupNamespaceURI(null);
                if (xmlns != null)
                {
                
                    switch (xmlns)
                    {

                        case "http://www.mennekes.de/Mennekes.EdlVerification.xsd":
                            result = await new Mennekes().tryToParseMennekesXML(XMLDocument);
                            break;

                        case "http://transparenz.software/schema/2018/07":
                            result = await new SAFEXML().tryToParseSAFEXML(XMLDocument);
                            break;

                        // The SAFE transparency software v1.0 does not understand its own
                        // XML namespace. Therefore we have to guess the format.
                        case "":
                            result = await new SAFEXML().tryToParseSAFEXML(XMLDocument);
                            break;

                    }

                }

                //#endregion

                //#region ..., or plain XML.

                else
                {

                    // The SAFE transparency software v1.0 does not understand its own
                    // XML namespace. Therefore we have to guess the format.
                    result = await new SAFEXML().tryToParseSAFEXML(XMLDocument);

                }

                //#endregion

            } catch (exception)
            {
                result = {
                    status:     SessionVerificationResult.InvalidSessionFormat,
                    message:    "Unknown or invalid XML data format!",
                    exception:  exception
                }
            }
        }

        //#endregion

        // OCMF processing
        else if (Content.startsWith("OCMF|{"))
            result = await new OCMF().tryToParseOCMF2(Content);

        // ALFEN processing
        else if (Content.startsWith("AP;"))
            result = await new Alfen().tryToParseALFENFormat(Content);

        //#region JSON processing

        else
        {
            try
            {

                let JSONContent = JSON.parse(Content);

                switch (JSONContent["@context"])
                {

                    case "https://open.charging.cloud/contexts/CTR+json":
                        result = JSONContent as IChargeTransparencyRecord;
                        break;

                    default:
                        // The current chargeIT mobility does not provide any context or format identifiers
                        result = await new ChargeIT().tryToParseChargeITJSON(JSONContent);
                        break;

                }


            } catch (exception)
            {
                return {
                    status:     SessionVerificationResult.InvalidSessionFormat,
                    message:    "Unknown or invalid JSON data format!",
                    exception:  exception
                }
            }
        }

        //#endregion

        if (IsAChargeTransparencyRecord(result))
            return this.processChargeTransparencyRecord(result);

        return result = {
            status:   SessionVerificationResult.InvalidSessionFormat,
            message:  "Unbekanntes Transparenzdatensatzformat!"
        }

    }

    //#endregion

    //#region processChargeTransparencyRecord(CTR)

    public async processChargeTransparencyRecord(CTR: IChargeTransparencyRecord): Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        //#region Data

        this.chargingStationOperators  = [];
        this.chargingPools             = [];
        this.chargingStations          = [];
        this.EVSEs                     = [];
        this.meters                    = [];
        this.chargingSessions          = [];

        this.eMobilityProviders        = [];
        this.mediationServices         = [];

        this.currentCTR = {} as IChargeTransparencyRecord;

        //#endregion

        //ToDo: Verify @context

        try
        {

            //#region Process operators (pools, stations, evses, tariffs, ...)

            if (CTR.chargingStationOperators)
            {

                for (var chargingStationOperator of CTR.chargingStationOperators)
                {

                    this.chargingStationOperators.push(chargingStationOperator);

                    if (chargingStationOperator.chargingPools) {

                        for (var chargingPool of chargingStationOperator.chargingPools)
                        {

                            this.chargingPools.push(chargingPool);

                            if (chargingPool.chargingStations)
                            {

                                for (var chargingStation of chargingPool.chargingStations)
                                {

                                    this.chargingStations.push(chargingStation);

                                    if (chargingStation.EVSEs) {

                                        for (var EVSE of chargingStation.EVSEs)
                                        {

                                            EVSE.chargingStation    = chargingStation;
                                            EVSE.chargingStationId  = chargingStation["@id"];

                                            this.EVSEs.push(EVSE);

                                            if (EVSE.meters) {

                                                for (var meter of EVSE.meters)
                                                {

                                                    meter.EVSE               = EVSE;
                                                    meter.EVSEId             = EVSE["@id"];

                                                    meter.chargingStation    = chargingStation;
                                                    meter.chargingStationId  = chargingStation["@id"];

                                                    this.meters.push(meter);

                                                }

                                            }

                                        }

                                    }

                                }

                            }

                        }

                    }

                    if (chargingStationOperator.chargingStations)
                    {

                        for (var chargingStation of chargingStationOperator.chargingStations)
                        {

                            this.chargingStations.push(chargingStation);

                            if (chargingStation.EVSEs) {

                                for (var EVSE of chargingStation.EVSEs)
                                {
        
                                    EVSE.chargingStation    = chargingStation;
                                    EVSE.chargingStationId  = chargingStation["@id"];
        
                                    this.EVSEs.push(EVSE);
        
                                    if (EVSE.meters) {
        
                                        for (var meter of EVSE.meters)
                                        {
        
                                            meter.EVSE               = EVSE;
                                            meter.EVSEId             = EVSE["@id"];
        
                                            meter.chargingStation    = chargingStation;
                                            meter.chargingStationId  = chargingStation["@id"];
        
                                            this.meters.push(meter);
        
                                        }
        
                                    }
        
                                }

                            }

                        }

                    }

                    if (chargingStationOperator.EVSEs) {

                        for (var EVSE of chargingStationOperator.EVSEs)
                        {

                            // EVSE.chargingStation    = chargingStation;
                            // EVSE.chargingStationId  = chargingStation["@id"];

                            this.EVSEs.push(EVSE);

                            if (EVSE.meters) {

                                for (var meter of EVSE.meters)
                                {

                                    meter.EVSE               = EVSE;
                                    meter.EVSEId             = EVSE["@id"];

                                    // meter.chargingStation    = chargingStation;
                                    // meter.chargingStationId  = chargingStation["@id"];

                                    this.meters.push(meter);

                                }

                            }

                        }

                    }

                }

            }

            //#endregion

            //#region Process pools     (       stations, evses, tariffs, ...)

            if (CTR.chargingPools) {

                for (var chargingPool of CTR.chargingPools)
                {

                    this.chargingPools.push(chargingPool);

                    if (chargingPool.chargingStations)
                    {

                        for (var chargingStation of chargingPool.chargingStations)
                        {

                            this.chargingStations.push(chargingStation);

                            if (chargingStation.EVSEs) {

                                for (var EVSE of chargingStation.EVSEs)
                                {

                                    EVSE.chargingStation    = chargingStation;
                                    EVSE.chargingStationId  = chargingStation["@id"];

                                    this.EVSEs.push(EVSE);

                                }

                            }

                        }

                    }

                }

            }

            //#endregion

            //#region Process stations  (                 evses, tariffs, ...)

            if (CTR.chargingStations) {

                for (var chargingStation of CTR.chargingStations)
                {

                    this.chargingStations.push(chargingStation);

                    if (chargingStation.EVSEs) {

                        for (var EVSE of chargingStation.EVSEs)
                        {

                            EVSE.chargingStation    = chargingStation;
                            EVSE.chargingStationId  = chargingStation["@id"];

                            this.EVSEs.push(EVSE);

                            if (EVSE.meters) {

                                for (var meter of EVSE.meters)
                                {

                                    meter.EVSE               = EVSE;
                                    meter.EVSEId             = EVSE["@id"];

                                    meter.chargingStation    = chargingStation;
                                    meter.chargingStationId  = chargingStation["@id"];

                                    this.meters.push(meter);

                                }

                            }

                        }

                    }

                    if (chargingStation.meters) {

                        for (var meter of chargingStation.meters)
                        {

                            meter.chargingStation    = chargingStation;
                            meter.chargingStationId  = chargingStation["@id"];

                            this.meters.push(meter);

                        }

                    }

                }

            }

            //#endregion

            if (CTR.chargingSessions)
            {
                for (let chargingSession of CTR.chargingSessions)
                {
                    chargingSession.ctr                = CTR;
                    chargingSession.verificationResult = await this.processChargingSession(chargingSession);
                    this.chargingSessions.push(chargingSession);
                }
            }

            this.currentCTR = CTR;

            return CTR;

        }
        catch (exception)
        {
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + exception.message
            }
        }

    }

    //#endregion

    //#region processChargingSession(chargingSession)

    public async processChargingSession(chargingSession: IChargingSession) : Promise<ISessionCryptoResult>
    {

        //ToDo: Verify @id exists
        //ToDo: Verify @context
        //ToDo: Verify begin & end
        //ToDo: Verify chargingStationOperatorId  => set chargingStationOperator
        //ToDo: Verify chargingPoolId             => set chargingPool
        //ToDo: Verify chargingStationId          => set chargingStation
        //ToDo: Verify EVSEId                     => set EVSE
        //ToDo: Verify meterId                    => set meter
        //ToDo: Verify tariffId                   => set tariff
        //ToDo: Verify measurements exists & count >= 1

        if (chargingSession              == null ||
            chargingSession.measurements == null)
        {
            return {
                status: SessionVerificationResult.InvalidSessionFormat
            }
        }

        switch (chargingSession["@context"])
        {

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/GDFCrypt01+json":
                chargingSession.method = new GDFCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json":
                chargingSession.method = new EMHCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json":
                chargingSession.method = new OCMFv1_0  (this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            default:
                return {
                    status: SessionVerificationResult.UnknownSessionFormat
                }

        }

    }

    //#endregion

}
