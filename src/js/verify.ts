///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
///<reference path="GDFCrypt01.ts" />
///<reference path="EMHCrypt01.ts" />

import { debug } from "util";
import * as crypto from "crypto";
import { readSync } from "fs";

//const { randomBytes } = require('crypto')

var chargingStationOperators  = new Array<IChargingStationOperator>();
var chargingPools             = new Array<IChargingPool>();
var chargingStations          = new Array<IChargingStation>();
var EVSEs                     = new Array<IEVSE>();
var meters                    = new Array<IMeter>();
var eMobilityProviders        = new Array<IEMobilityProvider>();
var mediationServices         = new Array<IMediationService>();
var chargingSessions          = new Array<IChargingSession>();

function StartDashboard() {

    //var ec = new elliptic.ec('p192');
    var el      = require('elliptic');
    let moment  = require('moment');

    // variable 'crypto' is already defined differently in Google Chrome!
    const crypt = require('electron').remote.require('crypto');

    //async function verify2(text, signature, pubkey) : VerificationResult
    //{

    //    var sha256hash = await window.crypto.subtle.digest({ name: "SHA-256" },
    //                                                       new TextEncoder().encode(text)).then(function (hash) { return bufferToHex(hash); } );

    //    try
    //    {

    //        var result = pubkey.verify(sha256hash, signature);

    //        return result
    //            ? VerificationResult.True
    //            : VerificationResult.False;

    //    }
    //    catch (e)
    //    {
    //        //console.log(e);
    //    }

    //    if (typeof signature === 'string')
    //    {

    //        var result = pubkey.verify(sha256hash,
    //                                   {
    //                                       r: signature.substring(0, signature.length / 2),
    //                                       s: signature.substring(   signature.length / 2)
    //                                   });

    //        return result
    //            ? VerificationResult.True
    //            : VerificationResult.False;

    //    }

    //    return VerificationResult.Failed;

    //}

    function verify1(text, signature, pubkey) : VerificationResult
    {

        var sha256hash = "";//sha256_(text);

        try
        {

            var result = pubkey.verify(sha256hash, signature);

            return result
                ? VerificationResult.ValidSignature
                : VerificationResult.InvalidSignature;

        }
        catch (e)
        {
            //console.log(e);
        }

        if (typeof signature === 'string')
        {

            var result = pubkey.verify(sha256hash,
                                       {
                                           r: signature.substring(0, signature.length / 2),
                                           s: signature.substring(   signature.length / 2)
                                       });

            return result
                ? VerificationResult.ValidSignature
                : VerificationResult.InvalidSignature;

        }

        return VerificationResult.VerificationFailed;

    }


    function verifyMeterValue(meterValue): VerificationResult
    {

        var ec192   = new el.ec('p192');
        var buffer  = new ArrayBuffer(320);
        var view    = new DataView(buffer);

        SetHex      (view, meterValue.meterInfo.meterId,                 0, false);
        SetTimestamp(view, meterValue.timestamp,                        10);
        SetHex      (view, meterValue.additionalInfo.status,            14, false);
        SetTimestamp(view, meterValue.additionalInfo.indexes.timer,     15);
        SetHex      (view, meterValue.measurementId,                    19, true);
        SetHex      (view, meterValue.measurand.id,                     23, false);
        SetInt8     (view, meterValue.measuredValue.unitEncoded,        29);
        SetInt8     (view, meterValue.measuredValue.scale,              30);
        SetUInt64   (view, meterValue.measuredValue.value,              31, true);
        SetHex      (view, meterValue.additionalInfo.indexes.logBook,   39, true);
        SetText     (view, meterValue.contract.id,                      41);
        SetTimestamp(view, meterValue.contract.timestamp,              169);

        var hexbuf = buf2hex(buffer);
        console.log(hexbuf);

        var result = verify1(hexbuf,
                             meterValue.signature,
                             ec192.keyFromPublic("04" + meterValue.meterInfo.publicKey, 'hex'));

        console.log(VerificationResult[result]);

        return result;

    }

    this.verifyMeterValue = (meterValue) => {
        verifyMeterValue(meterValue);
    }


    function verifyMeterValues(meterValues): VerificationResult
    {

        var ec192    = new el.ec('p192');
        var buffer   = new ArrayBuffer(320);
        var view     = new DataView(buffer);
        var results  = [];

        for (var i = 0; i < meterValues.measuredValues.length; i++) {

            var meterValue = meterValues.measuredValues[i];

            SetHex      (view, meterValues.meterInfo.meterId,                 0, false);
            SetTimestamp(view, meterValue.timestamp,                         10);
            SetHex      (view, meterValue.additionalInfo.status,             14, false);
            SetTimestamp(view, meterValue.additionalInfo.indexes.timer,      15);
            SetHex      (view, meterValue.measurementId,                     19, true);
            SetHex      (view, meterValues.measurand.id,                     23, false);
            SetInt8     (view, meterValues.measuredValue.unitEncoded,        29);
            SetInt8     (view, meterValues.measuredValue.scale,              30);
            SetUInt64   (view, meterValue.measuredValue.value,               31, true);
            SetHex      (view, meterValue.additionalInfo.indexes.logBook,    39, true);
            SetText     (view, meterValues.contract.id,                      41);
            SetTimestamp(view, meterValues.contract.timestamp,              169);

            var hexbuf = buf2hex(buffer);
            console.log(hexbuf);

            var result = verify1(hexbuf,
                                 meterValue.signature,
                                 ec192.keyFromPublic("04" + meterValues.meterInfo.publicKey, 'hex'));

            console.log(VerificationResult[result]);

            if (result == VerificationResult.ValidSignature)
                results.push([meterValue, result]);

            else
                return result;

        }

        return VerificationResult.ValidSignature;

    }

    this.verifyMeterValues = (meterValues) => {
        verifyMeterValues(meterValues);
    }



    function GetChargingPool(Id: String): IChargingPool
    {

        for (var chargingPool of chargingPools)
        {
            if (chargingPool["@id"] == Id)
                return chargingPool;
        }

        return null;

    }

    function GetChargingStation(Id: String): IChargingStation
    {

        for (var chargingStation of chargingStations)
        {
            if (chargingStation["@id"] == Id)
                return chargingStation;
        }

        return null;

    }

    function GetEVSE(Id: String): IEVSE
    {

        for (var evse of EVSEs)
        {
            if (evse["@id"] == Id)
                return evse;
        }

        return null;

    }

    let GetMeter: GetMeterFunc = function(Id: string) {
    
        for (var meter of meters)
        {
            if (meter["@id"] == Id)
                return meter;
        }
    
        return null;
    
    }    




    //#region showMeasurementCryptoDetails

    function showMeasurementCryptoDetails(measurementValue:  IMeasurementValue,
                                          viewData:          boolean) : ICryptoResult
    {

        function doError(text: String)
        {
            //inputInfosDiv.style.display  = 'flex';
            //errorTextDiv.style.display   = 'inline-block';
            infoDiv.innerHTML       = '<i class="fas fa-times-circle"></i> ' + text;
        }


        let infoDiv                   = overlayDiv.querySelector('#info')                      as HTMLDivElement;
        var result = { status: "Unbekanntes Messdatensatzformat!" };

        if (measurementValue == null || measurementValue.measurement == null)
        {
            doError("Unbekanntes Messdatensatzformat!");
            return { status: "Unbekanntes Messdatensatzformat!" };
        }


        //#region Show data and result on overlay        

        if (viewData)
            overlayDiv.style.display = 'block';
        else
            overlayDiv.style.display = 'none';

        let bufferValue               = overlayDiv.querySelector('#buffer .value')             as HTMLDivElement;
        let hashedBufferValue         = overlayDiv.querySelector('#hashedBuffer .value')       as HTMLDivElement;
        let publicKeyValue            = overlayDiv.querySelector('#publicKey .value')          as HTMLDivElement;
        let signatureExpectedValue    = overlayDiv.querySelector('#signatureExpected .value')  as HTMLDivElement;
        let signatureCheckValue       = overlayDiv.querySelector('#signatureCheck')            as HTMLDivElement;

        infoDiv.innerHTML                 = '';
        bufferValue.innerHTML             = '';
        hashedBufferValue.innerHTML       = '0x00000000000000000000000000000000000';
        publicKeyValue.innerHTML          = '0x00000000000000000000000000000000000';
        signatureExpectedValue.innerHTML  = '0x00000000000000000000000000000000000';
        signatureCheckValue.innerHTML     = '';

        switch (measurementValue.measurement["@context"])
        {

            case "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/GDFCrypt01+json":

                var _GDFCrypt01 = new GDFCrypt01(GetMeter);

                result = _GDFCrypt01.Calc(measurementValue);

                if (viewData)
                    _GDFCrypt01.View(measurementValue,
                                     result as IGDFCrypt01Result,
                                     infoDiv,
                                     bufferValue,
                                     hashedBufferValue,
                                     publicKeyValue,
                                     signatureExpectedValue,
                                     signatureCheckValue);

                return result;

            case "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json":
                
                var _EMHCrypt01 = new EMHCrypt01(GetMeter);

                result = _EMHCrypt01.Calc(measurementValue as IEMHMeasurementValue);

                if (viewData)
                    _EMHCrypt01.View(measurementValue as IEMHMeasurementValue,
                                     result as IEMHCrypt01Result,
                                     infoDiv,
                                     bufferValue,
                                     hashedBufferValue,
                                     publicKeyValue,
                                     signatureExpectedValue,
                                     signatureCheckValue);

                return result;

            default:
                doError("Unbekanntes Messdatensatzformat!");
                return { status: "Unbekanntes Messdatensatzformat!" };

        }

        //#endregion

    }

    // Will capture the correct measurement value and its context!
    function captureMeasurementCryptoDetails(mv: IMeasurementValue) {
        return function(this: HTMLDivElement, ev: MouseEvent) {
                   showMeasurementCryptoDetails(mv, true);
               };
    }

    //#endregion

    //#region showChargingSessionDetails

    function showChargingSessionDetails(chargingSession: IChargingSession)
    {

        function checkMeasurementCrypto(measurementValue: IMeasurementValue)
        {

            var result = showMeasurementCryptoDetails(measurementValue, false);

            switch (result.status)
            {

                case "verified":
                    return '<i class="fas fa-check-circle"></i> Gültige Signatur';

                default:
                    return '<i class="fas fa-times-circle"></i> ' + result.status;

            }            

        }


        try
        {

            evseTarifInfosDiv.innerHTML = "";

            if (chargingSession.measurements)
            {
                for (var measurement of chargingSession.measurements)
                {

                    measurement.chargingSession     = chargingSession;

                    let MeasurementInfoDiv          = CreateDiv(evseTarifInfosDiv,  "measurementInfo");

                    //#region Show Meter vendor infos

                    var meter                        = GetMeter(measurement.energyMeterId);

                    if (meter != null)
                    {

                        let MeterVendorDiv           = CreateDiv(MeasurementInfoDiv,  "meterVendor");

                        let MeterVendorIdDiv         = CreateDiv(MeterVendorDiv,      "meterVendorId",
                                                                 "Zählerhersteller");

                        let MeterVendorValueDiv      = CreateDiv(MeterVendorDiv,      "meterVendorIdValue",
                                                                 meter.vendor);


                        let MeterModelDiv            = CreateDiv(MeasurementInfoDiv,  "meterModel");

                        let MeterModelIdDiv          = CreateDiv(MeterModelDiv,       "meterModelId",
                                                                 "Model");

                        let MeterModelValueDiv       = CreateDiv(MeterModelDiv,       "meterModelIdValue",
                                                                 meter.model);

                    }

                    //#endregion

                    //#region Show Meter infos

                    let MeterDiv                    = CreateDiv(MeasurementInfoDiv,  "meter");

                    let MeterIdDiv                  = CreateDiv(MeterDiv,            "meterId",
                                                                meter != null ? "Seriennummer" : "Zählerseriennummer");

                    let MeterIdValueDiv             = CreateDiv(MeterDiv,            "meterIdValue",
                                                                measurement.energyMeterId);

                    //#endregion

                    //#region Show Measurement infos

                    let MeasurementDiv               = CreateDiv(MeasurementInfoDiv, "measurement");

                    let MeasurementIdDiv             = CreateDiv(MeasurementDiv,     "measurementId",
                                                                 "Messung");

                    let MeasurementIdValueDiv        = CreateDiv(MeasurementDiv,     "measurementIdValue",
                                                                 measurement.name + " (OBIS: " + measurement.obis + ")");

                    //#endregion

                    //#region Show Measurement values...

                    //<i class="far fa-chart-bar"></i>
                    if (measurement.values && measurement.values.length > 0)
                    {

                        let MeasurementValuesDiv         = CreateDiv(evseTarifInfosDiv, "measurementValues");

                        for (var measurementValue of measurement.values)
                        {

                            measurementValue.measurement     = measurement;

                            let MeasurementValueDiv          = CreateDiv(MeasurementValuesDiv, "measurementValue");
                            MeasurementValueDiv.onclick      = captureMeasurementCryptoDetails(measurementValue);

                            var timestamp                    = parseUTC(measurementValue.timestamp);

                            let timestampDiv                 = CreateDiv(MeasurementValueDiv, "timestamp",
                                                                         timestamp.format('HH:mm:ss'));

                            var _value                       = measurementValue.value;

                            switch (measurement.unit)
                            {

                                case "KILO_WATT_HOURS":
                                    break;

                                // "WATT_HOURS"
                                default:
                                    _value = _value / 1000;
                                    break;

                            }

                            let valueDiv                     = CreateDiv(MeasurementValueDiv, "value",
                                                                         _value.toString());

                            let unitDiv                      = CreateDiv(MeasurementValueDiv, "unit",
                                                                         "kWh");

                            let verificationStatusDiv        = CreateDiv(MeasurementValueDiv, "verificationStatus",
                                                                         checkMeasurementCrypto(measurementValue));

                        }

                    }

                    //#endregion

                }
            }

        }
        catch (exception)
        { 
            console.log(exception);
        }

    }

    // Will capture the correct charging session and its context!
    function captureChargingSession(cs: IChargingSession) {
        return function(this: HTMLDivElement, ev: MouseEvent) {
                   showChargingSessionDetails(cs);
               };
    }

    //#endregion


    //#region detectContentFormat

    function detectContentFormat(Content) {


        function processOpenChargingCloudFormat(CTR: IChargeTransparencyRecord)
        {

            chargingStationOperators  = [];
            chargingPools             = [];
            chargingStations          = [];
            EVSEs                     = [];
            meters                    = [];
            eMobilityProviders        = [];
            mediationServices         = [];
            chargingSessions          = [];

            //#region Prepare View

            chargingSessionReportDiv.style.display  = "flex";
            chargingSessionReportDiv.innerText      = "";
            backButtonDiv.style.display             = "block";

            //#endregion

            //#region Show CTR infos

            if (CTR.description) {
                let descriptionDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
                descriptionDiv.id  = "description";
                descriptionDiv.innerText = firstValue(CTR.description);
            }

            if (CTR.begin) {
                let beginDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
                beginDiv.id        = "begin";
                beginDiv.className = "defi";
                beginDiv.innerHTML = parseUTC(CTR.begin).format('dddd, D. MMMM YYYY');
            }

            if (CTR.end) {
                let endDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
                endDiv.id          = "begin";
                endDiv.className   = "defi";
                endDiv.innerHTML   = parseUTC(CTR.end).format('dddd, D. MMMM YYYY');
            }

            //#endregion

            //#region Show contract infos

            if (CTR.contract)
            {
            }

            //#endregion

            //#region Process CSOs, pools, stations, ...

            if (CTR.chargingStationOperators)
            {

                for (var chargingStationOperator of CTR.chargingStationOperators)
                {

                    chargingStationOperators.push(chargingStationOperator);

                    if (chargingStationOperator.chargingPools) {

                        for (var chargingPool of chargingStationOperator.chargingPools)
                        {

                            chargingPools.push(chargingPool);

                            if (chargingPool.chargingStations)
                            {

                                for (var chargingStation of chargingPool.chargingStations)
                                {

                                    chargingStations.push(chargingStation);

                                    if (chargingStation.EVSEs) {

                                        for (var EVSE of chargingStation.EVSEs)
                                        {

                                            EVSE.chargingStation    = chargingStation;
                                            EVSE.chargingStationId  = chargingStation["@id"];

                                            EVSEs.push(EVSE);

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

                            chargingStations.push(chargingStation);

                            if (chargingStation.EVSEs) {

                                for (var EVSE of chargingStation.EVSEs)
                                {
                                    EVSEs.push(EVSE);
                                }

                            }

                        }

                    }

                    if (chargingStationOperator.EVSEs) {

                        for (var EVSE of chargingStationOperator.EVSEs)
                        {
                            EVSEs.push(EVSE);
                        }

                    }

                }

            }

            if (CTR.chargingPools) {

                for (var chargingPool of CTR.chargingPools)
                {

                    chargingPools.push(chargingPool);

                    if (chargingPool.chargingStations)
                    {

                        for (var chargingStation of chargingPool.chargingStations)
                        {

                            chargingStations.push(chargingStation);

                            if (chargingStation.EVSEs) {

                                for (var EVSE of chargingStation.EVSEs)
                                {

                                    EVSE.chargingStation    = chargingStation;
                                    EVSE.chargingStationId  = chargingStation["@id"];

                                    EVSEs.push(EVSE);

                                }

                            }

                        }

                    }

                }

            }

            if (CTR.chargingStations) {

                for (var chargingStation of CTR.chargingStations)
                {

                    chargingStations.push(chargingStation);

                    if (chargingStation.EVSEs) {

                        for (var EVSE of chargingStation.EVSEs)
                        {

                            EVSE.chargingStation    = chargingStation;
                            EVSE.chargingStationId  = chargingStation["@id"];

                            EVSEs.push(EVSE);

                            if (EVSE.meters) {

                                for (var meter of EVSE.meters)
                                {

                                    meter.EVSE               = EVSE;
                                    meter.EVSEId             = EVSE["@id"];

                                    meter.chargingStation    = chargingStation;
                                    meter.chargingStationId  = chargingStation["@id"];

                                    meters.push(meter);

                                }

                            }

                        }

                    }

                    if (chargingStation.meters) {

                        for (var meter of chargingStation.meters)
                        {

                            meter.chargingStation    = chargingStation;
                            meter.chargingStationId  = chargingStation["@id"];

                            meters.push(meter);

                        }

                    }

                }

            }

            //#endregion


            //#region Process charging sessions...

            if (CTR.chargingSessions) {

                let chargingSessionsDiv  = chargingSessionReportDiv.appendChild(document.createElement('div'));
                chargingSessionsDiv.id   = "chargingSessions";

                for (var chargingSession of CTR.chargingSessions)
                {

                    let chargingSessionDiv      = CreateDiv(chargingSessionsDiv, "chargingSessions");               
                    chargingSessionDiv.onclick  = captureChargingSession(chargingSession);

                    //#region Show session time

                    if (chargingSession.begin)
                    {

                        var beginUTC = parseUTC(chargingSession.begin);

                        let dateDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                        dateDiv.className = "date";
                        dateDiv.innerHTML = beginUTC.format('dddd, D; MMM YYYY HH:mm:ss').
                                                    replace(".", "").   // Nov. -> Nov
                                                    replace(";", ".");  // 14;  -> 14.

                        if (chargingSession.end)
                        {

                            var endUTC   = parseUTC(chargingSession.end);
                            var duration = moment.duration(endUTC - beginUTC);

                            dateDiv.innerHTML += " - " +
                                                (Math.floor(duration.asDays()) > 0 ? endUTC.format("dddd") + " " : "") +
                                                endUTC.format('HH:mm:ss');

                        }

                    }

                    //#endregion

                    //#region Show energy infos

                    var tableDiv                   = chargingSessionDiv.appendChild(document.createElement('div'));
                        tableDiv.className         = "table";

                    try {

                        var productInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        productInfoDiv.className             = "productInfos";

                        var productIconDiv                   = productInfoDiv.appendChild(document.createElement('div'));
                        productIconDiv.className             = "productIcon";
                        productIconDiv.innerHTML             = '<i class="fas fa-chart-pie"></i>';

                        var productDiv                       = productInfoDiv.appendChild(document.createElement('div'));
                        productDiv.innerHTML = "Green Power" + "<br />";
                        if      (Math.floor(duration.asDays())    > 1) productDiv.innerHTML += duration.days()    + " Tage " + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asDays())    > 0) productDiv.innerHTML += duration.days()    + " Tag "  + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asHours())   > 0) productDiv.innerHTML += duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asMinutes()) > 0) productDiv.innerHTML += duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asSeconds()) > 0) productDiv.innerHTML += duration.seconds();

                        if (chargingSession.measurements)
                        {
                            for (var measurement of chargingSession.measurements)
                            {
                                //<i class="far fa-chart-bar"></i>
                                if (measurement.values && measurement.values.length > 0)
                                {

                                    var first  = measurement.values[0].value;
                                    var last   = measurement.values[measurement.values.length-1].value;
                                    var amount = last - first;

                                    switch (measurement.unit)
                                    {

                                        case "KILO_WATT_HOURS":
                                            break;

                                        // "WATT_HOURS"
                                        default:
                                            amount = amount / 1000;
                                            break;

                                    }

                                    productDiv.innerHTML += "<br />" + amount.toString() + " kWh " + measurement.name + " (" + measurement.values.length + " Messwerte)";

                                }

                            }
                        }

                    }
                    catch (Exception)
                    { }

                    //#endregion

                    //#region Show location infos...

                    try
                    {

                        var address:IAddress                  = null;

                        var locationInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        locationInfoDiv.className             = "locationInfos";

                        var locationIconDiv                   = locationInfoDiv.appendChild(document.createElement('div'));
                        locationIconDiv.className             = "locationIcon";
                        locationIconDiv.innerHTML             = '<i class="fas fa-map-marker-alt"></i>';

                        var locationDiv                       = locationInfoDiv.appendChild(document.createElement('div'));

                        if (chargingSession.EVSEId || chargingSession.EVSE) {

                            if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                                chargingSession.EVSE = GetEVSE(chargingSession.EVSEId);

                            locationDiv.className             = "EVSE";
                            locationDiv.innerHTML             = (chargingSession.EVSE   != null && chargingSession.EVSE.description != null
                                                                    ? firstValue(chargingSession.EVSE.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.EVSEId != null
                                                                    ? chargingSession.EVSEId
                                                                    : chargingSession.EVSE["@id"]);

                            chargingSession.chargingStation   = chargingSession.EVSE.chargingStation;
                            chargingSession.chargingStationId = chargingSession.EVSE.chargingStationId;

                            chargingSession.chargingPool      = chargingSession.EVSE.chargingStation.chargingPool;
                            chargingSession.chargingPoolId    = chargingSession.EVSE.chargingStation.chargingPoolId;

                            address                           = chargingSession.EVSE.chargingStation.address;

                        }

                        else if (chargingSession.chargingStationId || chargingSession.chargingStation) {

                            if (chargingSession.chargingStation == null || typeof chargingSession.chargingStation !== 'object')
                                chargingSession.chargingStation = GetChargingStation(chargingSession.chargingStationId);

                            locationDiv.className             = "chargingStation";
                            locationDiv.innerHTML             = (chargingSession.chargingStation   != null && chargingSession.chargingStation.description != null
                                                                    ? firstValue(chargingSession.chargingStation.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.chargingStationId != null
                                                                    ? chargingSession.chargingStationId
                                                                    : chargingSession.chargingStation["@id"]);

                            chargingSession.chargingPool      = chargingSession.chargingStation.chargingPool;
                            chargingSession.chargingPoolId    = chargingSession.chargingStation.chargingPoolId;

                            address                           = chargingSession.chargingStation.address;

                        }

                        else if (chargingSession.chargingPoolId || chargingSession.chargingPool) {

                            if (chargingSession.chargingPool == null || typeof chargingSession.chargingPool !== 'object')
                                chargingSession.chargingPool = GetChargingPool(chargingSession.chargingPoolId);

                            locationDiv.className             = "chargingPool";
                            locationDiv.innerHTML             = (chargingSession.chargingPool   != null && chargingSession.chargingPool.description != null
                                                                    ? firstValue(chargingSession.chargingPool.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.chargingPoolId != null
                                                                    ? chargingSession.chargingPoolId
                                                                    : chargingSession.chargingPool["@id"]);

                            address = GetChargingPool(chargingSession.chargingPool["@id"]).address;

                        }

                        locationDiv.innerHTML += address != null
                                                    ? "<br />" + 
                                                        (address.street      != null ? " " + address.street        : "") +
                                                        (address.houseNumber != null ? " " + address.houseNumber   : "") +

                                                        (address.postalCode  != null || address.city != null ? "," : "") +
                                                        (address.postalCode  != null ? " " + address.postalCode    : "") +
                                                        (address.city        != null ? " " + address.city : "")
                                                    : "";

                    } catch (exception)
                    {
                        console.log("Could not show location infos of charging session '" + chargingSession["@id"] + "':" + exception);
                    }

                    //#endregion


                    //#region Verification Status

                    let verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                    verificationStatusDiv.className = "verificationStatus";
                    verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Ungültig';

                    //#endregion

                }

            }

            //#endregion


            //resultsDiv.innerHTML = VerificationResult[result].toString();

        }


        if (Content == null)
            return;

        inputInfosDiv.style.display  = 'none';
        errorTextDiv.style.display   = 'none';

        switch (Content["@context"])
        {

            case "https://open.charging.cloud/contexts/CTR+json":
                processOpenChargingCloudFormat(Content);
                break;

            default:
                doGlobalError("Unbekanntes Transparenzdatensatzformat!");
                break;

        }

    }

    //#endregion


    function doGlobalError(text: String)
    {
        inputInfosDiv.style.display  = 'flex';
        errorTextDiv.style.display   = 'inline-block';
        errorTextDiv.innerHTML       = '<i class="fas fa-times-circle"></i> ' + text;
    }


    //#region Process loaded CTR file...

    function readFileFromDisk(e) {
        readAndParseFile(e.target.files[0]);
    }

    //#endregion

    //#region Process dropped CTR file...

    function handleDroppedFile(evt) {

        evt.stopPropagation();
        evt.preventDefault();

        evt.target.classList.remove('over');

        readAndParseFile(evt.dataTransfer.files[0]);

    }

    function handleDragEnter(evt) {
        evt.preventDefault();
        evt.target.classList.add('over');
    }

    function handleDragOver(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
        evt.target.classList.add('over');
    }

    function handleDragLeave(evt) {
        evt.target.classList.remove('over');
    }

    //#endregion

    //#region Read and parse CTR file

    function readAndParseFile(file) {

        if (!file)
            return;

        var reader = new FileReader();

        reader.onload = function(e) {
            try
            {
                detectContentFormat(JSON.parse((e.target as any).result));
            }
            catch (e) {
                doGlobalError("Fehlerhafter Transparenzdatensatz!");
            }
        }

        reader.readAsText(file)

    }

    //#endregion

    //#region Process pasted CTR file

    function PasteFile(this: HTMLElement, ev: MouseEvent) {

        (navigator as any).clipboard.readText().then(function (clipText) {

            try
            {
                detectContentFormat(JSON.parse(clipText));
            }
            catch (e) {
                doGlobalError("Fehlerhafter Transparenzdatensatz!");
            }

        });

    }

    //#endregion

    var d                         = document as any;

    var input                     = <HTMLDivElement> document.getElementById('input');
    input.addEventListener('dragenter', handleDragEnter,   false);
    input.addEventListener('dragover',  handleDragOver,    false);
    input.addEventListener('dragleave', handleDragLeave,   false);
    input.addEventListener('drop',      handleDroppedFile, false);

    var outerframe                = <HTMLDivElement>      document.getElementById('outerframe');

    var aboutButton               = <HTMLButtonElement>   document.getElementById('aboutButton');
    aboutButton.onclick = function (this: HTMLElement, ev: MouseEvent) {
        inputInfosDiv.style.display             = "none";
        aboutScreenDiv.style.display            = "block";
        chargingSessionReportDiv.style.display  = "none";
        backButtonDiv.style.display             = "block";
    }

    var fullScreenButton          = <HTMLButtonElement>   document.getElementById('fullScreenButton');
    fullScreenButton.onclick = function (this: HTMLElement, ev: MouseEvent) {
        if (d.fullScreen || d.mozFullScreen || d.webkitIsFullScreen)
        {
            outerframe.classList.remove("fullScreen");
            overlayDiv.classList.remove("fullScreen");
            closeFullscreen();
            fullScreenButton.innerHTML = '<i class="fas fa-expand"></i>';
        }
        else
        {
            outerframe.classList.add("fullScreen");
            overlayDiv.classList.add("fullScreen");
            openFullscreen();
            fullScreenButton.innerHTML = '<i class="fas fa-compress"></i>';
        }
    }

    var inputInfosDiv             = <HTMLDivElement>      document.getElementById('inputInfos');
    var loadingErrorsDiv          = <HTMLDivElement>      document.getElementById('loadingErrors');
    var errorTextDiv              = <HTMLDivElement>      document.getElementById('errorText');

    var overlayDiv                = <HTMLDivElement>      document.getElementById('overlay');
    var overlayOkButton           = <HTMLButtonElement>   document.getElementById('overlayOkButton');
    overlayOkButton.onclick = function (this: HTMLElement, ev: MouseEvent) { overlayDiv.style.display = 'none'; }

    var fileInputButton           = <HTMLButtonElement>   document.getElementById('fileInputButton');
    var fileInput                 = <HTMLInputElement>    document.getElementById('fileInput');
    fileInputButton.onclick = function (this: HTMLElement, ev: MouseEvent) { fileInput.click(); }
    fileInput.onchange            = readFileFromDisk;

    var pasteButton               = <HTMLButtonElement>   document.getElementById('pasteButton');
    pasteButton.onclick           = PasteFile;

    var aboutScreenDiv            = <HTMLDivElement>      document.getElementById('aboutScreen');
    var chargingSessionReportDiv  = <HTMLDivElement>      document.getElementById('chargingSessionReport');
    var backButtonDiv             = <HTMLDivElement>      document.getElementById('backButtonDiv');
    backButtonDiv.onclick = function (this: HTMLElement, ev: MouseEvent) {
        inputInfosDiv.style.display             = 'flex';
        aboutScreenDiv.style.display            = "none";
        chargingSessionReportDiv.style.display  = "none";
        backButtonDiv.style.display             = "none";
        fileInput.value                         = "";
    }

    var rightbar                  = <HTMLDivElement>      document.getElementById('rightbar');
    var evseTarifInfosDiv         = <HTMLDivElement>      document.getElementById('evseTarifInfos');
    var resultsDiv                = <HTMLDivElement>      document.getElementById('results');
    

    var shell        = require('electron').shell;
    let linkButtons  = document.getElementsByClassName('linkButton') as HTMLCollectionOf<HTMLButtonElement>;
    for (var i = 0; i < linkButtons.length; i++) {

        let linkButton = linkButtons[i];

        linkButton.onclick = function (this: HTMLElement, ev: MouseEvent) {
            event.preventDefault();
            var link = linkButton.attributes["href"].nodeValue;
            if (link.startsWith("http://") || link.startsWith("https://")) {
                shell.openExternal(link);
            }
        }

    }

}
