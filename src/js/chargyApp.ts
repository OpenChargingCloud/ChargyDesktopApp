/*
 * Copyright (c) 2018-2020 GraphDefined GmbH <achim.friedland@graphdefined.com>
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
///<reference path="chargy.ts" />
///<reference path="GDFCrypt01.ts" />
///<reference path="EMHCrypt01.ts" />
///<reference path="chargePoint01.ts" />
///<reference path="chargeIT.ts" />
///<reference path="SAFE_XML.ts" />
///<reference path="OCMF.ts" />
///<reference path="Alfen01.ts" />
///<reference path="Mennekes.ts" />

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

class ChargyApp {

    //#region Data

    private elliptic:                   any;
    private moment:                     any;
    private chargy:                     Chargy;

    public  appEdition                  = "";
    public  copyright                   = "";
    public  appVersion                  = "";
    public  versionsURL                 = "";
    private ipcRenderer                 = require('electron').ipcRenderer;
    private path                        = require('path');
    private commandLineArguments        = [];
    public  packageJson:                any = {};

    private exe_hash                    = "";
    private app_asar_hash               = "";
    private electron_asar_hash          = "";
    private complete_hash               = "";

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
    private backButton:                 HTMLButtonElement;
    private exportButtonDiv:            HTMLDivElement;
    private exportButton:               HTMLButtonElement;
    private fileInputButton:            HTMLButtonElement;
    private fileInput:                  HTMLInputElement;
    private evseTarifInfosDiv:          HTMLDivElement;
    private errorTextDiv:               HTMLDivElement;
    private overlayDiv:                 HTMLDivElement;
    private overlayOkButton:            HTMLButtonElement;

    private markers:                    any     = [];
    private minlat:                     number  = +1000;
    private maxlat:                     number  = -1000;
    private minlng:                     number  = +1000;
    private maxlng:                     number  = -1000;

    private currentAppInfos:            any     = null;
    private currentVersionInfos:        any     = null;
    private currentPackage:             any     = null;

    private appDiv                     = document.getElementById('app')         as HTMLDivElement;
    private headlineDiv                = document.getElementById('headline')    as HTMLDivElement;
    private verifyframeDiv             = document.getElementById('verifyframe') as HTMLDivElement;

    //#endregion

    constructor(appEdition?:  string,
                copyright?:   string,
                versionsURL?: string) {

        this.appVersion                = this.ipcRenderer.sendSync('getAppVersion');
        this.appEdition                = appEdition  ?? "";
        this.copyright                 = copyright   ?? "&copy; 2018-2020 GraphDefined GmbH";
        this.versionsURL               = versionsURL ?? "https://raw.githubusercontent.com/OpenChargingCloud/ChargyDesktopApp/master/versions/versions.json";
        this.commandLineArguments      = this.ipcRenderer.sendSync('getCommandLineArguments');
        this.packageJson               = this.ipcRenderer.sendSync('getPackageJson');

        this.elliptic                  = require('elliptic');
        this.moment                    = require('moment');

        this.chargy                    = new Chargy(this.elliptic,
                                                    this.moment);

        //const curves = require("crypto").getCurves();
        //console.log(curves);
        //const sha256 = require("crypto").createHash('sha256').update("text", 'utf8').digest('hex');
        //const sha512 = require("crypto").createHash('sha512').update("text", 'utf8').digest('hex');

        //#region OnWindowResize

        this.UpdateWindowSize();

        window.onresize = (ev: UIEvent) => {
            this.UpdateWindowSize();
        }

        //#endregion

        //#region Calculate application hash

        switch (process.platform)
        {

            case "win32":
                this.calcSHA512FileHash('Chargy Transparenzsoftware.exe',             hash => this.exe_hash           = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512FileHash(this.path.join('resources', 'app.asar'),      hash => this.app_asar_hash      = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512FileHash(this.path.join('resources', 'electron.asar'), hash => this.electron_asar_hash = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                break;

            case "linux":
            case "freebsd":
            case "openbsd":
                this.calcSHA512FileHash('/opt/Chargy\ Transparenzsoftware/chargytransparenzsoftware', hash => this.exe_hash           = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512FileHash('/opt/Chargy\ Transparenzsoftware/resources/app.asar',        hash => this.app_asar_hash      = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512FileHash('/opt/Chargy\ Transparenzsoftware/resources/electron.asar',   hash => this.electron_asar_hash = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                break;

            case "darwin":
                this.calcSHA512FileHash('/Applications/Chargy\ Transparenzsoftware.app/Contents/MacOS/Chargy Transparenzsoftware', hash => this.exe_hash           = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512FileHash('/Applications/Chargy\ Transparenzsoftware.app/Contents/Resources/app.asar',               hash => this.app_asar_hash      = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                this.calcSHA512FileHash('/Applications/Chargy\ Transparenzsoftware.app/Contents/Resources/electron.asar',          hash => this.electron_asar_hash = hash, errorMessage => this.chargySHA512Div.children[1].innerHTML = "Dateien nicht gefunden!");
                break;

            default:
                let chargySHA512Div = document.getElementById('chargySHA512');
                if (chargySHA512Div != null && chargySHA512Div.children.length >= 2)
                    chargySHA512Div.children[1].innerHTML = "Kann nicht berechnet werden!"
                break;

        }

        //#endregion

        //#region Get list of Chargy versions from GitHub

        let GetListOfVersionsFromGitHub = new XMLHttpRequest();
        GetListOfVersionsFromGitHub.open("GET",
                                         this.versionsURL,
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

                                var thisVersion   = this.appVersion.split('.');
                                var remoteVersion = version.version.split('.');

                                //#region Find current version package

                                if (remoteVersion[0] == thisVersion[0] &&
                                    remoteVersion[1] == thisVersion[1] &&
                                    remoteVersion[2] == thisVersion[2])
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

                                else if (remoteVersion[0] >  thisVersion[0] ||
                                        (remoteVersion[0] >= thisVersion[0] && remoteVersion[1] >  thisVersion[1]) ||
                                        (remoteVersion[0] >= thisVersion[0] && remoteVersion[1] >= thisVersion[1] && remoteVersion[2] > thisVersion[2]))
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


        (document.getElementById("appEdition")    as HTMLSpanElement).innerHTML = this.appEdition;
        (document.getElementById("appVersion")    as HTMLSpanElement).innerHTML = this.appVersion;
        (document.getElementById("chargyVersion") as HTMLSpanElement).innerHTML = this.appVersion;
        (document.getElementById("copyright")     as HTMLSpanElement).innerHTML = this.copyright;


        //#region Handle the 'Update available'-button

        this.updateAvailableButton     = <HTMLButtonElement>   document.getElementById('updateAvailableButton');
        this.updateAvailableButton.onclick = (ev: MouseEvent) => {
            this.updateAvailableScreen.style.display     = "block";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.backButtonDiv.style.display             = "block";
            this.exportButtonDiv.style.display           = "none";
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
            this.exportButtonDiv.style.display           = "none";

            //#region Calculate the over-all application hash

            if (this.complete_hash      == "" &&
                this.exe_hash           != "" &&
                this.app_asar_hash      != "" &&
                this.electron_asar_hash != "")
            {

                var sha512hash = require('crypto').createHash('sha512');
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

        this.fileInput.onchange = (ev: Event) => {

            //@ts-ignore
            var files = ev?.target?.files;

            if (files != null)
                this.readFilesFromDisk(files);

        }

        //#endregion

        //#region Handle Drag'n'Drop of charge transparency files

        this.input                     = <HTMLDivElement>      document.getElementById('input');

        this.input.addEventListener('dragenter', (event: DragEvent) => {
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)?.classList.add('over');
        }, false);

        this.input.addEventListener('dragover',  (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
            (event.currentTarget as HTMLDivElement)?.classList.add('over');
        }, false);

        this.input.addEventListener('dragleave', (event: DragEvent) => {
            (event.currentTarget as HTMLDivElement)?.classList.remove('over');
        }, false);

        this.input.addEventListener('drop',      (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)?.classList.remove('over');
            if (event.dataTransfer?.files != null)
                this.readFilesFromDisk(event.dataTransfer.files);
        }, false);

        //#endregion

        //#region Handle the 'paste'-button

        var pasteButton               = <HTMLButtonElement>   document.getElementById('pasteButton');
        pasteButton.onclick           = async (ev: MouseEvent)  => {
            await this.readClipboard();
        }

        //#endregion

        //#region Handle IPC message "receiveReadClipboard" (Ctrl+V)

        this.ipcRenderer.on('receiveReadClipboard', async (event:any) => {
            await this.readClipboard();
        });

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
        sendIssueButton.onclick = (ev: MouseEvent) => {

            ev.preventDefault();

            try
            {

                //#region Collect issue data...

                var data = {};

                data["timestamp"]                  = new Date().toISOString();
                data["chargyVersion"]              = this.appVersion;
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
                {
                    let stringify = require('safe-stable-stringify');
                    data["chargeTransparencyRecord"] = stringify(this.chargy.currentCTR);
                }

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

        //#region Handle the 'back'-button

        this.backButtonDiv             = <HTMLDivElement>      document.getElementById('backButtonDiv');
        this.backButton                = this.backButtonDiv.querySelector("#backButton") as HTMLButtonElement;
        this.backButton.onclick        = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.backButtonDiv.style.display             = "none";
            this.exportButtonDiv.style.display           = "none";
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

        //#region Handle the 'download'-button

        this.exportButtonDiv         = <HTMLDivElement> document.getElementById('exportButtonDiv');
        this.exportButton            = this.exportButtonDiv.querySelector("#exportButton") as HTMLButtonElement;
        this.exportButton.onclick    = async (ev: MouseEvent) => {

            try
            {

                const path = this.ipcRenderer.sendSync('showSaveDialog')

                if (path != null)
                    require('original-fs').writeFileSync(path,
                                                         JSON.stringify(this.chargy.currentCTR, null, '\t'),
                                                         'utf-8');

            }
            catch(exception)
            {
                alert('Failed to save the charge transparency record!' + exception);
            }

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
        if (this.commandLineArguments.length > 0)
            this.readFilesFromDisk(this.commandLineArguments);

        // Mac OS X - first file to open
        this.readFileFromDisk(this.ipcRenderer.sendSync('getChargyFilename'));

        // Mac OS X - when app is running
        this.ipcRenderer.on('receiveFileToOpen', (event:any, filename:string) => {
            this.readFileFromDisk(filename);
        });

        this.ipcRenderer.on('receiveFilesToOpen', (event:any, filenames:string[]) => {
            this.readFilesFromDisk(filenames);
        });

        //#endregion

    }


    //#region UpdateWindowSize()

    private UpdateWindowSize() {
        this.verifyframeDiv.style.maxHeight = (this.appDiv.clientHeight - this.headlineDiv.clientHeight).toString() + "px";
    }

    //#endregion

    //#region calcSHA512FileHash(...)

    private calcSHA512FileHash(filename:   string,
                               OnSuccess:  { (hash:         string):  any; },
                               OnFailed:   { (errorMessage: string):  any; })
    {

        const fs      = require('original-fs');
        let   sha512  = require('crypto').createHash('sha512');
        let   stream  = fs.createReadStream(filename);

        stream.on('data', function(data: any) {
            sha512.update(data) //update(text, 'utf8')
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
                    "version":              this.appVersion,
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
            var sha256value = require('crypto').createHash('sha256').
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


    //#region readFile(s)FromDisk()

    private readFileFromDisk(file: string|File): void {

        if (typeof file == 'string')
            this.readFilesFromDisk([ file ]);
        else
            this.readFilesFromDisk([ file.name ]);

    }

    private readFilesFromDisk(files: string[]|FileList): void {
        if (files != null && files.length > 0)
        {

            //#region Map file names

            let filesToLoad = new Array<IFileInfo>();

            for (let i = 0; i < files.length; i++)
            {

                let file = files[i];

                if (typeof file == 'string')
                    filesToLoad.push({ name: file });
                else
                    filesToLoad.push(file)

            }

            //#endregion

            let fs          = require('original-fs');
            let loadedFiles = new Array<IFileInfo>();

            for (const filename of filesToLoad)
            {
                if (filename.name.trim() != "" && filename.name != "." && filename.name[0] != '-')
                {
                    try
                    {

                        loadedFiles.push({
                                       "name":  filename.name,
                                       "path":  filename.path,
                                       "data":  fs.readFileSync((filename.path ?? filename.name).replace("file://", ""))
                                    });

                    }
                    catch (exception) {
                        loadedFiles.push({
                            "name":       filename.name,
                            "path":       filename.path,
                            "error":     "Fehlerhafter Transparenzdatensatz!",
                            "exception":  exception
                         });
                    }
                }
            }


            if (loadedFiles.length > 0)
                this.detectAndConvertContentFormat(loadedFiles);

        }
    }

    //#endregion

    //#region readClipboard()

    private async readClipboard()
    {
        try
        {
            let text = await navigator.clipboard.readText();
            this.detectAndConvertContentFormat(text);
        }
        catch (exception)
        {
            this.doGlobalError("Unbekannter Transparenzdatensatz!")
        }
    }

    //#endregion

    //#region detectAndConvertContentFormat(FileInfos)

    private async detectAndConvertContentFormat(FileInfos: Array<IFileInfo>|IFileInfo|string) {

        this.inputInfosDiv.style.display  = 'none';
        this.errorTextDiv.style.display   = 'none';

        //@ts-ignore
        let result:IChargeTransparencyRecord|ISessionCryptoResult = null;

        if (typeof FileInfos === 'string')
            result = await this.chargy.detectAndConvertContentFormat([{
                                                                         name: "clipboard",
                                                                         data: new TextEncoder().encode(FileInfos)
                                                                      }]);

        else if (isIFileInfo(FileInfos))
            result = await this.chargy.detectAndConvertContentFormat([ FileInfos ]);

        else
            result = await this.chargy.detectAndConvertContentFormat(FileInfos);


        if (IsAChargeTransparencyRecord(result))
            await this.showChargeTransparencyRecord(result);

        else
            this.doGlobalError(result ?? "Unbekanntes Transparenzdatensatzformat!");

    }

    //#endregion

    //#region showChargeTransparencyRecord(CTR)

    private async showChargeTransparencyRecord(CTR: IChargeTransparencyRecord)
    {

        if (CTR == null)
            return;

        //#region Prepare View

        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.backButtonDiv.style.display             = "flex";
        this.exportButtonDiv.style.display           = "flex";

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

        //#region Show global contract infos

        if (CTR.contract)
        {
        }

        //#endregion

        //#region Show all charging sessions...

        if (CTR.chargingSessions)
        {

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

                    //(this as HTMLDivElement)?.classList.add("activated");
                    (ev.currentTarget as HTMLDivElement)?.classList.add("activated");

                    //#endregion

                    this.showChargingSessionDetails(chargingSession);

                };

                //#region Show session time infos

                try
                {

                    if (chargingSession.begin)
                    {

                        let dateDiv  = chargingSessionDiv.appendChild(document.createElement('div'));
                        dateDiv.className = "date";
                        dateDiv.innerHTML = UTC2human(chargingSession.begin);

                        if (chargingSession.end)
                        {

                            let endUTC   = parseUTC(chargingSession.end);
                            let duration = this.moment.duration(endUTC - parseUTC(chargingSession.begin));

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

                let tableDiv                = chargingSessionDiv.appendChild(document.createElement('div'));
                    tableDiv.className      = "table";

                //#region Show energy infos

                try
                {

                    let productInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                    productInfoDiv.className             = "productInfos";

                    let productIconDiv                   = productInfoDiv.appendChild(document.createElement('div'));
                    productIconDiv.className             = "icon";
                    productIconDiv.innerHTML             = '<i class="fas fa-chart-pie"></i>';

                    let productDiv                       = productInfoDiv.appendChild(document.createElement('div'));
                    productDiv.className                 = "text";
                    productDiv.innerHTML = chargingSession.product != null ? chargingSession.product["@id"] + "<br />" : "";

                    if (chargingSession.begin && chargingSession.end)
                    {

                        let duration = this.moment.duration(parseUTC(chargingSession.end) - parseUTC(chargingSession.begin));

                        productDiv.innerHTML += "Ladedauer ";
                        if      (Math.floor(duration.asDays())    > 1) productDiv.innerHTML += duration.days()    + " Tage " + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asDays())    > 0) productDiv.innerHTML += duration.days()    + " Tag "  + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asHours())   > 0) productDiv.innerHTML += duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asMinutes()) > 0) productDiv.innerHTML += duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asSeconds()) > 0) productDiv.innerHTML += duration.seconds();


                        if (chargingSession.chargingProductRelevance != undefined && chargingSession.chargingProductRelevance.time != undefined)
                        {
                            switch (chargingSession.chargingProductRelevance.time)
                            {

                                case InformationRelevance.Unkonwn:
                                case InformationRelevance.Ignored:
                                case InformationRelevance.Important:
                                    break;

                                case InformationRelevance.Informative:
                                    productDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                    break;

                                default:
                                    productDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.time + ")</span>";
                                    break;

                            }
                        }

                    }

                    if (chargingSession.measurements)
                    {
                        for (let measurement of chargingSession.measurements)
                        {
                            //<i class="far fa-chart-bar"></i>
                            if (measurement.values && measurement.values.length > 0)
                            {

                                if (measurement.scale == null)
                                    measurement.scale = 0;

                                let first  = measurement.values[0].value;
                                let last   = measurement.values[measurement.values.length-1].value;
                                let amount = parseFloat(((last - first) * Math.pow(10, measurement.scale)).toFixed(10));

                                switch (measurement.unit)
                                {

                                    case "kWh":
                                    case "KILO_WATT_HOURS":
                                        break;

                                    // "WATT_HOURS" or "Wh"
                                    default:
                                        amount = parseFloat((amount / 1000).toFixed(10));
                                        break;

                                }

                                productDiv.innerHTML += "<br />" + measurementName2human(measurement.name) + " " + amount.toString() + " kWh";// (" + measurement.values.length + " Messwerte)";


                                if (chargingSession.chargingProductRelevance != undefined && chargingSession.chargingProductRelevance.energy != undefined)
                                {
                                    switch (chargingSession.chargingProductRelevance.energy)
                                    {

                                        case InformationRelevance.Unkonwn:
                                        case InformationRelevance.Ignored:
                                        case InformationRelevance.Important:
                                            break;

                                        case InformationRelevance.Informative:
                                            productDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                            break;

                                        default:
                                            productDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.energy + ")</span>";
                                            break;

                                    }
                                }

                            }

                        }
                    }

                }
                catch (exception)
                { 
                    console.log("Could not show energy infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                //#region Show parking infos

                try
                {

                    if (chargingSession.parking && chargingSession.parking.length > 0)
                    {

                        var parkingInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        parkingInfoDiv.className             = "parkingInfos";

                        var parkingIconDiv                   = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingIconDiv.className             = "icon";
                        parkingIconDiv.innerHTML             = '<i class="fas fa-parking"></i>';

                        var parkingDiv                       = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingDiv.className                 = "text";
                       // parkingDiv.innerHTML = chargingSession.parking != null ? chargingSession.product["@id"] + "<br />" : "";

                        if (chargingSession.parking[chargingSession.parking.length-1].end != null)
                        {

                            let parkingBegin  = parseUTC(chargingSession.parking[0].begin);
                            //@ts-ignore
                            let parkingEnd    = parseUTC(chargingSession.parking[chargingSession.parking.length-1].end);
                            let duration      = this.moment.duration(parkingEnd - parkingBegin);

                            parkingDiv.innerHTML += "Parkdauer ";
                            if      (Math.floor(duration.asDays())    > 1) parkingDiv.innerHTML += duration.days()    + " Tage " + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asDays())    > 0) parkingDiv.innerHTML += duration.days()    + " Tag "  + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asHours())   > 0) parkingDiv.innerHTML += duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asMinutes()) > 0) parkingDiv.innerHTML += duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asSeconds()) > 0) parkingDiv.innerHTML += duration.seconds();


                            if (chargingSession.chargingProductRelevance != undefined && chargingSession.chargingProductRelevance.parking != undefined)
                            {
                                switch (chargingSession.chargingProductRelevance.parking)
                                {

                                    case InformationRelevance.Unkonwn:
                                    case InformationRelevance.Ignored:
                                    case InformationRelevance.Important:
                                        break;

                                    case InformationRelevance.Informative:
                                        parkingDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                        break;

                                    default:
                                        parkingDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.parking + ")</span>";
                                        break;

                                }
                            }

                        }

                    }

                }
                catch (exception)
                { 
                    console.log("Could not show parking infos of charging session '" + chargingSession["@id"] + "':" + exception);
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

                //#region Show charging station infos...

                try
                {

                    if (chargingSession.EVSEId            || chargingSession.EVSE            ||
                        chargingSession.chargingStationId || chargingSession.chargingStation ||
                        chargingSession.chargingPoolId    || chargingSession.chargingPool) {

                        var chargingStationInfoDiv            = tableDiv.appendChild(document.createElement('div'));
                        chargingStationInfoDiv.className      = "chargingStationInfos";

                        var chargingStationIconDiv            = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationIconDiv.className      = "icon";
                        chargingStationIconDiv.innerHTML      = '<i class="fas fa-charging-station"></i>';

                        var chargingStationDiv                = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationDiv.classList.add("text");

                        if (chargingSession.EVSEId || chargingSession.EVSE) {

                            if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                                chargingSession.EVSE = this.chargy.GetEVSE(chargingSession.EVSEId);

                            chargingStationDiv.classList.add("EVSE");
                            chargingStationDiv.innerHTML      = (chargingSession.EVSE   != null && chargingSession.EVSE.description != null
                                                                    ? firstValue(chargingSession.EVSE.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.EVSEId != null
                                                                    ? chargingSession.EVSEId
                                                                    : chargingSession.EVSE!["@id"]);

                            if (chargingSession.EVSE)
                            {

                                chargingSession.chargingStation   = chargingSession.EVSE.chargingStation;
                                chargingSession.chargingStationId = chargingSession.EVSE.chargingStationId;

                                if (chargingSession.EVSE.chargingStation)
                                {
                                    chargingSession.chargingPool      = chargingSession.EVSE.chargingStation.chargingPool;
                                    chargingSession.chargingPoolId    = chargingSession.EVSE.chargingStation.chargingPoolId;
                                    address                           = chargingSession.EVSE.chargingStation.address;
                                }

                            }

                        }

                        else if (chargingSession.chargingStationId || chargingSession.chargingStation) {

                            if (chargingSession.chargingStation == null || typeof chargingSession.chargingStation !== 'object')
                                chargingSession.chargingStation = this.chargy.GetChargingStation(chargingSession.chargingStationId);

                            if (chargingSession.chargingStation != null)
                            {

                                chargingStationDiv.classList.add("chargingStation");
                                chargingStationDiv.innerHTML      = (chargingSession.chargingStation   != null && chargingSession.chargingStation.description != null
                                                                        ? firstValue(chargingSession.chargingStation.description) + "<br />"
                                                                        : "") +
                                                                    (chargingSession.chargingStationId != null
                                                                        ? chargingSession.chargingStationId
                                                                        : chargingSession.chargingStation["@id"]);

                                chargingSession.chargingPool      = chargingSession.chargingStation.chargingPool;
                                chargingSession.chargingPoolId    = chargingSession.chargingStation.chargingPoolId;

                            }
                            else
                                chargingStationDiv.remove();

                        }

                        else if (chargingSession.chargingPoolId || chargingSession.chargingPool) {

                            if (chargingSession.chargingPool == null || typeof chargingSession.chargingPool !== 'object')
                                chargingSession.chargingPool = this.chargy.GetChargingPool(chargingSession.chargingPoolId);

                            if (chargingSession.chargingPool != null)
                            {

                                chargingStationDiv.classList.add("chargingPool");
                                chargingStationDiv.innerHTML      = (chargingSession.chargingPool   != null && chargingSession.chargingPool.description != null
                                                                        ? firstValue(chargingSession.chargingPool.description) + "<br />"
                                                                        : "") +
                                                                    (chargingSession.chargingPoolId != null
                                                                        ? chargingSession.chargingPoolId
                                                                        : chargingSession.chargingPool["@id"]);

                            }
                            else
                                chargingStationDiv.remove();

                        }

                    }

                } catch (exception)
                {
                    console.log("Could not show charging station infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                //#region Show location infos...

                try
                {

                    var address:IAddress|null = null;

                    if (chargingSession.chargingStation != null && chargingSession.chargingStation.address != null)
                        address = chargingSession.chargingStation.address;

                    else if (chargingSession.chargingPool != null && chargingSession.chargingPool.address != null)
                        address = chargingSession.chargingPool.address;

                    if (address != null)
                    {

                        var locationInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        locationInfoDiv.className  = "locationInfos";

                        var locationIconDiv        = locationInfoDiv.appendChild(document.createElement('div'));
                        locationIconDiv.className  = "icon";
                        locationIconDiv.innerHTML  = '<i class="fas fa-map-marker-alt"></i>';

                        var locationDiv            = locationInfoDiv.appendChild(document.createElement('div'));
                        locationDiv.classList.add("text");
                        locationDiv.innerHTML      =   (address.street      != null ? " " + address.street        : "") +
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

                if (chargingSession.verificationResult)
                    switch (chargingSession.verificationResult.status)
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

                    if (chargingSession.verificationResult)
                        switch (chargingSession.verificationResult.status)
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

                        }

                }

                //#endregion

                //#region Show verification status

                let verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                verificationStatusDiv.className = "verificationStatus";

                if (chargingSession.verificationResult)
                    switch (chargingSession.verificationResult.status)
                    {

                        case SessionVerificationResult.UnknownSessionFormat:
                        case SessionVerificationResult.PublicKeyNotFound:
                        case SessionVerificationResult.InvalidPublicKey:
                        case SessionVerificationResult.InvalidSignature:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Ungültig';
                            break;

                        case SessionVerificationResult.ValidSignature:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Gültig';
                            break;

                        default:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Ungültig';
                            break;

                    }

                //#endregion

            }

            // If there is at least one charging session show its details at once...
            if (CTR.chargingSessions.length >= 1)
                CTR.chargingSessions[0].GUI.click();

            map.fitBounds([[this.minlat, this.minlng], [this.maxlat, this.maxlng]],
                          { padding: [40, 40] });

        }

        //#endregion

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

                        if (measurement.chargingSession.chargingStation["@id"]?.length > 0)
                            CreateDiv2(ChargingStationDiv,  "chargingStationId",
                                       "Identifikation",    measurement.chargingSession.chargingStation["@id"]);

                        if (measurement.chargingSession.chargingStation.firmwareVersion?.length > 0)
                            CreateDiv2(ChargingStationDiv,  "firmwareVersion",
                                       "Firmware-Version",  measurement.chargingSession.chargingStation.firmwareVersion);

                    }

                    //#endregion

                    //#region Show meter infos...

                    let meterDiv       = CreateDiv(MeasurementInfoDiv,  "meter");
                    let meterHeadline  = CreateDiv(meterDiv,            "meterHeadline",
                                                                        "Energiezähler");

                    var meter          = this.chargy.GetMeter(measurement.energyMeterId);

                    if (meter != null)
                    {

                        CreateDiv2(meterDiv,         "meterId",
                                   "Seriennummer",   measurement.energyMeterId);

                        if (meter.vendor?.length > 0)
                            CreateDiv2(meterDiv,            "meterVendor",
                                       "Zählerhersteller",  meter.vendor);

                        if (meter.model?.length > 0)
                            CreateDiv2(meterDiv,            "meterModel",
                                       "Model",             meter.model);

                    }

                    //#endregion

                    //#region ...or just show the meter identification

                    else
                        CreateDiv2(meterDiv,              "meterId",
                                   "Zählerseriennummer",  measurement.energyMeterId);

                    //#endregion

                    //#region Show measurement infos

                    CreateDiv2(meterDiv,              "measurement",
                               "Messung",             measurement.name);

                    CreateDiv2(meterDiv,              "OBIS",
                               "OBIS-Kennzahl",       measurement.obis);

                    //#endregion

                    //#region Show measurement values...

                    if (measurement.values && measurement.values.length > 0)
                    {

                        let meterHeadline                = CreateDiv(this.evseTarifInfosDiv,  "measurementsHeadline",
                                                                     "Messwerte");
                        meterHeadline.id                 = "measurementValues-headline";

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
                                                                         previousValue > 0
                                                                             ? "+" + parseFloat((currentValue - previousValue).toFixed(10))
                                                                             : "0");

                            let unitDiv                      = CreateDiv(MeasurementValueDiv, "unit2",
                                                                         previousValue > 0
                                                                             ? "kWh"
                                                                             : "");

                            //#region Show signature status

                            let icon = '<i class="fas fa-times-circle"></i> Ungültige Signatur';

                            if (measurementValue.result)
                                switch (measurementValue.result.status)
                                {

                                    case VerificationResult.UnknownCTRFormat:
                                        icon = '<i class="fas fa-times-circle"></i> Unbekanntes Transparenzdatenformat';
                                        break;

                                    case VerificationResult.EnergyMeterNotFound:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültiger Energiezähler';
                                        break;

                                    case VerificationResult.PublicKeyNotFound:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültiger Public Key';
                                        break;

                                    case VerificationResult.InvalidPublicKey:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültiger Public Key';
                                        break;


                                    case VerificationResult.InvalidSignature:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültige Signatur';
                                        break;

                                    case VerificationResult.InvalidStartValue:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültiger Startwert';
                                        break;

                                    case VerificationResult.InvalidIntermediateValue:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültiger Zwischenwert';
                                        break;

                                    case VerificationResult.InvalidStopValue:
                                        icon = '<i class="fas fa-times-circle"></i> Ungültiger Endwert';
                                        break;


                                    case VerificationResult.NoOperation:
                                        icon = '<div class="noValidation">Messwert</div>';
                                        break;

                                    case VerificationResult.StartValue:
                                        icon = '<div class="noValidation">Startwert</div>';
                                        break;

                                    case VerificationResult.IntermediateValue:
                                        icon = '<div class="noValidation">Zwischenwert</div>';
                                        break;

                                    case VerificationResult.StopValue:
                                        icon = '<div class="noValidation">Endwert</div>';
                                        break;


                                    case VerificationResult.ValidSignature:
                                        icon = '<i class="fas fa-check-circle"></i> Gültige Signatur';
                                        break;

                                    case VerificationResult.ValidStartValue:
                                        icon = '<i class="fas fa-check-circle"></i> Gültiger Startwert';
                                        break;

                                    case VerificationResult.ValidIntermediateValue:
                                        icon = '<i class="fas fa-check-circle"></i> Gültiger Zwischenwert';
                                        break;

                                    case VerificationResult.ValidStopValue:
                                        icon = '<i class="fas fa-check-circle"></i> Gültiger Endwert';
                                        break;

                                }

                            let verificationStatusDiv        = CreateDiv(MeasurementValueDiv,
                                                                         "verificationStatus",
                                                                         icon);

                            //#endregion

                            previousValue                    = currentValue;

                        }

                    }

                    //#endregion

                }
            }

        }
        catch (exception)
        {
            this.doGlobalError(exception);
        }

    }

    //#endregion

    //#region showMeasurementCryptoDetails

    private showMeasurementCryptoDetails(measurementValue:  IMeasurementValue) : void
    {

        function doError(text: String)
        {
            errorDiv.innerHTML           = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display       = "none";
        }

        let errorDiv            = this.overlayDiv.querySelector('#error')      as HTMLDivElement;
        let introDiv            = this.overlayDiv.querySelector('#intro')      as HTMLDivElement;
        errorDiv.innerHTML      = "";
        introDiv.style.display  = "block";

        if (measurementValue             == null ||
            measurementValue.measurement == null)
        {
            doError("Unbekanntes Messdatensatzformat!");
        }


        //#region Show data and result on overlay

        this.overlayDiv.style.display = 'block';

        let cryptoDataDiv           = this.overlayDiv.querySelector('#cryptoData')                as HTMLDivElement;
        let bufferDiv               = this.overlayDiv.querySelector('#buffer .value')             as HTMLDivElement;
        let hashedBufferDiv         = this.overlayDiv.querySelector('#hashedBuffer .value')       as HTMLDivElement;
        let publicKeyDiv            = this.overlayDiv.querySelector('#publicKey .value')          as HTMLDivElement;
        let signatureExpectedDiv    = this.overlayDiv.querySelector('#signatureExpected .value')  as HTMLDivElement;
        let signatureCheckDiv       = this.overlayDiv.querySelector('#signatureCheck')            as HTMLDivElement;

        cryptoDataDiv.innerHTML         = '';
        bufferDiv.innerHTML             = '';
        hashedBufferDiv.innerHTML       = '0x00000000000000000000000000000000000';
        publicKeyDiv.innerHTML          = '0x00000000000000000000000000000000000';
        signatureExpectedDiv.innerHTML  = '0x00000000000000000000000000000000000';
        signatureCheckDiv.innerHTML     = '';

        if (measurementValue.method)
            measurementValue.method.ViewMeasurement(measurementValue,
                                                    introDiv,
                                                    cryptoDataDiv,
                                                    bufferDiv,
                                                    hashedBufferDiv,
                                                    publicKeyDiv,
                                                    signatureExpectedDiv,
                                                    signatureCheckDiv);

        else
        {
            doError("Unbekanntes Messdatensatzformat!");
        }

        //#endregion

    }

    //#endregion

    //#region Global error handling...

    private doGlobalError(result:   ISessionCryptoResult|string,
                          context?: any)
    {

        let text = (typeof result === 'string'
                        ? result?.trim()
                        : result.message?.trim())
                    ?? "Unbekanntes Transparenzdatensatzformat!";

        this.inputInfosDiv.style.display             = 'flex';
        this.chargingSessionScreenDiv.style.display  = 'none';
        this.chargingSessionScreenDiv.innerHTML      = '';
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        console.log(text);
        console.log(context);

    }

    //#endregion

}

