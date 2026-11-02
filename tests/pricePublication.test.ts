import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {parseJSON,prettyJSON,parseSessionPriceEvidence,parseHistoricalMeterEvidence,pricePublicationOfferHashes,PriceStatement} from '@open-charging-cloud/wwcp-poi';
import type {JSONObject,JSONValue} from '@open-charging-cloud/wwcp-poi';
import {IsAChargeTransparencyRecord,IsAChargeTransparencyLiveLink,readOCMFSessionPriceContext} from '@open-charging-cloud/chargy-core';
import {TestPOITrustService as POITrustService} from './poiTestService';
import {MemoryPOIObservedHistory} from '../src/ts/poiObservedHistory';
import {MemoryWitnessPolicy,witnessPolicySnapshot} from '../src/ts/poiWitnessTrust';
import {loadPricePublicationReceipts} from '../src/ts/pricePublicationData';
import {readSessionPOIEvidence,exportSessionPOIEvidence} from '../src/ts/sessionPOIData';
import {prepareLivePOIState,checkLivePOISession,restoreObservedLive} from '../src/ts/livePOISession';
import type {LivePOIState} from '../src/ts/livePOISession';
import {trustAnchorStorageId} from '../src/ts/trustStore';
import {verifyChargeData,createVerificationChargy} from './testHelper';
import type {SessionPOIEvidence} from '../src/ts/sessionPOIData';
import type {SessionPriceDocument} from '../src/ts/sessionPriceData';
import type {WitnessPolicySnapshot} from '../src/ts/poiWitnessTrust';
import type {IOCMFSessionPriceContext,IChargingSession,Chargy} from '@open-charging-cloud/chargy-core';
const file=(name:string):string=>readFileSync(new URL('./fixtures/POIPublication/'+name,import.meta.url),'utf8'),now=Date.parse('2026-11-01T00:16:21Z');
const policy=():JSONObject=>parseJSON(file('witness-policy.json')) as JSONObject;
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);});afterEach(()=>vi.restoreAllMocks());
function required<T>(value:T|undefined):T {if(value===undefined)throw new Error('Missing fixture data');return value;}
type PriceResult=Awaited<ReturnType<POITrustService['verifySessionPriceEvidence']>>;
interface Example {source:SessionPOIEvidence;service:POITrustService;witnesses:MemoryWitnessPolicy;subject:IOCMFSessionPriceContext;session:IChargingSession;chargy:Chargy;evidence:JSONValue;snapshot:ReturnType<typeof vi.fn>;id:string;check:()=>Promise<PriceResult>;}
async function setup(name='session-before-start.chargy',trusted=true):Promise<Example>{
    const input=file(name),source=readSessionPOIEvidence(input)[0];if(source?.bootstrap===undefined||source.priceEvidence===undefined)throw new Error('Missing fixture');
    const {anchor,document}=source.bootstrap,id=trustAnchorStorageId(anchor),record={id,qrCode:anchor.toQRCode(),sourceText:anchor.toQRCode(),downloadedData:document,importedAt:new Date(now).toISOString(),trustedKeys:anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()}))};
    const snapshot=vi.fn().mockResolvedValue({record,deleted:new Set<string>()}),witnesses=new MemoryWitnessPolicy();if(trusted)witnesses.set(policy());
    const service=new POITrustService({trustSnapshot:snapshot},[],()=>now,new MemoryPOIObservedHistory(),witnesses),chargy=createVerificationChargy(),parsed=await verifyChargeData(name,input);
    if(!IsAChargeTransparencyRecord(parsed)||parsed.chargingSessions?.[0]===undefined)throw new Error('Missing original session');
    const session=parsed.chargingSessions[0],subject=await readOCMFSessionPriceContext(chargy,session),evidence=parseJSON(source.priceEvidence);
    const related=source.historicalEvidence===undefined?[]:parseHistoricalMeterEvidence(parseJSON(source.historicalEvidence)).versions.flatMap(version=>version.checkpoints);
    return {source,service,witnesses,subject,session,chargy,evidence,snapshot,id,check:async():Promise<PriceResult>=>service.verifySessionPriceEvidence(id,evidence,subject,related)};
}
describe('Publication evidence under current local witness decisions',()=>{
    test('the exact selected CPO price and two independently approved witness clocks verify, including ML-DSA-65',async()=>{
        const e=await setup(),result=await e.check();expect(result.price.publicationBeforeStart).toBe('witnessed-before-signed-start');expect(result.price.publicationWitnesses?.organizations).toHaveLength(2);
        expect(result.price.customerConsent).toBe('not-proven');expect(result.consistency.accepted).toBe(true);
    });
    test('input recommendations grant no trust; removal immediately withdraws the independent claim while retaining other checks',async()=>{
        const e=await setup('session-before-start.chargy',false);expect((await e.check()).price.publicationBeforeStart).toBe('not-proven');
        e.witnesses.set(policy());expect((await e.check()).price.publicationBeforeStart).toBe('witnessed-before-signed-start');
        const changed=policy();(changed['witnesses'] as JSONObject[]).pop();e.witnesses.set(changed);const result=await e.check();
        expect(result.price.publicationBeforeStart).toBe('not-proven');expect(result.price.publication).toBe('valid');expect(result.price.signatures).toBe('valid');
    });
    test.each(['late-receipt','clock-overlap','same-organization','unknown-witness','wrong-price','wrong-signed-price','wrong-tariff','wrong-checkpoint','tampered-receipt','future-receipt','private-source'])('%s cannot produce a pre-start verdict',async name=>{
        const e=await setup(name+'.chargy');expect((await e.check()).price.publicationBeforeStart).not.toBe('witnessed-before-signed-start');
    });
    test('authorization changes during asynchronous journal recording prevent stale success',async()=>{
        const e=await setup(),original=e.witnesses.snapshot.bind(e.witnesses),first=await original();
        const get=vi.spyOn(e.witnesses,'snapshot').mockResolvedValueOnce(first).mockResolvedValue({...first,revision:'changed'});
        await expect(e.check()).rejects.toThrow(/Witness authorization changed/);expect(get).toHaveBeenCalledTimes(2);
    });
    test('unavailable witness storage cannot silently substitute empty in-memory trust',async()=>{
        const e=await setup();vi.spyOn(e.witnesses,'snapshot').mockRejectedValue(new Error('Persistent witness trust unavailable'));
        await expect(e.check()).rejects.toThrow(/unavailable/);
    });
    test('export carries original receipts and recommendations, but does not carry authorization',async()=>{
        const e=await setup(),exported=exportSessionPOIEvidence(e.source);expect(exported['priceEvidence']).toBe(e.source.priceEvidence);
        e.witnesses.set({...policy(),witnesses:[]});expect((await e.check()).price.publicationBeforeStart).toBe('not-proven');
        e.snapshot.mockResolvedValue({record:undefined,deleted:new Set<string>()});await expect(e.check()).rejects.toThrow();
    });
    test('a complete live chain retains pre-start evidence after reload and receipt enrichment does not change the fixed offer',async()=>{
        let current:LivePOIState|undefined;const witnesses=new MemoryWitnessPolicy();witnesses.set(policy());const history=new MemoryPOIObservedHistory();let service:POITrustService|undefined;
        for(const name of ['00-waiting','01-start','02-intermediate','03-completed']){
            const text=file('live-'+name+'.json');current=prepareLivePOIState(text,readSessionPOIEvidence(text),current,now);
            const bootstrap=current.evidence[0]?.bootstrap;if(bootstrap===undefined)throw new Error('Missing bootstrap');
            current.policyId=trustAnchorStorageId(bootstrap.anchor);const record={id:current.policyId,qrCode:bootstrap.anchor.toQRCode(),sourceText:bootstrap.anchor.toQRCode(),downloadedData:bootstrap.document,importedAt:new Date(now).toISOString(),trustedKeys:bootstrap.anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()}))};
            service=new POITrustService({trustSnapshot:vi.fn().mockResolvedValue({record,deleted:new Set<string>()})},[],()=>now,history,witnesses);
            const parsed=await verifyChargeData(name+'.json',text);if(!IsAChargeTransparencyLiveLink(parsed))throw new Error('Missing live link');
            const chargy=createVerificationChargy(),readings=await chargy.TryToParseLiveLinkMeterValues(parsed),result=await checkLivePOISession(chargy,service,current,readings?.chargingSessions?.[0],new AbortController().signal);
            if(name!=='00-waiting')expect(result.price?.publicationBeforeStart).toBe('witnessed-before-signed-start');
        }
        if(current===undefined||service===undefined)throw new Error('Missing live chain');
        const snapshot=required(current.evidence[0]);const source=parseJSON(required(snapshot.priceEvidence)) as JSONObject;source['publicationReceipts']=[...(source['publicationReceipts'] as JSONObject[])].reverse();
        const restored=restoreObservedLive(current.originals,JSON.stringify(exportSessionPOIEvidence({...snapshot,priceEvidence:prettyJSON(source)})),current.policyId);
        expect(restored.priceChanged).toBe(false);expect(restored.readingCount).toBe(3);
        const parsed=await verifyChargeData('reopened-live.json',required(current.originals.at(-1)));if(!IsAChargeTransparencyLiveLink(parsed))throw new Error('Missing original live link');
        const chargy=createVerificationChargy(),readings=await chargy.TryToParseLiveLinkMeterValues(parsed);
        const checked=await checkLivePOISession(chargy,service,restored,readings?.chargingSessions?.[0],new AbortController().signal);
        expect(checked.price?.publicationBeforeStart).toBe('witnessed-before-signed-start');
        witnesses.set({...policy(),witnesses:[]});
        const withdrawn=await checkLivePOISession(chargy,service,restored,readings?.chargingSessions?.[0],new AbortController().signal);
        expect(withdrawn.stage).toBe('complete');expect(withdrawn.price?.publicationBeforeStart).toBe('not-proven');
    });
});

