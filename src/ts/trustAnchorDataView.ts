import { toBase64 } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey, TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import type { LoadedTrustAnchorData } from './trustAnchorData';
import { validateTrustAnchorData, validateHistoricalReferenceData } from './trustAnchorData';
import type { StoredTrustAnchor } from './trustStore';
import { activeBundledPublicKeys } from './trustStore';
import { renderTrustAnchorValidation } from './trustAnchorPreview';
import { renderAnchorKeyTrust } from './anchorKeyTrustView';
import { renderSecurityFingerprint } from './securityFingerprintView';

/** Step two: source document, real verification and optional trust decisions. Never downloads by itself. */
export function renderTrustAnchorData(anchor: TrustAnchor, data: LoadedTrustAnchorData,
                                      options: {
                                          readonly record: StoredTrustAnchor | undefined;
                                          readonly bundled: readonly POIPublicKey[];
                                          readonly deleted: ReadonlySet<string>;
                                          readonly localize: (key: string) => string;
                                          readonly onChange: (id: string, trusted: boolean) => Promise<void>;
                                          readonly historicalReference?: boolean;
                                      }): HTMLElement {
    const { localize } = options;
    const root = document.createElement("section");
    root.className = "trustAnchorPreview trustAnchorLoadedData";
    root.dataset["stage"] = "downloaded";
    const heading = root.appendChild(document.createElement("h2"));
    heading.textContent = localize("trustDataTitle");
    const result = validateTrustAnchorData(anchor, data, options.record, options.bundled, options.deleted);
    const historical = options.historicalReference === true ? validateHistoricalReferenceData(anchor,data,options.record,options.bundled,options.deleted) : undefined;
    if (historical !== undefined) {
        const note = root.appendChild(document.createElement('p')); note.dataset['historicalReference'] = 'true';
        note.textContent = localize('poiHistoryReferenceImport');
    }
    const status = root.appendChild(document.createElement("p"));
    const saved = options.record?.downloadedData?.text === data.document.text && options.record.downloadedData.sourceURL === data.document.sourceURL;
    status.textContent = localize(saved ? "trustAnchorSavedStatus" : historical !== undefined && options.record?.downloadedData !== undefined ? 'poiHistoryExistingReference' : "trustDataNotSaved");
    root.appendChild(renderTrustAnchorValidation({ ...result, reasons: {
        signatures: localize(result.signatures === "valid" ? "trustAnchorCheckPassed" : "trustAnchorCheckFailed") + ` (${result.signatureCount})`,
        quorum: `${result.trustedHolderCount} / ${result.requiredConsensus} · ${localize(result.quorum === "valid" ? "trustAnchorCheckPassed" : "trustAnchorCheckFailed")}`
    } }, localize, activeBundledPublicKeys(options.bundled, options.deleted).length));
    const fields = root.appendChild(document.createElement("dl"));
    const field = (label: string, value: string): void => {
        const term = fields.appendChild(document.createElement("dt"));
        term.textContent = localize(label);
        const content = fields.appendChild(document.createElement("dd"));
        content.textContent = value;
        content.className = "trustManagementIdentifier trustAnchorMonospace";
    };
    field("trustAnchorNetworkLabel", data.statement.roamingNetworkId);
    field("trustDataOperatorLabel", data.statement.roamingNetworkOperatorId);
    field("trustDataSignedAtLabel", new Date(data.statement.signedAt).toISOString());
    field("trustDataValidUntilLabel", new Date(data.statement.validUntil).toISOString());
    field(data.document.origin === 'embedded' ? 'poiDeclaredSource' : 'trustDataSourceLabel', data.document.sourceURL);
    field(data.document.origin === 'embedded' ? 'poiReceivedAt' : 'trustDataDownloadedAtLabel', data.document.downloadedAt);
    if (data.document.origin === 'embedded')
        root.appendChild(document.createElement('p')).textContent = localize('poiEmbeddedStatement');
    root.appendChild(renderAnchorKeyTrust(anchor, {
        ...options, loadedKeys: data.identityKeys, allowChanges: result.canTrustKeys || historical?.canTrustKeys === true
    }));
    const keys = root.appendChild(document.createElement("details"));
    const summary = keys.appendChild(document.createElement("summary"));
    summary.textContent = `${localize("trustDataKeysLabel")} (${data.statement.identityKeys.length})`;
    for (const key of data.statement.identityKeys) {
        const item = keys.appendChild(document.createElement("div"));
        const title = item.appendChild(document.createElement("p"));
        title.textContent = key.holder ?? "";
        item.appendChild(renderSecurityFingerprint(key.id, localize));
        const value = item.appendChild(document.createElement("pre"));
        value.textContent = toBase64(key.keyBytes);
    }
    const raw = root.appendChild(document.createElement("details"));
    raw.appendChild(document.createElement("summary")).textContent = localize("trustDataRawLabel");
    raw.appendChild(document.createElement("pre")).textContent = data.document.text;
    if (result.verificationError !== undefined) {
        const error = root.appendChild(document.createElement("details"));
        error.appendChild(document.createElement("summary")).textContent = localize("trustDataDiagnosticLabel");
        error.appendChild(document.createElement("pre")).textContent = result.verificationError;
    }
    return root;
}
