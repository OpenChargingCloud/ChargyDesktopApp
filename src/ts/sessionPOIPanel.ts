import type {LivePOICheck} from './livePOISession';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import { trustAnchorStorageId } from './trustStore';
import type { TrustStore } from './trustStore';
import { POITrustService } from './poiTrustContext';
import { StationProofPanel } from './stationProofPanel';
import type { SessionPOIEvidence } from './sessionPOIData';
import type { ITransportAllowances } from './liveLinkTrust';
import type { LoadedStationProof } from './stationProofData';
import type { IMeasurementValue } from '@open-charging-cloud/chargy-core';
import { renderSessionMeterKey } from './sessionMeterKeyView';
import type { SessionMeterKeyCheck } from './sessionMeterKeyView';
import { HistoricalSessionPanel } from './historicalSessionPanel';
import type { HistoricalSessionActions } from './historicalSessionPanel';
import {SessionPricePanel} from './sessionPricePanel';
import type {SessionPriceActions} from './sessionPricePanel';
import {renderSecurityFingerprint} from './securityFingerprintView';

/** One selected session and one explicitly selected local anchor policy, never a union of network trust. */
export class SessionPOIPanel {
    private disposed = false;
    private generation = 0;
    private panel: StationProofPanel | null = null;
    private meterController: AbortController | null = null;
    private meterGeneration = 0;
    private historyPanel: HistoricalSessionPanel | null = null;
    private pricePanel:SessionPricePanel|null=null;
    private liveController:AbortController|null=null;
    public constructor(private readonly root: HTMLElement, private readonly store: TrustStore,
        private readonly keys: readonly POIPublicKey[], private readonly evseId: string,
        private readonly evidence: SessionPOIEvidence | undefined, private readonly localize: (key: string) => string,
        private readonly language: string, private readonly allowances: ITransportAllowances,
        private readonly importBootstrap: (bootstrap: NonNullable<SessionPOIEvidence['bootstrap']>) => void,
        private readonly meter?: {
            readonly check: (proof: LoadedStationProof, signal: AbortSignal) => Promise<SessionMeterKeyCheck>;
            readonly showReading: (value: IMeasurementValue) => void;
        }, private readonly history?: HistoricalSessionActions,private readonly prices?:SessionPriceActions,private readonly live?:{
            readonly policyId:string;readonly priceChanged:boolean;readonly selected:(id:string)=>void;
            readonly check:(id:string,signal:AbortSignal)=>Promise<LivePOICheck>;
        }) {
        root.className = 'sessionPOI';
    }

    public dispose(): void { this.disposed = true; ++this.generation; this.panel?.dispose(); this.panel = null; this.cancelMeterCheck(); this.historyPanel?.dispose();this.pricePanel?.dispose();this.liveController?.abort(); }

    private cancelMeterCheck(): void { ++this.meterGeneration; this.meterController?.abort(); this.meterController = null; }

