/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import { Chargy }                       from '@open-charging-cloud/chargy-core'
import { readQRCodeTextFromImageData }  from '@open-charging-cloud/chargy-core'
import * as chargyInterfaces            from '@open-charging-cloud/chargy-core'
import * as chargeTransparencyRecord    from '@open-charging-cloud/chargy-core'
import * as chargeTransparencyLiveLink  from '@open-charging-cloud/chargy-core'
import * as publicKeyInfo               from '@open-charging-cloud/chargy-core'
import * as chargyLib                   from '@open-charging-cloud/chargy-core'
import { toSessionVerificationResults } from '@open-charging-cloud/chargy-core'
import Chart                            from 'chart.js/auto';
import type { Plugin, TooltipItem }     from 'chart.js';
import corePackageJson                  from '@open-charging-cloud/chargy-core/package.json'

import stringify                        from 'safe-stable-stringify';
import Decimal                          from 'decimal.js';
import * as elliptic                    from 'elliptic';
import moment                           from 'moment';
import base32Decode                     from 'base32-decode';
import * as asn1                        from 'asn1.js';
import * as L                           from 'leaflet';
import 'leaflet.awesome-markers';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../css/chargy.scss';


type DetectionResult = chargeTransparencyRecord.  IChargeTransparencyRecord   |
                       chargeTransparencyLiveLink.IChargeTransparencyLiveLink |
                       publicKeyInfo.             IPublicKeyInfo              |
                       chargyInterfaces.          ISessionCryptoResult;

type DetectionOptions = {
    prepareUI?: boolean;
    onError?:   (result: chargyInterfaces.ISessionCryptoResult) => void;
};

const supportedLanguages = [ "de", "en" ] as const;

type SupportedLanguage = typeof supportedLanguages[number];
type SessionWarning = chargyInterfaces.IWarning & {
    source?: string;
};
type MeasurementPhenomenon = {
    name?:         string;
    obis?:         string;
    unit?:         string;
    unitEncoded?:  number;
    valueType?:    string;
    scale?:        number;
};
type ChargingProgressChartMode = "energy" | "power";
type MeasurementValuesViewMode = "measurements" | ChargingProgressChartMode;
type ChargingProgressChart = Chart<'bar', number[]>;
type ChargingProgressChartPoint = {
    x:                   number;
    y:                   number;
    start:               number;
    end:                 number;
    intervalLabel:       string;
    isValidSignature:    boolean;
    signatureStatusText: string;
};
type ChargingProgressTickStatus = {
    timestamp:        number;
    isValidSignature: boolean;
};
type ChargingProgressChartData = {
    points:         ChargingProgressChartPoint[];
    tickTimestamps: number[];
    tickStatuses:   ChargingProgressTickStatus[];
    unit:           string;
    datasetLabel:   string;
    yAxisLabel:     string;
};

type DependencyMap = Record<string, string | undefined>;

const coreDependencies = corePackageJson.dependencies as DependencyMap | undefined;

function dependencyVersion(dependencies: DependencyMap | undefined, dependencyName: string): string {
    return (dependencies?.[dependencyName] ?? coreDependencies?.[dependencyName])?.replace(/[^\d.]/g, "") ?? "";
}

function getTextFromMultilanguageText(text: chargyInterfaces.IMultilanguageText | undefined | null,
                                      language: SupportedLanguage,
                                      fallback: string = ""): string {

    return text?.[language] ??
           text?.["en"]   ??
           text?.["de"]   ??
           Object.values(text ?? {}).find((value): value is string => typeof value === "string") ??
           fallback;

}

// function getFirstMeasurementPhenomenon(phenomena: unknown[] | undefined): MeasurementPhenomenon | undefined {

//     const phenomenon = phenomena?.[0];

//     if (typeof phenomenon !== "object" || phenomenon === null)
//         return undefined;

//     const record: Record<string, unknown> = phenomenon as Record<string, unknown>;
//     const result: MeasurementPhenomenon = {};

//     if (typeof record["name"]        === "string") result.name        = record["name"];
//     if (typeof record["obis"]        === "string") result.obis        = record["obis"];
//     if (typeof record["unit"]        === "string") result.unit        = record["unit"];
//     if (typeof record["unitEncoded"] === "number") result.unitEncoded = record["unitEncoded"];
//     if (typeof record["valueType"]   === "string") result.valueType   = record["valueType"];
//     if (typeof record["scale"]       === "number") result.scale       = record["scale"];

//     return result;

// }


interface ChargyElectronAPI {

    getAppContext(): {
        appEdition:             string;
        copyright:              string;
        commandLineArguments:   string[];
        packageJson:            any;
        i18n:                   chargyInterfaces.I18NDictionary;
        httpConfig:             [string, number];
        mapbox: {
            accessToken:            string;
            startGeoCoordinates:    [number, number];
            startMapZoom:           number;
        };
        fileToOpen:             string;
        isDebug:                boolean;
        noGUI:                  boolean;
        platform:               string;
        versions: {
            chrome?:                string;
            electron?:              string;
            node?:                  string;
            openssl?:               string;
        };
    };

    showSaveDialog():                                     Promise<string | undefined>;
    writeTextFile(fileName: string, content: string):     Promise<boolean>;
    readFile(fileName: string):                           Promise<ArrayBuffer>;
    readClipboardText():                                  Promise<string>;
    readClipboardImage():                                 Promise<ArrayBuffer | null>;
    calculateApplicationHash():                           Promise<string>;
    openExternal(url: string):                            Promise<boolean>;
    completeHttpRequest(requestId: string, result: any):  void;
    setVerificationResult(result: any):                   boolean;

    on(channel: 'receiveReadClipboard', listener: ()                              => void): () => void;
    on(channel: 'receiveFileToOpen',    listener: (filename:  string)             => void): () => void;
    on(channel: 'receiveFilesToOpen',   listener: (filenames: string[])           => void): () => void;
    on(channel: 'receiveHttpRequest',   listener: (request:   ChargyHttpRequest)  => void): () => void;

}

interface ChargyHttpRequest {
    id:             string;
    operation:      'verify' | 'convert';
    pretty:         boolean;
    contentType?:   string;
    data:           ArrayBuffer;
}

declare global {
    interface Window {
        chargyElectron: ChargyElectronAPI;
    }
}

export class ChargyApp {

    //#region Data

    private readonly map:                                L.Map;

    private readonly elliptic:                           typeof elliptic;
    private readonly moment:                             typeof moment;
    private readonly chargy:                             Chargy;
    private readonly asn1:                               typeof asn1;
    private readonly base32Decode:                       typeof base32Decode;

    public           appEdition:                         string                            = "";
    public           copyright:                          string                            = "";
    public           versionsURL:                        string                            = "";
    public           defaultFeedbackEMail:               string[]                          = [];
    public           defaultFeedbackHotline:             string[]                          = [];
    public           defaultIssueURL:                    string                            = "";
    public           packageJson:                        any                               = {};
    public           i18n:                               chargyInterfaces.I18NDictionary   = {};
    public           UILanguage:                         SupportedLanguage                 = "en";

    private readonly electron:                           ChargyElectronAPI                 = window.chargyElectron;
    private readonly appContext:                         ReturnType<ChargyElectronAPI["getAppContext"]>;
    private readonly commandLineArguments:               Array<string>                     = [];
    private readonly platform:                           string                            = "";

    private          currentAppInfos:                    any                               = null;
    private          currentVersionInfos:                any                               = null;
    private          currentPackage:                     any                               = null;
    private          applicationHash:                    string                            = "";

    private readonly markers:                            any                               = [];
    private          minlat:                             number                            =  1000;
    private          maxlat:                             number                            = -1000;
    private          minlng:                             number                            =  1000;
    private          maxlng:                             number                            = -1000;

    private readonly chargingSessionCharts:              ChargingProgressChart[]           = [];
    private          measurementValuesViewMode:          MeasurementValuesViewMode         = "measurements";

    private readonly appDiv:                             HTMLDivElement;
    private readonly headlineDiv:                        HTMLDivElement;
    private readonly verifyframeDiv:                     HTMLDivElement;

    private readonly languageButton:                     HTMLButtonElement;
    private readonly languageMenuDiv:                    HTMLDivElement;
    private readonly languageFlagImage:                  HTMLImageElement;
    private readonly updateAvailableButton:              HTMLButtonElement;
    private readonly aboutButton:                        HTMLButtonElement;
    private readonly fullScreenButton:                   HTMLButtonElement;
    private readonly appQuitButton:                      HTMLButtonElement;

    private readonly updateAvailableScreen:              HTMLDivElement;
    private readonly inputDiv:                           HTMLDivElement;
    private readonly inputInfosDiv:                      HTMLDivElement;
    private readonly aboutScreenDiv:                     HTMLDivElement;
    private readonly applicationHashDiv:                 HTMLDivElement;
    private readonly applicationHashValueDiv:            HTMLDivElement;
    private readonly softwareInfosDiv:                   HTMLDivElement;
    private readonly openSourceLibsDiv:                  HTMLDivElement;
    private readonly chargingSessionScreenDiv:           HTMLDivElement;
    private readonly invalidDataSetsScreenDiv:           HTMLDivElement;
    private readonly inputButtonsDiv:                    HTMLDivElement;
    private readonly backButton:                         HTMLButtonElement;
    private readonly exportButtonDiv:                    HTMLDivElement;
    private readonly exportButton:                       HTMLButtonElement;
    private readonly fileInputButton:                    HTMLButtonElement;
    private readonly fileInput:                          HTMLInputElement;
    private readonly qrScanButton:                       HTMLButtonElement;
    private readonly pasteButton:                        HTMLButtonElement;
    private readonly detailedInfosDiv:                   HTMLDivElement;
    private readonly errorTextDiv:                       HTMLDivElement;
    private readonly feedbackDiv:                        HTMLDivElement;

    private readonly showFeedbackSection:                boolean;
    private readonly feedbackMethodsDiv:                 HTMLDivElement;
    private readonly feedbackEMailAnchor:                HTMLAnchorElement;
    private readonly feedbackHotlineAnchor:              HTMLAnchorElement;
    private readonly showIssueTrackerButton:             HTMLButtonElement;
    private readonly issueTrackerText:                   HTMLDivElement;

    private readonly chargingTariffDetailsDiv:           HTMLDivElement;
    private readonly chargingTariffDetailsLeftButton:    HTMLButtonElement;

    private readonly chargingPeriodDetailsDiv:           HTMLDivElement;
    private readonly chargingPeriodDetailsLeftButton:    HTMLButtonElement;

    private readonly measurementsDetailsDiv:             HTMLDivElement;
    private readonly measurementsDetailsLeftButton:      HTMLButtonElement;

    private readonly issueTrackerDiv:                    HTMLDivElement;
    private readonly issueTrackerLeftButton:             HTMLButtonElement;
    private readonly privacyStatement:                   HTMLDivElement;
    private readonly showPrivacyStatement:               HTMLButtonElement;
    private readonly privacyStatementAccepted:           HTMLInputElement;
    private readonly sendIssueButton:                    HTMLButtonElement;

    private readonly pkiDetailsDiv:                      HTMLDivElement;
    private readonly pkiDetailsLeftButton:               HTMLButtonElement;

    private readonly qrCodeScannerDiv:                   HTMLDivElement;
    private readonly qrCodeScannerVideo:                 HTMLVideoElement;
    private readonly qrCodeScannerCanvas:                HTMLCanvasElement;
    private readonly qrCodeScannerStatusDiv:             HTMLDivElement;
    private readonly qrCodeScannerErrorDiv:              HTMLDivElement;
    private readonly qrCodeScannerResultDiv:             HTMLDivElement;
    private readonly qrCodeScannerResultText:            HTMLPreElement;
    private readonly qrCodeScannerURLActionsDiv:         HTMLDivElement;
    private readonly qrCodeScannerOpenURLButton:         HTMLButtonElement;
    private readonly qrCodeScannerRescanButton:          HTMLButtonElement;
    private readonly qrCodeScannerCancelButton:          HTMLButtonElement;
    private qrCodeScannerStream:                MediaStream|null     = null;
    private qrCodeScannerAnimationFrame:        number|null          = null;
    private qrCodeScannerIsProcessing:          boolean              = false;
    private qrCodeScannerLastText:              string|null          = null;
    private qrCodeScannerLastURL:               URL|null             = null;

    private currentChargeTransparencyRecord:    chargeTransparencyRecord.IChargeTransparencyRecord|null = null;
    private currentChargeTransparencyLiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink|null = null;
    private currentGlobalError:                 chargyInterfaces.ISessionCryptoResult|null = null;

    //#endregion

