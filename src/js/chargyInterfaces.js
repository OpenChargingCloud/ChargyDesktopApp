"use strict";
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
///<reference path="ACrypt.ts" />
function IsAChargeTransparencyRecord(data) {
    if (data == null || data == undefined)
        return false;
    let ctr = data;
    return ctr.begin !== undefined &&
        ctr.end !== undefined &&
        ctr.chargingSessions !== undefined;
}
function IsASessionCryptoResult(data) {
    return data.status !== undefined;
}
function IsAPublicKeyLookup(data) {
    if (data == null || data == undefined)
        return false;
    let lookup = data;
    return lookup.publicKeys !== undefined;
}
var SignatureFormats;
(function (SignatureFormats) {
    SignatureFormats[SignatureFormats["DER"] = 0] = "DER";
    SignatureFormats[SignatureFormats["rs"] = 1] = "rs";
})(SignatureFormats || (SignatureFormats = {}));
function isISessionCryptoResult(obj) {
    return obj.status !== undefined;
}
function isICryptoResult(obj) {
    return obj.status !== undefined;
}
var SessionVerificationResult;
(function (SessionVerificationResult) {
    SessionVerificationResult[SessionVerificationResult["UnknownSessionFormat"] = 0] = "UnknownSessionFormat";
    SessionVerificationResult[SessionVerificationResult["InvalidSessionFormat"] = 1] = "InvalidSessionFormat";
    SessionVerificationResult[SessionVerificationResult["PublicKeyNotFound"] = 2] = "PublicKeyNotFound";
    SessionVerificationResult[SessionVerificationResult["InvalidPublicKey"] = 3] = "InvalidPublicKey";
    SessionVerificationResult[SessionVerificationResult["InvalidSignature"] = 4] = "InvalidSignature";
    SessionVerificationResult[SessionVerificationResult["ValidSignature"] = 5] = "ValidSignature";
    SessionVerificationResult[SessionVerificationResult["InconsistentTimestamps"] = 6] = "InconsistentTimestamps";
    SessionVerificationResult[SessionVerificationResult["AtLeastTwoMeasurementsRequired"] = 7] = "AtLeastTwoMeasurementsRequired";
})(SessionVerificationResult || (SessionVerificationResult = {}));
var VerificationResult;
(function (VerificationResult) {
    VerificationResult[VerificationResult["UnknownCTRFormat"] = 0] = "UnknownCTRFormat";
    VerificationResult[VerificationResult["EnergyMeterNotFound"] = 1] = "EnergyMeterNotFound";
    VerificationResult[VerificationResult["PublicKeyNotFound"] = 2] = "PublicKeyNotFound";
    VerificationResult[VerificationResult["InvalidPublicKey"] = 3] = "InvalidPublicKey";
    VerificationResult[VerificationResult["InvalidSignature"] = 4] = "InvalidSignature";
    VerificationResult[VerificationResult["InvalidStartValue"] = 5] = "InvalidStartValue";
    VerificationResult[VerificationResult["InvalidIntermediateValue"] = 6] = "InvalidIntermediateValue";
    VerificationResult[VerificationResult["InvalidStopValue"] = 7] = "InvalidStopValue";
    VerificationResult[VerificationResult["NoOperation"] = 8] = "NoOperation";
    VerificationResult[VerificationResult["StartValue"] = 9] = "StartValue";
    VerificationResult[VerificationResult["IntermediateValue"] = 10] = "IntermediateValue";
    VerificationResult[VerificationResult["StopValue"] = 11] = "StopValue";
    VerificationResult[VerificationResult["ValidSignature"] = 12] = "ValidSignature";
    VerificationResult[VerificationResult["ValidStartValue"] = 13] = "ValidStartValue";
    VerificationResult[VerificationResult["ValidIntermediateValue"] = 14] = "ValidIntermediateValue";
    VerificationResult[VerificationResult["ValidStopValue"] = 15] = "ValidStopValue";
})(VerificationResult || (VerificationResult = {}));
function isIFileInfo(obj) {
    return obj.status !== undefined && obj.name && typeof obj.name === 'string' && obj.data && obj.data instanceof ArrayBuffer;
}
//# sourceMappingURL=chargyInterfaces.js.map