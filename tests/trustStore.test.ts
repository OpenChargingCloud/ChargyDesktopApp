import { describe, expect, test } from 'vitest';
import { TrustAnchor, POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import { activeBundledPublicKeys, trustAnchorStorageId } from '../src/ts/trustStore';

const holders = [ ['11'.repeat(32), '22'.repeat(32)], ['33'.repeat(32)] ];
const urls = ['https://example.org/RNs/QA', 'https://mirror.example/RNs/QA'];
const anchor = TrustAnchor.create('QA', urls, holders, 2, { de: 'Testnetz' });

describe('Trust management identities and local key exclusions', () => {
    test('compact and URL representations identify the same saved anchor', () => {
        expect(trustAnchorStorageId(TrustAnchor.parse(anchor.toQRCode()))).toBe(trustAnchorStorageId(TrustAnchor.parse(anchor.toURL())));
    });

    test('presentation changes and mirror order do not duplicate a trust anchor', () => {
        const other = TrustAnchor.create('QA', [...urls].reverse(), holders, 2, { en: 'Different display text' });
        expect(trustAnchorStorageId(other)).toBe(trustAnchorStorageId(anchor));
    });

    test('normalizes equivalent endpoint spellings', () => {
        const other = TrustAnchor.create('QA', ['https://EXAMPLE.org:443/RNs/QA/', urls[1] ?? ''], holders, 2);
        expect(trustAnchorStorageId(other)).toBe(trustAnchorStorageId(anchor));
    });

    test('preserves changed quorum, holder grouping and sources as distinct anchors', () => {
        const changed = [
            TrustAnchor.create('QA', urls, holders, 1),
            TrustAnchor.create('QA', urls, holders.flat(), 2),
            TrustAnchor.create('QA', ['https://other.example/RNs/QA'], holders, 2)
        ];
        for (const other of changed)
            expect(trustAnchorStorageId(other)).not.toBe(trustAnchorStorageId(anchor));
    });

    test('removal applies by thumbprint without modifying the bundled source', () => {
        const key = POIPublicKey.parse({
            '@id': 'd4b12cbb4d99d31d4dc27faa2305608e39ae563dc22af5905eb4b5e04943675b',
            key: 'owEBIAYhWCASIqoApgZM7BHnn1eNnDvp9e0uVNSeFKo8x/VhEAnwLg=='
        });
        const bundled = Object.freeze([key]);
        expect(activeBundledPublicKeys(bundled, new Set([key.id]))).toEqual([]);
        expect(bundled).toEqual([key]);
        expect(activeBundledPublicKeys(bundled, new Set())).toEqual([key]);
    });
});