describe('Explicit, bounded witness receipt retrieval',()=>{
    const signal=():AbortSignal=>new AbortController().signal;
    async function transport():Promise<{e:Example;document:SessionPriceDocument;subject:{roamingNetworkId:string;evseId:string;digest:string;priceStatementSHA256:string;tariffSHA256:string;checkpointIds:readonly string[]};snapshot:WitnessPolicySnapshot}>{const e=await setup('no-receipts.chargy'),price=(await e.check()).price,document={origin:'embedded' as const,sourceURL:'input:session.chargy',receivedAt:new Date(now).toISOString(),text:required(e.source.priceEvidence)},selected=required(price.selected);
        return {e,document,subject:{roamingNetworkId:'CHARGY-POI-DEMO',evseId:e.subject.evseId,digest:selected.digest,...pricePublicationOfferHashes(PriceStatement.parse(selected.statement),selected.tariff),checkpointIds:price.checkpointIds},snapshot:witnessPolicySnapshot(file('witness-policy.json'))};}
    test('queries only explicitly configured endpoints, sends public IDs, deduplicates receipts and verifies before adoption',async()=>{
        const e=await transport(),source=required(readSessionPOIEvidence(file('session-before-start.chargy'))[0]),receipts=parseSessionPriceEvidence(parseJSON(required(source.priceEvidence))).publicationReceipts;
        const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(prettyJSON([required(receipts[0]),required(receipts[0])]))).mockResolvedValueOnce(new Response(prettyJSON({publicationReceipts:[required(receipts[1])]})));
        const result=await loadPricePublicationReceipts(e.document,e.snapshot,e.subject,async document=>e.e.service.verifySessionPriceEvidence(e.e.id,parseJSON(document.text),e.e.subject),{signal:signal(),fetch:fetcher});
        expect(result.price.publicationBeforeStart).toBe('witnessed-before-signed-start');expect(fetcher).toHaveBeenCalledTimes(2);
        for(const [request,options]of fetcher.mock.calls){if(typeof request!=='string')throw new Error('Expected URL string');const url=new URL(request);expect([...url.searchParams.keys()].sort()).toEqual(['EVSEId','checkpointId','priceStatementDigest','priceStatementSHA256','roamingNetworkId','tariffSHA256']);expect(url.hostname).toMatch(/^witness-[ab]\.example$/);expect(options).toMatchObject({redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});}
        expect(e.document.text).not.toContain('public-price-retrieval');
    });
    test('empty local witness configuration never contacts input-advertised sources',async()=>{
        const e=await transport(),empty=witnessPolicySnapshot(prettyJSON({...policy(),witnesses:[]})),fetcher=vi.fn<typeof fetch>();
        await expect(loadPricePublicationReceipts(e.document,empty,e.subject,async value=>Promise.resolve(value),{signal:signal(),fetch:fetcher})).rejects.toThrow(/configure publication witnesses/);expect(fetcher).not.toHaveBeenCalled();
    });
    test('invalid signatures/subjects are not adopted just because the transport returned JSON',async()=>{
        const e=await transport(),source=required(readSessionPOIEvidence(file('wrong-price.chargy'))[0]),receipts=parseSessionPriceEvidence(parseJSON(required(source.priceEvidence))).publicationReceipts;
        const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Promise.resolve(new Response(prettyJSON([...receipts]))));
        await expect(loadPricePublicationReceipts(e.document,e.snapshot,e.subject,async document=>{
            const checked=await e.e.service.verifySessionPriceEvidence(e.e.id,parseJSON(document.text),e.e.subject);if(checked.price.publicationBeforeStart!=='witnessed-before-signed-start')throw new Error('Not authorized');return checked;
        },{signal:signal(),fetch:fetcher})).rejects.toThrow(/Not authorized/);expect(e.document.text).not.toContain('public-price-retrieval');
    });
    test('response limits, cancellation and overall deadline cannot release an unchecked result',async()=>{
        const e=await transport(),verify=vi.fn(async(value:SessionPriceDocument):Promise<SessionPriceDocument>=>Promise.resolve(value)),oversized=vi.fn<typeof fetch>().mockImplementation(async()=>Promise.resolve(new Response('{}',{headers:{'content-length':String(2*1024*1024)}})));
        await expect(loadPricePublicationReceipts(e.document,e.snapshot,e.subject,verify,{signal:signal(),fetch:oversized})).rejects.toThrow(/No publication receipts/);expect(verify).not.toHaveBeenCalled();
        const controller=new AbortController();controller.abort();const fetcher=vi.fn<typeof fetch>();await expect(loadPricePublicationReceipts(e.document,e.snapshot,e.subject,verify,{signal:controller.signal,fetch:fetcher})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
        const source=required(readSessionPOIEvidence(file('session-before-start.chargy'))[0]),receipts=parseSessionPriceEvidence(parseJSON(required(source.priceEvidence))).publicationReceipts;
        fetcher.mockImplementation(async()=>Promise.resolve(new Response(prettyJSON([...receipts]))));
        await expect(loadPricePublicationReceipts(e.document,e.snapshot,e.subject,async()=>{await new Promise(resolve=>setTimeout(resolve,20));return true;},{signal:signal(),fetch:fetcher,totalTimeoutMs:5})).rejects.toThrow(/deadline/);
    });
});
