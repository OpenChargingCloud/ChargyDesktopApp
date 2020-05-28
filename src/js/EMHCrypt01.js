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
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="ACrypt.ts" />
class EMHCrypt01 extends ACrypt {
    constructor(chargy) {
        super("ECC secp192r1", chargy);
        this.curve = new this.chargy.elliptic.ec('p192');
    }
    GenerateKeyPair() {
        return this.curve.genKeyPair();
        // privateKey     = keypair.getPrivate();
        // publicKey      = keypair.getPublic();
        // privateKeyHEX  = privateKey.toString('hex').toLowerCase();
        // publicKeyHEX   = publicKey.encode('hex').toLowerCase();
    }
    async SignChargingSession(chargingSession, privateKey) {
        return {
            status: SessionVerificationResult.UnknownSessionFormat
        };
    }
    async VerifyChargingSession(chargingSession) {
        var sessionResult = SessionVerificationResult.UnknownSessionFormat;
        if (chargingSession.measurements) {
            for (var measurement of chargingSession.measurements) {
                measurement.chargingSession = chargingSession;
                // Must include at least two measurements (start & stop)
                if (measurement.values && measurement.values.length > 1) {
                    // Validate...
                    for (var measurementValue of measurement.values) {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue);
                    }
                    // Find an overall result...
                    sessionResult = SessionVerificationResult.ValidSignature;
                    for (var measurementValue of measurement.values) {
                        if (sessionResult == SessionVerificationResult.ValidSignature &&
                            measurementValue.result.status != VerificationResult.ValidSignature) {
                            sessionResult = SessionVerificationResult.InvalidSignature;
                        }
                    }
                }
                else
                    sessionResult = SessionVerificationResult.AtLeastTwoMeasurementsRequired;
            }
        }
        return {
            status: sessionResult
        };
    }
    async SignMeasurement(measurementValue, privateKey) {
        var buffer = new ArrayBuffer(320);
        var cryptoBuffer = new DataView(buffer);
        var cryptoResult = {
            status: VerificationResult.InvalidSignature,
            meterId: SetHex(cryptoBuffer, measurementValue.measurement.energyMeterId, 0),
            timestamp: SetTimestamp32(cryptoBuffer, measurementValue.timestamp, 10),
            infoStatus: SetHex(cryptoBuffer, measurementValue.infoStatus, 14, false),
            secondsIndex: SetUInt32(cryptoBuffer, measurementValue.secondsIndex, 15, true),
            paginationId: SetHex(cryptoBuffer, measurementValue.paginationId, 19, true),
            obis: SetHex(cryptoBuffer, measurementValue.measurement.obis, 23, false),
            unitEncoded: SetInt8(cryptoBuffer, measurementValue.measurement.unitEncoded, 29),
            scale: SetInt8(cryptoBuffer, measurementValue.measurement.scale, 30),
            value: SetUInt64(cryptoBuffer, measurementValue.value, 31, true),
            logBookIndex: SetHex(cryptoBuffer, measurementValue.logBookIndex, 39, false),
            authorizationStart: SetText(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"], 41),
            authorizationStartTimestamp: SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };
        // Only the first 24 bytes/192 bits are used!
        cryptoResult.sha256value = (await sha256(cryptoBuffer)).substring(0, 48);
        // cryptoResult.publicKey    = publicKey.encode('hex').
        //                                       toLowerCase();
        const signature = this.curve.keyFromPrivate(privateKey.toString('hex')).
            sign(cryptoResult.sha256value);
        switch (measurementValue.measurement.signatureInfos.format) {
            case SignatureFormats.DER:
                cryptoResult.signature = {
                    algorithm: measurementValue.measurement.signatureInfos.algorithm,
                    format: measurementValue.measurement.signatureInfos.format,
                    value: signature.toDER('hex')
                };
                return cryptoResult;
            case SignatureFormats.rs:
                cryptoResult.signature = {
                    algorithm: measurementValue.measurement.signatureInfos.algorithm,
                    format: measurementValue.measurement.signatureInfos.format,
                    r: signature.r,
                    s: signature.s
                };
                return cryptoResult;
            //default:
        }
        cryptoResult.status = VerificationResult.ValidSignature;
        return cryptoResult;
    }
    async VerifyMeasurement(measurementValue) {
        function setResult(verificationResult) {
            cryptoResult.status = verificationResult;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }
        measurementValue.method = this;
        var buffer = new ArrayBuffer(320);
        var cryptoBuffer = new DataView(buffer);
        var cryptoResult = {
            status: VerificationResult.InvalidSignature,
            meterId: SetHex(cryptoBuffer, measurementValue.measurement.energyMeterId, 0),
            timestamp: SetTimestamp32(cryptoBuffer, measurementValue.timestamp, 10),
            infoStatus: SetHex(cryptoBuffer, measurementValue.infoStatus, 14, false),
            secondsIndex: SetUInt32(cryptoBuffer, measurementValue.secondsIndex, 15, true),
            paginationId: SetHex(cryptoBuffer, measurementValue.paginationId, 19, true),
            obis: SetHex(cryptoBuffer, OBIS2Hex(measurementValue.measurement.obis), 23, false),
            unitEncoded: SetInt8(cryptoBuffer, measurementValue.measurement.unitEncoded, 29),
            scale: SetInt8(cryptoBuffer, measurementValue.measurement.scale, 30),
            value: SetUInt64(cryptoBuffer, measurementValue.value, 31, true),
            logBookIndex: SetHex(cryptoBuffer, measurementValue.logBookIndex, 39, false),
            authorizationStart: SetText(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"], 41),
            authorizationStartTimestamp: SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };
        var signatureExpected = measurementValue.signatures[0];
        if (signatureExpected != null) {
            try {
                cryptoResult.signature = {
                    algorithm: measurementValue.measurement.signatureInfos.algorithm,
                    format: measurementValue.measurement.signatureInfos.format,
                    r: signatureExpected.r,
                    s: signatureExpected.s
                };
                // Only the first 24 bytes/192 bits are used!
                cryptoResult.sha256value = (await sha256(cryptoBuffer)).substring(0, 48);
                const meter = this.chargy.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null) {
                    cryptoResult.meter = meter;
                    if (meter.publicKeys != null && meter.publicKeys.length > 0) {
                        try {
                            cryptoResult.publicKey = meter.publicKeys[0].value.toLowerCase();
                            cryptoResult.publicKeyFormat = meter.publicKeys[0].format;
                            cryptoResult.publicKeySignatures = meter.publicKeys[0].signatures;
                            try {
                                if (this.curve.keyFromPublic(cryptoResult.publicKey, 'hex').
                                    verify(cryptoResult.sha256value, cryptoResult.signature)) {
                                    return setResult(VerificationResult.ValidSignature);
                                }
                                return setResult(VerificationResult.InvalidSignature);
                            }
                            catch (exception) {
                                return setResult(VerificationResult.InvalidSignature);
                            }
                        }
                        catch (exception) {
                            return setResult(VerificationResult.InvalidPublicKey);
                        }
                    }
                    else
                        return setResult(VerificationResult.PublicKeyNotFound);
                }
                else
                    return setResult(VerificationResult.EnergyMeterNotFound);
            }
            catch (exception) {
                return setResult(VerificationResult.InvalidSignature);
            }
        }
        return {};
    }
    async ViewMeasurement(measurementValue, introDiv, infoDiv, PlainTextDiv, HashedPlainTextDiv, PublicKeyDiv, SignatureExpectedDiv, SignatureCheckDiv) {
        var _a, _b, _c, _d;
        const result = measurementValue.result;
        const cryptoSpan = introDiv.querySelector('#cryptoAlgorithm');
        cryptoSpan.innerHTML = "EMHCrypt01 (" + this.description + ")";
        //#region Plain text
        if (PlainTextDiv != null) {
            if (PlainTextDiv.parentElement != null)
                PlainTextDiv.parentElement.children[0].innerHTML = "Plain text (320 Bytes, hex)";
            PlainTextDiv.style.fontFamily = "";
            PlainTextDiv.style.whiteSpace = "";
            PlainTextDiv.style.maxHeight = "";
            PlainTextDiv.style.overflowY = "";
            this.CreateLine("Zählernummer", measurementValue.measurement.energyMeterId, result.meterId || "", infoDiv, PlainTextDiv);
            this.CreateLine("Zeitstempel", UTC2human(measurementValue.timestamp), result.timestamp || "", infoDiv, PlainTextDiv);
            this.CreateLine("Status", hex2bin(measurementValue.infoStatus) + " (" + measurementValue.infoStatus + " hex)<br /><span class=\"statusInfos\">" +
                this.DecodeStatus(measurementValue.infoStatus).join("<br />") + "</span>", result.infoStatus || "", infoDiv, PlainTextDiv);
            this.CreateLine("Sekundenindex", measurementValue.secondsIndex, result.secondsIndex || "", infoDiv, PlainTextDiv);
            this.CreateLine("Paginierungszähler", parseInt(measurementValue.paginationId, 16), result.paginationId || "", infoDiv, PlainTextDiv);
            this.CreateLine("OBIS-Kennzahl", measurementValue.measurement.obis, result.obis || "", infoDiv, PlainTextDiv);
            this.CreateLine("Einheit (codiert)", measurementValue.measurement.unitEncoded, result.unitEncoded || "", infoDiv, PlainTextDiv);
            this.CreateLine("Skalierung", measurementValue.measurement.scale, result.scale || "", infoDiv, PlainTextDiv);
            this.CreateLine("Messwert", measurementValue.value + " Wh", result.value || "", infoDiv, PlainTextDiv);
            this.CreateLine("Logbuchindex", measurementValue.logBookIndex + " hex", result.logBookIndex || "", infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierung", measurementValue.measurement.chargingSession.authorizationStart["@id"] + " hex", pad(result.authorizationStart, 128) || "", infoDiv, PlainTextDiv);
            this.CreateLine("Autorisierungszeitpunkt", UTC2human(measurementValue.measurement.chargingSession.authorizationStart.timestamp), pad(result.authorizationStartTimestamp, 151) || "", infoDiv, PlainTextDiv);
        }
        //#endregion
        //#region Hashed plain text
        if (HashedPlainTextDiv != null) {
            if (HashedPlainTextDiv.parentElement != null)
                HashedPlainTextDiv.parentElement.children[0].innerHTML = "Hashed plain text (SHA256, 24 bytes, hex)";
            HashedPlainTextDiv.innerHTML = result.sha256value.match(/.{1,8}/g).join(" ");
        }
        //#endregion
        //#region Public Key
        if (PublicKeyDiv != null &&
            result.publicKey != null &&
            result.publicKey != "") {
            if (PublicKeyDiv.parentElement != null)
                PublicKeyDiv.parentElement.children[0].innerHTML = "Public Key (" +
                    (result.publicKeyFormat
                        ? result.publicKeyFormat + ", "
                        : "") +
                    "hex)";
            if (!IsNullOrEmpty(result.publicKey))
                PublicKeyDiv.innerHTML = result.publicKey.startsWith("04") // Add some space after '04' to avoid confused customers
                    ? "<span class=\"leadingFour\">04</span> "
                        + result.publicKey.substring(2).match(/.{1,8}/g).join(" ")
                    : result.publicKey.match(/.{1,8}/g).join(" ");
            //#region Public key signatures
            if (PublicKeyDiv.parentElement != null)
                PublicKeyDiv.parentElement.children[3].innerHTML = "";
            if (!IsNullOrEmpty(result.publicKeySignatures)) {
                for (let signature of result.publicKeySignatures) {
                    try {
                        let signatureDiv = PublicKeyDiv.parentElement.children[3].appendChild(document.createElement('div'));
                        signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(measurementValue.measurement.chargingSession.chargingStation, measurementValue.measurement.chargingSession.EVSE, 
                        //@ts-ignore
                        measurementValue.measurement.chargingSession.EVSE.meters[0], 
                        //@ts-ignore
                        measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys[0], signature);
                    }
                    catch (exception) { }
                }
            }
            //#endregion
        }
        //#endregion
        //#region Signature expected
        if (SignatureExpectedDiv != null && result.signature != null) {
            if (SignatureExpectedDiv.parentElement != null)
                SignatureExpectedDiv.parentElement.children[0].innerHTML = "Erwartete Signatur (" + (result.signature.format || "") + ", hex)";
            if (result.signature.r && result.signature.s)
                SignatureExpectedDiv.innerHTML = "r: " + ((_a = result.signature.r.toLowerCase().match(/.{1,8}/g)) === null || _a === void 0 ? void 0 : _a.join(" ")) + "<br />" +
                    "s: " + ((_b = result.signature.s.toLowerCase().match(/.{1,8}/g)) === null || _b === void 0 ? void 0 : _b.join(" "));
            else if (result.signature.value)
                SignatureExpectedDiv.innerHTML = (_d = (_c = result.signature.value.toLowerCase().match(/.{1,8}/g)) === null || _c === void 0 ? void 0 : _c.join(" ")) !== null && _d !== void 0 ? _d : "-";
        }
        //#endregion
        //#region Signature check
        if (SignatureCheckDiv != null) {
            switch (result.status) {
                case VerificationResult.UnknownCTRFormat:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                    break;
                case VerificationResult.EnergyMeterNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                    break;
                case VerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;
                case VerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;
                case VerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;
                case VerificationResult.ValidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                    break;
                default:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;
            }
        }
        //#endregion
    }
    //#region Helper methods
    DecodeStatus(statusValue) {
        let statusArray = [];
        try {
            let status = parseInt(statusValue);
            if ((status & 1) == 1)
                statusArray.push("Fehler erkannt");
            if ((status & 2) == 2)
                statusArray.push("Synchrone Messwertübermittlung");
            // Bit 3 is reserved!
            if ((status & 8) == 8)
                statusArray.push("System-Uhr ist synchron");
            else
                statusArray.push("System-Uhr ist nicht synchron");
            if ((status & 16) == 16)
                statusArray.push("Rücklaufsperre aktiv");
            if ((status & 32) == 32)
                statusArray.push("Energierichtung -A");
            if ((status & 64) == 64)
                statusArray.push("Magnetfeld erkannt");
        }
        catch (exception) {
            statusArray.push("Invalid status!");
        }
        return statusArray;
    }
}
//# sourceMappingURL=EMHCrypt01.js.map