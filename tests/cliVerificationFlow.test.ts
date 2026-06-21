import { readFileSync }           from "node:fs";
import { describe, expect, test } from "vitest";
import {
    createTestChargy,
    mergeI18NDictionaries
} from "./chargyTestRuntime";
import { Chargy, IsAChargeTransparencyRecord } from '@open-charging-cloud/chargy-core';
import type { IChargeTransparencyRecord } from '@open-charging-cloud/chargy-core';
import { toSessionVerificationResults }   from '@open-charging-cloud/chargy-core';
import coreI18n  from "@open-charging-cloud/chargy-core/i18n.json";
import localI18n from "../src/i18n.json";
import { createRequire }          from "node:module";

const require = createRequire(import.meta.url);

type CliVerification = {
    output:   string;
    exitCode: number;
};

type VerificationServiceModule = {
    EXIT_ALL_VALID:       number;
    renderCliVerification: (results: unknown, options?: {
        output?:   string | null;
        language?: string;
        i18n?:     Record<string, Record<string, string>>;  
    }) => CliVerification;
};

const {
    EXIT_ALL_VALID,
    renderCliVerification
} = require("../src/verificationService.cjs") as VerificationServiceModule;

const cliI18N = require("../src/i18n_CLI.json") as Record<string, Record<string, string>>;

// Runs a fixture through the real Chargy core and asserts it verifies to a Charge
// Transparency Record (both fixtures used here do). The renderer-side extraction
// CTR -> session results is then done by the shared toSessionVerificationResults(...),
// the exact same function src/ts/chargyApp.ts uses in publishVerificationResult(...).
async function verifyFixtureToCTR(fileName: string, contentType: string): Promise<IChargeTransparencyRecord> {

    const i18n = mergeI18NDictionaries(coreI18n, localI18n);

    const result = await createTestChargy(Chargy, { i18n }).DetectAndConvertContentFormat([
        {
            name: fileName,
            type: contentType,
            data: new Uint8Array(readFileSync(new URL("fixtures/" + fileName, import.meta.url)))
        }
    ]);

    if (!IsAChargeTransparencyRecord(result))
        throw new Error("Fixture did not verify to a Charge Transparency Record: " + fileName);

    return result;

}

describe("CLI --nogui file verification flow (real Chargy core -> service)", () => {

    test("a valid QR-code PNG verifies, renders text and exits 0", async () => {

        const ctr = await verifyFixtureToCTR(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png",
            "image/png"
        );

        const { output, exitCode } = renderCliVerification(toSessionVerificationResults(ctr), {
            language: "en",
            i18n:     cliI18N
        });

        expect(output).toBe("Valid signature\n");
        expect(exitCode).toBe(EXIT_ALL_VALID);

    });

    test("the same record renders csv and json and still exits 0", async () => {

        const ctr = await verifyFixtureToCTR(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png",
            "image/png"
        );

        const results = toSessionVerificationResults(ctr);

        const csv = renderCliVerification(results, { output: "csv", language: "en", i18n: cliI18N });
        expect(csv.output).toBe("session,status\n1,Valid signature\n");
        expect(csv.exitCode).toBe(EXIT_ALL_VALID);

        const json = renderCliVerification(results, { output: "json", language: "en", i18n: cliI18N });
        const parsed = JSON.parse(json.output) as Array<{ status: string }>;
        expect(parsed[0]?.status).toBe("ValidSignature");
        expect(json.exitCode).toBe(EXIT_ALL_VALID);

    });

    // The renderer only forwards verification results for actual Charge Transparency
    // Records; non-CTR / unparseable inputs take the doGlobalError(...) path instead.
    // The extraction's invalid-signature and "no records" branches are therefore
    // covered directly in tests/verificationResults.test.ts.

});
