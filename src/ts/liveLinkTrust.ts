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

// A charge transparency live link names the URLs its live data can be fetched
// from, and the document comes from outside - so those URLs are a trust
// question, not a configuration detail. The installation may pre-answer it in
// externalURLs.conf; for everything else the user is asked once per origin and
// the answer is remembered: trust on first use.
//
// This module holds the parts of that which are plain functions - the shape of
// the remembered decisions and the structural rules a poll target has to
// satisfy before a user is even asked. The dialog and the store live in the
// application.

import { hmac }   from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

export type TrustDecision = "allow" | "deny";

/**
 * One remembered decision.
 *
 * The origin itself is not stored. Like OpenSSH's hashed known_hosts, each
 * entry keeps a fresh random salt and the keyed hash of the origin instead:
 * the store can still answer "have I seen this origin?" - the candidate
 * arrives in plain text with every live link - but a copy of the store
 * answers little on its own. What that buys, and what it does not:
 *
 *  - A snapshot of the store (a synced browser profile, a backup, a moment of
 *    access to the machine) no longer reveals where its owner charges - which
 *    is a movement profile - nor does it hand over a ready-made list of CPO
 *    live-data endpoints to probe.
 *  - The per-entry salt prevents precomputed tables and correlation: the same
 *    origin hashes differently in every entry and every installation, so two
 *    stores cannot be matched against each other.
 *  - The honest limit, same as OpenSSH's: publicly known endpoints can still
 *    be tested against each entry, one guess at a time. The protection is for
 *    what is not on a public list - and it makes the store worthless as a
 *    harvesting target rather than unreadable in principle.
 *
 * The algorithm is stored per entry, so a future switch (say, to HMAC-SHA512)
 * needs no migration: new entries simply use the new algorithm, old ones keep
 * matching with theirs. An entry whose algorithm this version does not know is
 * preserved but never matches - a newer version may still understand it.
 *
 * The label is the operator name the user saw in the consent dialog, kept so
 * the settings screen can say "GraphDefined GmbH" instead of a hash - or an
 * unhelpful cloud hostname. It names the operator, not the server: the
 * topology stays hashed.
 */
export interface ITrustedOrigin {
    algorithm: string;
    salt:      string;
    hash:      string;
    label:     string;
    decision:  TrustDecision;
    since:     string;
    lastUsed:  string;
}

/** The remembered decisions, plus how long an unused one is kept. */
export interface ITrustedOriginsStore {

    /**
     * After how many months WITHOUT USE a decision expires and is asked again,
     * or null to keep decisions indefinitely. Every time a decision actually
     * decides something - an allowed origin is polled, a denied one is blocked
     * - its clock restarts, so an entry in regular use never expires. What
     * fades is what stopped being used: a stale "always" whose server no
     * longer appears in any document, entries for endpoints an operator has
     * long since retired. Idle expiry, not forced re-consent.
     */
    retentionMonths:  number | null;

    origins:          Array<ITrustedOrigin>;

}

/**
 * A reloading client can hammer a server no faster than this, whatever the
 * document says: a viral QR code must not turn every phone that scans it
 * into a flood.
 */
export const minimumRefreshSeconds     = 5;

/**
 * And no slower than this. The refresh period is a document-controlled number
 * with no upper bound of its own, and a value large enough to overflow the
 * timer delay wraps back to firing immediately - so a document could turn its
 * own "poll rarely" into "poll as fast as the network answers" through the far
 * end of the range. One day is longer than any charging session and safely
 * inside the timer's integer range.
 */
export const maximumRefreshSeconds     = 24 * 60 * 60;

/**
 * How much a poll answer may weigh when the origin was approved by the user
 * rather than by externalURLs.conf, which states a limit per prefix.
 */
export const defaultTrustedPayloadBytes = 1024 * 1024;

//#region The remembered decisions

/** How long decisions are kept when the user has not said otherwise. */
export const defaultRetentionMonths = 6;
export const minimumRetentionMonths = 1;
export const maximumRetentionMonths = 120;

// The algorithms this version can compute, and the one new entries use. The
// salt length follows the digest length, as OpenSSH's does. Switching to a
// stronger algorithm later means adding it here and changing the current one -
// existing entries keep matching with the algorithm they were written with.
const trustHashAlgorithms: Record<string, { hash: typeof sha256, saltLength: number }> = {
    "HMAC-SHA-256": { hash: sha256, saltLength: 32 }
};

export const currentTrustHashAlgorithm = "HMAC-SHA-256";

//#region Base64 and hashing

function bytesToBase64(bytes: Uint8Array): string {

    let binary = "";

    for (const byte of bytes)
        binary += String.fromCharCode(byte);

    return btoa(binary);

}

