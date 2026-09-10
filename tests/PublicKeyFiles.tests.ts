import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
    Chargy,
    IsAPublicKeyLookup
} from "@open-charging-cloud/chargy-core";
import type {
    IFileInfo,
    IPublicKeyLookup
} from "@open-charging-cloud/chargy-core";
import { createTestChargy } from "./chargyTestRuntime";


const chargePointFixtureRoot = new URL("fixtures/ChargePoint/", import.meta.url);
const modernKeyFixtureRoot   = new URL("fixtures/OCMF/BET_TariffTextExtension/001/", import.meta.url);

function publicKeyFile(name: string): IFileInfo {

    return {
        name: name.substring(name.lastIndexOf("/") + 1),
        type: name.endsWith(".pem") ? "application/x-pem-file" : "application/chargy",
        data: new Uint8Array(readFileSync(new URL(name, chargePointFixtureRoot)))
    };

}

async function loadPublicKeys(...names: string[]): Promise<IPublicKeyLookup> {

    const result = await createTestChargy(Chargy).DetectAndConvertContentFormat(
        names.map(publicKeyFile)
    );

    expect(IsAPublicKeyLookup(result)).toBe(true);

    if (!IsAPublicKeyLookup(result))
        throw new Error("Expected a public key lookup");

    return result;

}

describe("Public key file processing", () => {

    test.each([
        [ "001-01_Ed25519.publicKey.pem",   "1.3.101.112",              "Ed25519",   "EdDSA",  32   ],
        [ "001-01_Ed448.publicKey.pem",     "1.3.101.113",              "Ed448",     "EdDSA",  57   ],
        [ "001-01_ML-DSA-44.publicKey.pem", "2.16.840.1.101.3.4.3.17", "ML-DSA-44", "ML-DSA", 1312 ],
        [ "001-01_ML-DSA-65.publicKey.pem", "2.16.840.1.101.3.4.3.18", "ML-DSA-65", "ML-DSA", 1952 ],
        [ "001-01_ML-DSA-87.publicKey.pem", "2.16.840.1.101.3.4.3.19", "ML-DSA-87", "ML-DSA", 2592 ]
    ])("recognizes %s", async (fileName, oid, algorithm, type, keyLength) => {

        const result = await createTestChargy(Chargy).DetectAndConvertContentFormat([{
            name: fileName,
            type: "application/x-pem-file",
            data: new Uint8Array(readFileSync(new URL(fileName, modernKeyFixtureRoot)))
        }]);

        expect(IsAPublicKeyLookup(result)).toBe(true);
        if (!IsAPublicKeyLookup(result))
            throw new Error("Expected a public key lookup");

        expect(result.publicKeys).toHaveLength(1);
        expect(result.publicKeys[0]).toMatchObject({
            algorithm: { oid, name: algorithm },
            type
        });
        expect(result.publicKeys[0]?.value).toHaveLength(keyLength * 2);

    });

    test("returns a lookup for one PEM file", async () => {

        const lookup = await loadPublicKeys(
            "Testdata-2020-02/0024b1000002e300_2.pem"
        );

        expect(lookup.publicKeys).toHaveLength(1);

    });

    test("returns a lookup for one public-key .chargy file", async () => {

        const lookup = await loadPublicKeys(
            "Testdata-2020-02/0024b1000002e300_2-publicKey.chargy"
        );

        expect(lookup.publicKeys).toHaveLength(1);

    });

    test("combines multiple PEM files into one lookup", async () => {

        const lookup = await loadPublicKeys(
            "Testdata-2020-02/0024b1000002e300_2.pem",
            "Testdata-secp256r1/1/compressed/0024b10000027b29_1-publicKey.pem"
        );

        expect(lookup.publicKeys).toHaveLength(2);

    });

    test("combines multiple public-key .chargy files into one lookup", async () => {

        const lookup = await loadPublicKeys(
            "Testdata-2020-02/0024b1000002e300_2-publicKey.chargy",
            "Testdata-2020-02/0024b1000002e300_2-publicKey_minimal.chargy"
        );

        expect(lookup.publicKeys).toHaveLength(2);

    });

    test("combines PEM and public-key .chargy files into one lookup", async () => {

        const lookup = await loadPublicKeys(
            "Testdata-2020-02/0024b1000002e300_2.pem",
            "Testdata-2020-02/0024b1000002e300_2-publicKey.chargy"
        );

        expect(lookup.publicKeys).toHaveLength(2);

    });

});
