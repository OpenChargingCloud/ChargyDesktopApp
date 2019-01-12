///<reference path="ACrypt.ts" />
var SignatureFormats;
(function (SignatureFormats) {
    SignatureFormats[SignatureFormats["DER"] = 0] = "DER";
    SignatureFormats[SignatureFormats["rs"] = 1] = "rs";
})(SignatureFormats || (SignatureFormats = {}));
var VerificationResult;
(function (VerificationResult) {
    VerificationResult[VerificationResult["UnknownCTRFormat"] = 0] = "UnknownCTRFormat";
    VerificationResult[VerificationResult["PublicKeyNotFound"] = 1] = "PublicKeyNotFound";
    VerificationResult[VerificationResult["EnergyMeterNotFound"] = 2] = "EnergyMeterNotFound";
    VerificationResult[VerificationResult["InvalidPublicKey"] = 3] = "InvalidPublicKey";
    VerificationResult[VerificationResult["InvalidSignature"] = 4] = "InvalidSignature";
    VerificationResult[VerificationResult["ValidSignature"] = 5] = "ValidSignature";
})(VerificationResult || (VerificationResult = {}));
