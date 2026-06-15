import { createRequire }          from "node:module";
import { readFileSync }           from "node:fs";
import { describe, expect, test } from "vitest";
import { createChargy }           from './testHelper';
import { IsAChargeTransparencyRecord } from '../src/ts/interfaces/IChargeTransparencyRecord';
import { isISessionCryptoResult1 }     from '../src/ts/interfaces/chargyInterfaces';
import type { ISessionCryptoResult }   from '../src/ts/interfaces/chargyInterfaces';

const require = createRequire(import.meta.url);

type CliVerification = {
    output:   string;
    exitCode: number;
};

type VerificationServiceModule = {
    EXIT_ALL_VALID:       number;
    EXIT_INVALID_SESSION: number;
    EXIT_UNKNOWN_FORMAT:  number;
    renderCliVerification: (results: unknown, options?: {
        output?:   string | null;
        language?: string;
        i18n?:     Record<string, Record<string, string>>;
    }) => CliVerification;
};

const {
    EXIT_ALL_VALID,
    EXIT_INVALID_SESSION,
    renderCliVerification
} = require("../src/verificationService.cjs") as VerificationServiceModule;

const cliI18N = require("../src/i18n_CLI.json") as Record<string, Record<string, string>>;

// Mirrors src/ts/chargyApp.ts -> publishVerificationResult(...): the renderer hands
// the array of per-session verification results (or a "no records" fallback) to the
// main process, which then runs verificationService.renderCliVerification(...).
function toCliResults(result: unknown): ISessionCryptoResult[] | ISessionCryptoResult {

    if (IsAChargeTransparencyRecord(result))
    {
        const verificationResults = (result.chargingSessions ?? [])
                                        .map(session => session.verificationResult)
                                        .filter(isISessionCryptoResult1);

        if (verificationResults.length > 0)
            return verificationResults;
    }

    return {
        status:     "Unvalidated",
        message:    "No charge transparency records found!",
        certainty:  0
    } as unknown as ISessionCryptoResult;

}

async function verifyFixtureThroughCore(fileName: string, contentType: string): Promise<unknown> {
    return createChargy().DetectAndConvertContentFormat([
        {
            name: fileName,
            type: contentType,
            data: new Uint8Array(readFileSync(new URL("fixtures/" + fileName, import.meta.url)))
        }
    ]);
}

describe("CLI --nogui file verification flow (real Chargy core -> service)", () => {

    test("a valid QR-code PNG verifies, renders text and exits 0", async () => {

        const result = await verifyFixtureThroughCore(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png",
            "image/png"
        );

        const { output, exitCode } = renderCliVerification(toCliResults(result), {
            language: "en",
            i18n:     cliI18N
        });

        expect(output).toBe("Valid signature\n");
        expect(exitCode).toBe(EXIT_ALL_VALID);

    });

    test("the same record renders csv and json and still exits 0", async () => {

        const result = await verifyFixtureThroughCore(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png",
            "image/png"
        );

        const results = toCliResults(result);

        const csv = renderCliVerification(results, { output: "csv", language: "en", i18n: cliI18N });
        expect(csv.output).toBe("session,status\n1,Valid signature\n");
        expect(csv.exitCode).toBe(EXIT_ALL_VALID);

        const json = renderCliVerification(results, { output: "json", language: "en", i18n: cliI18N });
        const parsed = JSON.parse(json.output) as Array<{ status: string }>;
        expect(parsed[0]?.status).toBe("ValidSignature");
        expect(json.exitCode).toBe(EXIT_ALL_VALID);

    });

    test("a record with an invalid signature exits 2", async () => {

        const result = await verifyFixtureThroughCore(
            "PTB/ptb-simple-signature_invalid.json",
            "application/json"
        );

        const results = toCliResults(result);
        const { exitCode } = renderCliVerification(results, { language: "en", i18n: cliI18N });

        // At least one session is not a valid signature -> verified-but-invalid.
        expect(exitCode).toBe(EXIT_INVALID_SESSION);

    });

});
