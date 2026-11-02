import type { VerifiedMeterKeyBinding } from '@open-charging-cloud/wwcp-poi';
import type { IBoundOCMFResult, IMeasurementValue } from '@open-charging-cloud/chargy-core';
import { renderSecurityFingerprint } from './securityFingerprintView';

export interface SessionMeterKeyCheck {
    readonly binding: VerifiedMeterKeyBinding;
    readonly result?: IBoundOCMFResult;
}

/** Separate authorization, original-signature checks and historical uncertainty. No cached green flag. */
export function renderSessionMeterKey(check: SessionMeterKeyCheck, localize: (key: string) => string,
    language: string, showReading: (value: IMeasurementValue) => void): HTMLElement {
    const root = document.createElement('section');
    root.className = 'sessionMeterKeyResult';
    const result = check.result;
    const successful = result === undefined || result.status === 'verified';
    root.dataset['state'] = successful ? 'valid' : result.status === 'unsupported' || result.status === 'key-conflict' ? 'warning' : 'invalid';
    root.dataset['check'] = result?.status ?? 'prepared';
    const title = root.appendChild(document.createElement('p'));
    title.textContent = (successful ? '✅ ' : '') + localize(result?.status === 'evidence-expired' ? 'poiMeterEvidenceExpired' : 'poiMeterAssociatedNow');
    const description = root.appendChild(document.createElement('p'));
    description.textContent = `${check.binding.evseId} · ${check.binding.meterSerialNumber}`;
    const outcome = root.appendChild(document.createElement('p'));
    if (result === undefined) outcome.textContent = localize('poiMeterWaiting');
    else outcome.textContent = localize(result.status === 'verified' && result.readingPhase === 'start-only' ? 'poiMeterStartReadingVerified' : { verified: 'poiMeterReadingsVerified', 'key-conflict': 'poiMeterKeyConflict',
        'identity-conflict': 'poiMeterIdentityConflict', 'record-conflict': 'poiMeterRecordConflict',
        'invalid-signature': 'poiMeterSignatureFailed', unsupported: 'poiMeterUnsupported', 'evidence-expired': 'poiMeterEvidenceExpired' }[result.status]);
    if (result !== undefined) {
        const counts = root.appendChild(document.createElement('p'));
        counts.textContent = `${localize('poiMeterDocumentCount')}: ${result.signatureCount} · ${localize('poiMeterReadingCount')}: ${result.measurementCount}`;
        if (result.status === 'key-conflict')
            root.appendChild(document.createElement('p')).textContent = localize(result.signaturesValid ? 'poiMeterConflictSignaturesValid' : 'poiMeterSignatureFailed');
        if (result.status === 'verified' && result.readingPhase === 'start-only')
            root.appendChild(document.createElement('p')).textContent = localize('poiMeterConsumptionPending');
    }
    const historical = root.appendChild(document.createElement('p'));
    historical.className = 'poiMeterHistorical';
    historical.textContent = localize('poiMeterHistoricalUnknown');
    const details = root.appendChild(document.createElement('details'));
    details.appendChild(document.createElement('summary')).textContent = localize('poiMeterKeyDetails');
    details.appendChild(document.createElement('p')).textContent = `${localize('poiMeterId')}: ${check.binding.meterId}`;
    details.appendChild(document.createElement('p')).textContent = `${localize('poiMeterDeclaredId')}: ${check.binding.key.idScheme}`;
    details.appendChild(renderSecurityFingerprint(check.binding.key.id, localize));
    details.appendChild(document.createElement('p')).textContent = localize('poiMeterCanonicalId');
    details.appendChild(renderSecurityFingerprint(check.binding.key.canonicalId, localize));
    details.appendChild(document.createElement('p')).textContent = `${localize('poiCheckedAt')}: ${new Date(check.binding.evidence.verifiedAt).toLocaleString(language)}`;
    details.appendChild(document.createElement('p')).textContent = `${localize('trustDataValidUntilLabel')}: ${new Date(check.binding.evidence.validUntil).toLocaleString(language)}`;
    details.appendChild(document.createElement('p')).textContent = `${localize('poiCommit')}: ${check.binding.evidence.commitId}`;
    if (result !== undefined) {
        details.appendChild(document.createElement('pre')).textContent = result.detail;
        for (const session of result.record?.chargingSessions ?? [])
            for (const measurement of session.measurements ?? [])
                for (const value of measurement.values) {
                    const button = details.appendChild(document.createElement('button'));
                    button.type = 'button';
                    button.textContent = `${new Date(value.timestamp).toLocaleString(language)} · ${value.value.toString()} ${measurement.unit ?? ''}`;
                    button.onclick = (): void => { showReading(value); };
                }
    }
    return root;
}