function base64ToBytes(value: string): Uint8Array {

    const binary = atob(value);
    const bytes  = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++)
        bytes[index] = binary.charCodeAt(index);

    return bytes;

}

// The keyed hash of an origin: the salt is the key, the origin the message.
// The salt is no secret - it sits right next to the hash - its job is to make
// precomputation and cross-entry correlation impossible, not to hide.
function hashOrigin(algorithm:  string,
                    saltBytes:  Uint8Array,
                    origin:     string): Uint8Array | null {

    // Own properties only: the algorithm string comes from a stored entry, and
    // "__proto__" or "toString" must be an unknown algorithm, not an inherited
    // object that slips past the check below.
    const suite = Object.hasOwn(trustHashAlgorithms, algorithm)
                      ? trustHashAlgorithms[algorithm]
                      : undefined;

    if (suite === undefined)
        return null;

    return hmac(suite.hash, saltBytes, new TextEncoder().encode(origin));

}

/** Whether this entry is the remembered decision for the given origin. */
export function matchesTrustedOrigin(entry:  ITrustedOrigin,
                                     origin: string): boolean {

    try
    {

        const expected = base64ToBytes(entry.hash);
        const computed = hashOrigin(entry.algorithm, base64ToBytes(entry.salt), origin);

        if (computed?.length !== expected.length)
            return false;

        // Compared without an early exit; in this setting timing hardly
        // matters, but a comparison of hashes should simply look like this.
        let difference = 0;

        for (let index = 0; index < computed.length; index++)
            difference |= (computed[index] ?? 0) ^ (expected[index] ?? 0);

        return difference === 0;

    }
    catch
    {
        // Unparsable base64 is an entry that matches nothing.
        return false;
    }

}

//#endregion

/** The remembered decision for an origin, when there is one. */
export function findTrustedOrigin(store:  ITrustedOriginsStore,
                                  origin: string): ITrustedOrigin | undefined {
    return store.origins.find(entry => matchesTrustedOrigin(entry, origin));
}

/**
 * Remembers a decision for an origin, replacing whatever was remembered
 * before. The entry gets a fresh salt on every write; when the decision
 * itself has not changed, its original date is kept, so reconsidering
 * without changing anything does not reset "trusted since".
 * Returns the entry as written.
 */
export function upsertTrustedOrigin(store:     ITrustedOriginsStore,
                                    origin:    string,
                                    decision:  TrustDecision,
                                    label:     string,
                                    nowISO:    string): ITrustedOrigin {

    const existing = findTrustedOrigin(store, origin);
    const since    = existing?.decision === decision && existing.since !== ""
                         ? existing.since
                         : nowISO;

    store.origins = store.origins.filter(entry => !matchesTrustedOrigin(entry, origin));

    const suite     = trustHashAlgorithms[currentTrustHashAlgorithm];
    const saltBytes = crypto.getRandomValues(new Uint8Array(suite?.saltLength ?? 32));
    const hashBytes = hashOrigin(currentTrustHashAlgorithm, saltBytes, origin);

    if (hashBytes === null)
        throw new Error("The current trust hash algorithm is unknown to itself!");

    const entry: ITrustedOrigin = {
        algorithm:  currentTrustHashAlgorithm,
        salt:       bytesToBase64(saltBytes),
        hash:       bytesToBase64(hashBytes),
        label:      sanitizeTrustLabel(label),
        decision:   decision,
        since:      since,
        lastUsed:   nowISO
    };

    store.origins.push(entry);

    return entry;

}

/**
 * How much newer a use has to be before it is worth persisting: the expiry is
 * measured in months, so refreshing lastUsed more often than hourly would be
 * pure storage churn for a live link that reloads every few seconds.
 */
export const lastUsedGranularityMs = 60 * 60 * 1000;

/**
 * Records that the remembered decision for this origin was actually applied -
 * an allowed origin polled, a denied one blocked. Every use restarts the idle
 * expiry clock. Returns whether anything changed and is worth saving.
 */
export function touchTrustedOrigin(store:  ITrustedOriginsStore,
                                   origin: string,
                                   now:    Date): boolean {

    const entry = findTrustedOrigin(store, origin);

    if (entry === undefined)
        return false;

    const lastUsed = new Date(entry.lastUsed);

    if (!Number.isNaN(lastUsed.valueOf()) &&
        now.valueOf() - lastUsed.valueOf() < lastUsedGranularityMs)
    {
        return false;
    }

    entry.lastUsed = now.toISOString();

    return true;

}

/** Forgets the remembered decision for an origin. Returns whether one existed. */
export function removeTrustedOrigin(store:  ITrustedOriginsStore,
                                    origin: string): boolean {

    const before  = store.origins.length;
    store.origins = store.origins.filter(entry => !matchesTrustedOrigin(entry, origin));

    return store.origins.length !== before;

}

