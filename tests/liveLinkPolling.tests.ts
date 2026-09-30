import { createRequire } from "node:module";
import { afterEach, describe, expect, test, vi } from "vitest";
import { requestLiveLink } from "../src/ts/liveLinkPolling";
import type { LiveLinkFetcher, LiveLinkFetchResult } from "../src/ts/liveLinkPolling";

type Network = {
    fetch: typeof fetch;
    resolveHost: (hostname: string, options: { queryType: string; cacheUsage: string }) => Promise<{ endpoints: { address: string }[] }>;
};
type FetchDocument = (url: string, maximumBytes: number, prefix?: string, headers?: Record<string, string>, signal?: AbortSignal) => Promise<LiveLinkFetchResult>;
const require = createRequire(import.meta.url);
const { createLiveLinkFetcher, liveLinkRequestTimeoutMilliseconds } = require("../src/liveLinkPolling.cjs") as {
    createLiveLinkFetcher: (net: Network, allowances: { insecureTransports?: boolean; privateNetworkTransports?: boolean }, timeoutMilliseconds?: number) => FetchDocument;
    liveLinkRequestTimeoutMilliseconds: number;
};
const url = new URL("https://operator.example/live?token=private");
const headers = { "STEVE-API-KEY": "secret", Cookie: "must-not-send" };

function network(): { fetch: ReturnType<typeof vi.fn<typeof fetch>>; resolveHost: ReturnType<typeof vi.fn<Network["resolveHost"]>> } {
    return {
        fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{"lastUpdated":"2026-09-30"}')),
        resolveHost: vi.fn<Network["resolveHost"]>().mockResolvedValue({ endpoints: [{ address: "8.8.8.8" }] })
    };
}

function bridge(): { fetchLiveLink: ReturnType<typeof vi.fn<LiveLinkFetcher["fetchLiveLink"]>>; cancelLiveLink: ReturnType<typeof vi.fn<LiveLinkFetcher["cancelLiveLink"]>> } {
    return {
        fetchLiveLink: vi.fn<LiveLinkFetcher["fetchLiveLink"]>().mockResolvedValue({ ok: true, status: 200, data: new TextEncoder().encode('{"lastUpdated":"2026-09-30"}').buffer }),
        cancelLiveLink: vi.fn<LiveLinkFetcher["cancelLiveLink"]>()
    };
}

afterEach(() => { vi.useRealTimers(); });

describe("Live-link main-process transfer diagnostics", () => {
    test("preserves authentication, header filtering, transport restrictions and the payload", async () => {
        const net = network();
        const response = await createLiveLinkFetcher(net, {})(url.href, 1024, undefined, headers);
        expect(response.ok).toBe(true);
        expect(new TextDecoder().decode(response.data)).toBe('{"lastUpdated":"2026-09-30"}');
        expect(net.fetch).toHaveBeenCalledWith(url.href, expect.objectContaining({
            cache: "no-store", credentials: "omit", redirect: "manual",
            headers: { "STEVE-API-KEY": "secret", Accept: "application/json, application/*+json;q=0.9, text/plain;q=0.5" }
        }));
        expect(net.fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
        expect(liveLinkRequestTimeoutMilliseconds).toBe(30_000);
    });

    test.each([401, 403, 500])("reports readable HTTP %i responses", async status => {
        const net = network();
        net.fetch.mockResolvedValue(new Response("error", { status }));
        expect(await createLiveLinkFetcher(net, {})(url.href, 1024)).toEqual({ ok: false, status });
    });

    test("never discloses exception URLs or keys", async () => {
        const net = network();
        net.fetch.mockRejectedValue(new TypeError("Failed to fetch " + url.href + " STEVE-API-KEY=secret"));
        expect(await createLiveLinkFetcher(net, {})(url.href, 1024)).toEqual({ ok: false, status: 0, failureKind: "network" });
    });

    test("distinguishes an invalid content type from an interrupted body", async () => {
        const net = network();
        net.fetch.mockResolvedValue(new Response("<html>error</html>", { headers: { "Content-Type": "text/html" } }));
        const fetchDocument = createLiveLinkFetcher(net, {});
        expect(await fetchDocument(url.href, 1024)).toMatchObject({ failureKind: "json" });
        net.fetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
            start(controller): void { controller.error(new TypeError("broken transfer")); }
        })));
        expect(await fetchDocument(url.href, 1024)).toMatchObject({ failureKind: "read" });
    });

    test.each([true, false])("enforces declared and streamed size limits (content-length: %s)", async declared => {
        const net = network();
        net.fetch.mockResolvedValue(new Response('"' + "x".repeat(20) + '"', declared ? { headers: { "Content-Length": "1000" } } : {}));
        expect(await createLiveLinkFetcher(net, {})(url.href, 10)).toMatchObject({ failureKind: "size" });
        expect(net.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    });

    test.each(["dns", "fetch", "body"])("times out a stalled %s phase and cleans up its timer", async phase => {
        vi.useFakeTimers();
        const net = network();
        if (phase === "dns")
            net.resolveHost.mockImplementation(async () => new Promise(() => undefined));
        else if (phase === "fetch")
            net.fetch.mockImplementation(async () => new Promise(() => undefined));
        else
            net.fetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>()));
        const pending = createLiveLinkFetcher(net, {})(url.href, 1024);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await pending).toEqual({ ok: false, status: 0, failureKind: "timeout" });
        expect(vi.getTimerCount()).toBe(0);
    });

    test("cancels obsolete transfers, including stalled DNS resolution", async () => {
        vi.useFakeTimers();
        const net = network();
        net.resolveHost.mockImplementation(async () => new Promise(() => undefined));
        const controller = new AbortController();
        const pending = createLiveLinkFetcher(net, {})(url.href, 1024, undefined, {}, controller.signal);
        controller.abort();
        expect(await pending).toMatchObject({ ok: false, failureKind: "network" });
        expect(net.fetch).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    test("rejects private addresses, insecure transports and invalid prefixes before sending credentials", async () => {
        const net = network();
        const fetchDocument = createLiveLinkFetcher(net, {});
        await fetchDocument("http://operator.example/live", 1024, undefined, headers);
        await fetchDocument(url.href, 1024, "https://other.example/", headers);
        net.resolveHost.mockResolvedValue({ endpoints: [{ address: "127.0.0.1" }] });
        await fetchDocument(url.href, 1024, undefined, headers);
        expect(net.fetch).not.toHaveBeenCalled();
    });

    test("follows only approved same-origin redirects and revalidates DNS", async () => {
        const net = network();
        const fetchDocument = createLiveLinkFetcher(net, {});
        net.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "/live/new" } }));
        expect(await fetchDocument(url.href, 1024, "https://operator.example/live", headers)).toMatchObject({ ok: true });
        expect(net.resolveHost).toHaveBeenCalledTimes(4);
        net.fetch.mockClear();
        net.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://other.example/live" } }));
        expect(await fetchDocument(url.href, 1024, undefined, headers)).toMatchObject({ failureKind: "network" });
        expect(net.fetch).toHaveBeenCalledTimes(1);
    });
});

