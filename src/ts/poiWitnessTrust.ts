import {parseJSON,prettyJSON,parseWitnessPublicationPolicy,canonicalJSONBytes,hash,toHex} from '@open-charging-cloud/wwcp-poi';
import type {JSONValue,WitnessPublicationPolicy} from '@open-charging-cloud/wwcp-poi';
import bundledPolicy from '../trust/publication-witness-policy.json';
import {broadcastWitnessPolicyChange} from './poiObservedHistory';

export const witnessTrustDatabase='ChargyPOIWitnessTrust';
const bundledText=prettyJSON(bundledPolicy);
export interface WitnessPolicySnapshot {readonly revision:string;readonly text:string;readonly policy:WitnessPublicationPolicy;}
export interface WitnessPolicyRepository {snapshot():Promise<WitnessPolicySnapshot>;}
export function witnessPolicySnapshot(text:string,revision?:string):WitnessPolicySnapshot {
    if(new TextEncoder().encode(text).length>1024*1024)throw new Error('Witness policy exceeds 1 MiB');
    const policy=parseWitnessPublicationPolicy(parseJSON(text));
    return {revision:revision??'bundled:'+toHex(hash('sha256',canonicalJSONBytes(policy.json))),text,policy};
}
let connection:Promise<IDBDatabase>|undefined;
/** Explicit local role/time decisions. Evidence imports and RNO recommendations never write here. */
export class POIWitnessTrustStore implements WitnessPolicyRepository {
    private async open():Promise<IDBDatabase> {
        connection??=new Promise<IDBDatabase>((resolve,reject)=>{
            if(typeof indexedDB==='undefined'){reject(new Error('Persistent witness trust unavailable'));return;}
            const request=indexedDB.open(witnessTrustDatabase,1);let blocked=false;
            request.onupgradeneeded=():void=>{request.result.createObjectStore('configuration',{keyPath:'id'});};
            request.onblocked=():void=>{blocked=true;reject(new Error('Witness trust storage blocked'));};
            request.onerror=():void=>{reject(request.error??new Error('Witness trust storage unavailable'));};
            request.onsuccess=():void=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=():void=>{db.close();connection=undefined;};db.onclose=():void=>{connection=undefined;};resolve(db);};
        }).catch((error:unknown)=>{connection=undefined;throw error;});
        return connection;
    }
    private read(value:unknown):WitnessPolicySnapshot {
        if(value===undefined)return witnessPolicySnapshot(bundledText);
        if(value===null||typeof value!=='object'||!('id' in value)||value.id!=='current'||!('text' in value)||typeof value.text!=='string'||!('revision' in value)||typeof value.revision!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(value.revision))throw new Error('Invalid stored witness trust');
        return witnessPolicySnapshot(value.text,value.revision);
    }
    public async snapshot():Promise<WitnessPolicySnapshot> {
        const db=await this.open();return new Promise((resolve,reject)=>{
            const tx=db.transaction('configuration'),request=tx.objectStore('configuration').get('current');let answer:WitnessPolicySnapshot|undefined,failure:unknown;
            request.onsuccess=():void=>{try{answer=this.read(request.result);}catch(error){failure=error;tx.abort();}};
            tx.oncomplete=():void=>{if(answer===undefined)reject(new Error('Witness policy read failed'));else resolve(answer);};
            tx.onabort=():void=>{reject(failure instanceof Error?failure:tx.error??new Error('Witness policy read failed'));};
        });
    }
    public async replace(expectedRevision:string,text:string):Promise<void> {
        const candidate=witnessPolicySnapshot(text),db=await this.open();
        await new Promise<void>((resolve,reject)=>{
            const tx=db.transaction('configuration','readwrite'),store=tx.objectStore('configuration'),request=store.get('current');let failure:unknown;
            request.onsuccess=():void=>{try{
                if(this.read(request.result).revision!==expectedRevision)throw new Error('Witness policy changed since review');
                store.put({id:'current',revision:crypto.randomUUID(),text:candidate.text});
            }catch(error){failure=error;tx.abort();}};
            tx.oncomplete=():void=>{resolve();};tx.onabort=():void=>{reject(failure instanceof Error?failure:tx.error??new Error('Witness policy update failed'));};
        });
        broadcastWitnessPolicyChange();
    }
    public async remove(snapshot:WitnessPolicySnapshot,id:string):Promise<void> {
        await this.replace(snapshot.revision,prettyJSON({...snapshot.policy.json,witnesses:snapshot.policy.witnesses.filter(item=>item.id!==id).map(item=>item.json)}));
    }
}
/** Explicit test-only implementation; production never substitutes memory for failed storage. */
export class MemoryWitnessPolicy implements WitnessPolicyRepository {
    public text=bundledText;
    public async snapshot():Promise<WitnessPolicySnapshot>{return Promise.resolve(witnessPolicySnapshot(this.text));}
    public set(value:JSONValue):void{this.text=prettyJSON(parseWitnessPublicationPolicy(value).json);}
}
