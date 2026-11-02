import {prettyJSON} from '@open-charging-cloud/wwcp-poi';
import type {PublicationWitness} from '@open-charging-cloud/wwcp-poi';
import {POIWitnessTrustStore,witnessPolicySnapshot} from './poiWitnessTrust';
import {renderSecurityFingerprint} from './securityFingerprintView';

/** Recommendations grant no authority. Only the explicit acceptance button changes local trust. */
export async function renderPOIWitnessManagement(root:HTMLElement,localize:(key:string)=>string,isCurrent:()=>boolean,refresh:()=>void):Promise<void> {
    const store=new POIWitnessTrustStore(),snapshot=await store.snapshot();if(!isCurrent())return;
    root.classList.add('poiWitnessManagement');
    const text=(parent:HTMLElement,value:string):HTMLElement=>{const p=parent.appendChild(document.createElement('p'));p.textContent=value;return p;};
    const witnessCard=(parent:HTMLElement,witness:PublicationWitness,expanded:boolean):HTMLElement=>{
        const card=parent.appendChild(document.createElement('article'));card.className='trustManagementCard';card.dataset['witnessId']=witness.id;
        card.appendChild(document.createElement('h4')).textContent=witness.organization+' · '+witness.id;
        text(card,localize('poiWitnessNetworks')+': '+witness.networks.join(', '));text(card,localize('poiWitnessClock')+': ±'+String(witness.clockErrorMs)+' ms');
        text(card,new Date(witness.notBefore).toISOString()+' → '+new Date(witness.notAfter).toISOString());
        const details=card.appendChild(document.createElement('details'));details.open=expanded;details.appendChild(document.createElement('summary')).textContent=localize('poiWitnessKeys');
        const keys=details.appendChild(document.createElement('div'));keys.className='poiCPOKeyList';for(const key of witness.keys)keys.appendChild(renderSecurityFingerprint(key.id,localize));
        for(const endpoint of witness.endpoints)text(details,endpoint);return card;
    };
    text(root,localize('poiWitnessQuorum')+': '+String(snapshot.policy.requiredOrganizations));
    if(snapshot.policy.witnesses.length===0)text(root,localize('poiWitnessEmpty'));
    for(const witness of snapshot.policy.witnesses){
        const card=witnessCard(root,witness,false),remove=card.appendChild(document.createElement('button'));remove.type='button';remove.className='trustManagementDelete';remove.textContent=localize('poiWitnessRemove');remove.dataset['action']='remove-witness';
        remove.onclick=():void=>{remove.disabled=true;void store.remove(snapshot,witness.id).then(()=>{if(isCurrent())refresh();}).catch((error:unknown)=>{
            if(isCurrent()){remove.disabled=false;text(card,localize('poiWitnessFailed')+': '+(error instanceof Error?error.message:String(error)));}
        });};
    }
    const form=root.appendChild(document.createElement('section'));form.className='poiWitnessPolicyEditor';
    form.appendChild(document.createElement('h4')).textContent=localize('poiWitnessReviewTitle');text(form,localize('poiWitnessReviewScope'));
    const label=form.appendChild(document.createElement('label'));label.textContent=localize('poiWitnessInput');
    const input=label.appendChild(document.createElement('textarea'));input.rows=8;input.maxLength=1024*1024;input.spellcheck=false;input.dataset['action']='witness-policy-text';
    const file=form.appendChild(document.createElement('input'));file.type='file';file.accept='.json,application/json';file.dataset['action']='witness-policy-file';
    const review=form.appendChild(document.createElement('button'));review.type='button';review.textContent=localize('poiWitnessReview');review.dataset['action']='review-witness-policy';
    const result=form.appendChild(document.createElement('div'));result.className='poiWitnessPolicyPreview';let generation=0;
    const reset=():void=>{generation++;result.replaceChildren();delete result.dataset['state'];};input.oninput=reset;
    file.onchange=():void=>{reset();const selected=file.files?.[0],token=generation;if(selected===undefined)return;
        if(selected.size>1024*1024){text(result,localize('poiWitnessTooLarge'));return;}
        void selected.text().then(value=>{if(isCurrent()&&token===generation){input.value=value;reset();}}).catch(()=>{if(isCurrent()&&token===generation)text(result,localize('poiWitnessFailed'));});};
    review.onclick=():void=>{reset();const original=input.value,token=generation;
        try{
            const candidate=witnessPolicySnapshot(original);result.dataset['state']='review';
            text(result,localize('poiWitnessQuorum')+': '+String(candidate.policy.requiredOrganizations));
            text(result,localize('poiWitnessReplaced')+': '+String(snapshot.policy.witnesses.filter(before=>!candidate.policy.witnesses.some(after=>after.id===before.id)).length));
            for(const witness of candidate.policy.witnesses)witnessCard(result,witness,true);
            text(result,localize('poiWitnessIndependence'));
            const accept=result.appendChild(document.createElement('button'));accept.type='button';accept.dataset['action']='accept-witness-policy';accept.textContent=localize('poiWitnessAccept');
            accept.onclick=():void=>{if(!isCurrent()||token!==generation||original!==input.value)return;accept.disabled=true;
                void store.replace(snapshot.revision,original).then(()=>{if(isCurrent())refresh();}).catch((error:unknown)=>{if(isCurrent()){
                    accept.disabled=false;result.dataset['state']='invalid';text(result,localize('poiWitnessFailed')+': '+(error instanceof Error?error.message:String(error)));
                }});
            };
        }catch(error){result.dataset['state']='invalid';text(result,localize('poiWitnessFailed')+': '+(error instanceof Error?error.message:String(error)));}
    };
    const current=form.appendChild(document.createElement('details'));current.appendChild(document.createElement('summary')).textContent=localize('poiWitnessCurrentPolicy');current.appendChild(document.createElement('pre')).textContent=prettyJSON(snapshot.policy.json);
}
