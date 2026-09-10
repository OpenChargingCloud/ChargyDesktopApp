import { describe, expect, test } from 'vitest';
import { secp224k1 } from '@open-charging-cloud/chargy-core';

describe("secp224k1", () => {

    const curve = new secp224k1();

    // The generator point of secp224k1, see https://www.secg.org/sec2-v2.pdf
    const Gx = BigInt("0xA1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C");
    const Gy = BigInt("0x7E089FED7FBA344282CAFBD6F7E319F7C0B0BD59E2CA4BDB556D61A5");

    // 2**224 - 2**32 - 2**12 - 2**11 - 2**9 - 2**7 - 2**4 - 2**1 - 1
    const P  = BigInt("26959946667150639794667015087019630673637144422540572481099315275117");

    // Number of points in the field
    const N  = BigInt("0x010000000000000000000000000001DCE8D2EC6184CAF0A971769FB1F7");

    const privateKey = BigInt("0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF01234567");
    const nonce      = BigInt("0x7F1E2D3C4B5A69788796A5B4C3D2E1F00F1E2D3C4B5A697887968574");
    const hash       = BigInt("0x0BADC0FFEE0DDF00DBAADF00DDEADBEEFCAFEBABE1234567890ABCDE");

    function mustExist<T>(value: T | null | undefined, what: string): T {

        if (value === null || value === undefined)
            throw new Error(`Expected ${what} to exist!`);

        return value;

    }

    // A deterministic key pair plus a signature over 'hash'.
    function signedFixture(): { publicKey: Array<bigint>, r: bigint, s: bigint } {

        const generated = mustExist(curve.PublicKeyGenerate(privateKey), "public key");
        const signature = mustExist(curve.Sign(hash, nonce, privateKey), "signature");

        return {
            publicKey: [ generated.x, generated.y ],
            r:         mustExist(signature[0], "signature r"),
            s:         mustExist(signature[1], "signature s")
        };

    }

    test("accepts the generator point as being on the curve", () => {

        expect(curve.isOnCurve([ Gx, Gy ])).toBe(true);

    });

    test("rejects points that are not on the curve", () => {

        // y^2 = x^3 + 5 does not hold for a tweaked ordinate.
        expect(curve.isOnCurve([ Gx, Gy + BigInt(1) ])).toBe(false);
        expect(curve.isOnCurve([ BigInt(0), BigInt(0) ])).toBe(false);

    });

    test("rejects points whose coordinates are not reduced", () => {

        expect(curve.isOnCurve([ Gx + P, Gy ])).toBe(false);
        expect(curve.isOnCurve([ Gx, Gy - P ])).toBe(false);
        expect(curve.isOnCurve([ Gx ])).toBe(false);

    });

    test("signs and verifies a round trip", () => {

        const { publicKey, r, s } = signedFixture();

        expect(curve.isOnCurve(publicKey)).toBe(true);
        expect(curve.validate(hash, r, s, publicKey)).toBe(true);

    });

    test("rejects a signature that was made over a different hash", () => {

        const { publicKey, r, s } = signedFixture();

        expect(curve.validate(hash + BigInt(1), r, s, publicKey)).toBe(false);

    });

    test("returns false instead of computing with an off-curve public key", () => {

        const { publicKey, r, s } = signedFixture();
        const offCurve            = [ mustExist(publicKey[0], "x"),
                                      mustExist(publicKey[1], "y") + BigInt(1) ];

        // Same signature, but a public key that is not a point on the curve:
        // this must fail closed rather than throw or return a bogus result.
        expect(curve.isOnCurve(offCurve)).toBe(false);
        expect(curve.validate(hash, r, s, offCurve)).toBe(false);

    });

    test("still rejects out-of-range signature components", () => {

        const one = BigInt(1);

        expect(() => curve.validate(one, BigInt(0), one,        [ Gx, Gy ])).toThrow();
        expect(() => curve.validate(one, one,       BigInt(0),  [ Gx, Gy ])).toThrow();
        expect(() => curve.validate(one, N,         one,        [ Gx, Gy ])).toThrow();
        expect(() => curve.validate(one, one,       N,          [ Gx, Gy ])).toThrow();

    });

    test("adds a point to itself using the doubling formula", () => {

        const doubled = curve.ECdouble([ Gx, Gy ]);
        const added   = curve.ECadd   ([ Gx, Gy ], [ Gx, Gy ]);

        expect(added).toStrictEqual(doubled);
        expect(curve.isOnCurve(added)).toBe(true);

    });

    test("reports the point at infinity instead of dividing by zero", () => {

        // G and -G share an x coordinate, so their sum is the point at infinity,
        // which has no [x, y] representation here.
        expect(() => curve.ECadd([ Gx, Gy ], [ Gx, P - Gy ])).toThrow(/infinity/i);

    });

    test("refuses to invert zero rather than returning a wrong inverse", () => {

        expect(() => curve.modInv(BigInt(0))).toThrow();
        expect(() => curve.modInv(P)).toThrow();

        // Sanity check that ordinary inverses still work.
        expect(curve.modulo(curve.modInv(BigInt(3)) * BigInt(3), P)).toBe(BigInt(1));

    });

});
