import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CoseKey, CoseCurves } from '@vanaheimr/cose';
import { toBase64, toHex } from '@open-charging-cloud/wwcp-poi';
import { parseTrustedPublicKeysJSONL } from '../src/ts/trustedPublicKeys';
import { bundledTrustedPublicKeys } from '../src/ts/bundledTrustedPublicKeys';

// Public witness key from the WWCP-POI conformance vectors; never a production trust root.
const publicKey = {
    '@id': 'd4b12cbb4d99d31d4dc27faa2305608e39ae563dc22af5905eb4b5e04943675b',
    key: 'owEBIAYhWCASIqoApgZM7BHnn1eNnDvp9e0uVNSeFKo8x/VhEAnwLg=='
};
const line = JSON.stringify(publicKey);

describe('Bundled trusted public keys', () => {
    test('loads the repository JSONL through the bundler import', () => {
        const source = readFileSync(new URL('../src/trust/trusted-public-keys.jsonl', import.meta.url), 'utf8');
        const parsed = parseTrustedPublicKeysJSONL(source);
        expect(bundledTrustedPublicKeys.map(key => key.id)).toEqual(parsed.map(key => key.id));
        expect(Object.isFrozen(bundledTrustedPublicKeys)).toBe(true);
    });

    test('an empty configuration trusts no keys', () => {
        expect(parseTrustedPublicKeysJSONL('')).toEqual([]);
        expect(parseTrustedPublicKeysJSONL('\r\n  \r\n')).toEqual([]);
    });

    test('accepts public key material with its matching thumbprint and retains metadata', () => {
        const keys = parseTrustedPublicKeysJSONL(`\r\n${JSON.stringify({ ...publicKey, holder: 'Example issuer' })}\r\n`);
        expect(keys).toHaveLength(1);
        expect(keys[0]?.id).toBe(publicKey['@id']);
        expect(keys[0]?.key.isPrivate).toBe(false);
        expect(keys[0]?.holder).toBe('Example issuer');
    });

    test('rejects a key whose ID does not match the public material', () => {
        expect(() => parseTrustedPublicKeysJSONL(JSON.stringify({ ...publicKey, '@id': '00'.repeat(32) }))).toThrow();
    });

    test('rejects duplicates rather than counting one key twice', () => {
        expect(() => parseTrustedPublicKeysJSONL(`${line}\n${line}`, 'roots.jsonl')).toThrow(/roots\.jsonl:2:.*Duplicate/);
    });

    test.each([
        '{broken',
        '[]',
        `{"@id":"${publicKey['@id']}","key":"${publicKey.key}","key":"${publicKey.key}"}`,
        '{"type":"certificate","value":"not yet supported"}'
    ])('rejects malformed or unsupported data with the file and line: %s', invalid => {
        expect(() => parseTrustedPublicKeysJSONL(`${line}\n\n${invalid}`, 'roots.jsonl')).toThrow(/roots\.jsonl:3:/);
    });

    test('rejects a private COSE key even with its matching thumbprint', () => {
        const privateKey = CoseKey.fromOkpPrivateKey(CoseCurves.Ed25519, new Uint8Array(32).fill(1));
        const entry = JSON.stringify({ '@id': toHex(privateKey.thumbprint()), key: toBase64(privateKey.toBytes()) });
        expect(() => parseTrustedPublicKeysJSONL(entry)).toThrow();
    });

    test('rejects a UTF-8 BOM explicitly', () => {
        expect(() => parseTrustedPublicKeysJSONL(`\uFEFF${line}`)).toThrow(/:1:.*BOM/);
    });
});
