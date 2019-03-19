///<reference path="ACrypt.ts" />
var SignatureFormats;
(function (SignatureFormats) {
    SignatureFormats[SignatureFormats["DER"] = 0] = "DER";
    SignatureFormats[SignatureFormats["rs"] = 1] = "rs";
})(SignatureFormats || (SignatureFormats = {}));
var SessionVerificationResult;
(function (SessionVerificationResult) {
    SessionVerificationResult[SessionVerificationResult["UnknownSessionFormat"] = 0] = "UnknownSessionFormat";
    SessionVerificationResult[SessionVerificationResult["PublicKeyNotFound"] = 1] = "PublicKeyNotFound";
    SessionVerificationResult[SessionVerificationResult["InvalidPublicKey"] = 2] = "InvalidPublicKey";
    SessionVerificationResult[SessionVerificationResult["InvalidSignature"] = 3] = "InvalidSignature";
    SessionVerificationResult[SessionVerificationResult["ValidSignature"] = 4] = "ValidSignature";
})(SessionVerificationResult || (SessionVerificationResult = {}));
var VerificationResult;
(function (VerificationResult) {
    VerificationResult[VerificationResult["UnknownCTRFormat"] = 0] = "UnknownCTRFormat";
    VerificationResult[VerificationResult["EnergyMeterNotFound"] = 1] = "EnergyMeterNotFound";
    VerificationResult[VerificationResult["PublicKeyNotFound"] = 2] = "PublicKeyNotFound";
    VerificationResult[VerificationResult["InvalidPublicKey"] = 3] = "InvalidPublicKey";
    VerificationResult[VerificationResult["InvalidSignature"] = 4] = "InvalidSignature";
    VerificationResult[VerificationResult["ValidSignature"] = 5] = "ValidSignature";
})(VerificationResult || (VerificationResult = {}));
