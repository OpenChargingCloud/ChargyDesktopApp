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

import * as chargyLib         from '../chargyLib'
import * as chargyInterfaces  from './chargyInterfaces'


export function IsAPublicKeyLookup(data: unknown): data is IPublicKeyLookup
{

    if (!chargyLib.isMandatoryJSONObject(data))
        return false;

    // if (!chargyInterfaces.isString(data["begin"]))  return false;
    // if (!chargyInterfaces.isString(data["end"]))    return false;

    return Array.isArray(data["publicKeys"]);

}

export interface IPublicKeyLookup extends chargyLib.JSONObject
{
    publicKeys:                 Array<IPublicKeyInfo>;
    status?:                    chargyInterfaces.SessionVerificationResult;
}





export function IsAPublicKeyInfo(data: unknown): data is IPublicKeyInfo
{

    if (!chargyLib.isMandatoryJSONObject(data))
        return false;

    //if (typeof JSONObject["@id"]      !== "string") return false;
    if (!chargyInterfaces.isStringOrStringArray(data["@context"]))   return false;
    //if (typeof JSONObject["subject"]  !== "string") return false;
    if (!chargyInterfaces.isString             (data["value"]))      return false;
    if (!chargyInterfaces.isStringOrOIDInfo    (data["algorithm"]))  return false;

    if (data["certainty"] !== undefined &&
        (typeof data["certainty"] !== "number" ||
        !Number.isFinite(data["certainty"]))) {
        return false;
    }

    if (data["type"] !== undefined &&
        !chargyInterfaces.isStringOrOIDInfo(data["type"])) {
        return false;
    }

    if (data["encoding"] !== undefined &&
        typeof data["encoding"] !== "string") {
        return false;
    }

    if (data["signatures"] !== undefined &&
        !Array.isArray(data["signatures"])) {
        return false;
    }

    return true;

}

export interface IPublicKeyInfo extends chargyLib.JSONObject
{
    "@id"?:                     string; // Just for merging with IChargeTransparencyRecord!
    "@context":                 string;
    subject?:                   string; // |any
    type?:                      string|chargyInterfaces.IOIDInfo;
    algorithm:                  string|chargyInterfaces.IOIDInfo;
    value:                      string;
    encoding?:                  string;
    signatures?:                Array<IPublicKeysignature>;
    certainty?:                 number;
}





export interface IPublicKeysignature
{
    "@id":                      string;
    "@context"?:                string;
    timestamp:                  string;
    keyUsage:                   Array<string>;
}
