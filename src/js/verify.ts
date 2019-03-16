///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
///<reference path="GDFCrypt01.ts" />
///<reference path="EMHCrypt01.ts" />

import { debug } from "util";
import * as crypto from "crypto";
import { readSync } from "fs";

var map:     any = "";
var leaflet: any = "";

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

    var el      = require('elliptic');
    let moment  = require('moment');

    // variable 'crypto' is already defined differently in Google Chrome!
    const crypt = require('electron').remote.require('crypto');

    //#region GetMethods...

    let GetChargingPool: GetChargingPoolFunc = function (Id: String)
    {

        for (var chargingPool of chargingPools)
        {
            if (chargingPool["@id"] == Id)
                return chargingPool;
        }

        return null;

    }

    let GetChargingStation: GetChargingStationFunc = function (Id: String)
    {

        for (var chargingStation of chargingStations)
        {
            if (chargingStation["@id"] == Id)
                return chargingStation;
        }

        return null;

    }

    let GetEVSE: GetEVSEFunc = function (Id: String)
    {

        for (var evse of EVSEs)
        {
            if (evse["@id"] == Id)
                return evse;
        }

        return null;

    }

    let GetMeter: GetMeterFunc = function(Id: string)
    {
    
        for (var meter of meters)
        {
            if (meter["@id"] == Id)
                return meter;
        }
    
        return null;
    
    }    

    //#endregion



    //#region detectContentFormat

    function detectContentFormat(Content) {


        function processChargeTransparencyRecord(CTR: IChargeTransparencyRecord)
        {

            function checkSessionCrypto(chargingSession: IChargingSession)
            {
    
                var result = verifySessionCryptoDetails(chargingSession);

                //#region Add marker to map

                var redMarker                 = leaflet.AwesomeMarkers.icon({
                    prefix:                     'fa',
                    icon:                       'exclamation',
                    markerColor:                'red',
                    iconColor:                  '#ecc8c3'
                });

                var greenMarker               = leaflet.AwesomeMarkers.icon({
                    prefix:                     'fa',
                    icon:                       'charging-station',
                    markerColor:                'green',
                    iconColor:                  '#c2ec8e'
                });

                var markerIcon  = redMarker;

                switch (result.status)
                {
    
                    case SessionVerificationResult.UnknownSessionFormat:
                    case SessionVerificationResult.PublicKeyNotFound:
                    case SessionVerificationResult.InvalidPublicKey:
                    case SessionVerificationResult.InvalidSignature:
                        markerIcon = redMarker;
                        break;

                    case SessionVerificationResult.ValidSignature:
                        markerIcon = greenMarker;
                        break;


                    default:
                        markerIcon = redMarker;

                }

                var geoLocation  = null;
                
                if (chargingSession.chargingPool                != null &&
                    chargingSession.chargingPool.geoLocation    != null)
                {
                    geoLocation = chargingSession.chargingPool.geoLocation;
                }

                if (chargingSession.chargingStation             != null &&
                    chargingSession.chargingStation.geoLocation != null)
                {
                    geoLocation = chargingSession.chargingStation.geoLocation;
                }

                if (geoLocation != null)
                {

                    var marker = leaflet.marker([geoLocation.lat, geoLocation.lng], { icon: markerIcon }).addTo(map);
                    markers.push(marker);

                    if (minlat > geoLocation.lat)
                        minlat = geoLocation.lat;

                    if (maxlat < geoLocation.lat)
                        maxlat = geoLocation.lat;

                    if (minlng > geoLocation.lng)
                        minlng = geoLocation.lng;

                    if (maxlng < geoLocation.lng)
                        maxlng = geoLocation.lng;

                    switch (result.status)
                    {
        
                        case SessionVerificationResult.UnknownSessionFormat:
                        case SessionVerificationResult.PublicKeyNotFound:
                        case SessionVerificationResult.InvalidPublicKey:
                        case SessionVerificationResult.InvalidSignature:
                            marker.bindPopup("Ungültiger Ladevorgang!");
                            break;
    
                        case SessionVerificationResult.ValidSignature:
                            marker.bindPopup("Gültiger Ladevorgang!");
                            break;
    
    
                        default:
                            markerIcon = redMarker;
    
                    }

                }

                //#endregion

                switch (result.status)
                {
    
                    case SessionVerificationResult.UnknownSessionFormat:
                    case SessionVerificationResult.PublicKeyNotFound:
                    case SessionVerificationResult.InvalidPublicKey:
                    case SessionVerificationResult.InvalidSignature:
                        return '<i class="fas fa-times-circle"></i> Ungültig';

                    case SessionVerificationResult.ValidSignature:
                        return '<i class="fas fa-check-circle"></i> Gültig';


                    default:
                        return '<i class="fas fa-times-circle"></i> Ungültig';

                }
    
            }


            chargingStationOperators  = [];
            chargingPools             = [];
            chargingStations          = [];
            EVSEs                     = [];
            meters                    = [];
            eMobilityProviders        = [];
            mediationServices         = [];
            chargingSessions          = [];

            var markers: any = [];
            var minlat                    = +1000;
            var maxlat                    = -1000;
            var minlng                    = +1000;
            var maxlng                    = -1000;

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
                beginDiv.innerHTML = "von " + parseUTC(CTR.begin).format('dddd, D. MMMM YYYY');
            }

            if (CTR.end) {
                let endDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
                endDiv.id          = "begin";
                endDiv.className   = "defi";
                endDiv.innerHTML   = "bis " + parseUTC(CTR.end).format('dddd, D. MMMM YYYY');
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

                        }

                    }

                    if (chargingStationOperator.EVSEs) {

                        for (var EVSE of chargingStationOperator.EVSEs)
                        {

                            // EVSE.chargingStation    = chargingStation;
                            // EVSE.chargingStationId  = chargingStation["@id"];

                            EVSEs.push(EVSE);

                            if (EVSE.meters) {

                                for (var meter of EVSE.meters)
                                {

                                    meter.EVSE               = EVSE;
                                    meter.EVSEId             = EVSE["@id"];

                                    // meter.chargingStation    = chargingStation;
                                    // meter.chargingStationId  = chargingStation["@id"];

                                    meters.push(meter);

                                }

                            }

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


            //#region Show all charging sessions...

            if (CTR.chargingSessions) {

                let chargingSessionsDiv  = chargingSessionReportDiv.appendChild(document.createElement('div'));
                chargingSessionsDiv.id   = "chargingSessions";

                for (var chargingSession of CTR.chargingSessions)
                {

                    let chargingSessionDiv      = CreateDiv(chargingSessionsDiv, "chargingSessions");               
                    chargingSessionDiv.onclick  = captureChargingSession(chargingSession);

                    //#region Show session time infos

                    try {

                        if (chargingSession.begin)
                        {

                            var beginUTC = parseUTC(chargingSession.begin);

                            let dateDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                            dateDiv.className = "date";
                            dateDiv.innerHTML = beginUTC.format('dddd, D; MMM YYYY HH:mm:ss').
                                                        replace(".", "").   // Nov. -> Nov
                                                        replace(";", ".") +  // 14;  -> 14.
                                                        " Uhr";

                            if (chargingSession.end)
                            {

                                var endUTC   = parseUTC(chargingSession.end);
                                var duration = moment.duration(endUTC - beginUTC);

                                dateDiv.innerHTML += " - " +
                                                    (Math.floor(duration.asDays()) > 0 ? endUTC.format("dddd") + " " : "") +
                                                    endUTC.format('HH:mm:ss') +
                                                    " Uhr";

                            }

                        }

                    }
                    catch (exception)
                    { 
                        console.log("Could not show session time infos of charging session '" + chargingSession["@id"] + "':" + exception);
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
                        productDiv.className                 = "productText";
                        productDiv.innerHTML = chargingSession.product != null ? chargingSession.product["@id"] + "<br />" : "";

                        productDiv.innerHTML += "Ladedauer ";
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
                                    var amount = parseFloat(((last - first) * Math.pow(10, measurement.scale)).toFixed(10));

                                    switch (measurement.unit)
                                    {

                                        case "KILO_WATT_HOURS":
                                            break;

                                        // "WATT_HOURS"
                                        default:
                                            amount = parseFloat((amount / 1000).toFixed(10));
                                            break;

                                    }

                                    productDiv.innerHTML += "<br />" + translateMeasurementName(measurement.name) + " " + amount.toString() + " kWh (" + measurement.values.length + " Messwerte)";

                                }

                            }
                        }

                    }
                    catch (exception)
                    { 
                        console.log("Could not show energy infos of charging session '" + chargingSession["@id"] + "':" + exception);
                    }

                    //#endregion

                    //#region Show location infos...

                    try
                    {

                        if (chargingSession.EVSEId            || chargingSession.EVSE            ||
                            chargingSession.chargingStationId || chargingSession.chargingStation ||
                            chargingSession.chargingPoolId    || chargingSession.chargingPool) {

                            var address:IAddress                  = null;

                            var locationInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                            locationInfoDiv.className             = "locationInfos";

                            var locationIconDiv                   = locationInfoDiv.appendChild(document.createElement('div'));
                            locationIconDiv.className             = "locationIcon";
                            locationIconDiv.innerHTML             = '<i class="fas fa-map-marker-alt"></i>';

                            var locationDiv                       = locationInfoDiv.appendChild(document.createElement('div'));
                            locationDiv.classList.add("locationText");

                            if (chargingSession.EVSEId || chargingSession.EVSE) {

                                if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                                    chargingSession.EVSE = GetEVSE(chargingSession.EVSEId);

                                locationDiv.classList.add("EVSE");
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

                                if (chargingSession.chargingStation != null)
                                {

                                    locationDiv.classList.add("chargingStation");
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
                                else
                                    locationInfoDiv.remove();

                            }

                            else if (chargingSession.chargingPoolId || chargingSession.chargingPool) {

                                if (chargingSession.chargingPool == null || typeof chargingSession.chargingPool !== 'object')
                                    chargingSession.chargingPool = GetChargingPool(chargingSession.chargingPoolId);

                                if (chargingSession.chargingPool != null)
                                {

                                    locationDiv.classList.add("chargingPool");
                                    locationDiv.innerHTML             = (chargingSession.chargingPool   != null && chargingSession.chargingPool.description != null
                                                                            ? firstValue(chargingSession.chargingPool.description) + "<br />"
                                                                            : "") +
                                                                        (chargingSession.chargingPoolId != null
                                                                            ? chargingSession.chargingPoolId
                                                                            : chargingSession.chargingPool["@id"]);

                                    address = GetChargingPool(chargingSession.chargingPool["@id"]).address;

                                }
                                else
                                    locationInfoDiv.remove();

                            }

                            if (address != null)
                                locationDiv.innerHTML += "<br />" + 
                                                            (address.street      != null ? " " + address.street        : "") +
                                                            (address.houseNumber != null ? " " + address.houseNumber   : "") +

                                                            (address.postalCode  != null || address.city != null ? "," : "") +
                                                            (address.postalCode  != null ? " " + address.postalCode    : "") +
                                                            (address.city        != null ? " " + address.city : "");

                        }

                    } catch (exception)
                    {
                        console.log("Could not show location infos of charging session '" + chargingSession["@id"] + "':" + exception);
                    }

                    //#endregion

                    //#region Show verification status

                    let verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                    verificationStatusDiv.className = "verificationStatus";
                    verificationStatusDiv.innerHTML = checkSessionCrypto(chargingSession);

                    //#endregion


                    // If there is only one charging session show its details at once...
                    if (CTR.chargingSessions.length == 1)
                        chargingSessionDiv.click();

                }

                map.fitBounds([[minlat, minlng], [maxlat, maxlng]],
                    { padding: [40, 40] });

            }

            //#endregion

        }

        // e.g. the current chargeIT mobility does not provide any format identifiers
        function tryToParseAnonymousFormat(SomeJSON) : boolean
        {

            if (!Array.isArray(SomeJSON))
            {

                var signedMeterValues = SomeJSON.signedMeterValues as Array<any>;
                var placeInfo         = SomeJSON.placeInfo;

                // {
                //     "signedMeterValues":[{
                //         "timestamp": 1550533285,
                //         "meterInfo": {
                //            "firmwareVersion": "123",
                //            "publicKey": "08A56CF3B51DABA44F38607BB884F62FB8BE84B4EF39D09624AB9E0910354398590DC59A5B40F43FE68A9F416F65EC76",
                //            "meterId": "0901454D4800007F9F3E",
                //            "type": "eHZ IW8E EMH",
                //            "manufacturer": "EMH"
                //         },
                //         "transactionId": "1546933282548:-7209653592192971037:1",
                //         "contract": {
                //            "type": "RFID_TAG_ID",
                //            "timestampLocal": {
                //               "timestamp": 1546933284,
                //               "localOffset": 60,
                //               "seasonOffset": 0
                //            },
                //            "timestamp": 1550533284,
                //            "id": "235DD5BB"
                //         },
                //         "measurementId": "00000007",
                //         "measuredValue": {
                //            "timestampLocal": {
                //               "timestamp": 1546933285,
                //               "localOffset": 60,
                //               "seasonOffset": 0
                //            },
                //            "value": "60077",
                //            "unit": "WATT_HOUR",
                //            "scale": -1,
                //            "valueType": "Integer64",
                //            "unitEncoded": 30
                //         },
                //         "measurand": {
                //            "id": "0100011100FF",
                //            "name": "ENERGY_TOTAL"
                //         },
                //         "additionalInfo": {
                //            "indexes": {
                //               "timer": 1730275,
                //               "logBook": "0004"
                //            },
                //            "status": "88"
                //         },
                //         "signature": "13493BBB43DA1E26C88B21ADB7AA53A7AE4FC7F6F6B916E67AD3E168421D180F021D6DD458612C53FF167781892A9DF3"
                //     }],
                //
                //     "placeInfo": {
                //         "evseId": "DE*BDO*74778874*1",
                //         "address": {
                //             "street": "Musterstraße 12",
                //             "zipCode": "74789",
                //             "town": "Stadt" 
                //         },
                //         "geoLocation": {
                //             "lat": 12.3774,
                //             "lon": 1.3774
                //         }
                //     }
                // }

                try {

                    var CTRArray = [];

                    for (var i = 0; i < signedMeterValues.length; i++) {

                        var signedMeterValue = signedMeterValues[i];

                        var _timestamp = signedMeterValue["timestamp"] as number;
                        if (_timestamp == null || typeof _timestamp !== 'number')
                            throw "Missing or invalid timestamp[" + i + "]!"
                        var timestamp = parseUTC(_timestamp);

                        var _meterInfo = signedMeterValue["meterInfo"] as string;
                        if (_meterInfo == null || typeof _meterInfo !== 'object')
                            throw "Missing or invalid meterInfo[" + i + "]!"

                        var _meterInfo_firmwareVersion = _meterInfo["firmwareVersion"] as string;
                        if (_meterInfo_firmwareVersion == null || typeof _meterInfo_firmwareVersion !== 'string')
                            throw "Missing or invalid meterInfo firmwareVersion[" + i + "]!"

                        var _meterInfo_publicKey = _meterInfo["publicKey"] as string;
                        if (_meterInfo_publicKey == null || typeof _meterInfo_publicKey !== 'string')
                            throw "Missing or invalid meterInfo publicKey[" + i + "]!"

                        var _meterInfo_meterId = _meterInfo["meterId"] as string;
                        if (_meterInfo_meterId == null || typeof _meterInfo_meterId !== 'string')
                            throw "Missing or invalid meterInfo meterId[" + i + "]!"

                        var _meterInfo_type = _meterInfo["type"] as string;
                        if (_meterInfo_type == null || typeof _meterInfo_type !== 'string')
                            throw "Missing or invalid meterInfo type[" + i + "]!"

                        var _meterInfo_manufacturer = _meterInfo["manufacturer"] as string;
                        if (_meterInfo_manufacturer == null || typeof _meterInfo_manufacturer !== 'string')
                            throw "Missing or invalid meterInfo manufacturer[" + i + "]!"


                        var _transactionId = signedMeterValue["transactionId"] as string;
                        if (_transactionId == null || typeof _transactionId !== 'string')
                            throw "Missing or invalid transactionId[" + i + "]!"


                        var _contract = signedMeterValue["contract"];
                        if (_contract == null || typeof _contract !== 'object')
                            throw "Missing or invalid contract[" + i + "]!"

                        var _contract_type = _contract["type"] as string;
                        if (_contract_type == null || typeof _contract_type !== 'string')
                            throw "Missing or invalid contract type[" + i + "]!"

                        var _contract_timestampLocal = _contract["timestampLocal"];
                        if (_contract_timestampLocal == null || typeof _contract_timestampLocal !== 'object')
                            throw "Missing or invalid contract timestampLocal[" + i + "]!"

                        var _contract_timestampLocal_timestamp = _contract_timestampLocal["timestamp"] as number;
                        if (_contract_timestampLocal_timestamp == null || typeof _contract_timestampLocal_timestamp !== 'number')
                            throw "Missing or invalid contract timestampLocal timestamp[" + i + "]!"                            

                        var _contract_timestampLocal_localOffset = _contract_timestampLocal["localOffset"] as number;
                        if (_contract_timestampLocal_localOffset == null || typeof _contract_timestampLocal_localOffset !== 'number')
                            throw "Missing or invalid contract timestampLocal localOffset[" + i + "]!"                            
                            
                        var _contract_timestampLocal_seasonOffset = _contract_timestampLocal["seasonOffset"] as number;
                        if (_contract_timestampLocal_seasonOffset == null || typeof _contract_timestampLocal_seasonOffset !== 'number')
                            throw "Missing or invalid contract timestampLocal seasonOffset[" + i + "]!"  

                        var _contract_timestamp = _contract["timestamp"] as number;
                        if (_contract_timestamp == null || typeof _contract_timestamp !== 'number')
                            throw "Missing or invalid contract timestamp[" + i + "]!"

                        var _contract_id = _contract["id"] as string;
                        if (_contract_id == null || typeof _contract_id !== 'string')
                            throw "Missing or invalid contract type[" + i + "]!"


                        var _measurementId = signedMeterValue["measurementId"] as string;
                        if (_measurementId == null || typeof _measurementId !== 'string')
                            throw "Missing or invalid measurementId[" + i + "]!"


                        var _measuredValue = signedMeterValue["measuredValue"];
                        if (_measuredValue == null || typeof _measuredValue !== 'object')
                            throw "Missing or invalid measuredValue[" + i + "]!"

                        var _measuredValue_timestampLocal = _measuredValue["timestampLocal"];
                        if (_measuredValue_timestampLocal == null || typeof _measuredValue_timestampLocal !== 'object')
                            throw "Missing or invalid measuredValue timestampLocal[" + i + "]!"

                        var _measuredValue_timestampLocal_timestamp = _measuredValue_timestampLocal["timestamp"] as number;
                        if (_measuredValue_timestampLocal_timestamp == null || typeof _measuredValue_timestampLocal_timestamp !== 'number')
                            throw "Missing or invalid measuredValue timestampLocal timestamp[" + i + "]!"                            

                        var _measuredValue_timestampLocal_localOffset = _measuredValue_timestampLocal["localOffset"] as number;
                        if (_measuredValue_timestampLocal_localOffset == null || typeof _measuredValue_timestampLocal_localOffset !== 'number')
                            throw "Missing or invalid measuredValue timestampLocal localOffset[" + i + "]!"                            
                            
                        var _measuredValue_timestampLocal_seasonOffset = _measuredValue_timestampLocal["seasonOffset"] as number;
                        if (_measuredValue_timestampLocal_seasonOffset == null || typeof _measuredValue_timestampLocal_seasonOffset !== 'number')
                            throw "Missing or invalid measuredValue timestampLocal seasonOffset[" + i + "]!"                            

                        var _measuredValue_value = _measuredValue["value"] as string;
                        if (_measuredValue_value == null || typeof _measuredValue_value !== 'string')
                            throw "Missing or invalid measuredValue value[" + i + "]!"

                        var _measuredValue_unit = _measuredValue["unit"] as string;
                        if (_measuredValue_unit == null || typeof _measuredValue_unit !== 'string')
                            throw "Missing or invalid measuredValue unit[" + i + "]!"

                        var _measuredValue_scale = _measuredValue["scale"] as number;
                        if (_measuredValue_scale == null || typeof _measuredValue_scale !== 'number')
                            throw "Missing or invalid measuredValue scale[" + i + "]!"

                        var _measuredValue_valueType = _measuredValue["valueType"] as string;
                        if (_measuredValue_valueType == null || typeof _measuredValue_valueType !== 'string')
                            throw "Missing or invalid measuredValue valueType[" + i + "]!"

                        var _measuredValue_unitEncoded = _measuredValue["unitEncoded"] as number;
                        if (_measuredValue_unitEncoded == null || typeof _measuredValue_unitEncoded !== 'number')
                            throw "Missing or invalid measuredValue unitEncoded[" + i + "]!"


                        var _measurand = signedMeterValue["measurand"];
                            if (_measurand == null || typeof _measurand !== 'object')
                                throw "Missing or invalid measurand[" + i + "]!"

                        var _measurand_id = _measurand["id"] as string;
                        if (_measurand_id == null || typeof _measurand_id !== 'string')
                            throw "Missing or invalid measurand id[" + i + "]!"

                        var _measurand_name = _measurand["name"] as string;
                        if (_measurand_name == null || typeof _measurand_name !== 'string')
                            throw "Missing or invalid measurand name[" + i + "]!"


                        var _additionalInfo = signedMeterValue["additionalInfo"];
                            if (_additionalInfo == null || typeof _additionalInfo !== 'object')
                                throw "Missing or invalid additionalInfo[" + i + "]!"

                        var _additionalInfo_indexes = _additionalInfo["indexes"];
                        if (_additionalInfo_indexes == null || typeof _additionalInfo_indexes !== 'object')
                            throw "Missing or invalid additionalInfo indexes[" + i + "]!"

                        var _additionalInfo_indexes_timer = _additionalInfo_indexes["timer"] as number;
                        if (_additionalInfo_indexes_timer == null || typeof _additionalInfo_indexes_timer !== 'number')
                            throw "Missing or invalid additionalInfo indexes timer[" + i + "]!"

                        var _additionalInfo_indexes_logBook = _additionalInfo_indexes["logBook"] as string;
                        if (_additionalInfo_indexes_logBook == null || typeof _additionalInfo_indexes_logBook !== 'string')
                            throw "Missing or invalid additionalInfo indexes logBook[" + i + "]!"
                            
                        var _additionalInfo_status = _additionalInfo["status"] as string;
                        if (_additionalInfo_status == null || typeof _additionalInfo_status !== 'string')
                            throw "Missing or invalid additionalInfo status[" + i + "]!"


                        var _signature = signedMeterValue["signature"] as string;
                        if (_signature == null || typeof _signature !== 'string')
                            throw "Missing or invalid signature[" + i + "]!"


                        var aaa = moment.unix(_contract_timestampLocal_timestamp).utc();

                        CTRArray.push({
                                    "timestamp": _timestamp,
                                    "meterInfo": {
                                       "firmwareVersion": _meterInfo_firmwareVersion,
                                       "publicKey": _meterInfo_publicKey,
                                       "meterId": _meterInfo_meterId,
                                       "type": _meterInfo_type,
                                       "manufacturer": _meterInfo_manufacturer
                                    },
                                    "transactionId": _transactionId,
                                    "contract": {
                                       "type": _contract_type,
                                       "timestampLocal": {
                                          "timestamp": _contract_timestampLocal_timestamp,
                                          "localOffset": _contract_timestampLocal_localOffset,
                                          "seasonOffset": _contract_timestampLocal_seasonOffset
                                       },
                                       "timestamp": _contract_timestamp,
                                       "id": _contract_id
                                    },
                                    "measurementId": _measurementId,
                                    "measuredValue": {
                                       "timestampLocal": {
                                          "timestamp": _measuredValue_timestampLocal_timestamp,
                                          "localOffset": _measuredValue_timestampLocal_localOffset,
                                          "seasonOffset": _measuredValue_timestampLocal_seasonOffset
                                       },
                                       "value": _measuredValue_value,
                                       "unit": _measuredValue_unit,
                                       "scale": _measuredValue_scale,
                                       "valueType": _measuredValue_valueType,
                                       "unitEncoded": _measuredValue_unitEncoded
                                    },
                                    "measurand": {
                                       "id": _measurand_id,
                                       "name": _measurand_name
                                    },
                                    "additionalInfo": {
                                       "indexes": {
                                          "timer": _additionalInfo_indexes_timer,
                                          "logBook": _additionalInfo_indexes_logBook
                                       },
                                       "status": _additionalInfo_status
                                    },
                                    "signature": _signature
                        });

                    }


                    var evseId = placeInfo["evseId"] as string;
                    if (evseId == null || typeof evseId !== 'string')
                        throw "Missing or invalid EVSE Id!"


                    var address = placeInfo["address"];
                    if (address == null)
                        throw "Missing or invalid address!"

                    var address_street = address["street"];
                    if (address_street == null || typeof address_street !== 'string')
                        throw "Missing or invalid address street!"

                    var address_zipCode = address["zipCode"];
                    if (address_zipCode == null || typeof address_zipCode !== 'string')
                        throw "Missing or invalid address zipCode!"

                    var address_town = address["town"];
                    if (address_town == null || typeof address_town !== 'string')
                        throw "Missing or invalid address town!"

           
                    var geoLocation = placeInfo["geoLocation"];
                    if (geoLocation == null)
                        throw "Missing or invalid geoLocation!"

                    var geoLocation_lat = geoLocation["lat"];
                    if (geoLocation_lat == null || typeof geoLocation_lat !== 'number')
                        throw "Missing or invalid geoLocation latitude!"

                    var geoLocation_lon = geoLocation["lon"];
                    if (geoLocation_lon == null || typeof geoLocation_lon !== 'number')
                        throw "Missing or invalid geoLocation longitude!"


                    var n = CTRArray.length-1;
                    var _CTR: any = { //IChargeTransparencyRecord = {

                        "@id":              _transactionId,
                        "@context":         "https://open.charging.cloud/contexts/CTR+json",
                    
                        "begin":            moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                        "end":              moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                    
                        "description": {
                            "de":           "Alle Ladevorgänge"
                        },
                    
                        "contract": {
                            "@id":          _contract_id,
                            "username":     "",
                            "email":        ""
                        },

                        "chargingStationOperators": [
                            {

                                "@id":                      "chargeITmobilityCSO",
                                "eMobilityIds":             [ "DE*BDO", "DE*LVF", "+49*822" ],
                                "description": {
                                    "de":                   "chargeIT mobility GmbH - Charging Station Operator Services"
                                },
                    
                                "contact": {
                                    "email":                    "info@chargeit-mobility.com",
                                    "web":                      "https://www.chargeit-mobility.com",
                                    "logoUrl":                  "http://www.chargeit-mobility.com/fileadmin/BELECTRIC_Drive/templates/pics/chargeit_logo_408x70.png",
                                    "publicKeys": [
                                        {
                                            "algorithm":        "secp192r1",
                                            "format":           "DER",
                                            "value":            "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                            "signatures": [
                                                {
                                                    "keyId":      "...",
                                                    "algorithm":  "secp192r1",
                                                    "format":     "DER",
                                                    "value":      "????"
                                                }
                                            ]
                                        },
                                        {
                                            "algorithm":        "secp256k1",
                                            "format":           "DER",
                                            "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                            "signatures":       [ ]
                                        }
                                    ]
                                },
                    
                                "support": {
                                    "hotline":                  "+49 9321 / 2680 - 700",
                                    "email":                    "service@chargeit-mobility.com",
                                    "web":                      "https://cso.chargeit.charging.cloud/issues"
                                    // "mediationServices":        [ "GraphDefined Mediation" ],
                                    // "publicKeys": [
                                    //     {
                                    //         "algorithm":        "secp256k1",
                                    //         "format":           "DER",
                                    //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                    //         "signatures":       [ ]
                                    //     }
                                    // ]
                                },

                                "privacy": {
                                    "contact":                  "Dr. iur. Christian Borchers, datenschutz süd GmbH",
                                    "email":                    "datenschutz@chargeit-mobility.com",
                                    "web":                      "http://www.chargeit-mobility.com/de/datenschutz/"
                                    // "publicKeys": [
                                    //     {
                                    //         "algorithm":        "secp256k1",
                                    //         "format":           "DER",
                                    //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                    //         "signatures":       [ ]
                                    //     }
                                    // ]
                                },

                                "chargingStations": [
                                    {
                                        "@id":                      evseId,
                                        // "description": {
                                        //     "de":                   "GraphDefined Charging Station - CI-Tests Pool 3 / Station A"
                                        // },
                                        "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                        "address": {
                                            "street":               address_street,
                                            "postalCode":           address_zipCode,
                                            "city":                 address_town
                                        },
                                        "EVSEs": [
                                            {
                                                "@id":                      evseId,
                                                // "description": {
                                                //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                                // },
                                                "sockets":                  [ { } ],
                                                "meters": [
                                                    {
                                                        "@id":                      CTRArray[0]["meterInfo"]["meterId"],
                                                        "vendor":                   CTRArray[0]["meterInfo"]["manufacturer"],
                                                        "vendorURL":                "http://www.emh-metering.de",
                                                        "model":                    CTRArray[0]["meterInfo"]["type"],
                                                        "hardwareVersion":          "1.0",
                                                        "firmwareVersion":          CTRArray[0]["meterInfo"]["firmwareVersion"],
                                                        "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                        "publicKeys": [
                                                            {
                                                                "algorithm":        "secp192r1",
                                                                "format":           "DER",
                                                                "value":            "04" + CTRArray[0]["meterInfo"]["publicKey"]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]

                            }
                        ],

                        "chargingSessions": [

                            {

                                "@id":                          _transactionId,
                                "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json",
                                "begin":                        moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                                "end":                          moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                                "EVSEId":                       evseId,
                    
                                "authorizationStart": {
                                    "@id":                      CTRArray[0]["contract"]["id"],
                                    "type":                     CTRArray[0]["contract"]["type"],
                                    "timestamp":                moment.unix(CTRArray[0]["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                            CTRArray[0]["contract"]["timestampLocal"]["localOffset"] +
                                                                            CTRArray[0]["contract"]["timestampLocal"]["seasonOffset"]).format(),
                                },

                                "signatureInfos": {
                                    "hash":                     "SHA256",
                                    "hashTruncation":           "24",
                                    "algorithm":                "ECC",
                                    "curve":                    "secp192r1",
                                    "format":                   "rs"
                                },

                                "measurements": [

                                    {

                                        "energyMeterId":        CTRArray[0]["meterInfo"]["meterId"],
                                        "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json",
                                        "name":                 CTRArray[0]["measurand"]["name"],
                                        "obis":                 CTRArray[0]["measurand"]["id"],
                                        "unit":                 CTRArray[0]["measuredValue"]["unit"],
                                        "unitEncoded":          CTRArray[0]["measuredValue"]["unitEncoded"],
                                        "valueType":            CTRArray[0]["measuredValue"]["valueType"],
                                        "scale":                CTRArray[0]["measuredValue"]["scale"],

                                        "signatureInfos": {
                                            "hash":                 "SHA256",
                                            "hashTruncation":       "24",
                                            "algorithm":            "ECC",
                                            "curve":                "secp192r1",
                                            "format":               "rs"
                                        },

                                        "values": [ ]

                                    }

                                ]

                            }

                        ]

                    };

                    for (var _measurement of CTRArray)
                    {

                        _CTR["chargingSessions"][0]["measurements"][0]["values"].push(

                                                {
                                                    "timestamp":      moment.unix(_measurement["measuredValue"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                                  _measurement["measuredValue"]["timestampLocal"]["localOffset"] +
                                                                                  _measurement["measuredValue"]["timestampLocal"]["seasonOffset"]).format(),
                                                    "value":          _measurement["measuredValue"]["value"],
                                                    "infoStatus":     _measurement["additionalInfo"]["status"],
                                                    "secondsIndex":   _measurement["additionalInfo"]["indexes"]["timer"],
                                                    "paginationId":   _measurement["measurementId"],
                                                    "logBookIndex":   _measurement["additionalInfo"]["indexes"]["logBook"],
                                                    "signatures": [
                                                        {
                                                            "r":          _measurement["signature"].substring(0, 48),
                                                            "s":          _measurement["signature"].substring(48)
                                                        }
                                                    ]
                                                }

                        );

                    }

                    processChargeTransparencyRecord(_CTR);
                    return true;

                }
                catch (exception)
                {
                    console.log("chargeIT mobility legacy CTR format: " + exception);
                }                

            }

            return false;

        }


        if (Content == null)
            return;

        inputInfosDiv.style.display  = 'none';
        errorTextDiv.style.display   = 'none';

        switch (Content["@context"])
        {

            case "https://open.charging.cloud/contexts/CTR+json":
                processChargeTransparencyRecord(Content);
                break;

            default:
                if (!tryToParseAnonymousFormat(Content))
                    doGlobalError("Unbekanntes Transparenzdatensatzformat!");
                break;

        }

    }

    //#endregion

    //#region showChargingSessionDetails

    function showChargingSessionDetails(chargingSession: IChargingSession)
    {

        function checkMeasurementCrypto(measurementValue: IMeasurementValue)
        {

            var result = verifyMeasurementCryptoDetails(measurementValue);

            switch (result.status)
            {

                    case VerificationResult.UnknownCTRFormat:
                        return '<i class="fas fa-times-circle"></i> Unbekanntes Transparenzdatenformat';

                    case VerificationResult.EnergyMeterNotFound:
                        return '<i class="fas fa-times-circle"></i> Ungültiger Energiezähler';

                    case VerificationResult.PublicKeyNotFound:
                        return '<i class="fas fa-times-circle"></i> Ungültiger Public Key';

                    case VerificationResult.InvalidPublicKey:
                        return '<i class="fas fa-times-circle"></i> Ungültiger Public Key';

                    case VerificationResult.InvalidSignature:
                        return '<i class="fas fa-times-circle"></i> Ungültige Signatur';

                    case VerificationResult.ValidSignature:
                        return '<i class="fas fa-check-circle"></i> Gültige Signatur';
    

                    default:
                        return '<i class="fas fa-times-circle"></i> Ungültige Signatur';

            }            

        }


        try
        {

            evseTarifInfosDiv.innerHTML = "";

            if (chargingSession.measurements)
            {
                for (var measurement of chargingSession.measurements)
                {

                    measurement.chargingSession      = chargingSession;

                    let MeasurementInfoDiv           = CreateDiv(evseTarifInfosDiv,  "measurementInfo");

                    //#region Show meter vendor infos

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

                    //#region Show meter infos

                    let MeterDiv                    = CreateDiv(MeasurementInfoDiv,  "meter");

                    let MeterIdDiv                  = CreateDiv(MeterDiv,            "meterId",
                                                                meter != null ? "Seriennummer" : "Zählerseriennummer");

                    let MeterIdValueDiv             = CreateDiv(MeterDiv,            "meterIdValue",
                                                                measurement.energyMeterId);

                    //#endregion

                    //#region Show measurement infos

                    let MeasurementDiv               = CreateDiv(MeasurementInfoDiv, "measurement");

                    let MeasurementIdDiv             = CreateDiv(MeasurementDiv,     "measurementId",
                                                                 "Messung");

                    let MeasurementIdValueDiv        = CreateDiv(MeasurementDiv,     "measurementIdValue",
                                                                 measurement.name + " (OBIS: " + parseOBIS(measurement.obis) + ")");

                    //#endregion

                    //#region Show measurement values...

                    if (measurement.values && measurement.values.length > 0)
                    {

                        //<i class="far fa-chart-bar"></i>

                        let MeasurementValuesDiv         = CreateDiv(evseTarifInfosDiv, "measurementValues");
                        let previousValue                = 0;

                        for (var measurementValue of measurement.values)
                        {

                            measurementValue.measurement     = measurement;

                            let MeasurementValueDiv          = CreateDiv(MeasurementValuesDiv, "measurementValue");
                            MeasurementValueDiv.onclick      = captureMeasurementCryptoDetails(measurementValue);

                            var timestamp                    = parseUTC(measurementValue.timestamp);

                            let timestampDiv                 = CreateDiv(MeasurementValueDiv, "timestamp",
                                                                         timestamp.format('HH:mm:ss') + " Uhr");


                            // Show energy counter value
                            let value2Div                    = CreateDiv(MeasurementValueDiv, "value",
                                                                         parseFloat((measurementValue.value * Math.pow(10, measurementValue.measurement.scale)).toFixed(10)).toString());

                            switch (measurement.unit)
                            {

                                case "KILO_WATT_HOURS":
                                    CreateDiv(MeasurementValueDiv, "unit", "kWh");
                                    break;

                                // "WATT_HOURS"
                                default:
                                    CreateDiv(MeasurementValueDiv, "unit", "Wh");
                                    break;

                            }


                            // Show energy difference
                            var currentValue                 = measurementValue.value;

                            switch (measurement.unit)
                            {

                                case "KILO_WATT_HOURS":
                                    currentValue = parseFloat((currentValue * Math.pow(10, measurementValue.measurement.scale)).toFixed(10));
                                    break;

                                // "WATT_HOURS"
                                default:
                                    currentValue = parseFloat((currentValue / 1000 * Math.pow(10, measurementValue.measurement.scale)).toFixed(10));
                                    break;

                            }

                            let valueDiv                     = CreateDiv(MeasurementValueDiv, "value",
                                                                         "+" + (previousValue > 0
                                                                                    ? parseFloat((currentValue - previousValue).toFixed(10))
                                                                                    : "0"));

                            let unitDiv                      = CreateDiv(MeasurementValueDiv, "unit",
                                                                         "kWh");


                            // Show signature status
                            let verificationStatusDiv        = CreateDiv(MeasurementValueDiv, "verificationStatus",
                                                                         checkMeasurementCrypto(measurementValue));

                            previousValue                    = currentValue;

                        }

                    }

                    //#endregion

                }
            }

        }
        catch (exception)
        { 
            console.log("Could not show charging session details: " + exception);
        }

    }

    //#region Capture the correct charging session and its context!

    function captureChargingSession(cs: IChargingSession) {
        return function(this: HTMLDivElement, ev: MouseEvent) {

            //#region Highlight the selected charging session...

            var AllChargingSessionsDivs = document.getElementsByClassName("chargingSessions");
            for(var i=0; i<AllChargingSessionsDivs.length; i++)
                AllChargingSessionsDivs[i].classList.remove("activated");

            this.classList.add("activated");

            //#endregion

            showChargingSessionDetails(cs);

        };
    }

    //#endregion

    //#endregion


    //#region verifySessionCryptoDetails

    function verifySessionCryptoDetails(chargingSession: IChargingSession) : ISessionCryptoResult
    {

        var result: ISessionCryptoResult = {
            status: SessionVerificationResult.UnknownSessionFormat
        };

        if (chargingSession              == null ||
            chargingSession.measurements == null)
        {
            return result;
        }

        switch (chargingSession["@context"])
        {

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/GDFCrypt01+json":
                chargingSession.method = new GDFCrypt01(GetMeter);
                return chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json":
                chargingSession.method = new EMHCrypt01(GetMeter);
                return chargingSession.method.VerifyChargingSession(chargingSession);

            default:
                return result;

        }

    }

    //#endregion

    //#region verifyMeasurementCryptoDetails

    function verifyMeasurementCryptoDetails(measurementValue:  IMeasurementValue) : ICryptoResult
    {

        var result: ICryptoResult = {
            status: VerificationResult.UnknownCTRFormat
        };

        if (measurementValue             == null ||
            measurementValue.measurement == null)
        {
            return result;
        }

        switch (measurementValue.measurement["@context"])
        {

            case "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/GDFCrypt01+json":
                 measurementValue.method = new GDFCrypt01(GetMeter);
                 return measurementValue.method.VerifyMeasurement(measurementValue);

            case "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json":
                 if (measurementValue.measurement.chargingSession.method != null)
                 {

                    measurementValue.method = measurementValue.measurement.chargingSession.method;

                    if (measurementValue.result == null)
                        return measurementValue.method.VerifyMeasurement(measurementValue);

                    return measurementValue.result;

                 }

                 measurementValue.method = new EMHCrypt01(GetMeter);
                 return measurementValue.method.VerifyMeasurement(measurementValue);

            default:
                return result;

        }

    }

    //#endregion

    //#region showMeasurementCryptoDetails

    function showMeasurementCryptoDetails(measurementValue:  IMeasurementValue) : void
    {

        function doError(text: String)
        {
            //inputInfosDiv.style.display  = 'flex';
            //errorTextDiv.style.display   = 'inline-block';
            introDiv.innerHTML           = '<i class="fas fa-times-circle"></i> ' + text;
        }


        let introDiv       = overlayDiv.querySelector('#intro')      as HTMLDivElement;
        let cryptoDataDiv  = overlayDiv.querySelector('#cryptoData') as HTMLDivElement;

        if (measurementValue             == null ||
            measurementValue.measurement == null)
        {
            doError("Unbekanntes Messdatensatzformat!");
        }


        //#region Show data and result on overlay        

        overlayDiv.style.display = 'block';

        let bufferValue               = overlayDiv.querySelector('#buffer .value')             as HTMLDivElement;
        let hashedBufferValue         = overlayDiv.querySelector('#hashedBuffer .value')       as HTMLDivElement;
        let publicKeyValue            = overlayDiv.querySelector('#publicKey .value')          as HTMLDivElement;
        let signatureExpectedValue    = overlayDiv.querySelector('#signatureExpected .value')  as HTMLDivElement;
        let signatureCheckValue       = overlayDiv.querySelector('#signatureCheck')            as HTMLDivElement;

        //introDiv.innerHTML                = '';
        cryptoDataDiv.innerHTML           = '';
        bufferValue.innerHTML             = '';
        hashedBufferValue.innerHTML       = '0x00000000000000000000000000000000000';
        publicKeyValue.innerHTML          = '0x00000000000000000000000000000000000';
        signatureExpectedValue.innerHTML  = '0x00000000000000000000000000000000000';
        signatureCheckValue.innerHTML     = '';

        if (measurementValue.method)
            measurementValue.method.ViewMeasurement(measurementValue,
                                                    introDiv,
                                                    cryptoDataDiv,
                                                    bufferValue,
                                                    hashedBufferValue,
                                                    publicKeyValue,
                                                    signatureExpectedValue,
                                                    signatureCheckValue);

        else
        {
            doError("Unbekanntes Messdatensatzformat!");
        }

        //#endregion

    }

    //#region Capture the correct measurement value and its context!

    function captureMeasurementCryptoDetails(measurementValue: IMeasurementValue) {
        return function(this: HTMLDivElement, ev: MouseEvent) {
                   showMeasurementCryptoDetails(measurementValue);
               };
    }

    //#endregion

    //#endregion


    function showIssueTracker()
    {

        issueTracker.style.display = 'block';

    }



    //#region Global error handling...

    function doGlobalError(text:      String,
                           context?:  any)
    {

        inputInfosDiv.style.display             = 'flex';
        chargingSessionReportDiv.style.display  = 'none';
        chargingSessionReportDiv.innerHTML      = '';
        errorTextDiv.style.display              = 'inline-block';
        errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        console.log(text);
        console.log(context);

    }

    //#endregion

    //#region Process loaded CTR file...

    function readFileFromDisk(event) {
        readAndParseFile(event.target.files[0]);
    }

    //#endregion

    //#region Process dropped CTR file...

    function handleDroppedFile(event: DragEvent) {
        event.stopPropagation();
        event.preventDefault();
        (event.target as HTMLDivElement).classList.remove('over');
        readAndParseFile(event.dataTransfer.files[0]);
    }

    function handleDragEnter(event: DragEvent) {
        event.preventDefault();
        (event.target as HTMLDivElement).classList.add('over');
    }

    function handleDragOver(event: DragEvent) {
        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        (event.target as HTMLDivElement).classList.add('over');
    }

    function handleDragLeave(event: DragEvent) {
        (event.target as HTMLDivElement).classList.remove('over');
    }

    //#endregion

    //#region Read and parse CTR file

    function readAndParseFile(file: File) {

        if (!file)
            return;

        var reader = new FileReader();

        reader.onload = function(event) {
            try
            {
                detectContentFormat(JSON.parse((event.target as any).result));
            }
            catch (exception) {
                doGlobalError("Fehlerhafter Transparenzdatensatz!", exception);
            }
        }

        reader.onerror = function(event) {
            doGlobalError("Fehlerhafter Transparenzdatensatz!", event);
        }

        reader.readAsText(file, 'UTF-8');

    }

    //#endregion

    //#region Process pasted CTR file

    function PasteFile(this: HTMLElement, ev: MouseEvent) {

        (navigator as any).clipboard.readText().then(function (clipText: string) {

            try
            {
                detectContentFormat(JSON.parse(clipText));
            }
            catch (exception) {
                doGlobalError("Fehlerhafter Transparenzdatensatz!", exception);
            }

        });

    }

    //#endregion


    var d                         = document as any;

    var input                     = <HTMLDivElement>      document.getElementById('input');
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
    var rightbar                  = <HTMLDivElement>      document.getElementById('rightbar');
    var evseTarifInfosDiv         = <HTMLDivElement>      document.getElementById('evseTarifInfos');

    var feedbackDiv               = <HTMLDivElement>      document.getElementById('feedback');

    var issueTracker              = <HTMLDivElement>      document.getElementById('issueTracker');
    var showIssueTrackerButton    = <HTMLButtonElement>   document.getElementById('showIssueTracker');
    showIssueTrackerButton.onclick = function (this: HTMLElement, ev: MouseEvent) { showIssueTracker(); }
    var issueBackButton           = <HTMLButtonElement>   document.getElementById('issueBackButton');
    issueBackButton.onclick = function (this: HTMLElement, ev: MouseEvent) { issueTracker.style.display = 'none'; }

    var backButtonDiv             = <HTMLDivElement>      document.getElementById('backButtonDiv');
    backButtonDiv.onclick = function (this: HTMLElement, ev: MouseEvent) {
        inputInfosDiv.style.display             = 'flex';
        aboutScreenDiv.style.display            = "none";
        chargingSessionReportDiv.style.display  = "none";
        backButtonDiv.style.display             = "none";
        fileInput.value                         = "";
        evseTarifInfosDiv.innerHTML             = "";
    }    

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
