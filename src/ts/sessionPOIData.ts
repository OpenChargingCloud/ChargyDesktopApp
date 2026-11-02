import { isObject, parseJSON, prettyJSON, TrustAnchor, parseHistoricalMeterEvidence, parseSessionPriceEvidence } from '@open-charging-cloud/wwcp-poi';
import type { JSONObject } from '@open-charging-cloud/wwcp-poi';
import type { ChargyInterfaces, IChargingSession } from '@open-charging-cloud/chargy-core';
import type { StationProofDocument } from './stationProofData';
import type { StoredTrustAnchorData } from './trustAnchorData';
import { keyStatementURL, parseTrustAnchorData } from './trustAnchorData';
import { stationEVSEId } from './poiURLs';

export const sessionPOIContext = 'https://open.charging.cloud/contexts/chargy/poiEvidence/v1';
export interface SessionPOIEvidence {
    readonly evseId: string;
    readonly sessionId?: string;
    readonly roamingNetworkId?: string;
    readonly document?: StationProofDocument;
    readonly historicalEvidence?: string;
    readonly priceEvidence?: string;
    /** Original live envelopes for audit/export only; never restored as authorization. */
    readonly liveDocuments?: readonly string[];
    readonly priceSource?: {readonly origin:'embedded'|'network';readonly sourceURL:string;readonly receivedAt:string};
    readonly historicalSource?: { readonly source: string; readonly receivedAt: string };
    /** Untrusted audit metadata; never consumed by a trust resolver. */
    readonly archiveAudit?: string;
    readonly bootstrap?: { readonly anchor: TrustAnchor; readonly document: StoredTrustAnchorData };
    readonly error?: string;
}

/** Replace a session's evidence by its association, including after immutable copies were made during live preparation. */
export function replaceSessionPOIEvidence(sources:readonly SessionPOIEvidence[],updated:SessionPOIEvidence,sessionId:string,count:number):readonly SessionPOIEvidence[] {
    return [...sources.filter(item=>!(item.evseId===updated.evseId&&(item.sessionId===updated.sessionId||item.sessionId===sessionId||count===1&&item.sessionId===undefined))),updated];
}

/** Read the original source with POI's lossless parser before Core performs its own conversion. No trust is imported. */
export function readSessionPOIEvidence(input: string | ChargyInterfaces.IFileInfo | readonly ChargyInterfaces.IFileInfo[]): readonly SessionPOIEvidence[] {
    const files = typeof input === 'string' ? [{ name: 'clipboard', data: new TextEncoder().encode(input) }]
        : Array.isArray(input) ? input as readonly ChargyInterfaces.IFileInfo[] : [input as ChargyInterfaces.IFileInfo];
    const result: SessionPOIEvidence[] = [];
    for (const file of files) {
        if (file.data === undefined || file.error !== undefined) continue;
        let text: string;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(file.data); }
        catch { continue; }
        if (!text.trimStart().startsWith('{') || !text.includes('poiEvidence')) continue;
        try {
            if (text.length > 8 * 1024 * 1024) throw new Error('POI session input exceeds 8 MiB');
            const value = parseJSON(text);
            if (!isObject(value) || value['poiEvidence'] === undefined) continue;
            const evidence = value['poiEvidence'];
            if (!isObject(evidence) || evidence['@context'] !== sessionPOIContext)
                throw new Error('Unsupported POI session evidence');
            const evseId = stationEVSEId(requiredText(evidence, 'EVSEId'));
            const suppliedSessionId = evidence['sessionId'];
            if (suppliedSessionId !== undefined && (typeof suppliedSessionId !== 'string' || suppliedSessionId.trim() === ''))
                throw new Error('Invalid POI session association');
            const proof = evidence['chargingStationProof'];
            const historical = evidence['historicalEvidence'];
            const historicalText = historical === undefined ? undefined : typeof historical === 'string' ? historical : prettyJSON(historical);
            if (historicalText !== undefined) {
                if (new TextEncoder().encode(historicalText).length > 4 * 1024 * 1024) throw new Error('Historical evidence exceeds 4 MiB');
                if (parseHistoricalMeterEvidence(parseJSON(historicalText)).evseId !== evseId) throw new Error('Historical evidence belongs to another EVSE');
            }
            const proofText = proof === undefined ? undefined : typeof proof === 'string' ? proof : prettyJSON(proof);
            if (proofText !== undefined && new TextEncoder().encode(proofText).length > 2 * 1024 * 1024)
                throw new Error('Embedded station proof exceeds 2 MiB');
            if (proofText !== undefined) parseJSON(proofText);
            const receivedAt = new Date().toISOString();
            const prices=evidence['priceEvidence'];
            const priceText=prices===undefined?undefined:typeof prices==='string'?prices:prettyJSON(prices);
            if(priceText!==undefined){
                if(new TextEncoder().encode(priceText).length>4*1024*1024)throw new Error('Price evidence exceeds 4 MiB');
                if(parseSessionPriceEvidence(parseJSON(priceText)).evseId!==evseId)throw new Error('Price evidence belongs to another EVSE');
            }
            const liveDocuments=evidence['liveDocuments'];
            if(liveDocuments!==undefined&&(!Array.isArray(liveDocuments)||liveDocuments.some(item=>typeof item!=='string')||new TextEncoder().encode(JSON.stringify(liveDocuments)).length>8*1024*1024))throw new Error('Invalid original live document archive');
            const archiveAudit = evidence['archiveAudit'];
            if (archiveAudit !== undefined && (typeof archiveAudit !== 'string' || archiveAudit.length > 2 * 1024 * 1024))
                throw new Error('Invalid archival audit metadata');
            let bootstrap: SessionPOIEvidence['bootstrap'];
            if (evidence['bootstrap'] !== undefined) {
                const supplied = evidence['bootstrap'];
                if (!isObject(supplied)) throw new Error('Invalid POI bootstrap');
                const anchor = TrustAnchor.parse(requiredText(supplied, 'trustAnchor'));
                const suppliedStatement = supplied['keyStatement'];
                const statementText = typeof suppliedStatement === 'string' ? suppliedStatement : prettyJSON(suppliedStatement ?? null);
                if (new TextEncoder().encode(statementText).length > 1024 * 1024)
                    throw new Error('Embedded KeyStatement exceeds 1 MiB');
                const document: StoredTrustAnchorData = { origin: 'embedded', sourceURL: keyStatementURL(anchor.urls[0] ?? ''),
                    downloadedAt: receivedAt, text: statementText };
                parseTrustAnchorData(anchor, document);
                bootstrap = { anchor, document };
            }
            const network = evidence['roamingNetworkId'];
            if (network !== undefined && typeof network !== 'string') throw new Error('Invalid network hint');
            result.push({ evseId,
                ...(Array.isArray(liveDocuments)?{liveDocuments:liveDocuments as string[]}:{}),
                ...(priceText===undefined?{}:{priceEvidence:priceText,priceSource:{origin:'embedded' as const,sourceURL:`input:${file.name}`,receivedAt}}),
                ...(typeof archiveAudit === 'string' ? { archiveAudit } : {}),
                ...(historicalText === undefined ? {} : { historicalEvidence: historicalText }),
                ...(historicalText === undefined ? {} : { historicalSource: {source:`input:${file.name}`,receivedAt} }),
                ...(typeof suppliedSessionId === 'string' ? { sessionId: suppliedSessionId } : {}),
                ...(typeof network === 'string' ? { roamingNetworkId: network } : {}),
                ...(proofText === undefined ? {} : { document: { origin: 'embedded' as const,
                    sourceURL: `input:${file.name}`, downloadedAt: receivedAt, text: proofText } }),
                ...(bootstrap === undefined ? {} : { bootstrap }) });
        }
        catch (error) { result.push({ evseId: '', error: error instanceof Error ? error.message : String(error) }); }
    }
    return result;
}

