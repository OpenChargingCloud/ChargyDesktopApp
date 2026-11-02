import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import { downloadTrustAnchorData, keyStatementURL, parseTrustAnchorData, validateTrustAnchorData } from '../src/ts/trustAnchorData';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import type { StoredTrustAnchor } from '../src/ts/trustStore';
import { parseTrustedPublicKeysJSONL } from '../src/ts/trustedPublicKeys';
import { findTrustAnchorImport } from '../src/ts/trustAnchorImport';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/TrustAnchors/${name}`, import.meta.url), 'utf8');
const anchor = TrustAnchor.parse(fixture('compact.txt'));
const text = fixture('key-statement.json');
const publicKeys = parseTrustedPublicKeysJSONL(fixture('public-keys.jsonl'));
const at = Date.parse('2026-10-31T00:00:00.000Z');
const data = parseTrustAnchorData(anchor, { text, sourceURL: keyStatementURL(anchor.urls[0] ?? ''), downloadedAt: new Date(at).toISOString() });

function record(ids: readonly string[]): StoredTrustAnchor {
    return { id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText: anchor.toURL(),
             importedAt: new Date(at).toISOString(), trustedKeys: ids.map(id => ({ id, acceptedAt: new Date(at).toISOString() })) };
}

describe('Trust anchor download and KeyStatement validation', () => {
    beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(at); });
    afterEach(() => { vi.restoreAllMocks(); });
    test('recognition of clipboard and file inputs never downloads anything', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        try {
            await findTrustAnchorImport(anchor.toQRCode());
            await findTrustAnchorImport(anchor.toURL());
            await findTrustAnchorImport({ name: 'anchor.json', data: new TextEncoder().encode(fixture('anchor.json')) });
            expect(fetchSpy).not.toHaveBeenCalled();
        }
        finally { fetchSpy.mockRestore(); }
    });

    test('downloads only the small KeyStatement, omitting cookies, redirects and URL pins', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(text));
        const loaded = await downloadTrustAnchorData(anchor, { signal: new AbortController().signal, fetch: fetcher });
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher.mock.calls[0]?.[0]).toBe('https://poi.example/RNs/CHARGY-TA-TEST/keyStatement');
        expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
        expect(loaded.statement.identityKeys).toHaveLength(3);
        expect(loaded.document.text).toBe(text);
    });

    test('unknown signers have valid signatures, but no trusted quorum', () => {
        expect(validateTrustAnchorData(anchor, data, undefined, [], new Set(), at)).toMatchObject({
            signatures: 'valid', signers: 'invalid', quorum: 'invalid', validity: 'valid',
            trustedHolderCount: 0, requiredConsensus: 2, canTrustKeys: true
        });
    });

    test('explicit trust recomputes validation without changing signatures or counting keys twice', () => {
        const first = anchor.holders[0] ?? [];
        expect(validateTrustAnchorData(anchor, data, record(first), [], new Set(), at)).toMatchObject({
            signatures: 'valid', signers: 'valid', quorum: 'invalid', trustedHolderCount: 1
        });
        const ids = [first[0] ?? '', anchor.holders[1]?.[0] ?? ''];
        expect(validateTrustAnchorData(anchor, data, record(ids), [], new Set(), at)).toMatchObject({
            signatures: 'valid', signers: 'valid', quorum: 'valid', validity: 'valid', trustedHolderCount: 2
        });
        expect(validateTrustAnchorData(anchor, data, record(ids.slice(0, 1)), [], new Set(), at).quorum).toBe('invalid');
    });

    test('active bundled roots count automatically and their local deletion is effective', () => {
        expect(validateTrustAnchorData(anchor, data, undefined, publicKeys, new Set(), at).quorum).toBe('valid');
        expect(validateTrustAnchorData(anchor, data, undefined, publicKeys, new Set(publicKeys.map(key => key.id)), at).quorum).toBe('invalid');
    });

    test('modified signatures and expired statements cannot be accepted through manual key trust', () => {
        const changed = parseTrustAnchorData(anchor, { ...data.document, text: text.replace('CHARGY-TEST-RNO', 'FORGED-RNO') });
        expect(validateTrustAnchorData(anchor, changed, record(anchor.keys), [], new Set(), at)).toMatchObject({
            signatures: 'invalid', quorum: 'invalid', canTrustKeys: false
        });
        expect(validateTrustAnchorData(anchor, data, record(anchor.keys), [], new Set(), Date.parse('2031-01-01T00:00:00.000Z'))).toMatchObject({
            signatures: 'valid', validity: 'invalid', quorum: 'invalid', canTrustKeys: false
        });
    });

    test('rejects another network and unlisted sources, even with syntactically valid signed data', () => {
        expect(() => parseTrustAnchorData(anchor, { ...data.document, text: text.replace('CHARGY-TA-TEST', 'OTHER') })).toThrow();
        expect(() => parseTrustAnchorData(anchor, { ...data.document, sourceURL: 'https://unlisted.example/keyStatement' })).toThrow();
    });

    test('supports an operator response without downloading its entire station tree', () => {
        const operator = { '@id': data.statement.roamingNetworkOperatorId, identityKeys: data.statement.identityKeys.map(key => key.json), keyStatement: data.statement.json };
        expect(parseTrustAnchorData(anchor, { ...data.document, text: JSON.stringify({ operator }) }).statement.roamingNetworkId).toBe(anchor.id);
        expect(() => parseTrustAnchorData(anchor, { ...data.document, text: JSON.stringify({ ...operator, '@id': 'OTHER' }) })).toThrow();
    });

    test('tries the next listed mirror on errors, wrong network or a bad signature', async () => {
        for (const first of [new Response('unavailable', { status: 503 }), new Response(text.replace('CHARGY-TA-TEST', 'OTHER')), new Response(text.replace('CHARGY-TEST-RNO', 'FORGED')), new Response(fixture('key-statement-expired.json'))]) {
            const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(first).mockResolvedValueOnce(new Response(text));
            const loaded = await downloadTrustAnchorData(anchor, { signal: new AbortController().signal, fetch: fetcher });
            expect(fetcher).toHaveBeenCalledTimes(2);
            expect(loaded.document.sourceURL).toBe(keyStatementURL(anchor.urls[1] ?? ''));
        }
    });

    test('returns an invalid signed response for visible failure results, never as valid', async () => {
        const forged = text.replace('CHARGY-TEST-RNO', 'FORGED');
        const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(forged)).mockResolvedValueOnce(new Response(forged));
        const loaded = await downloadTrustAnchorData(anchor, { signal: new AbortController().signal, fetch: fetcher });
        expect(validateTrustAnchorData(anchor, loaded, undefined, [], new Set(), at).canTrustKeys).toBe(false);
    });

    test('enforces response size, secure public sources and credentials restrictions', async () => {
        const oversized = vi.fn<typeof fetch>().mockResolvedValue(new Response(text, { headers: { 'Content-Length': '2000000' } }));
        await expect(downloadTrustAnchorData(anchor, { signal: new AbortController().signal, fetch: oversized })).rejects.toThrow();
        for (const base of ['http://poi.example/RNs/QA', 'https://127.0.0.1/RNs/QA', 'https://192.168.0.1/RNs/QA']) {
            const candidate = TrustAnchor.create('QA', [base], ['11'.repeat(32)]);
            const fetcher = vi.fn<typeof fetch>();
            await expect(downloadTrustAnchorData(candidate, { signal: new AbortController().signal, fetch: fetcher })).rejects.toThrow();
            expect(fetcher).not.toHaveBeenCalled();
        }
    });

    test('cancellation stops before any request or mirror fallback', async () => {
        const controller = new AbortController();
        controller.abort();
        const fetcher = vi.fn<typeof fetch>();
        await expect(downloadTrustAnchorData(anchor, { signal: controller.signal, fetch: fetcher })).rejects.toThrow();
        expect(fetcher).not.toHaveBeenCalled();
    });
});
