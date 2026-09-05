/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The HTTP headers a live link transport asks for, and what it takes to send
// them.
//
// A document may state a header as the literal string to send, or as a
// provider that computes the value per request - a one-time password would be
// stale the moment it was written into a document, so it cannot be stated at
// all. Reading therefore happens in two steps, at two different times:
//
//   customRequestHeaders()   once, when the polling is set up: what the
//                            document asks for, validated down to what may be
//                            sent at all.
//   resolveRequestHeaders()  before every single request: the literal values
//                            as they stand, the provider values computed now.
//
// The document comes from outside, so what it asks for is validated rather
// than trusted, and one unusable entry costs its own header and nothing else -
// neither the other headers nor the request.
//
// Unlike the web application, the request itself is sent by Electron's main
// process, which applies these same limits again to whatever the renderer
// hands it: this module is what the document asked for, not what is trusted.

import { generateTOTPs }          from '@open-charging-cloud/totp';
import type { TOTPHashAlgorithm } from '@open-charging-cloud/totp';
import * as chargyLib             from '@open-charging-cloud/chargy-core';

/**
 * How many headers a live link may set. An operator needs an API key and
 * perhaps a tenant selector, not an arbitrarily long list a document could use
 * to blow up every request the client sends.
 */
export const maximumCustomHeaders           = 16;

/** How long a header name and a header value may be. */
export const maximumCustomHeaderNameLength  = 64;
export const maximumCustomHeaderValueLength = 1024;

// RFC 9110 token, which is what a header name has to be. Anything else - a
// space, a colon, a newline - is not a name but an attempt to write a request
// line of its own.
const customHeaderNamePattern  = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

// And what a value may consist of: visible ASCII, space and tab. The wider
// byte range a header value technically allows is left out on purpose - it
// would depend on how the runtime encodes a JavaScript string into bytes,
// which is exactly the kind of ambiguity a request must not carry.
const customHeaderValuePattern = /^[\t\x20-\x7E]*$/;

/**
 * The header names that are not a document's to set.
 *
 * In a browser fetch() drops these silently: the request simply goes without
 * them, with no error anywhere. Electron's main process is not a browser and
 * would happily send most of them, which is the stronger reason to drop them
 * here - a document has no business writing this application's Host, Origin or
 * Cookie, and a request that carries what the document chose for them is not
 * the request this application meant to send.
 *
 * The list is the Fetch standard's forbidden request-headers, plus the two
 * prefixes it reserves. Keeping the browser's list verbatim also keeps the two
 * Chargy applications answering the same way to the same document.
 */
const forbiddenCustomHeaderNames = new Set([
    "accept-charset", "accept-encoding", "access-control-request-headers",
    "access-control-request-method", "connection", "content-length", "cookie",
    "cookie2", "date", "dnt", "expect", "host", "keep-alive", "origin",
    "referer", "set-cookie", "te", "trailer", "transfer-encoding", "upgrade",
    "via"
]);

const forbiddenCustomHeaderPrefixes = [ "proxy-", "sec-" ];

/** One header a document asks for: a literal value, or one to be computed. */
export interface ICustomHeader {
    name:   string;
    value:  CustomHeaderSource;
}

export type CustomHeaderSource =
    | { kind: "literal",  value: string }
    | { kind: "provider", provider: string, parameters: chargyLib.JSONObject };

/**
 * The headers a live link asks for on every request to one of its transports,
 * e.g. an API key its endpoint expects - validated down to what may actually
 * be sent, in the order the document names them.
 *
 * What is dropped, and why: a name that is not an RFC 9110 token, or one that
 * is not a document's to set; a value that is not visible ASCII, is empty, or
 * is implausibly long; a second spelling of a name HTTP already considers
 * taken; everything past the maximum. A provider entry is kept whatever its
 * parameters look like - whether it can be computed is a question for the
 * provider, and it is asked per request.
 */
export function customRequestHeaders(value: unknown): Array<ICustomHeader> {

    if (!chargyLib.isMandatoryJSONObject(value))
        return [];

    const headers = new Array<ICustomHeader>();

    // HTTP compares header names case-insensitively: "X-Key" and "x-key" are
    // one header, and a Headers object would join them into one
    // comma-separated value. The first one given wins instead.
    const taken   = new Set<string>();

    for (const [ name, headerValue ] of Object.entries(value))
    {

        const key = name.toLowerCase();

        if (name.length > maximumCustomHeaderNameLength ||
            !customHeaderNamePattern.test(name)         ||
            taken.has(key))
        {
            continue;
        }

        if (forbiddenCustomHeaderNames.has(key) ||
            forbiddenCustomHeaderPrefixes.some(prefix => key.startsWith(prefix)))
        {
            console.log("Not sending the custom header '" + name + "' of this charge transparency live link: it is not a document's to set.");
            continue;
        }

        const source = customHeaderSource(headerValue);

        if (source === null)
            continue;

        headers.push({ name: name, value: source });
        taken.add(key);

        if (headers.length >= maximumCustomHeaders)
            break;

    }

    return headers;

}

