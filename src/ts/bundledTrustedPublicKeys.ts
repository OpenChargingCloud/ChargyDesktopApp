import source from '../trust/trusted-public-keys.jsonl?raw';
import { parseTrustedPublicKeysJSONL } from './trustedPublicKeys';
import { activeBundledPublicKeys } from './trustStore';
import type { TrustStore } from './trustStore';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';

/** Build-time trust configuration. See src/trust/README.md before editing its source. */
export const bundledTrustedPublicKeys = parseTrustedPublicKeysJSONL(source);

/** Use this for trust decisions; the raw build list is retained only for management/restoration. */
export async function getActiveBundledTrustedPublicKeys(store: TrustStore): Promise<readonly POIPublicKey[]> {
    return activeBundledPublicKeys(bundledTrustedPublicKeys, await store.deletedBundledKeyIds());
}