function requiredText(value: JSONObject, key: string): string {
    const text = value[key];
    if (typeof text !== 'string' || text.trim() === '') throw new Error(`Missing ${key}`);
    return text;
}

/** Conflicting imported/signed EVSE identities are never resolved by guessing from a proof or an EVSE prefix. */
export function sessionEVSEId(session: Pick<IChargingSession, 'EVSEId' | 'EVSE'> & { readonly ocmf?: { readonly chargePointIdentificationType?: string; readonly chargePointIdentification?: string } }): string | undefined {
    const ids = [session.EVSEId, session.EVSE?.['@id']];
    if (session.ocmf?.chargePointIdentificationType === 'EVSEID') ids.push(session.ocmf.chargePointIdentification);
    const known = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map(stationEVSEId))];
    if (known.length > 1) throw new Error('Conflicting EVSE identities in this session');
    return known[0];
}

export function evidenceForSession(evidence: readonly SessionPOIEvidence[], evseId: string, sessionId: string,
                                   sessionCount: number): SessionPOIEvidence | undefined {
    const invalid = evidence.find(item => item.error !== undefined);
    if (invalid !== undefined) throw new Error(invalid.error);
    const matching = evidence.filter(item => item.evseId === evseId && (item.sessionId === sessionId || item.sessionId === undefined && sessionCount === 1));
    if (matching.length > 1) throw new Error('Multiple competing POI documents for this session');
    // A supplied association for this exact session must not silently turn into an unrelated lookup.
    if (matching.length === 0 && evidence.some(item => item.sessionId === sessionId || item.sessionId === undefined && sessionCount === 1))
        throw new Error('The supplied POI evidence belongs to another EVSE');
    return matching[0];
}

export function liveEVSEId(station: unknown): string | undefined {
    if (station === null || typeof station !== 'object') return undefined;
    const evse: unknown = (station as { EVSE?: unknown }).EVSE;
    if (evse === null || typeof evse !== 'object') return undefined;
    const id: unknown = (evse as { '@id'?: unknown })['@id'];
    return typeof id === 'string' ? stationEVSEId(id) : undefined;
}

/** Export as original JSON text so Core's ordinary JSON serializer cannot round signed decimal values. */
export function exportSessionPOIEvidence(evidence: SessionPOIEvidence): Record<string, unknown> {
    if (evidence.error !== undefined) throw new Error('Cannot export invalid POI evidence');
    return { '@context': sessionPOIContext, EVSEId: evidence.evseId,
        ...(evidence.liveDocuments===undefined?{}:{liveDocuments:[...evidence.liveDocuments]}),
        ...(evidence.priceEvidence===undefined?{}:{priceEvidence:evidence.priceEvidence}),
        ...(evidence.historicalEvidence === undefined ? {} : { historicalEvidence: evidence.historicalEvidence }),
        ...(evidence.archiveAudit === undefined ? {} : { archiveAudit: evidence.archiveAudit }),
        ...(evidence.sessionId === undefined ? {} : { sessionId: evidence.sessionId }),
        ...(evidence.roamingNetworkId === undefined ? {} : { roamingNetworkId: evidence.roamingNetworkId }),
        ...(evidence.document === undefined ? {} : { chargingStationProof: evidence.document.text }),
        ...(evidence.bootstrap === undefined ? {} : { bootstrap: {
            trustAnchor: evidence.bootstrap.anchor.toQRCode(), keyStatement: evidence.bootstrap.document.text } }) };
}
