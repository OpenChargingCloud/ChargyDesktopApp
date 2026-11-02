import { parseJSON } from '@open-charging-cloud/wwcp-poi';
import type { POITrustService } from './poiTrustContext';
import type { TrustStore, StoredStationProof } from './trustStore';
import { loadStationProof, StationProofLoadError } from './stationProofData';
import type { LoadedStationProof, StationProofDocument } from './stationProofData';
import type { ITransportAllowances } from './liveLinkTrust';
import { stationEVSEId } from './poiURLs';
import { renderStationProof } from './stationProofView';
import {POIHistoryError} from './poiTrustContext';
import {renderPOIConsistency} from './poiConsistencyView';

/** Owns one settings-page operation. Navigation, cancellation and a newer operation invalidate all pending UI writes. */
export class StationProofPanel {
    private readonly input: HTMLInputElement;
    private readonly submit: HTMLButtonElement;
    private readonly cancel: HTMLButtonElement;
    private readonly message: HTMLElement;
    private readonly result: HTMLElement;
    private readonly history: HTMLElement;
    private operation: AbortController | null = null;
    private generation = 0;
    private historyGeneration = 0;
    private disposed = false;
    private ready = false;
    private lastProof: { readonly document: StationProofDocument; readonly evseId: string } | null = null;
    private readonly focus = (): void => {
        if (!this.disposed && this.operation === null && this.lastProof !== null)
            void this.openDocument(this.lastProof.document, this.lastProof.evseId);
    };

    public constructor(private readonly root: HTMLElement, private readonly store: TrustStore,
                        private readonly trust: POITrustService, private readonly policyId: string,
                        private readonly localize: (key: string) => string, private readonly language: string,
                        private readonly allowances: ITransportAllowances = {}, value: string = '',
                        private readonly subject?: { readonly evseId: string; readonly document?: StationProofDocument;
                            readonly onState?: (state: 'pending' | 'valid' | 'warning' | 'invalid' | 'idle', proof?: LoadedStationProof) => void }) {
        root.classList.add('poiStationPanel');
        const form = root.appendChild(document.createElement('form'));
        form.className = 'poiStationForm';
        const label = form.appendChild(document.createElement('label'));
        label.htmlFor = 'poiStationEVSE';
        label.textContent = localize('poiEVSEId');
        this.input = form.appendChild(document.createElement('input'));
        this.input.id = 'poiStationEVSE';
        this.input.name = 'evseId';
        this.input.type = 'text';
        this.input.required = true;
        this.input.maxLength = 256;
        this.input.autocomplete = 'off';
        this.input.spellcheck = false;
        this.input.placeholder = 'DE*GEF*E1*1';
        this.input.value = subject?.evseId ?? value;
        this.input.readOnly = subject !== undefined;
        this.input.oninput = (): void => { this.input.setCustomValidity(''); };
        const actions = form.appendChild(document.createElement('div'));
        this.submit = this.button(actions, 'poiLoadProof', () => undefined);
        this.submit.type = 'submit';
        this.submit.disabled = true;
        this.cancel = this.button(actions, 'poiCancel', () => {
            ++this.generation;
            this.operation?.abort();
            this.operation = null;
            this.busy(false);
            this.message.textContent = this.localize('poiCancelled');
            this.subject?.onState?.('idle');
        });
        this.cancel.hidden = true;
        form.onsubmit = (event): void => {
            event.preventDefault();
            if (this.operation !== null || !this.ready)
                return;
            let evseId: string;
            try { evseId = stationEVSEId(this.subject?.evseId ?? this.input.value); }
            catch {
                this.input.setCustomValidity(this.localize('poiEVSEInvalid'));
                this.input.reportValidity();
                return;
            }
            this.input.value = evseId;
            void this.run(async signal => loadStationProof(this.trust, this.policyId, evseId, {
                signal, allowances: this.allowances,
                onSource: url => { if (!this.disposed) this.message.textContent = `${this.localize('poiLoading')}: ${url}`; }
            }), false);
        };
        this.message = root.appendChild(document.createElement('p'));
        this.message.className = 'poiStationMessage';
        this.message.setAttribute('role', 'status');
        this.message.setAttribute('aria-live', 'polite');
        this.result = root.appendChild(document.createElement('div'));
        this.history = root.appendChild(document.createElement('section'));
        this.history.className = 'poiStationHistory';
        window.addEventListener('focus', this.focus);
    }

