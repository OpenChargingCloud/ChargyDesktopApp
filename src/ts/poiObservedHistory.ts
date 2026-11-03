import {Checkpoint,checkpointVersionObservation,parseJSON,applyVerifiedTrustTransition,compareObservedVersions,emptyObservedVersions,observedVersionsChecksum} from '@open-charging-cloud/wwcp-poi';
import type {VerifiedTrustTransition,JSONValue,ObservedVersions,VersionObservation,VersionComparison} from '@open-charging-cloud/wwcp-poi';

export const observedHistoryDatabase='ChargyPOIObservedHistory';
export interface ObservationScope {readonly id:string;readonly policyId:string;readonly roamingNetworkId:string;readonly operatorId:string;}
export interface StoredObservedHistory extends ObservationScope {
    readonly generation:string;readonly updatedAt:number;readonly state:ObservedVersions;
    /** Public source evidence for reopening live data; never restored as local permission. */
    readonly liveEvidence:Readonly<Record<string,string>>;readonly checksum:string;
}
export interface ObservedHistoryRepository {
    begin(scope:ObservationScope):Promise<StoredObservedHistory>;
    transition(scope:ObservationScope,generation:string,verified:VerifiedTrustTransition,at:number):Promise<VersionComparison>;
    observe(scope:ObservationScope,generation:string,points:readonly VersionObservation[],mode:'current'|'historical',at:number,
        live?:{readonly chain:string;readonly evidence:string},signal?:AbortSignal):Promise<VersionComparison>;
}
function checked(value:unknown):StoredObservedHistory {
    if(value===null||typeof value!=='object')throw new Error('Invalid stored version history');
    const raw=value as Record<string,unknown>,state=raw['state'];
    if(state===null||typeof state!=='object'||!('version' in state)||state.version!==1)throw new Error('Invalid stored history schema');
    const record=value as StoredObservedHistory;
    const {checksum,...body}=record;
    if(typeof record.id!=='string'||typeof record.policyId!=='string'||typeof record.roamingNetworkId!=='string'||typeof record.operatorId!=='string'||
        typeof record.generation!=='string'||!Number.isFinite(record.updatedAt)||
        checksum!==observedVersionsChecksum(body as unknown as JSONValue))throw new Error('Stored version history integrity check failed');
    if(record.state.points.some(point=>point.kind==='checkpoint'&&point.rootDigest===undefined))return seal({...record,state:{...record.state,points:record.state.points.map(point=>
        point.kind==='checkpoint'&&point.rootDigest===undefined?checkpointVersionObservation(Checkpoint.parse(parseJSON(point.original))):point)}});
    return record;
}
function seal(input:Omit<StoredObservedHistory,'checksum'>):StoredObservedHistory {
    const {checksum:_old,...body}=input as Omit<StoredObservedHistory,'checksum'>&{checksum?:string};
    if(new TextEncoder().encode(JSON.stringify(body)).length>16*1024*1024)throw new Error('Local version history capacity reached');
    return {...body,checksum:observedVersionsChecksum(body as unknown as JSONValue)};
}
function empty(scope:ObservationScope):StoredObservedHistory {
    return seal({...scope,generation:crypto.randomUUID(),updatedAt:Date.now(),state:emptyObservedVersions(),liveEvidence:{}});
}
function apply(record:StoredObservedHistory,scope:ObservationScope,generation:string,points:readonly VersionObservation[],mode:'current'|'historical',at:number,
    live?:{readonly chain:string;readonly evidence:string}):{record:StoredObservedHistory;comparison:VersionComparison} {
    if(record.id!==scope.id||record.policyId!==scope.policyId||record.roamingNetworkId!==scope.roamingNetworkId||record.operatorId!==scope.operatorId||record.generation!==generation)
        throw new Error('Local version-history scope changed or was reset during verification');
    const comparison=compareObservedVersions(record.state,points,mode,at);
    const liveEvidence={...record.liveEvidence};
    if(comparison.accepted&&mode==='current'&&live!==undefined)liveEvidence[live.chain]=live.evidence;
    return {record:seal({...record,state:comparison.state,updatedAt:at,liveEvidence}),comparison};
}
let connection:Promise<IDBDatabase>|undefined;
let channel:BroadcastChannel|undefined;
function notifyReset():void {
    if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('chargy-poi-history-reset'));
}
function resetChannel():void {
    if(channel===undefined&&typeof window!=='undefined'&&typeof window.addEventListener==='function'&&typeof BroadcastChannel!=='undefined'){
        channel=new BroadcastChannel('chargy-poi-history');channel.onmessage=(event:MessageEvent<unknown>):void=>{if(event.data==='reset')notifyReset();if(event.data==='policy-change')notifyPolicyChange();if(event.data==='witness-change')notifyWitnessChange();
            // A message only invalidates local work. It carries no trusted state or verdict.
            if(event.data!==null&&typeof event.data==='object'&&'type' in event.data&&event.data.type==='observations')
                window.dispatchEvent(new Event('chargy-poi-observations-changed'));
        };
    }
}
function notifyPolicyChange():void{if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('chargy-poi-policy-change'));}
export function broadcastTrustPolicyChange():void{resetChannel();notifyPolicyChange();channel?.postMessage('policy-change');}
function notifyWitnessChange():void{if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('chargy-poi-witness-change'));}
export function broadcastWitnessPolicyChange():void{resetChannel();notifyWitnessChange();channel?.postMessage('witness-change');}
export class POIObservedHistoryStore implements ObservedHistoryRepository {
    public async transition(scope:ObservationScope,generation:string,verified:VerifiedTrustTransition,at:number):Promise<VersionComparison>{
        const result=await this.transaction<{report:VersionComparison;changed:boolean}>('readwrite',(store,done,fail)=>{const request=store.get(scope.id);request.onsuccess=():void=>{try{
            const record=checked(request.result);apply(record,scope,generation,[],'historical',at);
            const report=applyVerifiedTrustTransition(record.state,verified,at);
            store.put(seal({...record,state:report.state,updatedAt:at}));done({report,changed:JSON.stringify(record.state)!==JSON.stringify(report.state)});
        }catch(error){fail(error);}};});
        if(result.changed)channel?.postMessage({type:'observations',scopeId:scope.id});
        return result.report;
    }
    private async open():Promise<IDBDatabase> {
        resetChannel();
        connection??=new Promise<IDBDatabase>((resolve,reject)=>{
            if(typeof indexedDB==='undefined'){reject(new Error('Persistent version history unavailable'));return;}
            const request=indexedDB.open(observedHistoryDatabase,1);let blocked=false;
            request.onupgradeneeded=():void=>{request.result.createObjectStore('scopes',{keyPath:'id'});};
            request.onblocked=():void=>{blocked=true;reject(new Error('Version history storage blocked by another tab'));};
            request.onerror=():void=>{reject(request.error??new Error('Version history storage unavailable'));};
            request.onsuccess=():void=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=():void=>{db.close();connection=undefined;};db.onclose=():void=>{connection=undefined;};resolve(db);};
        }).catch((error:unknown)=>{connection=undefined;throw error;});
        return connection;
    }
    private async transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,done:(value:T)=>void,fail:(error:unknown)=>void)=>void,signal?:AbortSignal):Promise<T> {
        const db=await this.open();signal?.throwIfAborted();
        return new Promise<T>((resolve,reject)=>{
            const tx=db.transaction('scopes',mode);let answer:{value:T}|undefined;let failure:unknown;
            const abort=():void=>{try{tx.abort();}catch{/* Completed. */}};
            const fail=(error:unknown):void=>{failure=error;abort();};signal?.addEventListener('abort',abort,{once:true});
            tx.oncomplete=():void=>{signal?.removeEventListener('abort',abort);if(answer===undefined)reject(new Error('Version history returned no result'));else resolve(answer.value);};
            tx.onabort=():void=>{signal?.removeEventListener('abort',abort);reject(failure instanceof Error?failure:tx.error??new Error('Version history operation cancelled'));};
            try{run(tx.objectStore('scopes'),value=>{answer={value};},fail);}catch(error){fail(error);}
        });
    }
    public async begin(scope:ObservationScope):Promise<StoredObservedHistory> {
        return this.transaction('readwrite',(store,done,fail)=>{
            const request=store.get(scope.id);request.onsuccess=():void=>{try{const record=request.result===undefined?empty(scope):checked(request.result);if(request.result===undefined)store.put(record);done(record);}catch(error){fail(error);}};
        });
    }
    public async observe(scope:ObservationScope,generation:string,points:readonly VersionObservation[],mode:'current'|'historical',at:number,
        live?:{readonly chain:string;readonly evidence:string},signal?:AbortSignal):Promise<VersionComparison> {
        const result=await this.transaction<{report:VersionComparison;changed:boolean}>('readwrite',(store,done,fail)=>{
            const request=store.get(scope.id);request.onsuccess=():void=>{try{
                const before=checked(request.result),result=apply(before,scope,generation,points,mode,at,live);
                // Include newly supplied links and succession, not timestamps/live audit exports.
                const changed=JSON.stringify(before.state)!==JSON.stringify(result.record.state);
                store.put(result.record);done({report:result.comparison,changed});
            }catch(error){fail(error);}};
        },signal);
        // Only other documents receive the hint, after commit. Identical rechecks cannot echo.
        if(result.changed)channel?.postMessage({type:'observations',scopeId:scope.id});
        return result.report;
    }
    public async list():Promise<readonly StoredObservedHistory[]> {
        return this.transaction('readonly',(store,done,fail)=>{const request=store.getAll();request.onsuccess=():void=>{try{done((request.result as unknown[]).map(checked));}catch(error){fail(error);}};});
    }
    public async reset(id:string):Promise<void> {
        await this.transaction<true>('readwrite',(store,done,fail)=>{const request=store.get(id);request.onsuccess=():void=>{try{const record=checked(request.result);store.put(empty(record));done(true);}catch(error){fail(error);}};});
        notifyReset();channel?.postMessage('reset');
    }
}

/** Explicit test repository with the same comparison rules; production never falls back to memory. */
export class MemoryPOIObservedHistory implements ObservedHistoryRepository {
    private readonly records=new Map<string,StoredObservedHistory>();
    public async transition(scope:ObservationScope,generation:string,verified:VerifiedTrustTransition,at:number):Promise<VersionComparison>{
        const record=checked(this.records.get(scope.id));apply(record,scope,generation,[],'historical',at);
        const report=applyVerifiedTrustTransition(record.state,verified,at);this.records.set(scope.id,seal({...record,state:report.state,updatedAt:at}));return Promise.resolve(report);
    }
    public async begin(scope:ObservationScope):Promise<StoredObservedHistory> {const record=this.records.get(scope.id)??empty(scope);this.records.set(scope.id,record);return Promise.resolve(record);}
    public async observe(scope:ObservationScope,generation:string,points:readonly VersionObservation[],mode:'current'|'historical',at:number,
        live?:{readonly chain:string;readonly evidence:string},signal?:AbortSignal):Promise<VersionComparison> {
        signal?.throwIfAborted();const result=apply(checked(this.records.get(scope.id)),scope,generation,points,mode,at,live);this.records.set(scope.id,result.record);return Promise.resolve(result.comparison);
    }
}