    constructor(versionsURL?:          string,
                showFeedbackSection?:  boolean,
                feedbackEMail?:        string[],
                feedbackHotline?:      string[],
                issueURL?:             string) {

        //#region Set parameters

        this.appContext                               = this.electron.getAppContext();
        this.versionsURL                              = versionsURL         ?? "https://chargy.charging.cloud/apps/desktop/versions";
        this.showFeedbackSection                      = showFeedbackSection ?? false;
        this.defaultFeedbackEMail                     = feedbackEMail       ?? [];
        this.defaultFeedbackHotline                   = feedbackHotline     ?? [];
        this.defaultIssueURL                          = issueURL            ?? "";
        this.UILanguage                               = this.getInitialUILanguage();

        //#endregion

        //#region Load JavaScript libraries

        this.elliptic                                 = elliptic;
        this.moment                                   = moment;
        this.asn1                                     = asn1;
        this.base32Decode                             = base32Decode;

        //#endregion

        //#region Set up the GUI

        this.appDiv                                   = document.getElementById('app')                                      as HTMLDivElement;
        this.headlineDiv                              = document.getElementById('headline')                                 as HTMLDivElement;
        this.verifyframeDiv                           = document.getElementById('verifyframe')                              as HTMLDivElement;

        this.updateAvailableScreen                    = document.getElementById('updateAvailableScreen')                    as HTMLDivElement;
        this.chargingSessionScreenDiv                 = document.getElementById('chargingSessionScreen')                    as HTMLDivElement;
        this.invalidDataSetsScreenDiv                 = document.getElementById('invalidDataSetsScreen')                    as HTMLDivElement;
        this.detailedInfosDiv                         = document.getElementById('detailedInfos')                            as HTMLDivElement;
        this.inputDiv                                 = document.getElementById('input')                                    as HTMLDivElement;
        this.inputInfosDiv                            = document.getElementById('inputInfos')                               as HTMLDivElement;
        this.errorTextDiv                             = document.getElementById('errorText')                                as HTMLDivElement;

        this.applicationHashDiv                       = document.getElementById('applicationHash')                          as HTMLDivElement;
        this.applicationHashValueDiv                  = this.applicationHashDiv.querySelector("#value")                     as HTMLDivElement;

        this.feedbackDiv                              = document.getElementById('feedback')                                 as HTMLDivElement;
        this.feedbackMethodsDiv                       = this.feedbackDiv.       querySelector("#feedbackMethods")           as HTMLDivElement;
        this.showIssueTrackerButton                   = this.feedbackMethodsDiv.querySelector("#showIssueTracker")          as HTMLButtonElement;
        this.feedbackEMailAnchor                      = this.feedbackMethodsDiv.querySelector("#eMail")                     as HTMLAnchorElement;
        this.feedbackHotlineAnchor                    = this.feedbackMethodsDiv.querySelector("#hotline")                   as HTMLAnchorElement;

        this.aboutScreenDiv                           = document.getElementById('aboutScreen')                              as HTMLDivElement;
        this.softwareInfosDiv                         = this.aboutScreenDiv.    querySelector("#softwareInfos")             as HTMLDivElement;
        this.openSourceLibsDiv                        = this.aboutScreenDiv.    querySelector("#openSourceLibs")            as HTMLDivElement;

        this.languageButton                           = document.getElementById('languageButton')                           as HTMLButtonElement;
        this.languageMenuDiv                          = document.getElementById('languageMenu')                             as HTMLDivElement;
        this.languageFlagImage                        = document.getElementById('languageFlag')                             as HTMLImageElement;
        this.updateAvailableButton                    = document.getElementById('updateAvailableButton')                    as HTMLButtonElement;
        this.aboutButton                              = document.getElementById('aboutButton')                              as HTMLButtonElement;
        this.fullScreenButton                         = document.getElementById('fullScreenButton')                         as HTMLButtonElement;
        this.appQuitButton                            = document.getElementById('appQuitButton')                            as HTMLButtonElement;

        this.chargingTariffDetailsDiv                 = document.getElementById('chargingTariffDetails')                    as HTMLDivElement;
        this.chargingTariffDetailsLeftButton          = this.chargingTariffDetailsDiv.querySelector(".overlayLeftButton")   as HTMLButtonElement;
        this.chargingTariffDetailsLeftButton.onclick  = () => {
                                                            this.chargingTariffDetailsDiv.style.display = 'none';
                                                        }

        this.chargingPeriodDetailsDiv                 = document.getElementById('chargingPeriodDetails')                    as HTMLDivElement;
        this.chargingPeriodDetailsLeftButton          = this.chargingPeriodDetailsDiv.querySelector(".overlayLeftButton")   as HTMLButtonElement;
        this.chargingPeriodDetailsLeftButton.onclick  = () => {
                                                            this.chargingPeriodDetailsDiv.style.display = 'none';
                                                        }

        this.measurementsDetailsDiv                   = document.getElementById('measurementsDetails')                      as HTMLDivElement;
        this.measurementsDetailsLeftButton            = this.measurementsDetailsDiv.querySelector(".overlayLeftButton")     as HTMLButtonElement;
        this.measurementsDetailsLeftButton.onclick    = () => {
                                                            this.measurementsDetailsDiv.style.display = 'none';
                                                        }

        this.issueTrackerDiv                          = document.getElementById('issueTracker')                             as HTMLDivElement;
        this.issueTrackerText                         = this.issueTrackerDiv.   querySelector(".overlayText")               as HTMLDivElement;
        this.privacyStatement                         = this.issueTrackerDiv.   querySelector("#privacyStatement")          as HTMLDivElement;
        this.showPrivacyStatement                     = this.issueTrackerDiv.   querySelector("#showPrivacyStatement")      as HTMLButtonElement;
        this.privacyStatementAccepted                 = this.issueTrackerDiv.   querySelector("#privacyStatementAccepted")  as HTMLInputElement;
        this.sendIssueButton                          = this.issueTrackerDiv.   querySelector("#sendIssueButton")           as HTMLButtonElement;
        this.issueTrackerLeftButton                   = this.issueTrackerDiv.   querySelector(".overlayLeftButton")         as HTMLButtonElement;
        this.issueTrackerLeftButton.onclick           = () => {
                                                            this.issueTrackerDiv.style.display = 'none';
                                                        }

        this.pkiDetailsDiv                            = document.getElementById('pkiDetails')                               as HTMLDivElement;
        this.pkiDetailsLeftButton                     = this.pkiDetailsDiv.querySelector(".overlayLeftButton")              as HTMLButtonElement;
        this.pkiDetailsLeftButton.onclick             = () => {
                                                            this.pkiDetailsDiv.style.display = 'none';
                                                        }

        this.fileInputButton                          = document.getElementById('fileInputButton')                          as HTMLButtonElement;
        this.qrScanButton                             = document.getElementById('qrScanButton')                             as HTMLButtonElement;
        this.pasteButton                              = document.getElementById('pasteButton')                              as HTMLButtonElement;

        this.qrCodeScannerDiv                         = document.getElementById('qrCodeScanner')                            as HTMLDivElement;
        this.qrCodeScannerVideo                       = this.qrCodeScannerDiv.querySelector("#qrCodeScannerVideo")          as HTMLVideoElement;
        this.qrCodeScannerCanvas                      = this.qrCodeScannerDiv.querySelector("#qrCodeScannerCanvas")         as HTMLCanvasElement;
        this.qrCodeScannerStatusDiv                   = this.qrCodeScannerDiv.querySelector("#qrCodeScannerStatus")         as HTMLDivElement;
        this.qrCodeScannerErrorDiv                    = this.qrCodeScannerDiv.querySelector(".headline .error")             as HTMLDivElement;
        this.qrCodeScannerResultDiv                   = this.qrCodeScannerDiv.querySelector("#qrCodeScannerResult")         as HTMLDivElement;
        this.qrCodeScannerResultText                  = this.qrCodeScannerDiv.querySelector("#qrCodeScannerResultText")     as HTMLPreElement;
        this.qrCodeScannerURLActionsDiv               = this.qrCodeScannerDiv.querySelector("#qrCodeScannerURLActions")     as HTMLDivElement;
        this.qrCodeScannerOpenURLButton               = this.qrCodeScannerDiv.querySelector("#qrCodeScannerOpenURLButton")  as HTMLButtonElement;
        this.qrCodeScannerRescanButton                = this.qrCodeScannerDiv.querySelector("#qrCodeScannerRescanButton")   as HTMLButtonElement;
        this.qrCodeScannerCancelButton                = this.qrCodeScannerDiv.querySelector(".overlayLeftButton")           as HTMLButtonElement;

        this.inputButtonsDiv                          = document.getElementById('inputButtons')                             as HTMLDivElement;
        this.backButton                               = this.inputButtonsDiv.   querySelector("#backButton")                as HTMLButtonElement;

        this.exportButtonDiv                          = document.getElementById('exportButtonDiv')                          as HTMLDivElement;
        this.exportButton                             = this.exportButtonDiv.   querySelector("#exportButton")              as HTMLButtonElement;

        //#endregion

        //#region IPC

        this.appEdition                               = this.appContext.appEdition ?? "";
        this.copyright                                = this.appContext.copyright  ?? "&copy; 2018-2026 GraphDefined GmbH";

        this.commandLineArguments                     = this.appContext.commandLineArguments;
        this.packageJson                              = this.appContext.packageJson;
        this.i18n                                     = this.appContext.i18n;
        this.platform                                 = this.appContext.platform;

        //#endregion

        this.chargy                                   = new Chargy(
                                                            this.i18n,
                                                            [ this.UILanguage ],
                                                            this.elliptic,
                                                            this.moment,
                                                            this.asn1,
                                                            this.base32Decode,
                                                            this.showPKIDetails.bind(this)
                                                        );


        this.setUILanguage(this.UILanguage, false);
        this.setupLanguageSelector();


        //#region OnWindowResize

        window.onresize = () => {
            this.verifyframeDiv.style.maxHeight = (this.appDiv.clientHeight - this.headlineDiv.clientHeight).toString() + "px";
        }

        // Call it once on application start
        window.dispatchEvent(new Event("resize"));

        //#endregion

        //#region Set infos of the about section

            (this.softwareInfosDiv. querySelector("#appEdition")             as HTMLSpanElement).innerHTML = this.appEdition;
            (this.softwareInfosDiv. querySelector("#appVersion")             as HTMLSpanElement).innerHTML = this.packageJson.version;
            (this.softwareInfosDiv. querySelector("#copyright")              as HTMLSpanElement).innerHTML = this.copyright;

            (this.openSourceLibsDiv.querySelector("#chargyVersion")          as HTMLSpanElement).innerHTML = this.packageJson.version;
            (this.openSourceLibsDiv.querySelector("#electronVersion")        as HTMLSpanElement).innerHTML = this.appContext.versions.electron ?? "";
            (this.openSourceLibsDiv.querySelector("#chromiumVersion")        as HTMLSpanElement).innerHTML = this.appContext.versions.chrome   ?? "";
            (this.openSourceLibsDiv.querySelector("#nodeVersion")            as HTMLSpanElement).innerHTML = this.appContext.versions.node     ?? "";
            (this.openSourceLibsDiv.querySelector("#opensslVersion")         as HTMLSpanElement).innerHTML = this.appContext.versions.openssl  ?? "";

        const devDependencies = this.packageJson.devDependencies as DependencyMap | undefined;
        const dependencies    = this.packageJson.dependencies    as DependencyMap | undefined;

        if (devDependencies)
        {
            (this.openSourceLibsDiv.querySelector("#electronBuilder")        as HTMLSpanElement).innerHTML = dependencyVersion(devDependencies, "electron-builder");
            (this.openSourceLibsDiv.querySelector("#electronLocalShortcut")  as HTMLSpanElement).innerHTML = dependencyVersion(devDependencies, "electron-localshortcut");
            (this.openSourceLibsDiv.querySelector("#SASS")                   as HTMLSpanElement).innerHTML = dependencyVersion(devDependencies, "sass");
            (this.openSourceLibsDiv.querySelector("#typeScript")             as HTMLSpanElement).innerHTML = dependencyVersion(devDependencies, "typescript");
            (this.openSourceLibsDiv.querySelector("#webpack")                as HTMLSpanElement).innerHTML = dependencyVersion(devDependencies, "webpack");
        }

        if (dependencies)
        {
            (this.openSourceLibsDiv.querySelector("#chargyCore")             as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "@open-charging-cloud/chargy-core");
            (this.openSourceLibsDiv.querySelector("#openChargingCloudTOTP")  as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "@open-charging-cloud/totp");
            (this.openSourceLibsDiv.querySelector("#elliptic")               as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "elliptic");
            (this.openSourceLibsDiv.querySelector("#momentJS")               as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "moment");
            (this.openSourceLibsDiv.querySelector("#pdfjsdist")              as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "pdfjs-dist");
            (this.openSourceLibsDiv.querySelector("#seekBzip")               as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "seek-bzip");
            (this.openSourceLibsDiv.querySelector("#fileType")               as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "file-type");
            (this.openSourceLibsDiv.querySelector("#jsQR")                   as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "jsqr");
            (this.openSourceLibsDiv.querySelector("#buffer")                 as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "buffer");
            (this.openSourceLibsDiv.querySelector("#fontAwesome")            as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "@fortawesome/fontawesome-free");
            (this.openSourceLibsDiv.querySelector("#asn1JS")                 as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "asn1.js");
            (this.openSourceLibsDiv.querySelector("#base32Decode")           as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "base32-decode");
            (this.openSourceLibsDiv.querySelector("#safeStableStringify")    as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "safe-stable-stringify");
            (this.openSourceLibsDiv.querySelector("#leafletJS")              as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "leaflet");
            (this.openSourceLibsDiv.querySelector("#leafletAwesomeMarkers")  as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "leaflet.awesome-markers");
            (this.openSourceLibsDiv.querySelector("#decimalJS")              as HTMLSpanElement).innerHTML = dependencyVersion(dependencies, "decimal.js");
        }

        //#endregion

        //#region Set infos of the feedback section

        this.UpdateFeedbackSection();

        //#endregion

        //#region The Issue tracker

        this.showPrivacyStatement.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.privacyStatement.style.display = "block";
            this.issueTrackerText.scrollTop = this.issueTrackerText.scrollHeight;
        }

        this.privacyStatementAccepted.onchange = () => {
            this.sendIssueButton.disabled  = !this.privacyStatementAccepted.checked;
        }

        this.sendIssueButton.onclick = (ev: MouseEvent) => {

            ev.preventDefault();

            try
            {

                //#region Collect issue data...

                const newIssueForm = document.getElementById('newIssueForm') as HTMLFormElement;

                const queryRequired = (selector: string): Element => {

                    const element = newIssueForm.querySelector(selector);

                    if (element == null)
                        throw new Error("Missing issue form element: " + selector);

                    return element;

                };

                const queryInput = (selector: string): HTMLInputElement => {

                    const element = queryRequired(selector);

                    if (!(element instanceof HTMLInputElement))
                        throw new Error("Issue form element is not an input: " + selector);

                    return element;

                };

                const querySelect = (selector: string): HTMLSelectElement => {

                    const element = queryRequired(selector);

                    if (!(element instanceof HTMLSelectElement))
                        throw new Error("Issue form element is not a select: " + selector);

                    return element;

                };

                const queryTextArea = (selector: string): HTMLTextAreaElement => {

                    const element = queryRequired(selector);

                    if (!(element instanceof HTMLTextAreaElement))
                        throw new Error("Issue form element is not a textarea: " + selector);

                    return element;

                };

                const packageJson = this.packageJson as { version?: unknown };
                const data: chargyInterfaces.IssueReportPayload = {
                    timestamp:                  new Date().toISOString(),
                    chargyVersion:              typeof packageJson.version === "string" ? packageJson.version : "",
                    platform:                   process.platform,
                    invalidCTR:                 queryInput("#invalidCTR").checked,
                    InvalidStationData:         queryInput("#InvalidStationData").checked,
                    invalidSignatures:          queryInput("#invalidSignatures").checked,
                    invalidCertificates:        queryInput("#invalidCertificates").checked,
                    transparencenySoftwareBug:  queryInput("#transparencenySoftwareBug").checked,
                    DSGVO:                      queryInput("#DSGVO").checked,
                    BITV:                       queryInput("#BITV").checked,
                    description:                queryTextArea("#issueDescription").value,
                    name:                       queryInput("#issueName").value,
                    phone:                      queryInput("#issuePhone").value,
                    eMail:                      queryInput("#issueEMail").value
                };

                if (querySelect("#includeCTR").value == "yes")
                {
                    try
                    {

                        const ctr = this.getChargeTransparencyRecordExportJSON();

                        if (ctr !== "{}")
                            data["chargeTransparencyRecord"] = ctr;

                    }
                    catch
                    {
                        // Optional diagnostic attachment; the issue report itself can still be sent.
                    }
                }

                //#endregion

                //#region Send issue to API

                const sendIssue = new XMLHttpRequest();

                sendIssue.open("SUBMIT",
                               this.defaultIssueURL,
                               true);
                sendIssue.setRequestHeader('Content-type', 'application/json');

                sendIssue.onreadystatechange = () => {

                    // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
                    if (sendIssue.readyState == 4) {

                        if (sendIssue.status == 201) { // HTTP 201 - Created
                            (document.getElementById('issueTracker') as HTMLDivElement).style.display  = 'none';
                            //ToDo: Show thank you for your issue!
                        }

                        else
                        {
                            alert(this.chargy.GetLocalizedMessage("issueSubmitFailed"));
                        }

                    }

                }

                sendIssue.send(JSON.stringify(data));

                //#endregion

            }
            catch (exception)
            {
                alert(this.chargy.GetLocalizedMessage("issueSubmitFailed") + ": " + (exception instanceof Error ? exception.message : String(exception)));
            }

        }

        //#endregion


        //#region Calculate application hash

        this.electron.calculateApplicationHash()
            .then(applicationHash => {
                if (applicationHash !== "")
                {
                    this.applicationHash                          = applicationHash;
                    this.applicationHashValueDiv.innerHTML        = applicationHash.match(/.{1,8}/g)?.join(" ") ?? "";
                }
                else
                    this.applicationHashValueDiv.innerHTML        = "Kann nicht berechnet werden!";
            })
            .catch(error => {
                this.applicationHashValueDiv.style.fontStyle      = "italic";
                this.applicationHashValueDiv.innerHTML            = error instanceof Error ? error.message : String(error);
            });

        //#endregion

        //#region Get list of Chargy versions

        const GetListOfVersions = new XMLHttpRequest();
        GetListOfVersions.open("GET",
                               this.versionsURL,
                               true);
        GetListOfVersions.setRequestHeader('Accept', 'application/json');

        GetListOfVersions.onerror = function() {
            //console.error('Network error');
        };

