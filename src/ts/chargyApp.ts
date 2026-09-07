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

import {
    Chargy,
    ChargyInterfaces           as chargyInterfaces,
    ChargeTransparencyLiveLink as chargeTransparencyLiveLink,
    ChargeTransparencyRecord   as chargeTransparencyRecord,
    PublicKeyInfo              as publicKeyInfo,
    SimpleURL                  as simpleURL,
    readQRCodeTextFromImageData
}                                       from '@open-charging-cloud/chargy-core'
import * as chargyLib                   from '@open-charging-cloud/chargy-core'

// import { Chargy }                       from '@open-charging-cloud/chargy-core'
// import { readQRCodeTextFromImageData }  from '@open-charging-cloud/chargy-core'
// import * as chargyInterfaces            from '@open-charging-cloud/chargy-core'
// import * as chargeTransparencyRecord    from '@open-charging-cloud/chargy-core'
// import * as chargeTransparencyLiveLink  from '@open-charging-cloud/chargy-core'
// import * as publicKeyInfo               from '@open-charging-cloud/chargy-core'
// import * as chargyLib                   from '@open-charging-cloud/chargy-core'
// import { toSessionVerificationResults } from '@open-charging-cloud/chargy-core'
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
import { getMimeTypeFromFileName }      from './fileTypes';
import 'leaflet.awesome-markers';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../css/chargy.scss';

import { calculateBETTariffTotal }     from './betTariffCosts';
import {
    findExternalURLRule,
    isWithinURLPrefixAfterQueryAppend,
    parseExternalURLConfig,
    parseExternalURLConfigMode,
    type ExternalURLRule
}                                      from './deepLinks';
import {
    defaultTrustedPayloadBytes,
    emptyTrustedOriginsStore,
    findTrustedOrigin,
    isLoopbackHost,
    maximumRefreshSeconds,
    minimumRefreshSeconds,
    parseTrustedOriginsStore,
    pollTargetProblem,
    pruneExpiredTrustedOrigins,
    removeTrustedOrigin,
    sanitizeRetentionMonths,
    sanitizeTrustLabel,
    serializeTrustedOriginsStore,
    touchTrustedOrigin,
    trustLabelForOrigin,
    transportProtocolProblem,
    trustedOriginExpiry,
    upsertTrustedOrigin,
    type ITransportAllowances,
    type ITrustedOriginsStore
}                                      from './liveLinkTrust';
import {
    transportAllowancesOf,
    transportAllowanceWarnings
}                                      from './buildFlags';
import {
    customRequestHeaders,
    resolveRequestHeaders,
    type ICustomHeader
}                                      from './liveLinkHeaders';
import {
    documentSignatureState,
    liveLinkVerificationResult,
    measurementValueState,
    meterValueSessionState,
    worstLiveLinkState
}                                      from './liveLinkStatus';
import type { LiveLinkOverallState }   from './liveLinkStatus';

declare const __CHARGY_CORE_NPM_INTEGRITY__: string;

type DetectionResult = Awaited<ReturnType<Chargy["DetectAndConvertContentFormat"]>>;

type DetectionOptions = {
    prepareUI?: boolean;
    onError?:   (result: chargyInterfaces.ISessionCryptoResult) => void;
};

type LiveLinkOriginChoice = "once" | "always" | "deny";

type LiveLinkPollTarget = {
    url:              URL;
    maxPayloadBytes:  number;
    prefix?:          string;
};

type LiveLinkTrustState =
    | { kind: "installation" }
    | { kind: "session"      }
    | { kind: "always", since?: string|undefined }
    | { kind: "denied"       }
    | { kind: "ask"          }
    | { kind: "unavailable"  };

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
type AppPackageJson = {
    version:           string;
    devDependencies?:  DependencyMap;
    dependencies?:     DependencyMap;
    [key: string]:     unknown;
};

const coreDependencies = corePackageJson.dependencies as DependencyMap | undefined;

function dependencyVersion(dependencies: DependencyMap | undefined, dependencyName: string): string {
    return (dependencies?.[dependencyName] ?? coreDependencies?.[dependencyName])?.replace(/[^\d.]/g, "") ?? "";
}

function formatHashValue(hashValue: string): string {
    return hashValue.match(/.{1,8}/g)?.join(" ") ?? "";
}

