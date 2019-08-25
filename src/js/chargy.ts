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
///<reference path="GDFCrypt01.ts" />
///<reference path="EMHCrypt01.ts" />

///<reference path="OCMFTypes.ts" />

// import { debug } from "util";
// import * as crypto from "crypto";
// import { readSync } from "fs";
// import { version } from "punycode";

var map:     any        = "";
var leaflet: any        = "";

function OpenLink(url: string)
{
    if (url.startsWith("https://"))
        require('electron').shell.openExternal(url);
}

class ChargyApplication {

    private elliptic: any;
    private moment:   any;

    // variable 'crypto' is already defined differently in Google Chrome!
    private crypt       = require('electron').remote.require('crypto');
    public  appVersion  = require('electron').remote.app.getVersion().split('.') as string[];
    private ipcRenderer = require('electron').ipcRenderer;
    private path        = require('path');

    private exe_hash                  = "";
    private app_asar_hash             = "";
    private electron_asar_hash        = "";
    private complete_hash             = "";

    private chargingStationOperators  = new Array<IChargingStationOperator>();
    private chargingPools             = new Array<IChargingPool>();
    private chargingStations          = new Array<IChargingStation>();
    private EVSEs                     = new Array<IEVSE>();
    private meters                    = new Array<IMeter>();
    private eMobilityProviders        = new Array<IEMobilityProvider>();
    private mediationServices         = new Array<IMediationService>();
    private chargingSessions          = new Array<IChargingSession>();

    private input:                      HTMLDivElement;
    private updateAvailableButton:      HTMLButtonElement;
    private aboutButton:                HTMLButtonElement;
    private fullScreenButton:           HTMLButtonElement;

    private updateAvailableScreen:      HTMLDivElement;
    private inputInfosDiv:              HTMLDivElement;
    private aboutScreenDiv:             HTMLDivElement;
    private chargySHA512Div:            HTMLDivElement;
    private chargingSessionScreenDiv:   HTMLDivElement;
    private backButtonDiv:              HTMLDivElement;
    private fileInputButton:            HTMLButtonElement;
    private fileInput:                  HTMLInputElement;
    private evseTarifInfosDiv:          HTMLDivElement;
    private errorTextDiv:               HTMLDivElement;
    private overlayDiv:                 HTMLDivElement;
    private overlayOkButton:            HTMLButtonElement;

    private currentCTR  = {} as IChargeTransparencyRecord;
    private markers:             any          = [];
    private minlat:              number       = +1000;
    private maxlat:              number       = -1000;
    private minlng:              number       = +1000;
    private maxlng:              number       = -1000;

    private currentAppInfos:     any          = null;
    private currentVersionInfos: any          = null;
    private currentPackage:      any          = null;