    public get value(): string { return this.input.value; }

    public async mount(): Promise<void> {
        this.message.textContent = this.localize('poiCheckingTrust');
        const results = await Promise.allSettled([this.trust.resolve(this.policyId), this.refreshHistory()]);
        if (this.disposed)
            return;
        const context = results[0];
        if (results[1].status === 'rejected')
            this.history.textContent = this.localize('trustStorageError');
        if (context.status === 'fulfilled') {
            this.ready = true;
            this.submit.disabled = false;
            this.message.textContent = `${this.localize('poiTrustReady')}: ${context.value.roamingNetworkId} / ${context.value.roamingNetworkOperatorId}`;
            if (this.subject?.document !== undefined) {
                const document = this.subject.document;
                const evseId = this.subject.evseId;
                await this.run(async signal => {
                    const verified = await this.trust.verifyStation(this.policyId, parseJSON(document.text), { evseId },signal);
                    signal.throwIfAborted();
                    return { ...verified, document, evseId };
                }, false);
            }
        }
        else {
            this.ready = false;
            this.message.textContent = this.localize('poiTrustRequired');
            this.showError(context.reason);
            this.button(this.result, 'trustRetryLabel', () => { this.result.replaceChildren(); void this.mount(); });
        }
    }

    public dispose(): void {
        this.disposed = true;
        ++this.generation;
        this.operation?.abort();
        this.operation = null;
        window.removeEventListener('focus', this.focus);
    }

    private button(parent: HTMLElement, label: string, action: () => void): HTMLButtonElement {
        const button = parent.appendChild(document.createElement('button'));
        button.type = 'button';
        button.textContent = this.localize(label);
        button.onclick = action;
        return button;
    }

    private busy(value: boolean): void {
        this.input.disabled = value;
        this.submit.disabled = value || !this.ready;
        this.cancel.hidden = !value;
        for (const button of this.history.querySelectorAll('button'))
            button.disabled = value;
        this.root.setAttribute('aria-busy', String(value));
    }

    private showError(error: unknown): void {
        this.subject?.onState?.('invalid');
        const box = this.result.appendChild(document.createElement('section'));
        box.className = 'poiStationFailure';
        box.setAttribute('role', 'alert');
        const reports=error instanceof POIHistoryError?[error.report]:error instanceof StationProofLoadError?error.attempts.flatMap(attempt=>attempt.consistency===undefined?[]:[attempt.consistency]):[];
        for(const report of reports)box.appendChild(renderPOIConsistency(report,this.localize));
        const message = box.appendChild(document.createElement('p'));
        message.textContent = this.localize('poiLoadFailed');
        const hint = box.appendChild(document.createElement('p'));
        hint.textContent = this.localize('poiRetryHint');
        const details = box.appendChild(document.createElement('details'));
        const summary = details.appendChild(document.createElement('summary'));
        summary.textContent = this.localize('poiDiagnostics');
        const pre = details.appendChild(document.createElement('pre'));
        pre.className = 'poiStationRaw';
        pre.textContent = error instanceof StationProofLoadError
            ? error.attempts.map(attempt => `${attempt.sourceURL}\n${this.localize(attempt.stage === 'download' ? 'poiDownloadStage' : 'poiVerificationStage')}: ${attempt.message}`).join('\n\n')
            : error instanceof Error ? error.message : String(error);
    }

    private async openDocument(document: StationProofDocument, evseId: string): Promise<void> {
        if (this.operation !== null)
            return;
        if (this.subject !== undefined && this.subject.evseId !== evseId)
            return;
        this.input.value = evseId;
        await this.run(async signal => {
            const result = await this.trust.verifyStation(this.policyId, parseJSON(document.text), { evseId },signal);
            signal.throwIfAborted();
            return { ...result, document, evseId };
        }, true);
    }

