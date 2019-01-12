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
var GDFCrypt01 = /** @class */ (function (_super) {
    __extends(GDFCrypt01, _super);
    function GDFCrypt01(GetMeter) {
        var _this = _super.call(this, "ECC secp256r1", GetMeter) || this;
        _this.curve = new _this.elliptic.ec('p256');
        return _this;
    }
    GDFCrypt01.prototype.Sign = function (measurementValue, privateKey, publicKey) {
        // var keypair                      = this.curve.genKeyPair();
        //     privateKey                   = keypair.getPrivate();
        //     publicKey                    = keypair.getPublic();        
        // var privateKeyHEX                = privateKey.toString('hex').toLowerCase();
        // var publicKeyHEX                 = publicKey.encode('hex').toLowerCase();
        var buffer = new ArrayBuffer(320);
        var cryptoBuffer = new DataView(buffer);
        var cryptoResult = {
            status: VerificationResult.InvalidSignature,
            meterId: SetText(cryptoBuffer, measurementValue.measurement.energyMeterId, 0),
            timestamp: SetTimestamp(cryptoBuffer, measurementValue.timestamp, 10),
            obis: SetHex(cryptoBuffer, measurementValue.measurement.obis, 23, false),
            unitEncoded: SetInt8(cryptoBuffer, measurementValue.measurement.unitEncoded, 29),
            scale: SetInt8(cryptoBuffer, measurementValue.measurement.scale, 30),
            value: SetUInt64(cryptoBuffer, measurementValue.value, 31, true),
            authorizationStart: SetHex(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"], 41),
            authorizationStartTimestamp: SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };
        cryptoResult.sha256value = this.crypt.createHash('sha256').
            update(cryptoBuffer).
            digest('hex').
            toLowerCase();
        cryptoResult.publicKey = publicKey.encode('hex').
            toLowerCase();
        var signature = this.curve.keyFromPrivate(privateKey.toString('hex')).
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
    };
    GDFCrypt01.prototype.Verify = function (measurementValue) {
        function setResult(vr) {
            cryptoResult.status = vr;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }
        var buffer = new ArrayBuffer(320);
        var cryptoBuffer = new DataView(buffer);
        var cryptoResult = {
            status: VerificationResult.InvalidSignature,
            meterId: SetText(cryptoBuffer, measurementValue.measurement.energyMeterId, 0),
            timestamp: SetTimestamp(cryptoBuffer, measurementValue.timestamp, 10),
            obis: SetHex(cryptoBuffer, measurementValue.measurement.obis, 23, false),
            unitEncoded: SetInt8(cryptoBuffer, measurementValue.measurement.unitEncoded, 29),
            scale: SetInt8(cryptoBuffer, measurementValue.measurement.scale, 30),
            value: SetUInt64(cryptoBuffer, measurementValue.value, 31, true),
            authorizationStart: SetHex(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"], 41),
            authorizationStartTimestamp: SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
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
                cryptoResult.sha256value = this.crypt.createHash('sha256').
                    update(cryptoBuffer).
                    digest('hex');
                var meter = this.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null) {
                    cryptoResult.meter = meter;
                    var iPublicKey = meter.publicKeys[0];
                    if (iPublicKey != null) {
                        try {
                            cryptoResult.publicKey = iPublicKey.value.toLowerCase();
                            cryptoResult.publicKeyFormat = iPublicKey.format;
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
    };
    GDFCrypt01.prototype.View = function (measurementValue, infoDiv, bufferValue, hashedBufferValue, publicKeyValue, signatureExpectedValue, signatureCheckValue) {
        var result = measurementValue.result;
        var cryptoDiv = CreateDiv(infoDiv, "row");
        CreateDiv(cryptoDiv, "id", "Kryptoverfahren");
        CreateDiv(cryptoDiv, "value", "GDFCrypt01 (" + this.description + ")");
        hashedBufferValue.parentElement.children[0].innerHTML = "Hashed Puffer (SHA256)";
        this.CreateLine("Zählernummer", measurementValue.measurement.energyMeterId, result.meterId, infoDiv, bufferValue);
        this.CreateLine("Zeitstempel", measurementValue.timestamp, result.timestamp, infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl", measurementValue.measurement.obis, result.obis, infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)", measurementValue.measurement.unitEncoded, result.unitEncoded, infoDiv, bufferValue);
        this.CreateLine("Skalierung", measurementValue.measurement.scale, result.scale, infoDiv, bufferValue);
        this.CreateLine("Messwert", measurementValue.value + " Wh", result.value, infoDiv, bufferValue);
        this.CreateLine("Autorisierung (Start)", measurementValue.measurement.chargingSession.authorizationStart["@id"], result.authorizationStart, infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt", measurementValue.measurement.chargingSession.authorizationStart.timestamp, result.authorizationStartTimestamp, infoDiv, bufferValue);
        // Buffer
        bufferValue.parentElement.children[0].innerHTML = "Puffer";
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
            case VerificationResult.ValidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;
            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + result.status + '</div>';
                break;
        }
    };
    return GDFCrypt01;
}(ACrypt));
