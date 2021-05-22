/*
 * Copyright (c) 2018-2021 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

// ToDo: Imports lead to strange errors!
// import { debug } from "util";
// import * as crypto from "crypto";
// import { readSync } from "fs";
// import { version } from "punycode";

var map:     any  = "";
var leaflet: any  = "";

function OpenLink(url: string)
{
    if (url.startsWith("https://"))
        require('electron').shell.openExternal(url);
}

class ChargyApp {

    //#region Data

    private elliptic:                      any;
    private moment:                        any;
    private chargy:                        Chargy;

    public  appEdition:                    string              = "";
    public  copyright:                     string              = "";
    public  appVersion:                    string              = "";
    public  versionsURL:                   string              = "";
    public  feedbackEMail:                 string[]            = [];
    public  feedbackHotline:               string[]            = [];
    public  issueURL:                      string              = "";
    private ipcRenderer                                        = require('electron').ipcRenderer;
    private commandLineArguments:          Array<string>       = [];
    public  packageJson:                   any                 = {};

    private currentAppInfos:               any                 = null;
    private currentVersionInfos:           any                 = null;
    private currentPackage:                any                 = null;
    private applicationHash:               string              = "";

    private markers:                       any                 = [];
    private minlat:                        number              = +1000;
    private maxlat:                        number              = -1000;
    private minlng:                        number              = +1000;
    private maxlng:                        number              = -1000;

    private appDiv:                        HTMLDivElement;
    private headlineDiv:                   HTMLDivElement;
    private verifyframeDiv:                HTMLDivElement;

    private updateAvailableButton:         HTMLButtonElement;
    private aboutButton:                   HTMLButtonElement;
    private fullScreenButton:              HTMLButtonElement;
    private appQuitButton:                 HTMLButtonElement;

    private updateAvailableScreen:         HTMLDivElement;
    private inputDiv:                      HTMLDivElement;
    private inputInfosDiv:                 HTMLDivElement;
    private aboutScreenDiv:                HTMLDivElement;
    private applicationHashDiv:            HTMLDivElement;
    private applicationHashValueDiv:       HTMLDivElement;
    private chargingSessionScreenDiv:      HTMLDivElement;
    private invalidDataSetsScreenDiv:      HTMLDivElement;
    private inputButtonsDiv:               HTMLDivElement;
    private backButton:                    HTMLButtonElement;
    private exportButtonDiv:               HTMLDivElement;
    private exportButton:                  HTMLButtonElement;
    private fileInputButton:               HTMLButtonElement;
    private fileInput:                     HTMLInputElement;
    private pasteButton:                   HTMLButtonElement;
    private evseTarifInfosDiv:             HTMLDivElement;
    private errorTextDiv:                  HTMLDivElement;
    private feedbackDiv:                   HTMLDivElement;
    private overlayDiv:                    HTMLDivElement;
    private overlayOkButton:               HTMLButtonElement;
    private issueTrackerDiv:               HTMLDivElement;
    private privacyStatement:              HTMLDivElement;
    private feedbackMethodsDiv:            HTMLDivElement;
    private showIssueTrackerButton:        HTMLButtonElement;
    private issueTrackerText:              HTMLDivElement;
    private showPrivacyStatement:          HTMLButtonElement;
    private privacyStatementAccepted:      HTMLInputElement;
    private sendIssueButton:               HTMLButtonElement;
    private softwareInfosDiv:              HTMLDivElement;
    private openSourceLibsDiv:             HTMLDivElement;
    private issueBackButton:               HTMLButtonElement;

    //#endregion

    constructor(versionsURL?:      string,
                feedbackEMail?:    string[],
                feedbackHotline?:  string[],
                issueURL?:         string) {

        this.appDiv                    = document.getElementById('app')                                   as HTMLDivElement;
        this.headlineDiv               = document.getElementById('headline')                              as HTMLDivElement;
        this.verifyframeDiv            = document.getElementById('verifyframe')                           as HTMLDivElement;

        this.aboutScreenDiv            = document.getElementById('aboutScreen')                           as HTMLDivElement;
        this.updateAvailableScreen     = document.getElementById('updateAvailableScreen')                 as HTMLDivElement;
        this.applicationHashDiv        = document.getElementById('applicationHash')                       as HTMLDivElement;
        this.chargingSessionScreenDiv  = document.getElementById('chargingSessionScreen')                 as HTMLDivElement;
        this.invalidDataSetsScreenDiv  = document.getElementById('invalidDataSetsScreen')                 as HTMLDivElement;
        this.evseTarifInfosDiv         = document.getElementById('evseTarifInfos')                        as HTMLDivElement;
        this.inputDiv                  = document.getElementById('input')                                 as HTMLDivElement;
        this.inputInfosDiv             = document.getElementById('inputInfos')                            as HTMLDivElement;
        this.errorTextDiv              = document.getElementById('errorText')                             as HTMLDivElement;
        this.feedbackDiv               = document.getElementById('feedback')                              as HTMLDivElement;
        this.inputButtonsDiv           = document.getElementById('inputButtons')                          as HTMLDivElement;
        this.exportButtonDiv           = document.getElementById('exportButtonDiv')                       as HTMLDivElement;
        this.issueTrackerDiv           = document.getElementById('issueTracker')                          as HTMLDivElement;
        this.overlayDiv                = document.getElementById('overlay')                               as HTMLDivElement;
        this.applicationHashValueDiv   = this.applicationHashDiv.querySelector("#value")                  as HTMLDivElement;
        this.privacyStatement          = this.issueTrackerDiv.querySelector("#privacyStatement")          as HTMLDivElement;
        this.feedbackMethodsDiv        = this.feedbackDiv.querySelector("#feedbackMethods")               as HTMLDivElement;
        this.issueTrackerText          = this.issueTrackerDiv.querySelector("#issueTrackerText")          as HTMLDivElement;
        this.softwareInfosDiv          = this.aboutScreenDiv.querySelector("#softwareInfos")              as HTMLDivElement;
        this.openSourceLibsDiv         = this.aboutScreenDiv.querySelector("#openSourceLibs")             as HTMLDivElement;

        this.updateAvailableButton     = document.getElementById('updateAvailableButton')                 as HTMLButtonElement;
        this.aboutButton               = document.getElementById('aboutButton')                           as HTMLButtonElement;
        this.fullScreenButton          = document.getElementById('fullScreenButton')                      as HTMLButtonElement;
        this.appQuitButton             = document.getElementById('appQuitButton')                         as HTMLButtonElement;
        this.overlayOkButton           = document.getElementById('overlayOkButton')                       as HTMLButtonElement;
        this.fileInputButton           = document.getElementById('fileInputButton')                       as HTMLButtonElement;
        this.pasteButton               = document.getElementById('pasteButton')                           as HTMLButtonElement;
        this.backButton                = this.inputButtonsDiv.querySelector("#backButton")                as HTMLButtonElement;
        this.exportButton              = this.exportButtonDiv.querySelector("#exportButton")              as HTMLButtonElement;
        this.showPrivacyStatement      = this.issueTrackerDiv.querySelector("#showPrivacyStatement")      as HTMLButtonElement;
        this.privacyStatementAccepted  = this.issueTrackerDiv.querySelector("#privacyStatementAccepted")  as HTMLInputElement;
        this.sendIssueButton           = this.issueTrackerDiv.querySelector("#sendIssueButton")           as HTMLButtonElement;
        this.showIssueTrackerButton    = this.feedbackMethodsDiv.querySelector("#showIssueTracker")       as HTMLButtonElement;
        this.issueBackButton           = this.issueTrackerDiv.querySelector("#issueBackButton")           as HTMLButtonElement;

        this.appVersion                = this.ipcRenderer.sendSync('getAppVersion')     ?? "";
        this.appEdition                = this.ipcRenderer.sendSync('getAppEdition')     ?? "";
        this.copyright                 = this.ipcRenderer.sendSync('getCopyright')      ?? "&copy; 2018-2021 GraphDefined GmbH";
        this.versionsURL               = versionsURL                                    ?? "https://open.charging.cloud/chargy/versions";
        this.issueURL                  = issueURL                                       ?? "https://open.charging.cloud/chargy/issues";
        this.feedbackEMail             = feedbackEMail   != undefined ? feedbackEMail   : ["support@open.charging.cloud", "?subject=Chargy%20Supportanfrage"];
        this.feedbackHotline           = feedbackHotline != undefined ? feedbackHotline : ["+491728930852",               "+49 172 8930852"];
        this.commandLineArguments      = this.ipcRenderer.sendSync('getCommandLineArguments');
        this.packageJson               = this.ipcRenderer.sendSync('getPackageJson');

        this.elliptic                  = require('elliptic');
        this.moment                    = require('moment');

        this.chargy                    = new Chargy(this.elliptic,
                                                    this.moment);


        //#region OnWindowResize

        window.onresize = (ev: UIEvent) => {
            this.verifyframeDiv.style.maxHeight = (this.appDiv.clientHeight - this.headlineDiv.clientHeight).toString() + "px";
        }

        // Call it once on application start
        window.dispatchEvent(new Event("resize"));

        //#endregion

        //#region Set infos of the about section

            (this.softwareInfosDiv. querySelector("#appEdition")             as HTMLSpanElement).innerHTML = this.appEdition;
            (this.softwareInfosDiv. querySelector("#appVersion")             as HTMLSpanElement).innerHTML = this.appVersion;
            (this.softwareInfosDiv. querySelector("#copyright")              as HTMLSpanElement).innerHTML = this.copyright;

            (this.openSourceLibsDiv.querySelector("#chargyVersion")          as HTMLSpanElement).innerHTML = this.appVersion;

        if (this.packageJson.devDependencies)
        {
            (this.openSourceLibsDiv.querySelector("#electronBuilder")        as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["electron-builder"]?.       replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#typeScript")             as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["typescript"]?.             replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#SASS")                   as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["sass"]?.                   replace(/[^0-9\.]/g, "");
        }

        if (this.packageJson.dependencies)
        {
            (this.openSourceLibsDiv.querySelector("#electronLocalShortcut")  as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["electron-localshortcut"]?. replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#elliptic")               as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["elliptic"]?.               replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#momentJS")               as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["moment"]?.                 replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#decompress")             as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decompress"]?.             replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#decompressBZIP2")        as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decompress-bzip2"]?.       replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#decompressGZ")           as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decompress-gz"]?.          replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#fileType")               as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["file-type"]?.              replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#asn1JS")                 as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["asn1.js"]?.                replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#base32Decode")           as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["base32-decode"]?.          replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#safeStableStringify")    as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["safe-stable-stringify"]?.  replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#leafletJS")              as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["leaflet"]?.                replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#leafletAwesomeMarkers")  as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["leaflet.awesome-markers"]?.replace(/[^0-9\.]/g, "");
            (this.openSourceLibsDiv.querySelector("#chartJS")                as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["chart.js"]?.               replace(/[^0-9\.]/g, "");
        }

        //#endregion

        //#region Set infos of the feedback section

        this.showIssueTrackerButton.onclick = (ev: MouseEvent) => {
            this.issueTrackerDiv.style.display   = 'block';
            this.privacyStatement.style.display  = "none";
            this.issueTrackerText.scrollTop = 0;
        }

        if (this.feedbackEMail && this.feedbackEMail.length == 2)
        {
            (this.feedbackMethodsDiv.querySelector("#eMail")   as HTMLAnchorElement).href       = "mailto:" + this.feedbackEMail[0] + this.feedbackEMail[1];
            (this.feedbackMethodsDiv.querySelector("#eMail")   as HTMLAnchorElement).innerHTML += this.feedbackEMail[0];
        }

        if (this.feedbackHotline && this.feedbackHotline.length == 2)
        {
            (this.feedbackMethodsDiv.querySelector("#hotline") as HTMLAnchorElement).href       = "tel:" + this.feedbackHotline[0];
            (this.feedbackMethodsDiv.querySelector("#hotline") as HTMLAnchorElement).innerHTML += this.feedbackHotline[1];
        }

        //#endregion

        //#region The Issue tracker

        this.showPrivacyStatement.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.privacyStatement.style.display = "block";
            this.issueTrackerText.scrollTop = this.issueTrackerText.scrollHeight;
        }

        this.privacyStatementAccepted.onchange = (ev: Event) => {
            this.sendIssueButton.disabled  = !this.privacyStatementAccepted.checked;
        }

        this.sendIssueButton.onclick = (ev: MouseEvent) => {

            ev.preventDefault();

            try
            {

                //#region Collect issue data...

                const newIssueForm  = document.getElementById('newIssueForm') as HTMLFormElement;
                let   data          = {};

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
                    try
                    {

                        const stringify  = require('safe-stable-stringify');
                        const ctr        = stringify(this.chargy.currentCTR);

                        if (ctr !== "{}")
                            data["chargeTransparencyRecord"] = ctr;

                    }
                    catch (exception)
                    { }
                }

                data["name"]                       = (newIssueForm.querySelector("#issueName")                 as HTMLInputElement).value;
                data["phone"]                      = (newIssueForm.querySelector("#issuePhone")                as HTMLInputElement).value;
                data["eMail"]                      = (newIssueForm.querySelector("#issueEMail")                as HTMLInputElement).value;

                //#endregion

                //#region Send issue to API

                let sendIssue = new XMLHttpRequest();

                sendIssue.open("ADD",
                               this.issueURL,
                               true);
                sendIssue.setRequestHeader('Content-type', 'application/json');

                sendIssue.onreadystatechange = function () {

                    // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
                    if (this.readyState == 4) {

                        if (this.status == 201) { // HTTP 201 - Created
                            (document.getElementById('issueTracker') as HTMLDivElement).style.display  = 'none';
                            //ToDo: Show thank you for your issue!
                        }

                        else
                        {
                            alert("Leider ist ein Fehler bei der Datenübertragung aufgetreten. Bitte probieren Sie es erneut!");
                        }

                    }

                }

                sendIssue.send(JSON.stringify(data));

                //#endregion

            }
            catch (exception)
            {
                alert("Leider ist ein Fehler bei der Datenübertragung aufgetreten. Bitte probieren Sie es erneut!");
            }

        }

        this.issueBackButton.onclick = (ev: MouseEvent) => {
            this.issueTrackerDiv.style.display = 'none';
        }

        //#endregion


        //#region Calculate application hash

        const appFileNames  = this.ipcRenderer.sendSync('getAppFileNames') ?? [];

        if (Array.isArray(appFileNames) && appFileNames[0] !== "" && appFileNames[1] !== "")
        {
            this.calcApplicationHash(appFileNames[0],
                                     appFileNames[1],
                                     applicationHash => { 
                                         this.applicationHash                          = applicationHash;
                                         this.applicationHashValueDiv.innerHTML        = applicationHash.match(/.{1,8}/g)?.join(" ") ?? "";
                                     },
                                     errorMessage => {
                                         this.applicationHashValueDiv.style.fontStyle  = "italics";
                                         this.applicationHashValueDiv.innerHTML        = errorMessage;
                                     });
        }

        else
            this.applicationHashValueDiv.innerHTML = "Kann nicht berechnet werden!";

        //#endregion

        //#region Get list of Chargy versions

        let GetListOfVersions = new XMLHttpRequest();
        GetListOfVersions.open("GET",
                               this.versionsURL,
                               true);
        GetListOfVersions.setRequestHeader('Accept', 'application/json');

        GetListOfVersions.onreadystatechange = () => {

            // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
            if (GetListOfVersions.readyState == 4) {
                if (GetListOfVersions.status == 200) { // HTTP 200 - OK

                    try
                    {

                        const versionsDiv = this.updateAvailableScreen.querySelector("#versions") as HTMLDivElement;
                        if (versionsDiv != null)
                        {

                            this.currentAppInfos = JSON.parse(GetListOfVersions.responseText) as IVersions;

                            for (let version of this.currentAppInfos.versions)
                            {

                                const thisVersion    = this.appVersion.split('.');
                                const remoteVersion  = version.version.split('.');

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

                                    const versionDiv = versionsDiv.appendChild(document.createElement('div'));
                                    versionDiv.className = "version";

                                    const headlineDiv = versionDiv.appendChild(document.createElement('div'));
                                    headlineDiv.className = "headline";

                                    const versionnumberDiv = headlineDiv.appendChild(document.createElement('div'));
                                    versionnumberDiv.className = "versionnumber";
                                    versionnumberDiv.innerHTML = "Version " + version.version;

                                    const releaseDateDiv = headlineDiv.appendChild(document.createElement('div'));
                                    releaseDateDiv.className = "releaseDate";
                                    releaseDateDiv.innerHTML = parseUTC(version.releaseDate).format("ll");

                                    const descriptionDiv = versionDiv.appendChild(document.createElement('div'));
                                    descriptionDiv.className = "description";
                                    descriptionDiv.innerHTML = version.description["de"];

                                    const tagsDiv = versionDiv.appendChild(document.createElement('div'));
                                    tagsDiv.className = "tags";

                                    for (let tag of version.tags)
                                    {
                                        const tagDiv = tagsDiv.appendChild(document.createElement('div'));
                                        tagDiv.className = "tag";
                                        tagDiv.innerHTML = tag;
                                    }

                                    const packagesDiv = versionDiv.appendChild(document.createElement('div'));
                                    packagesDiv.className = "packages";

                                    for (let versionpackage of version.packages)
                                    {

                                        const packageDiv = packagesDiv.appendChild(document.createElement('div'));
                                        packageDiv.className = "package";

                                        const nameDiv = packageDiv.appendChild(document.createElement('div'));
                                        nameDiv.className = "name";
                                        nameDiv.innerHTML = versionpackage.name;

                                        if (versionpackage.description &&
                                            versionpackage.description["de"])
                                        {
                                            const descriptionDiv = packageDiv.appendChild(document.createElement('div'));
                                            descriptionDiv.className = "description";
                                            descriptionDiv.innerHTML = versionpackage.description["de"];
                                        }

                                        if (versionpackage.additionalInfo &&
                                            versionpackage.additionalInfo["de"])
                                        {
                                            const additionalInfoDiv = packageDiv.appendChild(document.createElement('div'));
                                            additionalInfoDiv.className = "additionalInfo";
                                            additionalInfoDiv.innerHTML = versionpackage.additionalInfo["de"];
                                        }


                                        const cryptoHashesDiv = packageDiv.appendChild(document.createElement('div'));
                                        cryptoHashesDiv.className = "cryptoHashes";

                                        for (let cryptoHash in versionpackage.cryptoHashes)
                                        {

                                            const cryptoHashDiv = cryptoHashesDiv.appendChild(document.createElement('div'));
                                            cryptoHashDiv.className = "cryptoHash";

                                            const cryptoHashNameDiv = cryptoHashDiv.appendChild(document.createElement('div'));
                                            cryptoHashNameDiv.className = "name";
                                            cryptoHashNameDiv.innerHTML = cryptoHash;

                                            let value = versionpackage.cryptoHashes[cryptoHash].replace(/\s+/g, '');

                                            if (value.startsWith("0x"))
                                                value = value.substring(2);

                                            const cryptoHashValueDiv = cryptoHashDiv.appendChild(document.createElement('div'));
                                            cryptoHashValueDiv.className = "value";
                                            cryptoHashValueDiv.innerHTML = value.match(/.{1,8}/g).join(" ");

                                        }


                                        const signaturesTextDiv = packageDiv.appendChild(document.createElement('div'));
                                        signaturesTextDiv.className = "signaturesText";
                                        signaturesTextDiv.innerHTML = "Die Authentizität diese Software wurde durch folgende digitale Signaturen bestätigt";

                                        const signaturesDiv = packageDiv.appendChild(document.createElement('div'));
                                        signaturesDiv.className = "signatures";

                                        for (let signature of versionpackage.signatures)
                                        {

                                            const signatureDiv = signaturesDiv.appendChild(document.createElement('div'));
                                            signatureDiv.className = "signature";

                                            const signatureCheckDiv = signatureDiv.appendChild(document.createElement('div'));
                                            signatureCheckDiv.className = "signatureCheck";
                                            signatureCheckDiv.innerHTML = "<i class=\"fas fa-question-circle fa-question-circle-orange\"></i>";

                                            const authorDiv = signatureDiv.appendChild(document.createElement('div'));
                                            authorDiv.className = "signer";
                                            authorDiv.innerHTML = signature.signer;

                                        }


                                        if (versionpackage.downloadURLs)
                                        {

                                            const downloadURLsTextDiv = packageDiv.appendChild(document.createElement('div'));
                                            downloadURLsTextDiv.className = "downloadURLsText";
                                            downloadURLsTextDiv.innerHTML = "Diese Software kann über folgende Weblinks runtergeladen werden";

                                            const downloadURLsDiv = packageDiv.appendChild(document.createElement('div'));
                                            downloadURLsDiv.className = "downloadURLs";

                                            for (let downloadURLName in versionpackage.downloadURLs)
                                            {
                                                const downloadURLDiv = downloadURLsDiv.appendChild(document.createElement('div'));
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

        GetListOfVersions.send();

        //#endregion

        //#region Verify application signatures




        //#endregion


        //#region Handle the 'Update available'-button

        this.updateAvailableButton.onclick = (ev: MouseEvent) => {
            this.updateAvailableScreen.style.display     = "block";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";
        }

        //#endregion

        //#region Handle the 'About'-button

        this.aboutButton.onclick = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "block";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";

            //#region Check application hash signatures, when given...

            if (this.currentAppInfos     != null &&
                this.currentVersionInfos != null &&
                this.currentPackage      != null &&
                this.applicationHash     != "")
            {

                let sigHeadDiv    = this.applicationHashDiv.children[2];
                let signaturesDiv = this.applicationHashDiv.children[3];

                // Bad hash value
                if (this.currentPackage.cryptoHashes.SHA512.replace("0x", "") !== this.applicationHash)
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
                            signatureDiv.innerHTML = this.checkApplicationHashSignature(this.currentAppInfos,
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

        //#region Handle the 'Full Screen'-button

        const d = document as any;
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

        //#region Handle the 'App Quit'-button

        this.appQuitButton.onclick = (ev: MouseEvent) => {
            window.close();
        }

        //#endregion


        //#region Handle the 'back'-button

        this.backButton.onclick  = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "none";
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

        //#region Handle the 'export'-button

        this.exportButton.onclick  = async (ev: MouseEvent) => {

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

        //#region Handle the 'Overlay Ok'-button

        this.overlayOkButton.onclick = (ev: MouseEvent) => {
            this.overlayDiv.style.display = 'none';
        }

        //#endregion


        //#region Modify external links to be opened in the external web browser

        const shell        = require('electron').shell;
        const linkButtons  = document.getElementsByClassName('linkButton') as HTMLCollectionOf<HTMLButtonElement>;
        for (let i = 0; i < linkButtons.length; i++) {

            const linkButton = linkButtons[i];

            linkButton.onclick = function (this: GlobalEventHandlers, ev: MouseEvent) {
                ev.preventDefault();
                const link = linkButton.attributes["href"].nodeValue;
                if (link.startsWith("http://") || link.startsWith("https://")) {
                    shell.openExternal(link);
                }
            }

        }

        //#endregion


        //#region Handle the 'fileInput'-button

        this.fileInput  = document.getElementById('fileInput')  as HTMLInputElement;
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

        this.inputDiv.addEventListener('dragenter', (event: DragEvent) => {
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)?.classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragover',  (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
            (event.currentTarget as HTMLDivElement)?.classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragleave', (event: DragEvent) => {
            (event.currentTarget as HTMLDivElement)?.classList.remove('over');
        }, false);

        this.inputDiv.addEventListener('drop',      (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)?.classList.remove('over');
            if (event.dataTransfer?.files != null)
                this.readFilesFromDisk(event.dataTransfer.files);
        }, false);

        //#endregion

        //#region Handle the 'paste'-button

        this.pasteButton.onclick = async (ev: MouseEvent)  => {
            await this.readClipboard();
        }

        //#endregion

        //#region Handle IPC message "receiveReadClipboard" (Ctrl+V)

        this.ipcRenderer.on('receiveReadClipboard', async (event:any) => {
            await this.readClipboard();
        });

        //#endregion

        //#region Handle 'Open file'-events...

        // e.g. on Mac OS X - when app is running
        this.ipcRenderer.on('receiveFileToOpen', (event:any, filename:string) => {
            this.readFileFromDisk(filename);
        });

        this.ipcRenderer.on('receiveFilesToOpen', (event:any, filenames:string[]) => {
            this.readFilesFromDisk(filenames);
        });

        //#endregion

        //#region Check command line parameters and 'Open this file with...'-events...

        // ToDo: This is a work around, as events from main.js seem to fire too early!

        // File to open on Mac OS X
        const filename = this.ipcRenderer.sendSync('getFileToOpen');
        if (filename !== "")
            this.readFileFromDisk(filename);


        // Open files sent via command line parameters
        const filteredcommandLineArguments = this.commandLineArguments.filter(parameter => !parameter.startsWith('-'));

        // Stupid workaround via setTimeout
        if (filteredcommandLineArguments.length > 0)
            setTimeout(() => this.readFilesFromDisk(filteredcommandLineArguments), 100);

        //#endregion

    }


    //#region doGlobalError(...)

    private doGlobalError(result:   ISessionCryptoResult,
                          context?: any)
    {

        let text = (result?.message ?? "Unbekannter Transparenzdatensatz!").trim();

        this.inputDiv.style.flexDirection            = "";
        this.inputInfosDiv.style.display             = 'flex';
        this.chargingSessionScreenDiv.style.display  = 'none';
        this.chargingSessionScreenDiv.innerHTML      = '';
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        // console.log(text);
        // console.log(context);

        this.ipcRenderer.sendSync('setVerificationResult', result);

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
            this.doGlobalError({
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Unbekannter Transparenzdatensatz!"
            });
        }
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


    //#region calcApplicationHash(...)

    private calcApplicationHash(filename1: string,
                                filename2: string,
                                onSuccess: (applicationHash: string) => void,
                                OnError:   (errorMessage:    string) => void)
    {

        const fs                       = require('original-fs');
        const sha512a                  = require('crypto').createHash('sha512');
        const stream1                  = fs.createReadStream(filename1);
        const applicationHashValueDiv  = this.applicationHashValueDiv;

        stream1.on('data', function(data: any) {
            sha512a.update(data)
        })

        stream1.on('error', function() {
            OnError("File '" + filename1 + "' not found!");
        })

        stream1.on('end', function() {

            const sha512b  = require('crypto').createHash('sha512');
            const stream2  = fs.createReadStream(filename2);

            stream2.on('data', function(data: any) {
                sha512b.update(data)
            })

            stream2.on('error', function() {
                OnError("File '" + filename2 + "' not found!");
            })

            stream2.on('end', function() {

                var sha512hash = require('crypto').createHash('sha512');
                sha512hash.update(sha512a.digest('hex'));
                sha512hash.update(sha512b.digest('hex'));

                onSuccess(sha512hash.digest('hex'));

            })

        })

    }

    //#endregion

    //#region checkApplicationHashSignature(...)

    private checkApplicationHashSignature(app:        any,
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
                        "cryptoHashValue":      this.applicationHash,

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
        {

            if (!this.ipcRenderer.sendSync('noGUI'))
                await this.showChargeTransparencyRecord(result);

            this.ipcRenderer.sendSync('setVerificationResult', result.chargingSessions?.map(session => session.verificationResult));

        }

        else
            this.doGlobalError(result ??
                               {
                                   status:   SessionVerificationResult.InvalidSessionFormat,
                                   message:  "Unbekannter Transparenzdatensatz!"
                               });

    }

    //#endregion

    //#region showChargeTransparencyRecord(CTR)

    private async showChargeTransparencyRecord(CTR: IChargeTransparencyRecord)
    {

        if (CTR == null)
            return;

        //#region Prepare View

        this.inputDiv.style.flexDirection            = "column";
        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "flex";
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

            const chargingSessionsDiv  = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            chargingSessionsDiv.id   = "chargingSessions";

            for (const chargingSession of CTR.chargingSessions)
            {

                const chargingSessionDiv    = CreateDiv(chargingSessionsDiv, "chargingSession");
                chargingSession.GUI         = chargingSessionDiv;
                chargingSessionDiv.onclick  = (ev: MouseEvent) => {

                    //#region Highlight the selected charging session...

                    var AllChargingSessionsDivs = document.getElementsByClassName("chargingSession");
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

                const tableDiv              = chargingSessionDiv.appendChild(document.createElement('div'));
                      tableDiv.className    = "table";

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


        //#region Show invalid data sets

        if (CTR.invalidDataSets && CTR.invalidDataSets.length > 0)
        {

            this.invalidDataSetsScreenDiv.style.display  = "flex";

            const headlineDiv       = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            headlineDiv.id          = "description";
            headlineDiv.innerHTML   = "Ungültige Datensätze";

            let invalidDataSetsDiv  = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            invalidDataSetsDiv.id   = "invalidDataSets";

            for (const invalidDataSet of CTR.invalidDataSets)
            {

                const result = invalidDataSet.result;

                if (IsASessionCryptoResult(result))
                {

                    const invalidDataSetDiv = CreateDiv(invalidDataSetsDiv, "invalidDataSet");

                    const filenameDiv = CreateDiv(invalidDataSetDiv, "row");
                    CreateDiv(filenameDiv, "key",   "Dateiname");
                    CreateDiv(filenameDiv, "value", invalidDataSet.name);

                    const resultDiv = CreateDiv(invalidDataSetDiv, "row");
                    CreateDiv(resultDiv,   "key",   "Fehler");
                    const valueDiv  = CreateDiv(resultDiv, "value");

                    if (result.message)
                        valueDiv.innerHTML  = result.message;

                    else
                        switch (result.status)
                        {

                            case SessionVerificationResult.InvalidSessionFormat:
                                valueDiv.innerHTML  = "Ungültiges Transparenzformat";
                                break;

                            default:
                                valueDiv.innerHTML  = result.status.toString();

                        }

                }

            }

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

                                case "kWh":
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

                                case "kWh":
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
                                        icon = '<i class="fas fa-times-circle"></i> Public Key nicht gefunden';
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
            this.doGlobalError({
                status:     SessionVerificationResult.InvalidSessionFormat,
                message:    "Ungültiger Transparenzdatensatz!",
                exception:  exception
            });
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

}
