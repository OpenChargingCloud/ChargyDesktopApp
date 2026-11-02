import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {IsAChargeTransparencyLiveLink,readLiveSessionDocument} from '@open-charging-cloud/chargy-core';
import {observeRejectedLiveCandidate,restoreObservedLive,prepareLivePOIState,checkLivePOISession,originalLiveInput} from '../src/ts/livePOISession';
import {MemoryPOIObservedHistory} from '../src/ts/poiObservedHistory';
import {readSessionPOIEvidence,exportSessionPOIEvidence,replaceSessionPOIEvidence} from '../src/ts/sessionPOIData';
import {TestPOITrustService as POITrustService} from './poiTestService';
import {trustAnchorStorageId} from '../src/ts/trustStore';
import {createVerificationChargy,verifyChargeData} from './testHelper';
import type {LivePOIState} from '../src/ts/livePOISession';
import type {StoredTrustAnchor} from '../src/ts/trustStore';
const now=Date.parse('2026-11-01T00:16:21Z');
const file=(name:string):string=>readFileSync(new URL('./fixtures/POILive/'+name+'.json',import.meta.url),'utf8');
const state=(name:string,previous?:LivePOIState):LivePOIState=>prepareLivePOIState(file(name),readSessionPOIEvidence(file(name)),previous,now);
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);});afterEach(()=>vi.restoreAllMocks());
async function setup(history=new MemoryPOIObservedHistory()):Promise<{current:LivePOIState;service:POITrustService;snapshot:ReturnType<typeof vi.fn>}> {
    const current=state('00-waiting'),bootstrap=current.evidence[0]?.bootstrap;if(bootstrap===undefined)throw new Error('Missing bootstrap');
    current.policyId=trustAnchorStorageId(bootstrap.anchor);
    const record:StoredTrustAnchor={id:current.policyId,qrCode:bootstrap.anchor.toQRCode(),sourceText:bootstrap.anchor.toQRCode(),downloadedData:bootstrap.document,
        importedAt:new Date(now).toISOString(),trustedKeys:bootstrap.anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()}))};
    const snapshot=vi.fn().mockResolvedValue({record,deleted:new Set<string>()});
    return Promise.resolve({current,service:new POITrustService({trustSnapshot:snapshot},[],()=>now,history),snapshot});
}
async function check(current:LivePOIState,service:POITrustService):ReturnType<typeof checkLivePOISession> {
    const original=current.originals.at(-1);if(original===undefined)throw new Error('Missing original');
    const link=await verifyChargeData('live.json',original);if(!IsAChargeTransparencyLiveLink(link))throw new Error('Missing live link');
    const chargy=createVerificationChargy(),readings=await chargy.TryToParseLiveLinkMeterValues(link);
    return checkLivePOISession(chargy,service,current,readings?.chargingSessions?.[0],new AbortController().signal);
}
describe('Complete POI live pilot',()=>{
    test('a rejected genuine same-time fork is durably quarantined, while broken signatures cannot poison it',async()=>{
        const repository=new MemoryPOIObservedHistory(),example=await setup(repository),start=state('01-start',example.current);await check(start,example.service);
        await expect(observeRejectedLiveCandidate(example.service,start,file('invalid-document'),new AbortController().signal)).rejects.toThrow();
        expect((await check(start,example.service)).stage).toBe('start');
        await observeRejectedLiveCandidate(example.service,start,file('same-time-fork'),new AbortController().signal);
        await expect(check(start,(await setup(repository)).service)).rejects.toThrow(/known-fork/);
    });
    test('live originals reopen after a new service instance, but an older QR snapshot and withdrawn trust cannot restore success',async()=>{
        const repository=new MemoryPOIObservedHistory(),example=await setup(repository);let current=example.current;await check(current,example.service);
        for(const name of ['01-start','02-intermediate','03-completed']){current=state(name,current);await check(current,example.service);}
        const reopened=await setup(repository);await expect(check(reopened.current,reopened.service)).rejects.toThrow(/rollback/);
        const saved=await repository.begin((await example.service.beginObservations(current.policyId)).scope),snapshot=saved.liveEvidence[current.id];if(snapshot===undefined)throw new Error('Missing persisted snapshot');
        const restored=restoreObservedLive(current.originals,snapshot,current.policyId);expect((await check(restored,reopened.service)).stage).toBe('complete');
        reopened.snapshot.mockResolvedValue({record:undefined,deleted:new Set<string>()});await expect(check(restored,reopened.service)).rejects.toThrow();
        expect(restored.originals).toEqual(current.originals);
    });
    test('prepares before readings and checks every genuine start/intermediate/end before accepting the next state',async()=>{
        const example=await setup();let current=example.current;
        expect((await check(current,example.service)).stage).toBe('waiting');
        for(const[name,stage,count]of [['01-start','start',1],['02-intermediate','charging',2],['03-completed','complete',3]] as const){
            current=state(name,current);const result=await check(current,example.service);
            expect(result.stage).toBe(stage);expect(result.readingCount).toBe(count);expect(result.price?.applicability).toBe('bound');expect(result.price?.publication).toBe('valid');
        }
        expect(current.originals).toHaveLength(4);expect(current.evidence[0]?.priceEvidence).toBe(readSessionPOIEvidence(file('01-start'))[0]?.priceEvidence);
    });
    test.each(['same-time-fork','replayed-waiting','bad-predecessor','wrong-evse','replaced-start','removed-start','invalid-document'])('%s never replaces accepted originals',async name=>{
        const {current}=await setup(),start=state('01-start',current);expect(()=>state(name,start)).toThrow();expect(start.readingCount).toBe(1);
    });
    test.each(['invalid-intermediate','foreign-meter','rate-conflict'])('%s is refused before adopting the candidate',async name=>{
        const example=await setup(),start=state('01-start',example.current),candidate=state(name,start);
        await expect(check(candidate,example.service)).rejects.toThrow();expect(start.readingCount).toBe(1);
    });
    test('a genuine changed offer is visible but cannot overwrite the original fixed session price',async()=>{
        const example=await setup(),start=state('01-start',example.current);await check(start,example.service);const candidate=state('repriced',start);
        expect(candidate.priceChanged).toBe(true);expect(candidate.evidence[0]?.priceEvidence).toBe(start.evidence[0]?.priceEvidence);
        const result=await check(candidate,example.service);expect(result.price?.selected?.rates?.energyPerKWh).toBe('0.35');expect(result.stage).toBe('charging');
    });
    test('an unbound offer before the first reading never pins the later actual session selection',async()=>{
        const example=await setup(),offer=readSessionPOIEvidence(file('01-start'))[0]?.priceEvidence;
        const original=example.current.evidence[0];if(offer===undefined||original===undefined)throw new Error('Missing offer');
        const parsed=JSON.parse(offer) as Record<string,unknown>;delete parsed['agreement'];
        example.current.evidence=[{...original,priceEvidence:JSON.stringify(parsed)}];
        await check(example.current,example.service);expect(example.current.pricePinned).toBe(false);
        const start=state('01-start',example.current);expect((await check(start,example.service)).price?.applicability).toBe('bound');expect(start.pricePinned).toBe(true);
    });
    test('policy selection and current key authorization are required on each adoption',async()=>{
        const example=await setup(),start=state('01-start',example.current);start.policyId='';
        await expect(check(start,example.service)).rejects.toThrow(/policy/);start.policyId=example.current.policyId;
        example.snapshot.mockResolvedValue({record:undefined,deleted:new Set<string>()});await expect(check(start,example.service)).rejects.toThrow();
    });
    test('export retains exact envelopes and price evidence without restoring decisions',async()=>{
        const example=await setup(),start=state('01-start',example.current),middle=state('02-intermediate',start),complete=state('03-completed',middle);
        const evidence=complete.evidence[0];if(evidence===undefined)throw new Error('Missing evidence');
        const exported=exportSessionPOIEvidence(evidence),imported=readSessionPOIEvidence(JSON.stringify({poiEvidence:exported}))[0];
        expect(imported?.liveDocuments).toEqual(complete.originals);expect(imported?.priceEvidence).toBe(start.evidence[0]?.priceEvidence);
        const reset=prepareLivePOIState(file('00-waiting'),readSessionPOIEvidence(file('00-waiting')),undefined,now);expect(reset.policyId).toBe('');
    });
    test('a downloaded price replaces an immutable live copy instead of creating competing evidence',async()=>{
        const example=await setup(),original=example.current.evidence[0];if(original===undefined)throw new Error('Missing source');
        const price=readSessionPOIEvidence(file('01-start'))[0]?.priceEvidence;if(price===undefined)throw new Error('Missing price');
        const copied={...original},updated={...original,priceEvidence:price};
        const replaced=replaceSessionPOIEvidence([copied],updated,example.current.id,1);
        expect(replaced).toHaveLength(1);expect(replaced[0]?.priceEvidence).toBe(updated.priceEvidence);
    });
    test('original input discovery preserves bytes rather than serializing runtime verification fields',()=>{
        expect(originalLiveInput(file('00-waiting'))).toBe(file('00-waiting'));
        expect(readLiveSessionDocument(file('00-waiting'),now).readings).toHaveLength(0);
    });
});
