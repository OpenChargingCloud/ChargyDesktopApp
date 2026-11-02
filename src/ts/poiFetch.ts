/** Fetch POI JSON through the desktop main process, which enforces URL, DNS,
 * redirect, timeout and payload limits independently of renderer CORS. */
import type { LiveLinkFetchResult } from './liveLinkPolling';

type POIBridge = {
    fetchLiveLink(url: string, maximumBytes: number, prefix: string, headers: undefined, requestId: string): Promise<LiveLinkFetchResult>;
    cancelLiveLink(requestId: string): void;
};

export const poiFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const signal = init?.signal;
    signal?.throwIfAborted();

    const bridge = (window as unknown as { chargyElectron: POIBridge }).chargyElectron;
    const requestId = crypto.randomUUID();
    const cancel = (): void => { bridge.cancelLiveLink(requestId); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
        const result = await bridge.fetchLiveLink(url, 8 * 1024 * 1024, url, undefined, requestId);
        signal?.throwIfAborted();
        if (!result.ok)
            return new Response(null, { status: result.status >= 200 && result.status <= 599 ? result.status : 502 });
        return new Response(result.data, {
            status: result.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    finally {
        signal?.removeEventListener('abort', cancel);
    }
};
