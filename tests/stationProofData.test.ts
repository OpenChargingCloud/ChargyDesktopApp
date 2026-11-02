import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TrustAnchor, TrustContext, KeyStatement, parseJSON, isObject } from '@open-charging-cloud/wwcp-poi';
import {TestPOITrustService as POITrustService} from './poiTestService';
import { loadStationProof, stationProofMaxBytes, StationProofLoadError } from '../src/ts/stationProofData';
import { keyStatementURL } from '../src/ts/trustAnchorData';
import { stationEVSEId, stationProofURL } from '../src/ts/poiURLs';
import { stationProofStorageId, trustAnchorStorageId } from '../src/ts/trustStore';
import type { StoredTrustAnchor } from '../src/ts/trustStore';

const example = JSON.parse(readFileSync(new URL('./fixtures/TrustAnchors/station-trust-gateway.json', import.meta.url), 'utf8')) as {
    trustAnchor: { '@id': string; urls: string[]; keys: string[]; minConsensus: number };
    proof: { roamingNetwork: { operator: object }; revision: number };
    at: string; evseId: string;
};
const anchor = TrustAnchor.fromJSON(example.trustAnchor);
const text = JSON.stringify(example.proof);
const at = Date.parse(example.at);
const policyId = trustAnchorStorageId(anchor);
const record = (ids: readonly string[] = anchor.keys): StoredTrustAnchor => ({
    id: policyId, qrCode: anchor.toQRCode(), sourceText: anchor.toURL(), importedAt: new Date(at).toISOString(),
    trustedKeys: ids.map(id => ({ id, acceptedAt: new Date(at).toISOString() })),
    downloadedData: { text: JSON.stringify({ operator: example.proof.roamingNetwork.operator }),
        sourceURL: keyStatementURL(anchor.urls[0] ?? ''), downloadedAt: new Date(at).toISOString() }
});
const service = (saved: StoredTrustAnchor = record(), time: number = at): POITrustService => new POITrustService({
    trustSnapshot: vi.fn().mockResolvedValue({ record: saved, deleted: new Set<string>() })
}, [], () => time);
const signal = (): AbortSignal => new AbortController().signal;

describe('EVSE proof addressing', () => {
    test('uses the selected network and one exact ID, without query pins or fragments', () => {
        expect(stationProofURL('https://hub.example/poi/RNs/rn1/?keys=secret#fragment', ' DE*GEF*E1*1 '))
            .toBe('https://hub.example/poi/RNs/rn1/EVSEs/DE*GEF*E1*1/proof');
        expect(stationProofURL(anchor.urls[0] ?? '', 'urn:evse:123')).toContain('/EVSEs/urn%3Aevse%3A123/proof');
    });
    test.each(['', '   ', '.', '..', '../escape', 'A\\B', 'A?x=1', 'A#part', 'A B', 'A\nB', 'x'.repeat(257)])('rejects invalid or ambiguous IDs: %j', value => {
        expect(() => stationEVSEId(value)).toThrow();
    });
});