function sha512HexFromSubresourceIntegrity(integrity: string): string {

    const sha512Prefix = "sha512-";
    const sha512Token  = integrity.split(/\s+/).find(token => token.startsWith(sha512Prefix));

    if (sha512Token == null)
        return "";

    try
    {
        return Array.from(atob(sha512Token.substring(sha512Prefix.length)),
                          char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    }
    catch
    {
        return "";
    }

}

function getTextFromMultilanguageText(text: chargyLib.I18NString | undefined | null,
                                      language: SupportedLanguage,
                                      fallback: string = ""): string {

    return text?.[language] ??
           text?.["en"]   ??
           text?.["de"]   ??
           Object.values(text ?? {}).find((value): value is string => typeof value === "string") ??
           fallback;

}

function getObjectName(value: string | { name?: string | undefined } | undefined | null): string {

    if (typeof value === "string")
        return value;

    return value?.name ?? "";

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


type OCMF_BET_TariffText  = NonNullable<ReturnType<typeof chargyLib.tryParseOCMFBonnTariffText>>;
type Localize             = (key: string) => string;

function appendChargingTariffValue(parent: HTMLElement, value: unknown): void {

    if (Array.isArray(value))
    {
        const arrayDiv = parent.appendChild(document.createElement('div'));
        arrayDiv.classList.add("tariffArray");

        for (const [index, entry] of value.entries())
        {
            const itemDiv = arrayDiv.appendChild(document.createElement('div'));
            itemDiv.classList.add("tariffArrayItem");

            const indexDiv = itemDiv.appendChild(document.createElement('div'));
            indexDiv.classList.add("tariffArrayIndex");
            indexDiv.textContent = "[" + index.toString() + "]";

            const valueDiv = itemDiv.appendChild(document.createElement('div'));
            valueDiv.classList.add("tariffArrayValue");
            appendChargingTariffValue(valueDiv, entry);
        }

        return;
    }

    if (Decimal.isDecimal(value))
    {
        parent.textContent = value.toString();
        return;
    }

    if (value !== null && typeof value === "object")
    {
        const objectDiv = parent.appendChild(document.createElement('div'));
        objectDiv.classList.add("tariffObject");

        for (const [key, entry] of Object.entries(value))
        {
            const propertyDiv = objectDiv.appendChild(document.createElement('div'));
            propertyDiv.classList.add("tariffProperty");
            if (Array.isArray(entry) ||
                (entry !== null && typeof entry === "object" && !Decimal.isDecimal(entry)))
            {
                propertyDiv.classList.add("tariffComplexProperty");
            }

            const keyDiv = propertyDiv.appendChild(document.createElement('div'));
            keyDiv.classList.add("tariffKey");
            keyDiv.textContent = key;

            const valueDiv = propertyDiv.appendChild(document.createElement('div'));
            valueDiv.classList.add("tariffValue");
            appendChargingTariffValue(valueDiv, entry);
        }

        return;
    }

    if (value === null)
        parent.textContent = "null";
    else if (typeof value === "string")
        parent.textContent = value;
    else if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean")
        parent.textContent = value.toString();
    else if (value === undefined)
        parent.textContent = "undefined";
    else
        parent.textContent = "";

}

function betTariffPriceLabel(componentType: string,
                             localize:     Localize): string {

    switch (componentType)
    {
        case "FLAT":
            return localize("BET tariff start fee");
        case "ENERGY":
            return localize("BET tariff energy price");
        case "TIME":
            return localize("BET tariff time price");
        case "PARKING_TIME":
            return localize("BET tariff blocking fee");
        default:
            return localize("BET tariff price");
    }

}

function formatBETTariffPrice(component: chargyInterfaces.IPriceComponent,
                              tariff:    OCMF_BET_TariffText,
                              language:  SupportedLanguage): string {

    const centsPerMinute = component.type === "PARKING_TIME" &&
                           (tariff.code === "001" || tariff.code === "002")
                               ? tariff.blockingFeeCentsPerMinute
                               : component.type === "TIME" && tariff.code === "003"
                                     ? tariff.timeFeeCentsPerMinute
                                     : undefined;

    if (centsPerMinute !== undefined)
    {
        const formattedEuros = new Intl.NumberFormat(
                                   language === "de" ? "de-DE" : "en-US",
                                   {
                                       minimumFractionDigits: 2,
                                       maximumFractionDigits: 2
                                   }
                               ).format(centsPerMinute / 100);

        return formattedEuros + " €/min";
    }

    const price = Decimal.isDecimal(component.price)
                      ? component.price.toNumber()
                      : Number(component.price);

    const formattedPrice = new Intl.NumberFormat(
                               language === "de" ? "de-DE" : "en-US",
                               {
                                   minimumFractionDigits: 2,
                                   maximumFractionDigits: 2
                               }
                           ).format(price);

    switch (component.type)
    {
        case "ENERGY":
            return formattedPrice + " €/kWh";
        case "TIME":
        case "PARKING_TIME":
            return formattedPrice + " €/h";
        default:
            return formattedPrice + " €";
    }

}

function formatBETEuroAmount(amount:   Decimal,
                             language: SupportedLanguage): string {

    return new Intl.NumberFormat(
               language === "de" ? "de-DE" : "en-US",
               {
                   minimumFractionDigits: 2,
                   maximumFractionDigits: 2
               }
           ).format(amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()) + " €";

}

function betTariffRestrictionText(tariff:       OCMF_BET_TariffText,
                                  element:      chargyInterfaces.IChargingTariffElement,
                                  elementIndex: number,
                                  language:     SupportedLanguage,
                                  localize:     Localize): string | undefined {

    if (tariff.code === "002" && elementIndex > 0)
        return localize("BET tariff applies after charging");

    const minimumDuration = element.restrictions?.min_duration;
    if (minimumDuration === undefined)
        return undefined;

    const minutes = minimumDuration / 60;
    const formattedMinutes = new Intl.NumberFormat(
                                 language === "de" ? "de-DE" : "en-US",
                                 { maximumFractionDigits: 2 }
                             ).format(minutes);
    const template = localize(minutes === 1
                                  ? "BET tariff applies after one minute"
                                  : "BET tariff applies after minutes");

    return template.replace("{minutes}", formattedMinutes);

}

function showDecodedOCMFTariff(parent:   HTMLElement,
                               tariff:   chargyInterfaces.IChargingTariff,
                               language: SupportedLanguage,
                               localize: Localize): boolean {

    const interpretedTariff = chargyLib.tryParseOCMFBonnTariffText(tariff["@id"]);

    if (interpretedTariff === undefined ||
        tariff.elements === undefined ||
        tariff.elements.length === 0)
    {
        return false;
    }

    const decodedTariffDiv = parent.appendChild(document.createElement('div'));
    decodedTariffDiv.classList.add("decodedTariff");

    for (const [elementIndex, element] of tariff.elements.entries())
    {
        const elementDiv = decodedTariffDiv.appendChild(document.createElement('div'));
        elementDiv.classList.add("betTariffElement");

        const restrictionText = betTariffRestrictionText(interpretedTariff,
                                                         element,
                                                         elementIndex,
                                                         language,
                                                         localize);
        if (restrictionText !== undefined)
        {
            elementDiv.classList.add("restricted");

            const restrictionDiv = elementDiv.appendChild(document.createElement('div'));
            restrictionDiv.classList.add("betTariffRestriction");
            restrictionDiv.textContent = restrictionText;
        }

        const pricesDiv = elementDiv.appendChild(document.createElement('div'));
        pricesDiv.classList.add("betTariffPrices");

        for (const component of element.price_components)
        {
            const priceDiv = pricesDiv.appendChild(document.createElement('div'));
            priceDiv.classList.add("betTariffPrice");

            const labelDiv = priceDiv.appendChild(document.createElement('div'));
            labelDiv.classList.add("label");
            labelDiv.textContent = betTariffPriceLabel(component.type, localize);

            const amountDiv = priceDiv.appendChild(document.createElement('div'));
            amountDiv.classList.add("amount");
            amountDiv.textContent = formatBETTariffPrice(component, interpretedTariff, language);
        }
    }

    return true;

}

function showGenericChargingTariff(parent: HTMLElement,
                                   tariff: chargyInterfaces.IChargingTariff): boolean {

    const tariffEntries = Object.entries(tariff).filter(([key]) => key !== "@id");
    if (tariffEntries.length === 0)
        return false;

    const structuredTariffDiv = parent.appendChild(document.createElement('div'));
    structuredTariffDiv.classList.add("structuredTariff");

    appendChargingTariffValue(structuredTariffDiv, Object.fromEntries(tariffEntries));

    return true;

}

function showChargingTariff(parent:   HTMLElement,
                            tariff:   chargyInterfaces.IChargingTariff,
                            language: SupportedLanguage,
                            localize: Localize): boolean {

    return showDecodedOCMFTariff(parent, tariff, language, localize) ||
           showGenericChargingTariff(parent, tariff);

}


interface ChargyElectronAPI {

    getAppContext(): {
        appEdition:             string;
        copyright:              string;
        commandLineArguments:   string[];
        packageJson:            AppPackageJson;
        i18n:                   chargyLib.I18NDictionary;
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

        /** What --lang resolved to, for the modes that have no window. */
        cliLanguage?:           string;

        // What this run allows beyond the transport rules that hold
        // everywhere, as the main process resolved it. Optional because an
        // absent answer has to mean the strict rules, never the relaxed ones.
        transportAllowances?: {
            insecureTransports?:        boolean;
            privateNetworkTransports?:  boolean;
        };

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
    readExternalURLConfig():                             Promise<string>;
    fetchLiveLink(url: string, maxPayloadBytes: number, prefix?: string, headers?: Record<string, string>): Promise<{ ok: boolean; status: number; data?: ArrayBuffer; error?: string }>;
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
    public           packageJson:                        AppPackageJson                    = { version: "0.0.0" };
    public           i18n:                               chargyLib.I18NDictionary          = {};
    public           UILanguage:                         SupportedLanguage                 = "en";

    private readonly electron:                           ChargyElectronAPI                 = window.chargyElectron;
    private readonly appContext:                         ReturnType<ChargyElectronAPI["getAppContext"]>;

    // What this run allows beyond the transport rules that hold everywhere.
    // The main process resolved it once at startup, so this is decided here
    // too, once, and is the same for every document the application sees.
    private readonly transportAllowances:                ITransportAllowances;

    private readonly commandLineArguments:               Array<string>                     = [];
    private readonly platform:                           string                            = "";

    private          currentAppInfos:                    chargyInterfaces.IVersions|null   = null;
    private          currentVersionInfos:                any                               = null;
    private          currentPackage:                     any                               = null;
    private          applicationHash:                    string                            = "";

    private readonly markers:                            L.Marker[]                        = [];
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
    private readonly settingsButton:                     HTMLButtonElement;
    private readonly aboutButton:                        HTMLButtonElement;
    private readonly fullScreenButton:                   HTMLButtonElement;
    private readonly appQuitButton:                      HTMLButtonElement;

    private readonly updateAvailableScreen:              HTMLDivElement;
    private readonly inputDiv:                           HTMLDivElement;
    private readonly inputInfosDiv:                      HTMLDivElement;
    private readonly aboutScreenDiv:                     HTMLDivElement;
    private readonly settingsScreenDiv:                  HTMLDivElement;
    private readonly settingsMenuDiv:                    HTMLDivElement;
    private readonly settingsTrustedOriginsDiv:          HTMLDivElement;
    private readonly settingsTrustedOriginsEntry:        HTMLButtonElement;
    private readonly noTrustedOriginsDiv:                HTMLDivElement;
    private readonly applicationHashDiv:                 HTMLDivElement;
    private readonly applicationHashValueDiv:            HTMLDivElement;
    private readonly chargyCoreHashDiv:                  HTMLDivElement;
    private readonly chargyCoreHashVersionSpan:          HTMLSpanElement;
    private readonly chargyCoreHashValueDiv:             HTMLDivElement;
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
    private readonly liveLinkTrustDialogDiv:             HTMLDivElement;
    private readonly liveLinkTrustDocumentDiv:           HTMLDivElement;
    private readonly liveLinkTrustOriginsDiv:            HTMLDivElement;
    private readonly liveLinkTrustLeftButton:            HTMLButtonElement;
    private readonly trustedOriginsListDiv:              HTMLDivElement;
    private readonly trustRetentionEnabledInput:         HTMLInputElement;
    private readonly trustRetentionMonthsInput:          HTMLInputElement;
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

    private qrCodeScannerStream:                MediaStream | null          = null;
    private qrCodeScannerAnimationFrame:        number      | null          = null;
    private qrCodeScannerIsProcessing:          boolean                     = false;
    private qrCodeScannerLastText:              string      | null          = null;
    private qrCodeScannerLastURL:               URL         | null          = null;

    private currentChargeTransparencyRecord:    chargeTransparencyRecord.  IChargeTransparencyRecord   | null = null;
    private currentChargeTransparencyLiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink | null = null;
    private currentLiveLinkMeterValues:         chargeTransparencyRecord.  IChargeTransparencyRecord   | null = null;
    private currentPublicKeyLookup:             publicKeyInfo.             IPublicKeyLookup            | null = null;
    private currentSimpleURL:                   simpleURL.                 IURL                        | null = null;
    private currentGlobalError:                 chargyInterfaces.          ISessionCryptoResult        | null = null;

    private liveLinkRefreshTimer:               ReturnType<typeof setTimeout>                          | null   = null;
    private liveLinkRefreshGeneration:          number                                                          = 0;
    private readonly liveLinkSessionAllowedOrigins: Set<string>                                                 = new Set();
    private liveLinkTrustResolve:               ((decisions: Map<string, LiveLinkOriginChoice>) => void) | null = null;
    private liveLinkTrustDecisions:             Map<string, LiveLinkOriginChoice>                      | null   = null;
    private liveLinkTrustRowDiv:                HTMLDivElement                                         | null   = null;
    private liveLinkTrustContentDiv:            HTMLDivElement                                         | null   = null;

    //#endregion

    constructor(versionsURL?:          string,
                showFeedbackSection?:  boolean,
                feedbackEMail?:        string[],
                feedbackHotline?:      string[],
                issueURL?:             string) {

        //#region Set parameters

        this.appContext                               = this.electron.getAppContext();
        this.transportAllowances                      = transportAllowancesOf(this.appContext);
        this.versionsURL                              = versionsURL         ?? "https://chargy.charging.cloud/apps/desktop/versions";
        this.showFeedbackSection                      = showFeedbackSection ?? false;
        this.defaultFeedbackEMail                     = feedbackEMail       ?? [];
        this.defaultFeedbackHotline                   = feedbackHotline     ?? [];
        this.defaultIssueURL                          = issueURL            ?? "";
        this.UILanguage                               = this.getInitialUILanguage();

        //#endregion

        //#region Say it when this run weakens a transport rule

        // A run with one of these switches on is a test bench, and whoever
        // opens the developer tools should be able to see that it is - the rule
        // it relaxes is otherwise invisible until a document happens to
        // exercise it. A packaged Chargy never has them on, so this stays quiet
        // where it matters.
        for (const warning of transportAllowanceWarnings(this.transportAllowances))
            console.warn(warning);

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
        this.settingsScreenDiv                        = document.getElementById('settingsScreen')                           as HTMLDivElement;
        this.settingsMenuDiv                          = this.settingsScreenDiv.querySelector("#settingsMenu")               as HTMLDivElement;
        this.settingsTrustedOriginsDiv                = this.settingsScreenDiv.querySelector("#settingsTrustedOrigins")     as HTMLDivElement;
        this.settingsTrustedOriginsEntry              = this.settingsScreenDiv.querySelector("#settingsTrustedOriginsEntry") as HTMLButtonElement;
        this.trustedOriginsListDiv                    = this.settingsScreenDiv.querySelector("#trustedOriginsList")         as HTMLDivElement;
        this.noTrustedOriginsDiv                      = this.settingsScreenDiv.querySelector("#noTrustedOrigins")           as HTMLDivElement;
        this.trustRetentionEnabledInput               = this.settingsScreenDiv.querySelector("#trustRetentionEnabled")      as HTMLInputElement;
        this.trustRetentionMonthsInput                = this.settingsScreenDiv.querySelector("#trustRetentionMonths")       as HTMLInputElement;
        this.softwareInfosDiv                         = this.aboutScreenDiv.    querySelector("#softwareInfos")             as HTMLDivElement;
        this.openSourceLibsDiv                        = this.aboutScreenDiv.    querySelector("#openSourceLibs")            as HTMLDivElement;
        this.chargyCoreHashDiv                        = document.getElementById('chargyCoreHash')                          as HTMLDivElement;
        this.chargyCoreHashVersionSpan                = this.chargyCoreHashDiv.querySelector("#version")                    as HTMLSpanElement;
        this.chargyCoreHashValueDiv                   = this.chargyCoreHashDiv.querySelector("#value")                      as HTMLDivElement;

        this.languageButton                           = document.getElementById('languageButton')                           as HTMLButtonElement;
        this.languageMenuDiv                          = document.getElementById('languageMenu')                             as HTMLDivElement;
        this.languageFlagImage                        = document.getElementById('languageFlag')                             as HTMLImageElement;
        this.updateAvailableButton                    = document.getElementById('updateAvailableButton')                    as HTMLButtonElement;
        this.settingsButton                           = document.getElementById('settingsButton')                           as HTMLButtonElement;
        this.aboutButton                              = document.getElementById('aboutButton')                              as HTMLButtonElement;
        this.fullScreenButton                         = document.getElementById('fullScreenButton')                         as HTMLButtonElement;
        this.appQuitButton                            = document.getElementById('appQuitButton')                            as HTMLButtonElement;

        this.chargingTariffDetailsDiv                 = document.getElementById('chargingTariffDetails')                    as HTMLDivElement;
        this.chargingTariffDetailsLeftButton          = this.chargingTariffDetailsDiv.querySelector(".overlayLeftButton")   as HTMLButtonElement;
        this.chargingTariffDetailsLeftButton.onclick  = (): void => {
                                                            this.chargingTariffDetailsDiv.style.display = 'none';
                                                        }

        this.chargingPeriodDetailsDiv                 = document.getElementById('chargingPeriodDetails')                    as HTMLDivElement;
        this.chargingPeriodDetailsLeftButton          = this.chargingPeriodDetailsDiv.querySelector(".overlayLeftButton")   as HTMLButtonElement;
        this.chargingPeriodDetailsLeftButton.onclick  = (): void => {
                                                            this.chargingPeriodDetailsDiv.style.display = 'none';
                                                        }

        this.measurementsDetailsDiv                   = document.getElementById('measurementsDetails')                      as HTMLDivElement;
        this.measurementsDetailsLeftButton            = this.measurementsDetailsDiv.querySelector(".overlayLeftButton")     as HTMLButtonElement;
        this.measurementsDetailsLeftButton.onclick    = (): void => {
                                                            this.measurementsDetailsDiv.style.display = 'none';
                                                        }

        this.issueTrackerDiv                          = document.getElementById('issueTracker')                             as HTMLDivElement;
        this.issueTrackerText                         = this.issueTrackerDiv.   querySelector(".overlayText")               as HTMLDivElement;
        this.privacyStatement                         = this.issueTrackerDiv.   querySelector("#privacyStatement")          as HTMLDivElement;
        this.showPrivacyStatement                     = this.issueTrackerDiv.   querySelector("#showPrivacyStatement")      as HTMLButtonElement;
        this.privacyStatementAccepted                 = this.issueTrackerDiv.   querySelector("#privacyStatementAccepted")  as HTMLInputElement;
        this.sendIssueButton                          = this.issueTrackerDiv.   querySelector("#sendIssueButton")           as HTMLButtonElement;
        this.issueTrackerLeftButton                   = this.issueTrackerDiv.   querySelector(".overlayLeftButton")         as HTMLButtonElement;
        this.issueTrackerLeftButton.onclick           = (): void => {
                                                            this.issueTrackerDiv.style.display = 'none';
                                                        }

        this.pkiDetailsDiv                            = document.getElementById('pkiDetails')                               as HTMLDivElement;
        this.liveLinkTrustDialogDiv                   = document.getElementById('liveLinkTrustDialog')                     as HTMLDivElement;
        this.liveLinkTrustDocumentDiv                 = this.liveLinkTrustDialogDiv.querySelector("#liveLinkTrustDocument") as HTMLDivElement;
        this.liveLinkTrustOriginsDiv                  = this.liveLinkTrustDialogDiv.querySelector("#liveLinkTrustOrigins")  as HTMLDivElement;
        this.liveLinkTrustLeftButton                  = this.liveLinkTrustDialogDiv.querySelector(".overlayLeftButton")     as HTMLButtonElement;
        this.liveLinkTrustLeftButton.onclick          = (): void => { this.resolveLiveLinkTrust(); };
        this.pkiDetailsLeftButton                     = this.pkiDetailsDiv.querySelector(".overlayLeftButton")              as HTMLButtonElement;
        this.pkiDetailsLeftButton.onclick             = (): void => {
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

        this.appEdition                               = this.appContext.appEdition;
        this.copyright                                = this.appContext.copyright;

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

        window.onresize = (): void => {
            this.verifyframeDiv.style.maxHeight = (this.appDiv.clientHeight - this.headlineDiv.clientHeight).toString() + "px";
        }

        // Call it once on application start
        window.dispatchEvent(new Event("resize"));

        //#endregion

        //#region Set infos of the about section

        (this.softwareInfosDiv. querySelector("#appEdition")             as HTMLSpanElement).innerHTML   = this.appEdition;
        (this.softwareInfosDiv. querySelector("#appVersion")             as HTMLSpanElement).textContent = this.packageJson.version;
        (this.softwareInfosDiv. querySelector("#copyright")              as HTMLSpanElement).innerHTML   = this.copyright;

        const chargyCoreHashValue = sha512HexFromSubresourceIntegrity(__CHARGY_CORE_NPM_INTEGRITY__);
        this.chargyCoreHashVersionSpan.innerHTML = corePackageJson.version;
        this.chargyCoreHashValueDiv.innerHTML    = chargyCoreHashValue !== ""
                                                        ? formatHashValue(chargyCoreHashValue)
                                                        : "Kann nicht berechnet werden!";

        (this.openSourceLibsDiv.querySelector("#chargyVersion")          as HTMLSpanElement).textContent = this.packageJson.version;
        (this.openSourceLibsDiv.querySelector("#electronVersion")        as HTMLSpanElement).innerHTML   = this.appContext.versions.electron ?? "";
        (this.openSourceLibsDiv.querySelector("#chromiumVersion")        as HTMLSpanElement).innerHTML   = this.appContext.versions.chrome   ?? "";
        (this.openSourceLibsDiv.querySelector("#nodeVersion")            as HTMLSpanElement).innerHTML   = this.appContext.versions.node     ?? "";
        (this.openSourceLibsDiv.querySelector("#opensslVersion")         as HTMLSpanElement).innerHTML   = this.appContext.versions.openssl  ?? "";

        if (this.packageJson.devDependencies)
        {
            (this.openSourceLibsDiv.querySelector("#electronBuilder")        as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.devDependencies, "electron-builder");
            (this.openSourceLibsDiv.querySelector("#electronLocalShortcut")  as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.devDependencies, "electron-localshortcut");
            (this.openSourceLibsDiv.querySelector("#SASS")                   as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.devDependencies, "sass");
            (this.openSourceLibsDiv.querySelector("#typeScript")             as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.devDependencies, "typescript");
            (this.openSourceLibsDiv.querySelector("#webpack")                as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.devDependencies, "webpack");
        }

        if (this.packageJson.dependencies)
        {
            (this.openSourceLibsDiv.querySelector("#chargyCore")             as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@open-charging-cloud/chargy-core");
            (this.openSourceLibsDiv.querySelector("#openChargingCloudTOTP")  as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@open-charging-cloud/totp");
            (this.openSourceLibsDiv.querySelector("#elliptic")               as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "elliptic");
            (this.openSourceLibsDiv.querySelector("#nobleCurves")            as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@noble/curves");
            (this.openSourceLibsDiv.querySelector("#nobleHashes")            as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@noble/hashes");
            (this.openSourceLibsDiv.querySelector("#noblePostQuantum")       as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@noble/post-quantum");
            (this.openSourceLibsDiv.querySelector("#vanaheimrCOSE")          as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@vanaheimr/cose");
            (this.openSourceLibsDiv.querySelector("#vanaheimrMetrologicalCBOR") as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@vanaheimr/metrological-cbor");
            (this.openSourceLibsDiv.querySelector("#momentJS")               as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "moment");
            (this.openSourceLibsDiv.querySelector("#pdfjsdist")              as HTMLSpanElement).innerHTML = dependencyVersion(corePackageJson.dependencies, "pdfjs-dist");
            (this.openSourceLibsDiv.querySelector("#seekBzip")               as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "seek-bzip");
            (this.openSourceLibsDiv.querySelector("#fileType")               as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "file-type");
            (this.openSourceLibsDiv.querySelector("#isURLSuperb")            as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "is-url-superb");
            (this.openSourceLibsDiv.querySelector("#jsQR")                   as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "jsqr");
            (this.openSourceLibsDiv.querySelector("#buffer")                 as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "buffer");
            (this.openSourceLibsDiv.querySelector("#fontAwesome")            as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "@fortawesome/fontawesome-free");
            (this.openSourceLibsDiv.querySelector("#asn1JS")                 as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "asn1.js");
            (this.openSourceLibsDiv.querySelector("#base32Decode")           as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "base32-decode");
            (this.openSourceLibsDiv.querySelector("#safeStableStringify")    as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "safe-stable-stringify");
            (this.openSourceLibsDiv.querySelector("#leafletJS")              as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "leaflet");
            (this.openSourceLibsDiv.querySelector("#leafletAwesomeMarkers")  as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "leaflet.awesome-markers");
            (this.openSourceLibsDiv.querySelector("#decimalJS")              as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "decimal.js");
            (this.openSourceLibsDiv.querySelector("#chartJS")                as HTMLSpanElement).innerHTML = dependencyVersion(this.packageJson.dependencies, "chart.js");
        }

        //#endregion

        //#region Set infos of the feedback section

        this.UpdateFeedbackSection();

        //#endregion

        //#region The Issue tracker

        this.showPrivacyStatement.onclick = (ev: MouseEvent): void => {
            ev.preventDefault();
            this.privacyStatement.style.display = "block";
            this.issueTrackerText.scrollTop = this.issueTrackerText.scrollHeight;
        }

        this.privacyStatementAccepted.onchange = (): void => {
            this.sendIssueButton.disabled  = !this.privacyStatementAccepted.checked;
        }

        this.sendIssueButton.onclick = (ev: MouseEvent): void => {

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

                sendIssue.onreadystatechange = (): void => {

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
                    this.applicationHashValueDiv.innerHTML        = formatHashValue(applicationHash);
                }
                else
                    this.applicationHashValueDiv.innerHTML        = "Kann nicht berechnet werden!";
            })
            .catch((error: unknown) => {
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

        GetListOfVersions.onerror = function(): void {
            //console.error('Network error');
        };

        GetListOfVersions.onreadystatechange = (): void => {

            // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
            if (GetListOfVersions.readyState === XMLHttpRequest.DONE) {
                switch (GetListOfVersions.status)
                {

                    case 200: // HTTP 200 - OK
                        try
                        {

                            const versionsDiv = this.updateAvailableScreen.querySelector("#versions");
                            if (versionsDiv instanceof HTMLDivElement)
                            {

                                try
                                {
                                    this.currentAppInfos = JSON.parse(GetListOfVersions.responseText) as chargyInterfaces.IVersions;
                                }
                                catch (exception)
                                {
                                    console.log(exception);
                                }

                                if (this.currentAppInfos !== null)
                                {

                                    const appVersion = typeof this.packageJson.version === "string"
                                        ? this.packageJson.version
                                        : "0.0.0";
                                    const [thisMajor = "0", thisMinor = "0", thisPatch = "0"] = appVersion.split('.');

                                    for (const version of this.currentAppInfos.versions)
                                    {

                                        const remoteVersion = version.version.split('.');
                                        const [remoteMajor = "0", remoteMinor = "0", remotePatch = "0"] = remoteVersion;

                                        //#region Find current version package

                                        if (remoteMajor == thisMajor &&
                                            remoteMinor == thisMinor &&
                                            remotePatch == thisPatch)
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

                                        else if (remoteMajor >  thisMajor ||
                                                (remoteMajor >= thisMajor && remoteMinor >  thisMinor) ||
                                                (remoteMajor >= thisMajor && remoteMinor >= thisMinor && remotePatch > thisPatch))
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
                                            descriptionDiv.innerHTML = version.description["de"] ?? "";

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

                                                if (chargyLib.isI18NString(versionpackage.description))
                                                {
                                                    const descriptionDiv = packageDiv.appendChild(document.createElement('div'));
                                                    descriptionDiv.className   = "description";
                                                    descriptionDiv.textContent = versionpackage.description[this.UILanguage] ?? "";
                                                }

                                                if (versionpackage.additionalInfo !== undefined)
                                                {
                                                    const additionalInfoDiv = packageDiv.appendChild(document.createElement('div'));
                                                    additionalInfoDiv.className   = "additionalInfo";
                                                    additionalInfoDiv.textContent = (versionpackage.additionalInfo as Record<string, string>)[this.UILanguage] ?? "";
                                                }


                                                const cryptoHashesDiv = packageDiv.appendChild(document.createElement('div'));
                                                cryptoHashesDiv.className = "cryptoHashes";

                                                const cryptoHashes = versionpackage.cryptoHashes as Record<string, string>;

                                                for (const cryptoHash in cryptoHashes)
                                                {

                                                    const cryptoHashDiv = cryptoHashesDiv.appendChild(document.createElement('div'));
                                                    cryptoHashDiv.className = "cryptoHash";

                                                    const cryptoHashNameDiv = cryptoHashDiv.appendChild(document.createElement('div'));
                                                    cryptoHashNameDiv.className = "name";
                                                    cryptoHashNameDiv.innerHTML = cryptoHash;

                                                    let value = cryptoHashes[cryptoHash]?.replace(/\s+/g, '') ?? "";

                                                    if (value.startsWith("0x"))
                                                        value = value.substring(2);

                                                    const cryptoHashValueDiv = cryptoHashDiv.appendChild(document.createElement('div'));
                                                    cryptoHashValueDiv.className = "value";
                                                    cryptoHashValueDiv.innerHTML = formatHashValue(value);

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

                                                if (Object.keys(versionpackage.downloadURLs).length > 0)
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
                                                        downloadURLAnchor.title = versionpackage.downloadURLs[downloadURLName] ?? "";
                                                        downloadURLAnchor.dataset["externalUrl"] = versionpackage.downloadURLs[downloadURLName];
                                                        downloadURLAnchor.innerHTML = "<i class=\"fas fa-globe\"></i>" + downloadURLName;
                                                        downloadURLAnchor.onclick = (ev: MouseEvent): void => {
                                                            ev.preventDefault();
                                                            const link = downloadURLAnchor.dataset["externalUrl"];
                                                            if (link?.startsWith("https://"))
                                                                void this.electron.openExternal(link);
                                                        };
                                                    }

                                                }

                                            }

                                        }

                                        //#endregion

                                    }
                                }

                            }

                        }
                        catch (_exception)
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

        this.updateAvailableButton.onclick = (): void => {
            this.updateAvailableScreen.style.display     = "block";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.settingsScreenDiv.style.display         = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";
        }

        //#endregion

        //#region Handle the 'Settings'-button

        this.settingsButton.onclick = (): void => {

            this.stopLiveLinkRefresh();
            this.showSettingsMenu();

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.settingsScreenDiv.style.display         = "block";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";

        };

        this.settingsTrustedOriginsEntry.onclick = (): void => {
            this.refreshTrustedOriginsList();
            this.settingsMenuDiv.style.display           = "none";
            this.settingsTrustedOriginsDiv.style.display = "block";
        };

        this.trustRetentionEnabledInput.onchange = (): void => {

            const store = this.loadTrustedOrigins();

            store.retentionMonths = this.trustRetentionEnabledInput.checked
                                        ? sanitizeRetentionMonths(this.trustRetentionMonthsInput.valueAsNumber)
                                        : null;

            this.saveTrustedOrigins(store);
            this.refreshTrustedOriginsList();

        };

        this.trustRetentionMonthsInput.onchange = (): void => {

            const store = this.loadTrustedOrigins();

            if (store.retentionMonths !== null)
            {
                store.retentionMonths = sanitizeRetentionMonths(this.trustRetentionMonthsInput.valueAsNumber);
                this.saveTrustedOrigins(store);
            }

            this.refreshTrustedOriginsList();

        };

        //#endregion

        //#region Handle the 'About'-button

        this.aboutButton.onclick = async (): Promise<void> => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "block";
            this.settingsScreenDiv.style.display         = "none";
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

        this.fullScreenButton.onclick = (): void => {
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

        this.appQuitButton.onclick = (): void => {
            window.close();
        }

        //#endregion


        //#region Handle the 'back'-button

        this.backButton.onclick  = (): void => {

            if (this.settingsScreenDiv.style.display         !== "none" &&
                this.settingsTrustedOriginsDiv.style.display !== "none")
            {
                this.showSettingsMenu();
                return;
            }

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.settingsScreenDiv.style.display         = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "none";
            this.exportButtonDiv.style.display           = "none";
            this.fileInput.value                         = "";
            this.clearChargingSessionOutput(true);
            this.currentChargeTransparencyRecord         = null;
            this.currentChargeTransparencyLiveLink       = null;
            this.currentLiveLinkMeterValues              = null;
            this.currentPublicKeyLookup                  = null;
            this.currentSimpleURL                        = null;
            this.currentGlobalError                      = null;
            this.stopLiveLinkRefresh();

        }

        //#endregion

        //#region Handle the 'export'-button

        this.exportButton.onclick  = async (): Promise<void> => {

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

        for (const linkButton of linkButtons) {
            linkButton.onclick = (ev: MouseEvent): void => {
                ev.preventDefault();
                const link = linkButton.getAttribute("href") ?? "";
                if (link.startsWith("https://"))
                    void this.electron.openExternal(link);
            }
        }

        const externalLinks = document.querySelectorAll<HTMLElement>('[data-external-url]');

        for (const externalLink of externalLinks) {
            externalLink.onclick = (ev: MouseEvent): void => {
                ev.preventDefault();
                const link = externalLink.getAttribute("data-external-url") ?? "";
                if (link.startsWith("https://"))
                    void this.electron.openExternal(link);
            }
        }

        const protocolLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"], a[href^="tel:"]');

        for (const protocolLink of protocolLinks) {
            protocolLink.onclick = (ev: MouseEvent): void => {
                ev.preventDefault();
                void this.electron.openExternal(protocolLink.href);
            }
        }

        //#endregion


        //#region Handle the 'fileInput'-button

        this.fileInput  = document.getElementById('fileInput')  as HTMLInputElement;
        this.fileInputButton.onclick = (): void => {
            this.fileInput.value = '';
            this.fileInput.click();
        }

        this.fileInput.onchange = (ev: Event): void => {

            const input = ev.target as HTMLInputElement | null;
            const files = input?.files;

            if (files != null)
                void this.readFilesFromDisk(files);

        }

        //#endregion

        //#region Handle Drag'n'Drop of charge transparency files

        this.inputDiv.addEventListener('dragenter', (event: DragEvent) => {
            event.preventDefault();
            (event.currentTarget as HTMLDivElement).classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragover',  (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            if (event.dataTransfer != null)
                event.dataTransfer.dropEffect = 'copy';
            (event.currentTarget as HTMLDivElement).classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragleave', (event: DragEvent) => {
            (event.currentTarget as HTMLDivElement).classList.remove('over');
        }, false);

        this.inputDiv.addEventListener('drop',      (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            (event.currentTarget as HTMLDivElement).classList.remove('over');
            if (event.dataTransfer?.files != null)
                void this.readFilesFromDisk(event.dataTransfer.files);
        }, false);

        //#endregion

        //#region Handle the 'paste'-button

        this.pasteButton.onclick = async (): Promise<void> => {
            await this.readClipboard();
        }

        //#endregion

        //#region Handle IPC message "receiveReadClipboard" (Ctrl+V)

        this.electron.on('receiveReadClipboard', () => {
            void this.readClipboard();
        });

        //#endregion

        //#region Handle 'Open file'-events...

        // e.g. on Mac OS X - when app is running
        this.electron.on('receiveFileToOpen', (filename:string) => {
            void this.readFileFromDisk(filename);
        });

        this.electron.on('receiveFilesToOpen', (filenames:string[]) => {
            void this.readFilesFromDisk(filenames);
        });

        this.electron.on('receiveHttpRequest', (request: ChargyHttpRequest) => {
            void this.handleHttpRequest(request);
        });

        //#endregion

        //#region Check command line parameters and 'Open this file with...'-events...

        // ToDo: This is a work around, as events from main.js seem to fire too early!

        // File to open on Mac OS X
        const filename = this.appContext.fileToOpen;
        if (filename !== "")
            void this.readFileFromDisk(filename);


        // Open files sent via command line parameters
        const filteredcommandLineArguments = this.commandLineArguments.filter(parameter => !parameter.startsWith('-'));

        // Stupid workaround via setTimeout
        if (filteredcommandLineArguments.length > 0)
            setTimeout(() => {
                void this.readFilesFromDisk(filteredcommandLineArguments);
            }, 100);

        //#endregion

        //#region Handle the 'qrScan'-button

        this.qrScanButton.onclick = async (ev: MouseEvent): Promise<void> => {
            ev.preventDefault();
            await this.openQRCodeScanner();
        }

        this.qrCodeScannerCancelButton.onclick = (ev: MouseEvent): void => {
            ev.preventDefault();
            this.closeQRCodeScanner();
        }

        this.qrCodeScannerRescanButton.onclick = (ev: MouseEvent): void => {
            ev.preventDefault();
            this.resumeQRCodeScanner();
        }

        this.qrCodeScannerOpenURLButton.onclick = (ev: MouseEvent): void => {
            ev.preventDefault();

            if (this.qrCodeScannerLastURL != null)
            {
                window.open(this.qrCodeScannerLastURL.href, "_blank", "noopener");
                this.setQRCodeScannerStatus(this.chargy.GetLocalizedMessage("urlWasOpened"));
            }
        }

        void this.updateQRCodeScannerAvailability();
        navigator.mediaDevices.addEventListener("devicechange", () => { void this.updateQRCodeScannerAvailability(); });

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

        // On the command line there is no window whose language anyone could
        // have chosen, and --lang is what they said instead. Everything the
        // renderer produces there is printed by the CLI, so it speaks the CLI's
        // language rather than the machine's - otherwise one line of the same
        // output would answer in a different language than the next.
        if (this.appContext.noGUI && this.isSupportedLanguage(this.appContext.cliLanguage))
            return this.appContext.cliLanguage;

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
            chargingSession.ctr.warnings.length > 0)
            //chargingSession.verificationResult?.status === chargyInterfaces.SessionVerificationResult.InplausibleMeasurement)
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

            for (const measurementValue of measurement.values) {

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

        this.languageButton.onclick = (ev: MouseEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            const isOpen = this.languageMenuDiv.classList.toggle("open");
            this.languageButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
        };

        for (const languageMenuButton of Array.from(this.languageMenuDiv.querySelectorAll<HTMLButtonElement>("button[data-language]")))
        {
            languageMenuButton.onclick = (ev: MouseEvent): void => {
                ev.preventDefault();
                ev.stopPropagation();

                const language = languageMenuButton.dataset["language"];
                if (this.isSupportedLanguage(language))
                    this.setUILanguage(language);
            };
        }

        document.addEventListener("click", () => {
            this.languageMenuDiv.classList.remove("open");
            this.languageButton.setAttribute("aria-expanded", "false");
        });

    }

    private setUILanguage(language: SupportedLanguage,
                          persist:  boolean = true): void {

        this.UILanguage = language;
        this.chargy.SetUILanguages([ language ]);
        this.moment.locale(language);
        chargyLib.setUILocale(language);

        if (persist)
            localStorage.setItem("ChargyUILanguage", language);

        this.applyTranslations();
        this.rerenderCurrentView();

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

    private rerenderCurrentView(): void {

        if (this.currentChargeTransparencyRecord != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            this.showChargeTransparencyRecord(this.currentChargeTransparencyRecord);
            return;
        }

        if (this.currentChargeTransparencyLiveLink != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            this.showChargeTransparencyLiveLink(
                this.currentChargeTransparencyLiveLink,
                this.currentLiveLinkMeterValues
            );
            return;
        }

        if (this.currentPublicKeyLookup != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            this.showPublicKeyInfo(this.currentPublicKeyLookup);
            return;
        }

        if (this.currentSimpleURL != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            this.showSimpleURL(this.currentSimpleURL);
            return;
        }

        if (this.currentGlobalError != null &&
            this.errorTextDiv.style.display !== "none")
        {
            this.doGlobalError(this.currentGlobalError);
        }

    }

    //#endregion    

    private resetMapBounds(): void {

        this.minlat =  1000;
        this.maxlat = -1000;
        this.minlng =  1000;
        this.maxlng = -1000;

    }

    private clearMapMarkers(): void {

        while (this.markers.length > 0)
        {
            const marker = this.markers.pop();

            if (marker != null)
                this.map.removeLayer(marker);
        }

        this.resetMapBounds();

    }

    private resetMapView(): void {

        this.map.setView(
            this.appContext.mapbox.startGeoCoordinates,
            this.appContext.mapbox.startMapZoom
        );

    }

    private clearRenderedChargeData(resetMapView: boolean = false): void
    {

        this.stopLiveLinkRefresh();
        this.closeLiveLinkTrustDialog();
        this.liveLinkTrustRowDiv     = null;
        this.liveLinkTrustContentDiv = null;

        this.clearChargingSessionCharts();
        this.detailedInfosDiv.innerHTML = "";
        this.clearMapMarkers();

        if (resetMapView)
            this.map.setView([50.9279287, 11.5731785], 12);

    }

    private clearChargingSessionOutput(resetMapView: boolean = false): void {

        this.clearChargingSessionCharts();
        this.clearMapMarkers();

        this.chargingSessionScreenDiv.style.display = "none";
        this.chargingSessionScreenDiv.innerHTML     = "";
        this.detailedInfosDiv.innerHTML             = "";

        if (resetMapView)
            this.resetMapView();

    }

    //#region UpdateFeedbackSection()

    public UpdateFeedbackSection(FeedbackEMail?:   string[],
                                 FeedbackHotline?: string[]): void {

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

            this.showIssueTrackerButton.onclick = (): void => {
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

        if (feedbackEMail.length == 2)
        {
            this.feedbackEMailAnchor.style.display = "block";
            this.feedbackEMailAnchor.href          = "mailto:" + (feedbackEMail[0] ?? "") + (feedbackEMail[1] ?? "");
            this.feedbackEMailAnchor.textContent  += feedbackEMail[0] ?? "";
        }
        else
            this.feedbackEMailAnchor.style.display = "none";

        //#endregion

        //#region Feedback Hotline

        const feedbackHotline = FeedbackHotline ?? this.defaultFeedbackHotline;

        if (feedbackHotline.length == 2)
        {
            this.feedbackHotlineAnchor.style.display = "block";
            this.feedbackHotlineAnchor.href          = "tel:" + (feedbackHotline[0] ?? "");
            this.feedbackHotlineAnchor.textContent  += feedbackHotline[1] ?? "";
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
                          context?:  unknown) : void
    {

        this.currentGlobalError                      = result;
        this.currentChargeTransparencyRecord         = null;
        this.currentChargeTransparencyLiveLink       = null;
        this.currentLiveLinkMeterValues              = null;
        this.currentPublicKeyLookup                  = null;
        this.currentSimpleURL                        = null;
        this.clearChargingSessionOutput(true);

        let text = this.chargy.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord");

        if (result.message !== undefined)
            text = getTextFromMultilanguageText(result.message, this.UILanguage, text).trim();

        if (result.errors        !== undefined &&
            result.errors.length   > 0         &&
            result.errors[0]     !== undefined)
        {
            text = getTextFromMultilanguageText(result.errors[0].message, this.UILanguage, text).trim();
        }

        this.inputDiv.style.flexDirection            = "";
        this.inputInfosDiv.style.display             = 'flex';
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "none";
        this.exportButtonDiv.style.display           = "none";
        this.fileInput.value                         = "";
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        console.log(text);
        console.log(context);

        this.electron.setVerificationResult(result);

    }

    //#endregion

    //#region readClipboard()

    private async readClipboard(): Promise<void>
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
                    void this.handleScannedQRCodeText(qrText);
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

    private isSVGFileInfo(fileInfo: chargyInterfaces.IFileInfo): boolean {

        return fileInfo.type?.toLowerCase() === "image/svg+xml" ||
               getMimeTypeFromFileName(fileInfo.path ?? fileInfo.name) === "image/svg+xml";

    }

    private textFileNameForQRCodeContent(fileName: string,
                                         qrText:   string): string {

        const baseFileName = fileName.replace(/\.[^/.\\]+$/, "");
        const trimmedText  = qrText.trimStart();

        if (trimmedText.startsWith("<?xml") ||
            trimmedText.startsWith("<"))
        {
            return baseFileName + ".xml";
        }

        if (trimmedText.startsWith("{") ||
            trimmedText.startsWith("["))
        {
            return baseFileName + ".json";
        }

        return baseFileName + ".txt";

    }

    private svgImageSize(svgText: string): { width: number; height: number }|null {

        const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
        const svgElement  = svgDocument.documentElement;

        if (svgElement.nodeName.toLowerCase() !== "svg")
            return null;

        const widthAttribute  = Number.parseFloat(svgElement.getAttribute("width")  ?? "");
        const heightAttribute = Number.parseFloat(svgElement.getAttribute("height") ?? "");

        if (Number.isFinite(widthAttribute)  && widthAttribute  > 0 &&
            Number.isFinite(heightAttribute) && heightAttribute > 0)
        {
            return {
                width:   widthAttribute,
                height:  heightAttribute
            };
        }

        const viewBoxValues = svgElement.getAttribute("viewBox")?.
                                         trim().
                                         split(/[\s,]+/).
                                         map(value => Number.parseFloat(value));
        const viewBoxWidth  = viewBoxValues?.[2];
        const viewBoxHeight = viewBoxValues?.[3];

        if (viewBoxValues != null         &&
            viewBoxValues.length >= 4     &&
            viewBoxWidth        != null   &&
            viewBoxHeight       != null   &&
            Number.isFinite(viewBoxWidth) &&
            Number.isFinite(viewBoxHeight) &&
            viewBoxWidth  > 0             &&
            viewBoxHeight > 0)
        {
            return {
                width:   viewBoxWidth,
                height:  viewBoxHeight
            };
        }

        return null;

    }

    private svgTextWithExplicitSize(svgText: string,
                                    width:   number,
                                    height:  number): string {

        const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
        const svgElement  = svgDocument.documentElement;

        if (svgElement.nodeName.toLowerCase() !== "svg")
            return svgText;

        svgElement.setAttribute("width",  width. toString());
        svgElement.setAttribute("height", height.toString());

        return new XMLSerializer().serializeToString(svgDocument);

    }

    private async readQRCodeTextFromSVG(svgText: string): Promise<string|undefined> {

        if (typeof Blob === "undefined" ||
            typeof URL  === "undefined" ||
            typeof Image === "undefined" ||
            typeof document === "undefined")
        {
            return undefined;
        }

        const imageSize = this.svgImageSize(svgText);

        if (imageSize == null)
            return undefined;

        const scale        = Math.max(1, Math.ceil(512 / Math.max(imageSize.width, imageSize.height)));
        const canvasWidth  = Math.ceil(imageSize.width  * scale);
        const canvasHeight = Math.ceil(imageSize.height * scale);
        const imageBlob    = new Blob(
            [ this.svgTextWithExplicitSize(svgText, imageSize.width, imageSize.height) ],
            { type: "image/svg+xml" }
        );
        const imageURL     = URL.createObjectURL(imageBlob);

        try
        {

            const image = new Image();

            await new Promise<void>((resolve, reject) => {
                image.onload  = (): void => { resolve(); };
                image.onerror = (): void => { reject(new Error("Could not decode SVG image.")); };
                image.src     = imageURL;
            });

            const canvas  = document.createElement("canvas");
            canvas.width  = canvasWidth;
            canvas.height = canvasHeight;

            const context = canvas.getContext("2d", { willReadFrequently: true });

            if (context == null)
                return undefined;

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            return readQRCodeTextFromImageData({
                data:    imageData.data,
                width:   imageData.width,
                height:  imageData.height
            });

        }
        catch
        {
            return undefined;
        }
        finally
        {
            URL.revokeObjectURL(imageURL);
        }

    }

    private async expandSVGQRCodeFiles(fileInfos: chargyInterfaces.IFileInfo[]): Promise<chargyInterfaces.IFileInfo[]> {

        const expandedFiles = new Array<chargyInterfaces.IFileInfo>();

        for (const fileInfo of fileInfos)
        {

            if (fileInfo.data != null &&
                this.isSVGFileInfo(fileInfo))
            {

                const svgText = new TextDecoder("utf-8").decode(fileInfo.data);
                const qrText  = await this.readQRCodeTextFromSVG(svgText);

                if (qrText != null &&
                    qrText.length > 0)
                {
                    expandedFiles.push({
                        name:  this.textFileNameForQRCodeContent(fileInfo.name, qrText),
                        path:  fileInfo.path,
                        type:  "text/plain",
                        data:  new TextEncoder().encode(qrText),
                        info:  "Text extracted from SVG QR code image"
                    });
                    continue;
                }

            }

            expandedFiles.push(fileInfo);

        }

        return expandedFiles;

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

            for (const file of files)
            {

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
                        const fileType = filename.type?.trim() ||
                                         getMimeTypeFromFileName(filename.path ?? filename.name);

                        loadedFiles.push({
                                       "name":  filename.name,
                                       "path":  filename.path,
                                       "type":  fileType,
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
                await this.detectAndConvertContentFormat(await this.expandSVGQRCodeFiles(loadedFiles));

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
            // secp256k1 comes from @noble/curves through ChargyCore, not from
            // elliptic: same curve, same CompatibleCurve interface, but a
            // maintained implementation. elliptic stays in the tree for
            // secp192r1 alone, which @noble/curves does not provide - and
            // which is the only thing this application still asks it for.
            const result       = chargyLib.createCompatibleCurve('secp256k1').
                                        keyFromPublic(signature.publicKey, 'hex').
                                        verify       (sha256value,
                                                      signature.signature);

            if (result)
                return "<i class=\"fas fa-check-circle\"></i>" + signature.signer;


        }
        catch (_exception)
        {
            // Signature verification failures are rendered as an invalid signature below.
        }

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

            // A charge transparency record carries its verdicts inside the
            // charging sessions it describes, and the HTTP layer reads them
            // from there. A live link describes a session that is still
            // running and has no such list, so its verdict is stated here -
            // the same one the window shows and the command line prints.
            const verificationResults = chargeTransparencyLiveLink.IsAChargeTransparencyLiveLink(result)
                                            ? this.liveLinkVerificationResults(
                                                  result,
                                                  await this.chargy.TryToParseLiveLinkMeterValues(result) ?? null
                                              )
                                            : null;

            const serializedResult = stringify(result);

            if (serializedResult == null)
                throw new Error("Invalid transparency format!");

            this.electron.completeHttpRequest(request.id, {
                ok:      true,
                result:  JSON.parse(serializedResult),
                ...(verificationResults !== null ? { verificationResults } : {})
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

    private parseExternalURLConfig(configText: string): ExternalURLRule[]
    {
        return parseExternalURLConfig(configText);
    }

    private async loadExternalURLConfigText(): Promise<string>
    {
        return this.electron.readExternalURLConfig();
    }

    private findExternalURLRule(verifyURL: URL,
                                rules:     ExternalURLRule[]): ExternalURLRule|null
    {
        return findExternalURLRule(verifyURL, rules);
    }

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

            this.showChargeTransparencyRecord(result);

            if (this.appContext.isDebug)
                this.publishVerificationResult(result);

            return true;

        }

        if (chargeTransparencyLiveLink.IsAChargeTransparencyLiveLink(result))
        {

            const meterValues = await this.chargy.TryToParseLiveLinkMeterValues(result) ?? null;

            // On the command line there is no display to keep up to date, so
            // the document is verified once, reported, and that is that. Going
            // on to show it would start the live reload of a session nobody is
            // watching - and the timer that keeps would hold the process open
            // long after the answer had been given.
            if (this.appContext.noGUI)
            {
                this.publishLiveLinkVerificationResult(result, meterValues);
                return true;
            }

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            this.showChargeTransparencyLiveLink(result, meterValues);

            if (this.appContext.isDebug)
                this.publishLiveLinkVerificationResult(result, meterValues);

            return true;

        }

        if (publicKeyInfo.IsAPublicKey(result) || publicKeyInfo.IsAPublicKeyLookup(result))
        {

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            this.showPublicKeyInfo(result);

            return true;

        }

        if (simpleURL.IsAURL(result))
        {
            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            this.showSimpleURL(result);

            return true;
        }

        if (options?.onError !== undefined)
            options.onError(result);
        else
            this.doGlobalError(result);

        return false;

    }

    //#endregion

    //#region showPublicKeyInfo(PublicKeys)

    private showPublicKeyInfo(PublicKeys: publicKeyInfo.IPublicKey|publicKeyInfo.IPublicKeyLookup): void
    {

        const publicKeys                            =  publicKeyInfo.IsAPublicKeyLookup(PublicKeys)
                                                           ? PublicKeys.publicKeys
                                                           : [ PublicKeys ];

        this.currentPublicKeyLookup                 = { publicKeys };
        this.currentChargeTransparencyRecord        = null;
        this.currentChargeTransparencyLiveLink      = null;
        this.currentLiveLinkMeterValues             = null;
        this.currentSimpleURL                       = null;
        this.currentGlobalError                     = null;
     //   this.clearRenderedChargeData();

        this.inputDiv.style.flexDirection           = "column";
        this.aboutScreenDiv.style.display           = "none";
        this.chargingSessionScreenDiv.style.display = "flex";
        this.chargingSessionScreenDiv.innerText     = "";
        this.invalidDataSetsScreenDiv.style.display = "none";
        this.invalidDataSetsScreenDiv.innerText     = "";
        this.inputButtonsDiv.style.display          = "flex";
        this.exportButtonDiv.style.display          = "none";

        const descriptionDiv       = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id          = "description";
        descriptionDiv.innerText   = this.chargy.GetLocalizedMessage("publicKeyDetailsTitle");

        const publicKeysDiv        = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        publicKeysDiv.id           = "chargingSessions";

        for (const publicKey of publicKeys)
        {
            const publicKeyDiv         = chargyLib.CreateDiv(publicKeysDiv, "chargingSession");
            publicKeyDiv.classList.add("publicKeyCard");

            const subject              = this.formatPublicKeyValue(publicKey.subject);
            const cardTitleDiv         = publicKeyDiv.appendChild(document.createElement('div'));
            cardTitleDiv.className     = "date";
            cardTitleDiv.innerText     = subject || this.chargy.GetLocalizedMessage("publicKeyLabel");

            const tableDiv             = publicKeyDiv.appendChild(document.createElement('div'));
            tableDiv.className         = "table publicKeyTable";

            const identifier = publicKey["@id"];
            if (typeof identifier === "string" && identifier !== "")
                this.appendPublicKeyInfoRow(tableDiv, "fa-fingerprint", "publicKeyIdentifierLabel", identifier);

            if (subject !== "")
                this.appendPublicKeyInfoRow(tableDiv, "fa-user-tag", "publicKeySubjectLabel", subject);

            this.appendPublicKeyInfoRow(tableDiv, "fa-shield-halved", "publicKeyAlgorithmLabel", this.formatPublicKeyValue(publicKey.algorithm));

            if (publicKey.type !== undefined)
                this.appendPublicKeyInfoRow(tableDiv, "fa-key", "publicKeyTypeLabel", this.formatPublicKeyValue(publicKey.type));

            if (typeof publicKey.format === "string" && publicKey.format !== "")
                this.appendPublicKeyInfoRow(tableDiv, "fa-file-code", "publicKeyFormatLabel", publicKey.format);

            if (publicKey.encoding)
                this.appendPublicKeyInfoRow(tableDiv, "fa-code", "publicKeyEncodingLabel", publicKey.encoding);

            if (publicKey.value)
                this.appendPublicKeyInfoRow(tableDiv, "fa-key", "publicKeyValueLabel", publicKey.value, true);

            if (publicKeyInfo.IsAPublicKeyXY(publicKey))
            {
                this.appendPublicKeyInfoRow(tableDiv, "fa-arrows-left-right", "publicKeyXCoordinateLabel", publicKey.x, true);
                this.appendPublicKeyInfoRow(tableDiv, "fa-arrows-up-down", "publicKeyYCoordinateLabel", publicKey.y, true);
            }

            if (publicKey.certainty !== undefined)
            {
                const certainty = publicKey.certainty <= 1
                                      ? Math.round(publicKey.certainty * 100).toString() + " %"
                                      : publicKey.certainty.toString();
                this.appendPublicKeyInfoRow(tableDiv, "fa-circle-check", "publicKeyCertaintyLabel", certainty);
            }

            if (publicKey.signatures !== undefined)
            {
                const signatureText = publicKey.signatures.length === 1
                                          ? this.chargy.GetLocalizedMessage("publicKeyOneSignatureLabel")
                                          : publicKey.signatures.length.toString() + " " + this.chargy.GetLocalizedMessage("publicKeySignaturesLabel");
                this.appendPublicKeyInfoRow(tableDiv, "fa-file-signature", "publicKeySignatureCountLabel", signatureText);
            }
        }

    }

    private appendPublicKeyInfoRow(tableDiv:  HTMLDivElement,
                                   icon:      string,
                                   labelKey:  string,
                                   value:     string,
                                   isKey:     boolean = false): void
    {

        const rowDiv          = tableDiv.appendChild(document.createElement('div'));
        rowDiv.className      = "publicKeyInfo";

        const iconDiv         = rowDiv.appendChild(document.createElement('div'));
        iconDiv.className     = "icon";
        const iconElement     = iconDiv.appendChild(document.createElement('i'));
        iconElement.className = "fas " + icon;

        const textDiv         = rowDiv.appendChild(document.createElement('div'));
        textDiv.className     = "text";

        const labelDiv        = textDiv.appendChild(document.createElement('div'));
        labelDiv.className    = "label";
        labelDiv.innerText    = this.chargy.GetLocalizedMessage(labelKey);

        const valueDiv        = textDiv.appendChild(document.createElement('div'));
        valueDiv.className    = isKey ? "value keyValue" : "value";
        valueDiv.innerText    = value;

    }

    private formatPublicKeyValue(value: unknown): string
    {

        if (typeof value === "string")
            return value;

        if (Array.isArray(value))
            return value.filter(item => typeof item === "string").join(", ");

        if (chargyLib.isObject(value))
        {
            if (chargyLib.isOIDInfo(value))
                return value.name + " (" + value.oid + ")";

            return Object.entries(value)
                         .map(([ key, item ]) => key + ": " + (Array.isArray(item) ? item.join(", ") : String(item)))
                         .join(" · ");
        }

        return value == null ? "" : String(value);

    }

    //#endregion


    private publishVerificationResult(CTR: chargeTransparencyRecord.IChargeTransparencyRecord): void {

        this.electron.setVerificationResult(
            chargyLib.toSessionVerificationResults(
                CTR,
                this.chargy.GetMultilanguageText("No charge transparency records found!")
            )
        );

    }

    /**
     * What a live link amounts to, as the one verification result it has.
     *
     * A live link is one document rather than a list of charging sessions, so
     * there is one result. The verdict is the one the badge would show, built
     * from the same two things: the signatures over the document, and those
     * over the meter values measured so far. That is deliberate - what the
     * window shows for a document, what the command line prints for it and
     * what the HTTP API answers about it must not be three different answers.
     * It also means the live-link reading of a still-running session applies
     * everywhere: a session with no stop value yet is not a defect.
     *
     * The message is for the readers that show one. The HTTP API does not - its
     * rows carry a status and nothing else - and it localizes the status itself,
     * per request, because one renderer serves every language at once.
     */
    private liveLinkVerificationResults(LiveLink:     chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                        MeterValues:  chargeTransparencyRecord.IChargeTransparencyRecord|null):
        Array<{ status: chargyInterfaces.SessionVerificationResult; message?: string }> {

        const headline = this.liveLinkSignatureHeadline(LiveLink);

        return [{
            status:   liveLinkVerificationResult(this.liveLinkOverallState(LiveLink, MeterValues)),
            ...(headline !== null ? { message: headline } : {})
        }];

    }

    private publishLiveLinkVerificationResult(LiveLink:     chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                              MeterValues:  chargeTransparencyRecord.IChargeTransparencyRecord|null): void {

        this.electron.setVerificationResult(this.liveLinkVerificationResults(LiveLink, MeterValues));

    }


    //#region showSimpleURL(URLInfo)

    private showSimpleURL(URLInfo: simpleURL.IURL): void
    {

        this.currentSimpleURL                       = URLInfo;
        this.currentChargeTransparencyRecord        = null;
        this.currentChargeTransparencyLiveLink      = null;
        this.currentLiveLinkMeterValues             = null;
        this.currentPublicKeyLookup                 = null;
        this.currentGlobalError                     = null;
        this.clearRenderedChargeData();

        this.inputDiv.style.flexDirection           = "column";
        this.aboutScreenDiv.style.display           = "none";
        //this.imprintScreenDiv.style.display         = "none";
        this.chargingSessionScreenDiv.style.display = "flex";
        this.chargingSessionScreenDiv.innerText     = "";
        this.invalidDataSetsScreenDiv.style.display = "none";
        this.invalidDataSetsScreenDiv.innerText     = "";
        this.inputButtonsDiv.style.display          = "flex";
        this.exportButtonDiv.style.display          = "none";

        const descriptionDiv       = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id          = "description";
        descriptionDiv.innerText   = this.chargy.GetLocalizedMessage("urlDetailsTitle");

        const urlsDiv              = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        urlsDiv.id                 = "chargingSessions";

        const urlDiv               = chargyLib.CreateDiv(urlsDiv, "chargingSession");
        urlDiv.classList.add("publicKeyCard");

        const cardTitleDiv         = urlDiv.appendChild(document.createElement('div'));
        cardTitleDiv.className     = "date";
        cardTitleDiv.innerText     = this.chargy.GetLocalizedMessage("urlLabel");

        const tableDiv             = urlDiv.appendChild(document.createElement('div'));
        tableDiv.className         = "table publicKeyTable";

        this.appendPublicKeyInfoRow(tableDiv, "fa-globe", "urlContextLabel", URLInfo["@context"]);
        this.appendPublicKeyInfoRow(tableDiv, "fa-link",  "urlAddressLabel", URLInfo.url, true);

        if (URLInfo.method !== undefined)
            this.appendPublicKeyInfoRow(tableDiv, "fa-right-left", "urlMethodLabel", URLInfo.method);

        if (URLInfo.acceptType !== undefined)
            this.appendPublicKeyInfoRow(tableDiv, "fa-file-arrow-down", "urlAcceptTypeLabel", URLInfo.acceptType);

        if (URLInfo.actions !== undefined)
            this.appendPublicKeyInfoRow(tableDiv, "fa-bolt", "urlActionsLabel", URLInfo.actions.join(", "));

        if (URLInfo.serviceTypes !== undefined)
            this.appendPublicKeyInfoRow(tableDiv, "fa-gears", "urlServiceTypesLabel", URLInfo.serviceTypes.join(", "));

        if (URLInfo.serviceData !== undefined)
            this.appendPublicKeyInfoRow(tableDiv, "fa-code", "urlServiceDataLabel", JSON.stringify(URLInfo.serviceData, null, 2), true);

    }

    //#endregion

    //#region showChargeTransparencyLiveLink(LiveLink, MeterValues)

    private showChargeTransparencyLiveLink(LiveLink:     chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                           MeterValues:  chargeTransparencyRecord.IChargeTransparencyRecord|null = null) : void
    {

        if (this.currentChargeTransparencyLiveLink !== LiveLink)
            this.measurementValuesViewMode           = "measurements";

        this.currentChargeTransparencyLiveLink       = LiveLink;
        this.currentLiveLinkMeterValues              = MeterValues;
        this.currentChargeTransparencyRecord         = null;
        this.currentPublicKeyLookup                  = null;
        this.currentSimpleURL                        = null;
        this.currentGlobalError                      = null;
        this.clearRenderedChargeData();

        this.inputDiv.style.flexDirection            = "column";
        this.aboutScreenDiv.style.display            = "none";
        this.settingsScreenDiv.style.display         = "none";
        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "flex";
        this.exportButtonDiv.style.display           = "none";

        const descriptionDiv       = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id          = "description";
        descriptionDiv.innerText   = this.chargy.GetLocalizedText(LiveLink.description) ?? "Charge Transparency Live-Link";

        if (LiveLink.created !== "")
        {
            const timestampDiv     = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            timestampDiv.id        = "begin";
            timestampDiv.className = "dates";
            timestampDiv.innerText = this.chargy.GetLocalizedMessage("Timestamp") + " " + chargyLib.time2human(LiveLink.created);
        }

        const liveLinksDiv         = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        liveLinksDiv.id            = "chargingSessions";

        const liveLinkDiv          = chargyLib.CreateDiv(liveLinksDiv, "chargingSession");
        liveLinkDiv.classList.add("chargeTransparencyLiveLink");

        //#region What the live link knows about its charging session

        // A live link describes exactly one charging session, so it carries
        // single objects where a charge transparency record carries lists. The
        // document names its charging station, its operator and its contract,
        // so those are read through the interface.
        //
        // The station's single "EVSE" with its single "connector" is not what
        // IChargingStation describes - that one knows the lists of a charge
        // transparency record - so those two are read untyped, exactly as
        // ChargyCore reads them when it collects the meter value keys.
        const chargingStation      = LiveLink.chargingStation;
        const evse                 = chargyLib.asJSONObject(chargyLib.asJSONObject(chargingStation)?.["EVSE"]);
        const connector            = chargyLib.asJSONObject(evse?.["connector"]);
        const contract             = LiveLink.contract;
        const geoLocation          = chargingStation?.geoLocation;

        const chargingSession      = MeterValues?.chargingSessions?.[0];
        const measurement          = chargingSession?.measurements?.[0];
        const measurementValues    = measurement != null
                                         ? this.distinctValuesInTimeOrder(measurement.values)
                                         : [];
        const firstValue           = measurementValues[0];
        const lastValue            = measurementValues[measurementValues.length - 1];

        //#endregion

        // When the charging session began. Where a finished session also shows
        // when it ended, a live link cannot: it has not ended yet.
        if (chargingSession?.begin != null)
        {
            const dateDiv          = liveLinkDiv.appendChild(document.createElement('div'));
            dateDiv.className      = "date";
            dateDiv.innerHTML      = chargyLib.time2human(chargingSession.begin);
        }

        const tableDiv             = liveLinkDiv.appendChild(document.createElement('div'));
        tableDiv.className         = "table";

        // How long it has been charging and how much energy the meter has seen
        // so far: the same two lines a finished charging session shows here.
        if (measurement != null && firstValue != null && lastValue != null)
        {

            const elapsed = chargyLib.parseUTC(lastValue. timestamp).valueOf() -
                            chargyLib.parseUTC(firstValue.timestamp).valueOf();

            const energy  = this.getMeasurementValueInKWh(measurement, lastValue).
                                 minus(this.getMeasurementValueInKWh(measurement, firstValue));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "productInfos",
                '<i class="fas fa-chart-pie"></i>',
                [
                    elapsed > 0
                        ? "Ladedauer " + this.formatChargingDuration(elapsed)
                        : "",
                    chargyLib.measurementName2human(measurement.name) + " " +
                        parseFloat(energy.toFixed(10)).toString() + " kWh"
                ].filter(line => line !== "").join("\n")
            );

        }

        const contractId           = contract?.["@id"];

        if (contractId != null && contractId !== "")
            this.appendLiveLinkInfoRow(
                tableDiv,
                "contractInfos",
                '<i class="fas fa-id-card"></i>',
                contractId
            );

        const evseId               = chargyLib.asString(evse?.["@id"]);
        const connectorText        = connector == null
                                         ? ""
                                         : [
                                               chargyLib.asString(connector["standard"]),
                                               chargyLib.asString(connector["format"]),
                                               chargyLib.asString(connector["powerType"]),
                                               chargyLib.asString(connector["maxPower"])
                                           ].filter(value => value != null && value !== "").join(", ");

        if ((evseId != null && evseId !== "") || connectorText !== "")
            this.appendLiveLinkInfoRow(
                tableDiv,
                "chargingStationInfos",
                '<i class="fas fa-charging-station"></i>',
                [ evseId ?? "", connectorText ].filter(line => line !== "").join("\n")
            );

        const latitude             = geoLocation?.lat;
        const longitude            = geoLocation?.lng;

        if (latitude != null && longitude != null)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "locationInfos",
                '<i class="fas fa-map-marker-alt"></i>',
                "Position " + latitude.toString() + ", " + longitude.toString()
            );

        const transports = this.liveLinkTransports(LiveLink);

        if (transports.length > 0)
        {
            const transportsDiv = document.createElement('div');
            transportsDiv.className = "liveLinkTransports";

            for (const transport of transports)
                transportsDiv.appendChild(this.createLiveLinkTransportDiv(transport));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "transportInfos",
                '<i class="fas fa-satellite-dish"></i>',
                transportsDiv
            );
        }

        //#region Whether live reloading is active, blocked or waiting for consent

        // Only when there is something to reload: an https transport stating a
        // refresh period. Filled in asynchronously, once conf, store or the
        // user have spoken.
        if (transports.some(transport => transport.type === "https"          &&
                                         typeof transport.refresh === "number" &&
                                         transport.refresh > 0))
        {

            const trustContentDiv         = document.createElement('div');

            this.liveLinkTrustContentDiv  = trustContentDiv;
            this.liveLinkTrustRowDiv      = this.appendLiveLinkInfoRow(
                                                tableDiv,
                                                "trustInfos",
                                                '<i class="fas fa-shield-alt"></i>',
                                                trustContentDiv
                                            );

            this.liveLinkTrustRowDiv.style.display = "none";

        }

        //#endregion

        // Images no longer hang off the document itself: they belong to
        // whoever they show - the operator's logo, the station's photo - and
        // are read from there, the operator first.
        const imageURLs = [
                              ...(LiveLink.chargingStationOperator?.imageURLs ?? []),
                              ...(chargingStation?.imageURLs                  ?? [])
                          ].filter(imageURL => typeof imageURL === "string" && imageURL !== "");

        if (imageURLs.length > 0)
        {
            const imagesDiv = document.createElement('div');

            for (const imageURL of imageURLs)
                imagesDiv.appendChild(this.createLiveLinkAnchor(imageURL, imageURL));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "imageInfos",
                '<i class="fas fa-image"></i>',
                imagesDiv
            );
        }

        // The operator's signatures over the document itself, and whether they
        // checked out. This belongs directly under the transports and the trust
        // row, because it is what says how much those URLs are worth: they are
        // only the operator's if the signature covering them verifies.
        this.appendLiveLinkSignatureRow(tableDiv, LiveLink);

        // And the verdict over all of it, in the corner of the card - the same
        // badge a charge transparency record carries.
        this.appendLiveLinkVerificationStatus(liveLinkDiv, LiveLink, MeterValues);

        //#region Show the signed meter values the live link already carries

        // Every single meter value, on the right, exactly like those of a
        // finished session: one that arrived a moment ago is read and verified
        // just like one from an archive. A live link describes a single
        // charging session, so there is no session list to choose from and the
        // details are shown right away.
        if (chargingSession != null)
        {
            chargingSession.ctr = MeterValues ?? undefined;
            this.showChargingSessionDetails(chargingSession);
        }

        //#endregion

        this.startLiveLinkRefresh(LiveLink);

    }

    //#region Reloading a live link

    // A live link points at a charging session that is still running, so an
    // https transport may say how often to ask for the document again. Every
    // "refresh" seconds it is fetched in the background: a newer document is
    // processed and displayed like any other, the same one changes nothing.
    //
    // Neither does a request that fails. The transports belong to the operator,
    // and a station that is unreachable for a while must not take a document
    // that was loaded successfully off the screen.
    private startLiveLinkRefresh(LiveLink:    chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                 reconsider:  boolean = false): void
    {

        // stopLiveLinkRefresh() bumps the generation, so any prepare or poll
        // still suspended from a previous start abandons itself the moment it
        // resumes: no second timer chain, and no re-arm after the view has
        // moved on or a decision was revoked.
        this.stopLiveLinkRefresh();

        void this.prepareLiveLinkRefresh(LiveLink, this.liveLinkRefreshGeneration, reconsider);

    }

    // Whether the refresh started by this generation is still the one that
    // should be running: the document has not been replaced, and no newer
    // start has superseded it.
    private isLiveLinkRefreshCurrent(LiveLink:    chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                     generation:  number): boolean
    {
        return this.currentChargeTransparencyLiveLink === LiveLink &&
               this.liveLinkRefreshGeneration         === generation;
    }

    // When reconsider is set, the origins the user has already decided are
    // offered again alongside any still-unknown ones - each with its current
    // choice pre-selected - so "change" reopens the question without first
    // throwing the existing answer away. Dismissing the dialog then keeps
    // every decision exactly as it was.
    private async prepareLiveLinkRefresh(LiveLink:    chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                         generation:  number,
                                         reconsider:  boolean = false): Promise<void>
    {

        const transport = this.liveLinkTransports(LiveLink).find(
                              (candidate): candidate is chargeTransparencyLiveLink.TransportHTTPS =>
                                  candidate.type === "https"
                          );

        if (transport === undefined)
            return;

        // An https transport is there to be asked, so a document that names one
        // without saying how often is still polled - at the default period.
        // Only a value that is no period at all falls back to it; a value that
        // is one is clamped just below.
        const refresh       = typeof transport.refresh === "number" &&
                              Number.isFinite(transport.refresh)    &&
                              transport.refresh > 0
                                  ? transport.refresh
                                  : chargeTransparencyLiveLink.defaultRefreshSeconds;

        // What the document wants sent along with every poll of this transport,
        // and only of this transport: the headers belong to the endpoints it
        // names, not to any other transport's. Read once here - what a value
        // provider computes is read again before every single request.
        const customHeaders = customRequestHeaders(transport.customHeaders);

        // Whatever the document says, a reloading client hammers no one: a
        // viral QR code must not turn every phone that scans it into a flood,
        // and an enormous value must not overflow the timer delay into an
        // immediate loop at the other end of the range.
        const refreshSeconds = Math.min(Math.max(refresh, minimumRefreshSeconds), maximumRefreshSeconds);

        // A live link is a document from outside and may name any URL at all,
        // so its URLs are a trust question. It is answered in tiers: what the
        // installation allowed in "externalURLs.conf" - the same rule that
        // governs deep link verification URLs - and the installation's own
        // origin need no consent; everything else needs the user's, given
        // once per origin and remembered: trust on first use.
        //
        // Unless the installation is in strict mode: then only the listed
        // prefixes and the own origin are ever reloaded, and nothing else is
        // offered. A self-hosting operator that lists its own servers wants
        // this, so its drivers are never asked a trust question they cannot
        // judge.
        const configText     = await this.loadExternalURLConfigText().catch(() => "");
        const rules          = this.parseExternalURLConfig(configText);
        const strictMode     = parseExternalURLConfigMode(configText) === "strict";
        const appIsLoopback  = isLoopbackHost(window.location.hostname);
        const trustedOrigins = this.loadTrustedOrigins();
        const targets        = new Array<LiveLinkPollTarget>();

        // The origins to put to the user, each with the URLs seen for it. On a
        // first ask this holds only the unknown ones; when reconsidering it
        // also holds the already-decided ones, and currentChoice remembers what
        // each was so the dialog can pre-select it.
        const askByOrigin    = new Map<string, Array<URL>>();
        const currentChoice  = new Map<string, LiveLinkOriginChoice>();

        // The origins whose remembered decision actually decided something
        // here: expiry runs on disuse, so every application of a decision
        // restarts its clock.
        const usedOrigins    = new Set<string>();

        const enqueueForAsk  = (origin: string, url: URL, choice?: LiveLinkOriginChoice): void => {

            const urls = askByOrigin.get(origin);

            if (urls !== undefined)
                urls.push(url);
            else
                askByOrigin.set(origin, [ url ]);

            if (choice !== undefined && !currentChoice.has(origin))
                currentChoice.set(origin, choice);

        };

        // The tier the trust row shows is decided by which sources are in play,
        // not by the order the URLs happen to appear in the document: a
        // user-approved origin is worth a Change button even when it sits next
        // to one the installation pre-approved. Installation-only is the
        // fallthrough, so it needs no flag of its own.
        let   hasSession      = false;
        let   hasAlways       = false;
        let   alwaysSince:    string | undefined;
        let   denied          = false;

        for (const url of this.liveLinkTransportURLs(transport))
        {

            let transportURL: URL;

            try
            {
                transportURL = new URL(url, window.location.href);
            }
            catch
            {
                continue;
            }

            // The scheme is decided before any trust tier, and no tier may
            // waive it: an externalURLs.conf prefix and the installation's own
            // origin both skip the structural rules below, and neither of them
            // gets to send a poll in the clear. Only a run that was told to
            // allow http:// does.
            const protocolProblem = transportProtocolProblem(transportURL, appIsLoopback, this.transportAllowances);

            if (protocolProblem !== null)
            {
                console.log("Not reloading this charge transparency live link from '" + transportURL.origin + "': " + protocolProblem + ".");
                continue;
            }

            const rule = this.findExternalURLRule(transportURL, rules);

            if (rule !== null)
            {
                targets.push({ url: transportURL, maxPayloadBytes: rule.maxPayloadBytes, prefix: rule.prefix });
                continue;
            }

            // The installation asking itself is not a trust question.
            if (transportURL.origin === window.location.origin)
            {
                targets.push({ url: transportURL, maxPayloadBytes: defaultTrustedPayloadBytes });
                continue;
            }

            // Strict mode stops here: an origin the installation did not list is
            // neither offered to the user nor polled, and a decision a user may
            // have made in some earlier, non-strict session is not honoured
            // either - the deployment behaves the same in every browser.
            if (strictMode)
            {
                console.log("Not reloading this charge transparency live link from '" + transportURL.origin + "': strict mode allows only the origins listed in externalURLs.conf.");
                continue;
            }

            // The structural rules come before any consent: what fails them
            // is not even asked about.
            const problem = pollTargetProblem(transportURL, appIsLoopback, this.transportAllowances);

            if (problem !== null)
            {
                console.log("Not reloading this charge transparency live link from '" + transportURL.origin + "': " + problem + ".");
                continue;
            }

            if (this.liveLinkSessionAllowedOrigins.has(transportURL.origin))
            {
                if (reconsider)
                {
                    enqueueForAsk(transportURL.origin, transportURL, "once");
                    continue;
                }
                targets.push({ url: transportURL, maxPayloadBytes: defaultTrustedPayloadBytes });
                hasSession = true;
                continue;
            }

            const remembered = findTrustedOrigin(trustedOrigins, transportURL.origin);

            if (remembered?.decision === "allow")
            {
                if (reconsider)
                {
                    enqueueForAsk(transportURL.origin, transportURL, "always");
                    continue;
                }
                targets.push({ url: transportURL, maxPayloadBytes: defaultTrustedPayloadBytes });
                hasAlways    = true;
                alwaysSince ??= remembered.since;
                usedOrigins.add(transportURL.origin);
                continue;
            }

            if (remembered?.decision === "deny")
            {
                if (reconsider)
                {
                    enqueueForAsk(transportURL.origin, transportURL, "deny");
                    continue;
                }
                denied = true;
                usedOrigins.add(transportURL.origin);
                continue;
            }

            enqueueForAsk(transportURL.origin, transportURL);

        }

        //#region Using a decision restarts its idle-expiry clock

        if (usedOrigins.size > 0)
        {

            const nowDate = new Date();
            let   touched = false;

            for (const origin of usedOrigins)
                touched = touchTrustedOrigin(trustedOrigins, origin, nowDate) || touched;

            // A use is persisted no more than hourly, so a live link that
            // reloads every few seconds does not churn the storage.
            if (touched)
                this.saveTrustedOrigins(trustedOrigins);

        }

        //#endregion

        //#region Ask about the unknown origins, before any request goes out

        let   anyUndecided = false;

        if (askByOrigin.size > 0 &&
            this.isLiveLinkRefreshCurrent(LiveLink, generation))
        {

            const decisions = await this.askForLiveLinkTrust(
                                        LiveLink,
                                        Array.from(askByOrigin.keys()),
                                        reconsider ? currentChoice : undefined
                                    );

            if (!this.isLiveLinkRefreshCurrent(LiveLink, generation))
                return;

            const now            = new Date().toISOString();
            const stored         = this.loadTrustedOrigins();
            const alwaysOrigins  = new Array<{ origin: string, urls: Array<URL>, since: string }>();
            const sessionOrigins = new Array<{ origin: string, urls: Array<URL> }>();
            let   storeChanged   = false;

            // The label an entry is filed under in the settings: the operator
            // name the user just saw in the consent dialog. The origins
            // themselves are stored hashed, so this is all the settings screen
            // will have to show.
            const operatorLabel  = sanitizeTrustLabel(chargyLib.asJSONObject(LiveLink["chargingStationOperator"])?.["name"]);

            for (const [ origin, urls ] of askByOrigin)
            {

                switch (decisions.get(origin))
                {

                    case "once":
                        // Session-only: an earlier "always" or "deny" for this
                        // origin is dropped so nothing about it stays remembered.
                        if (removeTrustedOrigin(stored, origin))
                            storeChanged = true;
                        sessionOrigins.push({ origin, urls });
                        break;

                    case "always":
                        // Persisted below in one write; the targets are added
                        // afterwards so the row can tell "always" from the
                        // "this session only" fallback if the write fails.
                        //
                        // A decision that has not changed is not rewritten at
                        // all: the entry keeps its salt, its label and its
                        // date. Rewriting would let any document that names an
                        // already-trusted origin replace the label the user
                        // originally consented under, and a fresh salt on every
                        // confirmation would tell two snapshots of the store
                        // apart by mere re-confirmation activity.
                        {
                            const existing = findTrustedOrigin(stored, origin);

                            if (existing?.decision === "allow")
                            {
                                storeChanged = touchTrustedOrigin(stored, origin, new Date()) || storeChanged;
                                alwaysOrigins.push({ origin, urls, since: existing.since });
                            }

                            else
                            {
                                const entry  = upsertTrustedOrigin(stored, origin, "allow", trustLabelForOrigin(operatorLabel, origin), now);
                                storeChanged = true;
                                alwaysOrigins.push({ origin, urls, since: entry.since });
                            }
                        }
                        break;

                    case "deny":
                        if (findTrustedOrigin(stored, origin)?.decision !== "deny")
                        {
                            upsertTrustedOrigin(stored, origin, "deny", trustLabelForOrigin(operatorLabel, origin), now);
                            storeChanged = true;
                        }
                        else
                            storeChanged = touchTrustedOrigin(stored, origin, new Date()) || storeChanged;
                        denied = true;
                        // A session grant made earlier must not keep the origin
                        // pollable after it has just been blocked.
                        this.liveLinkSessionAllowedOrigins.delete(origin);
                        break;

                    default:
                        // Left undecided: not remembered, not polled this time,
                        // but still offerable through the trust row.
                        anyUndecided = true;
                        break;

                }

            }

            const persisted = storeChanged ? this.saveTrustedOrigins(stored) : true;

            for (const { origin, urls } of sessionOrigins)
            {
                this.liveLinkSessionAllowedOrigins.add(origin);
                hasSession = true;
                for (const url of urls)
                    targets.push({ url: url, maxPayloadBytes: defaultTrustedPayloadBytes });
            }

            for (const { origin, urls, since } of alwaysOrigins)
            {

                // If the write did not stick, the honest tier for this origin
                // is "this session only" - which is exactly how it will behave.
                if (persisted)
                {
                    // A session grant would shadow the stored "always" on the
                    // next prepare (session is checked first), so it is cleared
                    // once the origin is remembered for good.
                    this.liveLinkSessionAllowedOrigins.delete(origin);
                    hasAlways    = true;
                    alwaysSince ??= since;
                }
                else
                {
                    this.liveLinkSessionAllowedOrigins.add(origin);
                    hasSession = true;
                }

                for (const url of urls)
                    targets.push({ url: url, maxPayloadBytes: defaultTrustedPayloadBytes });

            }

        }

        //#endregion

        if (targets.length === 0)
        {

            // Something still offerable outranks a dead end: a user who
            // dismissed can decide later, where nothing pollable never becomes
            // pollable.
            this.updateLiveLinkTrustRow(LiveLink, anyUndecided ? { kind: "ask" }
                                                : denied        ? { kind: "denied" }
                                                :                 { kind: "unavailable" });

            if (!denied && !anyUndecided)
                console.log("Not reloading this charge transparency live link: none of the URLs of its https transport may be polled.");

            return;

        }

        if      (hasAlways)   this.updateLiveLinkTrustRow(LiveLink, { kind: "always", since: alwaysSince });
        else if (hasSession)  this.updateLiveLinkTrustRow(LiveLink, { kind: "session" });
        else                  this.updateLiveLinkTrustRow(LiveLink, { kind: "installation" });

        // A timer that fires after the view has moved on, or after a newer
        // start has superseded this one, does nothing and schedules no
        // successor.
        const poll      = async (): Promise<void> => {

            if (!this.isLiveLinkRefreshCurrent(LiveLink, generation))
                return;

            try
            {
                await this.reloadLiveLink(LiveLink, targets, customHeaders);
            }
            catch
            {
                // Whatever went wrong out there, what is on screen was loaded
                // successfully once and stays.
            }

            if (this.isLiveLinkRefreshCurrent(LiveLink, generation))
                this.liveLinkRefreshTimer = setTimeout(() => void poll(), refreshSeconds * 1000);

        };

        if (this.isLiveLinkRefreshCurrent(LiveLink, generation))
            this.liveLinkRefreshTimer = setTimeout(() => void poll(), refreshSeconds * 1000);

    }

    //#region The remembered decisions

    private static readonly trustedOriginsStorageKey = "chargyLiveLinkTrustedOrigins";

    private loadTrustedOrigins(): ITrustedOriginsStore
    {

        try
        {

            const raw     = localStorage.getItem(ChargyApp.trustedOriginsStorageKey);
            const store   = parseTrustedOriginsStore(raw);

            // Every load is also the moment expired decisions actually go: a
            // pruned entry is written back right away, so it does not linger
            // in storage until the next decision happens to be saved.
            const pruned  = pruneExpiredTrustedOrigins(store, new Date());

            // And whatever is stored that is not exactly the parsed store is
            // rewritten as the parsed store. This is what actually deletes the
            // plain text origins an earlier version kept under this very key:
            // they parse as an empty store, and leaving the old bytes behind
            // would preserve forever precisely what the hashing is for.
            if (pruned || (raw !== null && raw !== serializeTrustedOriginsStore(store)))
                this.saveTrustedOrigins(store);

            return store;

        }
        catch
        {
            // A browser that refuses storage simply asks again next time.
            return emptyTrustedOriginsStore();
        }

    }

    // Returns whether the decisions were actually persisted. A browser that
    // refuses storage (private mode, quota, blocked cookies) is no worse than
    // a repeated question - but the caller must not then claim the decision was
    // remembered, so the failure is reported rather than swallowed.
    private saveTrustedOrigins(store: ITrustedOriginsStore): boolean
    {

        try
        {
            localStorage.setItem(ChargyApp.trustedOriginsStorageKey, serializeTrustedOriginsStore(store));
            return true;
        }
        catch
        {
            return false;
        }

    }

    //#endregion

    //#region The trust dialog

    // Asks about each unknown origin on its own row, so a document cannot make
    // one "allow" carry an origin the user did not mean to trust: allowing the
    // operator's server it recognises does not silently allow an attacker's
    // server listed beside it. Resolves once every origin has a decision, or
    // earlier if the user dismisses - undecided origins are then absent from
    // the result and polled by no one.
    private async askForLiveLinkTrust(LiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                      origins:   Array<string>,
                                      current?:  Map<string, LiveLinkOriginChoice>): Promise<Map<string, LiveLinkOriginChoice>>
    {

        this.closeLiveLinkTrustDialog();

        const description = this.chargy.GetLocalizedText(LiveLink.description);
        const operator    = chargyLib.asString(chargyLib.asJSONObject(LiveLink["chargingStationOperator"])?.["name"]);

        this.liveLinkTrustDocumentDiv.innerText = [
                                                      description ?? chargyLib.asString(LiveLink["@id"]) ?? "",
                                                      operator    ?? ""
                                                  ].filter(line => line !== "").join(" · ");

        // Reconsidering ("change") seeds every origin with its current choice,
        // so the dialog opens already decided and only what the user actually
        // changes is changed. A first ask starts blank and every origin has to
        // be answered.
        const decisions     = new Map<string, LiveLinkOriginChoice>(current);
        const undecided     = new Set<string>(origins.filter(origin => !decisions.has(origin)));

        this.liveLinkTrustDecisions             = decisions;
        this.liveLinkTrustOriginsDiv.innerText  = "";

        for (const origin of origins)
        {

            const rowDiv        = chargyLib.CreateDiv(this.liveLinkTrustOriginsDiv, "trustOrigin");

            // As text, not as markup: CreateDiv's third parameter is innerHTML,
            // and what the user consents to must be displayed exactly as it is.
            const originDiv     = chargyLib.CreateDiv(rowDiv, "origin");
            originDiv.innerText = origin;

            const buttonsDiv    = chargyLib.CreateDiv(rowDiv, "trustOriginButtons");

            const chosen        = decisions.get(origin);

            const addButton     = (labelKey: string, choice: LiveLinkOriginChoice): void => {

                const button      = buttonsDiv.appendChild(document.createElement('button'));
                button.className  = "trustChoice " + choice + (choice === chosen ? " chosen" : "");
                button.innerText  = this.chargy.GetLocalizedMessage(labelKey);
                button.onclick    = (): void => {

                    decisions.set(origin, choice);
                    undecided.delete(origin);

                    for (const sibling of Array.from(buttonsDiv.children))
                        sibling.classList.toggle("chosen", sibling === button);

                    rowDiv.classList.add("decided");

                    // Answering the last still-open origin closes the dialog and
                    // the awaiting caller applies every choice - a clicked button
                    // ends the dialog, as one expects. Reconsidering pre-answers
                    // every origin, so the first click closes; the pre-filled
                    // decisions make that close apply the current choice to
                    // anything left untouched, so nothing is lost.
                    if (undecided.size === 0)
                        this.resolveLiveLinkTrust();

                };

            };

            addButton("allowOnceLabel",   "once");
            addButton("allowAlwaysLabel", "always");
            addButton("doNotAllowLabel",  "deny");

            if (chosen !== undefined)
                rowDiv.classList.add("decided");

        }

        this.liveLinkTrustDialogDiv.style.display = 'block';

        return new Promise(resolve => {
            this.liveLinkTrustResolve = resolve;
        });

    }

    private resolveLiveLinkTrust(): void
    {

        const resolve   = this.liveLinkTrustResolve;
        const decisions = this.liveLinkTrustDecisions ?? new Map<string, LiveLinkOriginChoice>();

        this.liveLinkTrustResolve                 = null;
        this.liveLinkTrustDecisions               = null;
        this.liveLinkTrustDialogDiv.style.display = 'none';

        resolve?.(decisions);

    }

    // Loading another document while the dialog is open counts as no further
    // answer: whatever was decided so far is delivered, and whoever awaits the
    // dialog sees the view has moved on.
    private closeLiveLinkTrustDialog(): void
    {
        if (this.liveLinkTrustResolve !== null)
            this.resolveLiveLinkTrust();
    }

    //#endregion

    //#region The trust row under the live link

    private updateLiveLinkTrustRow(LiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                   state:     LiveLinkTrustState): void
    {

        const rowDiv     = this.liveLinkTrustRowDiv;
        const contentDiv = this.liveLinkTrustContentDiv;

        if (rowDiv === null || contentDiv === null || this.currentChargeTransparencyLiveLink !== LiveLink)
            return;

        contentDiv.innerText = "";

        const message = (key: string): string => this.chargy.GetLocalizedMessage(key);

        let   statusText:  string;
        let   buttonLabel: string | null = null;

        switch (state.kind)
        {

            case "installation":
                statusText  = message("liveReloadActive") + " (" + message("allowedByThisInstallation") + ")";
                break;

            case "session":
                statusText  = message("liveReloadActive") + " – " + message("thisSessionOnly");
                buttonLabel = message("changeLabel");
                break;

            case "always":
                statusText  = message("liveReloadActive") +
                              (state.since != null && state.since !== ""
                                   ? " – " + message("trustedSince") + " " + new Date(state.since).toLocaleDateString(this.UILanguage)
                                   : "");
                buttonLabel = message("changeLabel");
                break;

            case "denied":
                statusText  = message("liveReloadBlocked");
                buttonLabel = message("changeLabel");
                break;

            case "ask":
                statusText  = message("liveReloadNotActive");
                buttonLabel = message("allowLabel");
                break;

            case "unavailable":
                statusText  = message("liveReloadNotPossible");
                break;

        }

        chargyLib.CreateDiv(contentDiv, "status", statusText);

        if (buttonLabel !== null)
        {

            const changeButton      = contentDiv.appendChild(document.createElement('button'));
            changeButton.className  = "linkButton trustChange";
            changeButton.innerText  = buttonLabel;

            // Reopens the dialog with every origin's current choice
            // pre-selected, so changing one answer keeps the others and simply
            // dismissing the dialog leaves every decision as it was. The button
            // is only a way back into the question, never itself a change.
            changeButton.onclick    = (): void => {
                this.startLiveLinkRefresh(LiveLink, true);
            };

        }

        rowDiv.style.display = "";

    }

    //#endregion

    //#region The remembered origins on the settings screen

    private showSettingsMenu(): void
    {
        this.settingsMenuDiv.style.display           = "block";
        this.settingsTrustedOriginsDiv.style.display = "none";
    }

    private refreshTrustedOriginsList(): void
    {

        const store = this.loadTrustedOrigins();

        //#region The retention controls

        this.trustRetentionEnabledInput.checked = store.retentionMonths !== null;
        this.trustRetentionMonthsInput.disabled = store.retentionMonths === null;

        if (store.retentionMonths !== null)
            this.trustRetentionMonthsInput.value = store.retentionMonths.toString();

        //#endregion

        // Sorted by operator, then by age; entries without a label at the end.
        const entries = [ ...store.origins ].sort(
                            (entry1, entry2) => (entry1.label === "" ? 1 : 0) - (entry2.label === "" ? 1 : 0) ||
                                                entry1.label.localeCompare(entry2.label)                      ||
                                                entry1.since.localeCompare(entry2.since));

        this.trustedOriginsListDiv.innerText     = "";
        this.noTrustedOriginsDiv.style.display   = entries.length > 0 ? "none" : "block";

        for (const entry of entries)
        {

            const rowDiv          = chargyLib.CreateDiv(this.trustedOriginsListDiv, "trustedOrigin");

            const infosDiv        = chargyLib.CreateDiv(rowDiv, "infos");

            // The origin itself is stored hashed, so the row is named after the
            // operator whose document the user consented to. That label is text
            // from an outside document: assigned as text, never as markup.
            const labelDiv        = chargyLib.CreateDiv(infosDiv, "origin");
            labelDiv.innerText    = entry.label !== ""
                                        ? entry.label
                                        : this.chargy.GetLocalizedMessage("unknownOperatorLabel");

            const detailsDiv      = chargyLib.CreateDiv(infosDiv, "details");

            const decisionDiv     = chargyLib.CreateDiv(detailsDiv, "decision");
            decisionDiv.innerHTML = entry.decision === "allow"
                                        ? '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("allowedLabel")
                                        : '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("blockedLabel");

            if (entry.since !== "")
                chargyLib.CreateDiv(detailsDiv, "since",
                                    this.chargy.GetLocalizedMessage("sinceLabel") + " " +
                                    new Date(entry.since).toLocaleDateString(this.UILanguage));

            const expiry = trustedOriginExpiry(entry, store.retentionMonths);

            if (expiry !== null)
                chargyLib.CreateDiv(detailsDiv, "expires",
                                    this.chargy.GetLocalizedMessage("expiresLabel") + " " +
                                    expiry.toLocaleDateString(this.UILanguage));

            const deleteButton      = rowDiv.appendChild(document.createElement('button'));
            deleteButton.className  = "delete";
            deleteButton.innerHTML  = '<i class="fas fa-trash-alt"></i>';
            deleteButton.title      = this.chargy.GetLocalizedMessage("deleteLabel");
            deleteButton.onclick    = (): void => {

                // Salt and hash identify the entry; a plain origin to delete by
                // does not exist here, which is the point of the hashing. For
                // the same reason a session grant given under this origin
                // cannot be cleared from the settings - it ends with the
                // session either way.
                const stored   = this.loadTrustedOrigins();
                stored.origins = stored.origins.filter(candidate => candidate.hash !== entry.hash ||
                                                                    candidate.salt !== entry.salt);
                this.saveTrustedOrigins(stored);

                this.refreshTrustedOriginsList();

                // Revoking a decision has to reach an already-running poll: a
                // live link loaded before this deletion keeps polling with the
                // targets it captured then, including the origin just removed.
                // Stopping is enough - the settings screen has replaced the live
                // link view, so there is nothing to re-poll until a document is
                // shown again, which prepares afresh. Restarting here instead
                // would pop the trust dialog over the settings screen for the
                // very origin the user is removing.
                this.stopLiveLinkRefresh();

            };

        }

    }

    //#endregion

    private stopLiveLinkRefresh(): void
    {

        // Bumping the generation is the actual stop: it cannot cancel a poll
        // already suspended mid-await, but that poll checks the generation
        // before it re-arms, so it will not schedule a successor. Clearing the
        // timer handles the common case where nothing is in flight.
        this.liveLinkRefreshGeneration++;

        if (this.liveLinkRefreshTimer !== null)
        {
            clearTimeout(this.liveLinkRefreshTimer);
            this.liveLinkRefreshTimer = null;
        }

    }

    // The well-formed transports of a live link. liveTransports comes from a
    // document written elsewhere, so it may hold entries that are not
    // transports at all; every reader goes through here, so a broken transport
    // is simply dropped and the rest still work instead of the whole live link
    // failing over it.
    private liveLinkTransports(LiveLink: chargeTransparencyLiveLink.IChargeTransparencyLiveLink): Array<chargeTransparencyLiveLink.LiveTransports>
    {

        return Array.isArray(LiveLink.liveTransports)
                   ? LiveLink.liveTransports.filter(
                         (transport): transport is chargeTransparencyLiveLink.LiveTransports =>
                             chargeTransparencyLiveLink.isLiveTransport(transport)
                     )
                   : [];

    }

    // The URLs of a transport, in the order of their priority. A transport
    // states its endpoints in "urls" - a plain string, or one with a priority
    // and a weight - and nowhere else: a transport written against the
    // withdrawn singular "url" names no endpoint at all, so there is nothing
    // here to show and nothing to poll.
    private liveLinkTransportURLs(transport: chargeTransparencyLiveLink.LiveTransports): Array<string>
    {

        const urls        = new Array<string>();

        const sortedURLs  = [ ...(transport.urls ?? []) ].sort(
                                (url1, url2) => (typeof url1 === "string" ? 0 : url1.priority ?? 0) -
                                                (typeof url2 === "string" ? 0 : url2.priority ?? 0)
                            );

        for (const sortedURL of sortedURLs)
        {

            const url = typeof sortedURL === "string" ? sortedURL : sortedURL.url;

            if (url !== "")
                urls.push(url);

        }

        return urls;

    }

    // Asks each URL in turn until one answers with a live link. A document that
    // describes a different session is ignored, and so is one that is not newer
    // than what is on screen.
    private async reloadLiveLink(LiveLink:       chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                 targets:        Array<LiveLinkPollTarget>,
                                 customHeaders:  Array<ICustomHeader> = []): Promise<void>
    {

        for (const target of targets)
        {

            const requestURL = this.liveLinkRefreshURL(target.url, LiveLink);

            // Adding the timestamp must not move the URL out of the prefix or
            // origin it was allowed under.
            if (target.prefix !== undefined && !isWithinURLPrefixAfterQueryAppend(requestURL.href, target.prefix))
                continue;

            if (requestURL.origin !== target.url.origin)
                continue;

            // Electron's main process performs the network request so this
            // works without browser CORS exceptions. It also resolves and
            // rejects private/reserved addresses, limits same-origin redirects,
            // strips credentials, times out and enforces the payload limit -
            // and it validates these headers again rather than trusting what
            // the renderer hands it.
            //
            // They are resolved here, not once for the series: a one-time
            // password is only ever valid for the request it was computed for.
            const response = await this.electron.fetchLiveLink(
                                       requestURL.href,
                                       target.maxPayloadBytes,
                                       target.prefix,
                                       resolveRequestHeaders(customHeaders)
                                   ).catch((error: unknown) => {
                                       // A poll that cannot even be sent - a
                                       // server that is down, a host that no
                                       // longer resolves - is not fatal: what is
                                       // on screen stays. But it is silent, and
                                       // a silent nothing is the hardest thing
                                       // to diagnose, so it says so here.
                                       console.log("Could not reload this charge transparency live link from '" + requestURL.origin + "': " + (error instanceof Error ? error.message : String(error)));
                                       return null;
                                   });

            if (response === null)
                continue;

            if (!response.ok)
            {
                console.log("Could not reload this charge transparency live link from '" + requestURL.origin + "': " + (response.error ?? "HTTP " + response.status.toString()) + ".");
                continue;
            }

            if (response.data == null)
                continue;

            const text     = new TextDecoder().decode(response.data);

            let   reloaded: unknown;

            try
            {
                reloaded = JSON.parse(text);
            }
            catch
            {
                continue;
            }

            if (!chargeTransparencyLiveLink.IsAChargeTransparencyLiveLink(reloaded) ||
                reloaded["@id"] !== LiveLink["@id"])
            {
                continue;
            }

            if (this.isNewerLiveLink(reloaded, LiveLink))
                await this.detectAndConvertContentFormat(text, {
                                prepareUI:  false,
                                onError:    () => { /* keep what is on screen */ }
                            });

            // The endpoint answered. Whether it had something new or not, there
            // is no reason to ask the next one.
            return;

        }

    }

    // The request says which version the client already has, as
    // "lastUpdated=<timestamp>" next to whatever the URL already carries. A
    // server that keeps track of that can answer with less than the whole
    // document; one that does not care ignores the parameter.
    private liveLinkRefreshURL(url:       URL,
                               LiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink): URL
    {

        const refreshURL  = new URL(url.href);
        const lastUpdated = chargyLib.asString(LiveLink["lastUpdated"]);

        if (lastUpdated !== undefined && lastUpdated !== "")
            refreshURL.searchParams.set("lastUpdated", lastUpdated);

        return refreshURL;

    }

    // "lastUpdated" is what a document says about its own recency, and it is
    // what decides here. A document that does not carry it cannot be told apart
    // from the one already loaded, so it is left alone.
    private isNewerLiveLink(reloaded:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                            current:   chargeTransparencyLiveLink.IChargeTransparencyLiveLink): boolean
    {

        const reloadedLastUpdated = chargyLib.asString(reloaded["lastUpdated"]);

        if (reloadedLastUpdated === undefined)
            return false;

        const currentLastUpdated  = chargyLib.asString(current["lastUpdated"]);

        if (currentLastUpdated === undefined)
            return true;

        return chargyLib.parseUTC(reloadedLastUpdated).valueOf() >
               chargyLib.parseUTC(currentLastUpdated). valueOf();

    }

    //#endregion

    private appendLiveLinkInfoRow(tableDiv:   HTMLDivElement,
                                  className:  string,
                                  iconHTML:   string,
                                  content:    string|HTMLElement): HTMLDivElement
    {

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

        return rowDiv;

    }

    // How many signatures a document carries, as a sentence rather than a number.
    private liveLinkSignatureCountText(count: number): string
    {

        return count === 1
                   ? this.chargy.GetLocalizedMessage("documentOneSignatureLabel")
                   : this.chargy.GetLocalizedMessageWithParameter("documentSignaturesLabel", count);

    }

    // The signatures over the whole document and what became of them.
    //
    // Says only what was actually established. A document nobody signed is not
    // the same as one whose signature does not match, and neither is the same as
    // a signature this application cannot judge because it does not know the
    // algorithm - so each gets its own wording, and the detail lines come from
    // ChargyCore, which knows which of the three it found.
    /**
     * The one line that says what the signatures over the document came to.
     *
     * The window shows it in the signature row and the command line prints it
     * beside the verdict, so it lives here once: one document, one wording, in
     * one language - the user's. Null means there is nothing to say at all.
     *
     * Naming the ratio is the only honest headline when some verified and some
     * did not, because neither "verified" nor "not verified" is then true of
     * the document as a whole.
     */
    private liveLinkSignatureHeadline(LiveLink: chargeTransparencyLiveLink.IChargeTransparencyLiveLink): string | null
    {

        const verification   = LiveLink.signatureVerification;
        const signatureCount = Array.isArray(LiveLink.signatures) ? LiveLink.signatures.length : 0;

        // A document read by a ChargyCore that does not verify document
        // signatures carries no verdict. Counting the signatures is then still
        // honest; claiming anything about them would not be.
        if (verification === undefined)
            return signatureCount > 0 ? this.liveLinkSignatureCountText(signatureCount) : null;

        const countAnd = (message: string): string =>
                             this.liveLinkSignatureCountText(signatureCount) + " · " + message;

        return verification.status === "unsigned"
                   ? this.chargy.GetLocalizedMessage("documentNotSignedLabel")
                   : verification.status === "allValid"
                         ? countAnd(this.chargy.GetLocalizedMessage("documentSignaturesVerifiedLabel"))
                         : verification.status === "someValid"
                               ? countAnd(this.chargy.GetLocalizedMessageWithParameter(
                                              "documentSignaturesPartiallyVerifiedLabel",
                                              verification.validCount.toString() + "/" + signatureCount.toString()
                                          ))
                               : countAnd(this.chargy.GetLocalizedMessage("documentSignaturesNotVerifiedLabel"));

    }

    private appendLiveLinkSignatureRow(tableDiv:  HTMLDivElement,
                                       LiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink): void
    {

        const verification   = LiveLink.signatureVerification;
        const headline       = this.liveLinkSignatureHeadline(LiveLink);

        // Nothing was established and there is nothing to count: no row rather
        // than an empty one.
        if (headline === null)
            return;

        // Counted, but not judged - so there is a line to show and no verdict
        // to colour it with.
        if (verification === undefined)
        {

            this.appendLiveLinkInfoRow(
                tableDiv,
                "signatureInfos",
                '<i class="fas fa-file-signature"></i>',
                headline
            );

            return;

        }

        const contentDiv     = document.createElement('div');
        const statusDiv      = chargyLib.CreateDiv(contentDiv, "signatureStatus");

        const describe       = (state:      string,
                                iconClass:  string,
                                text:       string): void => {

            statusDiv.classList.add(state);

            const iconElement     = statusDiv.appendChild(document.createElement('i'));
            iconElement.className = iconClass;

            // As a text node, not as markup: none of this is meant to be read
            // as HTML, and part of it comes from a document written elsewhere.
            statusDiv.appendChild(document.createTextNode(" " + text));

        };

        // The colour says how bad it is, the wording says what happened.
        const state    = documentSignatureState(verification);

        describe(state,
                 state === "valid"   ? "fas fa-check-circle"
                 : state === "invalid" ? "fas fa-times-circle"
                 :                       "fas fa-exclamation-circle",
                 headline);

        // Why, in ChargyCore's words: that the signature does not match, that
        // the key is not in the document, that the algorithm is unknown.
        //
        // Several signatures failing the same way say one thing, not several,
        // so the same sentence is never printed twice - whatever the core that
        // produced the warnings did about it.
        const shown = new Set<string>();

        for (const warning of LiveLink.warnings ?? [])
        {

            const text = this.chargy.GetLocalizedText(warning.message);

            if (text != null && text !== "" && !shown.has(text))
            {

                shown.add(text);

                const warningDiv     = chargyLib.CreateDiv(contentDiv, "signatureWarning");
                warningDiv.innerText = text;

            }

        }

        this.appendLiveLinkInfoRow(
            tableDiv,
            "signatureInfos",
            '<i class="fas fa-file-signature"></i>',
            contentDiv
        );

    }

    // The one verdict over the whole live link, the counterpart of the badge a
    // charge transparency record carries: everything verified, something that
    // could not be judged, or something that demonstrably does not hold.
    //
    // Two independent things have to hold for green, and both are signatures:
    // the ones over the document - which make the transport URLs and the listed
    // keys the operator's - and the ones over every single meter value. The
    // worst of the two decides, because a verdict over the whole is only ever
    // as good as its weakest part.
    private liveLinkOverallState(LiveLink:     chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                 MeterValues:  chargeTransparencyRecord.IChargeTransparencyRecord|null): LiveLinkOverallState
    {

        const states       = new Array<LiveLinkOverallState>();
        const verification = LiveLink.signatureVerification;

        //#region What the signatures over the document say

        if (verification !== undefined)
            states.push(documentSignatureState(verification));

        //#endregion

        //#region What the signatures over the meter values say

        const chargingSession = MeterValues?.chargingSessions?.[0];

        if (chargingSession != null)
        {

            const sessionState = meterValueSessionState(chargingSession.verificationResult?.status);

            if (sessionState === "valid")
                states.push(this.hasSessionWarnings(chargingSession) ? "warning" : "valid");

            else if (sessionState !== null)
                states.push(sessionState);

            // The session verdict is an aggregate; the badge claims something
            // about every single meter value, so every single one is looked at.
            for (const measurement of chargingSession.measurements ?? [])
                for (const measurementValue of measurement.values)
                    states.push(measurementValueState(measurementValue.result?.status));

        }

        //#endregion

        // Nothing to go on at all - no verification of the document, and no
        // meter values yet.
        return worstLiveLinkState(states);

    }

    // The badge in the top right corner of the live link, built exactly like
    // the one of a charge transparency record so that it reads the same.
    private appendLiveLinkVerificationStatus(liveLinkDiv:  HTMLDivElement,
                                             LiveLink:     chargeTransparencyLiveLink.IChargeTransparencyLiveLink,
                                             MeterValues:  chargeTransparencyRecord.IChargeTransparencyRecord|null): void
    {

        const statusDiv     = liveLinkDiv.appendChild(document.createElement('div'));
        statusDiv.className = "verificationStatus";

        const describe      = (iconClass: string, messageKey: string): void => {

            const iconElement     = statusDiv.appendChild(document.createElement('i'));
            iconElement.className = iconClass;

            statusDiv.appendChild(document.createTextNode(" " + this.chargy.GetLocalizedMessage(messageKey)));

        };

        switch (this.liveLinkOverallState(LiveLink, MeterValues))
        {

            case "valid":
                describe("fas fa-check-circle",       "liveLinkValidLabel");
                break;

            case "warning":
                statusDiv.classList.add("warning");
                describe("fas fa-exclamation-circle", "liveLinkWarningsLabel");
                break;

            case "invalid":
                describe("fas fa-times-circle",       "liveLinkInvalidLabel");
                break;

            case "unvalidated":
                describe("fas fa-question-circle",    "Unvalidated");
                break;

        }

    }

    private createLiveLinkTransportDiv(transport: chargeTransparencyLiveLink.LiveTransports): HTMLDivElement {

        const transportDiv = document.createElement('div');
        transportDiv.className = "liveLinkTransport";

        const transportTypeDiv = transportDiv.appendChild(document.createElement('div'));
        transportTypeDiv.className = "type";
        transportTypeDiv.innerText = transport.type;

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
            totpDiv.innerText = transport.totp.timeStep != null
                                    ? "TOTP: " + transport.totp.timeStep.toString() + " s"
                                    : "TOTP";
        }

        return transportDiv;

    }

    private createLiveLinkAnchor(url: string,
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

    private showChargeTransparencyRecord(CTR: chargeTransparencyRecord.IChargeTransparencyRecord) : void
    {

        if (this.currentChargeTransparencyRecord !== CTR)
            this.measurementValuesViewMode           = "measurements";

        this.currentChargeTransparencyRecord         = CTR;
        this.currentChargeTransparencyLiveLink       = null;
        this.currentLiveLinkMeterValues              = null;
        this.currentPublicKeyLookup                  = null;
        this.currentSimpleURL                        = null;
        this.currentGlobalError                      = null;
        this.clearRenderedChargeData();

        //#region Prepare View

        this.inputDiv.style.flexDirection            = "column";
        this.aboutScreenDiv.style.display            = "none";
        //this.imprintScreenDiv.style.display          = "none";
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

        const ctrBeginText        = CTR.begin != null ? chargyLib.parseUTC(CTR.begin).format('dddd, D. MMMM YYYY') : null;
        const ctrEndText          = CTR.end   != null ? chargyLib.parseUTC(CTR.end).  format('dddd, D. MMMM YYYY') : null;

        if (typeof(ctrBeginText) === "string") {
            const beginDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            beginDiv.id        = "begin";
            beginDiv.className = "dates";
            beginDiv.innerHTML = (ctrBeginText == ctrEndText ? this.chargy.GetLocalizedMessage("on") : this.chargy.GetLocalizedMessage("from")) + " " + ctrBeginText;
        }

        if (typeof(ctrEndText) === "string" && ctrEndText != ctrBeginText) {
            const endDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            endDiv.id          = "end";
            endDiv.className   = "dates";
            endDiv.innerHTML   = this.chargy.GetLocalizedMessage("till") + " " + ctrEndText;
        }

        //#endregion

        //#region Show global contract infos

        // if (CTR.contracts)
        // {
        // }

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
                chargingSessionDiv.onclick  = (ev: MouseEvent): void => {

                    //#region Highlight the selected charging session...

                    const AllChargingSessionsDivs = document.getElementsByClassName("chargingSession");

                    for (const chargingSessionsDiv of AllChargingSessionsDivs)
                        chargingSessionsDiv.classList.remove("activated");

                    //(this as HTMLDivElement)?.classList.add("activated");
                    (ev.currentTarget as HTMLDivElement).classList.add("activated");

                    //#endregion

                    this.showChargingSessionDetails(chargingSession);

                };

                //#region Show session time infos

                try
                {

                    if (typeof(chargingSession.begin) === "string")
                    {

                        const dateDiv  = chargingSessionDiv.appendChild(document.createElement('div'));
                        dateDiv.className = "date";
                        //dateDiv.innerHTML = UTC2human(chargingSession.begin);
                        dateDiv.innerHTML = chargyLib.time2human(chargingSession.begin);

                        if (typeof(chargingSession.end) === "string")
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

                    if (chargingSession.begin !== undefined && chargingSession.end !== undefined)
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

                    for (const measurement of chargingSession.measurements ?? [])
                    {
                        //<i class="far fa-chart-bar"></i>
                        if (measurement.values.length > 0)
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

                                // if (measurement.scale == undefined || measurement.scale == null)
                                //     measurement.scale = 0;

                            }

                            const first  = measurement.values[0]?.value                           ?? new Decimal(0);
                            const last   = measurement.values[measurement.values.length-1]?.value ?? first;
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

                    if (chargingSession.authorizationStart != null)
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

                    }

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

                    if (chargingSession.EVSEId            || chargingSession.EVSE            ||
                        chargingSession.chargingStationId || chargingSession.chargingStation ||
                        chargingSession.chargingPoolId    || chargingSession.chargingPool)

                         //chargingSession.EVSEId            != "DE*GEF*EVSE*CHARGY*1" &&
                         //chargingSession.chargingStationId != "DE*GEF*STATION*CHARGY*1")

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
                                if (chargingSession.EVSEId !== undefined)
                                {
                                    const evse = this.chargy.GetEVSE(chargingSession.EVSEId);
                                    if (evse)
                                        chargingSession.EVSE = evse;
                                }
                            }

                            chargingStationDiv.classList.add("EVSE");
                            chargingStationDiv.innerHTML      = (chargingSession.EVSE?.description != null
                                                                    ? this.chargy.GetLocalizedText(chargingSession.EVSE.description) + "<br />"
                                                                    : "") +
                                                                (chargingSession.EVSEId !== undefined
                                                                    ? chargingSession.EVSEId
                                                                    : chargingSession.EVSE?.["@id"] ?? "");

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
                {
                    const marker = this.markers.pop();
                    if (marker != null)
                        this.map.removeLayer(marker);
                }

                const leafletWithAwesomeMarkers = L as typeof L & {
                    AwesomeMarkers?: {
                        icon(options: Record<string, unknown>): L.Icon;
                    };
                };
                const redMarker     = leafletWithAwesomeMarkers.AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 'exclamation',
                    markerColor:          'red',
                    iconColor:            '#ecc8c3'
                });

                const orangeMarker  = leafletWithAwesomeMarkers.AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 this.isWarningSession(chargingSession) ? 'exclamation' : 'question',
                    markerColor:          'orange',
                    iconColor:            '#ae6a0a'
                });

                const greenMarker   = leafletWithAwesomeMarkers.AwesomeMarkers?.icon({
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

    // Documents can overlap or repeat the same meter reading. Keep all
    // attestations in the underlying record, but present each reading once in
    // chronological order so tables and interval bars remain meaningful.
    private distinctValuesInTimeOrder(measurementValues: Array<chargeTransparencyRecord.IMeasurementValue>)
        : Array<chargeTransparencyRecord.IMeasurementValue>
    {

        const inTimeOrder    = measurementValues.
                                   map(measurementValue => ({
                                       measurementValue,
                                       timestamp: chargyLib.parseUTC(measurementValue.timestamp).valueOf()
                                   })).
                                   sort((entry1, entry2) => entry1.timestamp - entry2.timestamp);

        const distinctValues = new Array<chargeTransparencyRecord.IMeasurementValue>();
        let   previousTimestamp: number  | undefined;
        let   previousValue:     Decimal | undefined;

        for (const entry of inTimeOrder)
        {

            if (previousTimestamp === entry.timestamp &&
                previousValue?.equals(entry.measurementValue.value) === true)
            {
                continue;
            }

            distinctValues.push(entry.measurementValue);
            previousTimestamp = entry.timestamp;
            previousValue     = entry.measurementValue.value;

        }

        return distinctValues;

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

    private formatChargingDuration(milliseconds: number): string
    {

        const duration = this.moment.duration(milliseconds);

        if (Math.floor(duration.asDays())    > 1) return `${duration.days()} Tage ${duration.hours()} Std. ${duration.minutes()} Min. ${duration.seconds()} Sek.`;
        if (Math.floor(duration.asDays())    > 0) return `${duration.days()} Tag ${duration.hours()} Std. ${duration.minutes()} Min. ${duration.seconds()} Sek.`;
        if (Math.floor(duration.asHours())   > 0) return `${duration.hours()} Std. ${duration.minutes()} Min. ${duration.seconds()} Sek.`;
        if (Math.floor(duration.asMinutes()) > 0) return `${duration.minutes()} Minuten ${duration.seconds()} Sekunden`;
        if (Math.floor(duration.asSeconds()) > 0) return `${duration.seconds()} Sekunden`;

        return "";

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

        const measurementValues = this.distinctValuesInTimeOrder(measurement.values);

        if (measurementValues.length <= 2)
            return null;

        const points: ChargingProgressChartPoint[] = [];
        const tickTimestamps: number[] = [];
        const tickStatuses: ChargingProgressTickStatus[] = [];
        let   previousValue: Decimal | null = null;
        let   previousTimestamp: number | null = null;

        for (const measurementValue of measurementValues)
        {

            const currentValue     = this.getMeasurementValueInKWh(measurement, measurementValue);
            const currentTimestamp = chargyLib.parseUTC(measurementValue.timestamp).valueOf();

            if (previousTimestamp !== null && currentTimestamp <= previousTimestamp)
                continue;

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
        const lastTickTimestamp       = chartData.tickTimestamps[lastTickIndex];
        if (lastTickTimestamp === undefined)
            return null;
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
        energyButton.onclick       = (): void => { showChart("energy", energyButton); };
        powerButton.onclick        = (): void => { showChart("power",  powerButton); };

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

    private showChargingSessionDetails(chargingSession: chargeTransparencyRecord.IChargingSession) : void
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
                        measurement.chargingSession.chargingStation.hardware?.serialNumber                ||
                        measurement.chargingSession.chargingStation.firmware?.version                     ||
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

                        const manufacturer = getObjectName(measurement.chargingSession.chargingStation.manufacturer);
                        if (manufacturer.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "manufacturer",
                                                 this.chargy.GetLocalizedMessage("Manufacturer"),
                                                 manufacturer);
                        }

                        const model = getObjectName(measurement.chargingSession.chargingStation.model);
                        if (model.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "model",
                                                 this.chargy.GetLocalizedMessage("Model"),
                                                 model);
                        }

                        if (measurement.chargingSession.chargingStation.hardware?.serialNumber &&
                            measurement.chargingSession.chargingStation.hardware.serialNumber.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "serialNumber",
                                                 this.chargy.GetLocalizedMessage("Serial Number"),
                                                 measurement.chargingSession.chargingStation.hardware.serialNumber);
                        }

                        if (measurement.chargingSession.chargingStation.firmware?.version &&
                            measurement.chargingSession.chargingStation.firmware.version.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "firmwareVersion",
                                                 this.chargy.GetLocalizedMessage("Firmware Version"),
                                                 measurement.chargingSession.chargingStation.firmware.version);
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

                        const meterManufacturer = getObjectName(meter.manufacturer);
                        if (meterManufacturer.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterManufacturer",
                                                 this.chargy.GetLocalizedMessage("Manufacturer"),
                                                 meterManufacturer);

                        const meterModel = getObjectName(meter.model);
                        if (meterModel.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterModel",
                                                 this.chargy.GetLocalizedMessage("Model"),
                                                 meterModel);

                        if (meter.hardware?.revision && meter.hardware.revision.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterHardwareVersion",
                                                 this.chargy.GetLocalizedMessage("Hardware Version"),
                                                 meter.hardware.revision);

                        if (meter.firmware?.version && meter.firmware.version.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterFirmwareVersion",
                                                 this.chargy.GetLocalizedMessage("Firmware Version"),
                                                 meter.firmware.version);

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

                            if (showChargingTariff(tariffTableDiv,
                                                  tariff,
                                                  this.UILanguage,
                                                  key => this.chargy.GetLocalizedMessage(key)))
                                continue;

                            const chargingPeriodRow    = tariffTableDiv.appendChild(document.createElement('div'));
                            chargingPeriodRow.classList.add("chargingTariffRow");
                            chargingPeriodRow.onclick  = (): void => {
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

                        const interpretedBETTariffs = chargingSession.chargingTariffs
                                                                     .map(tariff => chargyLib.tryParseOCMFBonnTariffText(tariff["@id"]))
                                                                     .filter(tariff => tariff !== undefined);
                        const interpretedBETTariff  = interpretedBETTariffs.length === 1
                                                          ? interpretedBETTariffs[0]
                                                          : undefined;

                        if (interpretedBETTariff !== undefined)
                        {
                            const costs = calculateBETTariffTotal(interpretedBETTariff, measurement);

                            if (costs !== undefined)
                            {
                                const totalDiv = tariffTableDiv.appendChild(document.createElement('div'));
                                totalDiv.classList.add("betTariffTotal");

                                const totalLabelDiv = totalDiv.appendChild(document.createElement('div'));
                                totalLabelDiv.classList.add("label");
                                totalLabelDiv.textContent = this.chargy.GetLocalizedMessage("BET tariff total price");

                                const totalAmountDiv = totalDiv.appendChild(document.createElement('div'));
                                totalAmountDiv.classList.add("amount");
                                totalAmountDiv.textContent = formatBETEuroAmount(costs.totalPrice, this.UILanguage);
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

                                const chargingPeriodRow      = chargingPeriodsTableDiv.appendChild(document.createElement('div'));
                                chargingPeriodRow.classList.add("chargingPeriodRow");
                                chargingPeriodRow.onclick    = (): void => {
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

                    const measurementValues     = this.distinctValuesInTimeOrder(measurement.values);

                    if (measurementValues.length > 0)
                    {

                        let   measurementCounter    = 0;
                        let   previousValue         = new Decimal(0);

                        const measurementValuesDiv  = chargyLib.CreateDiv(this.detailedInfosDiv, "measurementValues");
                                                      chargyLib.CreateDiv(measurementValuesDiv,  "headline2",
                                                                          this.chargy.GetLocalizedMessage("Meter Values"));

                        const viewLinksDiv          = measurementValues.length > 2
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

                        for (const measurementValue of measurementValues)
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

        function doError(text: string): void
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

    private showPKIDetails(_pkiData:  unknown) : void
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
