import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);

type LiveLinkNetworkSecurityModule = {
    isPublicIPAddress:         (address: string) => boolean;
    parseLiveLinkHTTPSURL:     (value: string) => URL;
    validateResolvedAddresses: (endpoints: Array<{ address: string }>) => void;
    isWithinURLPrefix:         (href: string, prefix: string) => boolean;
    isWithinURLPrefixAfterQueryAppend: (href: string, prefix: string) => boolean;
    isAllowedRedirect:         (fromURL: URL, toURL: URL, prefix?: string|null) => boolean;
    sanitizePayloadLimit:      (value: number, maximum?: number) => number;
};

const {
    isPublicIPAddress,
    parseLiveLinkHTTPSURL,
    validateResolvedAddresses,
    isWithinURLPrefix,
    isWithinURLPrefixAfterQueryAppend,
    isAllowedRedirect,
    sanitizePayloadLimit
} = require('../src/liveLinkNetworkSecurity.cjs') as LiveLinkNetworkSecurityModule;

describe('live-link network boundary', () => {

    test.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
        '100.64.0.1', '198.18.0.1', '203.0.113.10', '::1', 'fc00::1', 'fe80::1',
        '::ffff:127.0.0.1', '64:ff9b::7f00:1'
    ])('rejects non-public address %s', address => {
        expect(isPublicIPAddress(address)).toBe(false);
    });

    test.each([ '1.1.1.1', '8.8.8.8', '2606:4700:4700::1111' ])('accepts public address %s', address => {
        expect(isPublicIPAddress(address)).toBe(true);
    });

    test('accepts only credential-free HTTPS URLs and strips fragments', () => {
        expect(parseLiveLinkHTTPSURL('https://example.com/live#secret').href).toBe('https://example.com/live');
        expect(() => parseLiveLinkHTTPSURL('http://example.com/live')).toThrow(/HTTPS/);
        expect(() => parseLiveLinkHTTPSURL('https://user:pass@example.com/live')).toThrow(/user information/);
    });

    test('requires every resolved endpoint to be public', () => {
        expect(() => { validateResolvedAddresses([{ address: '1.1.1.1' }]); }).not.toThrow();
        expect(() => { validateResolvedAddresses([{ address: '1.1.1.1' }, { address: '127.0.0.1' }]); }).toThrow(/non-public/);
        expect(() => { validateResolvedAddresses([]); }).toThrow(/did not resolve/);
    });

    test('keeps redirects on the approved origin and optional prefix', () => {
        const source = new URL('https://example.com/live/a');
        expect(isAllowedRedirect(source, new URL('https://example.com/live/b'), 'https://example.com/live/')).toBe(true);
        expect(isAllowedRedirect(source, new URL('https://example.com/admin'), 'https://example.com/live/')).toBe(false);
        expect(isAllowedRedirect(source, new URL('https://example.com/liveevil'), 'https://example.com/live')).toBe(false);
        expect(isAllowedRedirect(source, new URL('https://other.example/live/b'))).toBe(false);

        // A prefix that ends inside a query string keeps working once the
        // renderer has appended its "lastUpdated" timestamp.
        const pinned = new URL('https://example.com/live?f=c&lastUpdated=1');
        expect(isAllowedRedirect(pinned, new URL('https://example.com/live?f=c&x=1'),   'https://example.com/live?f=c')).toBe(true);
        expect(isAllowedRedirect(pinned, new URL('https://example.com/live?f=chargyx'), 'https://example.com/live?f=c')).toBe(false);
    });

    test('prefixes end at component boundaries, not mid-segment', () => {
        expect(isWithinURLPrefix('https://example.com/api',         'https://example.com/api')).toBe(true);
        expect(isWithinURLPrefix('https://example.com/api/live',    'https://example.com/api')).toBe(true);
        expect(isWithinURLPrefix('https://example.com/api?token=1', 'https://example.com/api')).toBe(true);
        expect(isWithinURLPrefix('https://example.com/api#part',    'https://example.com/api')).toBe(true);
        expect(isWithinURLPrefix('https://example.com/apievil',     'https://example.com/api')).toBe(false);
        expect(isWithinURLPrefix('https://example.com/api.evil/x',  'https://example.com/api')).toBe(false);
        expect(isWithinURLPrefix('https://example.com/api/x',       'https://example.com/api/')).toBe(true);
        expect(isWithinURLPrefix('https://example.com/apix',        'https://example.com/api/')).toBe(false);
    });

    // The renderer appends "lastUpdated" before the URL reaches this process,
    // so what arrives here is never quite what externalURLs.conf listed.
    test('an appended query parameter keeps a URL within its prefix', () => {
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api?lastUpdated=1',   'https://example.com/api')).toBe(true);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api/x?lastUpdated=1', 'https://example.com/api/')).toBe(true);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api?f=c&lastUpdated=1', 'https://example.com/api?f=c')).toBe(true);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api?f=c',               'https://example.com/api?f=c')).toBe(true);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api?f=chargyevil',      'https://example.com/api?f=chargy')).toBe(false);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api&evil',   'https://example.com/api')).toBe(false);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/apievil',    'https://example.com/api')).toBe(false);
        expect(isWithinURLPrefixAfterQueryAppend('https://example.com/api.evil/x', 'https://example.com/api')).toBe(false);
    });

    test('clamps payload limits', () => {
        expect(sanitizePayloadLimit(-1)).toBe(1024 * 1024);
        expect(sanitizePayloadLimit(50 * 1024 * 1024)).toBe(10 * 1024 * 1024);
    });

});