        GetListOfVersions.onreadystatechange = () => {

            // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
            if (GetListOfVersions.readyState === XMLHttpRequest.DONE) {
                switch (GetListOfVersions.status)
                {

                    case 200: // HTTP 200 - OK
                        try
                        {

                            const versionsDiv = this.updateAvailableScreen.querySelector("#versions") as HTMLDivElement;
                            if (versionsDiv != null)
                            {

                                this.currentAppInfos = JSON.parse(GetListOfVersions.responseText) as chargyInterfaces.IVersions;

                                for (const version of this.currentAppInfos.versions)
                                {

                                    const thisVersion    = this.packageJson.version.split('.');
                                    const remoteVersion  = version.version.split('.');

                                    //#region Find current version package

                                    if (remoteVersion[0] == thisVersion[0] &&
                                        remoteVersion[1] == thisVersion[1] &&
                                        remoteVersion[2] == thisVersion[2])
                                    {

                                        this.currentVersionInfos = version;

                                        if (this.currentVersionInfos.packages && this.currentVersionInfos.packages.length > 0)
                                        {
                                            for (const _package of this.currentVersionInfos.packages)
                                            {
                                                if (_package.isInstaller == null &&
                                                    (_package.platform === this.platform ||
                                                    (_package.platforms != null && Array.isArray(_package.platforms) && _package.platforms.indexOf(this.platform) > -1)))
                                                {
                                                    this.currentPackage = _package;
                                                }
                                            }
                                        }

                                    }

                                    //#endregion

                                    //#region Find newer/updated version

                                    else if (remoteVersion[0] >  thisVersion[0]! ||
                                            (remoteVersion[0] >= thisVersion[0]! && remoteVersion[1] >  thisVersion[1]!) ||
                                            (remoteVersion[0] >= thisVersion[0]! && remoteVersion[1] >= thisVersion[1]! && remoteVersion[2] > thisVersion[2]!))
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
                                        releaseDateDiv.innerHTML = chargyLib.parseUTC(version.releaseDate).format("ll");

                                        const descriptionDiv = versionDiv.appendChild(document.createElement('div'));
                                        descriptionDiv.className = "description";
                                        descriptionDiv.innerHTML = version.description["de"];

                                        const tagsDiv = versionDiv.appendChild(document.createElement('div'));
                                        tagsDiv.className = "tags";

                                        for (const tag of version.tags)
                                        {
                                            const tagDiv = tagsDiv.appendChild(document.createElement('div'));
                                            tagDiv.className = "tag";
                                            tagDiv.innerHTML = tag;
                                        }

                                        const packagesDiv = versionDiv.appendChild(document.createElement('div'));
                                        packagesDiv.className = "packages";

                                        for (const versionpackage of version.packages)
                                        {

                                            const packageDiv = packagesDiv.appendChild(document.createElement('div'));
                                            packageDiv.className = "package";

                                            const nameDiv = packageDiv.appendChild(document.createElement('div'));
                                            nameDiv.className = "name";
                                            nameDiv.innerHTML = versionpackage.name;

                                            if (versionpackage.description?.["de"])
                                            {
                                                const descriptionDiv = packageDiv.appendChild(document.createElement('div'));
                                                descriptionDiv.className = "description";
                                                descriptionDiv.innerHTML = versionpackage.description["de"];
                                            }

                                            if (versionpackage.additionalInfo?.["de"])
                                            {
                                                const additionalInfoDiv = packageDiv.appendChild(document.createElement('div'));
                                                additionalInfoDiv.className = "additionalInfo";
                                                additionalInfoDiv.innerHTML = versionpackage.additionalInfo["de"];
                                            }


                                            const cryptoHashesDiv = packageDiv.appendChild(document.createElement('div'));
                                            cryptoHashesDiv.className = "cryptoHashes";

                                            for (const cryptoHash in versionpackage.cryptoHashes)
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

                                            for (const signature of versionpackage.signatures)
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

                                                for (const downloadURLName in versionpackage.downloadURLs)
                                                {
                                                    const downloadURLDiv = downloadURLsDiv.appendChild(document.createElement('div'));
                                                    downloadURLDiv.className = "downloadURL";

                                                    const downloadURLAnchor = downloadURLDiv.appendChild(document.createElement('a'));
                                                    downloadURLAnchor.href = "#";
                                                    downloadURLAnchor.title = versionpackage.downloadURLs[downloadURLName];
                                                    downloadURLAnchor.dataset["externalUrl"] = versionpackage.downloadURLs[downloadURLName];
                                                    downloadURLAnchor.innerHTML = "<i class=\"fas fa-globe\"></i>" + downloadURLName;
                                                    downloadURLAnchor.onclick = (ev: MouseEvent) => {
                                                        ev.preventDefault();
                                                        const link = downloadURLAnchor.dataset["externalUrl"];
                                                        if (link?.startsWith("https://"))
                                                            this.electron.openExternal(link);
                                                    };
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
                    break;

                    case 401: // HTTP 401 - Unauthorized
                        {
                            // Just do nothing!
                        }
                    break;

                }
            }

        }

        GetListOfVersions.send();

        //#endregion

        //#region Verify application signatures




        //#endregion


        //#region Handle the 'Update available'-button

        this.updateAvailableButton.onclick = () => {
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

        this.aboutButton.onclick = async () => {

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

                const sigHeadDiv = this.applicationHashDiv.children[2];

                if (sigHeadDiv != null)
                {

                    // Bad hash value
                    if (this.currentPackage.cryptoHashes.SHA512.replace("0x", "") !== this.applicationHash)
                        sigHeadDiv.innerHTML = "<i class=\"fas fa-times-circle\"></i> " + this.chargy.GetLocalizedMessage("invalidHashValue");

                    // At least the same hash value...
                    else
                    {

                        if (this.currentPackage.signatures == null || this.currentPackage.signatures.length == 0)
                        {
                            sigHeadDiv.innerHTML = "<i class=\"fas fa-check-circle\"></i> " + this.chargy.GetLocalizedMessage("validHashValue");
                        }

                        // Some crypto signatures found...
                        else
                        {

                            sigHeadDiv.innerHTML = this.chargy.GetLocalizedMessage("confirmedBy");

                            const signaturesDiv = this.applicationHashDiv.children[3];

                            if (signaturesDiv != null)
                            {
                                for (const signature of this.currentPackage.signatures)
                                {

                                    const signatureDiv = signaturesDiv.appendChild(document.createElement('div'));

                                    if (signatureDiv != null)
                                        signatureDiv.innerHTML = await this.checkApplicationHashSignature(this.currentAppInfos,
                                                                                                          this.currentVersionInfos,
                                                                                                          this.currentPackage,
                                                                                                          signature);

                                }
                            }

                        }

                    }

                }

            }

            //#endregion

        }

        //#endregion

        //#region Handle the 'Full Screen'-button

        this.fullScreenButton.onclick = () => {
            if (document.fullscreenElement)
            {
                this.measurementsDetailsDiv.classList.remove("fullScreen");
                chargyLib.closeFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
            else
            {
                this.measurementsDetailsDiv.classList.add("fullScreen");
                chargyLib.openFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-compress"></i>';
            }
        }

        //#endregion

        //#region Handle the 'App Quit'-button

        this.appQuitButton.onclick = () => {
            window.close();
        }

        //#endregion


        //#region Handle the 'back'-button

        this.backButton.onclick  = () => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "none";
            this.exportButtonDiv.style.display           = "none";
            this.fileInput.value                         = "";
            this.detailedInfosDiv.innerHTML              = "";
            this.currentChargeTransparencyRecord         = null;
            this.currentChargeTransparencyLiveLink       = null;
            this.currentGlobalError                      = null;

            this.minlat = +1000;
            this.maxlat = -1000;
            this.minlng = +1000;
            this.maxlng = -1000;

        }

        //#endregion

        //#region Handle the 'export'-button

        this.exportButton.onclick  = async () => {

            try
            {

                const path = await this.electron.showSaveDialog();

                if (path != null)
                    await this.electron.writeTextFile(
                              path,
                              this.getChargeTransparencyRecordExportJSON()
                          );

            }
            catch(exception)
            {
                alert(this.chargy.GetLocalizedMessage("exportFailed") + String(exception));
            }

        }

        //#endregion


        //#region Modify external links to be opened in the external web browser

        const linkButtons  = document.getElementsByClassName('linkButton') as HTMLCollectionOf<HTMLButtonElement>;

        for (let i = 0; i < linkButtons.length; i++) {

            const linkButton = linkButtons[i];

            if (linkButton != null)
            {
                linkButton.onclick = (ev: MouseEvent) => {
                    ev.preventDefault();
                    const link = linkButton.getAttribute("href");
                    if (link && link.startsWith("https://"))
                        this.electron.openExternal(link);
                }
            }

        }

        const externalLinks = document.querySelectorAll<HTMLElement>('[data-external-url]');

        for (let i = 0; i < externalLinks.length; i++) {

            const externalLink = externalLinks[i];

            if (externalLink != null)
            {
                externalLink.onclick = (ev: MouseEvent) => {
                    ev.preventDefault();
                    const link = externalLink.getAttribute("data-external-url");
                    if (link && link.startsWith("https://"))
                        this.electron.openExternal(link);
                }
            }

        }

        const protocolLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"], a[href^="tel:"]');

        for (let i = 0; i < protocolLinks.length; i++) {

            const protocolLink = protocolLinks[i];

            if (protocolLink != null)
            {
                protocolLink.onclick = (ev: MouseEvent) => {
                    ev.preventDefault();
                    this.electron.openExternal(protocolLink.href);
                }
            }

        }

        //#endregion


        //#region Handle the 'fileInput'-button

        this.fileInput  = document.getElementById('fileInput')  as HTMLInputElement;
        this.fileInputButton.onclick = () => {
            this.fileInput.value = '';
            this.fileInput.click();
        }

        this.fileInput.onchange = (ev: Event) => {

            //@ts-ignore
            const files = ev?.target?.files;

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

        this.pasteButton.onclick = async ()  => {
            await this.readClipboard();
        }

        //#endregion

        //#region Handle IPC message "receiveReadClipboard" (Ctrl+V)

        this.electron.on('receiveReadClipboard', async () => {
            await this.readClipboard();
        });

        //#endregion

        //#region Handle 'Open file'-events...

        // e.g. on Mac OS X - when app is running
        this.electron.on('receiveFileToOpen', (filename:string) => {
            this.readFileFromDisk(filename);
        });

        this.electron.on('receiveFilesToOpen', (filenames:string[]) => {
            this.readFilesFromDisk(filenames);
        });

        this.electron.on('receiveHttpRequest', async (request: ChargyHttpRequest) => {
            await this.handleHttpRequest(request);
        });

        //#endregion

        //#region Check command line parameters and 'Open this file with...'-events...

        // ToDo: This is a work around, as events from main.js seem to fire too early!

        // File to open on Mac OS X
        const filename = this.appContext.fileToOpen;
        if (filename !== "")
            this.readFileFromDisk(filename);


        // Open files sent via command line parameters
        const filteredcommandLineArguments = this.commandLineArguments.filter(parameter => !parameter.startsWith('-'));

        // Stupid workaround via setTimeout
        if (filteredcommandLineArguments.length > 0)
            setTimeout(async () => this.readFilesFromDisk(filteredcommandLineArguments), 100);

        //#endregion

        //#region Handle the 'qrScan'-button

        this.qrScanButton.onclick = async (ev: MouseEvent) => {
            ev.preventDefault();
            await this.openQRCodeScanner();
        }

        this.qrCodeScannerCancelButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.closeQRCodeScanner();
        }

        this.qrCodeScannerRescanButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.resumeQRCodeScanner();
        }

        this.qrCodeScannerOpenURLButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();

            if (this.qrCodeScannerLastURL != null)
            {
                window.open(this.qrCodeScannerLastURL.href, "_blank", "noopener");
                this.setQRCodeScannerStatus(this.chargy.GetLocalizedMessage("urlWasOpened"));
            }
        }

        this.updateQRCodeScannerAvailability();
        navigator.mediaDevices?.addEventListener?.("devicechange", async () => this.updateQRCodeScannerAvailability());

        //#endregion

        this.map   = L.map(document.getElementById('map') as HTMLElement);

        const mapBoxStartGeoCoordinates = this.appContext.mapbox.startGeoCoordinates;
        const mapBoxStartMapZoom        = this.appContext.mapbox.startMapZoom;

        this.map.setView(mapBoxStartGeoCoordinates, mapBoxStartMapZoom);

        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution:  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
            tileSize:      512,
            maxZoom:        18,
            zoomOffset:     -1,
            id:           'mapbox/light-v10',
            accessToken:  this.appContext.mapbox.accessToken
        } as L.TileLayerOptions & { accessToken: string }).addTo(this.map);

    }


    //#region UI language handling

    private getInitialUILanguage(): SupportedLanguage {

        const storedLanguage = localStorage.getItem("ChargyUILanguage");

        if (this.isSupportedLanguage(storedLanguage))
            return storedLanguage;

        const browserLanguages = [
            navigator.language,
            ...(navigator.languages)
        ].map(language => language.toLowerCase());

        for (const supportedLanguage of supportedLanguages)
            if (browserLanguages.includes(supportedLanguage))
                return supportedLanguage;

        for (const supportedLanguage of supportedLanguages)
            if (browserLanguages.some(language => language.startsWith(supportedLanguage + "-")))
                return supportedLanguage;

        return "en";

    }

    private isSupportedLanguage(language: string|null|undefined): language is SupportedLanguage {

        return supportedLanguages.includes(language as SupportedLanguage);

    }

    private getSessionWarnings(chargingSession: chargeTransparencyRecord.IChargingSession): SessionWarning[] {

        const warnings: SessionWarning[] = [];

        if (chargingSession.verificationResult?.warnings)
            warnings.push(...chargingSession.verificationResult.warnings.map(warning => ({
                ...warning,
                source: this.chargy.GetLocalizedMessage("sessionValidationLabel")
            })));

        if (chargingSession.ctr?.warnings &&
            chargingSession.verificationResult?.status === chargyInterfaces.SessionVerificationResult.InplausibleMeasurement)
        {
            warnings.push(...chargingSession.ctr.warnings.map(warning => ({
                ...warning,
                source: this.chargy.GetLocalizedMessage("chargeTransparencyRecordLabel")
            })));
        }

        for (const measurement of chargingSession.measurements ?? []) {

            if (measurement.verificationResult?.warnings)
                warnings.push(...measurement.verificationResult.warnings.map(warning => ({
                    ...warning,
                    source: measurement.name
                })));

            for (const measurementValue of measurement.values ?? []) {
                if (measurementValue.warnings)
                    warnings.push(...measurementValue.warnings.map(warning => ({
                        ...warning,
                        source: measurementValue.timestamp
                    })));

                if (measurementValue.result?.warnings)
                    warnings.push(...measurementValue.result.warnings.map(warning => ({
                        ...warning,
                        source: measurementValue.timestamp
                    })));
            }

        }

        return warnings;

    }

    private hasSessionWarnings(chargingSession: chargeTransparencyRecord.IChargingSession): boolean {
        return this.getSessionWarnings(chargingSession).length > 0;
    }

    private isWarningSession(chargingSession: chargeTransparencyRecord.IChargingSession): boolean {
        return chargingSession.verificationResult?.status === chargyInterfaces.SessionVerificationResult.InplausibleMeasurement ||
               this.hasSessionWarnings(chargingSession);
    }

    private setupLanguageSelector(): void {

        this.languageButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            const isOpen = this.languageMenuDiv.classList.toggle("open");
            this.languageButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
        };

        for (const languageMenuButton of Array.from(this.languageMenuDiv.querySelectorAll<HTMLButtonElement>("button[data-language]")))
        {
            languageMenuButton.onclick = async (ev: MouseEvent) => {
                ev.preventDefault();
                ev.stopPropagation();

                const language = languageMenuButton.dataset["language"];
                if (this.isSupportedLanguage(language))
                    await this.setUILanguage(language);
            };
        }

