export type LiveLinkFailureKind = "network" | "timeout" | "http" | "read" | "size" | "json" | "document" | "conversion";

export type LiveLinkPollFailure = {
    kind:        LiveLinkFailureKind;
    origin:      string;
    httpStatus?: number;
    detail?:     string;
};

export type LiveLinkFetchResult = {
    ok:           boolean;
    status:       number;
    data?:        ArrayBuffer;
    failureKind?: "network" | "timeout" | "read" | "size" | "json";
};

export type LiveLinkFetcher = {
    fetchLiveLink(url: string, maxPayloadBytes: number, prefix?: string, headers?: Record<string, string>, requestId?: string): Promise<LiveLinkFetchResult>;
    cancelLiveLink(requestId: string): void;
};

export type LiveLinkResponse = {
    kind:       "received";
    origin:     string;
    document:   unknown;
    text:       string;
    receivedAt: Date;
};

// Electron owns the network boundary, timeout and payload limit. Only the
// origin and a structured failure reach the UI; exception messages may contain
// credentials or full URLs and must never be used as diagnostic text.
export async function requestLiveLink(url:             URL,
                                      headers:         Record<string, string>,
                                      maxPayloadBytes: number,
                                      signal:          AbortSignal,
                                      electron:        LiveLinkFetcher,
                                      prefix?:         string): Promise<LiveLinkResponse | LiveLinkPollFailure>
{
    if (signal.aborted)
        return { kind: "network", origin: url.origin };

    const requestId = crypto.randomUUID();
    const abort = (): void => { electron.cancelLiveLink(requestId); };
    signal.addEventListener("abort", abort, { once: true });
    let phase: "network" | "json" = "network";
    try
    {
        const response = await electron.fetchLiveLink(url.href, maxPayloadBytes, prefix, headers, requestId);
        if (!response.ok)
        {
            if (response.status !== 0)
                return { kind: "http", origin: url.origin, httpStatus: response.status };
            return { kind: response.failureKind ?? "network", origin: url.origin };
        }
        if (response.data === undefined)
            return { kind: "read", origin: url.origin };

        phase = "json";
        const text = new TextDecoder("utf-8", { fatal: true }).decode(response.data);
        const document: unknown = JSON.parse(text);
        return { kind: "received", origin: url.origin, document, text, receivedAt: new Date() };
    }
    catch
    {
        return { kind: phase, origin: url.origin };
    }
    finally
    {
        signal.removeEventListener("abort", abort);
    }
}
