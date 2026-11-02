import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import { findTrustAnchorImport } from '../src/ts/trustAnchorImport';
import { parseTrustAnchorInput } from '../src/ts/trustAnchorPreview';
import { trustAnchorStorageId } from '../src/ts/trustStore';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/TrustAnchors/${name}`, import.meta.url), 'utf8');
const canonical = TrustAnchor.parse(fixture('compact.txt'));

describe('Trust anchor import across camera, clipboard and file inputs', () => {
    test.each(['compact.txt', 'url.txt', 'anchor.json', 'anchor-response.json', 'untrusted-claims.json'])(
        'routes %s to the same preview without creating trust', async name => {
            const text = fixture(name);
            const inputs = [text, { name, data: new TextEncoder().encode(text) }, [{ name, data: new TextEncoder().encode(text) }]];
            for (const input of inputs) {
                const result = await findTrustAnchorImport(input);
                expect(result.kind).toBe('anchor');
                if (result.kind !== 'anchor')
                    throw new Error('Expected a trust anchor');
                expect(trustAnchorStorageId(result.preview.anchor)).toBe(trustAnchorStorageId(canonical));
                expect(result.preview.text).toBe(text.trim());
                expect(Object.keys(result.preview).sort()).toEqual(['anchor', 'text']);
            }
        }
    );

    test.each(['invalid-compact.txt', 'invalid-quorum.json', 'duplicate-field.json'])(
        'rejects %s without falling through to URL or transparency imports', async name => {
            expect(parseTrustAnchorInput(fixture(name)).kind).toBe('invalid');
            expect((await findTrustAnchorImport({ name, data: new TextEncoder().encode(fixture(name)) })).kind).toBe('invalid');
        }
    );

    test.each(['OCMF|{}|{}', '{"@context":"other","value":1}', '{broken', 'https://example.org/receipt']) (
        'preserves the ordinary reader for %s', async text => {
            expect(await findTrustAnchorImport(text)).toEqual({ kind: 'other' });
        }
    );

    test('does not consume binary input or file read errors', async () => {
        expect(await findTrustAnchorImport({ name: 'binary.chargy', data: new Uint8Array([255, 254, 0]) })).toEqual({ kind: 'other' });
        expect(await findTrustAnchorImport({ name: 'broken.txt', error: 'read failed' })).toEqual({ kind: 'other' });
    });

    test('rejects an entire multi-file selection containing an anchor, regardless of order', async () => {
        const anchor = { name: 'compact.txt', data: new TextEncoder().encode(fixture('compact.txt')) };
        const other = { name: 'receipt.txt', data: new TextEncoder().encode('OCMF|{}|{}') };
        for (const files of [[anchor, other], [other, anchor], [anchor, anchor]]) {
            expect(await findTrustAnchorImport(files)).toMatchObject({ kind: 'invalid', messageKey: 'trustAnchorSingleFile' });
        }
    });

    test('an ordinary document mentioning trust anchors is not misclassified', () => {
        expect(parseTrustAnchorInput('{"description":"TrustAnchor import","keys":[]}')).toEqual({ kind: 'other' });
    });

    test('does not discard charging records or evidence surrounding an embedded anchor', () => {
        for (const surrounding of [{ chargingSessions: [] }, { priceStatements: [], chargingStarted: '2026-10-31T00:00:00.000Z' }, { '@context': 'some-other-document' }])
            expect(parseTrustAnchorInput(JSON.stringify({ ...surrounding, trustAnchor: canonical.toJSON() }))).toEqual({ kind: 'other' });
    });
});
