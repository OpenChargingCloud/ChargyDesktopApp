import {parseJSON,prettyJSON,isObject,SESSION_PRICE_EVIDENCE_CONTEXT} from '@open-charging-cloud/wwcp-poi';
import type {JSONValue} from '@open-charging-cloud/wwcp-poi';
import {pollTargetProblem} from './liveLinkTrust';
import type {ITransportAllowances} from './liveLinkTrust';
import {readResponseWithinLimit} from './deepLinks';
import {stationPriceStatementsURL} from './poiURLs';

export interface SessionPriceDocument {readonly origin:'embedded'|'network';readonly sourceURL:string;readonly receivedAt:string;readonly text:string;}
/** Only selected saved anchor sources, explicit consent, bounded transport and verification before accepting a mirror. */
export async function loadSessionPriceEvidence<T>(sources:readonly string[],evseId:string,stationProof:JSONValue,
    verify:(document:SessionPriceDocument)=>Promise<T>,options:{readonly signal:AbortSignal;readonly fetch?:typeof fetch;
        readonly allowances?:ITransportAllowances;readonly timeoutMs?:number;readonly totalTimeoutMs?:number}):Promise<T> {
    const overall=new AbortController(),abort=():void=>{overall.abort(options.signal.reason);};
    options.signal.throwIfAborted();options.signal.addEventListener('abort',abort,{once:true});
    const deadline=setTimeout(()=>{overall.abort(new Error('Price download deadline exceeded'));},options.totalTimeoutMs??30000),errors:string[]=[];
    try{
        for(const base of sources){
            overall.signal.throwIfAborted();const sourceURL=stationPriceStatementsURL(base,evseId),url=new URL(sourceURL);
            if(pollTargetProblem(url,false,options.allowances)!==null||url.username!==''||url.password!==''){errors.push('Source not permitted');continue;}
            const controller=new AbortController(),cancel=():void=>{controller.abort(overall.signal.reason);};
            overall.signal.addEventListener('abort',cancel,{once:true});
            const timer=setTimeout(()=>{controller.abort(new Error('Price source timed out'));},options.timeoutMs??15000);
            try{
                const response=await(options.fetch??poiFetch)(sourceURL,{signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
                if(!response.ok)throw new Error('Price source returned '+String(response.status));
                const bytes=await readResponseWithinLimit(response,2*1024*1024);controller.signal.throwIfAborted();
                const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),raw=parseJSON(text);
                const body=isObject(raw)&&raw['@context']===SESSION_PRICE_EVIDENCE_CONTEXT?raw:{'@context':SESSION_PRICE_EVIDENCE_CONTEXT,EVSEId:evseId,chargingStationProof:stationProof,
                    priceStatements:Array.isArray(raw)?raw:isObject(raw)?raw['priceStatements']??null:null};
                const checked=await verify({origin:'network',sourceURL,receivedAt:new Date().toISOString(),text:prettyJSON(body)});
                controller.signal.throwIfAborted();return checked;
            }catch(error){overall.signal.throwIfAborted();errors.push(sourceURL+': '+(error instanceof Error?error.message:String(error)));}
            finally{clearTimeout(timer);overall.signal.removeEventListener('abort',cancel);}
        }
    }finally{clearTimeout(deadline);options.signal.removeEventListener('abort',abort);}
    throw new Error('No source supplied usable session prices: '+errors.join('; '));
}
import { poiFetch } from './poiFetch';
