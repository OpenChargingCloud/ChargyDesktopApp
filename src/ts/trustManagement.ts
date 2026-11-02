import {POIObservedHistoryStore} from './poiObservedHistory';
import type {StoredObservedHistory} from './poiObservedHistory';
import { TrustAnchor, toBase64 } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import type { TrustStore } from './trustStore';
import type { StoredTrustAnchor } from './trustStore';
import { activeBundledPublicKeys } from './trustStore';
import { groupRoamingNetworks, roamingNetworkDisplayName } from './roamingNetworks';
import type { StoredRoamingNetwork } from './roamingNetworks';
import { renderTrustAnchorValidation } from './trustAnchorPreview';
import { parseTrustAnchorData } from './trustAnchorData';
import { renderTrustAnchorData } from './trustAnchorDataView';
import { renderSecurityFingerprint } from './securityFingerprintView';
import { POITrustService } from './poiTrustContext';
import { StationProofPanel } from './stationProofPanel';
import type { ITransportAllowances } from './liveLinkTrust';
import { SessionEvidenceStore } from './sessionEvidenceStore';
import {renderTrustTransitionManager} from './trustTransitionView';
import {renderPOIWitnessManagement} from './poiWitnessManagement';

type TrustManagementPage = "menu" | "anchors" | "keys" | "networks" | "networkDetails" | "stationProof" | 'archives' | 'observations' | 'witnesses';

export class TrustManagement {
    private page: TrustManagementPage = "menu";
    private generation = 0;
    private selectedNetworkId: string | null = null;
    private stationPanel: StationProofPanel | null = null;
    private stationPolicyId: string | null = null;
    private stationQuery = '';

    public constructor(private readonly root: HTMLElement,
                        private readonly store: TrustStore,
                        private readonly bundledKeys: readonly POIPublicKey[],
                        private readonly localize: (key: string) => string,
                        private readonly language: () => string,
                        private readonly allowances: ITransportAllowances = {},
                        private readonly openArchive?: (text: string) => Promise<void>,
                        private readonly openObservedLive?:(record:StoredObservedHistory,chain:string)=>Promise<void>) {
        const settings = root.closest<HTMLElement>('#settingsScreen');
        if (settings !== null)
            new MutationObserver(() => {
                if (settings.style.display === 'none' || settings.hidden !== false)
                    this.hide();
            }).observe(settings, { attributes: true, attributeFilter: ['style', 'hidden'] });
    }

    public open(): void { this.root.hidden = false; this.page = "menu"; this.selectedNetworkId = null; void this.render(); }
    public hide(): void { this.root.hidden = true; this.generation++; this.disposeStationPanel(); }
    public refresh(): void { if (this.root.hidden === false) void this.render(); }
    public back(): boolean {
        if (this.page === "menu")
            return false;
        if (this.page === 'stationProof')
            this.page = 'networkDetails';
        else {
            this.page = this.page === "networkDetails" ? "networks" : "menu";
            this.selectedNetworkId = null;
        }
        void this.render();
        return true;
    }

    private disposeStationPanel(): void {
        if (this.stationPanel !== null) {
            this.stationQuery = this.stationPanel.value;
            this.stationPanel.dispose();
            this.stationPanel = null;
        }
    }

    private button(parent: HTMLElement, label: string, action: () => void, className: string = ""): HTMLButtonElement {
        const button = parent.appendChild(document.createElement("button"));
        button.type = "button";
        button.textContent = this.localize(label);
        button.className = className;
        button.onclick = action;
        return button;
    }

    private text(parent: HTMLElement, text: string, className: string = ""): HTMLElement {
        const element = parent.appendChild(document.createElement("p"));
        element.textContent = text;
        element.className = className;
        return element;
    }

    private async mutate(button: HTMLButtonElement, action: () => Promise<void>, generation: number): Promise<void> {
        button.disabled = true;
        try {
            await action();
            if (this.generation === generation)
                await this.render();
        }
        catch {
            if (this.generation === generation) {
                const error = this.text(this.root, this.localize("trustStorageError"), "trustManagementError");
                error.setAttribute("role", "alert");
                button.disabled = false;
            }
        }
    }