/**
 * The label an entry is shown under: the operator name the user saw when
 * consenting. Document text from outside, so control and format characters -
 * newlines, zero-width characters, bidi overrides - are stripped, the rest is
 * trimmed and capped. Rendering must additionally treat it as text, never as
 * markup.
 */
export function sanitizeTrustLabel(value: unknown): string {

    if (typeof value !== "string")
        return "";

    return value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().substring(0, 100);

}

/**
 * The label to actually store for a given origin. A label that contains the
 * origin's host would smuggle the very plaintext back into storage that the
 * hashing keeps out, so such a label is dropped - the entry then shows as an
 * unknown operator, which is the honest price of a hostname-shaped name.
 */
export function trustLabelForOrigin(label:  string,
                                    origin: string): string {

    try
    {

        const hostname = new URL(origin).hostname.toLowerCase();

        if (hostname !== "" && label.toLowerCase().includes(hostname))
            return "";

    }
    catch
    {
        // An unparsable origin is never stored anyway.
    }

    return label;

}

/**
 * The retention setting, tolerantly: null means "keep indefinitely", numbers
 * are clamped into [1, 120] months, and anything unusable falls back to the
 * default rather than to "keep forever".
 */
export function sanitizeRetentionMonths(value: unknown): number | null {

    if (value === null)
        return null;

    if (typeof value === "number" && Number.isFinite(value))
        return Math.min(Math.max(Math.round(value), minimumRetentionMonths), maximumRetentionMonths);

    return defaultRetentionMonths;

}

/**
 * When an entry expires, or null when decisions are kept indefinitely.
 * Measured from the last use, not from the decision: using a decision
 * restarts its clock, so only what lies unused actually runs out.
 */
export function trustedOriginExpiry(entry:            ITrustedOrigin,
                                    retentionMonths:  number | null): Date | null {

    if (retentionMonths === null)
        return null;

    const since = new Date(entry.lastUsed !== "" ? entry.lastUsed : entry.since);

    if (Number.isNaN(since.valueOf()))
        return null;

    // Calendar months, without JavaScript's day overflow: a decision from
    // August 31st plus six months expires on February 28th, not on March 3rd
    // via a "February 31st" that never existed.
    const expiry       = new Date(since);
    const dayOfMonth   = expiry.getUTCDate();

    expiry.setUTCDate(1);
    expiry.setUTCMonth(expiry.getUTCMonth() + retentionMonths);

    const daysInMonth  = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();

    expiry.setUTCDate(Math.min(dayOfMonth, daysInMonth));

    return expiry;

}

/**
 * Drops every entry whose time is up. An entry whose date cannot be read
 * counts as expired rather than immortal: with retention active, nothing may
 * be un-forgettable. Returns whether anything changed.
 */
export function pruneExpiredTrustedOrigins(store: ITrustedOriginsStore,
                                           now:   Date): boolean {

    if (store.retentionMonths === null)
        return false;

    const before  = store.origins.length;

    store.origins = store.origins.filter(entry => {
        const expiry = trustedOriginExpiry(entry, store.retentionMonths);
        return expiry !== null && now.valueOf() < expiry.valueOf();
    });

    return store.origins.length !== before;

}

export function emptyTrustedOriginsStore(): ITrustedOriginsStore {
    return { retentionMonths: defaultRetentionMonths, origins: [] };
}

/**
 * The stored decisions, tolerantly: anything that is not exactly an entry with
 * a salt, a hash, an algorithm and a valid decision is dropped rather than
 * trusted by accident, and a store that cannot be parsed at all counts as
 * empty - the user is simply asked again. Entries with an algorithm this
 * version does not know are kept: they never match here, but a newer version
 * may still understand them.
 */
