import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { IsAChargeTransparencyRecord, readOCMFSessionPriceContext, verifyOCMFPriceStart, compareOCMFPriceRates } from '@open-charging-cloud/chargy-core';
import { parseJSON, parseSessionPriceEvidence, parseHistoricalMeterEvidence, HISTORICAL_METER_EVIDENCE_CONTEXT, SESSION_PRICE_EVIDENCE_CONTEXT, prettyJSON } from '@open-charging-cloud/wwcp-poi';
import { readSessionPOIEvidence, exportSessionPOIEvidence } from '../src/ts/sessionPOIData';
import {TestPOITrustService as POITrustService} from './poiTestService';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import { loadSessionPriceEvidence } from '../src/ts/sessionPriceData';
import { verifyChargeData, createVerificationChargy } from './testHelper';
import type { IChargingSession, Chargy, IOCMFSessionPriceContext } from '@open-charging-cloud/chargy-core';
import type { SessionPriceEvidence } from '@open-charging-cloud/wwcp-poi';
import type { StoredTrustAnchor } from '../src/ts/trustStore';

const fixture=(name:string):string=>readFileSync(new URL(`./fixtures/POIPrices/${name}.chargy`,import.meta.url),'utf8');
const now=Date.parse('2026-11-01T00:16:21Z');
async function setup(name:string='session-with-price'):Promise<{
    source:ReturnType<typeof readSessionPOIEvidence>[number];service:POITrustService;subject:IOCMFSessionPriceContext;
    session:IChargingSession;chargy:Chargy;priceEvidence:SessionPriceEvidence;policyId:string;record:StoredTrustAnchor;
    snapshot:ReturnType<typeof vi.fn>;check:()=>ReturnType<POITrustService['verifySessionPriceEvidence']>;
}> {
    const text=fixture(name),source=readSessionPOIEvidence(text)[0];
    if(source?.bootstrap===undefined||source.priceEvidence===undefined)throw new Error('Missing price fixture');
    const {anchor,document}=source.bootstrap,policyId=trustAnchorStorageId(anchor);
    const record:StoredTrustAnchor={id:policyId,qrCode:anchor.toQRCode(),sourceText:anchor.toQRCode(),importedAt:new Date(now).toISOString(),downloadedData:document,
        trustedKeys:anchor.keys.map(id=>({id,acceptedAt:new Date(now).toISOString()}))};
    const snapshot=vi.fn().mockResolvedValue({record,deleted:new Set<string>()});
    const service=new POITrustService({trustSnapshot:snapshot},[],()=>now);
    const parsed=await verifyChargeData(name+'.chargy',text);
    if(!IsAChargeTransparencyRecord(parsed)||parsed.chargingSessions?.[0]===undefined)throw new Error('Missing original readings');
    const session=parsed.chargingSessions[0],chargy=createVerificationChargy(),subject=await readOCMFSessionPriceContext(chargy,session);
    const priceEvidence=parseSessionPriceEvidence(parseJSON(source.priceEvidence));
    const related=source.historicalEvidence===undefined?[]:parseHistoricalMeterEvidence(parseJSON(source.historicalEvidence)).versions.flatMap(version=>version.checkpoints);
    const check=async():ReturnType<POITrustService['verifySessionPriceEvidence']>=>service.verifySessionPriceEvidence(policyId,parseJSON(source.priceEvidence??'null'),subject,related);
    return {source,service,subject,session,chargy,priceEvidence,policyId,record,snapshot,check};
}

