import { TrustContext, KeyStatement, KEY_STATEMENT_CONTEXT, POIPublicKey, isObject, parseJSON } from '@open-charging-cloud/wwcp-poi';
import type { JSONValue, TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import { trustedAnchorHolders } from './anchorKeyTrust';
import type { StoredTrustAnchor } from './trustStore';
import type { TrustAnchorValidation } from './trustAnchorPreview';
import { pollTargetProblem } from './liveLinkTrust';
import type { ITransportAllowances } from './liveLinkTrust';
import { poiFetch } from './poiFetch';
import { readResponseWithinLimit } from './deepLinks';

export interface StoredTrustAnchorData {
    readonly origin?: 'embedded';
    readonly sourceURL: string;
    readonly downloadedAt: string;
    /** Original signed JSON, parsed with WWCP's parser again whenever it is used. */
    readonly text: string;
}

export interface LoadedTrustAnchorData {
    readonly document: StoredTrustAnchorData;
    readonly statement: KeyStatement;
    readonly identityKeys: readonly POIPublicKey[];
}

export interface TrustAnchorDataValidation extends TrustAnchorValidation {
    readonly trustedHolderCount: number;
    readonly requiredConsensus: number;
    readonly signatureCount: number;
    readonly canTrustKeys: boolean;
    readonly verificationError?: string;
}

export function keyStatementURL(base: string): string {
    const url = new URL(base);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") + "/keyStatement";
    return url.href;
}

/** Accept the signed statement itself or an operator/response embedding it, never a replacement anchor. */
export function parseTrustAnchorData(anchor: TrustAnchor, document: StoredTrustAnchorData,
                                     additionalKeys: readonly POIPublicKey[] = []): LoadedTrustAnchorData {
    if (!anchor.urls.some(base => keyStatementURL(base) === document.sourceURL) || !Number.isFinite(Date.parse(document.downloadedAt)))
        throw new Error("The downloaded document is not from a source of this trust anchor");
    const json = parseJSON(document.text);
    if (!isObject(json))
        throw new Error("A key statement response must be an object");
    const operator = isObject(json["operator"]) ? json["operator"] : json;
    const value: JSONValue | undefined = json["@context"] === KEY_STATEMENT_CONTEXT ? json : operator["keyStatement"];
    const statement = KeyStatement.parse(value);
    if (statement.roamingNetworkId !== anchor.id)
        throw new Error("The key statement belongs to another roaming network");
    if (value !== json && typeof operator["@id"] === "string" && operator["@id"] !== statement.roamingNetworkOperatorId)
        throw new Error("The key statement belongs to another operator");
    const extra = value === json || operator["identityKeys"] === undefined ? [] : POIPublicKey.parseAll(operator["identityKeys"], "Operator identity keys");
    const keys = new Map<string, POIPublicKey>();
    // Signed metadata takes precedence over key material supplied independently by the app.
    const needed = new Set([...anchor.keys, ...statement.signatures.map(signature => signature.keyId)]);
    for (const key of [...additionalKeys.filter(key => needed.has(key.id)), ...extra, ...statement.identityKeys])
        keys.set(key.id, key);
    return { document, statement, identityKeys: [...keys.values()] };
}

/** Mathematical validity, local authorization and quorum remain separate results. */
export function validateTrustAnchorData(anchor: TrustAnchor, data: LoadedTrustAnchorData,
                                        record: StoredTrustAnchor | undefined, bundled: readonly POIPublicKey[],
                                        deleted: ReadonlySet<string>, at: number = Date.now()): TrustAnchorDataValidation {
    return TrustContext.evaluate(anchor, data.statement, {
        trustedIdentityKeyIds: trustedAnchorHolders(anchor, record, bundled, deleted, at).flat(),
        otherIdentityKeys: data.identityKeys, at
    });
}

/** Historical-reference eligibility uses original validity and fresh local decisions; it never grants trust. */
export function validateHistoricalReferenceData(anchor: TrustAnchor, data: LoadedTrustAnchorData,
    record: StoredTrustAnchor | undefined, bundled: readonly POIPublicKey[], deleted: ReadonlySet<string>, now: number = Date.now()): TrustAnchorDataValidation {
    if (data.statement.signedAt > now) return validateTrustAnchorData(anchor,data,record,bundled,deleted,now);
    return TrustContext.evaluate(anchor,data.statement,{
        trustedIdentityKeyIds:trustedAnchorHolders(anchor,record,bundled,deleted,now).flat(),
        otherIdentityKeys:data.identityKeys,at:data.statement.signedAt
    });
}

/** Called only after Import. Downloads only /keyStatement, not the complete roaming network. */
export async function downloadTrustAnchorData(anchor: TrustAnchor, options: {
    readonly signal: AbortSignal;
    readonly fetch?: typeof fetch;
    readonly allowances?: ITransportAllowances;
    readonly additionalKeys?: readonly POIPublicKey[];
    readonly timeoutMs?: number;
}): Promise<LoadedTrustAnchorData> {
    let invalid: LoadedTrustAnchorData | undefined;
    for (const base of anchor.urls) {
        options.signal.throwIfAborted();
        const endpoint = keyStatementURL(base);
        const url = new URL(endpoint);
        if (pollTargetProblem(url, false, options.allowances) !== null || url.username !== "" || url.password !== "")
            continue;
        const controller = new AbortController();
        const abort = (): void => { controller.abort(options.signal.reason); };
        options.signal.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(() => { controller.abort(new Error("Key statement download timed out")); }, options.timeoutMs ?? 15000);
        try {
            const response = await (options.fetch ?? poiFetch)(endpoint, {
                signal: controller.signal, credentials: "omit", redirect: "error", cache: "no-store",
                headers: { Accept: "application/json" }
            });
            if (!response.ok)
                throw new Error("The key statement could not be downloaded");
            const bytes = await readResponseWithinLimit(response, 1024 * 1024);
            options.signal.throwIfAborted();
            const data = parseTrustAnchorData(anchor, { sourceURL: endpoint, downloadedAt: new Date().toISOString(),
                text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }, options.additionalKeys);
            const result = validateTrustAnchorData(anchor, data, undefined, [], new Set());
            if (result.canTrustKeys)
                return data;
            invalid = data;
        }
        catch {
            options.signal.throwIfAborted();
        }
        finally {
            clearTimeout(timer);
            options.signal.removeEventListener("abort", abort);
        }
    }
    if (invalid !== undefined)
        return invalid;
    throw new Error("No source provided a usable key statement");
}
