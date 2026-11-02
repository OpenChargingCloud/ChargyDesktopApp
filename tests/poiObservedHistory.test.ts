import {readFileSync} from 'node:fs';
import {describe,expect,test,vi} from 'vitest';
import {IsAChargeTransparencyRecord,readOCMFSessionPriceContext} from '@open-charging-cloud/chargy-core';
import {parseJSON,prettyJSON,TrustAnchor,ChargingStationProof,stationVersionObservation} from '@open-charging-cloud/wwcp-poi';
import type {JSONObject,JSONValue} from '@open-charging-cloud/wwcp-poi';
import {POITrustService} from '../src/ts/poiTrustContext';
import {MemoryWitnessPolicy} from '../src/ts/poiWitnessTrust';
import {MemoryPOIObservedHistory,POIObservedHistoryStore} from '../src/ts/poiObservedHistory';
import {readSessionPOIEvidence} from '../src/ts/sessionPOIData';
import {trustAnchorStorageId} from '../src/ts/trustStore';
import type {StoredTrustAnchor} from '../src/ts/trustStore';
import {createVerificationChargy,verifyChargeData} from './testHelper';

const file=(name:string):string=>readFileSync(new URL('./fixtures/POIObservedVersions/'+name,import.meta.url),'utf8');
interface Vectors {evaluatedAt:string;evseId:string;bootstrap:{trustAnchor:string;keyStatement:string};proofs:JSONObject[];forkStation:JSONObject;prices:JSONObject[];forkPrice:JSONObject;
    checkpoints:{checkpoint:JSONValue;operator:JSONValue}[];forkCheckpoint:{checkpoint:JSONValue;operator:JSONValue};nextEpoch:{checkpoint:JSONValue;operator:JSONValue};}
