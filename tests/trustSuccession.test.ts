import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {TrustAnchor,parseJSON,KeyStatement} from '@open-charging-cloud/wwcp-poi';
import type {JSONObject} from '@open-charging-cloud/wwcp-poi';
import {IsAChargeTransparencyLiveLink} from '@open-charging-cloud/chargy-core';
import {POITrustService} from '../src/ts/poiTrustContext';
import {MemoryWitnessPolicy} from '../src/ts/poiWitnessTrust';
import {MemoryPOIObservedHistory} from '../src/ts/poiObservedHistory';
import {trustAnchorStorageId} from '../src/ts/trustStore';
import type {StoredTrustAnchor} from '../src/ts/trustStore';
import {derivePOITrustLineage} from '../src/ts/poiTrustLineage';
import {prepareLivePOIState,checkLivePOISession} from '../src/ts/livePOISession';
import type {LivePOIState} from '../src/ts/livePOISession';
import {readSessionPOIEvidence} from '../src/ts/sessionPOIData';
import {createVerificationChargy,verifyChargeData} from './testHelper';
const text=(name:string):string=>readFileSync(new URL('./fixtures/POITrustTransitions/'+name,import.meta.url),'utf8');
const vectors=parseJSON(text('vectors.json')) as JSONObject,anchor=TrustAnchor.parse(vectors['anchor'] as string),now=Date.parse(vectors['now'] as string),id=trustAnchorStorageId(anchor);
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);});afterEach(()=>{vi.restoreAllMocks();});
function setup():{service:POITrustService;history:MemoryPOIObservedHistory;record:StoredTrustAnchor;snapshot:ReturnType<typeof vi.fn>} {
    const record:StoredTrustAnchor={id,qrCode:anchor.toQRCode(),sourceText:anchor.toQRCode(),importedAt:new Date(now).toISOString(),
        downloadedData:{text:JSON.stringify(vectors['operator']),sourceURL:(anchor.urls[0]??'')+'/keyStatement',downloadedAt:new Date(now).toISOString()},trustedKeys:anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()}))};
    const snapshot=vi.fn().mockResolvedValue({record,deleted:new Set<string>()}),history=new MemoryPOIObservedHistory();
    return {record,history,snapshot,service:new POITrustService({trustSnapshot:snapshot},[],()=>now,history,new MemoryWitnessPolicy())};
}
describe('Explicit policy succession under current local root decisions',()=>{
    test('preview grants no new local key decision and applying preserves the bootstrap identity/history',async()=>{
        const example=setup();await example.service.verifyStation(id,vectors['baseProof']??null,{evseId:'DE*POI*E1*1'});
        const before=await example.service.resolve(id),preview=await example.service.previewTrustTransition(id,text('policy-transition.json'));
        expect(preview.consistency.accepted).toBe(true);expect((await example.service.resolve(id)).keyStatementDigest).toBe(before.keyStatementDigest);
        const next={...example.record,transitions:[{text:text('policy-transition.json'),acceptedAt:new Date(now).toISOString()}]};example.snapshot.mockResolvedValue({record:next,deleted:new Set<string>()});
        const active=await example.service.resolve(id);expect(active.networkIdentity).toBe(before.networkIdentity);expect(active.anchorPolicyId).toBe(id);expect(active.effectivePolicyId).not.toBe(id);
        expect((await example.service.verifyStation(id,vectors['targetProof']??null,{evseId:'DE*POI*E1*1'})).station.operator['@id']).toBe('DE*POI');
        const stored=await example.history.begin((await example.service.beginObservations(id)).scope);expect(stored.state.transitions).toHaveLength(1);expect(stored.state.points.some(point=>point.digest===(vectors['baseProof'] as JSONObject)['commitId'])).toBe(true);
        example.snapshot.mockResolvedValue({record:{...next,trustedKeys:[]},deleted:new Set<string>()});await expect(example.service.resolve(id)).rejects.toThrow();
    });
    test.each(['missing-old-quorum.json','missing-new-quorum.json','tampered-target-url.json','wrong-genesis.json','invalid-target-certificate.json'])('%s never creates a usable successor',async name=>{
        const example=setup();await expect(example.service.previewTrustTransition(id,text(name))).rejects.toThrow();expect((await example.service.resolve(id)).anchorPolicyId).toBe(id);
    });
    test('a verified epoch change retains the old coordinates and rejects old current snapshots',async()=>{
        const example=setup();await example.service.verifyStation(id,vectors['baseProof']??null,{evseId:'DE*POI*E1*1'});
        const next={...example.record,transitions:[{text:text('epoch-transition.json'),acceptedAt:new Date(now).toISOString()}]};example.snapshot.mockResolvedValue({record:next,deleted:new Set<string>()});
        expect((await example.service.resolve(id)).epoch).toBe(2);expect((await example.service.verifyStation(id,vectors['epochProof']??null,{evseId:'DE*POI*E1*1'})).consistency?.accepted).toBe(true);
        await expect(example.service.verifyStation(id,vectors['baseProof']??null,{evseId:'DE*POI*E1*1'})).rejects.toThrow();
    });
    test('historical authority follows the signed policy timeline while a local withdrawal still disables it',async()=>{
        const example=setup();if(example.record.downloadedData===undefined)throw new Error('Missing data');
        const next={...example.record,transitions:[{text:text('policy-transition.json'),acceptedAt:new Date(now).toISOString()}]};
        const historical=derivePOITrustLineage(anchor,example.record.downloadedData,next,[],new Set(),now,true);
        const source=historical.verification;if(!('authorityAt' in source))throw new Error('Missing historical authority');
        expect(source.authorityAt(now-900000)?.keyStatementDigest).toBe((await example.service.resolve(id)).keyStatementDigest);
        expect(source.authorityAt(now)?.keyStatementDigest).toBe(historical.keyStatementDigest);
        expect(()=>derivePOITrustLineage(anchor,example.record.downloadedData??{text:'',sourceURL:'',downloadedAt:''},{...next,trustedKeys:[]},[],new Set(),now,true)).toThrow();
        expect(KeyStatement.parse((vectors['operator'] as JSONObject)['keyStatement']).roamingNetworkId).toBe(anchor.id);
    });
});
async function liveCheck(state:LivePOIState,service:POITrustService):ReturnType<typeof checkLivePOISession>{
    const original=state.originals.at(-1)??'',parsed=await verifyChargeData('live.json',original);if(!IsAChargeTransparencyLiveLink(parsed))throw new Error('Missing live fixture');
    const chargy=createVerificationChargy(),record=await chargy.TryToParseLiveLinkMeterValues(parsed);return checkLivePOISession(chargy,service,state,record?.chargingSessions?.[0],new AbortController().signal);
}
describe('Live CPO authority and explicit document key rotation',()=>{
    test.each(['live-forged-first.json','live-wrong-cpo.json','live-price-only-key.json'])('%s cannot obtain a green POI result despite a mathematically valid self-signature',async name=>{
        const example=setup(),state=prepareLivePOIState(text(name),readSessionPOIEvidence(text(name)),undefined,now);state.policyId=id;
        await expect(liveCheck(state,example.service)).rejects.toThrow();
    });
    test('a real old/new co-signature plus POI proof allows the next document to use the new key alone',async()=>{
        const example=setup(),start=readFileSync(new URL('./fixtures/POILive/01-start.json',import.meta.url),'utf8');let state=prepareLivePOIState(start,readSessionPOIEvidence(start),undefined,now);state.policyId=id;
        expect((await liveCheck(state,example.service)).cpo.operatorId).toBe('DE*POI');
        for(const name of ['live-key-transition.json','live-after-key-transition.json']){state=prepareLivePOIState(text(name),readSessionPOIEvidence(text(name)),state,now);expect((await liveCheck(state,example.service)).stage).toBe('start');}
        expect(state.originals).toHaveLength(3);
    });
    test('a live session crosses an explicitly accepted policy change, retaining its start price and per-reading authority',async()=>{
        const example=setup(),start=readFileSync(new URL('./fixtures/POILive/01-start.json',import.meta.url),'utf8');let state=prepareLivePOIState(start,readSessionPOIEvidence(start),undefined,now);state.policyId=id;await liveCheck(state,example.service);
        for(const name of ['live-key-transition.json','live-after-key-transition.json']){state=prepareLivePOIState(text(name),readSessionPOIEvidence(text(name)),state,now);await liveCheck(state,example.service);}
        const price=state.evidence[0]?.priceEvidence;example.snapshot.mockResolvedValue({record:{...example.record,transitions:[{text:text('policy-transition.json'),acceptedAt:new Date(now).toISOString()}]},deleted:new Set<string>()});
        state=prepareLivePOIState(text('live-after-policy-transition.json'),readSessionPOIEvidence(text('live-after-policy-transition.json')),state,now);
        const result=await liveCheck(state,example.service);expect(result.stage).toBe('complete');expect(result.price?.selected?.rates?.energyPerKWh).toBe('0.35');expect(state.evidence[0]?.priceEvidence).toBe(price);
    });
    test.each(['live-key-change-without-cosignature.json','live-key-change-without-poi.json'])('%s is rejected before adoption',async name=>{
        const example=setup(),start=readFileSync(new URL('./fixtures/POILive/01-start.json',import.meta.url),'utf8'),before=prepareLivePOIState(start,readSessionPOIEvidence(start),undefined,now);before.policyId=id;await liveCheck(before,example.service);
        const candidate=prepareLivePOIState(text(name),readSessionPOIEvidence(text(name)),before,now);await expect(liveCheck(candidate,example.service)).rejects.toThrow();expect(before.originals).toHaveLength(1);
    });
});
