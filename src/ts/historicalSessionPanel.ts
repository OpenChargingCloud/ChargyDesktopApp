import {renderPOIConsistency} from './poiConsistencyView';
import type {VersionComparison} from '@open-charging-cloud/wwcp-poi';
import type { HistoricalMeterVerification } from '@open-charging-cloud/wwcp-poi';
import type { IHistoricalOCMFResult, IMeasurementValue } from '@open-charging-cloud/chargy-core';
import { renderSecurityFingerprint } from './securityFingerprintView';

export interface HistoricalSessionCheck {
    readonly consistency?:VersionComparison;
    readonly evidence: HistoricalMeterVerification;
    readonly readings: IHistoricalOCMFResult;
}
export interface HistoricalSessionActions {
    readonly check: (policyId: string, signal: AbortSignal) => Promise<HistoricalSessionCheck>;
    readonly save: (policyId: string, signal: AbortSignal) => Promise<void>;
    readonly showReading: (value: IMeasurementValue) => void;
}

export class HistoricalSessionPanel {
    private controller: AbortController | null = null;
    public constructor(private readonly root: HTMLElement, private readonly actions: HistoricalSessionActions,
        private readonly localize: (key: string) => string, private readonly language: string) { root.className = 'historicalSession'; }
    public dispose(): void { this.controller?.abort(); this.controller = null; }
    public async check(policyId: string): Promise<void> {
        this.dispose(); this.root.replaceChildren();
        this.root.appendChild(document.createElement('h4')).textContent = this.localize('poiHistoryTitle');
        if (policyId === '') { this.root.appendChild(document.createElement('p')).textContent = this.localize('poiChoosePolicy'); return; }
        const controller = new AbortController(); this.controller = controller;
        const body = this.root.appendChild(document.createElement('div')); body.className = 'historicalSessionResult'; body.dataset['state'] = 'pending';
        body.setAttribute('role','status'); body.textContent = this.localize('poiHistoryChecking');
        try {
            const checked = await this.actions.check(policyId,controller.signal); controller.signal.throwIfAborted();
            body.replaceChildren();
            const row = (key: string, valid: boolean): void => {
                const p = body.appendChild(document.createElement('p')); p.dataset['state'] = valid ? 'valid' : 'warning';
                p.textContent = (valid ? '✅ ' : '⏳ ') + this.localize(key);
            };
            if(checked.consistency!==undefined)body.appendChild(renderPOIConsistency(checked.consistency,this.localize));
            const association = checked.readings.checks.every(check => check.historicalAssociation === 'rno-attested-at-reading-times');
            row(checked.readings.signaturesValid ? 'poiHistorySignaturesValid' : 'poiMeterSignatureFailed',checked.readings.signaturesValid);
            row(association ? 'poiHistoryAssociationValid' : 'poiHistoryAssociationUnproven',association);
            if (checked.readings.checks.some(check => check.status === 'key-conflict')) row('poiMeterKeyConflict',false);
            const inclusion = checked.evidence.versions.every(version => version.publication !== 'missing');
            body.dataset['state'] = checked.consistency?.accepted===false?'invalid':checked.readings.status === 'verified' && inclusion ? 'valid' : 'warning';
            row(inclusion ? 'poiHistoryInclusionValid' : 'poiHistoryInclusionMissing',inclusion);
            const witnessed = checked.evidence.versions.every(version => version.publication === 'witnessed-checkpoint');
            row(witnessed ? 'poiHistoryWitnessed' : 'poiHistoryWitnessMissing',witnessed);
            body.appendChild(document.createElement('p')).textContent = this.localize('poiHistoryTimeLimit');
            const details = body.appendChild(document.createElement('details'));
            details.appendChild(document.createElement('summary')).textContent = this.localize('poiHistoryDetails');
            details.appendChild(document.createElement('p')).textContent = `${this.localize('poiCheckedAt')}: ${new Date(checked.evidence.checkedAt).toLocaleString(this.language)}`;
            for (const binding of checked.evidence.bindings) {
                details.appendChild(document.createElement('p')).textContent = `${binding.evseId} · ${binding.meterSerialNumber} · ${binding.evidence.measurementTimes.map(time => new Date(time).toLocaleString(this.language)).join(', ')}`;
                details.appendChild(document.createElement('p')).textContent = `${this.localize('poiCommit')}: ${binding.evidence.commitId}`;
                details.appendChild(renderSecurityFingerprint(binding.key.id,this.localize));
            }
            details.appendChild(document.createElement('pre')).textContent = JSON.stringify(checked.evidence.versions,null,2);
            for (const check of checked.readings.checks) {
                details.appendChild(document.createElement('p')).textContent = check.detail;
                for (const session of check.record?.chargingSessions ?? []) for (const measurement of session.measurements ?? []) for (const value of measurement.values) {
                    const button = details.appendChild(document.createElement('button')); button.type = 'button';
                    button.textContent = `${new Date(value.timestamp).toLocaleString(this.language)} · ${value.value.toString()} ${measurement.unit ?? ''}`;
                    button.onclick = (): void => { this.actions.showReading(value); };
                }
            }
            const save = body.appendChild(document.createElement('button')); save.type = 'button'; save.dataset['action'] = 'save-evidence';
            save.textContent = this.localize('poiHistorySave');
            let saveError: HTMLElement | null = null;
            save.onclick = (): void => {
                saveError?.remove(); saveError = null;
                save.disabled = true;
                void this.actions.save(policyId,controller.signal).then(() => {
                    if (!controller.signal.aborted) save.textContent = this.localize('poiHistorySaved');
                }).catch(() => {
                    if (controller.signal.aborted) return;
                    save.disabled = false;
                    saveError = body.appendChild(document.createElement('p')); saveError.setAttribute('role','alert');
                    saveError.textContent = this.localize('poiHistorySaveFailed');
                });
            };
        }
        catch (error) {
            if (controller.signal.aborted) return;
            body.replaceChildren(); body.dataset['state'] = 'invalid';
            body.appendChild(document.createElement('p')).textContent = this.localize('poiHistoryFailed');
            const details = body.appendChild(document.createElement('details'));
            details.appendChild(document.createElement('summary')).textContent = this.localize('poiDiagnostics');
            details.appendChild(document.createElement('pre')).textContent = error instanceof Error ? error.message : String(error);
        }
    }
}