const vectors=parseJSON(file('vectors.json')) as unknown as Vectors,now=Date.parse(vectors.evaluatedAt),anchor=TrustAnchor.parse(vectors.bootstrap.trustAnchor),policyId=trustAnchorStorageId(anchor);
const required=<T>(value:T|undefined):T=>{if(value===undefined)throw new Error('Missing test vector');return value;};
function setup(history=new MemoryPOIObservedHistory()):{service:POITrustService;history:MemoryPOIObservedHistory;snapshot:ReturnType<typeof vi.fn>;record:StoredTrustAnchor} {
    const record:StoredTrustAnchor={id:policyId,qrCode:anchor.toQRCode(),sourceText:anchor.toQRCode(),importedAt:new Date(now).toISOString(),
        downloadedData:{text:vectors.bootstrap.keyStatement,sourceURL:required(anchor.urls[0])+'/keyStatement',downloadedAt:new Date(now).toISOString()},
        trustedKeys:anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()}))};
    const snapshot=vi.fn().mockResolvedValue({record,deleted:new Set<string>()});
    return {service:new POITrustService({trustSnapshot:snapshot},[],()=>now,history,new MemoryWitnessPolicy()),history,snapshot,record};
}
const station=async(service:POITrustService,revision:number):ReturnType<POITrustService['verifyStation']>=>service.verifyStation(policyId,required(vectors.proofs[revision]),{evseId:vectors.evseId});
async function historical(service:POITrustService,name:string):ReturnType<POITrustService['verifySessionPriceEvidence']> {
    const text=file(name+'.chargy'),source=required(readSessionPOIEvidence(text)[0]);
    const result=await verifyChargeData(name+'.chargy',text);if(!IsAChargeTransparencyRecord(result))throw new Error('Missing genuine meter readings');
    const subject=await readOCMFSessionPriceContext(createVerificationChargy(),required(result.chargingSessions?.[0]));
    return service.verifySessionPriceEvidence(policyId,parseJSON(source.priceEvidence??'null'),subject);
}
describe('Durable authenticated observations: service boundary',()=>{
    test('a fresh service using the same repository refuses current rollback, including after anchor deletion/reimport',async()=>{
        const example=setup();await station(example.service,0);await station(example.service,1);
        example.snapshot.mockResolvedValue({record:undefined,deleted:new Set<string>()});await expect(station(example.service,0)).rejects.toThrow(/saved/i);
        const reopened=setup(example.history);await expect(station(reopened.service,0)).rejects.toThrow(/rollback/);
        expect((await station(reopened.service,1)).consistency?.accepted).toBe(true);
    });
    test('a genuine quorum-signed station fork remains quarantined when returning to the original source',async()=>{
        const example=setup();await station(example.service,1);
        await expect(example.service.verifyStation(policyId,vectors.forkStation,{evseId:vectors.evseId})).rejects.toThrow(/fork/);
        await expect(station(setup(example.history).service,1)).rejects.toThrow(/known-fork/);
    });
    test('invalid signatures and missing trust cannot poison an authenticated coordinate',async()=>{
        const example=setup(),invalid=parseJSON(prettyJSON(vectors.forkStation)) as JSONObject;
        for(const raw of invalid['attestations'] as JSONObject[])raw['value']='AA==';
        await expect(example.service.verifyStation(policyId,invalid,{evseId:vectors.evseId})).rejects.toThrow();
        example.snapshot.mockResolvedValueOnce({record:undefined,deleted:new Set<string>()});await expect(station(example.service,1)).rejects.toThrow();
        expect((await station(example.service,1)).consistency?.accepted).toBe(true);
    });
    test('an authentic newer checkpoint may be remembered before its missing predecessors are delivered',async()=>{
        const example=setup(),verify=async(index:number):ReturnType<POITrustService['verifyCurrentCheckpoints']>=>example.service.verifyCurrentCheckpoints(policyId,[required(vectors.checkpoints[index])]);
        await verify(0);await expect(verify(2)).rejects.toThrow(/continuity-missing/);
        await expect(verify(1)).rejects.toThrow(/rollback/); // authenticated gap filler is still recorded
        expect((await verify(2)).accepted).toBe(true);await expect(verify(0)).rejects.toThrow(/rollback/);
    });
    test('signed checkpoint forks and unsigned epoch transitions cannot replace the accepted line',async()=>{
        const example=setup();await example.service.verifyCurrentCheckpoints(policyId,vectors.checkpoints.slice(0,2));
        await expect(example.service.verifyCurrentCheckpoints(policyId,[vectors.forkCheckpoint])).rejects.toThrow(/fork/);
        const other=setup();await other.service.verifyCurrentCheckpoints(policyId,[required(vectors.checkpoints[2])]);
        await expect(other.service.verifyCurrentCheckpoints(policyId,[vectors.nextEpoch])).rejects.toThrow();
    });
    test('current prices advance on authenticated predecessor links and cannot silently regress or fork',async()=>{
        const example=setup(),verify=async(statements:JSONObject[]):ReturnType<POITrustService['verifyCurrentPrices']>=>example.service.verifyCurrentPrices(policyId,required(vectors.proofs[0]),statements,vectors.evseId);
        await verify([required(vectors.prices[0])]);await verify(vectors.prices);
        await expect(verify([required(vectors.prices[0])])).rejects.toThrow(/rollback/);
        await expect(verify([required(vectors.prices[0]),vectors.forkPrice])).rejects.toThrow(/fork/);
        await expect(verify(vectors.prices)).rejects.toThrow(/known-fork/);
    });
    test('newer current station, checkpoint and prices do not invalidate an older genuinely signed fixed session price',async()=>{
        const example=setup();await example.service.verifyCurrentPrices(policyId,required(vectors.proofs[2]),vectors.prices,vectors.evseId);
        await example.service.verifyCurrentCheckpoints(policyId,[required(vectors.checkpoints[2])]);
        const result=await historical(setup(example.history).service,'archive-0');
        expect(result.consistency.accepted).toBe(true);expect(result.consistency.status).toBe('historical');
        expect(result.price.signatures).toBe('valid');expect(result.price.applicability).toBe('bound');expect(result.price.publication).toBe('valid');
        expect(result.price.selected?.rates?.energyPerKWh).toBe('0.35');
        await expect(station(example.service,0)).rejects.toThrow(/rollback/);
    });
    test('cross-packet checkpoint equivocation is separate from individually valid historical signatures/publication',async()=>{
        const example=setup();expect((await historical(example.service,'archive-1')).consistency.accepted).toBe(true);
        const fork=await historical(setup(example.history).service,'checkpoint-fork-1');expect(fork.price.publication).toBe('valid');expect(fork.price.applicability).toBe('bound');
        expect(fork.consistency.issues.some(issue=>issue.kind==='checkpoint'&&issue.code==='fork')).toBe(true);
        expect((await historical(example.service,'archive-1')).consistency.accepted).toBe(false);
    });
    test('a CPO price fork in a later genuine checkpoint is detected across independent packets',async()=>{
        const example=setup();await historical(example.service,'archive-2');const result=await historical(setup(example.history).service,'price-fork-1');
        expect(result.price.signatures).toBe('valid');expect(result.price.publication).toBe('valid');expect(result.price.applicability).toBe('bound');
        expect(result.consistency.issues.some(issue=>issue.kind==='price'&&issue.code==='fork')).toBe(true);
    });
    test('simultaneous repository operations compare the prior committed state rather than overwriting it',async()=>{
        const example=setup(),ticket=await example.service.beginObservations(policyId,false),points=[vectors.proofs[1],vectors.forkStation].map(value=>stationVersionObservation(ChargingStationProof.parse(value)));
        const reports=await Promise.all(points.map(async point=>example.history.observe(ticket.scope,ticket.generation,[point],'current',now)));
        expect(reports.filter(report=>report.accepted)).toHaveLength(1);expect(reports[1]?.state.conflicts).toHaveLength(1);
    });
    test('the production store fails closed without IndexedDB rather than replacing the journal with memory',async()=>{
        const {scope}=await setup().service.beginObservations(policyId);await expect(new POIObservedHistoryStore().begin(scope)).rejects.toThrow(/unavailable/);
    });
});