describe('Bounded station proof retrieval through current local trust', () => {
    afterEach(() => { vi.useRealTimers(); });
    test('verifies a genuine proof; only sends an anonymous, uncached proof request', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(text));
        const result = await loadStationProof(service(), policyId, example.evseId, { signal: signal(), fetch: fetcher });
        expect(result.station.chargingStation['@id']).toBe('DE*GEF*S1');
        expect(result.document.text).toBe(text);
        expect(result.document.sourceURL).toBe(stationProofURL(anchor.urls[0] ?? '', example.evseId));
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
    });
    test('unknown or withdrawn trust fails before contacting a server', async () => {
        const fetcher = vi.fn<typeof fetch>();
        await expect(loadStationProof(service(record([])), policyId, example.evseId, { signal: signal(), fetch: fetcher })).rejects.toThrow();
        expect(fetcher).not.toHaveBeenCalled();
    });
    test('rereads local decisions after download; an earlier context cannot bypass withdrawal', async () => {
        const snapshot = vi.fn().mockResolvedValueOnce({ record: record(), deleted: new Set<string>() })
            .mockResolvedValue({ record: record([]), deleted: new Set<string>() });
        const trust = new POITrustService({ trustSnapshot: snapshot }, [], () => at);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(text));
        await expect(loadStationProof(trust, policyId, example.evseId, { signal: signal(), fetch: fetcher })).rejects.toThrow(StationProofLoadError);
        expect(snapshot.mock.calls.length).toBeGreaterThan(1);
    });
    test.each([
        (): Response => new Response('', { status: 503 }),
        (): Response => new Response(text.replace('22000', '22001')),
        (): Response => new Response(text.replace('"revision":0', '"revision":0,"revision":1')),
        (): Response => new Response(new Uint8Array([255])),
        (): Response => new Response(text, { headers: { 'Content-Length': String(stationProofMaxBytes + 1) } }),
        (): Response => new Response(new Uint8Array(stationProofMaxBytes + 1))
    ])('tries the next approved mirror on transport, parser, size or proof failure', async invalid => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(invalid()).mockResolvedValueOnce(new Response(text));
        const result = await loadStationProof(service(), policyId, example.evseId, { signal: signal(), fetch: fetcher });
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(result.document.sourceURL).toBe(stationProofURL(anchor.urls[1] ?? '', example.evseId));
    });
    test('rejects another EVSE and expired attestations, with no successful result to persist', async () => {
        for (const [trust, evseId] of [[service(), 'FOREIGN'], [service(record(), Date.parse('2026-10-17T18:16:00.000Z')), example.evseId]] as const) {
            const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { await Promise.resolve(); return new Response(text); });
            await expect(loadStationProof(trust, policyId, evseId, { signal: signal(), fetch: fetcher })).rejects.toThrow(StationProofLoadError);
        }
    });
    test('blocks insecure/private/credential-bearing sources', async () => {
        const trust = service();
        const original = await trust.resolve(policyId);
        const operator = parseJSON(JSON.stringify(example.proof.roamingNetwork.operator));
        if (!isObject(operator)) throw new Error('Invalid fixture');
        const statement = KeyStatement.parse(operator['keyStatement']);
        for (const url of ['http://hub.example/RNs/rn1', 'https://127.0.0.1/RNs/rn1', 'https://user:secret@hub.example/RNs/rn1']) {
            const changed = TrustAnchor.create(anchor.id, [url], anchor.holders, anchor.minConsensus);
            const verification = TrustContext.create(changed, statement, { trustedIdentityKeyIds: changed.keys, at });
            vi.spyOn(trust, 'resolve').mockResolvedValue({ ...original, verification });
            const fetcher = vi.fn<typeof fetch>();
            await expect(loadStationProof(trust, policyId, example.evseId, { signal: signal(), fetch: fetcher })).rejects.toThrow(StationProofLoadError);
            expect(fetcher).not.toHaveBeenCalled();
        }
    });
    test('cancels before a request and stops mirror fallback when cancelled during fetch', async () => {
        const controller = new AbortController();
        controller.abort();
        const fetcher = vi.fn<typeof fetch>();
        await expect(loadStationProof(service(), policyId, example.evseId, { signal: controller.signal, fetch: fetcher })).rejects.toThrow();
        expect(fetcher).not.toHaveBeenCalled();
        const running = new AbortController();
        const aborted = vi.fn<typeof fetch>().mockImplementation(async () => {
            await Promise.resolve(); running.abort(); throw new Error('aborted');
        });
        await expect(loadStationProof(service(), policyId, example.evseId, { signal: running.signal, fetch: aborted })).rejects.toThrow();
        expect(aborted).toHaveBeenCalledTimes(1);
    });
    test('enforces the total deadline even while waiting for a source', async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
            const response = await new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    const reason: unknown = init.signal?.reason;
                    reject(reason instanceof Error ? reason : new Error('aborted'));
                }, { once: true });
            });
            return response;
        });
        const result = loadStationProof(service(), policyId, example.evseId, { signal: signal(), fetch: fetcher, timeoutMs: 1000, totalTimeoutMs: 10 });
        const failure = expect(result).rejects.toThrow(StationProofLoadError);
        await vi.advanceTimersByTimeAsync(11);
        await failure;
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
    test('cache identities retain raw versions and keep policies/EVSEs separate', () => {
        const id = stationProofStorageId(policyId, example.evseId, text);
        expect(stationProofStorageId(policyId, example.evseId, text)).toBe(id);
        expect(stationProofStorageId(policyId, example.evseId, text + '\n')).not.toBe(id);
        expect(stationProofStorageId('other', example.evseId, text)).not.toBe(id);
        expect(stationProofStorageId(policyId, 'other', text)).not.toBe(id);
    });
});