    constructor() {

        this.elliptic                  = require('elliptic');
        this.moment                    = require('moment');


        //#region Calculate application hash

        switch (process.platform)
        {

            case "win32":
                this.calcSHA512Hash('Chargy Transparenzsoftware.exe',             hash => this.exe_hash           = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512Hash(this.path.join('resources', 'app.asar'),      hash => this.app_asar_hash      = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512Hash(this.path.join('resources', 'electron.asar'), hash => this.electron_asar_hash = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                break;

            case "linux":
            case "freebsd":
            case "openbsd":
                this.calcSHA512Hash('/opt/Chargy\ Transparenzsoftware/chargytransparenzsoftware', hash => this.exe_hash           = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512Hash('/opt/Chargy\ Transparenzsoftware/resources/app.asar',        hash => this.app_asar_hash      = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512Hash('/opt/Chargy\ Transparenzsoftware/resources/electron.asar',   hash => this.electron_asar_hash = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                break;

            case "darwin":
                this.calcSHA512Hash('/Applications/Chargy\ Transparenzsoftware.app/Contents/MacOS/Chargy Transparenzsoftware', hash => this.exe_hash           = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512Hash('/Applications/Chargy\ Transparenzsoftware.app/Contents/Resources/app.asar',               hash => this.app_asar_hash      = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512Hash('/Applications/Chargy\ Transparenzsoftware.app/Contents/Resources/electron.asar',          hash => this.electron_asar_hash = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                break;

            default:
                document.getElementById('chargySHA512')!.children[1].innerHTML = "Kann nicht berechnet werden!"
                break;

        }

        //#endregion

        //#region Get list of Chargy versions from GitHub

        let GetListOfVersionsFromGitHub = new XMLHttpRequest();
        GetListOfVersionsFromGitHub.open("GET",
                                         "https://raw.githubusercontent.com/OpenChargingCloud/ChargyDesktopApp/master/versions/versions.json",
                                         true);

        GetListOfVersionsFromGitHub.onreadystatechange = () => {

            // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
            if (GetListOfVersionsFromGitHub.readyState == 4) {
                if (GetListOfVersionsFromGitHub.status == 200) { // HTTP 200 - OK

                    try {

                        var versionsDiv = this.updateAvailableScreen.querySelector("#versions") as HTMLDivElement;
                        if (versionsDiv != null)
                        {

                            this.currentAppInfos = JSON.parse(GetListOfVersionsFromGitHub.responseText) as IVersions;

                            for (let version of this.currentAppInfos.versions)
                            {

                                var versionElements = version.version.split('.');

                                //#region Find current version package

                                if (versionElements[0] == this.appVersion[0] && versionElements[1] == this.appVersion[1] && versionElements[2] == this.appVersion[2])
                                {

                                    this.currentVersionInfos = version;

                                    if (this.currentVersionInfos.packages && this.currentVersionInfos.packages.length > 0)
                                    {
                                        for (let _package of this.currentVersionInfos.packages)
                                        {
                                            if (_package.isInstaller == null &&
                                                (_package.platform === process.platform ||
                                                (_package.platforms != null && Array.isArray(_package.platforms) && _package.platforms.indexOf(process.platform) > -1)))
                                            {
                                                this.currentPackage = _package;
                                            }
                                        }
                                    }

                                }

                                //#endregion

                                //#region Find newer/updated version

                                else if (versionElements[0] >  this.appVersion[0] ||
                                        (versionElements[0] >= this.appVersion[0] && versionElements[1] >  this.appVersion[1]) ||
                                        (versionElements[0] >= this.appVersion[0] && versionElements[1] >= this.appVersion[1] && versionElements[2] > this.appVersion[2]))
                                {

                                    this.updateAvailableButton.style.display = "block";

                                    let versionDiv = versionsDiv.appendChild(document.createElement('div'));
                                    versionDiv.className = "version";

                                    let headlineDiv = versionDiv.appendChild(document.createElement('div'));
                                    headlineDiv.className = "headline";

                                    let versionnumberDiv = headlineDiv.appendChild(document.createElement('div'));
                                    versionnumberDiv.className = "versionnumber";
                                    versionnumberDiv.innerHTML = "Version " + version.version;

                                    let releaseDateDiv = headlineDiv.appendChild(document.createElement('div'));
                                    releaseDateDiv.className = "releaseDate";
                                    releaseDateDiv.innerHTML = parseUTC(version.releaseDate).format("ll");

                                    let descriptionDiv = versionDiv.appendChild(document.createElement('div'));
                                    descriptionDiv.className = "description";
                                    descriptionDiv.innerHTML = version.description["de"];

                                    let tagsDiv = versionDiv.appendChild(document.createElement('div'));
                                    tagsDiv.className = "tags";

                                    for (let tag of version.tags)
                                    {
                                        let tagDiv = tagsDiv.appendChild(document.createElement('div'));
                                        tagDiv.className = "tag";
                                        tagDiv.innerHTML = tag;
                                    }

                                    let packagesDiv = versionDiv.appendChild(document.createElement('div'));
                                    packagesDiv.className = "packages";

                                    for (let versionpackage of version.packages)
                                    {

                                        let packageDiv = packagesDiv.appendChild(document.createElement('div'));
                                        packageDiv.className = "package";

                                        let nameDiv = packageDiv.appendChild(document.createElement('div'));
                                        nameDiv.className = "name";
                                        nameDiv.innerHTML = versionpackage.name;

                                        if (versionpackage.description &&
                                            versionpackage.description["de"])
                                        {
                                            let descriptionDiv = packageDiv.appendChild(document.createElement('div'));
                                            descriptionDiv.className = "description";
                                            descriptionDiv.innerHTML = versionpackage.description["de"];
                                        }

                                        if (versionpackage.additionalInfo &&
                                            versionpackage.additionalInfo["de"])
                                        {
                                            let additionalInfoDiv = packageDiv.appendChild(document.createElement('div'));
                                            additionalInfoDiv.className = "additionalInfo";
                                            additionalInfoDiv.innerHTML = versionpackage.additionalInfo["de"];
                                        }


                                        let cryptoHashesDiv = packageDiv.appendChild(document.createElement('div'));
                                        cryptoHashesDiv.className = "cryptoHashes";

                                        for (let cryptoHash in versionpackage.cryptoHashes)
                                        {

                                            let cryptoHashDiv = cryptoHashesDiv.appendChild(document.createElement('div'));
                                            cryptoHashDiv.className = "cryptoHash";

                                            let cryptoHashNameDiv = cryptoHashDiv.appendChild(document.createElement('div'));
                                            cryptoHashNameDiv.className = "name";
                                            cryptoHashNameDiv.innerHTML = cryptoHash;

                                            let value = versionpackage.cryptoHashes[cryptoHash].replace(/\s+/g, '');

                                            if (value.startsWith("0x"))
                                                value = value.substring(2);

                                            let cryptoHashValueDiv = cryptoHashDiv.appendChild(document.createElement('div'));
                                            cryptoHashValueDiv.className = "value";
                                            cryptoHashValueDiv.innerHTML = value.match(/.{1,8}/g).join(" ");

                                        }


                                        let signaturesTextDiv = packageDiv.appendChild(document.createElement('div'));
                                        signaturesTextDiv.className = "signaturesText";
                                        signaturesTextDiv.innerHTML = "Die Authentizität diese Software wurde durch folgende digitale Signaturen bestätigt";

                                        let signaturesDiv = packageDiv.appendChild(document.createElement('div'));
                                        signaturesDiv.className = "signatures";

                                        for (let signature of versionpackage.signatures)
                                        {

                                            let signatureDiv = signaturesDiv.appendChild(document.createElement('div'));
                                            signatureDiv.className = "signature";

                                            let signatureCheckDiv = signatureDiv.appendChild(document.createElement('div'));
                                            signatureCheckDiv.className = "signatureCheck";
                                            signatureCheckDiv.innerHTML = "<i class=\"fas fa-question-circle fa-question-circle-orange\"></i>";

                                            let authorDiv = signatureDiv.appendChild(document.createElement('div'));
                                            authorDiv.className = "signer";
                                            authorDiv.innerHTML = signature.signer;

                                        }


                                        if (versionpackage.downloadURLs)
                                        {

                                            let downloadURLsTextDiv = packageDiv.appendChild(document.createElement('div'));
                                            downloadURLsTextDiv.className = "downloadURLsText";
                                            downloadURLsTextDiv.innerHTML = "Diese Software kann über folgende Weblinks runtergeladen werden";

                                            let downloadURLsDiv = packageDiv.appendChild(document.createElement('div'));
                                            downloadURLsDiv.className = "downloadURLs";

                                            for (let downloadURLName in versionpackage.downloadURLs)
                                            {
                                                let downloadURLDiv = downloadURLsDiv.appendChild(document.createElement('div'));
                                                downloadURLDiv.className = "downloadURL";
                                                downloadURLDiv.innerHTML = "<a href=\"javascript:OpenLink('" + versionpackage.downloadURLs[downloadURLName] + "')\" title=\"" + versionpackage.downloadURLs[downloadURLName] + "\"><i class=\"fas fa-globe\"></i>" + downloadURLName + "</a>";
                                            }

                                        }

                                    }

                                }

                                //#endregion

                            }

                        }

                    }
                    catch (exception)
                    { 
                        // Just do nothing!
                    }

                }
            }

        }

        GetListOfVersionsFromGitHub.send();

        //#endregion


        this.updateAvailableScreen     = <HTMLDivElement> document.getElementById('updateAvailableScreen');
        this.aboutScreenDiv            = <HTMLDivElement> document.getElementById('aboutScreen');
        this.chargySHA512Div           = <HTMLDivElement> document.getElementById('chargySHA512');
        this.chargingSessionScreenDiv  = <HTMLDivElement> document.getElementById('chargingSessionScreen');
        this.evseTarifInfosDiv         = <HTMLDivElement> document.getElementById('evseTarifInfos');
        this.inputInfosDiv             = <HTMLDivElement> document.getElementById('inputInfos');
        this.errorTextDiv              = <HTMLDivElement> document.getElementById('errorText');


        //#region Handle Drag'n'Drop of charge transparency files

        this.input                     = <HTMLDivElement>      document.getElementById('input');

        this.input.addEventListener('dragenter', (event: DragEvent) => {
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)!.classList.add('over');
        }, false);

        this.input.addEventListener('dragover',  (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
            (event.currentTarget as HTMLDivElement)!.classList.add('over');
        }, false);

        this.input.addEventListener('dragleave', (event: DragEvent) => {
            (event.currentTarget as HTMLDivElement)!.classList.remove('over');
        }, false);

        this.input.addEventListener('drop',      (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)!.classList.remove('over');
            this.readAndParseFile(event.dataTransfer!.files[0]);
        }, false);

        //#endregion

        //#region Handle the 'Update available'-button

        this.updateAvailableButton     = <HTMLButtonElement>   document.getElementById('updateAvailableButton');
        this.updateAvailableButton.onclick = (ev: MouseEvent) => {
            this.updateAvailableScreen.style.display     = "block";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.backButtonDiv.style.display             = "block";
        }

        //#endregion

        //#region Handle the 'About'-button

        this.aboutButton               = <HTMLButtonElement>   document.getElementById('aboutButton');
        this.aboutButton.onclick = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "block";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.backButtonDiv.style.display             = "block";

            //#region Calculate the over-all application hash

            if (this.complete_hash      == "" &&
                this.exe_hash           != "" &&
                this.app_asar_hash      != "" &&
                this.electron_asar_hash != "")
            {

                var sha512hash = this.crypt.createHash('sha512');
                sha512hash.update(this.exe_hash);
                sha512hash.update(this.app_asar_hash);
                sha512hash.update(this.electron_asar_hash);

                this.complete_hash = this.chargySHA512Div.children[1].innerHTML = sha512hash.digest('hex').match(/.{1,8}/g).join(" ");

                //#region Check application hash signatures, when given...

                if (this.currentAppInfos     != null &&
                    this.currentVersionInfos != null &&
                    this.currentPackage      != null)
                {
    
                    let sigHeadDiv    = this.chargySHA512Div.children[2];
                    let signaturesDiv = this.chargySHA512Div.children[3];
    
                    // Bad hash value
                    if (this.currentPackage.cryptoHashes.SHA512.replace("0x", "") !== this.complete_hash)
                        sigHeadDiv.innerHTML = "<i class=\"fas fa-times-circle\"></i> Ungültiger Hashwert!";
    
                    // At least the same hash value...
                    else
                    {
    
                        if (this.currentPackage.signatures == null || this.currentPackage.signatures.length == 0)
                        {
                            sigHeadDiv.innerHTML = "<i class=\"fas fa-check-circle\"></i> Gültiger Hashwert";
                        }
    
                        // Some crypto signatures found...
                        else
                        {
    
                            sigHeadDiv.innerHTML = "Bestätigt durch...";
    
                            for (let signature of this.currentPackage.signatures)
                            {
                                let signatureDiv = signaturesDiv.appendChild(document.createElement('div'));
                                signatureDiv.innerHTML = this.CheckApplicationHashSignature(this.currentAppInfos,
                                                                                            this.currentVersionInfos,
                                                                                            this.currentPackage,
                                                                                            signature);
                            }
    
                        }
    
                    }
    
                }

                //#endregion

            }

            //#endregion

        }

        //#endregion

        //#region Handle the 'fullScreen'-button

        var d                         = document as any;
        this.fullScreenButton          = <HTMLButtonElement>   document.getElementById('fullScreenButton');
        this.fullScreenButton.onclick = (ev: MouseEvent) => {
            if (d.fullScreen || d.mozFullScreen || d.webkitIsFullScreen)
            {
                this.overlayDiv.classList.remove("fullScreen");
                closeFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
            else
            {
                this.overlayDiv.classList.add("fullScreen");
                openFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-compress"></i>';
            }
        }

        //#endregion

        //#region Handle the 'Overlay Ok'-button

        this.overlayDiv                = <HTMLDivElement>      document.getElementById('overlay');
        this.overlayOkButton           = <HTMLButtonElement>   document.getElementById('overlayOkButton');
        this.overlayOkButton.onclick = (ev: MouseEvent) => {
            this.overlayDiv.style.display = 'none';
        }

        //#endregion

        //#region Handle the 'fileInput'-button

        this.fileInputButton           = <HTMLButtonElement>   document.getElementById('fileInputButton');
        this.fileInput                 = <HTMLInputElement>    document.getElementById('fileInput');
        this.fileInputButton.onclick = (ev: MouseEvent) => {
            this.fileInput.value = '';
            this.fileInput.click();
        }
        //@ts-ignokjre
        this.fileInput.onchange            = (ev: Event) => {
            var files = ev!.target!["files"];
            if (files != null)
                this.readAndParseFile(files[0]);
        }

        //#endregion

        //#region Handle the 'paste'-button

        var pasteButton               = <HTMLButtonElement>   document.getElementById('pasteButton');
        pasteButton.onclick           = (ev: MouseEvent) => {
            (navigator as any).clipboard.readText().then((clipText: string) => {
                try
                {
                    this.detectContentFormat(clipText);
                }
                catch (exception) {
                    this.doGlobalError("Fehlerhafter Transparenzdatensatz!", exception);
                }
            });
        }

        //#endregion

        //#region The Issue tracker

        var issueTracker              = <HTMLDivElement>      document.getElementById('issueTracker');
        var showIssueTrackerButton    = <HTMLButtonElement>   document.getElementById('showIssueTracker');
        showIssueTrackerButton.onclick = function (this: GlobalEventHandlers, ev: MouseEvent) {
            issueTracker.style.display     = 'block';
            privacyStatement.style.display = "none";
            issueTrackerText.scrollTop = 0;
        }
        var newIssueForm              = <HTMLFormElement>     document.getElementById('newIssueForm');
        var issueTrackerText          = <HTMLDivElement>      document.getElementById('issueTrackerText');
        var privacyStatement          = <HTMLDivElement>      document.getElementById('privacyStatement');
        var showPrivacyStatement      = <HTMLButtonElement>   document.getElementById('showPrivacyStatement');
        showPrivacyStatement.onclick = function(this: GlobalEventHandlers, ev: MouseEvent) {
            ev.preventDefault();
            privacyStatement.style.display = "block";
            issueTrackerText.scrollTop = issueTrackerText.scrollHeight;
        }
        var privacyStatementAccepted  = <HTMLInputElement>    document.getElementById('privacyStatementAccepted');
        privacyStatementAccepted.onchange = function(this: GlobalEventHandlers, ev: Event) {
            sendIssueButton.disabled  = !privacyStatementAccepted.checked;
        }
        var sendIssueButton           = <HTMLButtonElement>   document.getElementById('sendIssueButton');
        sendIssueButton.onclick = (ev: MouseEvent) => { // function (this: GlobalEventHandlers, ev: MouseEvent) {

            ev.preventDefault();

            try
            {

                //#region Collect issue data...

                var data = {};

                data["timestamp"]                  = new Date().toISOString();
                data["chargyVersion"]              = this.appVersion.join(".");
                data["platform"]                   = process.platform;

                data["invalidCTR"]                 = (newIssueForm.querySelector("#invalidCTR")                as HTMLInputElement).checked;
                data["InvalidStationData"]         = (newIssueForm.querySelector("#InvalidStationData")        as HTMLInputElement).checked;
                data["invalidSignatures"]          = (newIssueForm.querySelector("#invalidSignatures")         as HTMLInputElement).checked;
                data["invalidCertificates"]        = (newIssueForm.querySelector("#invalidCertificates")       as HTMLInputElement).checked;
                data["transparencenySoftwareBug"]  = (newIssueForm.querySelector("#transparencenySoftwareBug") as HTMLInputElement).checked;
                data["DSGVO"]                      = (newIssueForm.querySelector("#DSGVO")                     as HTMLInputElement).checked;
                data["BITV"]                       = (newIssueForm.querySelector("#BITV")                      as HTMLInputElement).checked;

                data["description"]                = (newIssueForm.querySelector("#issueDescription")          as HTMLTextAreaElement).value;

                if ((newIssueForm.querySelector("#includeCTR") as HTMLSelectElement).value == "yes")
                    data["chargeTransparencyRecord"] = this.currentCTR;

                data["name"]                       = (newIssueForm.querySelector("#issueName")                 as HTMLInputElement).value;
                data["phone"]                      = (newIssueForm.querySelector("#issuePhone")                as HTMLInputElement).value;
                data["eMail"]                      = (newIssueForm.querySelector("#issueEMail")                as HTMLInputElement).value;

                //#endregion

                //#region Send issue to API

                let sendIssue = new XMLHttpRequest();

                sendIssue.open("ADD",
                            "https://chargeit.charging.cloud/chargy/issues",
                            true);
                sendIssue.setRequestHeader('Content-type', 'application/json');
            
                sendIssue.onreadystatechange = function () {
            
                    // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
                    if (this.readyState == 4) {

                        if (this.status == 201) { // HTTP 201 - Created
                            issueTracker.style.display     = 'none';
                            // Show thank you for your issue
                        }

                        else
                        {
                            alert("Leider ist ein Fehler bei der Datenübertragung aufgetreten. Bitte probieren Sie es erneut...");
                        }

                    }

                }

                sendIssue.send(JSON.stringify(data));

                //#endregion

            }
            catch (exception)
            { 
                // Just do nothing!
            }

        }
        var issueBackButton           = <HTMLButtonElement>   document.getElementById('issueBackButton');
        issueBackButton.onclick = function (this: GlobalEventHandlers, ev: MouseEvent) {
            issueTracker.style.display = 'none';
        }

        //#endregion

        //#region Handle the 'Back'-button

        this.backButtonDiv             = <HTMLDivElement>      document.getElementById('backButtonDiv');
        this.backButtonDiv.onclick = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.backButtonDiv.style.display             = "none";
            this.fileInput.value                         = "";
            this.evseTarifInfosDiv.innerHTML             = "";

            // Clear the map and reset zoom bounds...
            while(this.markers.length > 0)
                map.removeLayer(this.markers.pop());

            this.minlat = +1000;
            this.maxlat = -1000;
            this.minlng = +1000;
            this.maxlng = -1000;

        }

        //#endregion

        //#region Modify external links to be opened in the external web browser

        var shell        = require('electron').shell;
        let linkButtons  = document.getElementsByClassName('linkButton') as HTMLCollectionOf<HTMLButtonElement>;
        for (var i = 0; i < linkButtons.length; i++) {

            let linkButton = linkButtons[i];

            linkButton.onclick = function (this: GlobalEventHandlers, ev: MouseEvent) {
                ev.preventDefault();
                var link = linkButton.attributes["href"].nodeValue;
                if (link.startsWith("http://") || link.startsWith("https://")) {
                    shell.openExternal(link);
                }
            }

        }

        //#endregion

        //#region Handle 'Open this file with Chargy'-events...

        // Note: The following is synchronous, therefore must be at the end of the file...

        // Windows and Linux
        var cliArguments = require('electron').remote.process.argv;
        if (cliArguments.length >= 2)
            this.readFileFromDisk(cliArguments[1]);

        // Mac OS X - first file to open
        this.readFileFromDisk(this.ipcRenderer.sendSync('get-chargy-filename'));

        // Mac OS X - when app is running
        this.ipcRenderer.on('send-chargy-filename', (event:any, filename:string) => {
            this.readFileFromDisk(filename);
        });

        //#endregion

    }


    //#region calcSHA512Hash(...)

    private calcSHA512Hash(filename:  string,
                           OnSuccess: { (hash:         string): any; },
                           OnFailed:  { (errorMessage: string): any; })
    {

        const fs      = require('original-fs');
        let   sha512  = require('electron').remote.
                        require('crypto').createHash('sha512');
        let   stream  = fs.createReadStream(filename);

        stream.on('data', function(data: any) {
            sha512.update(data)
        })

        stream.on('error', function() {
            OnFailed("File not found!");
        })

        stream.on('end', function() {
            OnSuccess(sha512.digest('hex'));
        })

    }

    //#endregion

    //#region CheckApplicationHashSignature(...)

    private CheckApplicationHashSignature(app:        any,
                                          version:    any,
                                          _package:   any,
                                          signature:  any): string
    {

        if (app == null || version == null || _package == null || signature == null)
            return "<i class=\"fas fa-times-circle\"></i>Ungültige Signatur!";

        try {

            var toCheck = {
                "name":                 app.name,
                "description":          app.description,

                "version": {
                    "version":              this.appVersion.join("."),
                    "releaseDate":          version.releaseDate,
                    "description":          version.description,
                    "tags":                 version.tags,

                    "package": {
                        "name":                 _package.name,
                        "description":          _package.description,
                        "additionalInfo":       _package.additonalInfo,
                        "platform":             _package.platform,
                        "isInstaller":          _package.isInstaller, // Note: Might be null! Keep null values!
                        "cryptoHashValue":      this.complete_hash,

                        "signature": {
                            "signer":               signature.signer,
                            "timestamp":            signature.timestamp,
                            "comment":              signature.comment,
                            "algorithm":            signature.algorithm,
                            "format":               signature.format
                        }

                    }

                }

            };

            //ToDo: Checking the timestamp might be usefull!

            var Input       = JSON.stringify(toCheck);
            var sha256value = this.crypt.createHash('sha256').
                                        update(Input, 'utf8').
                                        digest('hex');

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

    //#region CheckMeterPublicKeySignature(...)

    private async CheckMeterPublicKeySignature(chargingStation:  any,
                                               evse:             any,
                                               meter:            any,
                                               publicKey:        any,
                                               signature:        any): Promise<string>
    {

        // For now: Do not enforce this feature!
        if (chargingStation == null || evse == null || meter == null || publicKey == null || signature == null)
            return "";// "<i class=\"fas fa-exclamation-circle\"></i> Unbekannter Public Key!";

        try {

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

            var Input       = JSON.stringify(toCheck);
            var sha256value = this.crypt.createHash('sha256').
                                        update(Input, 'utf8').
                                        digest('hex');

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


    //#region GetMethods...

    private GetChargingPool: GetChargingPoolFunc = (Id: string) => {

        for (var chargingPool of this.chargingPools)
        {
            if (chargingPool["@id"] === Id)
                return chargingPool;
        }

        return null;

    }

    private GetChargingStation: GetChargingStationFunc = (Id: string) => {

        for (var chargingStation of this.chargingStations)
        {
            if (chargingStation["@id"] === Id)
                return chargingStation;
        }

        return null;

    }

    private GetEVSE: GetEVSEFunc = (Id: string) => {

        for (var evse of this.EVSEs)
        {
            if (evse["@id"] === Id)
                return evse;
        }

        return null;

    }

    private GetMeter: GetMeterFunc = (Id: string) => {
    
        for (var meter of this.meters)
        {
            if (meter["@id"] === Id)
                return meter;
        }
    
        return null;
    
    }    

    //#endregion


    //#region detectContentFormat

    private async checkSessionCrypto(chargingSession: IChargingSession)
    {

        var result = await this.verifySessionCryptoDetails(chargingSession);

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
            this.markers.push(marker);

            if (this.minlat > geoLocation.lat)
                this.minlat = geoLocation.lat;

            if (this.maxlat < geoLocation.lat)
                this.maxlat = geoLocation.lat;

            if (this.minlng > geoLocation.lng)
                this.minlng = geoLocation.lng;

            if (this.maxlng < geoLocation.lng)
                this.maxlng = geoLocation.lng;

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

    //#endregion

    //#region processChargeTransparencyRecord(CTR)

    private async processChargeTransparencyRecord(CTR: IChargeTransparencyRecord)
    {

        this.chargingStationOperators  = [];
        this.chargingPools             = [];
        this.chargingStations          = [];
        this.EVSEs                     = [];
        this.meters                    = [];
        this.eMobilityProviders        = [];
        this.mediationServices         = [];
        this.chargingSessions          = [];

        this.currentCTR = {} as IChargeTransparencyRecord;

        //#region Prepare View

        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.backButtonDiv.style.display             = "block";

        //#endregion

        //#region Show CTR infos

        if (CTR.description) {
            let descriptionDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            descriptionDiv.id  = "description";
            descriptionDiv.innerText = firstValue(CTR.description);
        }

        if (CTR.begin) {
            let beginDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            beginDiv.id        = "begin";
            beginDiv.className = "defi";
            beginDiv.innerHTML = "von " + parseUTC(CTR.begin).format('dddd, D. MMMM YYYY');
        }

        if (CTR.end) {
            let endDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
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


        //#region Show all charging sessions...

        if (CTR.chargingSessions) {

            let chargingSessionsDiv  = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            chargingSessionsDiv.id   = "chargingSessions";

            for (let chargingSession of CTR.chargingSessions)
            {

                let chargingSessionDiv      = CreateDiv(chargingSessionsDiv, "chargingSessions");               
                chargingSession.GUI         = chargingSessionDiv;
                chargingSessionDiv.onclick  = (ev: MouseEvent) => {

                    //#region Highlight the selected charging session...
        
                    var AllChargingSessionsDivs = document.getElementsByClassName("chargingSessions");
                    for(var i=0; i<AllChargingSessionsDivs.length; i++)
                        AllChargingSessionsDivs[i].classList.remove("activated");
        
                    //(this as HTMLDivElement)!.classList.add("activated");
                    (ev.currentTarget as HTMLDivElement)!.classList.add("activated");
        
                    //#endregion
        
                    this.showChargingSessionDetails(chargingSession);
        
                };

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
                            var duration = this.moment.duration(endUTC - beginUTC);

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

                var tableDiv                = chargingSessionDiv.appendChild(document.createElement('div'));
                    tableDiv.className      = "table";

                //#region Show energy infos

                try {

                    var productInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                    productInfoDiv.className             = "productInfos";

                    var productIconDiv                   = productInfoDiv.appendChild(document.createElement('div'));
                    productIconDiv.className             = "icon";
                    productIconDiv.innerHTML             = '<i class="fas fa-chart-pie"></i>';

                    var productDiv                       = productInfoDiv.appendChild(document.createElement('div'));
                    productDiv.className                 = "text";
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

                //#region Show authorization start/stop information

                try {

                    if (chargingSession.authorizationStart != null)
                    {

                        var authorizationStartDiv            = tableDiv.appendChild(document.createElement('div'));
                            authorizationStartDiv.className  = "authorizationStart";

                        var authorizationStartIconDiv                   = authorizationStartDiv.appendChild(document.createElement('div'));
                        authorizationStartIconDiv.className             = "icon";
                        switch (chargingSession.authorizationStart.type)
                        {

                            case "cryptoKey":
                                authorizationStartIconDiv.innerHTML     = '<i class="fas fa-key"></i>';
                                break;

                            case "eMAId":
                            case "EVCOId":
                                authorizationStartIconDiv.innerHTML     = '<i class="fas fa-mobile-alt"></i>';
                                break;

                            default:
                                authorizationStartIconDiv.innerHTML     = '<i class="fas fa-id-card"></i>';
                                break;

                        }

                        var authorizationStartIdDiv                     = authorizationStartDiv.appendChild(document.createElement('div'));
                        authorizationStartIdDiv.className               = "id";
                        authorizationStartIdDiv.innerHTML = chargingSession.authorizationStart["@id"];

                    }

                    if (chargingSession.authorizationStop != null)
                    {

                        var authorizationStopDiv            = tableDiv.appendChild(document.createElement('div'));
                            authorizationStopDiv.className  = "authorizationStop";

                        var authorizationStopIconDiv                   = authorizationStopDiv.appendChild(document.createElement('div'));
                        authorizationStopIconDiv.className             = "icon";
                        switch (chargingSession.authorizationStop.type)
                        {

                            case "cryptoKey":
                                authorizationStopIconDiv.innerHTML     = '<i class="fas fa-key"></i>';
                                break;

                            case "eMAId":
                            case "EVCOId":
                                authorizationStopIconDiv.innerHTML     = '<i class="fas fa-mobile-alt"></i>';
                                break;

                            default:
                                authorizationStopIconDiv.innerHTML     = '<i class="fas fa-id-card"></i>';
                                break;

                        }

                        var authorizationStopIdDiv                     = authorizationStopDiv.appendChild(document.createElement('div'));
                        authorizationStopIdDiv.className               = "id";
                        authorizationStopIdDiv.innerHTML = chargingSession.authorizationStop["@id"];

                    }                        

                } catch (exception)
                {
                    console.log("Could not show authorization start/stop infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                //#region Show location infos...

                try
                {

                    if (chargingSession.EVSEId            || chargingSession.EVSE            ||
                        chargingSession.chargingStationId || chargingSession.chargingStation ||
                        chargingSession.chargingPoolId    || chargingSession.chargingPool) {

                        var address:IAddress|null             = null;

                        var locationInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        locationInfoDiv.className             = "locationInfos";

                        var locationIconDiv                   = locationInfoDiv.appendChild(document.createElement('div'));
                        locationIconDiv.className             = "icon";
                        locationIconDiv.innerHTML             = '<i class="fas fa-map-marker-alt"></i>';

                        var locationDiv                       = locationInfoDiv.appendChild(document.createElement('div'));
                        locationDiv.classList.add("text");

                        if (chargingSession.EVSEId || chargingSession.EVSE) {

                            if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                                chargingSession.EVSE = this.GetEVSE(chargingSession.EVSEId);

                            locationDiv.classList.add("EVSE");
                            locationDiv.innerHTML             = (chargingSession.EVSE   != null && chargingSession.EVSE.description != null
                                                                    ? firstValue(chargingSession.EVSE.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.EVSEId != null
                                                                    ? chargingSession.EVSEId
                                                                    : chargingSession.EVSE!["@id"]);

                            chargingSession.chargingStation   = chargingSession.EVSE!.chargingStation;
                            chargingSession.chargingStationId = chargingSession.EVSE!.chargingStationId;

                            chargingSession.chargingPool      = chargingSession.EVSE!.chargingStation.chargingPool;
                            chargingSession.chargingPoolId    = chargingSession.EVSE!.chargingStation.chargingPoolId;

                            address                           = chargingSession.EVSE!.chargingStation.address;

                        }

                        else if (chargingSession.chargingStationId || chargingSession.chargingStation) {

                            if (chargingSession.chargingStation == null || typeof chargingSession.chargingStation !== 'object')
                                chargingSession.chargingStation = this.GetChargingStation(chargingSession.chargingStationId);

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
                                chargingSession.chargingPool = this.GetChargingPool(chargingSession.chargingPoolId);

                            if (chargingSession.chargingPool != null)
                            {

                                locationDiv.classList.add("chargingPool");
                                locationDiv.innerHTML             = (chargingSession.chargingPool   != null && chargingSession.chargingPool.description != null
                                                                        ? firstValue(chargingSession.chargingPool.description) + "<br />"
                                                                        : "") +
                                                                    (chargingSession.chargingPoolId != null
                                                                        ? chargingSession.chargingPoolId
                                                                        : chargingSession.chargingPool["@id"]);

                                address = this.GetChargingPool(chargingSession.chargingPool["@id"])!.address;

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
                verificationStatusDiv.innerHTML = await this.checkSessionCrypto(chargingSession);

                //#endregion


                this.chargingSessions.push(chargingSession);

            }

            // If there is only one charging session show its details at once...
            if (this.chargingSessions.length == 1)
                this.chargingSessions[0].GUI.click();

            map.fitBounds([[this.minlat, this.minlng], [this.maxlat, this.maxlng]],
                            { padding: [40, 40] });

        }

        //#endregion

        this.currentCTR = CTR;

    }

    //#endregion

    //#region tryToParseAnonymousFormat(...)

    // e.g. the current chargeIT mobility does not provide any format identifiers
    private tryToParseAnonymousFormat(SomeJSON: { signedMeterValues: any[]; placeInfo: any; }) : boolean
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
            //            "publicKeySignatures": [],
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

                let CTRArray = [];

                for (let i = 0; i < signedMeterValues.length; i++) {

                    let signedMeterValue = signedMeterValues[i];

                    let _timestamp = signedMeterValue["timestamp"] as number;
                    if (_timestamp == null || typeof _timestamp !== 'number')
                        throw "Missing or invalid timestamp[" + i + "]!"
                    let timestamp = parseUTC(_timestamp);

                    let _meterInfo = signedMeterValue["meterInfo"] as string;
                    if (_meterInfo == null || typeof _meterInfo !== 'object')
                        throw "Missing or invalid meterInfo[" + i + "]!"

                    let _meterInfo_firmwareVersion = _meterInfo["firmwareVersion"] as string;
                    if (_meterInfo_firmwareVersion == null || typeof _meterInfo_firmwareVersion !== 'string')
                        throw "Missing or invalid meterInfo firmwareVersion[" + i + "]!"

                    let _meterInfo_publicKey = _meterInfo["publicKey"] as string;
                    if (_meterInfo_publicKey == null || typeof _meterInfo_publicKey !== 'string')
                        throw "Missing or invalid meterInfo publicKey[" + i + "]!"

                    let _meterInfo_publicKeySignatures = _meterInfo["publicKeySignatures"];

                    let _meterInfo_meterId = _meterInfo["meterId"] as string;
                    if (_meterInfo_meterId == null || typeof _meterInfo_meterId !== 'string')
                        throw "Missing or invalid meterInfo meterId[" + i + "]!"

                    let _meterInfo_type = _meterInfo["type"] as string;
                    if (_meterInfo_type == null || typeof _meterInfo_type !== 'string')
                        throw "Missing or invalid meterInfo type[" + i + "]!"

                    let _meterInfo_manufacturer = _meterInfo["manufacturer"] as string;
                    if (_meterInfo_manufacturer == null || typeof _meterInfo_manufacturer !== 'string')
                        throw "Missing or invalid meterInfo manufacturer[" + i + "]!"


                    let _transactionId = signedMeterValue["transactionId"] as string;
                    if (_transactionId == null || typeof _transactionId !== 'string')
                        throw "Missing or invalid transactionId[" + i + "]!"


                    let _contract = signedMeterValue["contract"];
                    if (_contract == null || typeof _contract !== 'object')
                        throw "Missing or invalid contract[" + i + "]!"

                    let _contract_type = _contract["type"] as string;
                    if (_contract_type == null || typeof _contract_type !== 'string')
                        throw "Missing or invalid contract type[" + i + "]!"

                    let _contract_timestampLocal = _contract["timestampLocal"];
                    if (_contract_timestampLocal == null || typeof _contract_timestampLocal !== 'object')
                        throw "Missing or invalid contract timestampLocal[" + i + "]!"

                    let _contract_timestampLocal_timestamp = _contract_timestampLocal["timestamp"] as number;
                    if (_contract_timestampLocal_timestamp == null || typeof _contract_timestampLocal_timestamp !== 'number')
                        throw "Missing or invalid contract timestampLocal timestamp[" + i + "]!"                            

                    let _contract_timestampLocal_localOffset = _contract_timestampLocal["localOffset"] as number;
                    if (_contract_timestampLocal_localOffset == null || typeof _contract_timestampLocal_localOffset !== 'number')
                        throw "Missing or invalid contract timestampLocal localOffset[" + i + "]!"                            
                        
                    let _contract_timestampLocal_seasonOffset = _contract_timestampLocal["seasonOffset"] as number;
                    if (_contract_timestampLocal_seasonOffset == null || typeof _contract_timestampLocal_seasonOffset !== 'number')
                        throw "Missing or invalid contract timestampLocal seasonOffset[" + i + "]!"  

                    let _contract_timestamp = _contract["timestamp"] as number;
                    if (_contract_timestamp == null || typeof _contract_timestamp !== 'number')
                        throw "Missing or invalid contract timestamp[" + i + "]!"

                    let _contract_id = _contract["id"] as string;
                    if (_contract_id == null || typeof _contract_id !== 'string')
                        throw "Missing or invalid contract type[" + i + "]!"


                    let _measurementId = signedMeterValue["measurementId"] as string;
                    if (_measurementId == null || typeof _measurementId !== 'string')
                        throw "Missing or invalid measurementId[" + i + "]!"


                    let _measuredValue = signedMeterValue["measuredValue"];
                    if (_measuredValue == null || typeof _measuredValue !== 'object')
                        throw "Missing or invalid measuredValue[" + i + "]!"

                    let _measuredValue_timestampLocal = _measuredValue["timestampLocal"];
                    if (_measuredValue_timestampLocal == null || typeof _measuredValue_timestampLocal !== 'object')
                        throw "Missing or invalid measuredValue timestampLocal[" + i + "]!"

                    let _measuredValue_timestampLocal_timestamp = _measuredValue_timestampLocal["timestamp"] as number;
                    if (_measuredValue_timestampLocal_timestamp == null || typeof _measuredValue_timestampLocal_timestamp !== 'number')
                        throw "Missing or invalid measuredValue timestampLocal timestamp[" + i + "]!"                            

                    let _measuredValue_timestampLocal_localOffset = _measuredValue_timestampLocal["localOffset"] as number;
                    if (_measuredValue_timestampLocal_localOffset == null || typeof _measuredValue_timestampLocal_localOffset !== 'number')
                        throw "Missing or invalid measuredValue timestampLocal localOffset[" + i + "]!"                            
                        
                    let _measuredValue_timestampLocal_seasonOffset = _measuredValue_timestampLocal["seasonOffset"] as number;
                    if (_measuredValue_timestampLocal_seasonOffset == null || typeof _measuredValue_timestampLocal_seasonOffset !== 'number')
                        throw "Missing or invalid measuredValue timestampLocal seasonOffset[" + i + "]!"                            

                    let _measuredValue_value = _measuredValue["value"] as string;
                    if (_measuredValue_value == null || typeof _measuredValue_value !== 'string')
                        throw "Missing or invalid measuredValue value[" + i + "]!"

                    let _measuredValue_unit = _measuredValue["unit"] as string;
                    if (_measuredValue_unit == null || typeof _measuredValue_unit !== 'string')
                        throw "Missing or invalid measuredValue unit[" + i + "]!"

                    let _measuredValue_scale = _measuredValue["scale"] as number;
                    if (_measuredValue_scale == null || typeof _measuredValue_scale !== 'number')
                        throw "Missing or invalid measuredValue scale[" + i + "]!"

                    let _measuredValue_valueType = _measuredValue["valueType"] as string;
                    if (_measuredValue_valueType == null || typeof _measuredValue_valueType !== 'string')
                        throw "Missing or invalid measuredValue valueType[" + i + "]!"

                    let _measuredValue_unitEncoded = _measuredValue["unitEncoded"] as number;
                    if (_measuredValue_unitEncoded == null || typeof _measuredValue_unitEncoded !== 'number')
                        throw "Missing or invalid measuredValue unitEncoded[" + i + "]!"


                    let _measurand = signedMeterValue["measurand"];
                        if (_measurand == null || typeof _measurand !== 'object')
                            throw "Missing or invalid measurand[" + i + "]!"

                    let _measurand_id = _measurand["id"] as string;
                    if (_measurand_id == null || typeof _measurand_id !== 'string')
                        throw "Missing or invalid measurand id[" + i + "]!"

                    let _measurand_name = _measurand["name"] as string;
                    if (_measurand_name == null || typeof _measurand_name !== 'string')
                        throw "Missing or invalid measurand name[" + i + "]!"


                    let _additionalInfo = signedMeterValue["additionalInfo"];
                        if (_additionalInfo == null || typeof _additionalInfo !== 'object')
                            throw "Missing or invalid additionalInfo[" + i + "]!"

                    let _additionalInfo_indexes = _additionalInfo["indexes"];
                    if (_additionalInfo_indexes == null || typeof _additionalInfo_indexes !== 'object')
                        throw "Missing or invalid additionalInfo indexes[" + i + "]!"

                    let _additionalInfo_indexes_timer = _additionalInfo_indexes["timer"] as number;
                    if (_additionalInfo_indexes_timer == null || typeof _additionalInfo_indexes_timer !== 'number')
                        throw "Missing or invalid additionalInfo indexes timer[" + i + "]!"

                    let _additionalInfo_indexes_logBook = _additionalInfo_indexes["logBook"] as string;
                    if (_additionalInfo_indexes_logBook == null || typeof _additionalInfo_indexes_logBook !== 'string')
                        throw "Missing or invalid additionalInfo indexes logBook[" + i + "]!"
                        
                    let _additionalInfo_status = _additionalInfo["status"] as string;
                    if (_additionalInfo_status == null || typeof _additionalInfo_status !== 'string')
                        throw "Missing or invalid additionalInfo status[" + i + "]!"


                    let _chargePoint = signedMeterValue["chargePoint"];
                    if (_chargePoint == null || typeof _chargePoint !== 'object')
                        throw "Missing or invalid chargePoint[" + i + "] information!"

                    let _chargePointSoftwareVersion = _chargePoint["softwareVersion"];
                    if (_chargePointSoftwareVersion == null || typeof _chargePointSoftwareVersion !== 'string')
                        throw "Missing or invalid chargePoint softwareVersion[" + i + "]!"


                    let _signature = signedMeterValue["signature"] as string;
                    if (_signature == null || typeof _signature !== 'string')
                        throw "Missing or invalid signature[" + i + "]!"


                    //let aaa = moment.unix(_contract_timestampLocal_timestamp).utc();

                    CTRArray.push({
                                "timestamp": _timestamp,
                                "meterInfo": {
                                    "firmwareVersion": _meterInfo_firmwareVersion,
                                    "publicKey": _meterInfo_publicKey,
                                    "publicKeySignatures": _meterInfo_publicKeySignatures,
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
                                "chargePoint": {
                                    "softwareVersion": _chargePointSoftwareVersion
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

                    "@id":              CTRArray[n]["transactionId"],
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",
                
                    "begin":            this.moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                    "end":              this.moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                
                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },
                
                    "contract": {
                        "@id":          CTRArray[0]["contract"]["id"],
                        "type":         CTRArray[0]["contract"]["type"],
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
                                    "@id":                      evseId.substring(0, evseId.lastIndexOf("*")),
                                    // "description": {
                                    //     "de":                   "GraphDefined Charging Station - CI-Tests Pool 3 / Station A"
                                    // },
                                    "firmwareVersion":          CTRArray[0]["chargePoint"]["softwareVersion"],
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
                                                            "value":            CTRArray[0]["meterInfo"]["publicKey"].startsWith("04")
                                                                                    ?        CTRArray[0]["meterInfo"]["publicKey"]
                                                                                    : "04" + CTRArray[0]["meterInfo"]["publicKey"],
                                                            "signatures":       CTRArray[0]["meterInfo"]["publicKeySignatures"]
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

                            "@id":                          CTRArray[n]["transactionId"],
                            "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json",
                            "begin":                        this.moment.unix(CTRArray[0]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                            "end":                          this.moment.unix(CTRArray[n]["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                            "EVSEId":                       evseId,
                
                            "authorizationStart": {
                                "@id":                      CTRArray[0]["contract"]["id"],
                                "type":                     CTRArray[0]["contract"]["type"],
                                "timestamp":                this.moment.unix(CTRArray[0]["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                             CTRArray[0]["contract"]["timestampLocal"]["localOffset"] +
                                                                             CTRArray[0]["contract"]["timestampLocal"]["seasonOffset"]).format(),
                            },

                            "signatureInfos": {
                                "hash":                     "SHA512",
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
                                        "hash":                 "SHA512",
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
                                                "timestamp":      this.moment.unix(_measurement["measuredValue"]["timestampLocal"]["timestamp"]).utc().utcOffset(
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

                this.processChargeTransparencyRecord(_CTR);
                return true;

            }
            catch (exception)
            {
                console.log("chargeIT mobility legacy CTR format: " + exception);
            }                

        }

        return false;

    }

    //#endregion

    //#region tryToParseTransparenzSoftwareXML(XMLDocument)

    private tryToParseTransparenzSoftwareXML(XMLDocument: Document) : boolean
    {

        // The SAFE transparency software v1.0 does not understand its own
        // XML namespace. Therefore we have to guess the format.

        try
        {

            let values = XMLDocument.querySelectorAll("values");
            if (values.length == 1)
            {
                let valueList = values[0].querySelectorAll("value");
                if (valueList.length >= 1)
                {
                    for (var i in valueList)
                    {

                        //#region Parse XML...

                        let signedDataEncoding  = "";
                        let signedDataFormat    = "";
                        let signedDataValue     = "";
                        let publicKeyEncoding   = "";
                        let publicKeyValue      = "";

                        var signedData = valueList[i].querySelector("signedData");
                        if (signedData != null)
                        {

                            signedDataEncoding = signedData.attributes.getNamedItem("encoding") !== null ? signedData.attributes.getNamedItem("encoding")!.value.trim().toLowerCase() : "";
                            signedDataFormat   = signedData.attributes.getNamedItem("format")   !== null ? signedData.attributes.getNamedItem("format")!.value.trim().toLowerCase()   : "";
                            signedDataValue    = signedData.textContent                         !== null ? signedData.textContent.trim()                                              : "";

                            switch (signedDataEncoding)
                            {

                                //case "base32":

                                case "base64":
                                    signedDataValue = Buffer.from(signedDataValue, 'base64').toString();
                                    break;

                                //case "hex":

                            }

                        }

                        // Note: The public key is optional!
                        var publicKey  = valueList[i].querySelector("publicKey");
                        if (publicKey != null)
                        {

                            publicKeyEncoding = publicKey.attributes.getNamedItem("encoding")   !== null ? publicKey.attributes.getNamedItem("encoding")!.value.trim().toLowerCase()  : "";
                            publicKeyValue    = publicKey.textContent                           !== null ? publicKey.textContent.trim()                                               : "";

                            switch (publicKeyEncoding)
                            {

                                //case "base32":

                                case "base64":
                                    publicKeyValue = Buffer.from(publicKeyValue, 'base64').toString();
                                    break;

                                //case "hex":

                            }

                        }

                        //#endregion

                        if (signedDataValue !== "")
                        {
                            switch (signedDataFormat)
                            {

                                case "ocmf":
                                    this.tryToParseOCMF(signedDataValue, publicKeyValue);
                                    break;

                            }
                        }

                    }
                }
            }

        }
        catch (exception)
        {  }

        return false;

    }

    //#endregion

    //#region tryToParseOCMF(OCMF, PublicKey?)

    //#region tryToParseOCMFv0_1(OCMFData, PublicKey?)

    private tryToParseOCMFv0_1(OCMFData:    IOCMFData_v0_1,
                               PublicKey?:  string) : boolean
    {

        // {
        //     "FV": "0.1",
        //     "VI": "ABL",
        //     "VV": "1.4p3",
        //
        //     "PG": "T12345",
        //
        //     "MV": "Phoenix Contact",
        //     "MM": "EEM-350-D-MCB",
        //     "MS": "BQ27400330016",
        //     "MF": "1.0",
        //
        //     "IS": "VERIFIED",
        //     "IF": ["RFID_PLAIN", "OCPP_RS_TLS"],
        //     "IT": "ISO14443",
        //     "ID": "1F2D3A4F5506C7",
        //
        //     "RD": [{
        //         "TM": "2018-07-24T13:22:04,000+0200 S",
        //         "TX": "B",
        //         "RV": 2935.6,
        //         "RI": "1-b:1.8.e",
        //         "RU": "kWh",
        //         "EI": 567,
        //         "ST": "G"
        //     }]
        // }

        try
        {

            let VendorInformation  :string = OCMFData.VI != null ? OCMFData.VI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the vendor.
            let VendorVersion      :string = OCMFData.VV != null ? OCMFData.VV.trim() : ""; // Software version of the vendor.

            let paging             :string = OCMFData.PG != null ? OCMFData.PG.trim() : ""; // Paging, as this data might be part of a larger context.
            let transactionType     = OCMFTransactionTypes.undefined;
            switch (paging[0].toLowerCase())
            {

                case 't':
                    transactionType = OCMFTransactionTypes.transaction;
                    break;

                case 'f':
                    transactionType = OCMFTransactionTypes.fiscal;
                    break

            }
            let pagingId            = paging.substring(1);

            let MeterVendor        :string = OCMFData.MV != null ? OCMFData.MV.trim() : ""; // Vendor of the device, optional.
            let MeterModel         :string = OCMFData.MM != null ? OCMFData.MM.trim() : ""; // Model of the device, optional.
            let MeterSerial        :string = OCMFData.MS != null ? OCMFData.MS.trim() : ""; // Serialnumber of the device, might be optional.
            let MeterFirmware      :string = OCMFData.MF != null ? OCMFData.MF.trim() : ""; // Software version of the device.

        } catch (exception)
        { }

        return false;

    }

    //#endregion

    //#region tryToParseOCMFv1_0(OCMFData, PublicKey?)

    private tryToParseOCMFv1_0(OCMFData:    IOCMFData_v1_0,
                               PublicKey?:  string) : boolean
    {

        // {
        //     "FV": "1.0",
        //     "GI": "SEAL AG",
        //     "GS": "1850006a",
        //     "GV": "1.34",
        //
        //     "PG": "T9289",
        //
        //     "MV": "Carlo Gavazzi",
        //     "MM": "EM340-DIN.AV2.3.X.S1.PF",
        //     "MS": "******240084S",
        //     "MF": "B4",
        //
        //     "IS": true,
        //     "IL": "TRUSTED",
        //     "IF": ["OCCP_AUTH"],
        //     "IT": "ISO14443",
        //     "ID": "56213C05",
        //
        //     "RD": [{
        //         "TM": "2019-06-26T08:57:44,337+0000 U",
        //         "TX": "B",
        //         "RV": 268.978,
        //         "RI": "1-b:1.8.0",
        //         "RU": "kWh",
        //         "RT": "AC",
        //         "EF": "",
        //         "ST": "G"
        //     }]
        // }

        try
        {

            let GatewayInformation :string = OCMFData.GI != null ? OCMFData.GI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the gateway.
            let GatewaySerial      :string = OCMFData.GS != null ? OCMFData.GS.trim() : ""; // Serial number of the gateway, might be mandatory.
            let GatewayVersion     :string = OCMFData.GV != null ? OCMFData.GV.trim() : ""; // Software version of the gateway.

            let paging             :string = OCMFData.PG != null ? OCMFData.PG.trim() : ""; // Paging, as this data might be part of a larger context.
            let transactionType     = OCMFTransactionTypes.undefined;
            switch (paging[0].toLowerCase())
            {

                case 't':
                    transactionType = OCMFTransactionTypes.transaction;
                    break;

                case 'f':
                    transactionType = OCMFTransactionTypes.fiscal;
                    break

            }
            let pagingId            = paging.substring(1);

            let MeterVendor        :string = OCMFData.MV != null ? OCMFData.MV.trim() : ""; // Vendor of the device, optional.
            let MeterModel         :string = OCMFData.MM != null ? OCMFData.MM.trim() : ""; // Model of the device, optional.
            let MeterSerial        :string = OCMFData.MS != null ? OCMFData.MS.trim() : ""; // Serialnumber of the device, might be optional.
            let MeterFirmware      :string = OCMFData.MF != null ? OCMFData.MF.trim() : ""; // Software version of the device.

        } catch (exception)
        { }

        return false;

    }

    //#endregion

    private tryToParseOCMF(OCMF:        string,
                           PublicKey?:  string) : boolean
    {

        // OCMF|{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}
        let elements = OCMF.split('|');

        if (elements.length == 3)
        {

            try
            {

                let OCMFData       = JSON.parse(elements[1]);
                let OCMFSignature  = JSON.parse(elements[2]);

               
                // http://hers.abl.de/SAFE/Datenformat_OCMF/Datenformat_OCMF_v1.0.pdf
                // Ein Darstellungsformat, JSON-basiert (nachvollziehbar)
                // Ein Übertragungsformat, JSON-basiert (vereinheitlicht)
                //
                // {
                //     "FV": "1.0",
                //     "GI": "SEAL AG",
                //     "GS": "1850006a",
                //     "GV": "1.34",
                //
                //     "PG": "T9289",
                //
                //     "MV": "Carlo Gavazzi",
                //     "MM": "EM340-DIN.AV2.3.X.S1.PF",
                //     "MS": "******240084S",
                //     "MF": "B4",
                //
                //     "IS": true,
                //     "IL": "TRUSTED",
                //     "IF": ["OCCP_AUTH"],
                //     "IT": "ISO14443",
                //     "ID": "56213C05",
                //
                //     "RD": [{
                //         "TM": "2019-06-26T08:57:44,337+0000 U",
                //         "TX": "B",
                //         "RV": 268.978,
                //         "RI": "1-b:1.8.0",
                //         "RU": "kWh",
                //         "RT": "AC",
                //         "EF": "",
                //         "ST": "G"
                //     }]
                // }

                // Protocol version: major.minor
                let FormatVersion:string = OCMFData["FV"] != null ? OCMFData["FV"].trim() : ""; 

                switch (FormatVersion)
                {

                    case "0.1":
                        return this.tryToParseOCMFv0_1(OCMFData as IOCMFData_v0_1, PublicKey);

                    case "1.0":
                        return this.tryToParseOCMFv1_0(OCMFData as IOCMFData_v1_0, PublicKey);

                }

            }
            catch (exception)
            {  }

        }

        return false;

    }

    //#endregion

    //#region detectContentFormat(Content)

    private detectContentFormat(Content: string) {

        if (Content == null)
            return;

        this.inputInfosDiv.style.display  = 'none';
        this.errorTextDiv.style.display   = 'none';

        //#region Clean data

        Content = Content.trim();

        // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
	    // conversion translates it to FEFF (UTF-16 BOM)
        if (Content.charCodeAt(0) === 0xFEFF)
            Content = Content.substr(1);

        //#endregion

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

                        case "http://transparenz.software/schema/2018/07":
                            if (!this.tryToParseTransparenzSoftwareXML(XMLDocument))
                                this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");
                            break;

                        // The SAFE transparency software v1.0 does not understand its own
                        // XML namespace. Therefore we have to guess the format.
                        case "":
                            if (!this.tryToParseTransparenzSoftwareXML(XMLDocument))
                                this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");
                            break;

                    }

                }

                //#endregion

                //#region ..., or plain XML.

                else
                {

                    // The SAFE transparency software v1.0 does not understand its own
                    // XML namespace. Therefore we have to guess the format.
                    if (!this.tryToParseTransparenzSoftwareXML(XMLDocument))
                        this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");

                }

                //#endregion

            } catch (exception)
            { 
                this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");
            }
        }

        //#endregion

        //#region OCMF processing

        else if (Content.startsWith("OCMF|{"))
        {

            if (!this.tryToParseOCMF(Content))
                this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");

        }

        //#endregion

        //#region JSON processing

        else
        {
            try
            {

                let JSONContent = JSON.parse(Content);

                switch (JSONContent["@context"])
                {

                    case "https://open.charging.cloud/contexts/CTR+json":
                        this.processChargeTransparencyRecord(JSONContent);
                        break;

                    default:
                        //@ts-ignore
                        if (!this.tryToParseAnonymousFormat(JSONContent))
                            this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");
                        break;

                }


            } catch (exception)
            { 
                this.doGlobalError("Unbekanntes Transparenzdatensatzformat!");
            }
        }

        //#endregion

    }

    //#endregion

    //#region checkMeasurementCrypto(measurementValue)

    private async checkMeasurementCrypto(measurementValue: IMeasurementValue)
    {

        var result = await this.verifyMeasurementCryptoDetails(measurementValue);

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

    //#endregion

    //#region showChargingSessionDetails

    private async showChargingSessionDetails(chargingSession: IChargingSession)
    {

        try
        {

            this.evseTarifInfosDiv.innerHTML = "";

            if (chargingSession.measurements)
            {
                for (var measurement of chargingSession.measurements)
                {

                    measurement.chargingSession      = chargingSession;

                    let headline                     = CreateDiv(this.evseTarifInfosDiv);
                    headline.id                      = "headline";
                    headline.innerHTML               = "Informationen zum Ladevorgang";

                    let MeasurementInfoDiv           = CreateDiv(this.evseTarifInfosDiv,  "measurementInfos");

                    //#region Show charging station infos

                    if (measurement.chargingSession.chargingStation != null)
                    {

                        let ChargingStationDiv       = CreateDiv(MeasurementInfoDiv,  "chargingStation");
                        let ChargingStationHeadline  = CreateDiv(ChargingStationDiv,  "chargingStationHeadline",
                                                                 "Ladestation");

                        if (measurement.chargingSession.chargingStation["@id"] != null)
                        {

                            let ChargingStationIdDiv       = CreateDiv(ChargingStationDiv,    "chargingStationId");

                            let ChargingStationIdIdDiv     = CreateDiv(ChargingStationIdDiv,  "chargingStationIdId",
                                                                       "Identifikation");

                            let ChargingStationIdValueDiv  = CreateDiv(ChargingStationIdDiv,  "chargingStationIdValue",
                                                                       measurement.chargingSession.chargingStation["@id"]);

                        }

                        if (measurement.chargingSession.chargingStation.firmwareVersion != null)
                        {

                            let firmwareVersionDiv       = CreateDiv(ChargingStationDiv,  "firmwareVersion");

                            let firmwareVersionIdDiv     = CreateDiv(firmwareVersionDiv,  "firmwareVersionId",
                                                                     "Firmware-Version");

                            let firmwareVersionValueDiv  = CreateDiv(firmwareVersionDiv,  "firmwareVersionValue",
                                                                     measurement.chargingSession.chargingStation.firmwareVersion);

                        }

                    }

                    //#endregion

                    //#region Show meter infos...

                    let meterDiv       = CreateDiv(MeasurementInfoDiv,  "meter");
                    let meterHeadline  = CreateDiv(meterDiv,  "meterHeadline",
                                                             "Energiezähler");

                    var meter                        = this.GetMeter(measurement.energyMeterId);

                    if (meter != null)
                    {

                        let meterIdDiv               = CreateDiv(meterDiv,            "meterId");

                        let meterIdIdDiv             = CreateDiv(meterIdDiv,          "meterIdId",
                                                                 "Seriennummer");

                        let meterIdValueDiv          = CreateDiv(meterIdDiv,          "meterIdValue",
                                                                 measurement.energyMeterId);


                        let MeterVendorDiv           = CreateDiv(meterDiv,  "meterVendor");

                        let MeterVendorIdDiv         = CreateDiv(MeterVendorDiv,      "meterVendorId",
                                                                 "Zählerhersteller");

                        let MeterVendorValueDiv      = CreateDiv(MeterVendorDiv,      "meterVendorIdValue",
                                                                 meter.vendor);


                        let MeterModelDiv            = CreateDiv(meterDiv,  "meterModel");

                        let MeterModelIdDiv          = CreateDiv(MeterModelDiv,       "meterModelId",
                                                                 "Model");

                        let MeterModelValueDiv       = CreateDiv(MeterModelDiv,       "meterModelIdValue",
                                                                 meter.model);

                    }

                    //#endregion

                    //#region ...or show meterId infos

                    else {

                        let meterIdDiv               = CreateDiv(meterDiv,            "meter");

                        let meterIdIdDiv             = CreateDiv(meterIdDiv,          "meterId",
                                                                 "Zählerseriennummer");

                        let meterIdValueDiv          = CreateDiv(meterIdDiv,          "meterIdValue",
                                                                 measurement.energyMeterId);

                    }

                    //#endregion

                    //#region Show measurement infos

                    let measurementDiv               = CreateDiv(meterDiv,           "measurement");

                    let MeasurementIdDiv             = CreateDiv(measurementDiv,     "measurementId",
                                                                 "Messung");

                    let MeasurementIdValueDiv        = CreateDiv(measurementDiv,     "measurementIdValue",
                                                                 measurement.name);


                    let OBISDiv                      = CreateDiv(meterDiv,           "OBIS");

                    let OBISIdDiv                    = CreateDiv(OBISDiv,            "OBISId",
                                                                 "OBIS-Kennzahl");

                    let OBISValueDiv                 = CreateDiv(OBISDiv,            "OBISValue",
                                                                 parseOBIS(measurement.obis));

                    //#endregion


                    //#region Show measurement values...

                    if (measurement.values && measurement.values.length > 0)
                    {

                        let meterHeadline                = CreateDiv(this.evseTarifInfosDiv,  "measurementsHeadline",
                                                                     "Messwerte");
                        meterHeadline.id = "measurementValues-headline";

                        let MeasurementValuesDiv         = CreateDiv(this.evseTarifInfosDiv,     "measurementValues");
                        let previousValue                = 0;

                        for (let measurementValue of measurement.values)
                        {

                            measurementValue.measurement     = measurement;

                            let MeasurementValueDiv          = CreateDiv(MeasurementValuesDiv, "measurementValue");
                            MeasurementValueDiv.onclick      = (ev: MouseEvent) => {
                                this.showMeasurementCryptoDetails(measurementValue);
                            };

                            var timestamp                    = parseUTC(measurementValue.timestamp);

                            let timestampDiv                 = CreateDiv(MeasurementValueDiv, "timestamp",
                                                                         timestamp.format('HH:mm:ss') + " Uhr");


                            // Show energy counter value
                            let value2Div                    = CreateDiv(MeasurementValueDiv, "value1",
                                                                         parseFloat((measurementValue.value * Math.pow(10, measurementValue.measurement.scale)).toFixed(10)).toString());

                            switch (measurement.unit)
                            {

                                case "KILO_WATT_HOURS":
                                    CreateDiv(MeasurementValueDiv, "unit1", "kWh");
                                    break;

                                // "WATT_HOURS"
                                default:
                                    CreateDiv(MeasurementValueDiv, "unit1", "Wh");
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

                            let valueDiv                     = CreateDiv(MeasurementValueDiv, "value2",
                                                                         "+" + (previousValue > 0
                                                                                    ? parseFloat((currentValue - previousValue).toFixed(10))
                                                                                    : "0"));

                            let unitDiv                      = CreateDiv(MeasurementValueDiv, "unit2",
                                                                         "kWh");


                            // Show signature status
                            let verificationStatusDiv        = CreateDiv(MeasurementValueDiv, "verificationStatus",
                                                                         await this.checkMeasurementCrypto(measurementValue));

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

    //#endregion


    //#region verifySessionCryptoDetails

    private async verifySessionCryptoDetails(chargingSession: IChargingSession) : Promise<ISessionCryptoResult>
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
                chargingSession.method = new GDFCrypt01(this.GetMeter, await this.CheckMeterPublicKeySignature);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json":
                chargingSession.method = new EMHCrypt01(this.GetMeter, await this.CheckMeterPublicKeySignature);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            default:
                return result;

        }

    }

    //#endregion

    //#region verifyMeasurementCryptoDetails

    private async verifyMeasurementCryptoDetails(measurementValue:  IMeasurementValue) : Promise<ICryptoResult>
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
                 measurementValue.method = new GDFCrypt01(this.GetMeter, this.CheckMeterPublicKeySignature);
                 return measurementValue.method.VerifyMeasurement(measurementValue);

            case "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json":
                 if (measurementValue.measurement.chargingSession.method != null)
                 {

                    measurementValue.method = measurementValue.measurement.chargingSession.method;

                    if (measurementValue.result == null)
                        return measurementValue.method.VerifyMeasurement(measurementValue);

                    return measurementValue.result;

                 }

                 measurementValue.method = new EMHCrypt01(this.GetMeter, this.CheckMeterPublicKeySignature);
                 return measurementValue.method.VerifyMeasurement(measurementValue);

            default:
                return result;

        }

    }

    //#endregion

    //#region showMeasurementCryptoDetails

    private showMeasurementCryptoDetails(measurementValue:  IMeasurementValue) : void
    {

        function doError(text: String)
        {
            //inputInfosDiv.style.display  = 'flex';
            //errorTextDiv.style.display   = 'inline-block';
            introDiv.innerHTML           = '<i class="fas fa-times-circle"></i> ' + text;
        }


        let introDiv       = this.overlayDiv.querySelector('#intro')      as HTMLDivElement;
        let cryptoDataDiv  = this.overlayDiv.querySelector('#cryptoData') as HTMLDivElement;

        if (measurementValue             == null ||
            measurementValue.measurement == null)
        {
            doError("Unbekanntes Messdatensatzformat!");
        }


        //#region Show data and result on overlay        

        this.overlayDiv.style.display = 'block';

        let bufferValue               = this.overlayDiv.querySelector('#buffer .value')             as HTMLDivElement;
        let hashedBufferValue         = this.overlayDiv.querySelector('#hashedBuffer .value')       as HTMLDivElement;
        let publicKeyValue            = this.overlayDiv.querySelector('#publicKey .value')          as HTMLDivElement;
        let signatureExpectedValue    = this.overlayDiv.querySelector('#signatureExpected .value')  as HTMLDivElement;
        let signatureCheckValue       = this.overlayDiv.querySelector('#signatureCheck')            as HTMLDivElement;

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

    //#endregion



    //#region Global error handling...

    private doGlobalError(text:      String,
                          context?:  any)
    {

        this.inputInfosDiv.style.display             = 'flex';
        this.chargingSessionScreenDiv.style.display  = 'none';
        this.chargingSessionScreenDiv.innerHTML      = '';
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        console.log(text);
        console.log(context);

    }

    //#endregion


    //#region Read and parse CTR file

    private readAndParseFile(file: File) {

        if (!file)
            return;

        var reader = new FileReader();

        reader.onload = (event) => {
            try
            {
                this.detectContentFormat((event.target as any).result);
            }
            catch (exception) {
                this.doGlobalError("Fehlerhafter Transparenzdatensatz!", exception);
            }
        }

        reader.onerror = (event) => {
            this.doGlobalError("Fehlerhafter Transparenzdatensatz!", event);
        }

        reader.readAsText(file, 'UTF-8');

    }

    //#endregion

    //#region Process .chargy file extentions/associations opened via this app

    private readFileFromDisk(filename: string): void {
        if (filename != null && filename.trim() != "" && filename != "." && filename[0] != '-')
        {
            try
            {
                let content = require('original-fs').readFileSync(filename.replace("file://", ""), 'utf-8');
                this.detectContentFormat(JSON.parse(content));
            }
            catch (exception) {
                this.doGlobalError("Fehlerhafter Transparenzdatensatz!", exception);
            }
        }
    }

    //#endregion

}
