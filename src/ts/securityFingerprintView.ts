import { drunkenBishop, fingerprintBytes, fingerprintRasterHeight, fingerprintRasterVersion, fingerprintRasterWidth } from './securityFingerprint';

/** Shared by previews, key confirmations and Trust Management. Never makes trust decisions. */
export function renderSecurityFingerprint(fingerprint: string, localize: (key: string) => string): HTMLElement {
    const visits = drunkenBishop(fingerprintBytes(fingerprint));
    const root = document.createElement("figure");
    root.className = "securityFingerprint";
    root.dataset["fingerprint"] = fingerprint;
    root.dataset["rasterVersion"] = fingerprintRasterVersion;
    const ns = "http://www.w3.org/2000/svg";
    const image = document.createElementNS(ns, "svg");
    image.classList.add("securityFingerprintImage");
    image.setAttribute("viewBox", `0 0 ${fingerprintRasterWidth * 16} ${fingerprintRasterHeight * 16 + 16}`);
    image.setAttribute("role", "img");
    image.setAttribute("aria-label", `${localize("fingerprintImageLabel")}: ${fingerprint}`);
    for (const [index, count] of visits.entries()) {
        if (count === 0)
            continue;
        const cell = document.createElementNS(ns, "rect");
        cell.setAttribute("x", String(index % fingerprintRasterWidth * 16 + 1));
        cell.setAttribute("y", String(Math.floor(index / fingerprintRasterWidth) * 16 + 9));
        cell.setAttribute("width", "14");
        cell.setAttribute("height", "14");
        cell.setAttribute("rx", "2");
        cell.setAttribute("class", `fingerprintDensity${Math.min(count, 7)}`);
        image.appendChild(cell);
    }
    root.appendChild(image);
    const caption = root.appendChild(document.createElement("figcaption"));
    const short = caption.appendChild(document.createElement("code"));
    short.className = "securityFingerprintShort";
    short.textContent = fingerprint.length <= 20 ? fingerprint : `${fingerprint.slice(0, 8)}…${fingerprint.slice(-8)}`;
    const details = caption.appendChild(document.createElement("details"));
    const summary = details.appendChild(document.createElement("summary"));
    summary.textContent = localize("fingerprintShowLabel");
    const value = details.appendChild(document.createElement("code"));
    value.className = "securityFingerprintFull";
    value.textContent = fingerprint;
    const copy = details.appendChild(document.createElement("button"));
    copy.type = "button";
    copy.dataset["action"] = "copy-fingerprint";
    copy.textContent = localize("fingerprintCopyLabel");
    const status = details.appendChild(document.createElement("span"));
    status.className = "securityFingerprintCopyStatus";
    status.setAttribute("role", "status");
    copy.onclick = async (): Promise<void> => {
        copy.disabled = true;
        status.textContent = "";
        try {
            await navigator.clipboard.writeText(fingerprint);
            status.textContent = localize("fingerprintCopiedLabel");
        }
        catch {
            status.textContent = localize("fingerprintCopyFailed");
        }
        finally { copy.disabled = false; }
    };
    return root;
}
