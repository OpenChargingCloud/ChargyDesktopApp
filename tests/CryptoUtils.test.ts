import { describe, expect, test } from "vitest";

import {
    JSONSignatureVerificationStatus,
    SignMessage,
    type SignedJSONMessage,
    generateSignatureKeyPair,
    getSignatureSuite,
    parseAndVerifyJSONSignatures,
    signJSONMessage,
    signMessage,
    verifyJSONMessageSignatureResults,
    verifyJSONMessageSignatures,
    verifyJSONSignature
} from "@open-charging-cloud/chargy-core";
import { parseSignedJSONMessage } from "./chargyTestRuntime";

describe("CryptoUtils", () => {

    test.each([
        "ECDSA-secp256k1",
        "ECDSA-P256",
        "ECDSA-P384",
        "ECDSA-P521",
        "Ed25519",
        "Ed25519ctx",
        "Ed25519ph",
        "Ed448",
        "Ed448ph",
        "ML-DSA-44",
        "ML-DSA-65",
        "ML-DSA-87"
    ] as const)("signs and verifies with the %s provider", algorithm => {

        const suite     = getSignatureSuite(algorithm);
        const keyPair   = suite.generateKeyPair();
        const message   = new TextEncoder().encode("Chargy signature provider test");
        const signature = suite.sign(message, keyPair.privateKey);
        const publicKey = keyPair.publicKey ?? suite.getPublicKey(keyPair.privateKey);

        expect(suite.isValidPublicKey(publicKey)).toBe(true);
        expect(suite.verify(message, signature, publicKey)).toBe(true);
        expect(suite.verify(new TextEncoder().encode("tampered"), signature, publicKey)).toBe(false);

    });

    test.each([ "Ed25519", "ML-DSA-65" ] as const)("round-trips %s signatures through JSON", async algorithm => {

        const message: SignedJSONMessage = { chargingSession: "DE*TEST*E1", energy: 12.5 };
        const keyPair = generateSignatureKeyPair(algorithm);

        await expect(signMessage(message, keyPair)).resolves.toBe(true);
        expect(message.signatures?.[0]).toMatchObject({
            algorithm,
            publicKeyEncoding: "raw",
            signatureEncoding: "raw"
        });
        await expect(verifyJSONMessageSignatures(JSON.stringify(message))).resolves.toBe(true);

    });

    test("persists an Ed25519ctx domain-separation context", async () => {

        const message: SignedJSONMessage = { chargingSession: "context-bound" };
        const keyPair = generateSignatureKeyPair("Ed25519ctx");
        const context = new TextEncoder().encode("ChargyCore/session-signature/v1");

        await expect(signJSONMessage(message, [ keyPair ], { context })).resolves.toBe(true);
        expect(message.signatures?.[0]?.contextHEX).toBe(Buffer.from(context).toString("hex"));
        await expect(verifyJSONMessageSignatures(JSON.stringify(message))).resolves.toBe(true);

    });

    describe.each([
        { algorithm: "Ed25519" as const,   publicKeyLength: 32,   signatureLength: 64 },
        { algorithm: "ML-DSA-65" as const, publicKeyLength: 1952, signatureLength: 3309 }
    ])("ECDSA lifecycle copied to $algorithm", ({ algorithm, publicKeyLength, signatureLength }) => {

        test("re-signs the canonical ECDSA payload", async () => {

            const keyPair = generateSignatureKeyPair(algorithm);
            const message: SignedJSONMessage = {
                z: 1,
                a: {
                    b: true,
                    a: "text"
                }
            };

            await expect(signMessage(message, keyPair)).resolves.toBe(true);

            const signature = message.signatures?.[0];
            expect(signature).toMatchObject({
                algorithm,
                publicKeyEncoding: "raw",
                signatureEncoding: "raw"
            });
            expect(Buffer.from(signature?.publicKeyHEX ?? "", "hex")).toHaveLength(publicKeyLength);
            expect(Buffer.from(signature?.signatureHEX ?? "", "hex")).toHaveLength(signatureLength);

            if (signature === undefined)
                throw new Error("Missing re-signed signature");

            await expect(verifyJSONSignature(message, signature)).resolves.toBe(true);
            await expect(verifyJSONMessageSignatures(JSON.stringify(message))).resolves.toBe(true);

        });

        test("keeps two re-signatures independent of the signatures array", async () => {

            const keyPair1 = generateSignatureKeyPair(algorithm);
            const keyPair2 = generateSignatureKeyPair(algorithm);
            const message: SignedJSONMessage = { b: 2, a: 1 };

            await expect(signJSONMessage(message, [ keyPair1, keyPair2 ])).resolves.toBe(true);
            expect(message.signatures).toHaveLength(2);

            for (const signature of message.signatures ?? [])
                await expect(verifyJSONSignature(message, signature)).resolves.toBe(true);

            await expect(parseAndVerifyJSONSignatures(JSON.stringify(message))).resolves.toBe(true);

        });

        test("rejects the same payload manipulation as the ECDSA test", async () => {

            const keyPair = generateSignatureKeyPair(algorithm);
            const message: SignedJSONMessage = { a: 1, b: 2 };

            await expect(signMessage(message, keyPair)).resolves.toBe(true);

            const tamperedMessage = parseSignedJSONMessage(JSON.stringify(message));
            tamperedMessage["b"] = 3;

            await expect(verifyJSONMessageSignatures(tamperedMessage)).resolves.toBe(false);
            await expect(verifyJSONMessageSignatureResults(tamperedMessage)).resolves.toMatchObject({
                status: JSONSignatureVerificationStatus.False,
                signatures: {
                    "0": {
                        status: JSONSignatureVerificationStatus.False
                    }
                }
            });

        });

    });

    test("adds a P-256 ECDSA signature over canonical JSON without existing signatures", async () => {

        const keyPair = generateSignatureKeyPair("ECDSA-P256");
        const message: SignedJSONMessage = {
            z: 1,
            a: {
                b: true,
                a: "text"
            }
        };

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        expect(message.signatures).toHaveLength(1);
        expect(message.signatures?.[0]?.publicKeyHEX).toBe(Buffer.from(keyPair.publicKey ?? []).toString("hex"));
        expect(message.signatures?.[0]?.publicKey).toBe(Buffer.from(keyPair.publicKey ?? []).toString("base64"));
        expect(message.signatures?.[0]?.signatureHEX).toMatch(/^30[0-9a-f]+$/);

        if (message.signatures && message.signatures.length > 0)
        {

            const signature0 = message.signatures.at(0);

            if (signature0 === undefined)
                throw new Error("Missing signature");

            expect(signature0.signature).toBe(Buffer.from(signature0.signatureHEX, "hex").toString("base64"));

            await expect(verifyJSONSignature(message, signature0)).resolves.toBe(true);
            await expect(verifyJSONMessageSignatures(JSON.stringify(message))).resolves.toBe(true);

        }

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

        const keyPair1  = generateSignatureKeyPair("ECDSA-P256");
        const keyPair2  = generateSignatureKeyPair("ECDSA-P256");
        const message: SignedJSONMessage = { b: 2, a: 1 };

        await expect(signJSONMessage(message, [keyPair1, keyPair2])).resolves.toBe(true);

        expect(message.signatures).toHaveLength(2);
        if (message.signatures && message.signatures.length > 0)
        {
            const signature0 = message.signatures.at(0);
            const signature1 = message.signatures.at(1);

            if (signature0 === undefined || signature1 === undefined)
                throw new Error("Missing signatures");

            await expect(verifyJSONSignature(message, signature0)).resolves.toBe(true);
            await expect(verifyJSONSignature(message, signature1)).resolves.toBe(true);
        }
        await expect(parseAndVerifyJSONSignatures(JSON.stringify(message))).resolves.toBe(true);

    });

    test("returns false when signed JSON has been changed", async () => {

        const keyPair = generateSignatureKeyPair("ECDSA-P256");
        const message: SignedJSONMessage = {
            a: 1,
            b: 2
        };

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        const tamperedMessage = parseSignedJSONMessage(JSON.stringify(message));
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

        const keyPair = generateSignatureKeyPair("ECDSA-P256");
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

        const malformedSignatureMessage = parseSignedJSONMessage(JSON.stringify(message));
        if (malformedSignatureMessage.signatures && malformedSignatureMessage.signatures.length > 0)
        {
            const signature = malformedSignatureMessage.signatures.at(0);

            if (signature !== undefined)
                signature.signature = "this-is-not-the-same-base64";
        }

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

        const keyPair = generateSignatureKeyPair("ECDSA-P256");
        const message: SignedJSONMessage = { a: 1 };

        await expect(signMessage(message, keyPair)).resolves.toBe(true);

        const invalidPublicKeyMessage = parseSignedJSONMessage(JSON.stringify(message));
        if (invalidPublicKeyMessage.signatures && invalidPublicKeyMessage.signatures.length > 0)
        {
            const signature = invalidPublicKeyMessage.signatures.at(0);

            if (signature !== undefined)
            {
                signature.publicKeyHEX = "04";
                signature.publicKey    = Buffer.from("04", "hex").toString("base64");
            }
        }

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

        const keyPair = generateSignatureKeyPair("ECDSA-P256");

        await expect(signJSONMessage(null, [keyPair])).resolves.toBe(false);
        await expect(signJSONMessage({}, [])).resolves.toBe(false);
        await expect(signJSONMessage({ signatures: "invalid" } as never, [keyPair])).resolves.toBe(false);

    });

    test("reports failure when no key pair could be used, and keeps the alias matching the C# name", async () => {

        const invalidKey = {
            algorithm:  "ECDSA-P256" as const,
            privateKey: new Uint8Array()
        };
        const message: SignedJSONMessage = { a: 1 };

        // Signing must not report success when it produced no signature at all,
        // otherwise a caller could mistake an unsigned message for a signed one.
        await expect(SignMessage(message, invalidKey)).resolves.toBe(false);
        expect(message.signatures).toBeUndefined();

    });

    test("skips invalid key pairs but still signs with the usable ones", async () => {

        const invalidKey = {
            algorithm:  "ECDSA-P256" as const,
            privateKey: new Uint8Array()
        };
        const validKey = generateSignatureKeyPair("ECDSA-P256");
        const message: SignedJSONMessage = { a: 1 };

        await expect(signJSONMessage(message, [ invalidKey, validKey ])).resolves.toBe(true);
        expect(message.signatures).toHaveLength(1);
        await expect(verifyJSONMessageSignatures(JSON.stringify(message))).resolves.toBe(true);

    });

});