    private renderAnchor(parent: HTMLElement, record: StoredTrustAnchor, generation: number,
                         deletedKeys?: ReadonlySet<string>): void {
        const anchor = TrustAnchor.parse(record.qrCode);
        const card = parent.appendChild(document.createElement("article"));
        card.className = "trustManagementCard";
        card.dataset["anchorId"] = record.id;
        const name = card.appendChild(document.createElement("h4"));
        name.textContent = anchor.name[this.language()] ?? anchor.name["en"] ?? Object.values(anchor.name)[0] ?? anchor.id;
        this.text(card, anchor.id, "trustManagementIdentifier");
        this.text(card, `${this.localize("trustAnchorImportedAtLabel")}: ${new Date(record.importedAt).toLocaleString(this.language())}`);
        this.text(card, this.localize("trustAnchorSavedStatus"));
        this.text(card, this.localize('poiAnchorDeleteNotice'));
        const details = card.appendChild(document.createElement("details"));
        const summary = details.appendChild(document.createElement("summary"));
        summary.textContent = this.localize("trustAnchorDetailsLabel");
        if (deletedKeys !== undefined)
            details.open = true;
        for (const url of anchor.urls)
            this.text(details, url, "trustManagementIdentifier");
        this.text(details, `${this.localize("trustAnchorQuorumLabel")}: ${anchor.minConsensus} / ${anchor.holders.length}`);
        if (record.downloadedData !== undefined) {
            try {
                const data = parseTrustAnchorData(anchor, record.downloadedData, this.bundledKeys);
                details.appendChild(renderTrustAnchorData(anchor, data, {
                    record, bundled: this.bundledKeys, deleted: deletedKeys ?? new Set(), localize: this.localize,
                    onChange: async (keyId, trusted) => {
                        if (this.generation !== generation)
                            return;
                        await this.store.setKeyTrust(record.id, keyId, trusted);
                        if (this.generation === generation)
                            await this.render();
                    }
                }));
            }
            catch {
                this.text(details, this.localize("trustDataStoredInvalid"), "trustManagementError");
            }
        }
        else {
            for (const [index, holder] of anchor.holders.entries()) {
                this.text(details, `${this.localize("trustAnchorHolderLabel")} ${index + 1}`);
                for (const id of holder)
                    details.appendChild(renderSecurityFingerprint(id, this.localize));
            }
            this.text(details, this.localize("trustNetworkKeyStatementMissing"));
        }
        const button = this.button(card, "trustAnchorDeleteLabel", () => {
            void this.mutate(button, async () => this.store.deleteAnchor(record.id), generation);
        }, "trustManagementDelete");
    }

