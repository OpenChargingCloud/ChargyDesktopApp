import {verifyLiveSessionAuthority,readLiveSessionDocument,verifyLiveSessionTransition,verifyHistoricalOCMFSession,readOCMFSessionPriceContext,compareOCMFPriceRates,collectDocumentPublicKeys,verifyDocumentSignaturesWithKeys} from '@open-charging-cloud/chargy-core';
import type {Chargy,IChargingSession,ChargyInterfaces} from '@open-charging-cloud/chargy-core';
import {prettyJSON,isObject,compareObservedVersions,toHex,hash,parseJSON,canonicalJSONBytes,HISTORICAL_METER_EVIDENCE_CONTEXT,parseHistoricalMeterEvidence} from '@open-charging-cloud/wwcp-poi';
import type {VersionObservation,SessionPriceVerification} from '@open-charging-cloud/wwcp-poi';
import type {SessionPOIEvidence} from './sessionPOIData';
import {exportSessionPOIEvidence,readSessionPOIEvidence} from './sessionPOIData';
import {trustAnchorStorageId} from './trustStore';
import type {POITrustService} from './poiTrustContext';

export interface LivePOIState {
    readonly id:string;readonly evseId:string;readonly meterSerialNumber:string;
    readonly originals:readonly string[];readonly readingCount:number;readonly priceChanged:boolean;
    readonly authorityProofs:readonly (string|undefined)[];
    evidence:readonly SessionPOIEvidence[];
    policyId:string;
    /** Remembers the selected fixed version, never an authorization lease. */
    pricePinned:boolean;
    expectedHistoryGeneration?:string;
}
export interface LivePOICheck {readonly stage:'waiting'|'start'|'charging'|'complete';readonly readingCount:number;readonly price?:SessionPriceVerification;readonly cpo:{readonly operatorId:string;readonly documents:number;readonly keyIds:readonly string[]};}
export function originalLiveInput(input:string|ChargyInterfaces.IFileInfo|readonly ChargyInterfaces.IFileInfo[]):string|undefined {
    const files:readonly (string|ChargyInterfaces.IFileInfo)[]=typeof input==='string'?[input]:Array.isArray(input)?input as readonly ChargyInterfaces.IFileInfo[]:[input as ChargyInterfaces.IFileInfo];
    for(const file of files){
        const text=typeof file==='string'?file:file.data===undefined?undefined:new TextDecoder('utf-8',{fatal:true}).decode(file.data);
        if(text?.trimStart().startsWith('{')!==true)continue;
        let parsed:unknown;try{parsed=JSON.parse(text) as unknown;}catch{continue;}
        if(parsed!==null&&typeof parsed==='object'&&(parsed as Record<string,unknown>)['@context']==='https://open.charging.cloud/contexts/chargeTransparency/live/link/1.0')return text;
    }
    return undefined;
}
function sameJSON(left:string,right:string):boolean {
    return new TextDecoder().decode(canonicalJSONBytes(parseJSON(left)))===new TextDecoder().decode(canonicalJSONBytes(parseJSON(right)));
}
function sameSelectedPrice(left:string,right:string):boolean {
    const content=(text:string):string=>{const json=parseJSON(text);if(!isObject(json))throw new Error('Invalid pinned price evidence');const {publicationReceipts:_,witnessCandidates:__,...price}=json;return prettyJSON(price);};
    return sameJSON(content(left),content(right));
}
function liveObservation(original:string,pinned?:VersionObservation):VersionObservation {
    const parsed=readLiveSessionDocument(original),json=parsed.json,cpo=json['chargingStationOperator'] as Record<string,unknown>;
    const signatures=json['signatures'] as {keyId:string}[];
    const immutable=(value:ReturnType<typeof readLiveSessionDocument>):string=>JSON.stringify([value.id,value.evseId,value.meterSerialNumber,(value.json['chargingStationOperator'] as Record<string,unknown>)['@id'],value.json['created'],value.json['chargingSessionId']]);
    const identity=pinned?.identity!==undefined&&immutable(readLiveSessionDocument(pinned.original))===immutable(parsed)?pinned.identity:toHex(hash('sha256',canonicalJSONBytes({evseId:parsed.evseId,meter:parsed.meterSerialNumber,cpo:cpo['@id'] as string,
        created:typeof json['created']==='string'?json['created']:null,sessionId:typeof json['chargingSessionId']==='string'?json['chargingSessionId']:null,keys:signatures.map(item=>item.keyId.toLowerCase()).sort()})));
    return {kind:'live',chain:parsed.id,epoch:'',position:Date.parse(typeof json['lastUpdated']==='string'?json['lastUpdated']:''),digest:parsed.reference,identity,
        ...(typeof json['updates']==='string'?{previous:json['updates'].toLowerCase()}:{}),original};
}
/** Retain equivocation even when continuity rejects the candidate before meter parsing. Never advance the accepted live head. */
export async function observeRejectedLiveCandidate(service:POITrustService,state:LivePOIState,text:string,signal:AbortSignal):Promise<void> {
    if(state.policyId==='')return;
    const ticket=await service.beginObservations(state.policyId,true,signal),head=ticket.observed.heads[JSON.stringify(['live',state.id])];
    const pinned=ticket.observed.points.find(point=>point.kind==='live'&&point.chain===state.id&&point.digest===head?.digest);
    if(pinned===undefined)return;
    const previous=readLiveSessionDocument(pinned.original),incoming=readLiveSessionDocument(text);
    if(incoming.id!==state.id)return;
    // A self-signed replacement key must never poison the journal. Authenticate with previously accepted keys.
    const keys=collectDocumentPublicKeys({chargingStationOperator:previous.json['chargingStationOperator']}).filter(key=>key.keyUsage.includes('signCTRs'));
    if(verifyDocumentSignaturesWithKeys(incoming.json,keys).status!=='allValid')return;
    const point=liveObservation(text,pinned),comparison=compareObservedVersions(ticket.observed,[point],'historical',ticket.context.evaluatedAt);
    if(comparison.issues.some(issue=>['fork','identity','link'].includes(issue.code)))await service.recordObservations(ticket,[point],'historical',{signal});
}
/** Merge evidence by field. An omitted block never removes the selected original fixed-price evidence. */
export function prepareLivePOIState(text:string,incoming:readonly SessionPOIEvidence[],previous?:LivePOIState,now:number=Date.now()):LivePOIState {
    const parsed=previous===undefined?readLiveSessionDocument(text,now):verifyLiveSessionTransition(previous.originals.at(-1)??'',text,now,{structureOnly:true});
    if(previous!==undefined&&(previous.id!==parsed.id||previous.evseId!==parsed.evseId))throw new Error('Live POI identity changed');
    if(incoming.length>1||incoming.some(item=>item.error!==undefined||item.evseId!==parsed.evseId))throw new Error('Invalid or competing live POI evidence');
    const old=previous?.evidence[0],next=incoming[0];let priceChanged=previous?.priceChanged??false;
    if(old?.bootstrap!==undefined&&next?.bootstrap!==undefined&&trustAnchorStorageId(old.bootstrap.anchor)!==trustAnchorStorageId(next.bootstrap.anchor))throw new Error('Live trust policy changed');
    if(old?.historicalEvidence!==undefined&&next?.historicalEvidence!==undefined&&!sameJSON(old.historicalEvidence,next.historicalEvidence)){
        const before=parseHistoricalMeterEvidence(parseJSON(old.historicalEvidence)),after=parseHistoricalMeterEvidence(parseJSON(next.historicalEvidence));
        const normalized=(version:typeof before.versions[number]):string=>prettyJSON({chargingStationProof:version.proof,...(version.commitProof===undefined?{}:{commitProof:version.commitProof}),checkpoints:version.checkpoints.map(entry=>({checkpoint:entry.checkpoint,operator:entry.operator}))});
        if(after.evseId!==before.evseId||after.versions.length<before.versions.length||before.versions.some((version,index)=>after.versions[index]===undefined||!sameJSON(normalized(version),normalized(after.versions[index]))))throw new Error('Historical station evidence must retain every previous original version');
    }
    if(previous?.pricePinned===true&&old?.priceEvidence!==undefined&&next?.priceEvidence!==undefined&&!sameSelectedPrice(old.priceEvidence,next.priceEvidence))priceChanged=true;
    const originals=[...(previous?.originals??[]),text];
    if(new TextEncoder().encode(JSON.stringify(originals)).length>4*1024*1024)throw new Error('Live evidence archive limit reached; original history was retained');
    const merged:SessionPOIEvidence|undefined=old===undefined?next:next===undefined?old:{...old,...next,
        ...(old.bootstrap===undefined?{}:{bootstrap:old.bootstrap}),
        ...(previous?.pricePinned!==true||old.priceEvidence===undefined?{}:{priceEvidence:old.priceEvidence,priceSource:old.priceSource})};
    if(merged===undefined)throw new Error('No live POI evidence');
    return {id:parsed.id,evseId:parsed.evseId,meterSerialNumber:parsed.meterSerialNumber,originals,authorityProofs:[...previous?.authorityProofs??[],next?.document?.text??old?.document?.text],readingCount:parsed.readings.length,priceChanged,
        policyId:previous?.policyId??'',pricePinned:previous?.pricePinned??false,evidence:[{...merged,liveDocuments:originals}]};
}

