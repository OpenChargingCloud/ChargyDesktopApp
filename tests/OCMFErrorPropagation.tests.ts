import { describe, expect, test } from "vitest";
import { readFileSync }            from "node:fs";
import { ec as EC }                from "elliptic";

import { verifyChargeDataFiles }   from "./testHelper";

import { IsAChargeTransparencyRecord, VerificationResult } from "@open-charging-cloud/chargy-core";
import type { IFileInfo, IChargeTransparencyRecord }       from "@open-charging-cloud/chargy-core";

function readFixtureText(name: string): string {
    return readFileSync(new URL("fixtures/" + name, import.meta.url), "utf8").trim();
}

describe("OCMF verification error propagation", () => {

    test("surfaces a wrong public key as a structured error on the measurement value result", async () => {

        const ocmf = readFixtureText("OCMF/OCMF-Testdata-01.ocmf");

        // A valid but unrelated secp256r1 key (same SubjectPublicKeyInfo DER prefix,
        // different point) — decodes fine, but the signature will not match.
        const wrongPublicKey = "3059301306072A8648CE3D020106082A8648CE3D030107034200" +
                               new EC("p256").genKeyPair().getPublic(false, "hex");

        const files: IFileInfo[] = [
            { name: "OCMF-Testdata-01.ocmf", type: "application/ocmf", data: new TextEncoder().encode(ocmf) },
            { name: "publicKey.txt",        type: "binary/octet-stream", data: new TextEncoder().encode(wrongPublicKey) }
        ];

        const report = await verifyChargeDataFiles(files);

        expect(IsAChargeTransparencyRecord(report)).toBe(true);

        const result = (report as IChargeTransparencyRecord)
                           .chargingSessions?.[0]?.measurements?.[0]?.values[0]?.result;

        expect(result?.status).toBe(VerificationResult.InvalidSignature);
        expect((result?.errors ?? []).map(error => error.code)).toContain("Verification_SignatureMismatch");

    });

});
