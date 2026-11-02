import type {POIPublicKey} from '@open-charging-cloud/wwcp-poi';
import {POITrustService} from './poiTrustContext';
import type {TrustStore,StoredTrustAnchor} from './trustStore';
import {renderSecurityFingerprint} from './securityFingerprintView';
import {broadcastTrustPolicyChange} from './poiObservedHistory';

/** An explicit local decision; pasted/downloaded data never changes trust by itself. */
export function renderTrustTransitionManager(parent:HTMLElement,record:StoredTrustAnchor,store:TrustStore,keys:readonly POIPublicKey[],localize:(key:string)=>string,isCurrent:()=>boolean,refresh:()=>void):void {
    const root=parent.appendChild(document.createElement('section'));root.className='trustTransitionManager';root.dataset['policyId']=record.id;
    root.appendChild(document.createElement('h4')).textContent=localize('poiTransitionTitle');
    root.appendChild(document.createElement('p')).textContent=localize('poiTransitionScope');
    root.appendChild(document.createElement('p')).textContent=localize('poiTransitionCount')+': '+String(record.transitions?.length??0);
    if((record.transitions?.length??0)>0){const history=root.appendChild(document.createElement('details'));history.appendChild(document.createElement('summary')).textContent=localize('poiTransitionOriginals');
        for(const item of record.transitions??[])history.appendChild(document.createElement('pre')).textContent=item.text;}
    const label=root.appendChild(document.createElement('label'));label.textContent=localize('poiTransitionInput');
    const input=label.appendChild(document.createElement('textarea'));input.rows=6;input.maxLength=2*1024*1024;input.spellcheck=false;input.dataset['action']='transition-text';
    const file=root.appendChild(document.createElement('input'));file.type='file';file.accept='.json,application/json';file.dataset['action']='transition-file';
    const review=root.appendChild(document.createElement('button'));review.type='button';review.textContent=localize('poiTransitionReview');review.dataset['action']='review-transition';
    const result=root.appendChild(document.createElement('div'));result.className='trustTransitionResult';
    const reset=():void=>{result.replaceChildren();};input.oninput=reset;
    file.onchange=():void=>{const chosen=file.files?.[0];if(chosen===undefined)return;reset();
        if(chosen.size>2*1024*1024){result.textContent=localize('poiTransitionTooLarge');return;}
        void chosen.text().then(text=>{if(isCurrent()){input.value=text;reset();}}).catch(()=>{if(isCurrent())result.textContent=localize('poiTransitionFailed');});};
    review.onclick=():void=>{review.disabled=true;const text=input.value;reset();
        const service=new POITrustService(store,keys);
        void service.previewTrustTransition(record.id,text).then(preview=>{
            if(!isCurrent()||text!==input.value)return;
            result.dataset['state']=preview.consistency.accepted?'valid':'invalid';
            for(const key of ['poiTransitionSignatures','poiTransitionOldQuorum','poiTransitionNewQuorum'])result.appendChild(document.createElement('p')).textContent='✅ '+localize(key);
            result.appendChild(document.createElement('p')).textContent=localize('trustAnchorQuorumLabel')+': '+String(preview.context.requiredConsensus);
            result.appendChild(document.createElement('p')).textContent='Epoch '+String(preview.transition.oldEpoch.number)+' → '+String(preview.transition.epoch.number);
            for(const url of preview.transition.source.anchor.urls)result.appendChild(document.createElement('p')).textContent=url;
            const details=result.appendChild(document.createElement('details'));details.appendChild(document.createElement('summary')).textContent=localize('poiTransitionNewKeys');
            for(const id of preview.transition.source.anchor.keys)details.appendChild(renderSecurityFingerprint(id,localize));
            if(!preview.consistency.accepted){result.appendChild(document.createElement('p')).textContent='❌ '+localize('poiObservedRejected');
                for(const issue of preview.consistency.issues)result.appendChild(document.createElement('p')).textContent=issue.code+': '+issue.detail;return;}
            result.appendChild(document.createElement('p')).textContent=localize('poiTransitionConfirmScope');
            const accept=result.appendChild(document.createElement('button'));accept.type='button';accept.textContent=localize('poiTransitionAccept');accept.dataset['action']='accept-transition';
            accept.onclick=():void=>{accept.disabled=true;void(async():Promise<void>=>{
                if(!isCurrent()||text!==input.value)throw new Error('The reviewed transition changed');
                await store.appendTrustTransition(preview.record,preview.deleted,text,preview.acceptedAt,(current,deleted)=> { service.validateTransitionAppend(current,deleted,text,preview.acceptedAt); });
                await service.beginObservations(record.id);broadcastTrustPolicyChange();if(isCurrent())refresh();
            })().catch((error:unknown)=>{if(isCurrent()){accept.disabled=false;result.dataset['state']='invalid';result.appendChild(document.createElement('p')).textContent=localize('poiTransitionFailed')+': '+(error instanceof Error?error.message:String(error));}});};
        }).catch((error:unknown)=>{if(isCurrent()){result.dataset['state']='invalid';result.appendChild(document.createElement('p')).textContent='❌ '+localize('poiTransitionFailed');
            const detail=result.appendChild(document.createElement('details'));detail.appendChild(document.createElement('summary')).textContent=localize('poiDiagnostics');detail.appendChild(document.createElement('pre')).textContent=error instanceof Error?error.message:String(error);}
        }).finally(()=>{if(isCurrent())review.disabled=false;});};
}
