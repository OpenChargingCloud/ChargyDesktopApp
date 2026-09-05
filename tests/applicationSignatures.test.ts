import { describe, expect, test } from "vitest";

import { createCompatibleCurve } from "@open-charging-cloud/chargy-core";
import elliptic from "elliptic";

// The about screen verifies the signatures over a published release of this
// application with secp256k1. That verification moved from elliptic to the
// @noble/curves path ChargyCore provides - the same curve behind the same
// CompatibleCurve interface, but a maintained implementation, and one fewer
// call into a package whose only remaining purpose here is secp192r1.
//
// The risk of such a swap is not that it accepts something it should not: it
// is that it REFUSES a signature the old code accepted, and every legitimately
// signed release would show as invalid. These tests pin the two against each
// other on exactly the shapes the about screen passes: a SHA-256 hash as a hex
// string, and a DER-encoded signature as hex, which is the format the versions
// document declares.
describe("Application signature verification", () => {

    const ec         = new elliptic.ec("secp256k1");
    const keyPair    = ec.genKeyPair();
    const publicKey  = keyPair.getPublic("hex");

    // A hash of something, in the shape chargyLib.sha256() returns.
    const hash       = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const otherHash  = "60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752";

    const derHex     = keyPair.sign(hash).toDER("hex");

    const noble      = createCompatibleCurve("secp256k1").keyFromPublic(publicKey, "hex");
    const legacy     = ec.keyFromPublic(publicKey, "hex");

    test("accepts what elliptic accepts", () => {

        expect(legacy.verify(hash, derHex)).toBe(true);
        expect(noble. verify(hash, derHex)).toBe(true);

    });

    test("refuses what elliptic refuses", () => {

        // The same signature over a different hash, and a signature from a
        // different key: both implementations have to say no to both.
        expect(legacy.verify(otherHash, derHex)).toBe(false);
        expect(noble. verify(otherHash, derHex)).toBe(false);

        const otherKey    = ec.genKeyPair();
        const otherDerHex = otherKey.sign(hash).toDER("hex");

        expect(legacy.verify(hash, otherDerHex)).toBe(false);
        expect(noble. verify(hash, otherDerHex)).toBe(false);

    });

    test("agrees over a series of independent signatures", () => {

        // One key pair could agree by accident; a run of them could not.
        for (let i = 0; i < 20; i++)
        {

            const pair    = ec.genKeyPair();
            const message = i.toString(16).padStart(64, "0");
            const der     = pair.sign(message).toDER("hex");

            const a       = ec.keyFromPublic(pair.getPublic("hex"), "hex").verify(message, der);
            const b       = createCompatibleCurve("secp256k1").
                                keyFromPublic(pair.getPublic("hex"), "hex").
                                verify(message, der);

            expect(b, "signature " + i.toString()).toBe(a);
            expect(b).toBe(true);

        }

    });

    test("rejects a public key that is not on the curve, rather than accepting it", () => {

        // elliptic throws here; the noble path throws too, with its own
        // message. What matters is that neither returns a silent "valid".
        expect(() => createCompatibleCurve("secp256k1").
                         keyFromPublic("04" + "11".repeat(64), "hex")).toThrow();

    });

});
