import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { IsAChargeTransparencyRecord, ocmfSessionMaterial, verifyHistoricalOCMFSession } from '@open-charging-cloud/chargy-core';
import { parseJSON } from '@open-charging-cloud/wwcp-poi';
import { verifyChargeData, createVerificationChargy } from './testHelper';
import { readSessionPOIEvidence, exportSessionPOIEvidence } from '../src/ts/sessionPOIData';
import {TestPOITrustService as POITrustService} from './poiTestService';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import { sessionEvidenceId, readStoredSessionEvidence } from '../src/ts/sessionEvidenceStore';
import { parseTrustAnchorData, validateTrustAnchorData, validateHistoricalReferenceData } from '../src/ts/trustAnchorData';
import type { IChargingSession } from '@open-charging-cloud/chargy-core';
import type { StoredTrustAnchor } from '../src/ts/trustStore';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/POIHistory/${name}.chargy`,import.meta.url),'utf8');
const now = Date.parse('2026-11-01T00:16:21Z');
async function setup(name: string = 'archived-session'): Promise<{
    readonly session: IChargingSession; readonly service: POITrustService; readonly source: NonNullable<ReturnType<typeof readSessionPOIEvidence>[number]>;
    readonly policyId: string; readonly bind: () => ReturnType<POITrustService['verifyHistoricalMeterEvidence']>;
}> {
    const text = fixture(name); const source = readSessionPOIEvidence(text)[0];
    if (source?.bootstrap === undefined || source.historicalEvidence === undefined) throw new Error('Missing historical fixture');
    const { anchor,document } = source.bootstrap; const policyId = trustAnchorStorageId(anchor);
    const record: StoredTrustAnchor = { id:policyId,qrCode:anchor.toQRCode(),sourceText:anchor.toQRCode(),importedAt:new Date(now).toISOString(),
        downloadedData:document,trustedKeys:anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()})) };
    const service = new POITrustService({trustSnapshot:vi.fn().mockResolvedValue({record,deleted:new Set<string>()})},[],()=>now);
    const parsed = await verifyChargeData(name+'.chargy',text);
    if (!IsAChargeTransparencyRecord(parsed) || parsed.chargingSessions?.[0] === undefined) throw new Error('Missing archive readings');
    const session = parsed.chargingSessions[0];
    const bind = async (): ReturnType<POITrustService['verifyHistoricalMeterEvidence']> => service.verifyHistoricalMeterEvidence(policyId,parseJSON(source.historicalEvidence??'null'),{
        evseId:source.evseId,meterSerialNumber:ocmfSessionMaterial(session).meterSerialNumber,keyFormat:'spki-der',
        measurementTimes:(session.measurements??[]).flatMap(measurement=>measurement.values.map(value=>Date.parse(value.timestamp)))
    });
    return {session,service,source,policyId,bind};
}
describe('Historical session evidence integration',()=>{
    test('rechecks expired historical proofs and genuine start/end signatures under current local authorization',async()=>{
        const example=await setup(); const checked=await example.bind();
        expect(checked.evidence.versions[0]?.publication).toBe('rno-checkpoint');
        const result=await verifyHistoricalOCMFSession(createVerificationChargy(),example.session,checked.evidence.bindings,{now:()=>now});
        expect(result.status).toBe('verified'); expect(result.signatureCount).toBe(2);
        expect(result.checks.every(check=>check.historicalAssociation==='rno-attested-at-reading-times')).toBe(true);
        expect(checked.evidence.independentTime).toBe('not-proven');
    });
    test.each(['wrong-period','conflicting-assignments','tampered-checkpoint'])('%s cannot establish historical evidence',async name=>{
        await expect((await setup(name)).bind()).rejects.toThrow();
    });
    test('missing checkpoint is explicit even when historical association and signatures pass',async()=>{
        const example=await setup('missing-checkpoint'); const checked=await example.bind();
        expect(checked.evidence.versions[0]?.publication).toBe('missing');
        expect((await verifyHistoricalOCMFSession(createVerificationChargy(),example.session,checked.evidence.bindings,{now:()=>now})).status).toBe('verified');
    });
    test('two non-overlapping assignments select different genuine keys without trial verification; global container-key conflict stays visible',async()=>{
        const example=await setup('key-rotation'); const checked=await example.bind();
        expect(new Set(checked.evidence.bindings.map(binding=>binding.key.canonicalId)).size).toBe(2);
        const result=await verifyHistoricalOCMFSession(createVerificationChargy(),example.session,checked.evidence.bindings,{now:()=>now});
        expect(result.signaturesValid).toBe(true); expect(result.checks.some(check=>check.status==='key-conflict')).toBe(true);
        expect(checked.evidence.versions.every(version=>version.publication==='missing')).toBe(true);
    });
    test('modified displayed timestamps cannot acquire historical success from valid original documents',async()=>{
        const example=await setup(); const value=example.session.measurements?.[0]?.values[0];
        if(value===undefined) throw new Error('Missing reading'); value.timestamp=new Date(Date.parse(value.timestamp)+1).toISOString();
        const checked=await example.bind();
        const result=await verifyHistoricalOCMFSession(createVerificationChargy(),example.session,checked.evidence.bindings,{now:()=>now});
        expect(result.status).toBe('failed'); expect(result.checks.some(check=>check.historicalAssociation==='not-proven')).toBe(true);
    });
    test('normal session export preserves exact historical JSON text without importing authorization',async()=>{
        const example=await setup(); const exported=exportSessionPOIEvidence(example.source);
        expect(exported['historicalEvidence']).toBe(example.source.historicalEvidence);
        const imported=readSessionPOIEvidence(JSON.stringify({poiEvidence:exported}))[0];
        expect(imported?.historicalEvidence).toBe(example.source.historicalEvidence);
        const untrusted=new POITrustService({trustSnapshot:vi.fn().mockResolvedValue({record:undefined,deleted:new Set<string>()})},[],()=>now);
        await expect(untrusted.resolve(example.policyId)).rejects.toThrow();
    });
    test('a saved reference KeyStatement can expire today without requiring a server or a freshly issued replacement',async()=>{
        const example=await setup('expired-bootstrap-session');
        await expect(example.service.resolve(example.policyId)).rejects.toThrow();
        const checked=await example.bind();
        expect(checked.evidence.bindings).toHaveLength(2);
        expect((await verifyHistoricalOCMFSession(createVerificationChargy(),example.session,checked.evidence.bindings,{now:()=>now})).status).toBe('verified');
    });
    test('unknown expired references are importable only after genuine historical signature checks; this does not authorize signers',()=>{
        const source=readSessionPOIEvidence(fixture('expired-bootstrap-session'))[0];
        if(source?.bootstrap===undefined)throw new Error('Missing old bootstrap');
        const {anchor,document}=source.bootstrap; const data=parseTrustAnchorData(anchor,document);
        expect(validateTrustAnchorData(anchor,data,undefined,[],new Set(),now).canTrustKeys).toBe(false);
        const historical=validateHistoricalReferenceData(anchor,data,undefined,[],new Set(),now);
        expect(historical.canTrustKeys).toBe(true);expect(historical.signers).toBe('invalid');
        const tampered={...data.document,text:data.document.text.replace(/"value":\s*"([A-Za-z0-9+/])/,(_match:string,first:string)=>'"value": "'+(first==='A'?'B':'A'))};
        expect(validateHistoricalReferenceData(anchor,parseTrustAnchorData(anchor,tampered),undefined,[],new Set(),now).canTrustKeys).toBe(false);
    });
    test('archival identity binds original session and audit-only policy; tampering is detected',()=>{
        const content={anchorPolicyId:'policy',evseId:'EVSE',sessionId:'session',document:fixture('archived-session'),policySnapshot:'{"purpose":"audit-only"}'};
        const saved={...content,id:sessionEvidenceId(content),savedAt:new Date(now).toISOString()};
        expect(readStoredSessionEvidence(saved)).toEqual(saved);
        expect(()=>readStoredSessionEvidence({...saved,document:saved.document+' '})).toThrow();
        expect(()=>readStoredSessionEvidence({...saved,policySnapshot:'{"trusted":true}'})).toThrow();
    });
});
