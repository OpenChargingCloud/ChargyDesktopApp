import {parseJSON,prettyJSON,isObject,PricePublicationReceipt} from '@open-charging-cloud/wwcp-poi';
import type {JSONValue} from '@open-charging-cloud/wwcp-poi';
import {pollTargetProblem} from './liveLinkTrust';
import type {ITransportAllowances} from './liveLinkTrust';
import {readResponseWithinLimit} from './deepLinks';
import type {WitnessPolicySnapshot} from './poiWitnessTrust';
import type {SessionPriceDocument} from './sessionPriceData';

/** Experimental GET contract. Only explicitly approved endpoints; sends public offer identifiers, no customer/start document. */
export async function loadPricePublicationReceipts<T>(document:SessionPriceDocument,policy:WitnessPolicySnapshot,subject:{readonly roamingNetworkId:string;readonly evseId:string;readonly digest:string;readonly priceStatementSHA256:string;readonly tariffSHA256:string;readonly checkpointIds:readonly string[]},
    verify:(candidate:SessionPriceDocument)=>Promise<T>,options:{readonly signal:AbortSignal;readonly fetch?:typeof fetch;readonly allowances?:ITransportAllowances;readonly timeoutMs?:number;readonly totalTimeoutMs?:number}):Promise<T> {
    const raw=parseJSON(document.text);if(!isObject(raw))throw new Error('Original price evidence required');
    const urls=[...new Set(policy.policy.witnesses.filter(item=>item.networks.includes(subject.roamingNetworkId)).flatMap(item=>item.endpoints))];
    const checkpointIds=[...new Set(subject.checkpointIds)];
    if(urls.length===0||urls.length*checkpointIds.length>16||checkpointIds.length===0)throw new Error('No bounded authorized witness receipt sources; configure publication witnesses first');
    const controller=new AbortController(),abort=():void=>{controller.abort(options.signal.reason);};options.signal.throwIfAborted();options.signal.addEventListener('abort',abort,{once:true});
    const deadline=setTimeout(()=>{controller.abort(new Error('Publication receipt deadline exceeded'));},options.totalTimeoutMs??30000);
    const receipts=new Map<string,JSONValue>(),errors:string[]=[];let transferred=0;
    try{
        for(const receipt of Array.isArray(raw['publicationReceipts'])?raw['publicationReceipts']:[])receipts.set(PricePublicationReceipt.parse(receipt).digest(),receipt);
        for(const endpoint of urls)for(const checkpointId of checkpointIds){
            controller.signal.throwIfAborted();const url=new URL(endpoint);
            url.searchParams.set('roamingNetworkId',subject.roamingNetworkId);url.searchParams.set('EVSEId',subject.evseId);url.searchParams.set('priceStatementDigest',subject.digest);url.searchParams.set('checkpointId',checkpointId);
            url.searchParams.set('priceStatementSHA256',subject.priceStatementSHA256);url.searchParams.set('tariffSHA256',subject.tariffSHA256);
            if(pollTargetProblem(url,false,options.allowances)!==null){errors.push('Witness endpoint not permitted');continue;}
            const source=new AbortController(),cancel=():void=>{source.abort(controller.signal.reason);};controller.signal.addEventListener('abort',cancel,{once:true});
            const timeout=setTimeout(()=>{source.abort(new Error('Witness source timed out'));},options.timeoutMs??15000);
            try{
                const response=await(options.fetch??poiFetch)(url.href,{signal:source.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
                if(!response.ok)throw new Error('Witness source returned '+String(response.status));
                const bytes=await readResponseWithinLimit(response,Math.min(1024*1024,4*1024*1024-transferred));transferred+=bytes.length;
                if(transferred>=4*1024*1024){controller.abort(new Error('Publication receipts exceed the total transfer budget'));controller.signal.throwIfAborted();}
                source.signal.throwIfAborted();const body=parseJSON(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
                const entries=Array.isArray(body)?body:isObject(body)&&Array.isArray(body['publicationReceipts'])?body['publicationReceipts']:[body];
                if(entries.length>64)throw new Error('Too many publication receipts');
                for(const entry of entries)receipts.set(PricePublicationReceipt.parse(entry).digest(),entry);
                if(receipts.size>64)throw new Error('Too many publication receipts');
            }catch(error){controller.signal.throwIfAborted();errors.push(error instanceof Error?error.message:String(error));}
            finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',cancel);}
        }
        controller.signal.throwIfAborted();if(receipts.size===0)throw new Error('No publication receipts received: '+errors.join('; '));
        const text=prettyJSON({...raw,publicationReceipts:[...receipts.values()]});if(new TextEncoder().encode(text).length>4*1024*1024)throw new Error('Price evidence exceeds 4 MiB');
        const checked=await verify({...document,text});controller.signal.throwIfAborted();return checked;
    }finally{clearTimeout(deadline);options.signal.removeEventListener('abort',abort);}
}
import { poiFetch } from './poiFetch';
