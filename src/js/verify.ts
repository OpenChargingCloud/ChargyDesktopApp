///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />


var chargingStationOperators  = new Array<IChargingStationOperator>();
var chargingPools             = new Array<IChargingPool>();
var chargingStations          = new Array<IChargingStation>();
var EVSEs                     = new Array<IEVSE>();
var eMobilityProviders        = new Array<IEMobilityProvider>();
var mediationServices         = new Array<IMediationService>();
var chargingSessions          = new Array<IChargingSession>();

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

    function verify1(text, signature, pubkey) : VerificationResult
    {

        var sha256hash = sha256_(text);

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

        var buffer = new ArrayBuffer(320);
        var view   = new DataView(buffer);
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
                             ec.keyFromPublic("04" + meterValue.meterInfo.publicKey, 'hex'));

        console.log(VerificationResult[result]);

        return result;

    }

    this.verifyMeterValue = (meterValue) => {
        verifyMeterValue(meterValue);
    }


    function verifyMeterValues(meterValues): VerificationResult
    {

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
                                 ec.keyFromPublic("04" + meterValues.meterInfo.publicKey, 'hex'));

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


    function detectCTRFormat(CTR: ICTR) {

        inputInfosDiv.style.display  = 'none';
        errorTextDiv.style.display   = 'none';

        switch (CTR["@context"])
        {

            case "https://open.charging.cloud/contexts/CTR+json":
                processOpenChargingCloudFormat(CTR);
                break;

            default:
                doError("Unbekanntes Transparenzdatensatzformat!");
                break;

        }

    }

    function processOpenChargingCloudFormat(CTR: ICTR)
    {

        chargingStationOperators  = [];
        chargingPools             = [];
        chargingStations          = [];
        EVSEs                     = [];
        eMobilityProviders        = [];
        mediationServices         = [];
        chargingSessions          = [];

        //#region Prepare View

        chargingSessionReportDiv.style.display = "flex";
        chargingSessionReportDiv.innerText = "";
        resetButtonDiv.style.display = "block";

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

                    }

                }

            }

        }



        if (CTR.chargingSessions) {

            let chargingSessionsDiv = chargingSessionReportDiv.appendChild(document.createElement('div'));
            chargingSessionsDiv.id  = "chargingSessions";

            for (var chargingSession of CTR.chargingSessions)
            {

                let chargingSessionDiv = chargingSessionsDiv.appendChild(document.createElement('div'));
                chargingSessionDiv.className = "chargingSessions";

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

                                var first = parseInt(measurement.values[0].value);
                                var last  = parseInt(measurement.values[measurement.values.length-1].value);

                                //let MeasurementDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                                //MeasurementDiv.id          = "MeasurementOverview";
                                //MeasurementDiv.innerHTML   =

                                productDiv.innerHTML += "<br />" + ((last - first)/1000).toString() + " kWh " + measurement.name + " (" + measurement.values.length + " Messwerte)";

                                for (var value of measurement.values)
                                {



                                }

                            }

                        }
                    }

                }
                catch (Exception)
                { }


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

                //#endregion

                


                //#regin Verification Status

                let verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                verificationStatusDiv.className = "verificationStatus";
                verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Ungültig';

                //#endregion

            }

        }


        //resultsDiv.innerHTML = VerificationResult[result].toString();

    }

    function doError(text: String)
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
                detectCTRFormat(JSON.parse((e.target as any).result));
            }
            catch (e) {
                doError("Fehlerhafter Transparenzdatensatz!");
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
                detectCTRFormat(JSON.parse(clipText));
            }
            catch (e) {
                doError("Fehlerhafter Transparenzdatensatz!");
            }

        });

    }

    //#endregion


    var input                     = <HTMLDivElement> document.getElementById('input');
    input.addEventListener('dragenter', handleDragEnter,   false);
    input.addEventListener('dragover',  handleDragOver,    false);
    input.addEventListener('dragleave', handleDragLeave,   false);
    input.addEventListener('drop',      handleDroppedFile, false);

    var inputInfosDiv             = <HTMLDivElement>      document.getElementById('inputInfos');
    var loadingErrorsDiv          = <HTMLDivElement>      document.getElementById('loadingErrors');
    var errorTextDiv              = <HTMLDivElement>      document.getElementById('errorText');

    var fileInputButton           = <HTMLButtonElement>   document.getElementById('fileInputButton');
    var fileInput                 = <HTMLInputElement>    document.getElementById('fileInput');
    fileInputButton.onclick = function (this: HTMLElement, ev: MouseEvent) { fileInput.click(); }
    fileInput.onchange            = readFileFromDisk;

    var pasteButton               = <HTMLButtonElement>   document.getElementById('pasteButton');
    pasteButton.onclick           = PasteFile;

    var chargingSessionReportDiv  = <HTMLDivElement>      document.getElementById('chargingSessionReport');
    var resetButtonDiv            = <HTMLDivElement>      document.getElementById('resetButtonDiv');
    resetButtonDiv.onclick = function (this: HTMLElement, ev: MouseEvent) {
        inputInfosDiv.style.display             = 'flex';
        chargingSessionReportDiv.style.display  = "none";
        resetButtonDiv.style.display            = "none";
        fileInput.value                         = "";
    }

    var rightbar                  = <HTMLDivElement>      document.getElementById('rightbar');
    var resultsDiv                = <HTMLDivElement>      document.getElementById('results');
    
    
}
