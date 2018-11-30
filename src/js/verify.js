///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
var chargingStationOperators = new Array();
var chargingPools = new Array();
var chargingStations = new Array();
var EVSEs = new Array();
var meters = new Array();
var eMobilityProviders = new Array();
var mediationServices = new Array();
var chargingSessions = new Array();
function StartDashboard() {
    var ec = new elliptic.ec('p192');
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
    function verify1(text, signature, pubkey) {
        var sha256hash = sha256_(text);
        try {
            var result = pubkey.verify(sha256hash, signature);
            return result
                ? VerificationResult.ValidSignature
                : VerificationResult.InvalidSignature;
        }
        catch (e) {
            //console.log(e);
        }
        if (typeof signature === 'string') {
            var result = pubkey.verify(sha256hash, {
                r: signature.substring(0, signature.length / 2),
                s: signature.substring(signature.length / 2)
            });
            return result
                ? VerificationResult.ValidSignature
                : VerificationResult.InvalidSignature;
        }
        return VerificationResult.VerificationFailed;
    }
    function verifyMeterValue(meterValue) {
        var buffer = new ArrayBuffer(320);
        var view = new DataView(buffer);
        SetHex(view, meterValue.meterInfo.meterId, 0, false);
        SetTimestamp(view, meterValue.timestamp, 10);
        SetHex(view, meterValue.additionalInfo.status, 14, false);
        SetTimestamp(view, meterValue.additionalInfo.indexes.timer, 15);
        SetHex(view, meterValue.measurementId, 19, true);
        SetHex(view, meterValue.measurand.id, 23, false);
        SetInt8(view, meterValue.measuredValue.unitEncoded, 29);
        SetInt8(view, meterValue.measuredValue.scale, 30);
        SetUInt64(view, meterValue.measuredValue.value, 31, true);
        SetHex(view, meterValue.additionalInfo.indexes.logBook, 39, true);
        SetText(view, meterValue.contract.id, 41);
        SetTimestamp(view, meterValue.contract.timestamp, 169);
        var hexbuf = buf2hex(buffer);
        console.log(hexbuf);
        var result = verify1(hexbuf, meterValue.signature, ec.keyFromPublic("04" + meterValue.meterInfo.publicKey, 'hex'));
        console.log(VerificationResult[result]);
        return result;
    }
    this.verifyMeterValue = function (meterValue) {
        verifyMeterValue(meterValue);
    };
    function verifyMeterValues(meterValues) {
        var buffer = new ArrayBuffer(320);
        var view = new DataView(buffer);
        var results = [];
        for (var i = 0; i < meterValues.measuredValues.length; i++) {
            var meterValue = meterValues.measuredValues[i];
            SetHex(view, meterValues.meterInfo.meterId, 0, false);
            SetTimestamp(view, meterValue.timestamp, 10);
            SetHex(view, meterValue.additionalInfo.status, 14, false);
            SetTimestamp(view, meterValue.additionalInfo.indexes.timer, 15);
            SetHex(view, meterValue.measurementId, 19, true);
            SetHex(view, meterValues.measurand.id, 23, false);
            SetInt8(view, meterValues.measuredValue.unitEncoded, 29);
            SetInt8(view, meterValues.measuredValue.scale, 30);
            SetUInt64(view, meterValue.measuredValue.value, 31, true);
            SetHex(view, meterValue.additionalInfo.indexes.logBook, 39, true);
            SetText(view, meterValues.contract.id, 41);
            SetTimestamp(view, meterValues.contract.timestamp, 169);
            var hexbuf = buf2hex(buffer);
            console.log(hexbuf);
            var result = verify1(hexbuf, meterValue.signature, ec.keyFromPublic("04" + meterValues.meterInfo.publicKey, 'hex'));
            console.log(VerificationResult[result]);
            if (result == VerificationResult.ValidSignature)
                results.push([meterValue, result]);
            else
                return result;
        }
        return VerificationResult.ValidSignature;
    }
    this.verifyMeterValues = function (meterValues) {
        verifyMeterValues(meterValues);
    };
    function GetChargingPool(Id) {
        for (var _i = 0, chargingPools_1 = chargingPools; _i < chargingPools_1.length; _i++) {
            var chargingPool = chargingPools_1[_i];
            if (chargingPool["@id"] == Id)
                return chargingPool;
        }
        return null;
    }
    function GetChargingStation(Id) {
        for (var _i = 0, chargingStations_1 = chargingStations; _i < chargingStations_1.length; _i++) {
            var chargingStation = chargingStations_1[_i];
            if (chargingStation["@id"] == Id)
                return chargingStation;
        }
        return null;
    }
    function GetEVSE(Id) {
        for (var _i = 0, EVSEs_1 = EVSEs; _i < EVSEs_1.length; _i++) {
            var evse = EVSEs_1[_i];
            if (evse["@id"] == Id)
                return evse;
        }
        return null;
    }
    function GetMeter(Id) {
        for (var _i = 0, meters_1 = meters; _i < meters_1.length; _i++) {
            var meter = meters_1[_i];
            if (meter["@id"] == Id)
                return meter;
        }
        return null;
    }
    function detectCTRFormat(CTR) {
        inputInfosDiv.style.display = 'none';
        errorTextDiv.style.display = 'none';
        switch (CTR["@context"]) {
            case "https://open.charging.cloud/contexts/CTR+json":
                processOpenChargingCloudFormat(CTR);
                break;
            default:
                doError("Unbekanntes Transparenzdatensatzformat!");
                break;
        }
    }
    function ShowMeasurementDetails(measurement) {
    }
    function ShowChargingSessionDetails(chargingSession) {
        try {
            evseTarifInfosDiv.innerHTML = "";
            if (chargingSession.measurements) {
                for (var _i = 0, _a = chargingSession.measurements; _i < _a.length; _i++) {
                    var measurement = _a[_i];
                    var MeasurementInfoDiv = evseTarifInfosDiv.appendChild(document.createElement('div'));
                    MeasurementInfoDiv.className = "measurementInfo";
                    var MeterDiv = MeasurementInfoDiv.appendChild(document.createElement('div'));
                    MeterDiv.className = "meter";
                    var MeterIdDiv = MeterDiv.appendChild(document.createElement('div'));
                    MeterIdDiv.className = "meterId";
                    MeterIdDiv.innerHTML = "Zähler";
                    var MeterIdValueDiv = MeterDiv.appendChild(document.createElement('div'));
                    MeterIdValueDiv.className = "meterIdValue";
                    MeterIdValueDiv.innerHTML = measurement.energyMeterId;
                    var meter = GetMeter(measurement.energyMeterId);
                    if (meter != null) {
                        var MeterTypeDiv = MeasurementInfoDiv.appendChild(document.createElement('div'));
                        MeterTypeDiv.className = "meterType";
                        var MeterTypeIdDiv = MeterTypeDiv.appendChild(document.createElement('div'));
                        MeterTypeIdDiv.className = "meterTypeId";
                        MeterTypeIdDiv.innerHTML = "Zählertyp";
                        var MeterTypeValueDiv = MeterTypeDiv.appendChild(document.createElement('div'));
                        MeterTypeValueDiv.className = "meterTypeIdValue";
                        MeterTypeValueDiv.innerHTML = meter.manufacturer + " " + meter.type;
                    }
                    var MeasurementDiv = MeasurementInfoDiv.appendChild(document.createElement('div'));
                    MeasurementDiv.className = "measurement";
                    var MeasurementIdDiv = MeasurementDiv.appendChild(document.createElement('div'));
                    MeasurementIdDiv.className = "measurementId";
                    MeasurementIdDiv.innerHTML = "Messung";
                    var MeasurementIdValueDiv = MeasurementDiv.appendChild(document.createElement('div'));
                    MeasurementIdValueDiv.className = "measurementIdValue";
                    MeasurementIdValueDiv.innerHTML = measurement.name + " (OBIS: " + measurement.obis + ")";
                    var MeasurementValuesDiv = evseTarifInfosDiv.appendChild(document.createElement('div'));
                    MeasurementValuesDiv.className = "measurementValues";
                    //<i class="far fa-chart-bar"></i>
                    if (measurement.values && measurement.values.length > 0) {
                        for (var _b = 0, _c = measurement.values; _b < _c.length; _b++) {
                            var value = _c[_b];
                            var MeasurementValueDiv = MeasurementValuesDiv.appendChild(document.createElement('div'));
                            MeasurementValueDiv.className = "measurementValue";
                            var timestamp = parseUTC(value.timestamp);
                            var timestampDiv = MeasurementValueDiv.appendChild(document.createElement('div'));
                            timestampDiv.className = "timestamp";
                            timestampDiv.innerHTML = timestamp.format('HH:mm:ss');
                            var _value = parseInt(value.value);
                            switch (measurement.unit) {
                                case "KILO_WATT_HOURS":
                                    break;
                                // "WATT_HOURS"
                                default:
                                    _value = _value / 1000;
                                    break;
                            }
                            var valueDiv = MeasurementValueDiv.appendChild(document.createElement('div'));
                            valueDiv.className = "value";
                            valueDiv.innerHTML = _value.toString();
                            var unitDiv = MeasurementValueDiv.appendChild(document.createElement('div'));
                            unitDiv.className = "unit";
                            unitDiv.innerHTML = "kWh";
                            var verificationStatusDiv = MeasurementValueDiv.appendChild(document.createElement('div'));
                            verificationStatusDiv.className = "verificationStatus";
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Ungültiger Messwert';
                        }
                    }
                }
            }
        }
        catch (exception) { }
    }
    function captureChargingSession(cs) {
        return function (ev) {
            ShowChargingSessionDetails(cs);
        };
    }
    function processOpenChargingCloudFormat(CTR) {
        chargingStationOperators = [];
        chargingPools = [];
        chargingStations = [];
        EVSEs = [];
        meters = [];
        eMobilityProviders = [];
        mediationServices = [];
        chargingSessions = [];
        //#region Prepare View
        chargingSessionReportDiv.style.display = "flex";
        chargingSessionReportDiv.innerText = "";
        resetButtonDiv.style.display = "block";
        //#endregion
        //#region Show CTR infos
        if (CTR.description) {
            var descriptionDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
            descriptionDiv.id = "description";
            descriptionDiv.innerText = firstValue(CTR.description);
        }
        if (CTR.begin) {
            var beginDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
            beginDiv.id = "begin";
            beginDiv.className = "defi";
            beginDiv.innerHTML = parseUTC(CTR.begin).format('dddd, D. MMMM YYYY');
        }
        if (CTR.end) {
            var endDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
            endDiv.id = "begin";
            endDiv.className = "defi";
            endDiv.innerHTML = parseUTC(CTR.end).format('dddd, D. MMMM YYYY');
        }
        //#endregion
        //#region Show contract infos
        if (CTR.contract) {
        }
        //#endregion
        //#region Process CSOs, pools, stations, ...
        if (CTR.chargingStationOperators) {
            for (var _i = 0, _a = CTR.chargingStationOperators; _i < _a.length; _i++) {
                var chargingStationOperator = _a[_i];
                chargingStationOperators.push(chargingStationOperator);
                if (chargingStationOperator.chargingPools) {
                    for (var _b = 0, _c = chargingStationOperator.chargingPools; _b < _c.length; _b++) {
                        var chargingPool = _c[_b];
                        chargingPools.push(chargingPool);
                        if (chargingPool.chargingStations) {
                            for (var _d = 0, _e = chargingPool.chargingStations; _d < _e.length; _d++) {
                                var chargingStation = _e[_d];
                                chargingStations.push(chargingStation);
                                if (chargingStation.EVSEs) {
                                    for (var _f = 0, _g = chargingStation.EVSEs; _f < _g.length; _f++) {
                                        var EVSE = _g[_f];
                                        EVSE.chargingStation = chargingStation;
                                        EVSE.chargingStationId = chargingStation["@id"];
                                        EVSEs.push(EVSE);
                                    }
                                }
                            }
                        }
                    }
                }
                if (chargingStationOperator.chargingStations) {
                    for (var _h = 0, _j = chargingStationOperator.chargingStations; _h < _j.length; _h++) {
                        var chargingStation = _j[_h];
                        chargingStations.push(chargingStation);
                        if (chargingStation.EVSEs) {
                            for (var _k = 0, _l = chargingStation.EVSEs; _k < _l.length; _k++) {
                                var EVSE = _l[_k];
                                EVSEs.push(EVSE);
                            }
                        }
                    }
                }
                if (chargingStationOperator.EVSEs) {
                    for (var _m = 0, _o = chargingStationOperator.EVSEs; _m < _o.length; _m++) {
                        var EVSE = _o[_m];
                        EVSEs.push(EVSE);
                    }
                }
            }
        }
        if (CTR.chargingPools) {
            for (var _p = 0, _q = CTR.chargingPools; _p < _q.length; _p++) {
                var chargingPool = _q[_p];
                chargingPools.push(chargingPool);
                if (chargingPool.chargingStations) {
                    for (var _r = 0, _s = chargingPool.chargingStations; _r < _s.length; _r++) {
                        var chargingStation = _s[_r];
                        chargingStations.push(chargingStation);
                        if (chargingStation.EVSEs) {
                            for (var _t = 0, _u = chargingStation.EVSEs; _t < _u.length; _t++) {
                                var EVSE = _u[_t];
                                EVSE.chargingStation = chargingStation;
                                EVSE.chargingStationId = chargingStation["@id"];
                                EVSEs.push(EVSE);
                            }
                        }
                    }
                }
            }
        }
        if (CTR.chargingStations) {
            for (var _v = 0, _w = CTR.chargingStations; _v < _w.length; _v++) {
                var chargingStation = _w[_v];
                chargingStations.push(chargingStation);
                if (chargingStation.EVSEs) {
                    for (var _x = 0, _y = chargingStation.EVSEs; _x < _y.length; _x++) {
                        var EVSE = _y[_x];
                        EVSE.chargingStation = chargingStation;
                        EVSE.chargingStationId = chargingStation["@id"];
                        EVSEs.push(EVSE);
                        if (EVSE.meters) {
                            for (var _z = 0, _0 = EVSE.meters; _z < _0.length; _z++) {
                                var meter = _0[_z];
                                meter.EVSE = EVSE;
                                meter.EVSEId = EVSE["@id"];
                                meter.chargingStation = chargingStation;
                                meter.chargingStationId = chargingStation["@id"];
                                meters.push(meter);
                            }
                        }
                    }
                }
                if (chargingStation.meters) {
                    for (var _1 = 0, _2 = chargingStation.meters; _1 < _2.length; _1++) {
                        var meter = _2[_1];
                        meter.chargingStation = chargingStation;
                        meter.chargingStationId = chargingStation["@id"];
                        meters.push(meter);
                    }
                }
            }
        }
        //#endregion
        //#region Process charging sessions...
        if (CTR.chargingSessions) {
            var chargingSessionsDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
            chargingSessionsDiv.id = "chargingSessions";
            for (var _3 = 0, _4 = CTR.chargingSessions; _3 < _4.length; _3++) {
                var chargingSession = _4[_3];
                var chargingSessionDiv = chargingSessionsDiv.appendChild(document.createElement('div'));
                chargingSessionDiv.className = "chargingSessions";
                // Will capture the correct charging session!
                chargingSessionDiv.onclick = captureChargingSession(chargingSession);
                //#region Show session time
                if (chargingSession.begin) {
                    var beginUTC = parseUTC(chargingSession.begin);
                    var dateDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                    dateDiv.className = "date";
                    dateDiv.innerHTML = beginUTC.format('dddd, D; MMM YYYY HH:mm:ss').
                        replace(".", ""). // Nov. -> Nov
                        replace(";", "."); // 14;  -> 14.
                    if (chargingSession.end) {
                        var endUTC = parseUTC(chargingSession.end);
                        var duration = moment.duration(endUTC - beginUTC);
                        dateDiv.innerHTML += " - " +
                            (Math.floor(duration.asDays()) > 0 ? endUTC.format("dddd") + " " : "") +
                            endUTC.format('HH:mm:ss');
                    }
                }
                //#endregion
                //#region Show energy infos
                var tableDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                tableDiv.className = "table";
                try {
                    var productInfoDiv = tableDiv.appendChild(document.createElement('div'));
                    productInfoDiv.className = "productInfos";
                    var productIconDiv = productInfoDiv.appendChild(document.createElement('div'));
                    productIconDiv.className = "productIcon";
                    productIconDiv.innerHTML = '<i class="fas fa-chart-pie"></i>';
                    var productDiv = productInfoDiv.appendChild(document.createElement('div'));
                    productDiv.innerHTML = "Green Power" + "<br />";
                    if (Math.floor(duration.asDays()) > 1)
                        productDiv.innerHTML += duration.days() + " Tage " + duration.hours() + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                    else if (Math.floor(duration.asDays()) > 0)
                        productDiv.innerHTML += duration.days() + " Tag " + duration.hours() + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                    else if (Math.floor(duration.asHours()) > 0)
                        productDiv.innerHTML += duration.hours() + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                    else if (Math.floor(duration.asMinutes()) > 0)
                        productDiv.innerHTML += duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                    else if (Math.floor(duration.asSeconds()) > 0)
                        productDiv.innerHTML += duration.seconds();
                    if (chargingSession.measurements) {
                        for (var _5 = 0, _6 = chargingSession.measurements; _5 < _6.length; _5++) {
                            var measurement = _6[_5];
                            //<i class="far fa-chart-bar"></i>
                            if (measurement.values && measurement.values.length > 0) {
                                var first = parseInt(measurement.values[0].value);
                                var last = parseInt(measurement.values[measurement.values.length - 1].value);
                                var amount = last - first;
                                switch (measurement.unit) {
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
                catch (Exception) { }
                //#endregion
                //#region Show location infos...
                try {
                    var address = null;
                    var locationInfoDiv = tableDiv.appendChild(document.createElement('div'));
                    locationInfoDiv.className = "locationInfos";
                    var locationIconDiv = locationInfoDiv.appendChild(document.createElement('div'));
                    locationIconDiv.className = "locationIcon";
                    locationIconDiv.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
                    var locationDiv = locationInfoDiv.appendChild(document.createElement('div'));
                    if (chargingSession.EVSEId || chargingSession.EVSE) {
                        if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                            chargingSession.EVSE = GetEVSE(chargingSession.EVSEId);
                        locationDiv.className = "EVSE";
                        locationDiv.innerHTML = (chargingSession.EVSE != null && chargingSession.EVSE.description != null
                            ? firstValue(chargingSession.EVSE.description) + "<br />"
                            : "") +
                            (chargingSession.EVSEId != null
                                ? chargingSession.EVSEId
                                : chargingSession.EVSE["@id"]);
                        chargingSession.chargingStation = chargingSession.EVSE.chargingStation;
                        chargingSession.chargingStationId = chargingSession.EVSE.chargingStationId;
                        chargingSession.chargingPool = chargingSession.EVSE.chargingStation.chargingPool;
                        chargingSession.chargingPoolId = chargingSession.EVSE.chargingStation.chargingPoolId;
                        address = chargingSession.EVSE.chargingStation.address;
                    }
                    else if (chargingSession.chargingStationId || chargingSession.chargingStation) {
                        if (chargingSession.chargingStation == null || typeof chargingSession.chargingStation !== 'object')
                            chargingSession.chargingStation = GetChargingStation(chargingSession.chargingStationId);
                        locationDiv.className = "chargingStation";
                        locationDiv.innerHTML = (chargingSession.chargingStation != null && chargingSession.chargingStation.description != null
                            ? firstValue(chargingSession.chargingStation.description) + "<br />"
                            : "") +
                            (chargingSession.chargingStationId != null
                                ? chargingSession.chargingStationId
                                : chargingSession.chargingStation["@id"]);
                        chargingSession.chargingPool = chargingSession.chargingStation.chargingPool;
                        chargingSession.chargingPoolId = chargingSession.chargingStation.chargingPoolId;
                        address = chargingSession.chargingStation.address;
                    }
                    else if (chargingSession.chargingPoolId || chargingSession.chargingPool) {
                        if (chargingSession.chargingPool == null || typeof chargingSession.chargingPool !== 'object')
                            chargingSession.chargingPool = GetChargingPool(chargingSession.chargingPoolId);
                        locationDiv.className = "chargingPool";
                        locationDiv.innerHTML = (chargingSession.chargingPool != null && chargingSession.chargingPool.description != null
                            ? firstValue(chargingSession.chargingPool.description) + "<br />"
                            : "") +
                            (chargingSession.chargingPoolId != null
                                ? chargingSession.chargingPoolId
                                : chargingSession.chargingPool["@id"]);
                        address = GetChargingPool(chargingSession.chargingPool["@id"]).address;
                    }
                    locationDiv.innerHTML += address != null
                        ? "<br />" +
                            (address.street != null ? " " + address.street : "") +
                            (address.houseNumber != null ? " " + address.houseNumber : "") +
                            (address.postalCode != null || address.city != null ? "," : "") +
                            (address.postalCode != null ? " " + address.postalCode : "") +
                            (address.city != null ? " " + address.city : "")
                        : "";
                }
                catch (exception) {
                    console.log("Could not show location infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }
                //#endregion
                //#region Verification Status
                var verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                verificationStatusDiv.className = "verificationStatus";
                verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Ungültig';
                //#endregion
            }
        }
        //#endregion
        //resultsDiv.innerHTML = VerificationResult[result].toString();
    }
    function doError(text) {
        inputInfosDiv.style.display = 'flex';
        errorTextDiv.style.display = 'inline-block';
        errorTextDiv.innerHTML = '<i class="fas fa-times-circle"></i> ' + text;
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
        reader.onload = function (e) {
            try {
                detectCTRFormat(JSON.parse(e.target.result));
            }
            catch (e) {
                doError("Fehlerhafter Transparenzdatensatz!");
            }
        };
        reader.readAsText(file);
    }
    //#endregion
    //#region Process pasted CTR file
    function PasteFile(ev) {
        navigator.clipboard.readText().then(function (clipText) {
            try {
                detectCTRFormat(JSON.parse(clipText));
            }
            catch (e) {
                doError("Fehlerhafter Transparenzdatensatz!");
            }
        });
    }
    //#endregion
    var input = document.getElementById('input');
    input.addEventListener('dragenter', handleDragEnter, false);
    input.addEventListener('dragover', handleDragOver, false);
    input.addEventListener('dragleave', handleDragLeave, false);
    input.addEventListener('drop', handleDroppedFile, false);
    var inputInfosDiv = document.getElementById('inputInfos');
    var loadingErrorsDiv = document.getElementById('loadingErrors');
    var errorTextDiv = document.getElementById('errorText');
    var fileInputButton = document.getElementById('fileInputButton');
    var fileInput = document.getElementById('fileInput');
    fileInputButton.onclick = function (ev) { fileInput.click(); };
    fileInput.onchange = readFileFromDisk;
    var pasteButton = document.getElementById('pasteButton');
    pasteButton.onclick = PasteFile;
    var chargingSessionReportDiv = document.getElementById('chargingSessionReport');
    var resetButtonDiv = document.getElementById('resetButtonDiv');
    resetButtonDiv.onclick = function (ev) {
        inputInfosDiv.style.display = 'flex';
        chargingSessionReportDiv.style.display = "none";
        resetButtonDiv.style.display = "none";
        fileInput.value = "";
    };
    var rightbar = document.getElementById('rightbar');
    var evseTarifInfosDiv = document.getElementById('evseTarifInfos');
    var resultsDiv = document.getElementById('results');
}