export function parseTrustedOriginsStore(json: string | null): ITrustedOriginsStore {

    const store = emptyTrustedOriginsStore();

    if (json == null || json === "")
        return store;

    let parsed: unknown;

    try
    {
        parsed = JSON.parse(json);
    }
    catch
    {
        return store;
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
        return store;

    const parsedStore     = parsed as Record<string, unknown>;
    store.retentionMonths = sanitizeRetentionMonths(parsedStore["retentionMonths"]);

    const origins = parsedStore["origins"];

    if (!Array.isArray(origins))
        return store;

    for (const candidate of origins)
    {

        if (candidate === null || typeof candidate !== "object")
            continue;

        const entry     = candidate as Record<string, unknown>;
        const algorithm = entry["algorithm"];
        const salt      = entry["salt"];
        const hash      = entry["hash"];
        const decision  = entry["decision"];
        const since     = entry["since"];

        if (typeof algorithm !== "string" || algorithm === "" ||
            typeof salt      !== "string" || salt      === "" ||
            typeof hash      !== "string" || hash      === "")
        {
            continue;
        }

        if (decision !== "allow" && decision !== "deny")
            continue;

        const sinceText    = typeof since === "string" ? since : "";
        const lastUsed     = entry["lastUsed"];

        store.origins.push({
            algorithm:  algorithm,
            salt:       salt,
            hash:       hash,
            label:      sanitizeTrustLabel(entry["label"]),
            decision:   decision,
            since:      sinceText,
            // An entry that never recorded a use counts as used when it was
            // decided - the least surprising reading, and the one that keeps
            // it prunable.
            lastUsed:   typeof lastUsed === "string" && lastUsed !== "" ? lastUsed : sinceText
        });

    }

    return store;

}

export function serializeTrustedOriginsStore(store: ITrustedOriginsStore): string {
    return JSON.stringify(store);
}

//#endregion

//#region The structural rules

function ipv4Octets(hostname: string): number[] | null {

    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);

    if (match === null)
        return null;

    const octets = match.slice(1).map(Number);

    return octets.every(octet => octet <= 255)
               ? octets
               : null;

}

/**
 * The dotted-quad an IPv4-carrying IPv6 literal embeds, or null.
 *
 * An IPv4 address hidden inside IPv6 still reaches the same IPv4 host at the
 * socket layer, so it has to be classified as that host, not waved through as
 * an opaque IPv6 address. The WHATWG URL parser serializes the embedded IPv4
 * in hex - "[::ffff:127.0.0.1]" arrives here as "[::ffff:7f00:1]" - so the two
 * trailing hextets are decoded back into octets. Covered forms: IPv4-mapped
 * (::ffff:0:0/96), the deprecated IPv4-compatible (::/96) and NAT64
 * (64:ff9b::/96).
 */
function embeddedIPv4(hostname: string): number[] | null {

    if (!hostname.startsWith("[") || !hostname.endsWith("]"))
        return null;

    const address = hostname.slice(1, -1).toLowerCase();

    // A dotted tail can survive when the leading field is non-zero; take it.
    const dotted  = /:((?:\d{1,3}\.){3}\d{1,3})$/.exec(address);

    if (dotted !== null)
        return ipv4Octets(dotted[1] as string);

    const hex = /^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);

    if (hex === null)
        return null;

    const high = parseInt(hex[1] as string, 16);
    const low  = parseInt(hex[2] as string, 16);

    // eslint-disable-next-line no-bitwise
    return [ (high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff ];

}

/** The host of the machine itself. The WHATWG URL parser has already
 *  normalized IPv4 notations, so "127.1" arrives here as "127.0.0.1". */
export function isLoopbackHost(hostname: string): boolean {

    const host = hostname.toLowerCase();

    if (host === "localhost" || host.endsWith(".localhost"))
        return true;

    if (host === "[::1]" || host === "::1" || host === "0.0.0.0")
        return true;

    const octets = ipv4Octets(host) ?? embeddedIPv4(host);

    return octets !== null && octets[0] === 127;

}

/**
 * A host that is not on the public internet: loopback, RFC 1918, link-local
 * and IPv6 unique-local addresses. A public web application must not let a
 * document turn the user's browser into a probe for the network behind their
 * router.
 */
export function isPrivateNetworkHost(hostname: string): boolean {

    if (isLoopbackHost(hostname))
        return true;

    const host   = hostname.toLowerCase();
    const octets = ipv4Octets(host) ?? embeddedIPv4(host);

    if (octets !== null)
    {

        const [ first, second ] = octets as [ number, number, number, number ];

        return first === 10                                        ||
              (first === 172 && second >= 16 && second <= 31)      ||
              (first === 192 && second === 168)                    ||
              (first === 169 && second === 254);

    }

    if (host.startsWith("[") && host.endsWith("]"))
    {

        const address = host.slice(1, -1);

        // fc00::/7 (unique local) and fe80::/10 (link local).
        return address.startsWith("fc")  ||
               address.startsWith("fd")  ||
               address.startsWith("fe8") ||
               address.startsWith("fe9") ||
               address.startsWith("fea") ||
               address.startsWith("feb");

    }

    return false;

}

/**
 * Why this URL must not be polled, or null if it may be - subject to the
 * user's consent, which is the next gate, not this one.
 *
 * An application served from loopback is a developer's, and a developer polls
 * their own machine: for them both rules are waived.
 */
export function pollTargetProblem(url: URL, appIsLoopback: boolean): string | null {

    if (appIsLoopback && isLoopbackHost(url.hostname))
        return null;

    if (url.protocol !== "https:")
        return "only https is polled, not " + url.protocol.replace(":", "");

    if (isPrivateNetworkHost(url.hostname))
        return "the host is not on the public internet";

    return null;

}

//#endregion


