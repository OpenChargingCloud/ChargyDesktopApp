import { ec as EC } from "elliptic";
import { describe, expect, test } from "vitest";

import {
    JSONSignatureVerificationStatus,
    SignMessage,
    type SignedJSONMessage,
    parseAndVerifyJSONSignatures,
    signJSONMessage,
    signMessage,
    verifyJSONMessageSignatureResults,
    verifyJSONMessageSignatures,
    verifyJSONSignature
} from "@open-charging-cloud/chargy-core";

describe("CryptoUtils", () => {

    test("adds a P-256 ECDSA signature over canonical JSON without existing signatures", async () => {

        const curve   = new EC("p256");
        const keyPair = curve.keyFromPrivate("1".padStart(64, "0"), "hex");
        const message: SignedJSONMessage = {
            z: 1,
            a: {
                b: true,
                a: "text"
            }
        };

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        expect(message.signatures).toHaveLength(1);
        expect(message.signatures?.[0]?.publicKeyHEX).toBe(keyPair.getPublic(false, "hex"));
        expect(message.signatures?.[0]?.publicKey).toBe(Buffer.from(keyPair.getPublic(false, "array")).toString("base64"));
        expect(message.signatures?.[0]?.signatureHEX).toMatch(/^30[0-9a-f]+$/);
        expect(message.signatures?.[0]?.signature).toBe(Buffer.from(message.signatures![0]!.signatureHEX, "hex").toString("base64"));

        await expect(verifyJSONSignature(message, message.signatures![0]!)).resolves.toBe(true);
        await expect(verifyJSONMessageSignatures(JSON.stringify(message))).resolves.toBe(true);

        await expect(verifyJSONMessageSignatureResults(JSON.stringify(message))).resolves.toMatchObject({
            status:     JSONSignatureVerificationStatus.True,
            signatures: {
                "0": {
                    status: JSONSignatureVerificationStatus.True
                }
            }
        });

    });

    test("signatures do not sign previous signatures", async () => {

        const curve     = new EC("p256");
        const keyPair1  = curve.keyFromPrivate("1".padStart(64, "0"), "hex");
        const keyPair2  = curve.keyFromPrivate("2".padStart(64, "0"), "hex");
        const message: SignedJSONMessage = { b: 2, a: 1 };

        await expect(signJSONMessage(message, [keyPair1, keyPair2])).resolves.toBe(true);

        expect(message.signatures).toHaveLength(2);
        await expect(verifyJSONSignature(message, message.signatures![0]!)).resolves.toBe(true);
        await expect(verifyJSONSignature(message, message.signatures![1]!)).resolves.toBe(true);
        await expect(parseAndVerifyJSONSignatures(JSON.stringify(message))).resolves.toBe(true);

    });

    test("returns false when signed JSON has been changed", async () => {

        const curve   = new EC("p256");
        const keyPair = curve.keyFromPrivate("1".padStart(64, "0"), "hex");
        const message: SignedJSONMessage = {
            a: 1,
            b: 2
        };

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        const tamperedMessage: SignedJSONMessage = JSON.parse(JSON.stringify(message));
        tamperedMessage["b"] = 3;

        await expect(verifyJSONMessageSignatures(tamperedMessage)).resolves.toBe(false);
        await expect(verifyJSONMessageSignatures(JSON.stringify(tamperedMessage))).resolves.toBe(false);
        await expect(verifyJSONMessageSignatureResults(tamperedMessage)).resolves.toMatchObject({
            status:     JSONSignatureVerificationStatus.False,
            signatures: {
                "0": {
                    status: JSONSignatureVerificationStatus.False
                }
            }
        });

    });

    test("returns false for missing or malformed signatures", async () => {

        const curve   = new EC("p256");
        const keyPair = curve.keyFromPrivate("1".padStart(64, "0"), "hex");
        const message: SignedJSONMessage = { a: 1 };

        await expect(verifyJSONMessageSignatures("{ nope")).resolves.toBe(false);
        await expect(verifyJSONMessageSignatures({ a: 1 })).resolves.toBe(false);
        await expect(verifyJSONMessageSignatures({ a: 1, signatures: [] })).resolves.toBe(false);
        await expect(verifyJSONMessageSignatures({ a: 1, signatures: "invalid" })).resolves.toBe(false);
        await expect(verifyJSONMessageSignatureResults("{ nope")).resolves.toMatchObject({
            status: JSONSignatureVerificationStatus.InvalidJSON
        });
        await expect(verifyJSONMessageSignatureResults({ a: 1 })).resolves.toMatchObject({
            status: JSONSignatureVerificationStatus.MissingSignatures
        });
        await expect(verifyJSONMessageSignatureResults({ a: 1, signatures: "invalid" })).resolves.toMatchObject({
            status: JSONSignatureVerificationStatus.InvalidSignaturesArray
        });

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        const malformedSignatureMessage: SignedJSONMessage = JSON.parse(JSON.stringify(message));
        malformedSignatureMessage.signatures![0]!.signature = "this-is-not-the-same-base64";

        await expect(verifyJSONMessageSignatures(malformedSignatureMessage)).resolves.toBe(false);
        await expect(verifyJSONMessageSignatureResults(malformedSignatureMessage)).resolves.toMatchObject({
            status:     JSONSignatureVerificationStatus.False,
            signatures: {
                "0": {
                    status: JSONSignatureVerificationStatus.InvalidSignatureEncoding
                }
            }
        });

    });

    test("reports invalid public keys per signature", async () => {

        const curve   = new EC("p256");
        const keyPair = curve.keyFromPrivate("1".padStart(64, "0"), "hex");
        const message: SignedJSONMessage = { a: 1 };

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        const invalidPublicKeyMessage: SignedJSONMessage = JSON.parse(JSON.stringify(message));
        invalidPublicKeyMessage.signatures![0]!.publicKeyHEX = "04";
        invalidPublicKeyMessage.signatures![0]!.publicKey    = Buffer.from("04", "hex").toString("base64");

        await expect(verifyJSONMessageSignatureResults(invalidPublicKeyMessage)).resolves.toMatchObject({
            status:     JSONSignatureVerificationStatus.False,
            signatures: {
                "0": {
                    status: JSONSignatureVerificationStatus.InvalidPublicKey
                }
            }
        });

    });

    test("returns false for missing input or non-array signatures", async () => {

        const curve   = new EC("p256");
        const keyPair = curve.genKeyPair();

        await expect(signJSONMessage(null, [keyPair])).resolves.toBe(false);
        await expect(signJSONMessage({}, [])).resolves.toBe(false);
        await expect(signJSONMessage({ signatures: "invalid" } as never, [keyPair])).resolves.toBe(false);

    });

    test("skips invalid key pairs and keeps the alias matching the C# name", async () => {

        const curve         = new EC("p256");
        const publicOnlyKey = curve.keyFromPublic(curve.genKeyPair().getPublic(false, "hex"), "hex");
        const message: SignedJSONMessage = { a: 1 };

        await expect(SignMessage(message, publicOnlyKey)).resolves.toBe(true);
        expect(message.signatures).toBeUndefined();

    });

});