    private renderNetworkDetails(parent: HTMLElement, network: StoredRoamingNetwork,
                                  deletedKeys: ReadonlySet<string>, generation: number): void {
        parent.dataset["networkId"] = network.id;
        const title = parent.appendChild(document.createElement("h4"));
        title.textContent = roamingNetworkDisplayName(network, this.language());
        this.text(parent, `${this.localize("trustAnchorNetworkLabel")}: ${network.id}`, "trustManagementIdentifier");
        this.text(parent, this.localize("trustNetworkNameSource"));
        this.text(parent, this.localize(network.context === undefined ? "trustNetworkIdentityUnverified" : "trustNetworkIdentityVerified"));
        if (network.context !== undefined)
            this.text(parent, `${this.localize("trustDataOperatorLabel")}: ${network.context.roamingNetworkOperatorId}`, "trustManagementIdentifier");
        if(network.context?.effectivePolicyId!==undefined){
            this.text(parent,'Epoch '+String(network.context.epoch??1));
            parent.appendChild(renderSecurityFingerprint(network.context.effectivePolicyId,this.localize));
        }
        this.text(parent, `${this.localize("trustNetworkAnchorCount")}: ${network.anchors.length}`);
        const policy = network.anchors[0];
        if (policy !== undefined)
            this.button(parent, 'poiCheckStation', () => {
                if (this.stationPolicyId !== policy.id) this.stationQuery = '';
                this.stationPolicyId = policy.id;
                this.page = 'stationProof';
                void this.render();
            }, 'settingsEntry');
        if (network.anchors.every(record => record.downloadedData === undefined)) {
            const statement = parent.appendChild(document.createElement("section"));
            statement.className = "trustNetworkKeyStatement";
            const heading = statement.appendChild(document.createElement("h4"));
            heading.textContent = this.localize("trustNetworkKeyStatementTitle");
            statement.appendChild(renderTrustAnchorValidation(
                { signatures: "unavailable", signers: "unavailable", quorum: "unavailable" }, this.localize,
                activeBundledPublicKeys(this.bundledKeys, deletedKeys).length, "trustNetworkKeyStatementMissing"
            ));
        }
        this.text(parent, this.localize("trustNetworkPoliciesSeparate"));
        for (const record of network.anchors)
            this.renderAnchor(parent, record, generation, deletedKeys);
        for(const record of network.anchors)renderTrustTransitionManager(parent,record,this.store,this.bundledKeys,this.localize,()=>this.generation===generation,()=>{void this.render();});
        const removal = parent.appendChild(document.createElement("div"));
        removal.className = "trustNetworkRemoval";
        this.text(removal, this.localize("trustNetworkDeleteDescription"));
        const button = this.button(removal, "trustNetworkDeleteLabel", () => {
            void this.mutate(button, async () => {
                await this.store.deleteRoamingNetwork(network.anchors.map(record => record.id));
                if (this.generation === generation) {
                    this.page = "networks";
                    this.selectedNetworkId = null;
                }
            }, generation);
        }, "trustManagementDelete");
    }

