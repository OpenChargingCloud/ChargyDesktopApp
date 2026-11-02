import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import type { StoredTrustAnchor } from './trustStore';
import { createPOITrustContext } from './poiTrustContext';
import type { POITrustContext } from './poiTrustContext';

export interface StoredRoamingNetwork {
    readonly id: string;
    readonly identity: string;
    readonly context?: POITrustContext;
    readonly anchors: readonly StoredTrustAnchor[];
}

/** Authenticated RN/RNO/policy identities; unverified policies stay isolated, even if they claim the same ID. */
export function groupRoamingNetworks(records: readonly StoredTrustAnchor[], bundled: readonly POIPublicKey[] = [],
                                       deleted: ReadonlySet<string> = new Set(), at: number = Date.now()): readonly StoredRoamingNetwork[] {
    const groups = new Map<string, StoredRoamingNetwork>();
    for (const record of records) {
        const anchor = TrustAnchor.parse(record.qrCode);
        let context: POITrustContext | undefined;
        try {
            if (record.downloadedData !== undefined)
                context = createPOITrustContext(anchor, record.downloadedData, record, bundled, deleted, at);
        }
        catch { /* Keep invalid, expired or insufficiently trusted imports visible as isolated policies. */ }
        const identity = context === undefined ? `unverified:${record.id}` : `authenticated:${context.networkIdentity}`;
        const previous = groups.get(identity);
        groups.set(identity, { id: anchor.id, identity,
            anchors: [...(previous?.anchors ?? []), record].sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
            ...(context === undefined ? {} : { context }) });
    }
    return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id) || a.identity.localeCompare(b.identity));
}

/** These display names come from imported anchors and are not authenticated network names. */
export function roamingNetworkDisplayName(network: StoredRoamingNetwork, language: string): string {
    const names = network.anchors.map(record => TrustAnchor.parse(record.qrCode).name);
    for (const candidate of [language, "en"])
        for (const name of names) {
            const value = name[candidate];
            if (value !== undefined && value.trim() !== "")
                return value;
        }
    return names.flatMap(name => Object.values(name)).find(value => value.trim() !== "") ?? network.id;
}
