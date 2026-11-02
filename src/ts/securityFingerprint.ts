/**
 * Drunken Bishop, compatible with Styx SecurityVisualization.DrunkenBishop:
 * https://github.com/Vanaheimr/Styx/blob/master/Styx/Illias/SecurityVisualization/DrunkenBishop.cs
 * Styx implementation copyright (c) 2014-2026 GraphDefined GmbH, Apache-2.0.
 *
 * Presentation only: the visit matrix is not a unique cryptographic identifier.
 * v1 fixes a 17 x 9 board, center start, least-significant two-bit moves first,
 * clamped edges and counts after each move. Do not change it without versioning.
 */
export const fingerprintRasterVersion = "drunken-bishop-v1";
export const fingerprintRasterWidth = 17;
export const fingerprintRasterHeight = 9;

/** Plain hex fingerprints, up to SHA-512; never hash their textual spelling. */
export function fingerprintBytes(hex: string): Uint8Array {
    if (!/^(?:[0-9a-fA-F]{2}){1,64}$/.test(hex))
        throw new Error("A visual fingerprint requires 1 to 64 bytes in hexadecimal");
    return Uint8Array.from(hex.match(/../g) ?? [], byte => Number.parseInt(byte, 16));
}

export function drunkenBishop(bytes: Uint8Array): readonly number[] {
    if (bytes.length === 0 || bytes.length > 64)
        throw new Error("A visual fingerprint requires 1 to 64 bytes");
    const visits = new Array<number>(fingerprintRasterWidth * fingerprintRasterHeight).fill(0);
    let x = Math.floor(fingerprintRasterWidth / 2);
    let y = Math.floor(fingerprintRasterHeight / 2);
    for (const byte of bytes) {
        for (let shift = 0; shift < 8; shift += 2) {
            const move = (byte >> shift) & 3;
            x = Math.max(0, Math.min(fingerprintRasterWidth - 1, x + ((move & 1) === 0 ? -1 : 1)));
            y = Math.max(0, Math.min(fingerprintRasterHeight - 1, y + ((move & 2) === 0 ? -1 : 1)));
            const position = y * fingerprintRasterWidth + x;
            visits[position] = (visits[position] ?? 0) + 1;
        }
    }
    return Object.freeze(visits);
}