describe('Session-bound price evidence',()=>{
    test.each(['session-with-price','pqc-price','decimal-price'])('%s verifies real CPO signatures, historical start and checkpoint independently',async name=>{
        const example=await setup(name),{price}=await example.check();
        expect(price.signatures).toBe('valid');expect(price.applicability).toBe('bound');expect(price.publication).toBe('valid');
        expect(price.customerConsent).toBe('not-proven');expect(price.publicationBeforeStart).toBe('not-proven');expect(price.latestOrSoleOffer).toBe('not-proven');
        // Witness names supplied in a proof never authorize that witness themselves.
        expect(price.witnessedBy).toEqual([]);
        const meter=await example.service.verifyHistoricalMeterEvidence(example.policyId,{
            '@context':HISTORICAL_METER_EVIDENCE_CONTEXT,EVSEId:example.source.evseId,versions:[{chargingStationProof:example.priceEvidence.proof}]
        },{evseId:example.source.evseId,meterSerialNumber:example.subject.meterSerialNumber,measurementTimes:[example.subject.chargingStarted],keyFormat:'spki-der'});
        const binding=meter.evidence.bindings[0];if(binding===undefined)throw new Error('Missing meter key');
        const start=await verifyOCMFPriceStart(example.chargy,example.session,example.subject,binding,{now:()=>now});
        expect(start.status).toBe('verified');expect(start.signatureCount).toBe(1);
        expect(compareOCMFPriceRates(example.subject,price.selected?.rates).status).toBe('rates-match');
        expect(Date.parse(example.session.end??'')).toBeGreaterThan(Date.parse(typeof price.selected?.statement['validUntil']==='string'?price.selected.statement['validUntil']:''));
        if(name==='decimal-price')expect(price.selected?.rates?.energyPerKWh).toBe('0.3500');
        if(name==='pqc-price')expect(price.selected?.statement['algorithm']).toBe('ML-DSA-65');
    });
    test.each([
        ['empty-prices','missing','missing'],['missing-agreement','valid','unbound'],['invalid-signature','invalid','invalid'],
        ['wrong-evse','valid','invalid'],['expired-price','valid','missing'],['foreign-tariff','valid','invalid'],['unauthorized-key','invalid','invalid'],
        ['wrong-session','valid','invalid'],['contract-mode','valid','unsupported'],['variable-binding','valid','unsupported'],
        ['split-price-chain','valid','invalid'],['broken-price-chain','valid','invalid'],['ambiguous-offers','valid','ambiguous'],['conditional-price','valid','unsupported']
    ])('%s cannot assert a fully verified session price',async(name,signatures,applicability)=>{
        const {price}=await(await setup(name)).check();expect(price.signatures).toBe(signatures);expect(price.applicability).toBe(applicability);
    });
    test.each([['missing-publication','missing'],['tampered-publication','invalid'],['checkpoint-fork','invalid']])('%s leaves publication separate from a genuine assignment',async(name,publication)=>{
        const {price}=await(await setup(name)).check();expect(price.signatures).toBe('valid');expect(price.applicability).toBe('bound');expect(price.publication).toBe(publication);
    });
    test('genuinely signed rate conflict is visible despite a valid assignment',async()=>{
        const example=await setup('signed-rate-conflict'),{price}=await example.check();
        expect(price.applicability).toBe('bound');expect(compareOCMFPriceRates(example.subject,price.selected?.rates).status).toBe('conflict');
    });
    test('export preserves exact signed price text and audit metadata grants no local authorization',async()=>{
        const example=await setup('decimal-price'),exported=exportSessionPOIEvidence(example.source);
        expect(exported['priceEvidence']).toBe(example.source.priceEvidence);
        const imported=readSessionPOIEvidence(JSON.stringify({poiEvidence:{...exported,archiveAudit:'{"trusted":true}'}}))[0];
        expect(imported?.priceEvidence).toBe(example.source.priceEvidence);expect(imported?.priceSource?.origin).toBe('embedded');
        example.snapshot.mockResolvedValue({record:undefined,deleted:new Set<string>()});
        await expect(example.check()).rejects.toThrow();
    });
});

describe('Explicit bounded price retrieval',()=>{
    const evse='DE*POI*E1*1',signal=():AbortSignal=>new AbortController().signal;
    test('uses supplied saved-anchor sources, verifies mirrors and retains exact decimals',async()=>{
        const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('[{"price":0.3500}]'));
        fetcher.mockImplementation(async()=>Promise.resolve(new Response('[{"price":0.3500}]')));
        let checks=0;
        const result=await loadSessionPriceEvidence(['https://first.example/poi','https://second.example/poi'],evse,{original:true},async document=>{
            if(checks++===0)throw new Error('Unusable signature');return Promise.resolve(document);
        },{signal:signal(),fetch:fetcher});
        expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['https://first.example/poi/EVSEs/DE*POI*E1*1/priceStatements','https://second.example/poi/EVSEs/DE*POI*E1*1/priceStatements']);
        expect(fetcher.mock.calls[0]?.[1]).toMatchObject({redirect:'error',credentials:'omit',cache:'no-store'});
        expect(result.origin).toBe('network');expect(result.text).toContain('0.3500');
        expect(parseJSON(result.text)).toMatchObject({'@context':SESSION_PRICE_EVIDENCE_CONTEXT,EVSEId:evse,chargingStationProof:{original:true}});
    });
    test('retains a complete envelope instead of discarding its assignment and checkpoint',async()=>{
        const example=await setup(),text=example.source.priceEvidence??'null';
        const result=await loadSessionPriceEvidence(['https://price.example'],evse,null,async document=>Promise.resolve(document),{signal:signal(),fetch:vi.fn<typeof fetch>().mockResolvedValue(new Response(text))});
        expect(result.text).toBe(prettyJSON(parseJSON(text)));
    });
    test.each(['http://price.example','https://user:password@price.example','https://127.0.0.1'])('blocks disallowed source %s before fetching',async url=>{
        const fetcher=vi.fn<typeof fetch>();await expect(loadSessionPriceEvidence([url],evse,null,async value=>Promise.resolve(value),{signal:signal(),fetch:fetcher})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
    });
    test('bounds response size before parsing and rejects absent or invalid evidence',async()=>{
        const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('{}',{headers:{'content-length':String(3*1024*1024)}}));
        const verify=vi.fn(async()=>Promise.resolve(true));await expect(loadSessionPriceEvidence(['https://price.example'],evse,null,verify,{signal:signal(),fetch:fetcher})).rejects.toThrow(/limit/);expect(verify).not.toHaveBeenCalled();
        await expect(loadSessionPriceEvidence([],evse,null,verify,{signal:signal(),fetch:fetcher})).rejects.toThrow();
    });
    test('cancellation and whole-operation deadline reject results during asynchronous verification',async()=>{
        const controller=new AbortController();controller.abort();const fetcher=vi.fn<typeof fetch>();
        await expect(loadSessionPriceEvidence(['https://price.example'],evse,null,async value=>Promise.resolve(value),{signal:controller.signal,fetch:fetcher})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
        fetcher.mockResolvedValue(new Response('[]'));
        await expect(loadSessionPriceEvidence(['https://price.example'],evse,null,async()=>{await new Promise(resolve=>setTimeout(resolve,20));return true;},{signal:signal(),fetch:fetcher,totalTimeoutMs:5})).rejects.toThrow(/deadline/);
    });
});
