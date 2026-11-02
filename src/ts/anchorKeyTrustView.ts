import type { POIPublicKey, TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import { anchorKeyTrustState } from './anchorKeyTrust';
import type { StoredTrustAnchor } from './trustStore';
import { toBase64 } from '@open-charging-cloud/wwcp-poi';
import { renderSecurityFingerprint } from './securityFingerprintView';

export interface AnchorKeyTrustOptions {
    readonly record?: StoredTrustAnchor | undefined;
    readonly bundled: readonly POIPublicKey[];
    readonly deleted: ReadonlySet<string>;
    readonly localize: (key: string) => string;
    readonly onChange: (keyId: string, trusted: boolean) => Promise<void>;
    readonly loadedKeys?: readonly POIPublicKey[];
    readonly allowChanges?: boolean;
}

/** An optional decision after loading and verifying the actual key material. */
export function renderAnchorKeyTrust(anchor: TrustAnchor, options: AnchorKeyTrustOptions): HTMLElement {
    const root = document.createElement("section");
    root.className = "anchorKeyTrust";
    const text = (parent: HTMLElement, value: string, className: string = ""): HTMLElement => {
        const element = parent.appendChild(document.createElement("p"));
        element.textContent = value;
        element.className = className;
        return element;
    };
    const button = (parent: HTMLElement, label: string, action: () => void): HTMLButtonElement => {
        const element = parent.appendChild(document.createElement("button"));
        element.type = "button";
        element.textContent = options.localize(label);
        element.onclick = action;
        return element;
    };
    const heading = root.appendChild(document.createElement("h3"));
    heading.textContent = options.localize("trustManualTitle");
    text(root, options.localize(options.record === undefined ? "trustManualImportFirst" : "trustManualDescription"));

    const change = async (parent: HTMLElement, keyId: string, trusted: boolean): Promise<void> => {
        const controls = [...root.querySelectorAll<HTMLButtonElement>("button")];
        for (const control of controls)
            control.disabled = true;
        parent.querySelector("[role=alert]")?.remove();
        try {
            await options.onChange(keyId, trusted);
        }
        catch {
            const error = text(parent, options.localize("trustStorageError"), "trustManagementError");
            error.setAttribute("role", "alert");
            for (const control of controls)
                control.disabled = false;
        }
    };

    for (const [index, holder] of anchor.holders.entries()) {
        const group = root.appendChild(document.createElement("div"));
        group.className = "trustAnchorHolder";
        text(group, `${options.localize("trustAnchorHolderLabel")} ${index + 1}`);
        for (const id of holder) {
            const row = group.appendChild(document.createElement("div"));
            row.className = "anchorKeyTrustKey";
            row.dataset["keyId"] = id;
            row.appendChild(renderSecurityFingerprint(id, options.localize));
            const content = row.appendChild(document.createElement("div"));
            content.className = "anchorKeyTrustContent";
            const state = anchorKeyTrustState(anchor, id, options.record, options.bundled, options.deleted);
            const labels = { bundled: "trustNetworkKeyTrusted", manual: "trustManualAccepted", unknown: "trustNetworkKeyUnknown",
                             deleted: "trustNetworkKeyDeleted", expired: "trustNetworkKeyExpired" };
            const status = text(content, options.localize(labels[state]), "trustNetworkKeyStatus");
            status.dataset["keyTrust"] = state;
            const material = options.loadedKeys?.find(key => key.id === id);
            if (material !== undefined) {
                const details = content.appendChild(document.createElement("details"));
                const summary = details.appendChild(document.createElement("summary"));
                summary.textContent = options.localize("publicKeyLabel");
                if (material.holder !== undefined)
                    text(details, material.holder);
                text(details, toBase64(material.keyBytes), "trustManagementIdentifier trustAnchorMonospace");
            }
            const decision = options.record?.trustedKeys?.find(key => key.id === id);
            if (decision !== undefined) {
                text(content, `${options.localize("trustManualAcceptedAt")}: ${decision.acceptedAt}`);
                const revoke = button(content, "trustManualRevoke", () => { void change(content, id, false); });
                revoke.dataset["action"] = "revoke-key";
            }
            else if (options.record !== undefined && options.allowChanges === true && material !== undefined && state !== "bundled" && state !== "expired") {
                const accept = button(content, "trustManualStart", () => {
                    accept.hidden = true;
                    const confirmation = content.appendChild(document.createElement("section"));
                    confirmation.className = "trustManualConfirmation";
                    const explanation = text(confirmation, options.localize("trustManualConfirmDescription"));
                    explanation.tabIndex = -1;
                    if (state === "deleted")
                        text(confirmation, options.localize("trustManualDeletedKeyNote"));
                    text(confirmation, `${options.localize("trustAnchorNetworkLabel")}: ${anchor.id}`);
                    text(confirmation, `${options.localize("trustAnchorHolderLabel")} ${index + 1} · ${options.localize("trustAnchorQuorumLabel")}: ${anchor.minConsensus} / ${anchor.holders.length}`);
                    for (const url of anchor.urls)
                        text(confirmation, url, "trustManagementIdentifier");
                    confirmation.appendChild(renderSecurityFingerprint(id, options.localize));
                    const confirm = button(confirmation, "trustManualConfirm", () => { void change(confirmation, id, true); });
                    confirm.dataset["action"] = "confirm-key";
                    button(confirmation, "trustManualCancel", () => { confirmation.remove(); accept.hidden = false; accept.focus(); });
                    explanation.focus();
                });
                accept.dataset["action"] = "accept-key";
            }
        }
    }
    return root;
}
