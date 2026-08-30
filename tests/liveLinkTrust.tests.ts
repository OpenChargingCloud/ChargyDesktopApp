import { describe, expect, test } from "vitest";

import {
    currentTrustHashAlgorithm,
    defaultRetentionMonths,
    emptyTrustedOriginsStore,
    findTrustedOrigin,
    isLoopbackHost,
    isPrivateNetworkHost,
    matchesTrustedOrigin,
    maximumRefreshSeconds,
    maximumRetentionMonths,
    minimumRefreshSeconds,
    minimumRetentionMonths,
    parseTrustedOriginsStore,
    pollTargetProblem,
    pruneExpiredTrustedOrigins,
    removeTrustedOrigin,
    sanitizeRetentionMonths,
    sanitizeTrustLabel,
    serializeTrustedOriginsStore,
    touchTrustedOrigin,
    trustLabelForOrigin,
    trustedOriginExpiry,
    upsertTrustedOrigin
} from "../src/ts/liveLinkTrust";

describe("Live link trust", () => {

    //#region The remembered decisions

    const anOrigin      = "https://api1.example.com";
    const anotherOrigin = "https://api2.example.com:8443";
    const now           = "2026-08-30T10:00:00.000Z";

    test("answers 'have I seen this origin?' without storing the origin", () => {

        const store = emptyTrustedOriginsStore();

        upsertTrustedOrigin(store, anOrigin,      "allow", "GraphDefined GmbH", now);
        upsertTrustedOrigin(store, anotherOrigin, "deny",  "GraphDefined GmbH", now);

        const reloaded = parseTrustedOriginsStore(serializeTrustedOriginsStore(store));

        expect(findTrustedOrigin(reloaded, anOrigin)?.decision).toBe("allow");
        expect(findTrustedOrigin(reloaded, anotherOrigin)?.decision).toBe("deny");
        expect(findTrustedOrigin(reloaded, "https://api3.example.com")).toBeUndefined();

    });

    test("the store never contains the origin in clear text", () => {

        // The property the hashing exists for, OpenSSH known_hosts style: a
        // copy of the store must reveal neither where its owner charges nor a
        // ready-made list of CPO endpoints. Only the operator label, which the
        // user knowingly saw when consenting, may appear.
        const store = emptyTrustedOriginsStore();

        upsertTrustedOrigin(store, anOrigin, "allow", "GraphDefined GmbH", now);

        const serialized = serializeTrustedOriginsStore(store);

        expect(serialized).not.toContain("api1");
        expect(serialized).not.toContain("example.com");
        expect(serialized).toContain("GraphDefined GmbH");
        expect(serialized).toContain(currentTrustHashAlgorithm);

    });

    test("hashes the same origin differently on every write", () => {

        // Per-entry salt, so two stores - or two writes - can never be
        // correlated by comparing hashes.
        const store1 = emptyTrustedOriginsStore();
        const store2 = emptyTrustedOriginsStore();

        const entry1 = upsertTrustedOrigin(store1, anOrigin, "allow", "", now);
        const entry2 = upsertTrustedOrigin(store2, anOrigin, "allow", "", now);

        expect(entry1.salt).not.toBe(entry2.salt);
        expect(entry1.hash).not.toBe(entry2.hash);

        // ...and both still match the very same origin.
        expect(matchesTrustedOrigin(entry1, anOrigin)).toBe(true);
        expect(matchesTrustedOrigin(entry2, anOrigin)).toBe(true);
        expect(matchesTrustedOrigin(entry1, anotherOrigin)).toBe(false);

    });

    test("remembers one decision per origin, the last one", () => {

        const store = emptyTrustedOriginsStore();

        upsertTrustedOrigin(store, anOrigin, "allow", "", now);
        upsertTrustedOrigin(store, anOrigin, "deny",  "", "2026-09-01T00:00:00.000Z");

        expect(store.origins).toHaveLength(1);
        expect(findTrustedOrigin(store, anOrigin)?.decision).toBe("deny");

    });

    test("keeps the original date when the decision has not changed", () => {

        // Reconsidering without changing anything must not reset
        // "trusted since" - and changing the decision must.
        const store = emptyTrustedOriginsStore();

        upsertTrustedOrigin(store, anOrigin, "allow", "", now);

        const reconfirmed = upsertTrustedOrigin(store, anOrigin, "allow", "", "2026-09-01T00:00:00.000Z");
        expect(reconfirmed.since).toBe(now);

        const changed     = upsertTrustedOrigin(store, anOrigin, "deny", "", "2026-09-02T00:00:00.000Z");
        expect(changed.since).toBe("2026-09-02T00:00:00.000Z");

    });

    test("forgets a decision on request", () => {

        const store = emptyTrustedOriginsStore();

        upsertTrustedOrigin(store, anOrigin, "allow", "", now);

        expect(removeTrustedOrigin(store, anOrigin)).toBe(true);
        expect(findTrustedOrigin(store, anOrigin)).toBeUndefined();
        expect(removeTrustedOrigin(store, anOrigin)).toBe(false);

    });

    test("preserves entries of an unknown algorithm without matching them", () => {

        // Crypto agility, forward direction: an entry written by a newer
        // version with, say, HMAC-SHA512 must survive this version - it just
        // never matches here, so the user is simply asked again.
        const parsed = parseTrustedOriginsStore(JSON.stringify({
            retentionMonths: 6,
            origins: [
                { algorithm: "HMAC-SHA-512", salt: "c2FsdA==", hash: "aGFzaA==",
                  label: "Future Corp", decision: "allow", since: now }
            ]
        }));

        expect(parsed.origins).toHaveLength(1);
        expect(findTrustedOrigin(parsed, anOrigin)).toBeUndefined();
        expect(parseTrustedOriginsStore(serializeTrustedOriginsStore(parsed)).origins).toHaveLength(1);

    });

    test("treats an unreadable store as empty instead of trusting it", () => {

        for (const json of [ null, "", "not json at all", "[ 1, 2, 3 ]", "42" ])
        {
            const store = parseTrustedOriginsStore(json);
            expect(store.origins).toHaveLength(0);
            expect(store.retentionMonths).toBe(defaultRetentionMonths);
        }

    });

    test("drops malformed entries rather than trusting them by accident", () => {

        const parsed = parseTrustedOriginsStore(JSON.stringify({
            retentionMonths: 12,
            origins: [
                { algorithm: "HMAC-SHA-256", salt: "c2FsdA==", hash: "aGFzaA==", decision: "allow", since: now },
                { algorithm: "HMAC-SHA-256", salt: "c2FsdA==", hash: "aGFzaA==", decision: "maybe", since: now },
                { algorithm: "HMAC-SHA-256", salt: "",         hash: "aGFzaA==", decision: "allow", since: now },
                { algorithm: "HMAC-SHA-256", salt: "c2FsdA==",                   decision: "allow", since: now },
                "allow",
                42
            ]
        }));

        expect(parsed.origins).toHaveLength(1);
        expect(parsed.retentionMonths).toBe(12);
        expect(parsed.origins[0]?.label).toBe("");

    });

    test("keeps the operator label as text, trimmed and capped", () => {

        expect(sanitizeTrustLabel("  GraphDefined GmbH  ")).toBe("GraphDefined GmbH");
        expect(sanitizeTrustLabel("x".repeat(500))).toHaveLength(100);
        expect(sanitizeTrustLabel(42)).toBe("");
        expect(sanitizeTrustLabel(undefined)).toBe("");
        expect(sanitizeTrustLabel({ toString: (): string => "sneaky" })).toBe("");

    });

    test("strips control and format characters from the label", () => {

        // Newlines would let one label render as several lines, zero-width
        // characters would fake an "empty" label past the unknown-operator
        // fallback, and a bidi override would display the name reversed.
        const newline   = String.fromCharCode(10);
        const zeroWidth = String.fromCharCode(0x200B);
        const bidiRTL   = String.fromCharCode(0x202E);

        expect(sanitizeTrustLabel("Graph" + newline   + "Defined")).toBe("GraphDefined");
        expect(sanitizeTrustLabel("Graph" + zeroWidth + "Defined")).toBe("GraphDefined");
        expect(sanitizeTrustLabel(bidiRTL + "dehnifeD")).toBe("dehnifeD");
        expect(sanitizeTrustLabel(zeroWidth + zeroWidth + zeroWidth)).toBe("");

    });

    test("drops a label that would smuggle the origin back into storage", () => {

        // The label is stored in clear text; an operator "named" after the
        // very host being hashed would defeat the hashing through the back
        // door, so such a label is not stored at all.
        expect(trustLabelForOrigin("api1.example.com",           "https://api1.example.com")).toBe("");
        expect(trustLabelForOrigin("Lade-API1.EXAMPLE.COM GmbH", "https://api1.example.com")).toBe("");
        expect(trustLabelForOrigin("GraphDefined GmbH",          "https://api1.example.com")).toBe("GraphDefined GmbH");

    });

    test("treats prototype property names as unknown algorithms", () => {

        // "__proto__" or "toString" as a stored algorithm must be an unknown
        // algorithm - not an inherited object that slips past the lookup.
        for (const algorithm of [ "__proto__", "constructor", "toString", "hasOwnProperty" ])
        {

            const store = parseTrustedOriginsStore(JSON.stringify({
                retentionMonths: 6,
                origins: [ { algorithm, salt: "c2FsdA==", hash: "aGFzaA==", decision: "allow", since: now } ]
            }));

            expect(store.origins, algorithm).toHaveLength(1);
            expect(findTrustedOrigin(store, anOrigin), algorithm).toBeUndefined();

        }

    });

    test("parses the previous plain text store as empty, so loading rewrites it", () => {

        // The earlier format stored origins in clear text under the same key.
        // It parses as an empty store, and - crucially - serializes to
        // something different from what is stored, which is the trigger for
        // the application to overwrite and thereby delete the plain text.
        const legacy = JSON.stringify({
            "https://api1.example.com": { decision: "allow", since: now }
        });

        const store = parseTrustedOriginsStore(legacy);

        expect(store.origins).toHaveLength(0);
        expect(serializeTrustedOriginsStore(store)).not.toBe(legacy);
        expect(serializeTrustedOriginsStore(store)).not.toContain("example.com");

    });

    //#endregion

    //#region Retention

    test("clamps the retention setting into [1, 120] months", () => {

        expect(sanitizeRetentionMonths(null)).toBeNull();
        expect(sanitizeRetentionMonths(6)).toBe(6);
        expect(sanitizeRetentionMonths(0)).toBe(minimumRetentionMonths);
        expect(sanitizeRetentionMonths(-5)).toBe(minimumRetentionMonths);
        expect(sanitizeRetentionMonths(121)).toBe(maximumRetentionMonths);
        expect(sanitizeRetentionMonths(6.4)).toBe(6);

        // Anything unusable falls back to the default, never to "keep forever".
        expect(sanitizeRetentionMonths(undefined)).toBe(defaultRetentionMonths);
        expect(sanitizeRetentionMonths("twelve")).toBe(defaultRetentionMonths);
        expect(sanitizeRetentionMonths(Number.NaN)).toBe(defaultRetentionMonths);

    });

    test("expires decisions after the configured months without use", () => {

        const store = emptyTrustedOriginsStore();
        store.retentionMonths = 6;

        const entry  = upsertTrustedOrigin(store, anOrigin, "allow", "", "2026-01-15T12:00:00.000Z");
        const expiry = trustedOriginExpiry(entry, store.retentionMonths);

        expect(expiry?.toISOString()).toBe("2026-07-15T12:00:00.000Z");

        expect(pruneExpiredTrustedOrigins(store, new Date("2026-07-15T11:59:59.000Z"))).toBe(false);
        expect(store.origins).toHaveLength(1);

        expect(pruneExpiredTrustedOrigins(store, new Date("2026-07-15T12:00:00.000Z"))).toBe(true);
        expect(store.origins).toHaveLength(0);

    });

    test("expiry stays within the calendar month instead of overflowing", () => {

        // August 31st plus six months must be February 28th - JavaScript's raw
        // month arithmetic would produce "February 31st" and roll into March,
        // retaining the decision three days longer than configured.
        const store = emptyTrustedOriginsStore();
        const entry = upsertTrustedOrigin(store, anOrigin, "allow", "", "2026-08-31T12:00:00.000Z");

        expect(trustedOriginExpiry(entry, 6)?.toISOString()).toBe("2027-02-28T12:00:00.000Z");
        expect(trustedOriginExpiry(entry, 1)?.toISOString()).toBe("2026-09-30T12:00:00.000Z");

    });

    test("using a decision restarts its expiry clock", () => {

        // Expiry means expiry on DISUSE: an entry that keeps deciding things
        // must never run out, however old the decision itself is. Only what
        // stopped being used fades away.
        const store = emptyTrustedOriginsStore();
        store.retentionMonths = 6;

        const entry = upsertTrustedOrigin(store, anOrigin, "allow", "", "2026-01-15T12:00:00.000Z");

        expect(entry.lastUsed).toBe("2026-01-15T12:00:00.000Z");

        // Used again five months later: the expiry moves with the use, while
        // "since" keeps naming the original decision.
        expect(touchTrustedOrigin(store, anOrigin, new Date("2026-06-15T12:00:00.000Z"))).toBe(true);
        expect(entry.since).toBe("2026-01-15T12:00:00.000Z");
        expect(entry.lastUsed).toBe("2026-06-15T12:00:00.000Z");
        expect(trustedOriginExpiry(entry, 6)?.toISOString()).toBe("2026-12-15T12:00:00.000Z");

        // Well past the original six months, but not past the last use:
        // the entry survives.
        expect(pruneExpiredTrustedOrigins(store, new Date("2026-10-01T00:00:00.000Z"))).toBe(false);
        expect(store.origins).toHaveLength(1);

    });

    test("persists a use no more than hourly", () => {

        // A live link reloads every few seconds; recording each reload would
        // churn the storage for an expiry that is measured in months.
        const store = emptyTrustedOriginsStore();
        const entry = upsertTrustedOrigin(store, anOrigin, "allow", "", "2026-08-30T10:00:00.000Z");

        expect(touchTrustedOrigin(store, anOrigin, new Date("2026-08-30T10:59:59.000Z"))).toBe(false);
        expect(entry.lastUsed).toBe("2026-08-30T10:00:00.000Z");

        expect(touchTrustedOrigin(store, anOrigin, new Date("2026-08-30T11:00:00.000Z"))).toBe(true);
        expect(entry.lastUsed).toBe("2026-08-30T11:00:00.000Z");

        expect(touchTrustedOrigin(store, "https://unknown.example", new Date("2026-08-30T12:00:00.000Z"))).toBe(false);

    });

    test("reads an entry without a recorded use as used when it was decided", () => {

        const store = parseTrustedOriginsStore(JSON.stringify({
            retentionMonths: 6,
            origins: [
                { algorithm: "HMAC-SHA-256", salt: "c2FsdA==", hash: "aGFzaA==",
                  decision: "allow", since: "2026-01-15T12:00:00.000Z" }
            ]
        }));

        const entry = store.origins[0];

        expect(entry?.lastUsed).toBe("2026-01-15T12:00:00.000Z");

        if (entry !== undefined)
            expect(trustedOriginExpiry(entry, 6)?.toISOString()).toBe("2026-07-15T12:00:00.000Z");

    });

    test("keeps decisions indefinitely when retention is off", () => {

        const store = emptyTrustedOriginsStore();
        store.retentionMonths = null;

        const entry = upsertTrustedOrigin(store, anOrigin, "allow", "", "2000-01-01T00:00:00.000Z");

        expect(trustedOriginExpiry(entry, null)).toBeNull();
        expect(pruneExpiredTrustedOrigins(store, new Date("2099-01-01T00:00:00.000Z"))).toBe(false);
        expect(store.origins).toHaveLength(1);

    });

    test("an entry whose date cannot be read expires rather than living forever", () => {

        const store = parseTrustedOriginsStore(JSON.stringify({
            retentionMonths: 6,
            origins: [
                { algorithm: "HMAC-SHA-256", salt: "c2FsdA==", hash: "aGFzaA==",
                  decision: "allow", since: "not a date" }
            ]
        }));

        expect(pruneExpiredTrustedOrigins(store, new Date(now))).toBe(true);
        expect(store.origins).toHaveLength(0);

    });

    //#endregion

    //#region Loopback and private networks

    test("recognizes loopback hosts", () => {

        for (const host of [ "localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "127.255.0.1", "[::1]", "0.0.0.0" ])
            expect(isLoopbackHost(host), host).toBe(true);

        for (const host of [ "example.com", "127.0.0.1.example.com", "128.0.0.1", "notlocalhost" ])
            expect(isLoopbackHost(host), host).toBe(false);

    });

    test("recognizes hosts that are not on the public internet", () => {

        for (const host of [ "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1",
                             "169.254.169.254", "[fd00::1]", "[fc00::1]", "[fe80::1]", "localhost" ])
            expect(isPrivateNetworkHost(host), host).toBe(true);

        for (const host of [ "8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.0.1",
                             "example.com", "[2001:db8::1]" ])
            expect(isPrivateNetworkHost(host), host).toBe(false);

    });

    test("sees through IPv4 hidden inside an IPv6 literal", () => {

        // The forms the URL parser produces from [::ffff:192.168.1.1] etc.
        const privateHex = {
            "[::ffff:c0a8:101]":   "192.168.1.1 mapped",
            "[::ffff:a00:1]":      "10.0.0.1 mapped",
            "[::ffff:a9fe:a9fe]":  "169.254.169.254 mapped (cloud metadata)",
            "[::ffff:7f00:1]":     "127.0.0.1 mapped",
            "[::7f00:1]":          "127.0.0.1 compatible",
            "[64:ff9b::c0a8:101]": "192.168.1.1 via NAT64"
        };

        for (const [ host, what ] of Object.entries(privateHex))
            expect(isPrivateNetworkHost(host), what).toBe(true);

        // Loopback in disguise is loopback.
        expect(isLoopbackHost("[::ffff:7f00:1]")).toBe(true);
        expect(isLoopbackHost("[::7f00:1]")).toBe(true);

        // A mapped PUBLIC address stays public, and a genuine global IPv6 is
        // not misread as carrying a private IPv4.
        expect(isPrivateNetworkHost("[::ffff:808:808]")).toBe(false); // 8.8.8.8 mapped
        expect(isPrivateNetworkHost("[2001:db8::1]")).toBe(false);
        expect(pollTargetProblem(new URL("https://[::ffff:169.254.169.254]/live"), false)).not.toBeNull();
        expect(pollTargetProblem(new URL("https://[::ffff:192.168.1.1]/live"),     false)).not.toBeNull();

    });

    //#endregion

    //#region The structural poll rules

    test("polls only https on the public internet", () => {

        expect(pollTargetProblem(new URL("https://api.example.com/live"),   false)).toBeNull();
        expect(pollTargetProblem(new URL("http://api.example.com/live"),    false)).not.toBeNull();
        expect(pollTargetProblem(new URL("https://192.168.1.1/live"),       false)).not.toBeNull();
        expect(pollTargetProblem(new URL("https://[fd00::1]/live"),         false)).not.toBeNull();

    });

    test("waives both rules for a developer polling their own machine", () => {

        expect(pollTargetProblem(new URL("http://localhost:1608/live.json"),  true)).toBeNull();
        expect(pollTargetProblem(new URL("https://127.0.0.1:8443/live"),      true)).toBeNull();

        // ... but only for loopback targets: a document loaded into a
        // developer's browser still must not probe the developer's LAN.
        expect(pollTargetProblem(new URL("https://192.168.1.1/live"),         true)).not.toBeNull();
        expect(pollTargetProblem(new URL("http://api.example.com/live"),      true)).not.toBeNull();

    });

    test("the WHATWG URL parser normalizes IPv4 tricks before the rules run", () => {

        // "0x7f.1" and "127.1" are loopback in disguise; new URL() unmasks
        // them, so the hostname the rules see is already canonical.
        expect(new URL("https://0x7f.0.0.1/").hostname).toBe("127.0.0.1");
        expect(new URL("https://127.1/").hostname).toBe("127.0.0.1");
        expect(pollTargetProblem(new URL("https://127.1/"), false)).not.toBeNull();

    });

    test("enforces a floor and a ceiling on the refresh period", () => {

        expect(minimumRefreshSeconds).toBeGreaterThanOrEqual(5);

        // The ceiling exists so a huge document value cannot overflow the timer
        // delay into an immediate, back-to-back loop, and stays inside the
        // signed-32-bit millisecond range setTimeout accepts.
        expect(maximumRefreshSeconds).toBeGreaterThan(minimumRefreshSeconds);
        expect(maximumRefreshSeconds * 1000).toBeLessThan(2 ** 31 - 1);

        const clamp = (refresh: number): number =>
            Math.min(Math.max(refresh, minimumRefreshSeconds), maximumRefreshSeconds);

        expect(clamp(1)).toBe(minimumRefreshSeconds);
        expect(clamp(1e309)).toBe(maximumRefreshSeconds);   // 1e309 parses to Infinity
        expect(clamp(1e308)).toBe(maximumRefreshSeconds);
        expect(clamp(600)).toBe(600);

    });

    //#endregion

});


