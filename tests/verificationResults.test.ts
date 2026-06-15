import { createRequire }          from "node:module";
import { describe, expect, test } from "vitest";
import { toSessionVerificationResults } from '../src/ts/verificationResults';
import type { ISessionCryptoResult }    from '../src/ts/interfaces/chargyInterfaces';
import type { IChargeTransparencyRecord } from '../src/ts/interfaces/IChargeTransparencyRecord';

const require = createRequire(import.meta.url);

type CliVerification = {
    output:   string;
    exitCode: number;
};

type VerificationServiceModule = {
    EXIT_INVALID_SESSION: number;
    renderCliVerification: (results: unknown, options?: { output?: string | null }) => CliVerification;
};

const {
    EXIT_INVALID_SESSION,
    renderCliVerification
} = require("../src/verificationService.cjs") as VerificationServiceModule;

function ctrWithSessions(
    sessions: Array<{ verificationResult?: { status?: string; message?: string; certainty?: number } }>
): IChargeTransparencyRecord {
    return { chargingSessions: sessions } as unknown as IChargeTransparencyRecord;
}

describe("toSessionVerificationResults", () => {

    test("returns the per-session verification results", () => {

        const results = toSessionVerificationResults(ctrWithSessions([
            { verificationResult: { status: "ValidSignature",   certainty: 1 } },
            { verificationResult: { status: "InvalidSignature", certainty: 1 } }
        ]));

        expect(Array.isArray(results)).toBe(true);
        expect((results as ISessionCryptoResult[]).map(result => result.status))
            .toEqual([ "ValidSignature", "InvalidSignature" ]);

    });

    test("drops sessions without a verification result", () => {

        const results = toSessionVerificationResults(ctrWithSessions([
            { verificationResult: { status: "ValidSignature", certainty: 1 } },
            { /* no verificationResult */ }
        ]));

        expect((results as ISessionCryptoResult[])).toHaveLength(1);
        expect((results as ISessionCryptoResult[])[0]?.status).toBe("ValidSignature");

    });

    test("falls back to a single 'no records' result, honoring the given message", () => {

        const fallback = toSessionVerificationResults(ctrWithSessions([]), "Keine Datensätze gefunden!") as ISessionCryptoResult;

        expect(Array.isArray(fallback)).toBe(false);
        expect(fallback.status).toBe("Unvalidated");
        expect(fallback.message).toBe("Keine Datensätze gefunden!");

    });

    test("uses an English default message when none is given", () => {

        const fallback = toSessionVerificationResults({ } as unknown as IChargeTransparencyRecord) as ISessionCryptoResult;

        expect(fallback.status).toBe("Unvalidated");
        expect(fallback.message).toBe("No charge transparency records found!");

    });

    test("an extracted invalid-signature session maps to exit code 2 through the service", () => {

        const results = toSessionVerificationResults(ctrWithSessions([
            { verificationResult: { status: "ValidSignature",   certainty: 1 } },
            { verificationResult: { status: "InvalidSignature", certainty: 1 } }
        ]));

        expect(renderCliVerification(results).exitCode).toBe(EXIT_INVALID_SESSION);

    });

});