    private async run(load: (signal: AbortSignal) => Promise<LoadedStationProof>, cached: boolean): Promise<void> {
        if (this.disposed || this.operation !== null)
            return;
        const generation = ++this.generation;
        const controller = new AbortController();
        this.operation = controller;
        this.lastProof = null;
        this.result.replaceChildren();
        this.message.textContent = this.localize(cached ? 'poiRechecking' : 'poiLoading');
        this.subject?.onState?.('pending');
        this.busy(true);
        const active = (): boolean => !this.disposed && generation === this.generation && !controller.signal.aborted;
        try {
            const proof = await load(controller.signal);
            if (!active())
                return;
            let saved = cached;
            let storageError = false;
            if (!cached) {
                try { await this.store.saveStationProof(proof, controller.signal); saved = true; }
                catch { controller.signal.throwIfAborted(); storageError = true; }
            }
            if (!active())
                return;
            this.lastProof = { document: proof.document, evseId: proof.evseId };
            this.result.appendChild(renderStationProof(proof, { localize: this.localize, language: this.language, saved, cached }));
            this.subject?.onState?.(proof.station.warnings.length === 0 ? 'valid' : 'warning', proof);
            if (storageError) {
                const warning = this.result.appendChild(document.createElement('p'));
                warning.className = 'trustManagementError';
                warning.setAttribute('role', 'alert');
                warning.textContent = this.localize('poiSaveFailed');
                this.button(this.result, 'trustRetryLabel', () => {
                    void this.run(async signal => {
                        const verified = await this.trust.verifyStation(this.policyId, parseJSON(proof.document.text), { evseId: proof.evseId },signal);
                        signal.throwIfAborted();
                        return { ...verified, document: proof.document, evseId: proof.evseId };
                    }, false);
                });
            }
            this.message.textContent = this.localize('poiCheckComplete');
            await this.refreshHistory();
        }
        catch (error) {
            if (active()) {
                this.message.textContent = this.localize('poiLoadFailed');
                this.showError(error);
            }
        }
        finally {
            if (generation === this.generation) {
                this.operation = null;
                this.busy(false);
            }
        }
    }

    private async refreshHistory(): Promise<void> {
        const generation = ++this.historyGeneration;
        try {
            const all = await this.store.listStationProofs(this.policyId);
            const records = this.subject === undefined ? all : all.filter(record => record.evseId === this.subject?.evseId).slice(0, 10);
            if (this.disposed || generation !== this.historyGeneration)
                return;
            this.history.replaceChildren();
            const heading = this.history.appendChild(document.createElement('h3'));
            heading.textContent = this.localize('poiSavedProofs');
            const note = this.history.appendChild(document.createElement('p'));
            note.textContent = this.localize(records.length === 0 ? 'poiNoSavedProofs' : 'poiSavedProofsNotice');
            for (const record of records)
                this.renderSaved(record);
        }
        catch {
            if (!this.disposed && generation === this.historyGeneration) {
                this.history.replaceChildren();
                const error = this.history.appendChild(document.createElement('p'));
                error.className = 'trustManagementError';
                error.textContent = this.localize('trustStorageError');
            }
        }
    }

    private renderSaved(record: StoredStationProof): void {
        const card = this.history.appendChild(document.createElement('article'));
        card.className = 'poiSavedProof';
        const heading = card.appendChild(document.createElement('h4'));
        heading.textContent = record.evseId;
        const date = card.appendChild(document.createElement('p'));
        date.textContent = `${this.localize('poiRetrievedAt')}: ${new Date(record.downloadedAt).toLocaleString(this.language)}`;
        this.button(card, 'poiOpenSaved', () => { void this.openDocument(record, record.evseId); });
        const remove = this.button(card, 'poiDeleteSaved', () => {
            remove.disabled = true;
            void this.store.deleteStationProof(record.id).then(async () => {
                if (!this.disposed) {
                    if (this.lastProof?.document.text === record.text && this.lastProof.evseId === record.evseId) {
                        this.lastProof = null;
                        this.result.replaceChildren();
                        this.message.textContent = this.localize('poiSavedProofDeleted');
                    }
                    await this.refreshHistory();
                }
            }).catch(() => {
                if (!this.disposed) { remove.disabled = false; date.textContent = this.localize('trustStorageError'); }
            });
        });
        remove.className = 'trustManagementDelete';
        for (const button of card.querySelectorAll('button'))
            button.disabled = this.operation !== null;
    }
}
