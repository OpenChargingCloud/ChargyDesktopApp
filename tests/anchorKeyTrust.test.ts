import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { KeyStatement, TrustAnchor, parseJSON } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import { anchorKeyTrustState, trustedAnchorHolders } from '../src/ts/anchorKeyTrust';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import type { StoredTrustAnchor } from '../src/ts/trustStore';
import { parseTrustedPublicKeysJSONL } from '../src/ts/trustedPublicKeys';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/TrustAnchors/${name}`, import.meta.url), 'utf8');
const anchor = TrustAnchor.parse(fixture('compact.txt'));
const statement = KeyStatement.parse(parseJSON(fixture('key-statement.json')));
const publicKeys = parseTrustedPublicKeysJSONL(fixture('public-keys.jsonl'));
const at = Date.parse('2026-10-31T00:00:00.000Z');
const first = anchor.holders[0]?.[0] ?? '';
const sameHolder = anchor.holders[0]?.[1] ?? '';
const second = anchor.holders[1]?.[0] ?? '';

function record(ids: readonly string[] = []): StoredTrustAnchor {
    return { id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText: anchor.toURL(),
             importedAt: new Date(at).toISOString(), trustedKeys: ids.map(id => ({ id, acceptedAt: new Date(at).toISOString() })) };
}

function verify(saved: StoredTrustAnchor | undefined, bundled: readonly POIPublicKey[] = [], deleted: ReadonlySet<string> = new Set()): Set<string> {
    return statement.verifyHolders(trustedAnchorHolders(anchor, saved, bundled, deleted, at), [],
                                   { minConsensus: anchor.minConsensus, at }).signedBy;
}

describe('Explicit local trust in anchor keys', () => {
    test('valid signatures by completely unknown keys do not establish trust or quorum', () => {
        for (const signature of statement.signatures) {
            const key = statement.identityKeys.find(key => key.id === signature.keyId);
            if (key === undefined)
                throw new Error('Missing fixture key');
            expect(() => { statement.verifySignature(signature, key); }).not.toThrow();
        }
        expect(() => verify(undefined)).toThrow();
        expect(() => verify(record())).toThrow();
        expect(anchorKeyTrustState(anchor, first, record(), [], new Set(), at)).toBe('unknown');
    });

    test('manual decisions can establish the required distinct-holder quorum', () => {
        expect(verify(record([first, second])).size).toBe(2);
        expect(anchorKeyTrustState(anchor, first, record([first]), [], new Set(), at)).toBe('manual');
        expect(anchorKeyTrustState(anchor, sameHolder, record([first]), [], new Set(), at)).toBe('unknown');
    });

    test('two accepted keys of one holder do not satisfy a two-holder quorum', () => {
        expect(() => verify(record([first, sameHolder]))).toThrow();
    });

    test('withdrawal immediately removes that key from the trusted-holder selection', () => {
        expect(verify(record([first, second])).size).toBe(2);
        expect(() => verify(record([first]))).toThrow();
    });

    test('manual trust cannot leak to another network, source, quorum or holder grouping', () => {
        const others = [
            TrustAnchor.create('OTHER', ['https://poi.example/RNs/OTHER'], anchor.holders, 2),
            TrustAnchor.create(anchor.id, ['https://other.example/RNs/CHARGY-TA-TEST'], anchor.holders, 2),
            TrustAnchor.create(anchor.id, anchor.urls, anchor.holders, 1),
            TrustAnchor.create(anchor.id, anchor.urls, anchor.keys, 2)
        ];
        for (const other of others)
            expect(trustedAnchorHolders(other, record([first, second]), [], new Set(), at).flat()).toEqual([]);
    });

    test('bundled roots and deliberate scoped acceptance remain separate', () => {
        expect(verify(record(), publicKeys).size).toBe(2);
        const deleted = new Set(publicKeys.map(key => key.id));
        expect(() => verify(record(), publicKeys, deleted)).toThrow();
        expect(verify(record([first, second]), publicKeys, deleted).size).toBe(2);
        expect(deleted.size).toBe(3);
        expect(publicKeys).toHaveLength(3);
    });

    test('manual acceptance cannot repair an invalid signature', () => {
        const changed = { ...statement.json, roamingNetworkOperatorId: 'FORGED-RNO' };
        expect(() => KeyStatement.parse(changed).verifyHolders(trustedAnchorHolders(anchor, record([first, second]), [], new Set(), at), [], { at })).toThrow();
    });

    test('manual acceptance does not bypass known key validity or statement validity', () => {
        const firstKey = publicKeys.find(key => key.id === first);
        if (firstKey === undefined)
            throw new Error('Missing fixture key');
        const expired = parseTrustedPublicKeysJSONL(JSON.stringify({ ...firstKey.json, notAfter: '2025-01-01T00:00:00.000Z' }));
        expect(anchorKeyTrustState(anchor, first, record([first]), expired, new Set(), at)).toBe('expired');
        expect(() => statement.verifyHolders(trustedAnchorHolders(anchor, record([first, second]), [], new Set(), at), [], { at: Date.parse('2031-01-01T00:00:00.000Z') })).toThrow();
    });
});
