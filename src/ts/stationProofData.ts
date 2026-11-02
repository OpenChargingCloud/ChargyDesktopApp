import { parseJSON } from '@open-charging-cloud/wwcp-poi';
import type { VersionComparison, VerifiedChargingStation } from '@open-charging-cloud/wwcp-poi';
import type { POITrustContext, POITrustService } from './poiTrustContext';
import {POIHistoryError} from './poiTrustContext';
import { pollTargetProblem } from './liveLinkTrust';
import type { ITransportAllowances } from './liveLinkTrust';
import { poiFetch } from './poiFetch';
import { readResponseWithinLimit } from './deepLinks';
import { stationEVSEId, stationProofURL } from './poiURLs';

export const stationProofMaxBytes = 2 * 1024 * 1024;

export interface StationProofDocument {
    /** Supplied with the original session input, rather than retrieved from sourceURL. */
    readonly origin?: 'embedded';
    readonly sourceURL: string;
    readonly downloadedAt: string;
    readonly text: string;
}

export interface LoadedStationProof {
    readonly consistency?:VersionComparison;
    readonly document: StationProofDocument;
    readonly evseId: string;
    readonly context: POITrustContext;
    readonly station: VerifiedChargingStation;
}

export interface StationProofAttempt {
    readonly consistency?:VersionComparison;
    readonly sourceURL: string;
    readonly stage: 'download' | 'verification';
    readonly message: string;
}

export class StationProofLoadError extends Error {
    public constructor(public readonly attempts: readonly StationProofAttempt[]) {
        super('No source supplied a station proof that could be loaded and verified');
        this.name = 'StationProofLoadError';
    }
}

/** Only approved anchor sources. Each candidate is verified by the shared library before accepting a mirror. */
export async function loadStationProof(trust: Pick<POITrustService, 'resolve' | 'verifyStation'>,
                                       policyId: string, inputEVSE: string, options: {
                                           readonly signal: AbortSignal;
                                           readonly fetch?: typeof fetch;
                                           readonly allowances?: ITransportAllowances;
                                           readonly timeoutMs?: number;
                                           readonly totalTimeoutMs?: number;
                                           readonly onSource?: (url: string) => void;
                                       }): Promise<LoadedStationProof> {
    const evseId = stationEVSEId(inputEVSE);
    options.signal.throwIfAborted();
    const context = await trust.resolve(policyId);
    options.signal.throwIfAborted();
    const overall = new AbortController();
    const parentAbort = (): void => { overall.abort(options.signal.reason); };
    options.signal.addEventListener('abort', parentAbort, { once: true });
    const deadline = setTimeout(() => { overall.abort(new Error('Station proof download deadline exceeded')); }, options.totalTimeoutMs ?? 30000);
    const attempts: StationProofAttempt[] = [];
    try {
        for (const base of context.verification.anchor.urls) {
            options.signal.throwIfAborted();
            if (overall.signal.aborted)
                break;
            const sourceURL = stationProofURL(base, evseId);
            const url = new URL(sourceURL);
            const problem = pollTargetProblem(url, false, options.allowances);
            if (problem !== null || url.username !== '' || url.password !== '') {
                attempts.push({ sourceURL, stage: 'download', message: 'This source is not allowed by the transport policy' });
                continue;
            }
            const controller = new AbortController();
            const abort = (): void => { controller.abort(overall.signal.reason); };
            overall.signal.addEventListener('abort', abort, { once: true });
            const timer = setTimeout(() => { controller.abort(new Error('Station proof request timed out')); }, options.timeoutMs ?? 15000);
            let stage: StationProofAttempt['stage'] = 'download';
            try {
                options.onSource?.(sourceURL);
                controller.signal.throwIfAborted();
                const response = await (options.fetch ?? poiFetch)(sourceURL, {
                    signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                const bytes = await readResponseWithinLimit(response, stationProofMaxBytes);
                controller.signal.throwIfAborted();
                const document: StationProofDocument = {
                    sourceURL, downloadedAt: new Date().toISOString(),
                    text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
                };
                stage = 'verification';
                // Read current local decisions again after I/O. The downloaded operator cannot replace the saved policy.
                const verified = await trust.verifyStation(policyId, parseJSON(document.text), { evseId },controller.signal);
                controller.signal.throwIfAborted();
                options.signal.throwIfAborted();
                return { ...verified, document, evseId };
            }
            catch (error) {
                options.signal.throwIfAborted();
                const reason: unknown = controller.signal.aborted ? controller.signal.reason : error;
                attempts.push({ sourceURL, stage, message: reason instanceof Error ? reason.message : String(reason),
                    ...(reason instanceof POIHistoryError?{consistency:reason.report}:{}) });
            }
            finally {
                clearTimeout(timer);
                overall.signal.removeEventListener('abort', abort);
            }
        }
    }
    finally {
        clearTimeout(deadline);
        options.signal.removeEventListener('abort', parentAbort);
    }
    throw new StationProofLoadError(attempts);
}
