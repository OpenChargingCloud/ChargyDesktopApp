import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { IsAChargeTransparencyRecord } from '@open-charging-cloud/chargy-core';
import { parseJSON, isObject, prettyJSON } from '@open-charging-cloud/wwcp-poi';
import { verifyChargeData } from './testHelper';
import { evidenceForSession, exportSessionPOIEvidence, readSessionPOIEvidence, sessionEVSEId } from '../src/ts/sessionPOIData';
import { createPOITrustContext } from '../src/ts/poiTrustContext';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import { verifyChargingStation } from '@open-charging-cloud/wwcp-poi';

const name = 'completed-session-with-evse-proof.chargy';
const raw = readFileSync(new URL(`./fixtures/POISession/${name}`, import.meta.url), 'utf8');
const metadata = JSON.parse(readFileSync(new URL('./fixtures/POISession/provenance.json', import.meta.url), 'utf8')) as {
    generatedAt: string; consumedKWh: number; meterSerial: string; evseId: string;
    files: Record<string, { sha256: string }>;
};
const source = [{ name, data: new TextEncoder().encode(raw) }];

describe('Completed session with genuine EVSE inclusion proof', () => {
    test('fixture provenance, signed readings, meter and EVSE really belong together', async () => {
        expect(createHash('sha256').update(raw).digest('hex')).toBe(metadata.files[name]?.sha256);
        const result = await verifyChargeData(name, raw);
        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result)) throw new Error('Fixture did not parse');
        const session = result.chargingSessions?.[0];
        if (session === undefined) throw new Error('Missing session');
        expect(result.chargingSessions).toHaveLength(1);
        expect(session.verificationResult?.status).toBe('ValidSignature');
        expect(sessionEVSEId(session)).toBe(metadata.evseId);
        const values = session.measurements?.[0]?.values;
        expect(values).toHaveLength(2);
        expect(values?.map(value => value.result?.status)).toEqual(['ValidSignature', 'ValidSignature']);
        const evidence = evidenceForSession(readSessionPOIEvidence(source), metadata.evseId, session['@id'], 1);
        if (evidence?.bootstrap === undefined || evidence.document === undefined) throw new Error('Missing bootstrap/proof');
        const { anchor, document } = evidence.bootstrap;
        const record = { id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText: anchor.toQRCode(),
            importedAt: metadata.generatedAt, downloadedData: document,
            trustedKeys: anchor.keys.map(id => ({ id, acceptedAt: metadata.generatedAt })) };
        expect(() => createPOITrustContext(anchor, document, undefined, [], new Set(), Date.parse(metadata.generatedAt))).toThrow();
        const context = createPOITrustContext(anchor, document, record, [], new Set(), Date.parse(metadata.generatedAt));
        const station = verifyChargingStation(context.verification, parseJSON(evidence.document.text), { evseId: metadata.evseId });
        expect(station.warnings).toEqual([]);
        expect(station.energyMeters[0]?.['serialNumber']).toBe(metadata.meterSerial);
        expect(station.tariffs.get(metadata.evseId)).toHaveLength(1);
        const meter = station.energyMeters[0];
        const keys = meter?.['publicKeys'];
        const key = Array.isArray(keys) ? keys[0] : undefined;
        if (!isObject(key) || typeof key['key'] !== 'string') throw new Error('Missing meter key');
        const bytes = Buffer.from(key['key'], 'base64');
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(key['@id']);
        const input = JSON.parse(raw) as { ocmfBegin: string; ocmfEnd: string; publicKey: string };
        expect(input.publicKey).toBe(key['key']);
        for (const ocmf of [input.ocmfBegin, input.ocmfEnd]) {
            const parts = ocmf.split('|');
            const payload = JSON.parse(parts[1] ?? '') as { MS: string; CI: string; TT: string };
            expect(payload.MS).toBe(metadata.meterSerial);
            expect(payload.CI).toBe(metadata.evseId);
            expect(payload.TT).toBe('001;EUR;0;35;0;0');
            const signature = JSON.parse(parts[2] ?? '') as { SD: string };
            expect(verify('sha256', Buffer.from(parts[1] ?? ''), createPublicKey({ key: bytes, format: 'der', type: 'spki' }),
                Buffer.from(signature.SD, 'hex'))).toBe(true);
        }
        expect(evidence.document.text).not.toContain('DE*POI*S2');
        expect(evidence.document.text).toContain('@auditPath');
    });

    test('requires an unambiguous session and EVSE association; no inferred network trust', () => {
        const evidence = readSessionPOIEvidence(source);
        expect(() => evidenceForSession(evidence, 'FOREIGN', 'session', 1)).toThrow(/another EVSE/);
        expect(() => evidenceForSession([...evidence, ...evidence], metadata.evseId, 'session', 1)).toThrow(/competing/);
        expect(evidenceForSession(evidence, metadata.evseId, 'session', 2)).toBeUndefined();
        expect(() => sessionEVSEId({ EVSEId: metadata.evseId, EVSE: { '@id': 'FOREIGN' } })).toThrow(/Conflicting/);
        expect(sessionEVSEId({})).toBeUndefined();
    });

    test('retains invalid embedded evidence diagnostics instead of silently treating it as absent', () => {
        expect(readSessionPOIEvidence(raw.replace('"EVSEId": "DE*POI*E1*1"', '"EVSEId": "../escape"'))[0]?.error).toBeDefined();
        expect(readSessionPOIEvidence(raw.replace('"hashAlgorithm": "sha256"', '"hashAlgorithm": "sha256", "hashAlgorithm": "sha512"'))[0]?.error).toBeDefined();
        expect(readSessionPOIEvidence('plain measurement text')).toEqual([]);
        expect(readSessionPOIEvidence('OCMF|{"GI":"poiEvidence"}|{}')).toEqual([]);
    });

    test('preserves signed decimal precision in embedded proofs', () => {
        const evidence = readSessionPOIEvidence(raw);
        expect(evidence[0]?.document?.text).toContain('0.35');
        const proof = parseJSON(evidence[0]?.document?.text ?? 'null');
        expect(prettyJSON(proof)).toBe(evidence[0]?.document?.text);
        if (evidence[0] === undefined) throw new Error('Missing evidence');
        const exported = JSON.stringify({ poiEvidence: exportSessionPOIEvidence(evidence[0]) });
        const roundTrip = readSessionPOIEvidence(exported)[0];
        expect(roundTrip?.document?.text).toBe(evidence[0].document?.text);
        expect(roundTrip?.bootstrap?.document.text).toBe(evidence[0].bootstrap?.document.text);
    });
});