    private async render(): Promise<void> {
        this.disposeStationPanel();
        const generation = ++this.generation;
        this.root.replaceChildren();
        const settings = this.root.closest<HTMLElement>("#settingsScreen");
        if (settings !== null)
            settings.scrollTop = 0;
        this.root.dataset["page"] = this.page;
        const heading = this.root.appendChild(document.createElement("h2"));
        heading.textContent = this.localize("trustManagementTitle");
        if (this.page === "menu") {
            this.button(this.root, "trustRoamingNetworksTitle", () => { this.page = "networks"; void this.render(); }, "settingsEntry");
            this.button(this.root, "trustAnchorsTitle", () => { this.page = "anchors"; void this.render(); }, "settingsEntry");
            this.button(this.root, "trustBundledKeysTitle", () => { this.page = "keys"; void this.render(); }, "settingsEntry");
            this.button(this.root, 'poiHistoryArchiveTitle', () => { this.page = 'archives'; void this.render(); }, 'settingsEntry');
            this.button(this.root,'poiObservedTitle',()=>{this.page='observations';void this.render();},'settingsEntry');
            this.button(this.root,'poiWitnessTitle',()=>{this.page='witnesses';void this.render();},'settingsEntry');
            return;
        }

        const title = this.root.appendChild(document.createElement("h3"));
        const titles = { witnesses:'poiWitnessTitle', observations:'poiObservedTitle', archives:'poiHistoryArchiveTitle', anchors: "trustAnchorsTitle", keys: "trustBundledKeysTitle", networks: "trustRoamingNetworksTitle", networkDetails: "trustRoamingNetworkDetailsTitle", stationProof: 'poiCheckStation' };
        title.textContent = this.localize(titles[this.page]);
        const descriptions = { witnesses:'poiWitnessDescription', observations:'poiObservedDescription', archives:'poiHistoryArchiveDescription', anchors: "trustAnchorsStorageDescription", keys: "trustBundledKeysDescription", networks: "trustRoamingNetworksDescription", networkDetails: "trustRoamingNetworkDetailsDescription", stationProof: 'poiStationDescription' };
        this.text(this.root, this.localize(descriptions[this.page]));
        const list = this.root.appendChild(document.createElement("div"));
        list.className = "trustManagementList";
        list.setAttribute("aria-busy", "true");
        try {
            if(this.page==='witnesses'){
                await renderPOIWitnessManagement(list,this.localize,()=>this.generation===generation,()=>{void this.render();});
            }
            else if(this.page==='observations'){
                const store=new POIObservedHistoryStore(),records=(await store.list()).filter(record=>record.state.points.length>0||record.state.conflicts.length>0);
                if(this.generation!==generation)return;
                if(records.length===0)this.text(list,this.localize('poiObservedEmpty'));
                for(const record of records){
                    const card=list.appendChild(document.createElement('article'));card.className='trustManagementCard';card.dataset['observationId']=record.id;
                    this.text(card,record.roamingNetworkId+' · '+record.operatorId);this.text(card,this.localize('poiObservedCount')+': '+String(record.state.points.length));
                    this.text(card,this.localize('poiObservedConflicts')+': '+String(record.state.conflicts.length));
                    for(const [key,head]of Object.entries(record.state.heads)){
                        this.text(card,key+' · '+head.epoch+' / '+String(head.position));
                        if(key.startsWith('["live",')&&this.openObservedLive!==undefined){
                            const parsed=JSON.parse(key) as [string,string];const open=this.button(card,'poiObservedOpenLive',()=>{
                                open.disabled=true;void this.openObservedLive?.(record,parsed[1]).catch(()=>{open.disabled=false;this.text(card,this.localize('poiObservedOpenFailed'));});
                            });open.dataset['action']='open-observed-live';
                        }
                    }
                    const detail=card.appendChild(document.createElement('details'));detail.appendChild(document.createElement('summary')).textContent=this.localize('poiObservedDetails');
                    detail.appendChild(document.createElement('pre')).textContent=JSON.stringify(record.state,null,2);
                    const reset=this.button(card,'poiObservedReset',()=>{
                        reset.disabled=true;const warning=this.text(card,this.localize('poiObservedResetWarning'));warning.setAttribute('role','alert');
                        const confirm=this.button(card,'poiObservedResetConfirm',()=>{void this.mutate(confirm,async()=>store.reset(record.id),generation);},'trustManagementDelete');confirm.dataset['action']='confirm-reset-observations';
                    },'trustManagementDelete');reset.dataset['action']='reset-observations';
                }
            }
            else if (this.page === 'archives') {
                const store = new SessionEvidenceStore(); const records = await store.list();
                if (this.generation !== generation) return;
                if (records.length === 0) this.text(list,this.localize('poiHistoryArchiveEmpty'));
                for (const record of records) {
                    const card = list.appendChild(document.createElement('article')); card.className = 'trustManagementCard'; card.dataset['archiveId'] = record.id;
                    this.text(card,record.evseId,'trustManagementIdentifier');
                    this.text(card,new Date(record.savedAt).toLocaleString(this.language()));
                    this.text(card,this.localize('poiHistoryArchiveRecheck'));
                    if (this.openArchive !== undefined) {
                        const button = this.button(card,'poiHistoryOpen',() => {
                            button.disabled = true;
                            void this.openArchive?.(record.document).catch(() => { button.disabled = false; this.text(card,this.localize('poiHistoryFailed')); });
                        }); button.dataset['action'] = 'open-archive';
                    }
                    const exportButton = this.button(card,'poiHistoryExport',() => {
                        const blob = new Blob([record.document],{type:'application/json'}); const url = URL.createObjectURL(blob);
                        const link = document.createElement('a'); link.href = url; link.download = 'chargy-evidence-' + record.id.slice(0,12) + '.chargy';
                        document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => { URL.revokeObjectURL(url); },1000);
                    }); exportButton.dataset['action'] = 'export-archive';
                    const details = card.appendChild(document.createElement('details'));
                    details.appendChild(document.createElement('summary')).textContent = this.localize('poiHistoryPolicySnapshot');
                    details.appendChild(document.createElement('pre')).textContent = record.policySnapshot;
                    const remove = this.button(card,'poiHistoryDelete',() => { void this.mutate(remove,async () => store.delete(record.id),generation); },'trustManagementDelete');
                    remove.dataset['action'] = 'delete-archive';
                }
            }
            else if (this.page === 'stationProof' && this.stationPolicyId !== null) {
                const panel = new StationProofPanel(list, this.store, new POITrustService(this.store, this.bundledKeys),
                    this.stationPolicyId, this.localize, this.language(), this.allowances, this.stationQuery);
                this.stationPanel = panel;
                await panel.mount();
            }
            else if (this.page === "networks" || this.page === "networkDetails") {
                const { records: anchors, deleted: deletedKeys } = await this.store.listTrustSnapshot();
                if (this.generation !== generation)
                    return;
                const networks = groupRoamingNetworks(anchors, this.bundledKeys, deletedKeys);
                if (this.page === "networkDetails") {
                    const network = networks.find(entry => entry.identity === this.selectedNetworkId);
                    if (network === undefined) {
                        this.page = "networks";
                        this.selectedNetworkId = null;
                        await this.render();
                        return;
                    }
                    this.renderNetworkDetails(list, network, deletedKeys, generation);
                }
                else {
                    if (networks.length === 0)
                        this.text(list, this.localize("trustRoamingNetworksEmpty"));
                    for (const network of networks) {
                        const button = this.button(list, "trustNetworkOpenLabel", () => {
                            this.selectedNetworkId = network.identity;
                            this.page = "networkDetails";
                            void this.render();
                        }, "settingsEntry trustNetworkEntry");
                        button.dataset["networkId"] = network.id;
                        button.dataset["networkIdentity"] = network.identity;
                        button.replaceChildren();
                        const text = button.appendChild(document.createElement("div"));
                        const name = text.appendChild(document.createElement("strong"));
                        name.textContent = roamingNetworkDisplayName(network, this.language());
                        this.text(text, `${network.id} · ${this.localize("trustNetworkAnchorCount")}: ${network.anchors.length}`);
                        this.text(text, this.localize(network.context === undefined ? "trustNetworkIdentityUnverified" : "trustNetworkIdentityVerified"));
                        if (network.context !== undefined)
                            this.text(text, `${this.localize("trustDataOperatorLabel")}: ${network.context.roamingNetworkOperatorId}`);
                        this.text(text, this.localize("trustNetworkOpenLabel"));
                    }
                }
            }
            else if (this.page === "anchors") {
                const { records: anchors, deleted: deletedKeys } = await this.store.listTrustSnapshot();
                if (this.generation !== generation)
                    return;
                if (anchors.length === 0)
                    this.text(list, this.localize("trustAnchorsEmpty"));
                for (const record of anchors)
                    this.renderAnchor(list, record, generation, deletedKeys);
            }
            else {
                const deleted = await this.store.deletedBundledKeyIds();
                if (this.generation !== generation)
                    return;
                if (this.bundledKeys.length === 0)
                    this.text(list, this.localize("trustBundledKeysEmpty"));
                for (const key of this.bundledKeys) {
                    const isDeleted = deleted.has(key.id);
                    const card = list.appendChild(document.createElement("article"));
                    card.className = "trustManagementCard";
                    card.dataset["keyId"] = key.id;
                    card.dataset["state"] = isDeleted ? "deleted" : "active";
                    if (key.holder !== undefined)
                        this.text(card, key.holder);
                    card.appendChild(renderSecurityFingerprint(key.id, this.localize));
                    this.text(card, this.localize(isDeleted ? "trustBundledKeyDeleted" : "trustBundledKeyActive"));
                    const details = card.appendChild(document.createElement("details"));
                    const summary = details.appendChild(document.createElement("summary"));
                    summary.textContent = this.localize("publicKeyLabel");
                    this.text(details, toBase64(key.keyBytes), "trustManagementIdentifier");
                    const button = this.button(card, isDeleted ? "trustBundledKeyRestore" : "trustBundledKeyDelete", () => {
                        void this.mutate(button, async () => isDeleted ? this.store.restoreBundledKey(key.id) : this.store.deleteBundledKey(key.id), generation);
                    }, isDeleted ? "" : "trustManagementDelete");
                }
            }
        }
        catch {
            if (this.generation === generation) {
                const error = this.text(list, this.localize("trustStorageError"), "trustManagementError");
                error.setAttribute("role", "alert");
                this.button(list, "trustRetryLabel", () => { void this.render(); });
            }
        }
        finally {
            if (this.generation === generation) {
                if (settings !== null)
                    settings.scrollTop = 0;
                list.setAttribute("aria-busy", "false");
            }
        }
    }
}