// What one entry of customHeaders carries, or null when it carries nothing
// sendable. A string is the value itself; an object names a provider that
// computes it. Anything else - a number, an array, null - is neither.
function customHeaderSource(value: unknown): CustomHeaderSource | null {

    if (typeof value === "string")
    {

        // Leading and trailing whitespace is not part of a header value.
        const trimmed = value.trim();

        return trimmed !== ""                                   &&
               trimmed.length <= maximumCustomHeaderValueLength &&
               customHeaderValuePattern.test(trimmed)
                   ? { kind: "literal", value: trimmed }
                   : null;

    }

    if (chargyLib.isMandatoryJSONObject(value))
    {

        const provider = chargyLib.asString(value["valueProvider"]);

        if (provider === undefined || provider.trim() === "")
            return null;

        return {
            kind:        "provider",
            provider:    provider.trim(),
            parameters:  chargyLib.asJSONObject(value["parameters"]) ?? {}
        };

    }

    return null;

}

/**
 * The headers as they go into one request: the literal values as they stand,
 * the provider values computed for this moment.
 *
 * A provider nobody implements, or one whose parameters do not hold up,
 * contributes no header - never the text of an object, and never a stale
 * value. The request still goes out: a header that could not be computed is
 * the endpoint's to reject, not a reason to stop asking.
 *
 * The clock is a parameter so this can be tested; a document does not get to
 * choose it. A one-time password whose moment came out of the document would
 * be a password frozen in time, which is precisely what it must not be.
 */
export function resolveRequestHeaders(headers:  Array<ICustomHeader>,
                                      now:      Date = new Date()): Record<string, string> {

    const resolved: Record<string, string> = {};

    for (const header of headers)
    {

        if (header.value.kind === "literal")
        {
            resolved[header.name] = header.value.value;
            continue;
        }

        const value = providedHeaderValue(header.value.provider, header.value.parameters, now);

        if (value === null)
        {
            console.log("Not sending the custom header '" + header.name + "' of this charge transparency live link: its '" + header.value.provider + "' value could not be computed.");
            continue;
        }

        resolved[header.name] = value;

    }

    return resolved;

}

/** The value providers this client knows. Names compare case-insensitively. */
function providedHeaderValue(provider:    string,
                             parameters:  chargyLib.JSONObject,
                             now:         Date): string | null {

    switch (provider.toLowerCase())
    {

        case "totp":
            return totpHeaderValue(parameters, now);

        default:
            return null;

    }

}

/** The hash algorithms @open-charging-cloud/totp accepts. */
const totpHashAlgorithms: ReadonlyArray<TOTPHashAlgorithm> = [ "sha256", "sha384", "sha512" ];

// A parameter the document states, or null when it did not state a usable one
// - which is what the generator wants for "use your default".
function totpNumber(value: unknown): number | null {

    const number = chargyLib.asNumber(value);

    return number !== undefined && Number.isFinite(number) && number > 0
               ? number
               : null;

}

/**
 * The current one-time password for these parameters, or null when the
 * document did not state usable ones.
 *
 * Every option the generator takes can be stated — the shared secret, the slot
 * length, the token length, the alphabet, the hash algorithm — except the
 * moment: that is always now. A timestamp out of a document would freeze the
 * password at whatever instant it was written, which is the one thing a
 * time-based password must never be. What a document leaves out stays the
 * generator's default.
 *
 * Of the three passwords the generator returns — previous, current, next — the
 * current one is sent. The other two exist for a verifier that has to tolerate
 * a clock difference; sending them would be the client tolerating its own.
 */
function totpHeaderValue(parameters:  chargyLib.JSONObject,
                         now:         Date): string | null {

    const sharedSecret  = chargyLib.asString(parameters["sharedSecret"]);

    if (sharedSecret === undefined || sharedSecret.trim() === "")
        return null;

    const alphabet      = chargyLib.asString(parameters["alphabet"]);
    const hashAlgorithm = chargyLib.asString(parameters["hashAlgorithm"])?.trim().toLowerCase();

    try
    {

        const totps = generateTOTPs({
                          sharedSecret:   sharedSecret,
                          validityTime:   totpNumber(parameters["validityTime"]),
                          totpLength:     totpNumber(parameters["totpLength"]),
                          alphabet:       alphabet !== undefined && alphabet !== "" ? alphabet : null,
                          timestamp:      now,
                          hashAlgorithm:  totpHashAlgorithms.find(algorithm => algorithm === hashAlgorithm) ?? null
                      });

        return totps.current;

    }
    catch
    {
        // The generator refuses what it cannot work with: a secret that is too
        // short, an alphabet of one character. That is the document's mistake,
        // and not a reason for the poll to fail.
        return null;
    }

}
