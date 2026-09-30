// Electron-free transport implementation so the main-process boundary and
// diagnostics can be tested without launching a window.
const {
    parseLiveLinkHTTPSURL,
    validateResolvedAddresses,
    sanitizeLiveLinkHeaders,
    isWithinURLPrefixAfterQueryAppend,
    isAllowedRedirect,
    sanitizePayloadLimit
} = require('./liveLinkNetworkSecurity.cjs');

const liveLinkRequestTimeoutMilliseconds = 30_000;
const maximumRedirects = 3;

async function readLiveLinkResponse(response, maximumBytes) {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maximumBytes)
        throw new RangeError('Live-link payload limit exceeded.');

    if (response.body == null)
        return new Uint8Array();

    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            length += value.byteLength;
            if (length > maximumBytes) {
                await reader.cancel();
                throw new RangeError('Live-link payload limit exceeded.');
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return data;
}

function createLiveLinkFetcher(net, transportAllowances, timeoutMilliseconds = liveLinkRequestTimeoutMilliseconds) {
    return async function fetchLiveLinkDocument(rawURL, rawMaximumBytes, rawPrefix, rawHeaders, signal) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        let timedOut = false;
        let phase = 'network';
        let response;
        let rejectStopped;
        const stopped = new Promise((_resolve, reject) => { rejectStopped = reject; });
        const onAbort = () => {
            void response?.body?.cancel().catch(() => undefined);
            rejectStopped(new Error('Live-link request stopped.'));
        };
        controller.signal.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted)
            controller.abort();
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMilliseconds);

        const transfer = async () => {
            const maximumBytes = sanitizePayloadLimit(rawMaximumBytes);
            const initialURL = parseLiveLinkHTTPSURL(rawURL, transportAllowances);
            const customHeaders = sanitizeLiveLinkHeaders(rawHeaders);
            let prefix = null;
            if (typeof rawPrefix === 'string' && rawPrefix !== '') {
                const prefixURL = parseLiveLinkHTTPSURL(rawPrefix, transportAllowances);
                if (prefixURL.origin !== initialURL.origin || !isWithinURLPrefixAfterQueryAppend(initialURL.href, prefixURL.href))
                    throw new Error('Live-link URL outside configured prefix.');
                prefix = prefixURL.href;
            }
            let currentURL = initialURL;
            for (let redirects = 0; redirects <= maximumRedirects; redirects++) {
                if (controller.signal.aborted)
                    throw new Error('Live-link request stopped.');
                const hostname = currentURL.hostname.replace(/^\[|\]$/g, '');
                const resolutions = await Promise.allSettled([
                    net.resolveHost(hostname, { queryType: 'A', cacheUsage: 'disallowed' }),
                    net.resolveHost(hostname, { queryType: 'AAAA', cacheUsage: 'disallowed' })
                ]);
                if (controller.signal.aborted)
                    throw new Error('Live-link request stopped.');
                validateResolvedAddresses(resolutions.flatMap(result => result.status === 'fulfilled' ? result.value.endpoints : []), transportAllowances);
                response = await net.fetch(currentURL.href, {
                    cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: controller.signal,
                    headers: { ...customHeaders, Accept: 'application/json, application/*+json;q=0.9, text/plain;q=0.5' }
                });
                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get('location');
                    await response.body?.cancel();
                    if (location == null || redirects === maximumRedirects)
                        throw new Error('Unusable live-link redirect.');
                    const redirectedURL = parseLiveLinkHTTPSURL(new URL(location, currentURL).href, transportAllowances);
                    if (!isAllowedRedirect(currentURL, redirectedURL, prefix))
                        throw new Error('Live-link redirect outside approved target.');
                    currentURL = redirectedURL;
                    continue;
                }
                if (!response.ok) {
                    await response.body?.cancel().catch(() => undefined);
                    return { ok: false, status: response.status };
                }
                const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
                if (contentType !== '' && !contentType.includes('application/json') &&
                    !contentType.includes('+json') && !contentType.includes('text/plain')) {
                    await response.body?.cancel().catch(() => undefined);
                    return { ok: false, status: 0, failureKind: 'json' };
                }
                phase = 'read';
                const bytes = await readLiveLinkResponse(response, maximumBytes);
                return { ok: true, status: response.status, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
            }
            throw new Error('Too many live-link redirects.');
        };

        try {
            // The deadline includes DNS, redirects AND reading the body. Abort
            // also settles a stalled resolver/stream that ignores the signal.
            return await Promise.race([transfer(), stopped]);
        }
        catch (error) {
            const failureKind = timedOut ? 'timeout' : phase === 'read' && error instanceof RangeError ? 'size' : phase;
            controller.abort();
            return { ok: false, status: 0, failureKind };
        }
        finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            controller.signal.removeEventListener('abort', onAbort);
        }
    };
}

module.exports = { createLiveLinkFetcher, liveLinkRequestTimeoutMilliseconds };
