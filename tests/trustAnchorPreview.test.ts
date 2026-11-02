import { describe, expect, test } from 'vitest';
import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import { parseScannedTrustAnchor } from '../src/ts/trustAnchorPreview';

const holders = [ [ '11'.repeat(32), '22'.repeat(32) ], [ '33'.repeat(32) ] ];
const anchor = TrustAnchor.create('QA', [ 'https://example.org/RNs/QA', 'https://mirror.example/RNs/QA' ],
                                  holders, 2, { de: 'Testnetz', en: 'Test network' });

describe('Trust anchor QR routing', () => {
    test('reads compact QR data and retains holder grouping, quorum and names', () => {
        const result = parseScannedTrustAnchor(`  ${anchor.toQRCode()}\n`);
        expect(result.kind).toBe('anchor');
        if (result.kind !== 'anchor')
            throw new Error('Expected a trust anchor preview');
        expect(result.preview.anchor.holders).toEqual(holders);
        expect(result.preview.anchor.minConsensus).toBe(2);
        expect(result.preview.anchor.name['de']).toBe('Testnetz');
        expect(result.preview.text).toBe(anchor.toQRCode());
    });

    test('reads the URL form locally, including mirror URLs', () => {
        const result = parseScannedTrustAnchor(anchor.toURL());
        expect(result.kind).toBe('anchor');
        if (result.kind !== 'anchor')
            throw new Error('Expected a trust anchor preview');
        expect(result.preview.anchor.urls).toEqual(anchor.urls);
        expect(result.preview.anchor.holders).toEqual(holders);
    });

    test.each([
        'WWCP/TA-2:NOT A VALID ANCHOR',
        `https://example.org/RNs/QA?keys=${'11'.repeat(32)}&minConsensus=2`,
        'https://example.org/RNs/QA?keys=broken'
    ])('keeps malformed anchors out of the ordinary URL/import path: %s', text => {
        expect(parseScannedTrustAnchor(text).kind).toBe('invalid');
    });

    test.each([ 'OCMF|{}|{}', 'https://example.org/receipt', 'https://example.org/receipt?keys=123', 'some other QR content' ])(
        'leaves existing QR content to the normal reader: %s', text => {
            expect(parseScannedTrustAnchor(text)).toEqual({ kind: 'other' });
        }
    );
});