describe("Live-link renderer diagnostics over IPC", () => {
    test("passes the approved target and headers through IPC and parses the response", async () => {
        const electron = bridge();
        const result = await requestLiveLink(url, headers, 1024, new AbortController().signal, electron, url.origin);
        expect(result).toMatchObject({ kind: "received", origin: url.origin, document: { lastUpdated: "2026-09-30" } });
        expect(electron.fetchLiveLink).toHaveBeenCalledWith(url.href, 1024, url.origin, headers, expect.any(String));
    });

    test.each([401, 403, 500])("reports HTTP %i from the main process", async status => {
        const electron = bridge();
        electron.fetchLiveLink.mockResolvedValue({ ok: false, status });
        expect(await requestLiveLink(url, {}, 1024, new AbortController().signal, electron)).toEqual({ kind: "http", origin: url.origin, httpStatus: status });
    });

    test.each(["network", "timeout", "read", "size", "json"] as const)("preserves the %s failure kind", async failureKind => {
        const electron = bridge();
        electron.fetchLiveLink.mockResolvedValue({ ok: false, status: 0, failureKind });
        expect(await requestLiveLink(url, {}, 1024, new AbortController().signal, electron)).toEqual({ kind: failureKind, origin: url.origin });
    });

    test("distinguishes invalid JSON/UTF-8 from missing data and IPC rejection", async () => {
        const electron = bridge();
        for (const bytes of [new TextEncoder().encode("<html>"), new Uint8Array([0xff])]) {
            electron.fetchLiveLink.mockResolvedValue({ ok: true, status: 200, data: bytes.buffer });
            expect(await requestLiveLink(url, {}, 1024, new AbortController().signal, electron)).toMatchObject({ kind: "json" });
        }
        electron.fetchLiveLink.mockResolvedValue({ ok: true, status: 200 });
        expect(await requestLiveLink(url, {}, 1024, new AbortController().signal, electron)).toMatchObject({ kind: "read" });
        electron.fetchLiveLink.mockRejectedValue(new Error(url.href + " secret"));
        expect(await requestLiveLink(url, {}, 1024, new AbortController().signal, electron)).toEqual({ kind: "network", origin: url.origin });
    });

    test("cancels the matching IPC request and removes its abort listener", async () => {
        const electron = bridge();
        const controller = new AbortController();
        let finish: ((result: LiveLinkFetchResult) => void) | undefined;
        electron.fetchLiveLink.mockImplementation(async () => new Promise(resolve => { finish = resolve; }));
        const pending = requestLiveLink(url, {}, 1024, controller.signal, electron);
        controller.abort();
        expect(electron.cancelLiveLink).toHaveBeenCalledWith(electron.fetchLiveLink.mock.calls[0]?.[4]);
        finish?.({ ok: false, status: 0, failureKind: "network" });
        await pending;
        const completed = bridge();
        const second = new AbortController();
        await requestLiveLink(url, {}, 1024, second.signal, completed);
        second.abort();
        expect(completed.cancelLiveLink).not.toHaveBeenCalled();
        await requestLiveLink(url, {}, 1024, controller.signal, completed);
        expect(completed.fetchLiveLink).toHaveBeenCalledTimes(1);
    });
});
