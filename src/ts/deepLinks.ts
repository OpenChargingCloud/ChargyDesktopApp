export type ExternalURLRule = {
    prefix:           string;
    maxPayloadBytes:  number;
};

/**
 * How a live link's transport URLs that no prefix covers are treated.
 *
 * "open"   (the default): an uncovered origin is offered to the user, once per
 *          origin, remembered - trust on first use.
 * "strict": an uncovered origin is never offered and never polled. Only the
 *          prefixes below and the installation's own origin are reloaded. A
 *          self-hosting operator that lists its own servers here wants this, so
 *          its drivers are never asked a trust question they cannot judge.
 *
 * Set with a directive line `mode strict` (or `mode open`) anywhere in
 * externalURLs.conf; the last one wins, and an unknown mode leaves the default.
 * This does not touch the deep-link "verifyURL" path, which always requires a
 * prefix and never shows a dialog regardless of the mode.
 */
export type ExternalURLMode = "open" | "strict";

export function parseExternalURLConfigMode(configText: string): ExternalURLMode
{

    let mode: ExternalURLMode = "open";

    for (const rawLine of configText.split(/\r?\n/))
    {

        const line = rawLine.trim();

        if (line === "" || line.startsWith("#"))
            continue;

        const parts = line.split(/\s+/);

        if (parts[0] !== "mode")
            continue;

        if (parts[1] === "strict" || parts[1] === "open")
            mode = parts[1];

    }

    return mode;

}

export function parseExternalURLConfig(configText: string): ExternalURLRule[]
{

    return configText.
        split(/\r?\n/).
        map(line => line.trim()).
        filter(line => line !== "" && !line.startsWith("#")).
        map(line => {

            const parts              = line.split(/\s+/);
            const prefix             = parts[0] ?? "";
            const maxPayloadKBytes   = Number(parts[1]);

            if (!Number.isFinite(maxPayloadKBytes) ||
                maxPayloadKBytes <= 0)
            {
                return null;
            }

            try
            {

                const prefixURL = new URL(prefix);

                if (prefixURL.protocol !== "https:" &&
                    prefixURL.protocol !== "http:")
                {
                    return null;
                }

                return {
                    prefix:           prefixURL.href,
                    maxPayloadBytes:  Math.floor(maxPayloadKBytes * 1024)
                };

            }
            catch
            {
                return null;
            }

        }).
        filter((rule): rule is ExternalURLRule => rule != null);

}

/**
 * Whether a URL lies within a URL prefix.
 *
 * A lexical startsWith() alone would let a prefix of "https://host/api" also
 * cover "https://host/apievil". The match therefore has to end at a component
 * boundary: either the prefix itself ends with one, or the URL continues with
 * one ("/" for a deeper path, "?" for a query, "#" for a fragment).
 */
export function isWithinURLPrefix(href:   string,
                                  prefix: string): boolean
{

    if (!href.startsWith(prefix))
        return false;

    if (href.length === prefix.length || prefix.endsWith("/"))
        return true;

    const boundary = href.charAt(prefix.length);

    return boundary === "/" ||
           boundary === "?" ||
           boundary === "#";

}

export function findExternalURLRule(verifyURL: URL,
                                    rules:     ExternalURLRule[]): ExternalURLRule|null
{

    return rules.find(rule => isWithinURLPrefix(verifyURL.href, rule.prefix)) ?? null;

}

export function withDeepLinkVerificationToken(verifyURL: URL,
                                              token:     string|null): URL
{

    const downloadURL = new URL(verifyURL.href);

    if (token != null)
        downloadURL.searchParams.set("token", token);

    return downloadURL;

}

export function decodeBase64Url(base64Value: string): Uint8Array
{

    if (!/^[A-Za-z0-9_-]+$/.test(base64Value) ||
        base64Value.length % 4 === 1)
    {
        throw new Error("Deep-link verification data must use unpadded Base64URL encoding.");
    }

    const normalizedBase64 = base64Value.
        replace(/-/g, "+").
        replace(/_/g, "/");

    const paddedBase64 = normalizedBase64.padEnd(
        normalizedBase64.length + ((4 - normalizedBase64.length % 4) % 4),
        "="
    );

    const binaryString = atob(paddedBase64);
    const bytes        = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index++)
        bytes[index] = binaryString.charCodeAt(index);

    return bytes;

}

export function decodeUtf8(bytes: Uint8Array): string|null
{

    try
    {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch
    {
        return null;
    }

}

export function getDeepLinkFileName(verifyURL: URL,
                                    contentType: string): string
{

    if (verifyURL.pathname.endsWith("/"))
        throw new Error("External verification URL must reference a file.");

    const lastPathSegment = verifyURL.pathname.split("/").filter(segment => segment !== "").pop();

    if (lastPathSegment != null &&
        lastPathSegment.trim() !== "")
    {
        return lastPathSegment;
    }

    if (contentType.includes("json"))
        return "deeplink.json";

    if (contentType.includes("xml"))
        return "deeplink.xml";

    if (contentType.includes("pdf"))
        return "deeplink.pdf";

    if (contentType.includes("svg"))
        return "deeplink.svg";

    return "deeplink.bin";

}

export async function readResponseWithinLimit(response:        Response,
                                              maxPayloadBytes: number): Promise<Uint8Array>
{

    const contentLengthHeader = response.headers.get("content-length");

    if (contentLengthHeader != null)
    {
        const contentLength = Number(contentLengthHeader);

        if (Number.isFinite(contentLength) &&
            contentLength > maxPayloadBytes)
        {
            throw new Error("External verification payload exceeds configured limit.");
        }
    }

    if (response.body == null)
    {
        const data = new Uint8Array(await response.arrayBuffer());

        if (data.byteLength > maxPayloadBytes)
            throw new Error("External verification payload exceeds configured limit.");

        return data;
    }

    const reader = response.body.getReader();
    const chunks = new Array<Uint8Array>();
    let length   = 0;

    try
    {

        for (;;)
        {
            const { done, value } = await reader.read();

            if (done)
                break;

            length += value.byteLength;

            if (length > maxPayloadBytes)
            {
                await reader.cancel();
                throw new Error("External verification payload exceeds configured limit.");
            }

            chunks.push(value);
        }

    }
    finally
    {
        reader.releaseLock();
    }

    const data = new Uint8Array(length);
    let offset = 0;

    for (const chunk of chunks)
    {
        data.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return data;

}


