import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { IsAChargeTransparencyRecord, OCMF, ocmfSessionMaterial, verifyOCMFSessionWithMeterKey } from '@open-charging-cloud/chargy-core';
import { parseJSON } from '@open-charging-cloud/wwcp-poi';
import { verifyChargeData, createVerificationChargy } from './testHelper';
import { readSessionPOIEvidence } from '../src/ts/sessionPOIData';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import {TestPOITrustService as POITrustService} from './poiTestService';
import type { IChargingSession, IOCMFSessionMaterial } from '@open-charging-cloud/chargy-core';
import type { StoredTrustAnchor } from '../src/ts/trustStore';
import type { Mock } from 'vitest';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/POISession/${name}.chargy`, import.meta.url), 'utf8');
const metadata = JSON.parse(readFileSync(new URL('./fixtures/POISession/provenance.json', import.meta.url), 'utf8')) as { generatedAt: string; evseId: string };
const at = Date.parse(metadata.generatedAt);

interface Setup {
    raw: string; session: IChargingSession; material: IOCMFSessionMaterial; service: POITrustService;
    bind: () => ReturnType<POITrustService['verifyMeterKey']>; record: StoredTrustAnchor;
    snapshot: Mock<() => Promise<{ record: StoredTrustAnchor; deleted: ReadonlySet<string> }>>;
}
async function setup(name: string = 'completed-session-with-evse-proof'): Promise<Setup> {
    const raw = fixture(name);
    const input = readSessionPOIEvidence([{ name, data: new TextEncoder().encode(raw) }])[0];
    if (input?.bootstrap === undefined || input.document === undefined) throw new Error('Missing example evidence');
    const { anchor, document } = input.bootstrap;
    const policyId = trustAnchorStorageId(anchor);
    const record = { id: policyId, qrCode: anchor.toQRCode(), sourceText: anchor.toQRCode(), importedAt: metadata.generatedAt,
        downloadedData: document, trustedKeys: anchor.keys.map(id => ({ id, acceptedAt: metadata.generatedAt })) };
    const snapshot = vi.fn<() => Promise<{ record: StoredTrustAnchor; deleted: ReadonlySet<string> }>>()
        .mockResolvedValue({ record, deleted: new Set<string>() });
    const service = new POITrustService({ trustSnapshot: snapshot }, [], () => at);
    const parsed = await verifyChargeData(name + '.chargy', raw);
    if (!IsAChargeTransparencyRecord(parsed) || parsed.chargingSessions?.[0] === undefined) throw new Error('Missing example readings');
    const session = parsed.chargingSessions[0];
    const material = ocmfSessionMaterial(session);
    const bind = async (): ReturnType<POITrustService['verifyMeterKey']> => service.verifyMeterKey(policyId, parseJSON(input.document?.text ?? 'null'), {
        evseId: metadata.evseId, meterSerialNumber: material.meterSerialNumber, keyFormat: 'spki-der'
    });
    return { raw, session, material, service, bind, record, snapshot };
}

describe('Authoritative POI key association and Core handoff', () => {
    test('verifies genuine original start and end signatures with the freshly authorized EVSE key', async () => {
        const example = await setup();
        const { binding } = await example.bind();
        const result = await verifyOCMFSessionWithMeterKey(createVerificationChargy(), example.session, binding, { now: () => at });
        expect(result.status).toBe('verified');
        expect(result.signatureCount).toBe(2);
        expect(result.measurementCount).toBe(2);
        expect(result.binding.evidence.commitId).toBe(binding.evidence.commitId);
        expect(result.historicalAssociation).toBe('not-proven');
    });
    test.each([
        ['container-key-conflict', 'key-conflict', true],
        ['foreign-meter-key-proof', 'key-conflict', false],
        ['tampered-end-reading', 'invalid-signature', false]
    ] as const)('%s stays distinct from station-proof validity', async (name, status, signaturesValid) => {
        const example = await setup(name);
        const { binding } = await example.bind();
        const result = await verifyOCMFSessionWithMeterKey(createVerificationChargy(), example.session, binding, { now: () => at });
        expect(result.status).toBe(status);
        expect(result.signaturesValid).toBe(signaturesValid);
    });
    test.each(['wrong-meter-proof', 'ambiguous-meter-keys'])('%s cannot silently select a working key', async name => {
        const example = await setup(name);
        await expect(example.bind()).rejects.toThrow();
    });
    test('current local withdrawal prevents new key authorization', async () => {
        const example = await setup();
        await example.bind();
        example.snapshot.mockResolvedValue({ record: { ...example.record, trustedKeys: [] }, deleted: new Set<string>() });
        await expect(example.bind()).rejects.toThrow();
    });
    test('one original start reading is verifiable without inventing an end reading or historical key coverage', async () => {
        const example = await setup();
        const { binding } = await example.bind();
        const core = createVerificationChargy();
        const single = await new OCMF(core).TryToParseOCMFDocuments(example.material.documents.slice(0, 1));
        if (!IsAChargeTransparencyRecord(single) || single.chargingSessions?.[0] === undefined) throw new Error('Missing start reading');
        const result = await verifyOCMFSessionWithMeterKey(core, single.chargingSessions[0], binding, { now: () => at });
        expect(result.status).toBe('verified');
        expect(result.measurementCount).toBe(1);
        expect(result.readingPhase).toBe('start-only');
        expect(result.signatureCount).toBe(1);
        expect(result.historicalAssociation).toBe('not-proven');
    });
});
