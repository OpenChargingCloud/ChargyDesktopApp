import { readQRCodeTextFromImage } from '@open-charging-cloud/chargy-core';
import type { ChargyInterfaces } from '@open-charging-cloud/chargy-core';
import { browserFileTypeFromNameOrData } from './browserFiles';
import { parseTrustAnchorInput } from './trustAnchorPreview';
import type { ScannedTrustAnchor } from './trustAnchorPreview';

/** A preflight router; unrecognized inputs remain available to the existing transparency reader. */
export async function findTrustAnchorImport(input: string | ChargyInterfaces.IFileInfo | readonly ChargyInterfaces.IFileInfo[]): Promise<ScannedTrustAnchor> {
    if (typeof input === "string")
        return parseTrustAnchorInput(input);
    const files: readonly ChargyInterfaces.IFileInfo[] = Array.isArray(input) ? input as readonly ChargyInterfaces.IFileInfo[] : [input as ChargyInterfaces.IFileInfo];
    for (const file of files) {
        if (file.data === undefined || file.error !== undefined)
            continue;
        const type = browserFileTypeFromNameOrData(file.name, file.type ?? "", file.data);
        let text: string | undefined;
        if (type.startsWith("image/")) {
            try { text = await readQRCodeTextFromImage(file.data, type); }
            catch { /* Let the existing reader diagnose unsupported or invalid images. */ }
        }
        else {
            try { text = new TextDecoder("utf-8", { fatal: true }).decode(file.data); }
            catch { /* Binary transparency formats remain on the existing import path. */ }
        }
        if (text !== undefined) {
            const result = parseTrustAnchorInput(text);
            if (result.kind !== "other")
                return files.length === 1 ? result : { kind: "invalid", message: "Import trust anchor files individually, separately from other files.", messageKey: "trustAnchorSingleFile" };
        }
    }
    return { kind: "other" };
}
