import { describe, expect, test } from 'vitest';
import { drunkenBishop, fingerprintBytes, fingerprintRasterHeight, fingerprintRasterVersion, fingerprintRasterWidth } from '../src/ts/securityFingerprint';

describe('Stable Drunken Bishop fingerprints', () => {
    test('v1 keeps the agreed board and byte interpretation', () => {
        expect(fingerprintRasterVersion).toBe('drunken-bishop-v1');
        expect([fingerprintRasterWidth, fingerprintRasterHeight]).toEqual([17, 9]);
        expect(fingerprintBytes('00aBff')).toEqual(new Uint8Array([0, 171, 255]));
        expect(drunkenBishop(fingerprintBytes('e4'))).toEqual(drunkenBishop(fingerprintBytes('E4')));
    });

    // Hand-derived paths from the Styx move table. Index = y * 17 + x.
    test.each([
        { byte: 0x00, cells: [[58, 1], [40, 1], [22, 1], [4, 1]] },
        { byte: 0xff, cells: [[94, 1], [112, 1], [130, 1], [148, 1]] },
        { byte: 0xe4, cells: [[58, 2], [42, 1], [76, 1]] }
    ])('uses least-significant pairs first, with the Styx diagonal directions: $byte', ({ byte, cells }) => {
        const visits = drunkenBishop(new Uint8Array([byte]));
        const expected = new Array<number>(153).fill(0);
        for (const [index, count] of cells)
            if (index !== undefined && count !== undefined)
                expected[index] = count;
        expect(visits).toEqual(expected);
    });

    test('clamps edges and counts every move, including stationary moves', () => {
        const upperLeft = drunkenBishop(new Uint8Array(32));
        const lowerRight = drunkenBishop(new Uint8Array(32).fill(255));
        expect(upperLeft[0]).toBe(121);
        expect(lowerRight[152]).toBe(121);
        expect(upperLeft.reduce((sum, value) => sum + value, 0)).toBe(128);
        expect(lowerRight.reduce((sum, value) => sum + value, 0)).toBe(128);
        expect(Object.isFrozen(upperLeft)).toBe(true);
    });

    test('the same bytes have the same image regardless of hex case', () => {
        const hash = '01565176601c895cad856c02c18a1c14eb9f49b26e2fdcae7040c2530350982b';
        const first = drunkenBishop(fingerprintBytes(hash));
        expect(drunkenBishop(fingerprintBytes(hash.toUpperCase()))).toEqual(first);
        expect(drunkenBishop(fingerprintBytes(hash.replace(/^01/, '02')))).not.toEqual(first);
    });

    test.each(['', '0', 'xx', 'aa:bb', 'ab'.repeat(65)])('rejects malformed or unsupported input: %s', value => {
        expect(() => fingerprintBytes(value)).toThrow();
    });

    test('does not silently render missing or excessively long fingerprints', () => {
        expect(() => drunkenBishop(new Uint8Array())).toThrow();
        expect(() => drunkenBishop(new Uint8Array(65))).toThrow();
    });
});
