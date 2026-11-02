import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { TrustAnchor, KeyStatement, canonicalJSONBytes, hash, toHex, parseJSON } from '@open-charging-cloud/wwcp-poi';
import type { JSONObject } from '@open-charging-cloud/wwcp-poi';
import { createPOITrustContext } from '../src/ts/poiTrustContext';
import {TestPOITrustService as POITrustService} from './poiTestService';
import { keyStatementURL } from '../src/ts/trustAnchorData';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import type { StoredTrustAnchor } from '../src/ts/trustStore';
import { parseTrustedPublicKeysJSONL } from '../src/ts/trustedPublicKeys';
import { groupRoamingNetworks } from '../src/ts/roamingNetworks';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/TrustAnchors/${name}`, import.meta.url), 'utf8');
const at = Date.parse('2026-10-31T00:00:00.000Z');
const anchor = TrustAnchor.parse(fixture('compact.txt'));
const bundled = parseTrustedPublicKeysJSONL(fixture('public-keys.jsonl'));
const document = { text: fixture('key-statement.json'), sourceURL: keyStatementURL(anchor.urls[0] ?? ''), downloadedAt: new Date(at).toISOString() };
function record(ids: readonly string[] = []): StoredTrustAnchor {
    return { id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText: anchor.toURL(),
        importedAt: new Date(at).toISOString(), downloadedData: document,
        trustedKeys: ids.map(id => ({ id, acceptedAt: new Date(at).toISOString() })) };
}

describe('App storage and shared POI authorization', () => {
    test('unknown imports remain importable but cannot create a context', () => {
        expect(() => createPOITrustContext(anchor, document, record(), [], new Set(), at)).toThrow();
        expect(() => createPOITrustContext(anchor, document, record(anchor.holders[0]), [], new Set(), at)).toThrow();
        const context = createPOITrustContext(anchor, document, record(anchor.keys), [], new Set(), at);
        expect(context.requiredConsensus).toBe(2);
        expect(context.verification.roamingNetworkOperatorId).toBe('CHARGY-TEST-RNO');
        expect(context.keyStatementDigest).toBe(toHex(hash('sha256', canonicalJSONBytes(KeyStatement.parse(parseJSON(document.text)).content()))));
        expect(context.evidence.keyStatement.text).toBe(document.text);
        expect(Object.isFrozen(context.evidence.keyStatement)).toBe(true);
    });

    test('reads fresh local decisions, deletions and time on every operation', async () => {
        let current: StoredTrustAnchor | undefined = record(anchor.keys);
        const deleted = new Set<string>();
        let now = at;
        const trustSnapshot = vi.fn(async () => { await Promise.resolve(); return { record: current, deleted }; });
        const service = new POITrustService({ trustSnapshot }, bundled, () => now);
        expect((await service.resolve(record().id)).requiredConsensus).toBe(2);
        current = record();
        for (const key of anchor.keys) deleted.add(key);
        await expect(service.resolve(record().id)).rejects.toThrow();
        current = record(anchor.keys); // Deliberate, scoped reauthorization of excluded roots is still allowed.
        expect((await service.resolve(record().id)).requiredConsensus).toBe(2);
        now = Date.parse('2031-01-01T00:00:00.000Z');
        await expect(service.resolve(record().id)).rejects.toThrow();
        current = undefined;
        await expect(service.resolve(record().id)).rejects.toThrow();
        expect(trustSnapshot).toHaveBeenCalledTimes(5);
    });

    test('storage failures and mismatched policies do not fall back to bundled trust', async () => {
        const service = new POITrustService({ trustSnapshot: vi.fn().mockRejectedValue(new Error('storage unavailable')) }, bundled);
        await expect(service.resolve(record().id)).rejects.toThrow('storage unavailable');
        const wrong = new POITrustService({ trustSnapshot: vi.fn().mockResolvedValue({ record: record(), deleted: new Set() }) }, bundled);
        await expect(wrong.resolve('another-policy')).rejects.toThrow();
        const other = TrustAnchor.create(anchor.id, ['https://other.example/RNs/CHARGY-TA-TEST'], anchor.holders, 2);
        expect(() => createPOITrustContext(other, document, record(anchor.keys), [], new Set(), at)).toThrow();
    });

    test('authenticated and unverified identity groups never merge policies or lose imports on withdrawal', () => {
        const saved = record(anchor.keys);
        const authenticated = groupRoamingNetworks([saved], [], new Set(), at)[0];
        expect(authenticated?.context?.roamingNetworkOperatorId).toBe('CHARGY-TEST-RNO');
        const unverified = groupRoamingNetworks([record()], [], new Set(), at)[0];
        expect(unverified?.context).toBeUndefined();
        expect(unverified?.anchors[0]?.id).toBe(saved.id);
        expect(authenticated?.identity).not.toBe(unverified?.identity);
        const changedPolicy = TrustAnchor.create(anchor.id, anchor.urls, anchor.holders, 1);
        const different = createPOITrustContext(changedPolicy, document, undefined, bundled, new Set(), at);
        expect(different.networkIdentity).not.toBe(authenticated?.context?.networkIdentity);
    });
});

describe('Future station verification uses the same storage-backed library gate', () => {
    const example = parseJSON(fixture('station-trust-gateway.json')) as JSONObject;
    const pinned = TrustAnchor.fromJSON(example['trustAnchor'] ?? null);
    const proof = example['proof'] as JSONObject;
    const network = proof['roamingNetwork'] as JSONObject;
    const operator = network['operator'] as JSONObject;
    const time = Date.parse(example['at'] as string);
    const policyId = trustAnchorStorageId(pinned);
    const signedDocument = { text: JSON.stringify({ operator }), sourceURL: keyStatementURL(pinned.urls[0] ?? ''), downloadedAt: new Date(time).toISOString() };
    function saved(ids: readonly string[]): StoredTrustAnchor {
        return { id: policyId, qrCode: pinned.toQRCode(), sourceText: pinned.toURL(), importedAt: new Date(time).toISOString(),
            downloadedData: signedDocument, trustedKeys: ids.map(id => ({ id, acceptedAt: new Date(time).toISOString() })) };
    }

    test('a genuine station proof cannot bypass unknown or withdrawn bootstrap trust', async () => {
        let current = saved([]);
        const trustSnapshot = vi.fn(async () => { await Promise.resolve(); return { record: current, deleted: new Set<string>() }; });
        const service = new POITrustService({ trustSnapshot }, [], () => time);
        await expect(service.verifyStation(policyId, proof, { evseId: example['evseId'] as string })).rejects.toThrow();
        current = saved(pinned.keys);
        const result = await service.verifyStation(policyId, proof, { evseId: example['evseId'] as string });
        expect(result.station.chargingStation['@id']).toBe('DE*GEF*S1');
        expect((await service.verifyOperator(policyId, operator)).context.roamingNetworkOperatorId).toBe('DE*RNO');
        current = saved(pinned.keys.slice(0, 1));
        await expect(service.verifyStation(policyId, proof, { evseId: example['evseId'] as string })).rejects.toThrow();
    });

    test('a foreign EVSE, empty subject or substituted signed statement is rejected', async () => {
        const service = new POITrustService({ trustSnapshot: vi.fn().mockResolvedValue({ record: saved(pinned.keys), deleted: new Set<string>() }) }, [], () => time);
        await expect(service.verifyStation(policyId, proof, { evseId: 'FOREIGN' })).rejects.toThrow();
        await expect(service.verifyStation(policyId, proof, { evseId: '' })).rejects.toThrow();
        const changed = parseJSON(fixture('station-trust-gateway.json')) as JSONObject;
        const changedProof = changed['proof'] as JSONObject;
        const changedOperator = (changedProof['roamingNetwork'] as JSONObject)['operator'] as JSONObject;
        const changedStatement = changedOperator['keyStatement'] as JSONObject;
        changedStatement['validUntil'] = '2026-11-15T00:00:00.000Z';
        await expect(service.verifyOperator(policyId, changedOperator)).rejects.toThrow();
        await expect(service.verifyStation(policyId, changedProof, { evseId: example['evseId'] as string })).rejects.toThrow(/differs/);
    });
});
