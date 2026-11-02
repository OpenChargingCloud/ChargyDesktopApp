import { POIPublicKey, parseJSON } from '@open-charging-cloud/wwcp-poi';

/** Shared by the build loader and the app; malformed trust configuration is never skipped. */
export function parseTrustedPublicKeysJSONL(text: string,
                                           source: string = "trusted-public-keys.jsonl"): readonly POIPublicKey[] {
    if (text.startsWith("\uFEFF"))
        throw new Error(`${source}:1: UTF-8 BOM is not supported`);

    const keys: POIPublicKey[] = [];
    const ids = new Set<string>();
    for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (line.trim() === "")
            continue;
        try {
            const key = POIPublicKey.parse(parseJSON(line));
            if (ids.has(key.id))
                throw new Error(`Duplicate trusted public key '${key.id}'`);
            ids.add(key.id);
            keys.push(key);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`${source}:${index + 1}: ${message}`, { cause: error });
        }
    }
    return Object.freeze(keys);
}
