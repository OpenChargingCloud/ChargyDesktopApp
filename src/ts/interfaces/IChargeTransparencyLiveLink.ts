/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
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

import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from '../chargyLib'


export const ChargeTransparencyLiveLinkContext = "https://open.charging.cloud/contexts/chargeTransparency/live/link/1.0";


function isConnector(data: unknown): data is IConnector {
    if (!chargyInterfaces.isObject(data))
        return false;

    return [ "standard", "format", "powerType", "maxPower" ].
               every(key => data[key] === undefined || typeof data[key] === "string");
}

function isTransportURL(data: unknown): data is ITransportURL|string {

    if (typeof data === "string")
        return data.trim() !== "";

    return chargyInterfaces.isObject(data) &&
           typeof data["url"] === "string" &&
           (data["priority"] === undefined || typeof data["priority"] === "number") &&
           (data["weight"]   === undefined || typeof data["weight"]   === "number");

}

function isTransport(data: unknown): data is Transport {

    if (!chargyInterfaces.isObject(data))
        return false;

    const type = data["type"];

    if (type !== "https"     &&
        type !== "httpSSE"   &&
        type !== "websocket")
    {
        return false;
    }

    return (data["url"]  === undefined || typeof data["url"] === "string") &&
           (data["urls"] === undefined || (Array.isArray(data["urls"]) && data["urls"].every(isTransportURL))) &&
           (data["totp"] === undefined || isTOTPConfig(data["totp"]));

}

export function IsAChargeTransparencyLiveLink(data: unknown): data is IChargeTransparencyLiveLink {

    if (!chargyLib.isMandatoryJSONObject(data))
        return false;

    return data["@context"]    === ChargeTransparencyLiveLinkContext &&
          (data["timestamp"]   === undefined || data["timestamp"] === null || typeof data["timestamp"] === "string") &&
          (data["description"] === undefined || chargyInterfaces.isMultilanguageText(data["description"])) &&
          (data["imageURLs"]   === undefined || (Array.isArray(data["imageURLs"]) && data["imageURLs"].every(value => typeof value === "string"))) &&
          (data["geoLocation"] === undefined || chargyInterfaces.isGeoLocation(data["geoLocation"])) &&
          (data["connector"]   === undefined || isConnector(data["connector"])) &&
          (data["transports"]  === undefined || (Array.isArray(data["transports"]) && data["transports"].every(isTransport))) &&
          (data["signatures"]  === undefined || Array.isArray(data["signatures"]));

}

function isTOTPConfig(data: unknown): data is TOTPConfig {
    return chargyInterfaces.isObject(data) &&
           typeof data["initialSharedSecret"] === "string" &&
           typeof data["timeStep"]            === "number";
}

export interface IChargeTransparencyLiveLink extends chargyLib.JSONObject {

    "@context": typeof ChargeTransparencyLiveLinkContext;

    /** ISO 8601 timestamp */
    timestamp?:     string|null;

    /** Multi-language description */
    description?:   chargyInterfaces.IMultilanguageText;

    /** URLs to images / logos */
    imageURLs?:     string[];

    /** Geographic position of the charging station */
    geoLocation?:   chargyInterfaces.IGeoLocation;

    /** Technical connector data */
    connector?:     IConnector;

    /** Available transport methods for live data */
    transports?:    Transport[];

    /** Digital signatures (currently empty or extendable) */
    signatures?:    chargyInterfaces.ISignature[];

}

/** Connector information */
export interface IConnector {
    standard?:             string;
    format?:               string;
    powerType?:            string;
    maxPower?:             string;
}



/** Union type for the different transport variants */
export type Transport =
  | TransportHTTPS
  | TransportHTTPSSE
  | TransportWebsocket;


export interface ITransport {
    url?:  string;
    urls?: Array<ITransportURL|string>;
    totp?: TOTPConfig;
}

export interface TransportHTTPS     extends ITransport {
    type: "https";
}

export interface TransportHTTPSSE   extends ITransport {
    type: "httpSSE";
}

export interface TransportWebsocket extends ITransport {
    type: "websocket";
}

export interface ITransportURL {
    url:                   string;
    priority?:             number;
    weight?:               number;
}

/** Time-based One-Time Password configuration */
export interface TOTPConfig {
    initialSharedSecret:   string;
    timeStep:              number;
}
