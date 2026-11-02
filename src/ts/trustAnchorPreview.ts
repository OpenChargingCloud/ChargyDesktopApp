import { TrustAnchor, TRUST_ANCHOR_QR_PREFIX, TRUST_ANCHOR_CONTEXT, parseJSON, isObject } from '@open-charging-cloud/wwcp-poi';
import { renderSecurityFingerprint } from './securityFingerprintView';

export interface TrustAnchorPreview {
    readonly anchor: TrustAnchor;
    readonly text: string;
}

export type TrustAnchorCheckState = "valid" | "invalid" | "unavailable";

/** Results supplied by a verifier, independently of the scanned document. */
export interface TrustAnchorValidation {
    readonly signatures: TrustAnchorCheckState;
    readonly signers: TrustAnchorCheckState;
    readonly quorum: TrustAnchorCheckState;
    readonly validity?: TrustAnchorCheckState;
    readonly reasons?: Readonly<Partial<Record<"signatures" | "signers" | "quorum" | "validity", string>>>;
}

export interface TrustAnchorPreviewOptions {
    readonly busy?: boolean;
    readonly onImport?: () => void;
    readonly onDiscard?: () => void;
}

export type ScannedTrustAnchor =
    | { readonly kind: "other" }
    | { readonly kind: "invalid"; readonly message: string; readonly messageKey?: string }
    | { readonly kind: "anchor"; readonly preview: TrustAnchorPreview };

/** Shared by camera, clipboard and files. Never follows URLs or establishes trust. */
export function parseTrustAnchorInput(text: string): ScannedTrustAnchor {
    const trimmed = text.trim();
    let candidate = trimmed.startsWith(TRUST_ANCHOR_QR_PREFIX);

    if (trimmed.startsWith("{")) {
        candidate = trimmed.includes(TRUST_ANCHOR_CONTEXT) || /"trustAnchor"\s*:/.test(trimmed);
        try {
            const parsed = parseJSON(trimmed);
            if (isObject(parsed)) {
                const context = parsed["@context"];
                const direct = context === TRUST_ANCHOR_CONTEXT || Array.isArray(context) && context.includes(TRUST_ANCHOR_CONTEXT);
                // Do not consume a charging receipt or evidence bundle merely because it embeds an anchor.
                const responseFields = ["roamingNetworkId", "identityKeyIds", "minConsensus", "uri", "qrCode", "trustAnchor"];
                const response = "trustAnchor" in parsed && Object.keys(parsed).every(key => responseFields.includes(key));
                if (!direct && !response)
                    return { kind: "other" };
                const value = response ? parsed["trustAnchor"] : parsed;
                if (isObject(value)) {
                    const valueContext = value["@context"];
                    if (valueContext === TRUST_ANCHOR_CONTEXT || Array.isArray(valueContext) && valueContext.includes(TRUST_ANCHOR_CONTEXT))
                        return { kind: "anchor", preview: { anchor: TrustAnchor.fromJSON(value), text: trimmed } };
                }
            }
            return candidate ? { kind: "invalid", message: "Invalid trust anchor document" } : { kind: "other" };
        }
        catch (error) {
            return candidate ? { kind: "invalid", message: error instanceof Error ? error.message : String(error) } : { kind: "other" };
        }
    }

    if (!candidate) {
        try {
            const url = new URL(trimmed);
            candidate = (url.protocol === "https:" || url.protocol === "http:") &&
                        url.pathname.replace(/\/+$/, "").split("/").at(-2) === "RNs" &&
                        url.searchParams.has("keys");
        }
        catch {
            return { kind: "other" };
        }
    }

    if (!candidate)
        return { kind: "other" };

    try {
        return { kind: "anchor", preview: { anchor: TrustAnchor.parse(trimmed), text: trimmed } };
    }
    catch (error) {
        return { kind: "invalid", message: error instanceof Error ? error.message : String(error) };
    }
}

export const parseScannedTrustAnchor = parseTrustAnchorInput;