    public async mount(): Promise<void> {
        this.panel?.dispose(); this.panel = null;
        this.cancelMeterCheck();
        this.historyPanel?.dispose(); this.historyPanel = null;
        this.pricePanel?.dispose();this.pricePanel=null;
        const generation = ++this.generation;
        this.root.replaceChildren();
        this.root.appendChild(document.createElement('h3')).textContent = this.localize('poiSessionTitle');
        const status = this.root.appendChild(document.createElement('section'));
        status.className = 'sessionPOIStatus'; status.dataset['state'] = 'idle'; status.setAttribute('role', 'status');
        status.textContent = this.localize('poiChoosePolicy');
        let selectedPolicy='';
        const live=this.live===undefined?undefined:this.root.appendChild(document.createElement('section'));
        if(live!==undefined){live.className='livePOIResult';live.dataset['state']='idle';live.textContent=this.localize('poiChoosePolicy');}
        const checkLive=async(policyId:string):Promise<void>=>{
            this.liveController?.abort();if(live===undefined||this.live===undefined)return;
            this.live.selected(policyId);if(policyId===''){live.replaceChildren();live.dataset['state']='idle';live.textContent=this.localize('poiChoosePolicy');return;}
            const controller=new AbortController();this.liveController=controller;live.replaceChildren();live.dataset['state']='pending';live.textContent=this.localize('poiLiveChecking');
            try{
                const checked=await this.live.check(policyId,controller.signal);controller.signal.throwIfAborted();if(this.disposed)return;
                live.replaceChildren();live.dataset['stage']=checked.stage;live.dataset['state']=this.live.priceChanged?'warning':'valid';live.dataset['documents']=String(checked.cpo.documents);
                live.appendChild(document.createElement('p')).textContent='✅ '+this.localize({waiting:'poiLivePrepared',start:'poiLiveStart',charging:'poiLiveCharging',complete:'poiLiveComplete'}[checked.stage]);
                const authority=live.appendChild(document.createElement('p'));authority.dataset['check']='cpo-authority';authority.textContent='✅ '+this.localize('poiLiveCPOAuthorized')+' · '+checked.cpo.operatorId;
                const authorityDetails=live.appendChild(document.createElement('details'));authorityDetails.appendChild(document.createElement('summary')).textContent=this.localize('poiLiveCPOKeys');
                authorityDetails.appendChild(document.createElement('p')).textContent=this.localize('poiLiveEnvelopeCount')+': '+String(checked.cpo.documents);
                const fingerprints=authorityDetails.appendChild(document.createElement('div'));fingerprints.className='poiCPOKeyList';
                for(const id of checked.cpo.keyIds)fingerprints.appendChild(renderSecurityFingerprint(id,this.localize));
                live.appendChild(document.createElement('p')).textContent=this.localize('poiMeterDocumentCount')+': '+String(checked.readingCount);
                if(this.live.priceChanged)live.appendChild(document.createElement('p')).textContent=this.localize('poiLivePriceChanged');
                live.appendChild(document.createElement('p')).textContent=this.localize('poiLiveEnvelopeScope');
            }catch(error){if(controller.signal.aborted||this.disposed)return;live.replaceChildren();live.dataset['state']='invalid';live.appendChild(document.createElement('p')).textContent=this.localize('poiLiveFailed');
                const details=live.appendChild(document.createElement('details'));details.appendChild(document.createElement('summary')).textContent=this.localize('poiDiagnostics');details.appendChild(document.createElement('pre')).textContent=error instanceof Error?error.message:String(error);}
        };
        const meter = this.root.appendChild(document.createElement('section'));
        meter.className = 'sessionMeterKey';
        const meterPending = this.history === undefined ? 'poiMeterProofPending' : 'poiHistoryCurrentMeterUnverified';
        meter.textContent = this.localize(meterPending);
        const checkMeter = async (proof: LoadedStationProof): Promise<void> => {
            this.cancelMeterCheck();
            if (this.meter === undefined) return;
            const meterGeneration = this.meterGeneration;
            const controller = new AbortController(); this.meterController = controller;
            meter.replaceChildren(); meter.textContent = this.localize('poiMeterChecking');
            try {
                const result = await this.meter.check(proof, controller.signal);
                if (this.disposed || controller.signal.aborted || meterGeneration !== this.meterGeneration) return;
                meter.replaceChildren(renderSessionMeterKey(result, this.localize, this.language, this.meter.showReading));
                if(live?.dataset['state']==='invalid')void checkLive(selectedPolicy);
            }
            catch (error) {
                if (this.disposed || controller.signal.aborted || meterGeneration !== this.meterGeneration) return;
                meter.replaceChildren();
                const warning = meter.appendChild(document.createElement('p'));
                warning.textContent = this.localize('poiMeterAssociationFailed');
                const details = meter.appendChild(document.createElement('details'));
                details.appendChild(document.createElement('summary')).textContent = this.localize('poiDiagnostics');
                details.appendChild(document.createElement('pre')).textContent = error instanceof Error ? error.message : String(error);
            }
        };
        if (this.history !== undefined) {
            this.historyPanel = new HistoricalSessionPanel(this.root.appendChild(document.createElement('section')),this.history,this.localize,this.language);
            void this.historyPanel.check('');
        }
        if(this.prices!==undefined){this.pricePanel=new SessionPricePanel(this.root.appendChild(document.createElement('section')),this.prices,this.localize,this.language);void this.pricePanel.open('');}
        const controls = this.root.appendChild(document.createElement('details'));
        controls.className = 'sessionPOIDetails';
        controls.appendChild(document.createElement('summary')).textContent = this.localize('poiSessionDetails');
        controls.appendChild(document.createElement('p')).textContent = this.localize('poiSessionScope');
        try {
            const { records } = await this.store.listTrustSnapshot();
            if (this.disposed || generation !== this.generation) return;
            controls.open = records.length === 0;
            const bootstrap = this.evidence?.bootstrap;
            if (bootstrap !== undefined) {
                const note = controls.appendChild(document.createElement('p'));
                note.textContent = this.localize('poiBootstrapNotice');
                const button = controls.appendChild(document.createElement('button'));
                button.type = 'button'; button.textContent = this.localize('poiShowBootstrap');
                button.onclick = (): void => { this.importBootstrap(bootstrap); };
            }
            const label = controls.appendChild(document.createElement('label'));
            label.textContent = this.localize('poiSelectPolicy');
            const select = controls.appendChild(document.createElement('select'));
            label.htmlFor = 'poiSessionPolicy'; select.id = 'poiSessionPolicy';
            const empty = select.appendChild(document.createElement('option'));
            empty.value = ''; empty.textContent = this.localize(records.length === 0 ? 'poiNoPolicy' : 'poiChoosePolicy');
            const service = new POITrustService(this.store, this.keys);
            const hint = bootstrap === undefined ? undefined : trustAnchorStorageId(bootstrap.anchor);
            const matches: string[] = [];
            for (const record of records) {
                let authorized = false;
                let network = '';
                try { const context = this.history === undefined && this.prices === undefined ? await service.resolve(record.id) : await service.resolveHistorical(record.id); authorized = true; network = context.roamingNetworkId; }
                catch { /* Still selectable: users can inspect their trust failure, never authorize it implicitly. */ }
                if (generation !== this.generation) return;
                const option = select.appendChild(document.createElement('option'));
                option.value = record.id;
                option.textContent = `${network || this.localize('poiUnverifiedPolicy')} · ${record.id.slice(0, 12)}`;
                if (authorized && (hint !== undefined ? hint === record.id
                    : this.evidence?.roamingNetworkId !== undefined ? network === this.evidence.roamingNetworkId : records.length === 1)) matches.push(record.id);
            }
            const host = controls.appendChild(document.createElement('div'));
            const open = async (): Promise<void> => {
                selectedPolicy=select.value;
                this.panel?.dispose(); this.panel = null; host.replaceChildren();
                this.cancelMeterCheck(); meter.replaceChildren(); meter.textContent = this.localize(meterPending);
                status.dataset['state'] = 'idle'; status.textContent = this.localize('poiChoosePolicy');
                void checkLive(select.value);
                void this.historyPanel?.check(select.value);
                void this.pricePanel?.open(select.value);
                if (select.value === '' || this.disposed) return;
                const panel = new StationProofPanel(host, this.store, service, select.value, this.localize, this.language,
                    this.allowances, this.evseId, { evseId: this.evseId, onState: (state, proof): void => {
                        if (this.disposed || generation !== this.generation) return;
                        if (proof === undefined) {
                            this.cancelMeterCheck(); meter.replaceChildren(); meter.textContent = this.localize(meterPending);
                        }
                        else void checkMeter(proof);
                        status.dataset['state'] = state;
                        const label = state === 'valid' ? 'poiStationVerified' : state === 'warning' ? 'poiStationVerifiedWithWarnings'
                            : state === 'invalid' ? 'poiLoadFailed' : state === 'pending' ? 'poiLoading' : 'poiCancelled';
                        status.replaceChildren();
                        const heading = status.appendChild(document.createElement('p'));
                        heading.textContent = (state === 'valid' ? '✅ ' : '') + this.localize(label);
                        if (proof !== undefined) {
                            const tariffs = proof.station.tariffs.get(this.evseId) ?? [];
                            status.appendChild(document.createElement('p')).textContent = `${this.evseId} · ${this.localize('poiStaticTariffs')}: ${tariffs.length}`;
                            status.appendChild(document.createElement('p')).textContent = `${this.localize('poiCheckedAt')}: ${new Date(proof.context.evaluatedAt).toLocaleString(this.language)}`;
                        }
                    },
                        ...(this.evidence?.document === undefined ? {} : { document: this.evidence.document }) });
                this.panel = panel;
                if (this.evidence?.document === undefined)
                    status.textContent = this.localize(this.history === undefined ? 'poiSessionProofPending' : 'poiHistoryCurrentUnverified');
                await panel.mount();
            };
            select.onchange = (): void => { void open(); };
            if(this.live!==undefined&&this.live.policyId!==''&&records.some(record=>record.id===this.live?.policyId)){select.value=this.live.policyId;await open();}
            else if (matches.length === 1) { select.value = matches[0] ?? ''; await open(); }
        }
        catch {
            if (!this.disposed && generation === this.generation)
                this.root.appendChild(document.createElement('p')).textContent = this.localize('trustStorageError');
        }
    }
}
