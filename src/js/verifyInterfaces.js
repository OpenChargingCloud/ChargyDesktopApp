var VerificationResult;
(function (VerificationResult) {
    VerificationResult[VerificationResult["VerificationFailed"] = 0] = "VerificationFailed";
    VerificationResult[VerificationResult["InvalidSignature"] = 1] = "InvalidSignature";
    VerificationResult[VerificationResult["ValidSignature"] = 2] = "ValidSignature";
})(VerificationResult || (VerificationResult = {}));