/** All three checks must pass before the whole field receives the success appearance. */
export function renderTrustAnchorValidation(result: TrustAnchorValidation,
                                            localize: (key: string) => string,
                                            activeTrustedKeyCount: number = 0,
                                            unavailableReason?: string): HTMLElement {
    const validation = document.createElement("section");
    validation.className = "trustAnchorValidation";
    const states = [ result.signatures, result.signers, result.quorum, ...(result.validity === undefined ? [] : [result.validity]) ];
    const allValid = states.every(state => state === "valid");
    validation.dataset["state"] = allValid ? "valid" : states.includes("invalid") ? "invalid" : "unavailable";
    validation.setAttribute("aria-labelledby", "trustAnchorValidationTitle");
    const validationTitle = validation.appendChild(document.createElement("h3"));
    validationTitle.id = "trustAnchorValidationTitle";
    validationTitle.textContent = localize("trustAnchorValidationTitle");
    if (allValid) {
        const icon = document.createElement("i");
        icon.className = "fas fa-check-circle trustAnchorValidationSuccessIcon";
        icon.setAttribute("aria-hidden", "true");
        validationTitle.prepend(icon, document.createTextNode(" "));
    }

    const checks: { id: "signatures" | "signers" | "quorum" | "validity", state: TrustAnchorCheckState, label: string, reason: string }[] = [
        { id: "signatures", state: result.signatures, label: "trustAnchorSignaturesValid", reason: "trustAnchorNoSignatures" },
        { id: "signers", state: result.signers, label: "trustAnchorSignersTrusted", reason: "trustAnchorSignersNotCheckable" },
        { id: "quorum", state: result.quorum, label: "trustAnchorQuorumMet", reason: "trustAnchorQuorumNotCheckable" }
    ];
    if (result.validity !== undefined)
        checks.push({ id: "validity", state: result.validity, label: "trustDataValidityLabel", reason: "trustDataValidityUnknown" });
    const checkList = validation.appendChild(document.createElement("ul"));
    for (const check of checks) {
        const row = checkList.appendChild(document.createElement("li"));
        row.dataset["check"] = check.id;
        row.dataset["state"] = check.state;
        const icon = row.appendChild(document.createElement("span"));
        icon.className = "trustAnchorCheckIcon";
        icon.setAttribute("aria-hidden", "true");
        if (check.state === "valid")
            icon.classList.add("fas", "fa-check-circle");
        else if (check.state === "invalid")
            icon.classList.add("fas", "fa-times-circle");
        else
            icon.textContent = "○";
        const content = row.appendChild(document.createElement("div"));
        const label = content.appendChild(document.createElement("strong"));
        label.textContent = localize(check.label);
        const reason = content.appendChild(document.createElement("p"));
        reason.textContent = result.reasons?.[check.id] ?? localize(check.state === "valid" ? "trustAnchorCheckPassed" :
                                      check.state === "invalid" ? "trustAnchorCheckFailed" : unavailableReason ?? check.reason);
    }
    const trustPolicy = validation.appendChild(document.createElement("p"));
    trustPolicy.className = "trustAnchorTrustPolicy";
    trustPolicy.textContent = localize("trustAnchorTrustPolicy");
    const bundledKeyCount = validation.appendChild(document.createElement("p"));
    bundledKeyCount.className = "trustAnchorBundledKeyCount";
    bundledKeyCount.textContent = `${localize("trustAnchorBundledKeysLabel")}: ${activeTrustedKeyCount}`;

    return validation;
}

/** Step one contains only the supplied anchor. No storage, downloads, key trust or verification. */
export function renderTrustAnchorPreview(preview: TrustAnchorPreview,
                                         language: string,
                                         localize: (key: string) => string,
                                         options: TrustAnchorPreviewOptions = {}): HTMLElement {
    const { anchor, text } = preview;
    const section = document.createElement("section");
    section.className = "trustAnchorPreview";
    section.setAttribute("aria-labelledby", "trustAnchorPreviewTitle");

    const title = section.appendChild(document.createElement("h2"));
    title.id = "trustAnchorPreviewTitle";
    title.textContent = localize("trustAnchorPreviewTitle");

    const fields = section.appendChild(document.createElement("dl"));
    const addField = (label: string, values: readonly string[], monospace: boolean = false): void => {
        const term = fields.appendChild(document.createElement("dt"));
        term.textContent = label;
        const description = fields.appendChild(document.createElement("dd"));
        if (monospace)
            description.className = "trustAnchorMonospace";
        for (const value of values) {
            const line = description.appendChild(document.createElement("div"));
            line.textContent = value;
        }
    };

    const localizedText = (texts: Readonly<Record<string, string>>): string =>
        texts[language] ?? texts["en"] ?? Object.values(texts)[0] ?? "";

    const name = localizedText(anchor.name);
    if (name !== "")
        addField(localize("trustAnchorNameLabel"), [ name ]);
    const description = localizedText(anchor.description);
    if (description !== "")
        addField(localize("trustAnchorDescriptionLabel"), [ description ]);

    addField(localize("trustAnchorNetworkLabel"), [ anchor.id ]);
    addField(localize("trustAnchorURLsLabel"), anchor.urls, true);
    addField(localize("trustAnchorQuorumLabel"), [ `${anchor.minConsensus} / ${anchor.holders.length}` ]);

    const keys = section.appendChild(document.createElement("details"));
    keys.open = true;
    const keysSummary = keys.appendChild(document.createElement("summary"));
    keysSummary.textContent = `${localize("trustAnchorIdentityKeysLabel")} (${anchor.keys.length})`;
    const holders = keys.appendChild(document.createElement("div"));
    holders.className = "trustAnchorFingerprintHolders";
    for (const [index, holder] of anchor.holders.entries()) {
        const group = holders.appendChild(document.createElement("div"));
        group.className = "trustAnchorHolder";
        group.style.flexGrow = String(holder.length);
        group.style.flexBasis = `${Math.min(holder.length, 2) * 164}px`;
        const heading = group.appendChild(document.createElement("h3"));
        heading.textContent = `${localize("trustAnchorHolderLabel")} ${index + 1}`;
        const grid = group.appendChild(document.createElement("div"));
        grid.className = "securityFingerprintGrid";
        for (const key of holder)
            grid.appendChild(renderSecurityFingerprint(key, localize));
    }

    const raw = section.appendChild(document.createElement("details"));
    const rawSummary = raw.appendChild(document.createElement("summary"));
    rawSummary.textContent = localize("recognizedContent");
    const rawText = raw.appendChild(document.createElement("pre"));
    rawText.textContent = text;

    const actions = section.appendChild(document.createElement("div"));
    actions.className = "trustAnchorPreviewActions";
    if (options.onImport !== undefined) {
        const button = actions.appendChild(document.createElement("button"));
        button.type = "button";
        button.dataset["action"] = "import";
        button.className = "trustAnchorImport";
        button.textContent = localize("trustAnchorImportLabel");
        button.disabled = options.busy === true;
        button.onclick = options.onImport;
    }
    if (options.onDiscard !== undefined) {
        const button = actions.appendChild(document.createElement("button"));
        button.type = "button";
        button.dataset["action"] = "discard";
        button.textContent = localize("trustManualCancel");
        button.onclick = options.onDiscard;
    }

    return section;
}