        document.addEventListener("click", () => {
            this.languageMenuDiv.classList.remove("open");
            this.languageButton.setAttribute("aria-expanded", "false");
        });

    }

    private async setUILanguage(language: SupportedLanguage,
                                persist:  boolean = true): Promise<void> {

        this.UILanguage = language;
        this.chargy.SetUILanguages([ language ]);
        this.moment.locale(language);
        chargyLib.setUILocale(language);

        if (persist)
            localStorage.setItem("ChargyUILanguage", language);

        this.applyTranslations();
        await this.rerenderCurrentView();

    }

    private applyTranslations(): void {

        document.documentElement.lang = this.UILanguage;

        for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n-key]")))
        {
            const key = element.dataset["i18nKey"];
            if (key != null)
                element.innerHTML = this.chargy.GetLocalizedMessage(key);
        }

        for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n-title-key]")))
        {
            const key = element.dataset["i18nTitleKey"];
            if (key != null)
                element.title = this.chargy.GetLocalizedMessage(key);
        }

        for (const element of Array.from(document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder-key]")))
        {
            const key = element.dataset["i18nPlaceholderKey"];
            if (key != null)
                element.placeholder = this.chargy.GetLocalizedMessage(key);
        }

        this.languageButton.title = this.chargy.GetLocalizedMessage("languageButtonTitle");
        this.languageButton.setAttribute("aria-label", this.languageButton.title);
        this.languageMenuDiv.classList.remove("open");
        this.languageButton.setAttribute("aria-expanded", "false");

        this.languageFlagImage.src = "images/flags/" + this.UILanguage + ".svg";

        for (const languageMenuButton of Array.from(this.languageMenuDiv.querySelectorAll<HTMLButtonElement>("button[data-language]")))
        {
            const isActive = languageMenuButton.dataset["language"] === this.UILanguage;
            languageMenuButton.classList.toggle("active", isActive);
            languageMenuButton.setAttribute("aria-pressed", isActive ? "true" : "false");
        }

    }

    private async rerenderCurrentView(): Promise<void> {

        if (this.currentChargeTransparencyRecord != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            await this.showChargeTransparencyRecord(this.currentChargeTransparencyRecord);
            return;
        }

        if (this.currentChargeTransparencyLiveLink != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            await this.showChargeTransparencyLiveLink(this.currentChargeTransparencyLiveLink);
            return;
        }

        if (this.currentGlobalError != null &&
            this.errorTextDiv.style.display !== "none")
        {
            this.doGlobalError(this.currentGlobalError);
        }

    }

    //#endregion    

    //#region UpdateFeedbackSection()

    public UpdateFeedbackSection(FeedbackEMail?:   string[],
                                 FeedbackHotline?: string[]) {

        if (!this.showFeedbackSection)
        {
          //  this.feedbackDiv.style.display = "none";
            return;
        }

        this.feedbackDiv.style.display = "block";

        //#region Issue Tracker

        if (this.defaultIssueURL !== "")
        {

            this.showIssueTrackerButton.style.display = "block";

            this.showIssueTrackerButton.onclick = () => {
                this.issueTrackerDiv.style.display    = 'block';
                this.privacyStatement.style.display   = "none";
                this.issueTrackerText.scrollTop       = 0;
            }
        }
        else
            this.showIssueTrackerButton.style.display = "none";

        //#endregion

        //#region Feedback E-Mail

        const feedbackEMail   = FeedbackEMail   ?? this.defaultFeedbackEMail;

        if (feedbackEMail?.length == 2)
        {
            this.feedbackEMailAnchor.style.display = "block";
            this.feedbackEMailAnchor.href          = "mailto:" + feedbackEMail[0] + feedbackEMail[1];
            this.feedbackEMailAnchor.innerHTML    += feedbackEMail[0];
        }
        else
            this.feedbackEMailAnchor.style.display = "none";

        //#endregion

        //#region Feedback Hotline

        const feedbackHotline = FeedbackHotline ?? this.defaultFeedbackHotline;

        if (feedbackHotline?.length == 2)
        {
            this.feedbackHotlineAnchor.style.display = "block";
            this.feedbackHotlineAnchor.href          = "tel:" + feedbackHotline[0];
            this.feedbackHotlineAnchor.innerHTML    += feedbackHotline[1];
        }
        else
            this.feedbackHotlineAnchor.style.display = "none";

        //#endregion

    }

    //#endregion

    private getSessionCryptoResultText(result?: chargyInterfaces.ISessionCryptoResult|null): string
    {

        let text = this.chargy.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord");

        if (result?.message !== undefined)
            text = getTextFromMultilanguageText(result.message, this.UILanguage, text).trim();

        if (result?.errors            &&
            result.errors.length > 0 &&
            result.errors[0] !== undefined)
        {
            text = getTextFromMultilanguageText(result.errors[0].message, this.UILanguage, text).trim();
        }

        return text;

    }

    //#region doGlobalError(...)

    private doGlobalError(result:    chargyInterfaces.ISessionCryptoResult,
                          context?:  unknown)
    {

        this.currentGlobalError                = result;
        this.currentChargeTransparencyRecord   = null;
        this.currentChargeTransparencyLiveLink = null;

        let text = this.chargy.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord");

        if (result?.message !== null &&
            result?.message !== undefined)
        {
            text = getTextFromMultilanguageText(result.message, this.UILanguage, text).trim();
        }

        if (result?.errors                      &&
            result.errors        !== undefined &&
            result.errors        !== null      &&
            result.errors.length   > 0         &&
            result.errors[0]     !== undefined)
        {
            text = getTextFromMultilanguageText(result.errors[0].message, this.UILanguage, text).trim();
        }

        this.inputDiv.style.flexDirection            = "";
        this.inputInfosDiv.style.display             = 'flex';
        this.chargingSessionScreenDiv.style.display  = 'none';
        this.chargingSessionScreenDiv.innerHTML      = '';
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        console.log(text);
        console.log(context);

        this.electron.setVerificationResult(result);

    }

    //#endregion

    //#region readClipboard()

    private async readClipboard()
    {
        try
        {

            const imageData = await this.electron.readClipboardImage();
            const text      = await this.electron.readClipboardText();

            if (imageData != null && imageData.byteLength > 0 && text.trim() === "")
            {
                await this.detectAndConvertContentFormat({
                    name: "clipboard.png",
                    type: "image/png",
                    data: imageData
                });
            }
            else
                await this.detectAndConvertContentFormat(this.getClipboardFileInfo(text));
        }
        catch (exception)
        {
            if (exception instanceof DOMException &&
                exception.message === "Document is not focused.")
            {
                // ignore!
            }
            else
            {
                this.doGlobalError({
                    status:    chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                    message:   this.chargy.GetMultilanguageText("UnknownOrInvalidChargeTransparencyRecord"),
                    certainty: 0
                });
            }
        }
    }

    //#endregion

    //#region getClipboardFileInfo(...)

    private getClipboardFileInfo(text: string): chargyInterfaces.IFileInfo
    {

        const trimmedText = text.trimStart();
        let name          = "clipboard.txt";
        let type          = "text/plain";

        if (trimmedText.startsWith("<?xml"))
        {
            name = "clipboard.xml";
            type = "application/xml";
        }

        else if (trimmedText.startsWith("{") || trimmedText.startsWith("["))
        {
            name = "clipboard.json";
            type = "application/json";
        }

        return {
            name,
            type,
            data: new TextEncoder().encode(text)
        };

    }

    //#endregion

    //#region QR code scanner

    private async updateQRCodeScannerAvailability(): Promise<void> {

        const mediaDevices = navigator.mediaDevices;

        if (mediaDevices?.getUserMedia == null)
        {
            this.setQRCodeScannerButtonAvailability(false, this.chargy.GetLocalizedMessage("cameraAccessUnsupported"));
            return;
        }

        if (mediaDevices.enumerateDevices == null)
        {
            this.setQRCodeScannerButtonAvailability(true, this.chargy.GetLocalizedMessage("scanQRCodeWithCamera"));
            return;
        }

        try
        {
            const devices   = await mediaDevices.enumerateDevices();
            const hasCamera = devices.some(device => device.kind === "videoinput");

            this.setQRCodeScannerButtonAvailability(
                hasCamera,
                hasCamera
                    ? this.chargy.GetLocalizedMessage("scanQRCodeWithCamera")
                    : this.chargy.GetLocalizedMessage("noCameraAvailable")
            );
        }
        catch
        {
            this.setQRCodeScannerButtonAvailability(true, this.chargy.GetLocalizedMessage("scanQRCodeWithCamera"));
        }

    }

    private setQRCodeScannerButtonAvailability(isAvailable: boolean,
                                               title:       string): void {

        this.qrScanButton.disabled = !isAvailable;
        this.qrScanButton.title    = title;

    }

    private async openQRCodeScanner(): Promise<void> {

        if (this.qrScanButton.disabled)
            return;

        this.resetQRCodeScannerDialog(this.chargy.GetLocalizedMessage("cameraStarting"));

        try
        {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: "environment" }
                }
            });

            this.qrCodeScannerStream             = stream;
            this.qrCodeScannerVideo.srcObject    = stream;
            this.qrCodeScannerDiv.style.display  = "block";

            await this.qrCodeScannerVideo.play();

            this.resumeQRCodeScanner();
        }
        catch (exception)
        {
            this.closeQRCodeScanner();
            this.doGlobalError({
                status:     chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                message:    this.chargy.GetMultilanguageText("cameraCouldNotStart"),
                exception:  exception,
                certainty:  0
            });
        }

    }

    private closeQRCodeScanner(): void {

        if (this.qrCodeScannerAnimationFrame != null)
        {
            cancelAnimationFrame(this.qrCodeScannerAnimationFrame);
            this.qrCodeScannerAnimationFrame = null;
        }

        this.qrCodeScannerVideo.pause();
        this.qrCodeScannerVideo.srcObject = null;

        if (this.qrCodeScannerStream != null)
        {
            for (const track of this.qrCodeScannerStream.getTracks())
                track.stop();

            this.qrCodeScannerStream = null;
        }

        this.qrCodeScannerDiv.style.display = "none";
        this.qrCodeScannerIsProcessing      = false;
        this.qrCodeScannerLastText          = null;
        this.qrCodeScannerLastURL           = null;

    }

    private resumeQRCodeScanner(): void {

        this.qrCodeScannerIsProcessing = false;
        this.qrCodeScannerLastText     = null;
        this.qrCodeScannerLastURL      = null;
        this.resetQRCodeScannerDialog(this.chargy.GetLocalizedMessage("cameraReady"));

        if (this.qrCodeScannerAnimationFrame == null)
            this.scanQRCodeFrame();

    }

    private resetQRCodeScannerDialog(statusText: string): void {

        this.qrCodeScannerErrorDiv.textContent             = "";
        this.qrCodeScannerStatusDiv.textContent            = statusText;
        this.qrCodeScannerResultDiv.style.display          = "none";
        this.qrCodeScannerURLActionsDiv.style.display      = "none";
        this.qrCodeScannerResultText.textContent           = "";

    }

    private setQRCodeScannerStatus(statusText: string): void {
        this.qrCodeScannerStatusDiv.textContent = statusText;
    }

    private scanQRCodeFrame(): void {

        if (this.qrCodeScannerDiv.style.display !== "block")
        {
            this.qrCodeScannerAnimationFrame = null;
            return;
        }

        if (!this.qrCodeScannerIsProcessing &&
            this.qrCodeScannerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            this.qrCodeScannerVideo.videoWidth  > 0 &&
            this.qrCodeScannerVideo.videoHeight > 0)
        {
            const canvas  = this.qrCodeScannerCanvas;
            const context = canvas.getContext("2d", { willReadFrequently: true });

            if (context != null)
            {
                canvas.width  = this.qrCodeScannerVideo.videoWidth;
                canvas.height = this.qrCodeScannerVideo.videoHeight;

                context.drawImage(this.qrCodeScannerVideo, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const qrText    = readQRCodeTextFromImageData({
                                      data:   imageData.data,
                                      width:  imageData.width,
                                      height: imageData.height
                                  });

                if (qrText != null &&
                    qrText !== this.qrCodeScannerLastText)
                {
                    this.qrCodeScannerLastText = qrText;
                    this.handleScannedQRCodeText(qrText);
                }
            }
        }

        this.qrCodeScannerAnimationFrame = requestAnimationFrame(() => { this.scanQRCodeFrame(); });

    }

    private async handleScannedQRCodeText(qrText: string): Promise<void> {

        this.qrCodeScannerIsProcessing = true;
        this.setQRCodeScannerStatus(this.chargy.GetLocalizedMessage("qrCodeDetected"));

        const detected = await this.detectAndConvertContentFormat(
            {
                name: "qr-code.txt",
                type: "text/plain",
                data: new TextEncoder().encode(qrText)
            },
            {
                prepareUI: false,
                onError:   result => { this.showQRCodeScannerRejectedText(qrText, result); }
            }
        );

        if (detected)
            this.closeQRCodeScanner();

    }

    private showQRCodeScannerRejectedText(qrText: string,
                                          result: chargyInterfaces.ISessionCryptoResult): void {

        const url = this.tryParseQRCodeURL(qrText);

        this.qrCodeScannerErrorDiv.textContent        = this.getSessionCryptoResultText(result);
        this.qrCodeScannerResultDiv.style.display     = "flex";
        this.qrCodeScannerResultText.textContent      = qrText;
        this.qrCodeScannerURLActionsDiv.style.display = url != null
                                                            ? "block"
                                                            : "none";
        this.qrCodeScannerLastURL                     = url;

        this.setQRCodeScannerStatus(
            url != null
                ? this.chargy.GetLocalizedMessage("qrCodeContainsURL")
                : this.chargy.GetLocalizedMessage("qrCodeContainsNoRecord")
        );

    }

    private tryParseQRCodeURL(qrText: string): URL|null {

        try
        {
            const url = new URL(qrText.trim());

            return url.protocol === "https:" || url.protocol === "http:"
                       ? url
                       : null;
        }
        catch
        {
            return null;
        }

    }

    //#endregion

    //#region readFile(s)FromDisk()

    private async readFileFromDisk(file: string|File): Promise<void> {

        if (typeof file == 'string')
            await this.readFilesFromDisk([ file ]);
        else
            await this.readFilesFromDisk([ file ]);

    }

    private async readFilesFromDisk(files: string[]|FileList|File[]): Promise<void> {
        if (files != null && files.length > 0)
        {

            //#region Map file names

            const filesToLoad = new Array<chargyInterfaces.IFileInfo>();

            for (let i = 0; i < files.length; i++)
            {

                const file = files[i];

                if (file != undefined)
                {
                    if (typeof file == 'string')
                        filesToLoad.push({ name: file });
                    else
                        filesToLoad.push(file)
                }

            }

            //#endregion

            const loadedFiles = new Array<chargyInterfaces.IFileInfo>();

            for (const filename of filesToLoad)
            {
                if (filename.name.trim() != "" && filename.name != "." && !filename.name.startsWith('-'))
                {
                    try
                    {

                        const fileData = filename instanceof File
                                             ? await filename.arrayBuffer()
                                             : await this.electron.readFile((filename.path ?? filename.name).replace("file://", ""));

                        loadedFiles.push({
                                       "name":  filename.name,
                                       "path":  filename.path,
                                       "type":  filename.type,
                                       "data":  fileData
                                    });

                    }
                    catch (exception) {
                        loadedFiles.push({
                            "name":       filename.name,
                            "path":       filename.path,
                            "error":      this.chargy.GetLocalizedMessage("invalidChargeTransparencyRecord"),
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



    //#region Charge Transparency Record export helpers

    private getChargeTransparencyRecordExportStatus(CTR: chargeTransparencyRecord.IChargeTransparencyRecord): chargyInterfaces.SessionVerificationResult|undefined {

        if (CTR.verificationResult?.status != null)
            return CTR.verificationResult.status;

        if (CTR.chargingSessions?.length === 1)
            return CTR.chargingSessions[0]?.verificationResult?.status;

        return CTR.status;

    }

    private getChargeTransparencyRecordExportJSON(): string {

        const CTR = this.currentChargeTransparencyRecord;

        if (CTR == null)
            return "{}";

        const runtimeKeys = new Set([
            "GUI",
            "ctr",
            "chargingSession",
            "measurement",
            "method",
            "chargingStationOperator",
            "chargingPool",
            "chargingStation",
            "EVSE",
            "meter",
            "publicKey"
        ]);

        const serializedCTR = JSON.stringify(
            CTR,
            (key: string, value: unknown) => runtimeKeys.has(key) ? undefined : value
        );

        const exportCTR = JSON.parse(serializedCTR) as chargeTransparencyRecord.IChargeTransparencyRecord;
        const status    = this.getChargeTransparencyRecordExportStatus(CTR);

        if (status != null)
            exportCTR.status = status;

        return JSON.stringify(exportCTR, null, 4);

    }

    //#endregion


    //#region checkApplicationHashSignature(...)

    private async checkApplicationHashSignature(app:        any,
                                                version:    any,
                                                _package:   any,
                                                signature:  any): Promise<string>
    {

        if (app == null || version == null || _package == null || signature == null)
            return "<i class=\"fas fa-times-circle\"></i>Ungültige Signatur!";

        try {

            const toCheck = {
                "name":                 app.name,
                "description":          app.description,

                "version": {
                    "version":              this.packageJson.version,
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

            const Input        = JSON.stringify(toCheck);
            const sha256value  = await chargyLib.sha256(Input);
            const result       = new this.elliptic.ec('secp256k1').
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


    //#region handleHttpRequest(...)

    private async handleHttpRequest(request: ChargyHttpRequest): Promise<void>
    {

        try
        {

            const result = await this.chargy.DetectAndConvertContentFormat([{
                name:  "http request",
                type:  request.contentType,
                data:  request.data
            }]);

            const serializedResult = stringify(result);

            if (serializedResult == null)
                throw new Error("Invalid transparency format!");

            this.electron.completeHttpRequest(request.id, {
                ok:      true,
                result:  JSON.parse(serializedResult)
            });

        }
        catch (exception)
        {
            this.electron.completeHttpRequest(request.id, {
                ok:       false,
                message:  exception instanceof Error
                              ? exception.message
                              : "Invalid transparency format!"
            });
        }

    }

    //#endregion


    //#region detectAndConvertContentFormat (FileInfos)

    private async detectAndConvertContentFormat(FileInfos:  Array<chargyInterfaces.IFileInfo>|chargyInterfaces.IFileInfo|string,
                                                options?:   DetectionOptions): Promise<boolean> {

        if (options?.prepareUI !== false)
        {
            this.inputInfosDiv.style.display = 'none';
            this.errorTextDiv.style.display  = 'none';
        }

        let result:DetectionResult;

        try
        {

            if (typeof FileInfos === 'string')
                result = await this.chargy.DetectAndConvertContentFormat(
                                   [{
                                       name:  "clipboard",
                                       data:  new TextEncoder().encode(FileInfos)
                                   }]
                               );

            else if (chargyInterfaces.isIFileInfo(FileInfos))
                result = await this.chargy.DetectAndConvertContentFormat([ FileInfos ]);

            else
                result = await this.chargy.DetectAndConvertContentFormat(FileInfos);

        }
        catch (exception)
        {
            result = {
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:    this.chargy.GetMultilanguageText("UnknownOrInvalidChargeTransparencyRecord"),
                exception:  exception,
                certainty:  0
            };
        }


        if (chargeTransparencyRecord.IsAChargeTransparencyRecord(result))
        {

            if (this.appContext.noGUI)
            {
                this.publishVerificationResult(result);
                return true;
            }

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            await this.showChargeTransparencyRecord(result);

            if (this.appContext.isDebug)
                this.publishVerificationResult(result);

            return true;

        }

        if (chargeTransparencyLiveLink.IsAChargeTransparencyLiveLink(result))
        {

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            await this.showChargeTransparencyLiveLink(result);

            return true;

        }

        if (publicKeyInfo.IsAPublicKeyInfo(result))
        {

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            // await this.showPublicKeyInfo(result);

            return true;

        }

        if (options?.onError !== undefined)
            options.onError(result);
        else
            this.doGlobalError(result);

        return false;

    }

    //#endregion


    private publishVerificationResult(CTR: chargeTransparencyRecord.IChargeTransparencyRecord): void {

        this.electron.setVerificationResult(
            toSessionVerificationResults(
                CTR,
                this.chargy.GetMultilanguageText("No charge transparency records found!")
            )
        );

    }


    //#region showChargeTransparencyLiveLink(LiveLink)

    private async showChargeTransparencyLiveLink(LiveLink: chargeTransparencyLiveLink.IChargeTransparencyLiveLink)
    {

        this.currentChargeTransparencyLiveLink       = LiveLink;
        this.currentChargeTransparencyRecord         = null;
        this.currentGlobalError                      = null;

        this.inputDiv.style.flexDirection            = "column";
        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "flex";
        this.exportButtonDiv.style.display           = "none";

        const descriptionDiv       = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id          = "description";
        descriptionDiv.innerText   = this.chargy.GetLocalizedText(LiveLink.description) ?? "Charge Transparency Live-Link";

        if (LiveLink.timestamp)
        {
            const timestampDiv     = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            timestampDiv.id        = "begin";
            timestampDiv.className = "dates";
            timestampDiv.innerText = this.chargy.GetLocalizedMessage("Timestamp") + " " + chargyLib.time2human(LiveLink.timestamp);
        }

        const liveLinksDiv         = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        liveLinksDiv.id            = "chargingSessions";

        const liveLinkDiv          = chargyLib.CreateDiv(liveLinksDiv, "chargingSession");
        liveLinkDiv.classList.add("chargeTransparencyLiveLink");

        const tableDiv             = liveLinkDiv.appendChild(document.createElement('div'));
        tableDiv.className         = "table";

        if (LiveLink.geoLocation)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "locationInfos",
                '<i class="fas fa-map-marker-alt"></i>',
                "Position " + [
                    LiveLink.geoLocation.lat,
                    LiveLink.geoLocation.lng
                ].join(", ")
            );

        if (LiveLink.connector)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "chargingStationInfos",
                '<i class="fas fa-plug"></i>',
                [
                    LiveLink.connector.standard,
                    LiveLink.connector.format,
                    LiveLink.connector.powerType,
                    LiveLink.connector.maxPower
                ].filter(value => value != null && value !== "").join(", ")
            );

        if (LiveLink.transports && LiveLink.transports.length > 0)
        {
            const transportsDiv = document.createElement('div');
            transportsDiv.className = "liveLinkTransports";

            for (const transport of LiveLink.transports)
                transportsDiv.appendChild(this.createLiveLinkTransportDiv(transport));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "productInfos",
                '<i class="fas fa-satellite-dish"></i>',
                transportsDiv
            );
        }

        if (LiveLink.imageURLs && LiveLink.imageURLs.length > 0)
        {
            const imagesDiv = document.createElement('div');

            for (const imageURL of LiveLink.imageURLs)
                imagesDiv.appendChild(this.createLiveLinkAnchor(imageURL, imageURL));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "imageInfos",
                '<i class="fas fa-image"></i>',
                imagesDiv
            );
        }

        if (LiveLink.signatures)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "signatureInfos",
                '<i class="fas fa-file-signature"></i>',
                LiveLink.signatures.length === 1
                    ? "1 Signatur"
                    : LiveLink.signatures.length.toString() + " Signaturen"
            );

    }

    private appendLiveLinkInfoRow(tableDiv:   HTMLDivElement,
                                  className:  string,
                                  iconHTML:   string,
                                  content:    string|HTMLElement): void {

        const rowDiv         = tableDiv.appendChild(document.createElement('div'));
        rowDiv.className     = className;

        const iconDiv        = rowDiv.appendChild(document.createElement('div'));
        iconDiv.className    = "icon";
        iconDiv.innerHTML    = iconHTML;

        const textDiv        = rowDiv.appendChild(document.createElement('div'));
        textDiv.className    = "text";

        if (typeof content === "string")
            textDiv.innerText = content;
        else
            textDiv.appendChild(content);

    }

    private createLiveLinkTransportDiv(transport: chargeTransparencyLiveLink.Transport): HTMLDivElement {

        const transportDiv = document.createElement('div');
        transportDiv.className = "liveLinkTransport";

        const transportTypeDiv = transportDiv.appendChild(document.createElement('div'));
        transportTypeDiv.className = "type";
        transportTypeDiv.innerText = transport.type;

        if (transport.url)
            transportDiv.appendChild(this.createLiveLinkAnchor(transport.url, transport.url));

        if (transport.urls)
        {
            for (const urlInfo of transport.urls)
            {
                const url       = typeof urlInfo === "string" ? urlInfo : urlInfo.url;
                const labelInfo = typeof urlInfo === "string"
                                      ? ""
                                      : [
                                            urlInfo.priority != null ? "Priorität " + urlInfo.priority.toString() : "",
                                            urlInfo.weight   != null ? "Gewicht "   + urlInfo.weight.  toString() : ""
                                        ].filter(value => value !== "").join(", ");

                transportDiv.appendChild(this.createLiveLinkAnchor(url, labelInfo !== "" ? url + " (" + labelInfo + ")" : url));
            }
        }

        if (transport.totp)
        {
            const totpDiv = transportDiv.appendChild(document.createElement('div'));
            totpDiv.className = "totp";
            totpDiv.innerText = `TOTP: ${transport.totp.timeStep} seconds`;
        }

        return transportDiv;

    }

    private createLiveLinkAnchor(url:  string,
                                 text: string): HTMLAnchorElement {

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        anchor.innerText = text;

        return anchor;

    }

    //#endregion

    //#region showChargeTransparencyRecord  (CTR)

    private async showChargeTransparencyRecord(CTR: chargeTransparencyRecord.IChargeTransparencyRecord)
    {

        if (this.currentChargeTransparencyRecord !== CTR)
            this.measurementValuesViewMode           = "measurements";

        this.currentChargeTransparencyRecord         = CTR;
        this.currentChargeTransparencyLiveLink       = null;
        this.currentGlobalError                      = null;

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

        const descriptionDiv      = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id         = "description";
        descriptionDiv.innerText  = this.chargy.GetLocalizedText(CTR.description) ?? this.chargy.GetLocalizedMessage("All charging sessions");

        const ctrBeginText        = CTR.begin ? chargyLib.parseUTC(CTR.begin).format('dddd, D. MMMM YYYY') : null;
        const ctrEndText          = CTR.end   ? chargyLib.parseUTC(CTR.end).  format('dddd, D. MMMM YYYY') : null;

        if (ctrBeginText) {
            const beginDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            beginDiv.id        = "begin";
            beginDiv.className = "dates";
            beginDiv.innerHTML = (ctrBeginText == ctrEndText ? this.chargy.GetLocalizedMessage("on") : this.chargy.GetLocalizedMessage("from")) + " " + ctrBeginText;
        }

        if (ctrEndText && ctrEndText != ctrBeginText) {
            const endDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            endDiv.id          = "end";
            endDiv.className   = "dates";
            endDiv.innerHTML   = this.chargy.GetLocalizedMessage("till") + " " + ctrEndText;
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

                const chargingSessionDiv    = chargyLib.CreateDiv(chargingSessionsDiv, "chargingSession");
                chargingSession.ctr         = CTR;
                chargingSession.GUI         = chargingSessionDiv;
                chargingSessionDiv.onclick  = async (ev: MouseEvent) => {

                    //#region Highlight the selected charging session...

                    const AllChargingSessionsDivs = document.getElementsByClassName("chargingSession");

                    for(let i=0; i<AllChargingSessionsDivs.length; i++)
                        AllChargingSessionsDivs[i]?.classList.remove("activated");

                    //(this as HTMLDivElement)?.classList.add("activated");
                    (ev.currentTarget as HTMLDivElement).classList.add("activated");

                    //#endregion

                    await this.showChargingSessionDetails(chargingSession);

                };

                //#region Show session time infos

                try
                {

                    if (chargingSession.begin)
                    {

                        const dateDiv  = chargingSessionDiv.appendChild(document.createElement('div'));
                        dateDiv.className = "date";
                        //dateDiv.innerHTML = UTC2human(chargingSession.begin);
                        dateDiv.innerHTML = chargyLib.time2human(chargingSession.begin);

                        if (chargingSession.end)
                        {

                            const endUTC   = chargyLib.parseUTC(chargingSession.end);
                            const duration = this.moment.duration(endUTC.valueOf() - chargyLib.parseUTC(chargingSession.begin).valueOf());

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

                    const productInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                    productInfoDiv.className             = "productInfos";

                    const productIconDiv                   = productInfoDiv.appendChild(document.createElement('div'));
                    productIconDiv.className             = "icon";
                    productIconDiv.innerHTML             = '<i class="fas fa-chart-pie"></i>';

                    const productDiv                       = productInfoDiv.appendChild(document.createElement('div'));
                    productDiv.className                 = "text";
                    productDiv.innerHTML = chargingSession.product != null ? chargingSession.product["@id"] + "<br />" : "";

                    if (chargingSession.begin && chargingSession.end)
                    {

                        const duration = this.moment.duration(chargyLib.parseUTC(chargingSession.end).valueOf() - chargyLib.parseUTC(chargingSession.begin).valueOf());

                        productDiv.innerHTML += "Ladedauer ";
                        if      (Math.floor(duration.asDays())    > 1) productDiv.innerHTML += duration.days()    + " Tage "    + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asDays())    > 0) productDiv.innerHTML += duration.days()    + " Tag "     + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asHours())   > 0) productDiv.innerHTML += duration.hours()   + " Std. "    + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asMinutes()) > 0) productDiv.innerHTML += duration.minutes() + " Minuten " + duration.seconds() + " Sekunden";
                        else if (Math.floor(duration.asSeconds()) > 0) productDiv.innerHTML += duration.seconds() + " Sekunden";


                        if (chargingSession.chargingProductRelevance?.time != undefined)
                        {
                            switch (chargingSession.chargingProductRelevance.time)
                            {

                                case chargyInterfaces.InformationRelevance.Unknown:
                                case chargyInterfaces.InformationRelevance.Ignored:
                                case chargyInterfaces.InformationRelevance.Important:
                                    break;

                                case chargyInterfaces.InformationRelevance.Informative:
                                    productDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                    break;

                                default:
                                    productDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.time + ")</span>";
                                    break;

                            }
                        }

                    }

                    for (const measurement of chargingSession.measurements)
                    {
                        //<i class="far fa-chart-bar"></i>
                        if (measurement.values && measurement.values.length > 0)
                        {

                            if (measurement.phenomena && measurement.phenomena.length > 0)
                            {

                                const phenomenon         = measurement.phenomena[0] as MeasurementPhenomenon;

                                measurement.name         = phenomenon.name        ?? measurement.name;
                                measurement.obis         = phenomenon.obis        ?? measurement.obis;
                                measurement.unit         = phenomenon.unit        ?? measurement.unit;
                                measurement.unitEncoded  = phenomenon.unitEncoded ?? measurement.unitEncoded;
                                measurement.valueType    = phenomenon.valueType   ?? measurement.valueType;
                                measurement.scale        = phenomenon.scale       ?? measurement.scale;

                                if (measurement.scale == undefined || measurement.scale == null)
                                    measurement.scale = 0;

                            }

                            const first  = measurement?.values[0]?.value                           ?? new Decimal(0);
                            const last   = measurement?.values[measurement.values.length-1]?.value ?? first;
                            let   amount = parseFloat(((last.minus(first)).times(Math.pow(10, measurement.scale))).toFixed(10));

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

                            productDiv.innerHTML += "<br />" + chargyLib.measurementName2human(measurement.name) + " " + amount.toString() + " kWh";// (" + measurement.values.length + " Messwerte)";


                            if (chargingSession.chargingProductRelevance?.energy != undefined)
                            {
                                switch (chargingSession.chargingProductRelevance.energy)
                                {

                                    case chargyInterfaces.InformationRelevance.Unknown:
                                    case chargyInterfaces.InformationRelevance.Ignored:
                                    case chargyInterfaces.InformationRelevance.Important:
                                        break;

                                    case chargyInterfaces.InformationRelevance.Informative:
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

                        const parkingInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        parkingInfoDiv.className             = "parkingInfos";

                        const parkingIconDiv                   = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingIconDiv.className             = "icon";
                        parkingIconDiv.innerHTML             = '<i class="fas fa-parking"></i>';

                        const parkingDiv                       = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingDiv.className                 = "text";
                       // parkingDiv.innerHTML = chargingSession.parking != null ? chargingSession.product["@id"] + "<br />" : "";

                        const lastParking = chargingSession.parking[chargingSession.parking.length-1];

                        if (lastParking?.end != null)
                        {

                            const parkingBegin = chargyLib.parseUTC(chargingSession.parking[0]?.begin ?? "-");
                            const parkingEnd   = chargyLib.parseUTC(lastParking.end);
                            const duration     = this.moment.duration(parkingEnd.valueOf() - parkingBegin.valueOf());

                            parkingDiv.innerHTML += "Parkdauer ";
                            if      (Math.floor(duration.asDays())    > 1) parkingDiv.innerHTML += duration.days()    + " Tage " + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asDays())    > 0) parkingDiv.innerHTML += duration.days()    + " Tag "  + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asHours())   > 0) parkingDiv.innerHTML += duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asMinutes()) > 0) parkingDiv.innerHTML += duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asSeconds()) > 0) parkingDiv.innerHTML += duration.seconds();


                            if (chargingSession.chargingProductRelevance?.parking != undefined)
                            {
                                switch (chargingSession.chargingProductRelevance.parking)
                                {

                                    case chargyInterfaces.InformationRelevance.Unknown:
                                    case chargyInterfaces.InformationRelevance.Ignored:
                                    case chargyInterfaces.InformationRelevance.Important:
                                        break;

                                    case chargyInterfaces.InformationRelevance.Informative:
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

                try
                {

                    const authorizationStartDiv            = tableDiv.appendChild(document.createElement('div'));
                        authorizationStartDiv.className  = "authorizationStart";

                    const authorizationStartIconDiv                   = authorizationStartDiv.appendChild(document.createElement('div'));
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

                    const authorizationStartIdDiv                     = authorizationStartDiv.appendChild(document.createElement('div'));
                    authorizationStartIdDiv.className               = "id";
                    authorizationStartIdDiv.innerHTML = chargingSession.authorizationStart["@id"];


                    if (chargingSession.authorizationStop != null)
                    {

                        const authorizationStopDiv            = tableDiv.appendChild(document.createElement('div'));
                            authorizationStopDiv.className  = "authorizationStop";

                        const authorizationStopIconDiv                   = authorizationStopDiv.appendChild(document.createElement('div'));
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

                        const authorizationStopIdDiv                     = authorizationStopDiv.appendChild(document.createElement('div'));
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

                    if ((chargingSession.EVSEId            || chargingSession.EVSE            ||
                         chargingSession.chargingStationId || chargingSession.chargingStation ||
                         chargingSession.chargingPoolId    || chargingSession.chargingPool) &&

                         chargingSession.EVSEId            != "DE*GEF*EVSE*CHARGY*1" &&
                         chargingSession.chargingStationId != "DE*GEF*STATION*CHARGY*1")

                    {

                        const chargingStationInfoDiv            = tableDiv.appendChild(document.createElement('div'));
                        chargingStationInfoDiv.className      = "chargingStationInfos";

                        const chargingStationIconDiv            = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationIconDiv.className      = "icon";
                        chargingStationIconDiv.innerHTML      = '<i class="fas fa-charging-station"></i>';

                        const chargingStationDiv                = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationDiv.classList.add("text");

                        if (chargingSession.EVSEId || chargingSession.EVSE) {

                            // if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                            //     chargingSession.EVSE = this.chargy.GetEVSE(chargingSession.EVSEId);
                            if (!chargingSession.EVSE)
                            {
                                const evse = this.chargy.GetEVSE(chargingSession.EVSEId);
                                if (evse)
                                    chargingSession.EVSE = evse;
                            }

                            chargingStationDiv.classList.add("EVSE");
                            chargingStationDiv.innerHTML      = (chargingSession.EVSE?.description != null
                                                                    ? this.chargy.GetLocalizedText(chargingSession.EVSE.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.EVSEId !== undefined
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
                                    //address           = chargingSession.EVSE.chargingStation.address;
                                }

                            }

                        }

                        else if (chargingSession.chargingStationId || chargingSession.chargingStation) {

                            // if (chargingSession.chargingStation == null || chargingSession.chargingStation == undefined || typeof chargingSession.chargingStation !== 'object')
                            //     chargingSession.chargingStation = this.chargy.GetChargingStation(chargingSession.chargingStationId ?? "");
                            if (!chargingSession.chargingStation)
                            {
                                const station = this.chargy.GetChargingStation(chargingSession.chargingStationId ?? "");
                                if (station)
                                    chargingSession.chargingStation = station;
                            }

                            if (chargingSession.chargingStation)
                            {

                                chargingStationDiv.classList.add("chargingStation");
                                chargingStationDiv.innerHTML      = (chargingSession.chargingStation?.description != null
                                                                        ? this.chargy.GetLocalizedText(chargingSession.chargingStation.description) + "<br />"
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

                            // if (chargingSession.chargingPool == null || chargingSession.chargingPool == undefined || typeof chargingSession.chargingPool !== 'object')
                            //     chargingSession.chargingPool = this.chargy.GetChargingPool(chargingSession.chargingPoolId ?? "");
                            if (!chargingSession.chargingPool)
                            {
                                const pool = this.chargy.GetChargingPool(chargingSession.chargingPoolId ?? "");
                                if (pool)
                                    chargingSession.chargingPool = pool;
                            }

                            if (chargingSession.chargingPool)
                            {

                                chargingStationDiv.classList.add("chargingPool");
                                chargingStationDiv.innerHTML      = (chargingSession.chargingPool?.description != null
                                                                        ? this.chargy.GetLocalizedText(chargingSession.chargingPool.description) + "<br />"
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

                    let address:chargyInterfaces.IAddress|undefined = undefined;

                    if (chargingSession.chargingStation?.address != null)
                        address = chargingSession.chargingStation.address;

                    else if (chargingSession.chargingPool?.address != null)
                        address = chargingSession.chargingPool.address;

                    if (address != null)
                    {

                        const locationInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        locationInfoDiv.className  = "locationInfos";

                        const locationIconDiv        = locationInfoDiv.appendChild(document.createElement('div'));
                        locationIconDiv.className  = "icon";
                        locationIconDiv.innerHTML  = '<i class="fas fa-map-marker-alt"></i>';

                        const locationDiv            = locationInfoDiv.appendChild(document.createElement('div'));
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

                //#region Show total costs...

                try
                {

                    if (chargingSession.totalCosts != null)
                    {

                        const costsInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        costsInfoDiv.className  = "costsInfos";

                        const costsIconDiv        = costsInfoDiv.appendChild(document.createElement('div'));
                        costsIconDiv.className  = "icon";
                        costsIconDiv.innerHTML  = '<i class="fa-solid fa-euro-sign"></i>';

                        const textDiv             = costsInfoDiv.appendChild(document.createElement('div'));
                        textDiv.classList.add("text");

                        const costsDiv            = textDiv.appendChild(document.createElement('div'));
                        costsDiv.classList.add("costs");

                        if (chargingSession.totalCosts.total != 0)
                        {

                            const totalCostsDiv      = costsDiv.appendChild(document.createElement('div'));
                            totalCostsDiv.classList.add("totalCosts");

                            const totalCostsCost     = totalCostsDiv.appendChild(document.createElement('div'));
                            totalCostsCost.classList.add("totalCost");
                            totalCostsCost.innerHTML     = chargingSession.totalCosts.total.toString();

                            const totalCostsCurrency = totalCostsDiv.appendChild(document.createElement('div'));
                            totalCostsCurrency.classList.add("totalCostCurrency");
                            totalCostsCurrency.innerHTML = chargingSession.totalCosts.currency;

                        }

                    }

                } catch (exception)
                {
                    console.log("Could not show costs of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion


                //#region Add marker to map

                // First clear the map...
                while(this.markers.length > 0)
                    this.map.removeLayer(this.markers.pop());

                const redMarker     = (L as any).AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 'exclamation',
                    markerColor:          'red',
                    iconColor:            '#ecc8c3'
                });

                const orangeMarker  = (L as any).AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 this.isWarningSession(chargingSession) ? 'exclamation' : 'question',
                    markerColor:          'orange',
                    iconColor:            '#ae6a0a'
                });

                const greenMarker   = (L as any).AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 'charging-station',
                    //markerColor:          'green',
                    //iconColor:            '#c2ec8e'
                    markerColor:          'cadetblue',
                    iconColor:            '#c1e9e0'
                });

                let markerIcon      = redMarker;

                if (chargingSession.verificationResult)
                {
                    switch (chargingSession.verificationResult.status) {

                        case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
                        case chargyInterfaces.SessionVerificationResult.InplausibleMeasurement:
                            markerIcon = orangeMarker;
                            break;

                        case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                        case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                        case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                            markerIcon = redMarker;
                            break;

                        case chargyInterfaces.SessionVerificationResult.ValidSignature:
                            markerIcon = greenMarker;
                            break;

                    }
                }

             //   if (markerIcon == null)
             //       markerIcon = L.divIcon({className: 'my-div-icon', html: "here"});

                let geoLocation = null;

                if (chargingSession.chargingPool?.geoLocation != null)
                {
                    geoLocation = chargingSession.chargingPool.geoLocation;
                }

                if (chargingSession.chargingStation?.geoLocation != null)
                {
                    geoLocation = chargingSession.chargingStation.geoLocation;
                }

                if (geoLocation     != null &&
                    geoLocation.lat != 0    &&
                    geoLocation.lng != 0 )
                {

                    const marker = markerIcon == null
                                       ? L.marker([geoLocation.lat, geoLocation.lng]).addTo(this.map)
                                       : L.marker([geoLocation.lat, geoLocation.lng], { icon: markerIcon }).addTo(this.map);

                    if (markerIcon != null)
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
                    {
                        switch (chargingSession.verificationResult.status)
                        {

                            case chargyInterfaces.SessionVerificationResult.Unvalidated:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Unvalidated"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.InplausibleMeasurement:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("sessionValidationWarningsLabel"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Public key not found"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Invalid public key"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Invalid signature"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.ValidSignature:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("ValidChargingSession"));
                                break;

                        }
                    }

                }

                //#endregion

                //#region Show verification status

                const verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                verificationStatusDiv.className = "verificationStatus";

                if (chargingSession.verificationResult)
                {
                    switch (chargingSession.verificationResult.status)
                    {

                        case chargyInterfaces.SessionVerificationResult.Unvalidated:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-question-circle"></i> ' + this.chargy.GetLocalizedMessage("Unvalidated");
                            break;

                        case chargyInterfaces.SessionVerificationResult.UnknownCTRFormat:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("Unknown charge transparency data format!");
                            break;

                        case chargyInterfaces.SessionVerificationResult.NoChargeTransparencyRecordsFound:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("No charge transparency records found!");
                            break;


                        case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("InvalidChargingSession");
                            break;

                        case chargyInterfaces.SessionVerificationResult.InplausibleMeasurement:
                            verificationStatusDiv.classList.add("warning");
                            verificationStatusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + this.chargy.GetLocalizedMessage("sessionValidationWarningsLabel");
                            break;

                        case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("Public key not found");
                            break;

                        case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                        case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("InvalidChargingSession");
                            break;

                        case chargyInterfaces.SessionVerificationResult.ValidSignature:
                            if (this.hasSessionWarnings(chargingSession)) {
                                verificationStatusDiv.classList.add("warning");
                                verificationStatusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + this.chargy.GetLocalizedMessage("sessionValidationWarningsLabel");
                            }
                            else
                                verificationStatusDiv.innerHTML = '<i class="fas fa-check-circle"></i> '    + this.chargy.GetLocalizedMessage("ValidChargingSession");
                            break;

                        default:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("InvalidChargingSession");
                            break;

                    }
                }

                //#endregion

            }

            // If there is at least one charging session show its details at once...
            if (CTR.chargingSessions.length >= 1)
                CTR.chargingSessions[0]?.GUI?.click();

            if (this.minlat ==  1000 &&
                this.maxlat == -1000 &&
                this.minlng ==  1000 &&
                this.maxlng == -1000)
            {
                this.map.setView([0, 0], 1);
            }
            else
                this.map.fitBounds([[this.minlat, this.minlng], [this.maxlat, this.maxlng]],
                                   { padding: [40, 40] });

        }

        //#endregion


        //#region Show invalid data sets

        if (CTR.invalidDataSets && CTR.invalidDataSets.length > 0)
        {

            this.invalidDataSetsScreenDiv.style.display  = "flex";

            const headlineDiv       = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            headlineDiv.id          = "description";
            headlineDiv.innerHTML   = this.chargy.GetLocalizedMessage("invalidDataSets");

            const invalidDataSetsDiv  = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            invalidDataSetsDiv.id   = "invalidDataSets";

            for (const invalidDataSet of CTR.invalidDataSets)
            {

                const result = invalidDataSet.result;

                if (chargeTransparencyRecord.IsASessionCryptoResult(result))
                {

                    const invalidDataSetDiv = chargyLib.CreateDiv(invalidDataSetsDiv, "invalidDataSet");

                    const filenameDiv = chargyLib.CreateDiv(invalidDataSetDiv, "row");
                    chargyLib.CreateDiv(filenameDiv, "key",   this.chargy.GetLocalizedMessage("fileNameLabel"));
                    chargyLib.CreateDiv(filenameDiv, "value", invalidDataSet.name);

                    const resultDiv = chargyLib.CreateDiv(invalidDataSetDiv, "row");
                    chargyLib.CreateDiv(resultDiv,   "key",   this.chargy.GetLocalizedMessage("errorLabel"));
                    const valueDiv  = chargyLib.CreateDiv(resultDiv, "value");

                    if (result.message)
                        valueDiv.innerHTML  = this.chargy.GetLocalizedText(result.message) ?? "";

                    else
                        switch (result.status)
                        {

                            case chargyInterfaces.SessionVerificationResult.InvalidSessionFormat:
                                valueDiv.innerHTML  = this.chargy.GetLocalizedMessage("invalidTransparencyFormat");
                                break;

                            default:
                                valueDiv.innerHTML  = result.status;

                        }

                }

            }

        }

        //#endregion

    }

    //#endregion








    //#region Charging progress chart helpers

    private clearChargingSessionCharts(): void
    {

        for (const chart of this.chargingSessionCharts)
            chart.destroy();

        this.chargingSessionCharts.length = 0;

    }

    private getMeasurementValueInKWh(measurement:       chargeTransparencyRecord.IMeasurement,
                                     measurementValue:  chargeTransparencyRecord.IMeasurementValue): Decimal
    {

        const value = measurementValue.value.times(Math.pow(10, measurement.scale));

        switch (measurement.unit)
        {

            case "kWh":
            case "KILO_WATT_HOURS":
                return value;

            default:
                return value.div(1000);

        }

    }

    private formatChargingProgressTimestamp(timestamp: number): string
    {

        return chargyLib.parseUTC(new Date(timestamp).toISOString()).format('HH:mm:ss');

    }

    private isValidMeasurementValueSignature(measurementValue: chargeTransparencyRecord.IMeasurementValue): boolean
    {

        switch (measurementValue.result?.status)
        {

            case chargyInterfaces.VerificationResult.ValidSignature:
            case chargyInterfaces.VerificationResult.ValidStartValue:
            case chargyInterfaces.VerificationResult.ValidIntermediateValue:
            case chargyInterfaces.VerificationResult.ValidStopValue:
                return true;

            default:
                return false;

        }

    }

    private getMeasurementValueSignatureStatusText(measurementValue: chargeTransparencyRecord.IMeasurementValue): string
    {

        if (measurementValue.result == null)
            return this.chargy.GetLocalizedMessage("Invalid signature");

        switch (measurementValue.result.status)
        {

            case chargyInterfaces.VerificationResult.ValidationError:

                if      (measurementValue.errors                    &&
                         measurementValue.errors.length         > 0 &&
                         measurementValue.errors[0]            != null)
                    return measurementValue.errors[0].toString();

                else if (measurementValue.result.errors             &&
                         measurementValue.result.errors.length  > 0 &&
                         measurementValue.result.errors[0]     != null)
                    return measurementValue.result.errors[0].toString();

                return this.chargy.GetLocalizedMessage("GeneralError");

            case chargyInterfaces.VerificationResult.UnknownCTRFormat:
                return this.chargy.GetLocalizedMessage("Unknown charge transparency data format!");

            case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                return this.chargy.GetLocalizedMessage("Energy meter not found");

            case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                return this.chargy.GetLocalizedMessage("Public key not found");

            case chargyInterfaces.VerificationResult.InvalidPublicKey:
                return this.chargy.GetLocalizedMessage("Invalid public key");

            case chargyInterfaces.VerificationResult.InvalidSignature:
                return this.chargy.GetLocalizedMessage("Invalid signature");

            case chargyInterfaces.VerificationResult.InvalidStartValue:
                return this.chargy.GetLocalizedMessage("Invalid start value");

            case chargyInterfaces.VerificationResult.InvalidIntermediateValue:
                return this.chargy.GetLocalizedMessage("Invalid intermediate value");

            case chargyInterfaces.VerificationResult.InvalidStopValue:
                return this.chargy.GetLocalizedMessage("Invalid stop value");

            case chargyInterfaces.VerificationResult.NoOperation:
                return this.chargy.GetLocalizedMessage("Meter value");

            case chargyInterfaces.VerificationResult.StartValue:
                return this.chargy.GetLocalizedMessage("Start value");

            case chargyInterfaces.VerificationResult.IntermediateValue:
                return this.chargy.GetLocalizedMessage("Intermediate value");

            case chargyInterfaces.VerificationResult.StopValue:
                return this.chargy.GetLocalizedMessage("End value");

            case chargyInterfaces.VerificationResult.ValidSignature:
                return this.chargy.GetLocalizedMessage("Valid signature");

            case chargyInterfaces.VerificationResult.ValidStartValue:
                return this.chargy.GetLocalizedMessage("Valid start value");

            case chargyInterfaces.VerificationResult.ValidIntermediateValue:
                return this.chargy.GetLocalizedMessage("Valid intermediate value");

            case chargyInterfaces.VerificationResult.ValidStopValue:
                return this.chargy.GetLocalizedMessage("Valid stop value");

            default:
                return this.chargy.GetLocalizedMessage("Invalid signature");

        }

    }

    private getChargingProgressChartData(measurement:  chargeTransparencyRecord.IMeasurement,
                                         mode:         ChargingProgressChartMode): ChargingProgressChartData | null
    {

        if (measurement.values.length <= 2)
            return null;

        const points: ChargingProgressChartPoint[] = [];
        const tickTimestamps: number[] = [];
        const tickStatuses: ChargingProgressTickStatus[] = [];
        let   previousValue: Decimal | null = null;
        let   previousTimestamp: number | null = null;

        for (const measurementValue of measurement.values)
        {

            const currentValue     = this.getMeasurementValueInKWh(measurement, measurementValue);
            const currentTimestamp = chargyLib.parseUTC(measurementValue.timestamp).valueOf();

            tickTimestamps.push(currentTimestamp);
            tickStatuses.push({
                timestamp:        currentTimestamp,
                isValidSignature: this.isValidMeasurementValueSignature(measurementValue)
            });

            if (previousValue     !== null &&
                previousTimestamp !== null)
            {
                const chargedEnergy = currentValue.minus(previousValue);
                const elapsedHours  = (currentTimestamp - previousTimestamp) / 3600000;
                const chartValue    = mode === "power" && elapsedHours > 0
                                          ? chargedEnergy.div(elapsedHours)
                                          : chargedEnergy;

                points.push({
                    x:                   previousTimestamp + (currentTimestamp - previousTimestamp) / 2,
                    y:                   parseFloat(chartValue.toFixed(3)),
                    start:               previousTimestamp,
                    end:                 currentTimestamp,
                    intervalLabel:       this.formatChargingProgressTimestamp(previousTimestamp) + " - " +
                                         this.formatChargingProgressTimestamp(currentTimestamp),
                    isValidSignature:    this.isValidMeasurementValueSignature(measurementValue),
                    signatureStatusText: this.getMeasurementValueSignatureStatusText(measurementValue)
                });
            }

            previousValue     = currentValue;
            previousTimestamp = currentTimestamp;

        }

        if (points.length === 0)
            return null;

        return mode === "power"
            ? {
                  points,
                  tickTimestamps,
                  tickStatuses,
                  unit:         "KW",
                  datasetLabel: this.chargy.GetLocalizedMessage("chargingProgressPowerDatasetLabel"),
                  yAxisLabel:   this.chargy.GetLocalizedMessage("chargingProgressPowerYAxisLabel")
              }
            : {
                  points,
                  tickTimestamps,
                  tickStatuses,
                  unit:         "kWh",
                  datasetLabel: this.chargy.GetLocalizedMessage("chargingProgressEnergyDatasetLabel"),
                  yAxisLabel:   this.chargy.GetLocalizedMessage("chargingProgressEnergyYAxisLabel")
              };

    }

    private createChargingProgressChart(chartFrame:   HTMLDivElement,
                                        measurement:  chargeTransparencyRecord.IMeasurement,
                                        mode:         ChargingProgressChartMode): ChargingProgressChart | null
    {

        const chartData = this.getChargingProgressChartData(measurement, mode);

        if (!chartData)
            return null;

        const canvas                  = chartFrame.appendChild(document.createElement('canvas'));
        const unit                    = chartData.unit;
        const lastTickIndex           = chartData.tickTimestamps.length - 1;
        const lastTickTimestamp       = chartData.tickTimestamps[lastTickIndex]!;
        const previousTickTimestamp   = chartData.tickTimestamps[lastTickIndex - 1] ?? lastTickTimestamp;
        const rightAxisPadding        = Math.max(1, lastTickTimestamp - previousTickTimestamp) * 0.35;
        const intervalBarPlugin: Plugin<'bar'> = {
            id: "chargingProgressIntervalBars",
            afterBuildTicks: (_chart, args): void => {

                if (args.scale.id === "x")
                    args.scale.ticks = chartData.tickTimestamps.map(timestamp => ({ value: timestamp }));

            },
            beforeDatasetsDraw: (chart): void => {

                const xScale = chart.scales["x"];
                const meta   = chart.getDatasetMeta(0);

                if (xScale == null)
                    return;

                meta.data.forEach((element, index) => {

                    const point = chartData.points[index];

                    if (point == null)
                        return;

                    const startX = xScale.getPixelForValue(point.start);
                    const endX   = xScale.getPixelForValue(point.end);
                    const bar    = element as unknown as { x: number; width: number };

                    bar.x     = startX + (endX - startX) / 2;
                    bar.width = Math.max(1, Math.abs(endX - startX));

                });

            },
            afterDraw: (chart): void => {

                const xScale = chart.scales["x"];

                if (xScale == null)
                    return;

                const ctx        = chart.ctx;
                const radius     = 6;
                const tickCenterY = chart.chartArea.bottom + 18;

                ctx.save();
                ctx.font         = "11px sans-serif";
                ctx.textBaseline = "middle";

                for (const tickStatus of chartData.tickStatuses)
                {

                    const tickLabel   = this.formatChargingProgressTimestamp(tickStatus.timestamp);
                    const tickX       = xScale.getPixelForValue(tickStatus.timestamp);
                    const textWidth   = ctx.measureText(tickLabel).width;
                    const iconCenterX = Math.min(
                                            chart.width - radius - 2,
                                            tickX + textWidth / 2 + radius + 5
                                        );

                    ctx.beginPath();
                    ctx.fillStyle = tickStatus.isValidSignature
                                        ? "#5aad31"
                                        : "#d94841";
                    ctx.arc(iconCenterX, tickCenterY, radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth   = 1.7;
                    ctx.lineCap     = "round";
                    ctx.lineJoin    = "round";
                    ctx.beginPath();

                    if (tickStatus.isValidSignature)
                    {
                        ctx.moveTo(iconCenterX - 3.2, tickCenterY - 0.2);
                        ctx.lineTo(iconCenterX - 1.0, tickCenterY + 2.3);
                        ctx.lineTo(iconCenterX + 3.4, tickCenterY - 3.0);
                    }
                    else
                    {
                        ctx.moveTo(iconCenterX - 2.6, tickCenterY - 2.6);
                        ctx.lineTo(iconCenterX + 2.6, tickCenterY + 2.6);
                        ctx.moveTo(iconCenterX + 2.6, tickCenterY - 2.6);
                        ctx.lineTo(iconCenterX - 2.6, tickCenterY + 2.6);
                    }

                    ctx.stroke();
                    ctx.font = "11px sans-serif";

                }

                ctx.restore();

            }
        };

        const chart = new Chart(canvas, {
            type: 'bar',
            data: {
                datasets: [{
                    label:           chartData.datasetLabel,
                    data:            chartData.points as unknown as number[],
                    backgroundColor: "rgba(48, 126, 181, 0.72)",
                    borderColor:     "rgba(44, 74, 96, 0.95)",
                    borderWidth:     1,
                    borderRadius:    0,
                    borderSkipped:   false,
                    categoryPercentage: 1,
                    barPercentage:      1
                }]
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        right: 18
                    }
                },
                parsing: {
                    xAxisKey: "x",
                    yAxisKey: "y"
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            title: (context: Array<TooltipItem<'bar'>>): string => {
                                const raw = context[0]?.raw as ChargingProgressChartPoint | undefined;
                                return raw?.intervalLabel ?? "";
                            },
                            label: (context: TooltipItem<'bar'>): string[] => {
                                const value = typeof context.parsed.y === "number"
                                    ? context.parsed.y
                                    : Number(context.raw);
                                const raw = context.raw as ChargingProgressChartPoint | undefined;
                                const valueText = mode === "power"
                                    ? "Ø " + value.toString() + " " + unit
                                    : (value >= 0 ? "+" : "") + value.toString() + " " + unit;

                                return [
                                    valueText,
                                    (raw?.isValidSignature === true ? "✅ " : "❌ ") +
                                    (raw?.signatureStatusText ?? this.chargy.GetLocalizedMessage("Invalid signature"))
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: "linear",
                        min:  chartData.tickTimestamps[0],
                        max:  lastTickTimestamp + rightAxisPadding,
                        offset: false,
                        grid: {
                            offset: false
                        },
                        ticks: {
                            callback: (value): string => {
                                const timestamp = typeof value === "number"
                                    ? value
                                    : parseFloat(value);
                                return Number.isFinite(timestamp)
                                    ? this.formatChargingProgressTimestamp(timestamp)
                                    : value.toString();
                            }
                        },
                        title: {
                            display: true,
                            text:    this.chargy.GetLocalizedMessage("Timestamp")
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text:    chartData.yAxisLabel + " (" + unit + ")"
                        }
                    }
                }
            },
            plugins: [
                intervalBarPlugin
            ]
        });

        this.chargingSessionCharts.push(chart);
        return chart;

    }

    private createMeasurementValuesViewLinks(viewLinksDiv:          HTMLDivElement,
                                             measurementRowsDiv:    HTMLDivElement,
                                             chartDiv:              HTMLDivElement,
                                             chartFrame:            HTMLDivElement,
                                             measurement:           chargeTransparencyRecord.IMeasurement): void
    {

        let   chart: ChargingProgressChart | null = null;

        const showRows = (): void => {
            this.measurementValuesViewMode = "measurements";
            measurementRowsDiv.style.display = "";
            chartDiv.style.display           = "none";
            setActive(measurementsButton);
        };

        const showChart = (mode: ChargingProgressChartMode, button: HTMLButtonElement): void => {

            this.measurementValuesViewMode   = mode;
            measurementRowsDiv.style.display = "none";
            chartDiv.style.display           = "block";

            if (chart !== null) {
                chart.destroy();

                const chartIndex = this.chargingSessionCharts.indexOf(chart);
                if (chartIndex >= 0)
                    this.chargingSessionCharts.splice(chartIndex, 1);

                chartFrame.innerHTML = "";
            }

            chart = this.createChargingProgressChart(chartFrame, measurement, mode);
            setActive(button);

        };

        const setActive = (activeButton: HTMLButtonElement): void => {
            for (const button of [ measurementsButton, energyButton, powerButton ]) {
                button.classList.toggle("activated", button === activeButton);
                button.disabled = button === activeButton;
            }
        };

        const measurementsButton       = viewLinksDiv.appendChild(document.createElement('button'));
        measurementsButton.type        = "button";
        measurementsButton.className   = "viewLink";
        measurementsButton.textContent = this.chargy.GetLocalizedMessage("Meter Values");

        const energyButton             = viewLinksDiv.appendChild(document.createElement('button'));
        energyButton.type              = "button";
        energyButton.className         = "viewLink";
        energyButton.textContent       = this.chargy.GetLocalizedMessage("chargingProgressEnergyLinkLabel");

        const powerButton              = viewLinksDiv.appendChild(document.createElement('button'));
        powerButton.type               = "button";
        powerButton.className          = "viewLink";
        powerButton.textContent        = this.chargy.GetLocalizedMessage("chargingProgressPowerLinkLabel");

        measurementsButton.onclick = showRows;
        energyButton.onclick       = () => showChart("energy", energyButton);
        powerButton.onclick        = () => showChart("power",  powerButton);

        chartDiv.style.display = "none";

        switch (this.measurementValuesViewMode)
        {

            case "energy":
                showChart("energy", energyButton);
                break;

            case "power":
                showChart("power", powerButton);
                break;

            default:
                showRows();
                break;

        }

    }

    //#endregion












    //#region showChargingSessionDetails    (chargingSession)

    private async showChargingSessionDetails(chargingSession: chargeTransparencyRecord.IChargingSession)
    {

        try
        {

            this.clearChargingSessionCharts();
            this.detailedInfosDiv.innerHTML = "";

            if (chargingSession.measurements)
            {
                for (const measurement of chargingSession.measurements)
                {

                    measurement.chargingSession         = chargingSession;

                    const detailedInfosHeadlineDiv      = this.detailedInfosDiv.appendChild(document.createElement('div'));
                    detailedInfosHeadlineDiv.className  = "headline";
                    detailedInfosHeadlineDiv.innerHTML  = this.chargy.GetLocalizedMessage("Charging Session Information");

                    //#region Show Charging Station Infos

                    if (measurement.chargingSession.chargingStation != null &&
                       (measurement.chargingSession.chargingStation["@id"] !== "DE*GEF*STATION*CHARGY*1" ||
                        measurement.chargingSession.chargingStation.manufacturer                         ||
                        measurement.chargingSession.chargingStation.model                                ||
                        measurement.chargingSession.chargingStation.serialNumber                         ||
                        measurement.chargingSession.chargingStation.firmwareVersion                      ||
                        measurement.chargingSession.chargingStation.legalCompliance))
                    {

                        const chargingStationInfosDiv  = chargyLib.CreateDiv(this.detailedInfosDiv,  "chargingStationInfos");
                                                         chargyLib.CreateDiv(chargingStationInfosDiv,  "headline2",
                                                                             this.chargy.GetLocalizedMessage("Charging Station"));

                        if (measurement.chargingSession.chargingStation["@id"] &&
                            measurement.chargingSession.chargingStation["@id"].length > 0 &&
                            measurement.chargingSession.chargingStation["@id"] !== "DE*GEF*STATION*CHARGY*1")
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "chargingStationId",
                                                 this.chargy.GetLocalizedMessage("Identification"),
                                                 measurement.chargingSession.chargingStation["@id"]);
                        }

                        if (measurement.chargingSession.chargingStation.manufacturer &&
                            measurement.chargingSession.chargingStation.manufacturer.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "manufacturer",
                                                 this.chargy.GetLocalizedMessage("Manufacturer"),
                                                 measurement.chargingSession.chargingStation.manufacturer);
                        }

                        if (measurement.chargingSession.chargingStation.model &&
                            measurement.chargingSession.chargingStation.model.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "model",
                                                 this.chargy.GetLocalizedMessage("Model"),
                                                 measurement.chargingSession.chargingStation.model);
                        }

                        if (measurement.chargingSession.chargingStation.serialNumber &&
                            measurement.chargingSession.chargingStation.serialNumber.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "serialNumber",
                                                 this.chargy.GetLocalizedMessage("Serial Number"),
                                                 measurement.chargingSession.chargingStation.serialNumber);
                        }

                        if (measurement.chargingSession.chargingStation.firmwareVersion &&
                            measurement.chargingSession.chargingStation.firmwareVersion.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "firmwareVersion",
                                                 this.chargy.GetLocalizedMessage("Firmware Version"),
                                                 measurement.chargingSession.chargingStation.firmwareVersion);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance?.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "legalCompliance",
                                                 this.chargy.GetLocalizedMessage("Legal Compliance"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.freeText);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance?.conformity &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity.length > 0 &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity[0]?.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity[0]?.freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "conformity",
                                                 this.chargy.GetLocalizedMessage("Conformity"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.conformity[0].freeText);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance?.calibration &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration.length > 0 &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration[0]?.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration[0]?.freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "calibration",
                                                 this.chargy.GetLocalizedMessage("Calibration"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.calibration[0].freeText);
                        }

                    }

                    //#endregion

                    //#region Show Energy Meter Infos...

                    //#region Show Energy Meter details...

                    const energyMeterInfosDiv = chargyLib.CreateDiv(this.detailedInfosDiv, "energyMeterInfos");
                                                chargyLib.CreateDiv(energyMeterInfosDiv, "headline2",
                                                                    this.chargy.GetLocalizedMessage("Energy Meter"));

                    const meter = this.chargy.GetMeter(measurement.energyMeterId);
                    if (meter != null)
                    {

                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterId",
                                                 this.chargy.GetLocalizedMessage("Serial Number"),
                                                 measurement.energyMeterId);

                        if (meter.manufacturer && meter.manufacturer.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterManufacturer",
                                                 this.chargy.GetLocalizedMessage("Manufacturer"),
                                                 meter.manufacturer);

                        if (meter.model && meter.model.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterModel",
                                                 this.chargy.GetLocalizedMessage("Model"),
                                                 meter.model);

                        if (meter.hardwareVersion && meter.hardwareVersion.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterHardwareVersion",
                                                 this.chargy.GetLocalizedMessage("Hardware Version"),
                                                 meter.hardwareVersion);

                        if (meter.firmwareVersion && meter.firmwareVersion.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterFirmwareVersion",
                                                 this.chargy.GetLocalizedMessage("Firmware Version"),
                                                 meter.firmwareVersion);

                    }

                    //#endregion

                    //#region ...or just show the Energy Meter Identification

                    else
                        chargyLib.CreateDiv2(energyMeterInfosDiv, "meterId",
                                             this.chargy.GetLocalizedMessage("Meter serial number"),
                                             measurement.energyMeterId);

                    //#endregion

                    //#region Show measurement infos

                    chargyLib.CreateDiv2(energyMeterInfosDiv, "measurement",
                                         this.chargy.GetLocalizedMessage("Measurement"),
                                         (measurement.phenomena?.[0] as MeasurementPhenomenon | undefined)?.name ?? measurement.name);

                    chargyLib.CreateDiv2(energyMeterInfosDiv, "OBIS",
                                         this.chargy.GetLocalizedMessage("OBIS code"),
                                         (measurement.phenomena?.[0] as MeasurementPhenomenon | undefined)?.obis ?? measurement.obis);

                    //#endregion

                    //#endregion

                    //#region Show charging tariffs...

                    if (chargingSession.chargingTariffs && chargingSession.chargingTariffs.length > 0)
                    {

                        // Should we also test whether the charging periods are valid?

                        const tariffInfosDiv = chargyLib.CreateDiv(this.detailedInfosDiv,  "chargingTariffsInfos");
                                               chargyLib.CreateDiv(tariffInfosDiv,  "headline2",
                                                                   this.chargy.GetLocalizedMessage("Charging Tariffs"));

                        const tariffTableDiv       = tariffInfosDiv.appendChild(document.createElement('div'));
                        tariffTableDiv.classList.add("tariffsTable");

                        for (const tariff of chargingSession.chargingTariffs)
                        {

                            var chargingPeriodRow      = tariffTableDiv.appendChild(document.createElement('div'));
                            chargingPeriodRow.classList.add("chargingTariffRow");
                            chargingPeriodRow.onclick  = () => {
                                this.showChargingTariffDetails(tariff);
                            };

                            const tariffShortName        = chargingPeriodRow.appendChild(document.createElement('div'));
                            tariffShortName.classList.add("shortName");
                            tariffShortName.innerHTML  = tariff.shortName && Object.keys(tariff.shortName).length > 0
                                                                ? tariff.shortName[this.UILanguage] ?? tariff["@id"] ?? ""
                                                                : tariff["@id"] ?? "";

                            if (tariff.summary && Object.keys(tariff.summary).length > 0)
                            {
                                const tariffSummary        = chargingPeriodRow.appendChild(document.createElement('div'));
                                tariffSummary.classList.add("summary");
                                tariffSummary.innerText  = tariff.summary[this.UILanguage] ?? "";
                            }

                        }

                    }

                    //#endregion

                    //#region Show charging periods (when more than one exists)

                    if (chargingSession.chargingPeriods && chargingSession.chargingPeriods.length > 1)
                    {

                        const totalCostsDiv          = chargyLib.CreateDiv(this.detailedInfosDiv,  "chargingPeriodsInfos");
                                                       chargyLib.CreateDiv(totalCostsDiv,  "headline2",
                                                                           this.chargy.GetLocalizedMessage("Charging Periods"));

                        const chargingPeriodsTableDiv  = totalCostsDiv.appendChild(document.createElement('div'));
                        chargingPeriodsTableDiv.classList.add("chargingPeriodsTable");

                        for (let i=0; i<chargingSession.chargingPeriods.length; i++)
                        {

                            const chargingPeriod = chargingSession.chargingPeriods[i];

                            if (chargingPeriod)
                            {

                                var chargingPeriodRow        = chargingPeriodsTableDiv.appendChild(document.createElement('div'));
                                chargingPeriodRow.classList.add("chargingPeriodRow");
                                chargingPeriodRow.onclick    = () => {
                                    this.showChargingPeriodDetails(chargingPeriod);
                                };

                                const startTimestmapDiv      = chargingPeriodRow.appendChild(document.createElement('div'));
                                startTimestmapDiv.classList.add("startTimestamp");
                                startTimestmapDiv.innerHTML  = chargyLib.parseUTC(chargingPeriod.startTimestamp).format('DD.MM.YYYY HH:mm:ss');

                                const duration = this.moment.duration(
                                                      chargyLib.parseUTC(chargingPeriod.endTimestamp  ??
                                                      chargingPeriod.stopTimestamp ??
                                                      chargingSession.chargingPeriods[i+1]?.startTimestamp ??
                                                      "").valueOf()
                                                       -
                                                      chargyLib.parseUTC(chargingPeriod.startTimestamp).valueOf()
                                                  );

                                const durationDiv            = chargingPeriodRow.appendChild(document.createElement('div'));
                                durationDiv.classList.add("duration");
                                durationDiv.innerHTML        = duration.hours() + "h " + duration.minutes() + "m" + duration.seconds() + "s";

                            }

                        }

                    }

                    //#endregion

                    //#region Show charging total costs

                    if (chargingSession.totalCosts)
                    {

                        const totalCostsDiv     = chargyLib.CreateDiv(this.detailedInfosDiv,  "totalCosts");
                                                  chargyLib.CreateDiv(totalCostsDiv,  "headline2",
                                                                      this.chargy.GetLocalizedMessage("Total Costs"));

                        const costsTableDiv       = totalCostsDiv.appendChild(document.createElement('div'));
                        costsTableDiv.classList.add("costsTable");

                        if (chargingSession.totalCosts.reservation?.cost != null)
                        {

                            const reservationCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            reservationCostsRow.classList.add("costsRow");

                            const reservationCostsType     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsType.classList.add("type");
                            reservationCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Reservation");

                            const reservationCostsAmount   = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsAmount.classList.add("amount");
                            reservationCostsAmount.innerHTML  = chargingSession.totalCosts.reservation.amount.toString();

                            const reservationCostsUnit     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsUnit.classList.add("unit");
                            reservationCostsUnit.innerHTML    = chargingSession.totalCosts.reservation.unit;

                            const reservationCostsCost     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsCost.classList.add("cost");
                            reservationCostsCost.innerHTML   = chargingSession.totalCosts.reservation.cost.toString();

                            const reservationCostsCurrency = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsCurrency.classList.add("currency");
                            reservationCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.energy?.cost != null)
                        {

                            const energyCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            energyCostsRow.classList.add("costsRow");

                            const energyCostsType     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsType.classList.add("type");
                            energyCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Energy");

                            const energyCostsAmount   = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsAmount.classList.add("amount");
                            energyCostsAmount.innerHTML  = chargingSession.totalCosts.energy.amount.toString();

                            const energyCostsUnit     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsUnit.classList.add("unit");
                            energyCostsUnit.innerHTML    = chargingSession.totalCosts.energy.unit;

                            const energyCostsCost     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsCost.classList.add("cost");
                            energyCostsCost.innerHTML   = chargingSession.totalCosts.energy.cost.toString();

                            const energyCostsCurrency = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsCurrency.classList.add("currency");
                            energyCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.time?.cost != null)
                        {

                            const timeCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            timeCostsRow.classList.add("costsRow");

                            const timeCostsType     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsType.classList.add("type");
                            timeCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Time");

                            const timeCostsAmount   = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsAmount.classList.add("amount");
                            timeCostsAmount.innerHTML  = chargingSession.totalCosts.time.amount.toString();

                            const timeCostsUnit     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsUnit.classList.add("unit");
                            timeCostsUnit.innerHTML    = chargingSession.totalCosts.time.unit;

                            const timeCostsCost     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsCost.classList.add("cost");
                            timeCostsCost.innerHTML   = chargingSession.totalCosts.time.cost.toString();

                            const timeCostsCurrency = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsCurrency.classList.add("currency");
                            timeCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.idle?.cost != null)
                        {

                            const idleCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            idleCostsRow.classList.add("costsRow");

                            const idleCostsType     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsType.classList.add("type");
                            idleCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Idle");

                            const idleCostsAmount   = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsAmount.classList.add("amount");
                            idleCostsAmount.innerHTML  = chargingSession.totalCosts.idle.amount.toString();

                            const idleCostsUnit     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsUnit.classList.add("unit");
                            idleCostsUnit.innerHTML    = chargingSession.totalCosts.idle.unit;

                            const idleCostsCost     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsCost.classList.add("cost");
                            idleCostsCost.innerHTML   = chargingSession.totalCosts.idle.cost.toString();

                            const idleCostsCurrency = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsCurrency.classList.add("currency");
                            idleCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.flat?.cost != null)
                        {

                            const flatCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            flatCostsRow.classList.add("costsRow");

                            const flatCostsType     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsType.classList.add("type");
                            flatCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Flat");

                            const flatCostsAmount   = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsAmount.classList.add("amount");

                            const flatCostsUnit     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsUnit.classList.add("unit");

                            const flatCostsCost     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsCost.classList.add("cost");
                            flatCostsCost.innerHTML   = chargingSession.totalCosts.flat.cost.toString();

                            const flatCostsCurrency = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsCurrency.classList.add("currency");
                            flatCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                    }

                    //#endregion

                    //#region Show measurement values...

                    if (measurement.values.length > 0)
                    {

                        let   measurementCounter    = 0;
                        let   previousValue         = new Decimal(0);

                        const measurementValuesDiv  = chargyLib.CreateDiv(this.detailedInfosDiv, "measurementValues");
                                                      chargyLib.CreateDiv(measurementValuesDiv,  "headline2",
                                                                          this.chargy.GetLocalizedMessage("Meter Values"));

                        const viewLinksDiv          = measurement.values.length > 2
                                                          ? chargyLib.CreateDiv(measurementValuesDiv, "measurementValueViews")
                                                          : null;
                        const measurementRowsDiv    = chargyLib.CreateDiv(measurementValuesDiv, "measurementValueRows");

                        if (viewLinksDiv !== null)
                        {

                            const chartDiv   = chargyLib.CreateDiv(measurementValuesDiv, "chargingProgressChart");
                            const chartFrame = chargyLib.CreateDiv(chartDiv,             "chartFrame");

                            this.createMeasurementValuesViewLinks(
                                viewLinksDiv,
                                measurementRowsDiv,
                                chartDiv,
                                chartFrame,
                                measurement
                            );

                        }

                        for (const measurementValue of measurement.values)
                        {

                            measurementCounter++;
                            measurementValue.measurement  = measurement;

                            const measurementValueDiv     = chargyLib.CreateDiv(measurementRowsDiv, "measurementValue");
                            measurementValueDiv.onclick   = (): void => {
                                this.showMeasurementCryptoDetails(measurementValue);
                            };

                            //#region Show the timestamp

                            chargyLib.CreateDiv(measurementValueDiv, "timestamp",
                                                chargyLib.parseUTC(measurementValue.timestamp).format('HH:mm:ss') + " Uhr");

                            //#endregion

                            //#region Show current energy value

                            let currentValue  = measurementValue.value.times(Math.pow(10, measurementValue.measurement.scale));

                            // Display the energy value differently from its native energy meter representation.
                            // This can be a regulatory requirement based on the calibration law.
                            if (measurementValue.value_displayPrefix &&
                                measurementValue.value_displayPrecision)
                            {
                                if (measurement.unit === "kWh" || measurement.unit === "KILO_WATT_HOURS")
                                {
                                    switch (measurementValue.value_displayPrefix)
                                    {
                                        case chargyInterfaces.DisplayPrefixes.KILO:
                                            currentValue = new Decimal((currentValue                ).toFixed(measurementValue.value_displayPrecision));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.MEGA:
                                            currentValue = new Decimal((currentValue.div(      1000)).toFixed(measurementValue.value_displayPrecision));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.GIGA:
                                            currentValue = new Decimal((currentValue.div(   1000000)).toFixed(measurementValue.value_displayPrecision));
                                            break;
                                        default:
                                            currentValue = new Decimal((currentValue.times(    1000)).toFixed(measurementValue.value_displayPrecision));
                                    }
                                }
                                else // Wh
                                {
                                    switch (measurementValue.value_displayPrefix)
                                    {
                                        case chargyInterfaces.DisplayPrefixes.KILO:
                                            currentValue = new Decimal((currentValue.div(      1000).toFixed(measurementValue.value_displayPrecision)));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.MEGA:
                                            currentValue = new Decimal((currentValue.div(   1000000).toFixed(measurementValue.value_displayPrecision)));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.GIGA:
                                            currentValue = new Decimal((currentValue.div(1000000000).toFixed(measurementValue.value_displayPrecision)));
                                            break;
                                        default:
                                            currentValue = new Decimal((currentValue               ).toFixed(measurementValue.value_displayPrecision));
                                    }
                                }
                            }
                            else
                            {
                                //currentValue = new Decimal(currentValue.toFixed(Math.abs(measurementValue.measurement.scale)));
                            }

                            // Show energy value
                            chargyLib.CreateDiv(measurementValueDiv, "value1",
                                                currentValue.toString());

                            //#endregion

                            //#region Show energy unit (kWh or Wh...)

                            // Display the energy unit differently from its native energy meter representation.
                            // This can be a regulatory requirement based on the calibration law.
                            if (measurementValue.value_displayPrefix)
                            {
                                switch (measurementValue.value_displayPrefix)
                                {

                                    case chargyInterfaces.DisplayPrefixes.KILO:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "kWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.MEGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "MWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.GIGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "GWh");
                                        break;

                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "Wh");
                                        break;

                                }
                            }
                            else
                            {
                                switch (measurement.unit)
                                {

                                    case "kWh":
                                    case "KILO_WATT_HOURS":
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "kWh");
                                        break;

                                    // "WATT_HOURS"
                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "Wh");
                                        break;

                                }
                            }

                            //#endregion

                            //#region Show energy difference

                            // Difference (will use the same DisplayPrefix like the plain value!)
                            chargyLib.CreateDiv(measurementValueDiv, "value2",
                                      measurementCounter > 1
                                          ? (currentValue.minus(previousValue).toNumber() >= 0 ? "+" : "") +
                                            (measurementValue.value_displayPrecision
                                                 ? parseFloat((currentValue.minus(previousValue)).toFixed(Math.abs(measurementValue.value_displayPrecision)))
                                                 //: parseFloat((currentValue.minus(previousValue)).toFixed(Math.abs(measurementValue.measurement.scale))))
                                                 : parseFloat((currentValue.minus(previousValue)).toString()))
                                          : "0");

                            // Unit
                            if (measurementCounter <= 1)
                                chargyLib.CreateDiv(measurementValueDiv, "unit2",  "");

                            else if (measurementValue.value_displayPrefix)
                            {
                                switch (measurementValue.value_displayPrefix)
                                {

                                    case chargyInterfaces.DisplayPrefixes.GIGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2", "GWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.MEGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2", "MWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.KILO:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2", "kWh");
                                        break;

                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2",  "Wh");
                                        break;

                                }
                            }
                            else
                            {
                                switch (measurement.unit)
                                {

                                    case "kWh":
                                    case "KILO_WATT_HOURS":
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "kWh");
                                        break;

                                    // "WATT_HOURS"
                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "Wh");
                                        break;

                                }
                            }

                            previousValue = currentValue;

                            //#endregion

                            //#region Show signature status

                            let icon = '<i class="fas fa-times-circle"></i> Ungültige Signatur';

                            if (measurementValue.result)
                                switch (measurementValue.result.status)
                                {

                                    case chargyInterfaces.VerificationResult.ValidationError:

                                        icon = '<i class="fas fa-times-circle"></i> ';

                                        // Format validation errors...
                                        if      (measurementValue.errors                    &&
                                                 measurementValue.errors.length         > 0 &&
                                                 measurementValue.errors[0]            != null)
                                            icon += measurementValue.errors[0];

                                        // Validation errors...
                                        else if (measurementValue.result?.errors             &&
                                                 measurementValue.result.errors.length  > 0 &&
                                                 measurementValue.result.errors[0]     != null)
                                            icon += measurementValue.result.errors[0];

                                        else
                                            icon += this.chargy.GetLocalizedMessage("GeneralError");

                                        break;

                                    case chargyInterfaces.VerificationResult.UnknownCTRFormat:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Unknown charge transparency data format!");
                                        break;

                                    case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Energy meter not found");
                                        break;

                                    case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Public key not found");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidPublicKey:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid public key");
                                        break;


                                    case chargyInterfaces.VerificationResult.InvalidSignature:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid signature");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidStartValue:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid start value");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidIntermediateValue:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid intermediate value");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidStopValue:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid stop value");
                                        break;


                                    case chargyInterfaces.VerificationResult.NoOperation:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("Meter value") + '</div>';
                                        break;

                                    case chargyInterfaces.VerificationResult.StartValue:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("Start value") + '</div>';
                                        break;

                                    case chargyInterfaces.VerificationResult.IntermediateValue:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("Intermediate value") + '</div>';
                                        break;

                                    case chargyInterfaces.VerificationResult.StopValue:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("End value") + '</div>';
                                        break;


                                    case chargyInterfaces.VerificationResult.ValidSignature:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid signature");
                                        break;

                                    case chargyInterfaces.VerificationResult.ValidStartValue:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid start value");
                                        break;

                                    case chargyInterfaces.VerificationResult.ValidIntermediateValue:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid intermediate value");
                                        break;

                                    case chargyInterfaces.VerificationResult.ValidStopValue:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid stop value");
                                        break;

                                }

                            chargyLib.CreateDiv(
                                measurementValueDiv,
                                "verificationStatus",
                                icon
                            );

                            //#endregion

                        }

                    }

                    const sessionWarnings = this.getSessionWarnings(chargingSession);

                    if (sessionWarnings.length > 0) {

                        const validationWarningsDiv = chargyLib.CreateDiv(this.detailedInfosDiv, "sessionValidationWarnings");
                        chargyLib.CreateDiv(validationWarningsDiv, "headline2",
                                            this.chargy.GetLocalizedMessage("sessionValidationLabel"));

                        const warningRowsDiv = chargyLib.CreateDiv(validationWarningsDiv, "warningRows");

/*                         const headerRowDiv = chargyLib.CreateDiv(warningRowsDiv, "warningRow header");
                        chargyLib.CreateDiv(headerRowDiv, "level",
                                            this.chargy.GetLocalizedMessage("warningLevelLabel"));
                        chargyLib.CreateDiv(headerRowDiv, "text",
                                            this.chargy.GetLocalizedMessage("warningTextLabel")); */

                        for (const warning of sessionWarnings) {

                            const warningRowDiv = chargyLib.CreateDiv(warningRowsDiv, "warningRow " + warning.level);
                            const levelDiv      = chargyLib.CreateDiv(warningRowDiv, "level");
                            const textDiv       = chargyLib.CreateDiv(warningRowDiv, "text");

                            levelDiv.innerText  = this.chargy.GetLocalizedMessage("warningLevel_" + warning.level);
                            textDiv.innerText   = this.chargy.GetLocalizedText(warning.message) ?? "";

                        }

                    }

                    //#endregion

                }
            }

        }
        catch (exception)
        {
            this.doGlobalError({
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:    this.chargy.GetMultilanguageText("Unknown or invalid charge transparency record!"),
                exception:  exception,
                certainty:  0
            });
        }

    }

    //#endregion

    //#region showChargingTariffDetails     (measurementValue)

    private showChargingTariffDetails(_measurementValue:  chargyInterfaces.IChargingTariff) : void
    {

        //#region Headline

        const headlineDiv               = this.chargingTariffDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.    querySelector('.error')                   as HTMLDivElement;
        const introDiv                  = headlineDiv.    querySelector('.intro')                   as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        // if (!measurementValue?.measurement ||
        //     !measurementValue.method)
        // {
        //     doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
        //     return;
        // }

        //#region Show data and result on overlay

        this.chargingTariffDetailsDiv.style.display = 'block';

        // const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
        // const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        // const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        // const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        // const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        // const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        // cryptoDataDiv.innerHTML         = '';
        // bufferDiv.innerHTML             = '';
        // hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        // measurementValue.method.ViewMeasurement(measurementValue,
        //                                         errorDiv,
        //                                         introDiv,

        //                                         cryptoDataDiv,
        //                                         bufferDiv,
        //                                         hashedBufferDiv,
        //                                         publicKeyDiv,
        //                                         signatureExpectedDiv,

        //                                         signatureCheckDiv);

    }

    //#endregion

    //#region showChargingPeriodDetails     (chargingPeriod)

    private showChargingPeriodDetails(_chargingPeriod:  chargyInterfaces.IChargingPeriod) : void
    {

        //#region Headline

        const headlineDiv               = this.chargingTariffDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.    querySelector('.error')                   as HTMLDivElement;
        const introDiv                  = headlineDiv.    querySelector('.intro')                   as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        // if (!measurementValue?.measurement ||
        //     !measurementValue.method)
        // {
        //     doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
        //     return;
        // }

        //#region Show data and result on overlay

        this.chargingPeriodDetailsDiv.style.display = 'block';

        // const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
        // const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        // const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        // const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        // const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        // const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        // cryptoDataDiv.innerHTML         = '';
        // bufferDiv.innerHTML             = '';
        // hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        // measurementValue.method.ViewMeasurement(measurementValue,
        //                                         errorDiv,
        //                                         introDiv,

        //                                         cryptoDataDiv,
        //                                         bufferDiv,
        //                                         hashedBufferDiv,
        //                                         publicKeyDiv,
        //                                         signatureExpectedDiv,

        //                                         signatureCheckDiv);

    }

    //#endregion

    //#region showMeasurementCryptoDetails  (measurementValue)

    private showMeasurementCryptoDetails(measurementValue:  chargeTransparencyRecord.IMeasurementValue) : void
    {

        function doError(text: string)
        {
            errorDiv.innerHTML          = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display      = "none";
        }

        //#region Headline

        const headlineDiv               = this.measurementsDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.                querySelector('.error')     as HTMLDivElement;
        const introDiv                  = headlineDiv.                querySelector('.intro')     as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        if (!measurementValue?.measurement ||
            !measurementValue.method)
        {
            doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
            return;
        }

        //#region Show data and result on overlay

        this.measurementsDetailsDiv.style.display = 'block';

        const dataDiv                   = this.measurementsDetailsDiv.querySelector('.data')                      as HTMLDivElement;
        const cryptoDataDiv             = dataDiv.                    querySelector('#cryptoData')                as HTMLDivElement;
        const bufferDiv                 = dataDiv.                    querySelector('#buffer .value')             as HTMLDivElement;
        const hashedBufferDiv           = dataDiv.                    querySelector('#hashedBuffer .value')       as HTMLDivElement;
        const publicKeyDiv              = dataDiv.                    querySelector('#publicKey .value')          as HTMLDivElement;
        const signatureExpectedDiv      = dataDiv.                    querySelector('#signatureExpected .value')  as HTMLDivElement;

        cryptoDataDiv.innerHTML         = '';
        bufferDiv.innerHTML             = '';
        hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.                  querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        measurementValue.method.ViewMeasurement(measurementValue,
                                                errorDiv,
                                                introDiv,

                                                cryptoDataDiv,
                                                bufferDiv,
                                                hashedBufferDiv,
                                                publicKeyDiv,
                                                signatureExpectedDiv,

                                                signatureCheckDiv).
            then(viewError => {
                // ViewMeasurement returns an Error when the measurement itself could not be rendered.
                if (viewError)
                    doError(viewError.message);
            }).
            catch((exception: unknown) => {
                doError(exception instanceof Error ? exception.message : String(exception));
            });

    }

    //#endregion

    //#region showPKIDetails                (pkiData)

    private showPKIDetails(_pkiData:  any) : void
    {

        //#region Headline

        const headlineDiv               = this.pkiDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.       querySelector('.error')     as HTMLDivElement;
        const introDiv                  = headlineDiv.       querySelector('.intro')     as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        // if (!measurementValue?.measurement ||
        //     !measurementValue.method)
        // {
        //     doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
        //     return;
        // }

        //#region Show data and result on overlay

        this.pkiDetailsDiv.style.display = 'block';

        // const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
        // const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        // const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        // const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        // const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        // const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        // cryptoDataDiv.innerHTML         = '';
        // bufferDiv.innerHTML             = '';
        // hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        //const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        //const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        //signatureCheckDiv.innerHTML     = '';

        //#endregion

        // measurementValue.method.ViewMeasurement(measurementValue,
        //                                         errorDiv,
        //                                         introDiv,

        //                                         cryptoDataDiv,
        //                                         bufferDiv,
        //                                         hashedBufferDiv,
        //                                         publicKeyDiv,
        //                                         signatureExpectedDiv,

        //                                         signatureCheckDiv);

    }

    //#endregion

}


// Remember to set the application file name for generating the application hash!
// Remember to set Content-Security-Policy for customer support URLs!
// Remember to set Customer Privacy Statement!
// Remember to set Customer Mapbox Access Token and MapId!
// Remember to set the "applicationEdition" in main.cjs

new ChargyApp(
    "https://chargy.charging.cloud/apps/desktop/versions", //"https://raw.githubusercontent.com/OpenChargingCloud/ChargyDesktopApp/master/versions/versions.json",
    true, // Show Feedback Section
    ["support@open.charging.cloud", "?subject=Chargy%20WebApp%20Support"],
    undefined, //["+4993219319101",                  "+49 9321 9319 101"],
    "https://chargy.charging.cloud/desktop/issues"
);
