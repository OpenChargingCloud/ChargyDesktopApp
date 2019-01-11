///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
///<reference path="ACrypt.ts" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var EMHCrypt01 = /** @class */ (function (_super) {
    __extends(EMHCrypt01, _super);
    function EMHCrypt01(GetMeter) {
        var _this = _super.call(this, "ECC secp192r1", GetMeter) || this;
        _this.curve = new _this.elliptic.ec('p192');
        return _this;
    }
    EMHCrypt01.prototype.Calc = function (measurementValue) {
        var buffer = new ArrayBuffer(320);
        var cryptoBuffer = new DataView(buffer);
        var cryptoData = {
            status: "unknown",
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
        var signatureExpected = measurementValue.signatures[0];
        if (signatureExpected != null) {
            cryptoData.signature = {
                algorithm: measurementValue.measurement.signatureInfos.algorithm,
                format: measurementValue.measurement.signatureInfos.format,
                r: signatureExpected.r,
                s: signatureExpected.s
            };
            try {
                var entireHash = this.crypt.createHash('sha256').
                    update(cryptoBuffer).
                    digest('hex');
                // Only the first 24 bytes/192 bits are used!
                cryptoData.sha256value = entireHash.substring(0, 48);
                var meter = this.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null) {
                    cryptoData.meter = meter;
                    var iPublicKey = meter.publicKeys[0];
                    if (iPublicKey != null) {
                        try {
                            cryptoData.publicKey = iPublicKey.value.toLowerCase();
                            cryptoData.publicKeyFormat = iPublicKey.format;
                            try {
                                var result = this.curve.keyFromPublic(cryptoData.publicKey, 'hex').
                                    verify(cryptoData.sha256value, cryptoData.signature);
                                if (result) {
                                    cryptoData.status = "verified";
                                    return cryptoData;
                                }
                                else {
                                    cryptoData.status = "invalid signature";
                                    return cryptoData;
                                }
                            }
                            catch (exception) {
                                cryptoData.status = "invalid signature";
                                return cryptoData;
                            }
                        }
                        catch (exception) {
                            cryptoData.status = "invalid public key";
                            return cryptoData;
                        }
                    }
                    else
                        return { status: "no public key found" };
                }
                else
                    return { status: "energy meter not found" };
            }
            catch (exception) {
                return { status: "invalid signature" };
            }
        }
    };
    EMHCrypt01.prototype.View = function (measurementValue, result, infoDiv, bufferValue, hashedBufferValue, publicKeyValue, signatureExpectedValue, signatureCheckValue) {
        var cryptoDiv = CreateDiv(infoDiv, "row");
        CreateDiv(cryptoDiv, "id", "Kryptoverfahren");
        CreateDiv(cryptoDiv, "value", "EMHCrypt01 (" + this.description + ")");
        hashedBufferValue.parentElement.children[0].innerHTML = "Hashed Puffer (SHA256, 24 bytes)";
        this.CreateLine("Zählernummer", measurementValue.measurement.energyMeterId, result.meterId, infoDiv, bufferValue);
        this.CreateLine("Zeitstempel", measurementValue.timestamp, result.timestamp, infoDiv, bufferValue);
        this.CreateLine("Status", measurementValue.infoStatus, result.infoStatus, infoDiv, bufferValue);
        this.CreateLine("Sekundenindex", measurementValue.secondsIndex, result.secondsIndex, infoDiv, bufferValue);
        this.CreateLine("Paginierung", measurementValue.paginationId, result.paginationId, infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl", measurementValue.measurement.obis, result.obis, infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)", measurementValue.measurement.unitEncoded, result.unitEncoded, infoDiv, bufferValue);
        this.CreateLine("Skalierung", measurementValue.measurement.scale, result.scale, infoDiv, bufferValue);
        this.CreateLine("Messwert", measurementValue.value + " Wh", result.value, infoDiv, bufferValue);
        this.CreateLine("Logbuchindex", measurementValue.logBookIndex, result.logBookIndex, infoDiv, bufferValue);
        this.CreateLine("Autorisierung (Start)", measurementValue.measurement.chargingSession.authorizationStart["@id"], result.authorizationStart, infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt", measurementValue.measurement.chargingSession.authorizationStart.timestamp, result.authorizationStartTimestamp, infoDiv, bufferValue);
        // Buffer
        bufferValue.parentElement.children[0].innerHTML = "Puffer (320 Bytes)";
        hashedBufferValue.innerHTML = "0x" + result.sha256value;
        // Public Key
        publicKeyValue.parentElement.children[0].innerHTML = "Public Key";
        if (result.publicKeyFormat)
            publicKeyValue.parentElement.children[0].innerHTML += " (" + result.publicKeyFormat + ")";
        publicKeyValue.innerHTML = "0x" + result.publicKey;
        // Signature
        signatureExpectedValue.parentElement.children[0].innerHTML = "Erwartete Signatur (" + result.signature.format + ")";
        if (result.signature.r && result.signature.s)
            signatureExpectedValue.innerHTML = "r: 0x" + result.signature.r.toLowerCase() + "<br />" + "s: 0x" + result.signature.s.toLowerCase();
        else if (result.signature.value)
            signatureExpectedValue.innerHTML = "0x" + result.signature.value.toLowerCase();
        // Result
        switch (result.status) {
            case "verified":
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;
            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + result.status + '</div>';
                break;
        }
    };
    return EMHCrypt01;
}(ACrypt));
