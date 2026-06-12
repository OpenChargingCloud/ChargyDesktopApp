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

export interface ChargeTransparencyLiveLink {

    "@context": "https://open.charging.cloud/contexts/chargeTransparency/live/link/1.0";

    /** ISO 8601 timestamp */
    timestamp?:     string;

    /** Multi-language description */
    description?:   chargyInterfaces.IMultilanguageText;

    /** URLs to images / logos */
    imageURLs?:     string[];

    /** Geographic position of the charging station */
    geoLocation?:   chargyInterfaces.IGeoLocation;

    /** Technical connector data */
    connector?:     Connector;

    /** Available transport methods for live data */
    transports?:    Transport[];

    /** Digital signatures (currently empty or extendable) */
    signatures?:    any[];

}

/** Connector information */
export interface Connector {
  standard: string;
  format: string;
  powerType: string;
  maxPower: string;
}

/** Union type for the different transport variants */
export type Transport =
  | TransportSnapshot
  | TransportWebsocket
  | TransportHttpSSE;

/** Snapshot transport (simple HTTP GET) */
export interface TransportSnapshot {
  type: "snapshot";
  url: string;
}

/** WebSocket transport with load balancing and optional TOTP */
export interface TransportWebsocket {
  type: "websocket";
  urls: WebsocketUrl[];
  totp?: TOTPConfig;
}

export interface WebsocketUrl {
  url: string;
  priority?: number;
  weight?: number;
}

/** HTTP Server-Sent Events transport */
export interface TransportHttpSSE {
  type: "httpSSE";
  urls: string[];
  totp?: TOTPConfig;
}

/** TOTP configuration (Time-based One-Time Password) */
export interface TOTPConfig {
  initialSharedSecret: string;
  timeStep: number;
}