/** UI/download orchestration only; the shared libraries authenticate every original document and price. */
export async function checkLivePOISession(chargy:Chargy,service:POITrustService,state:LivePOIState,session:IChargingSession|undefined,signal:AbortSignal):Promise<LivePOICheck> {
    if(state.policyId==='')throw new Error('Select and authorize a local trust policy before accepting POI live updates');
    const evidence=state.evidence[0];if(evidence===undefined)throw new Error('Missing live evidence');
    const ticket=await service.beginObservations(state.policyId,true,signal),before=ticket.context;
    if(state.expectedHistoryGeneration!==undefined&&state.expectedHistoryGeneration!==ticket.generation)throw new Error('Version history was reset before reopening');signal.throwIfAborted();
    const knownHead=ticket.observed.heads[JSON.stringify(['live',state.id])],known=ticket.observed.points.find(point=>point.kind==='live'&&point.chain===state.id&&point.digest===knownHead?.digest);
    if(known!==undefined&&!state.originals.some(original=>readLiveSessionDocument(original).reference===known.digest)&&Date.parse(String(readLiveSessionDocument(state.originals.at(-1)??'').json['lastUpdated']))>known.position)
        throw new Error('Reopen the last observed live originals before continuing this known session; its selected fixed price must be retained');
    const cpoKeys=new Set<string>();let operatorId='';
    for(const [index,original]of state.originals.entries()){
        const parsed=readLiveSessionDocument(original),cpo=parsed.json['chargingStationOperator'] as Record<string,unknown>,proof=state.authorityProofs[index]??evidence.document?.text;
        if(proof===undefined||typeof cpo['@id']!=='string')throw new Error('A station proof is required to authorize the live envelope CPO');
        const authority=await service.verifyLiveDocumentKeys(state.policyId,parseJSON(proof),{evseId:state.evseId,operatorId:cpo['@id'],at:Date.parse(String(parsed.json['lastUpdated']))},signal);
        verifyLiveSessionAuthority(original,authority,state.originals[index-1]);operatorId=authority.operatorId;for(const key of authority.keys)cpoKeys.add(key.id);
    }
    let price:SessionPriceVerification|undefined,publicationPolicyRevision:string|undefined,stage:LivePOICheck['stage']='waiting';
    if(session===undefined){
        if(state.readingCount!==0||evidence.document===undefined)throw new Error('No usable station proof for live preparation');
        await service.verifyMeterKey(state.policyId,parseJSON(evidence.document.text),{evseId:state.evseId,meterSerialNumber:state.meterSerialNumber,keyFormat:'spki-der'},signal);
    }else{
        if(session.EVSEId!==state.evseId)throw new Error('Original reading EVSE differs from the live link');
        const subject=await readOCMFSessionPriceContext(chargy,session);
        if(subject.meterSerialNumber!==state.meterSerialNumber)throw new Error('Original reading meter differs from the live link');
        const material=evidence.historicalEvidence===undefined?{'@context':HISTORICAL_METER_EVIDENCE_CONTEXT,EVSEId:state.evseId,versions:[{chargingStationProof:parseJSON(evidence.document?.text??'null') }]}:parseJSON(evidence.historicalEvidence);
        const times=(session.measurements??[]).flatMap(measurement=>measurement.values.map(value=>Date.parse(value.timestamp)));
        const historical=await service.verifyHistoricalMeterEvidence(state.policyId,material,{evseId:state.evseId,meterSerialNumber:state.meterSerialNumber,measurementTimes:times,keyFormat:'spki-der'},signal);
        if(!historical.consistency.accepted)throw new Error('Historical evidence contradicts locally observed versions');
        const readings=await verifyHistoricalOCMFSession(chargy,session,historical.evidence.bindings,{signal});
        if(readings.status!=='verified'||!readings.signaturesValid||readings.signatureCount!==state.readingCount)throw new Error('An original live reading or its historical meter-key association is not valid');
        if(evidence.priceEvidence!==undefined){
            const related=parseHistoricalMeterEvidence(material).versions.flatMap(version=>version.checkpoints);
            const priced=await service.verifySessionPriceEvidence(state.policyId,parseJSON(evidence.priceEvidence),subject,related,signal);
            publicationPolicyRevision=priced.publicationPolicyRevision;
            if(!priced.consistency.accepted)throw new Error('Price evidence contradicts locally observed versions');price=priced.price;
            if(price.signatures!=='valid'||price.applicability!=='bound'||price.publication==='invalid')throw new Error('The fixed session price could not be verified');
            const rates=compareOCMFPriceRates({...subject,tariffTexts:subject.allTariffTexts??subject.tariffTexts},price.selected?.rates);
            if(rates.status!=='rates-match')throw new Error('A signed live tariff text conflicts with the selected fixed gross rates or needs another profile');
        }
        const transactions=readings.checks.flatMap(check=>(check.record?.chargingSessions??[]).flatMap(item=>(item.measurements??[]).flatMap(measurement=>measurement.values.map(value=>(value as {transaction?:string}).transaction))));
        stage=transactions.includes('E')?'complete':state.readingCount===1?'start':'charging';
    }
    const after=await service.resolveHistorical(state.policyId);signal.throwIfAborted();
    if(before.keyStatementDigest!==after.keyStatementDigest||before.requiredConsensus!==after.requiredConsensus||JSON.stringify(before.authorizedHolders)!==JSON.stringify(after.authorizedHolders)||after.evaluatedAt>before.validUntil)throw new Error('Live authorization changed during verification');
    const pin=ticket.observed.points.find(point=>point.kind==='live'&&point.chain===state.id)??liveObservation(state.originals[0]??'');
    const points=state.originals.map(original=>liveObservation(original,pin));
    const {liveDocuments:_,...snapshot}=evidence;
    const report=await service.recordObservations(ticket,points,'current',{signal,live:{chain:state.id,evidence:JSON.stringify(exportSessionPOIEvidence(snapshot))}});
    if(!report.accepted)throw new Error('Local live-version history rejected: '+report.issues.map(issue=>issue.code+': '+issue.detail).join('; '));
    if(publicationPolicyRevision!==undefined)await service.assertPublicationPolicy(publicationPolicyRevision);signal.throwIfAborted();
    if(price?.applicability==='bound')state.pricePinned=true;
    return {stage,readingCount:state.readingCount,cpo:{operatorId,documents:state.originals.length,keyIds:[...cpoKeys]},...(price===undefined?{}:{price})};
}

/** Restore public evidence and revalidate the original chain; local key permission is supplied afresh by the caller. */
export function restoreObservedLive(originals:readonly string[],evidenceText:string,policyId:string):LivePOIState {
    const source=readSessionPOIEvidence(JSON.stringify({poiEvidence:JSON.parse(evidenceText) as unknown}));
    let state:LivePOIState|undefined,priceChanged=false;const selected=source[0]?.priceEvidence;
    for(const original of originals){
        const own=readSessionPOIEvidence(original);
        if((state?.readingCount??0)>0&&selected!==undefined&&own[0]?.priceEvidence!==undefined&&!sameSelectedPrice(selected,own[0].priceEvidence))priceChanged=true;
        state=prepareLivePOIState(original,state===undefined&&own.length===0?source:own,state);
    }
    if(state===undefined)throw new Error('No saved live originals');return {...state,evidence:source,policyId,priceChanged:state.priceChanged||priceChanged};
}
