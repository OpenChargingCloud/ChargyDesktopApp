import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import { trustAnchorStorageId } from './trustStore';
import type { StoredTrustAnchor } from './trustStore';

export type AnchorKeyTrustState = "bundled" | "manual" | "unknown" | "deleted" | "expired";

/** Trust is scoped to the complete anchor policy, including holder grouping and quorum. */
export function anchorKeyTrustState(anchor: TrustAnchor, keyId: string, record: StoredTrustAnchor | undefined,
                                    bundled: readonly POIPublicKey[], deleted: ReadonlySet<string>,
                                    at: number = Date.now()): AnchorKeyTrustState {
    if (!anchor.keys.includes(keyId))
        return "unknown";
    const known = bundled.find(key => key.id === keyId);
    if (known !== undefined && !known.isValidAt(at))
        return "expired";
    if (known !== undefined && !deleted.has(keyId))
        return "bundled";
    if (record?.id === trustAnchorStorageId(anchor) &&
        trustAnchorStorageId(TrustAnchor.parse(record.qrCode)) === record.id && record.trustedKeys?.some(key => key.id === keyId) === true)
        return "manual";
    return deleted.has(keyId) ? "deleted" : "unknown";
}

/** App-owned authorization input for the library's TrustContext; no signature or quorum verdict. */
export function trustedAnchorHolders(anchor: TrustAnchor, record: StoredTrustAnchor | undefined,
                                      bundled: readonly POIPublicKey[], deleted: ReadonlySet<string>,
                                      at: number = Date.now()): readonly (readonly string[])[] {
    return anchor.holders.map(holder => holder.filter(id => {
        const state = anchorKeyTrustState(anchor, id, record, bundled, deleted, at);
        return state === "bundled" || state === "manual";
    }));
}
