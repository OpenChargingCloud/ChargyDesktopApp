import {renderPOIConsistency} from './poiConsistencyView';
import type {VersionComparison} from '@open-charging-cloud/wwcp-poi';
import {isObject,prettyJSON,parseJSON,parseWitnessPublicationPolicy,WITNESS_PUBLICATION_POLICY_CONTEXT} from '@open-charging-cloud/wwcp-poi';
import type {JSONValue,SessionPriceVerification} from '@open-charging-cloud/wwcp-poi';
import type {IBoundOCMFResult,IOCMFPriceRateComparison} from '@open-charging-cloud/chargy-core';
import type {SessionPriceDocument} from './sessionPriceData';
import {renderSecurityFingerprint} from './securityFingerprintView';

function asText(value:JSONValue|undefined):string {return typeof value==='string'?value:prettyJSON(value??null);}

export interface SessionPriceCheck {readonly consistency?:VersionComparison;readonly price:SessionPriceVerification;readonly start:IBoundOCMFResult;readonly rates:IOCMFPriceRateComparison;readonly document:SessionPriceDocument;}
export interface SessionPriceActions {
    readonly hasEvidence:boolean;
    readonly waitingForStart?:boolean;
    readonly check:(policyId:string,signal:AbortSignal)=>Promise<SessionPriceCheck>;
    readonly load:(policyId:string,signal:AbortSignal)=>Promise<SessionPriceCheck>;
    readonly loadPublication?:(policyId:string,signal:AbortSignal)=>Promise<SessionPriceCheck>;
    readonly save?: (policyId:string,signal:AbortSignal)=>Promise<void>;
}
export class SessionPricePanel {
    private controller:AbortController|null=null;
    public constructor(private readonly root:HTMLElement,private readonly actions:SessionPriceActions,
        private readonly localize:(key:string)=>string,private readonly language:string){root.className='sessionPrices';}
    public dispose():void {this.controller?.abort();this.controller=null;}
    public async open(policyId:string):Promise<void>{
        this.dispose();this.root.replaceChildren();this.root.appendChild(document.createElement('h4')).textContent=this.localize('poiPriceTitle');
        if(policyId===''){this.root.appendChild(document.createElement('p')).textContent=this.localize('poiChoosePolicy');return;}
        const body=this.root.appendChild(document.createElement('div'));body.className='sessionPriceResult';body.dataset['state']='idle';body.setAttribute('role','status');
        if(this.actions.waitingForStart===true){body.dataset['state']='waiting';body.textContent=this.localize('poiLivePriceWaiting');return;}
        const button=this.root.appendChild(document.createElement('button'));button.type='button';
        button.textContent=this.localize(this.actions.hasEvidence?'poiPriceRecheck':'poiPriceLoad');button.dataset['action']='load-prices';
        const run=async(load:boolean):Promise<void>=>{
            this.dispose();const controller=new AbortController();this.controller=controller;button.disabled=true;
            body.replaceChildren();body.dataset['state']='pending';body.textContent=this.localize('poiPriceChecking');
            try{
                const checked=load?await this.actions.load(policyId,controller.signal):await this.actions.check(policyId,controller.signal);controller.signal.throwIfAborted();
                this.render(body,checked,policyId,controller.signal);
            }catch(error){
                if(controller.signal.aborted)return;body.replaceChildren();body.dataset['state']='invalid';body.appendChild(document.createElement('p')).textContent=this.localize('poiPriceFailed');
                const details=body.appendChild(document.createElement('details'));details.appendChild(document.createElement('summary')).textContent=this.localize('poiDiagnostics');
                details.appendChild(document.createElement('pre')).textContent=error instanceof Error?error.message:String(error);
            }finally{if(!controller.signal.aborted){button.disabled=false;button.textContent=this.localize(this.actions.hasEvidence?'poiPriceRecheck':'poiPriceLoad');}}
        };
        button.onclick=():void=>{void run(!this.actions.hasEvidence);};
        if(this.actions.hasEvidence)await run(false);else body.textContent=this.localize('poiPriceMissing');
    }
    private render(body:HTMLElement,checked:SessionPriceCheck,policyId:string,signal:AbortSignal):void {
        const {price,start,rates,document:source}=checked;body.replaceChildren();
        const startOK=start.signaturesValid&&start.historicalAssociation==='rno-attested-at-reading-times';
        const bound=price.applicability==='bound'&&startOK;
        body.dataset['state']=checked.consistency?.accepted===false||price.publicationBeforeStart==='invalid'?'invalid':bound&&rates.status==='rates-match'&&price.publication==='valid'&&start.status==='verified'&&!price.chainGaps?'valid':
            price.signatures==='invalid'||price.applicability==='invalid'||price.publication==='invalid'||rates.status==='conflict'?'invalid':'warning';
        body.dataset['applicability']=price.applicability;body.dataset['publication']=price.publication;body.dataset['rates']=rates.status;
        const beforeStart=price.publicationBeforeStart==='witnessed-before-signed-start'&&startOK;
        body.dataset['beforeStart']=beforeStart?'witnessed':price.publicationBeforeStart==='invalid'?'invalid':'not-proven';
        const row=(label:string,state:'valid'|'warning'|'invalid'):void=>{
            const p=body.appendChild(document.createElement('p'));p.dataset['state']=state;p.textContent=(state==='valid'?'✅ ':state==='invalid'?'❌ ':'⏳ ')+this.localize(label);
        };
        if(checked.consistency!==undefined)body.appendChild(renderPOIConsistency(checked.consistency,this.localize));
        row('poiPriceDefinitionValid','valid');
        row(price.signatures==='valid'?'poiPriceSignaturesValid':price.signatures==='missing'?'poiPriceMissing':'poiPriceSignaturesInvalid',price.signatures==='valid'?'valid':price.signatures==='missing'?'warning':'invalid');
        row(startOK?'poiPriceStartValid':'poiPriceStartUnproven',startOK?'valid':'invalid');
        const labels={bound:'poiPriceBound',unbound:'poiPriceUnbound',missing:'poiPriceNoApplicable',invalid:'poiPriceBindingInvalid',ambiguous:'poiPriceAmbiguous',unsupported:'poiPriceUnsupported'};
        row(bound?'poiPriceBound':price.applicability==='bound'?'poiPriceUnbound':labels[price.applicability],bound?'valid':price.applicability==='invalid'?'invalid':'warning');
        if(start.status==='key-conflict')row('poiMeterKeyConflict','warning');
        row(rates.status==='rates-match'&&startOK?'poiPriceRatesMatch':rates.status==='conflict'?'poiPriceRatesConflict':'poiPriceRatesUnproven',rates.status==='rates-match'&&startOK?'valid':rates.status==='conflict'?'invalid':'warning');
        row(price.publication==='valid'?'poiPriceIncluded':price.publication==='invalid'?'poiPricePublicationInvalid':'poiPricePublicationMissing',price.publication==='valid'?'valid':price.publication==='invalid'?'invalid':'warning');
        if(price.publication==='valid'&&!beforeStart)row(price.witnessedBy.length>0?'poiHistoryWitnessed':'poiHistoryWitnessMissing',price.witnessedBy.length>0?'valid':'warning');
        const publication=body.appendChild(document.createElement('section'));publication.className='poiPricePublication';publication.dataset['state']=beforeStart?'valid':price.publicationBeforeStart==='invalid'?'invalid':'warning';
        publication.appendChild(document.createElement('p')).textContent=(beforeStart?'✅ ':price.publicationBeforeStart==='invalid'?'❌ ':'⏳ ')+this.localize(beforeStart?'poiPublicationBeforeStart':price.publicationBeforeStart==='invalid'?'poiPublicationInvalid':'poiPublicationPending');
        if(price.publicationWitnesses!==undefined){
            publication.appendChild(document.createElement('p')).textContent=this.localize('poiWitnessQuorum')+': '+String(price.publicationWitnesses.organizations.length)+' / '+String(price.publicationWitnesses.requiredOrganizations);
            publication.appendChild(document.createElement('p')).textContent=this.localize('poiPublicationTimeScope');
            const receiptDetails=publication.appendChild(document.createElement('details'));receiptDetails.appendChild(document.createElement('summary')).textContent=this.localize('poiPublicationDetails');
            const receiptList=receiptDetails.appendChild(document.createElement('div'));receiptList.className='poiPublicationReceipts';
            for(const receipt of price.publicationWitnesses.receipts){
                const article=receiptList.appendChild(document.createElement('article'));article.className='poiPublicationReceipt';article.dataset['receiptState']=receipt.status;
                article.appendChild(document.createElement('h5')).textContent=(receipt.organization??receipt.witnessId)+' · '+receipt.status;
                if(receipt.sourceURL!==undefined)article.appendChild(document.createElement('p')).textContent=receipt.sourceURL;
                if(receipt.latestPublicationAt!==undefined)article.appendChild(document.createElement('p')).textContent=this.localize('poiPublicationLatest')+': '+new Date(receipt.latestPublicationAt).toLocaleString(this.language);
                if(receipt.keyId!==undefined)article.appendChild(renderSecurityFingerprint(receipt.keyId,this.localize));
                article.appendChild(document.createElement('p')).textContent=receipt.detail;
            }
            if(price.publicationWitnesses.receipts.length===0)receiptDetails.appendChild(document.createElement('p')).textContent=this.localize('poiPublicationNoReceipts');
        }
        if(this.actions.loadPublication!==undefined&&price.selected!==undefined&&price.publication==='valid'){
            const fetchButton=publication.appendChild(document.createElement('button'));fetchButton.type='button';fetchButton.textContent=this.localize('poiPublicationLoad');fetchButton.dataset['action']='load-publication';
            fetchButton.onclick=():void=>{fetchButton.disabled=true;void this.actions.loadPublication?.(policyId,signal).then(next=>{signal.throwIfAborted();this.render(body,next,policyId,signal);}).catch((error:unknown)=>{
                if(!signal.aborted){fetchButton.disabled=false;const p=publication.appendChild(document.createElement('p'));p.textContent=this.localize('poiPublicationLoadFailed')+': '+(error instanceof Error?error.message:String(error));p.setAttribute('role','alert');}
            });};
        }
        body.appendChild(document.createElement('p')).textContent=this.localize(beforeStart?'poiPriceWitnessedLimits':'poiPriceLimits');
        if(price.chainGaps)row('poiPriceChainGaps','warning');
        const selected=price.selected;
        if(selected!==undefined){
            const title=body.appendChild(document.createElement('p'));title.className='sessionPriceSelected';title.textContent=asText(selected.tariff['@id'])+' · '+selected.currency;
            const components=body.appendChild(document.createElement('dl'));components.className='sessionPriceComponents';
            for(const element of selected.elements)for(const component of Array.isArray(element['priceComponents'])?element['priceComponents']:[]){
                if(!isObject(component))continue;components.appendChild(document.createElement('dt')).textContent=asText(component['type']);
                components.appendChild(document.createElement('dd')).textContent=asText(component['price'])+' '+selected.currency+(component['type']==='ENERGY'?'/kWh':component['type']==='TIME'?'/h':'')+' · '+this.localize('poiPriceStep')+': '+asText(component['stepSize']);
            }
        }
        const details=body.appendChild(document.createElement('details'));details.appendChild(document.createElement('summary')).textContent=this.localize('poiPriceDetails');
        const supplied=parseJSON(source.text);
        if(isObject(supplied)&&Array.isArray(supplied['witnessCandidates'])&&supplied['witnessCandidates'].length>0){
            const candidates=details.appendChild(document.createElement('details'));candidates.appendChild(document.createElement('summary')).textContent=this.localize('poiWitnessCandidates');
            candidates.appendChild(document.createElement('p')).textContent=this.localize('poiWitnessCandidatesScope');
            candidates.appendChild(document.createElement('p')).textContent=this.localize('poiWitnessSettingsPath');
            try{const recommended=parseWitnessPublicationPolicy({'@context':WITNESS_PUBLICATION_POLICY_CONTEXT,requiredOrganizations:2,witnesses:supplied['witnessCandidates']});
                for(const witness of recommended.witnesses){candidates.appendChild(document.createElement('p')).textContent=witness.organization+' · '+witness.id;for(const key of witness.keys)candidates.appendChild(renderSecurityFingerprint(key.id,this.localize));}
                candidates.appendChild(document.createElement('pre')).textContent=prettyJSON(recommended.json);
            }catch{candidates.appendChild(document.createElement('pre')).textContent=prettyJSON(supplied['witnessCandidates']);}
        }
        details.appendChild(document.createElement('p')).textContent=this.localize(source.origin==='network'?'poiPriceDownloaded':'poiPriceSupplied')+': '+source.sourceURL;
        details.appendChild(document.createElement('p')).textContent=new Date(source.receivedAt).toLocaleString(this.language);
        if(selected!==undefined){details.appendChild(document.createElement('p')).textContent=asText(selected.statement['algorithm']);details.appendChild(renderSecurityFingerprint(asText(selected.statement['keyId']),this.localize));
            details.appendChild(document.createElement('p')).textContent=this.localize('poiPriceDigest')+': '+selected.digest;
            const elements=details.appendChild(document.createElement('details'));elements.appendChild(document.createElement('summary')).textContent=this.localize('poiPriceElements');
            elements.appendChild(document.createElement('pre')).textContent=prettyJSON([...selected.elements]);}
        for(const diagnostic of [...price.diagnostics,start.detail,rates.detail])details.appendChild(document.createElement('p')).textContent=diagnostic;
        const raw=details.appendChild(document.createElement('details'));raw.appendChild(document.createElement('summary')).textContent=this.localize('trustDataRawLabel');raw.appendChild(document.createElement('pre')).textContent=source.text;
        if(this.actions.save!==undefined){
            const save=body.appendChild(document.createElement('button'));save.type='button';save.textContent=this.localize('poiHistorySave');save.dataset['action']='save-price-evidence';
            save.onclick=():void=>{save.disabled=true;void this.actions.save?.(policyId,signal).then(()=>{if(!signal.aborted)save.textContent=this.localize('poiHistorySaved');}).catch(()=>{
                if(!signal.aborted){save.disabled=false;body.appendChild(document.createElement('p')).textContent=this.localize('poiHistorySaveFailed');}
            });};
        }
    }
}
