// Pure helpers for validating remote live-link targets before Electron's main
// process connects to them. Kept Electron-free so the boundary can be tested.

const nodeNet = require('node:net');

function ipv4Octets(address) {

    if (nodeNet.isIP(address) !== 4)
        return null;

    return address.split('.').map(Number);

}

function ipv6Words(address) {

    let normalized = address.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];

    if (nodeNet.isIP(normalized) !== 6)
        return null;

    const ipv4Match = /((?:\d{1,3}\.){3}\d{1,3})$/.exec(normalized);

    if (ipv4Match != null) {
        const octets = ipv4Octets(ipv4Match[1]);
        if (octets == null)
            return null;
        normalized = normalized.slice(0, -ipv4Match[1].length) +
                     (((octets[0] << 8) | octets[1]).toString(16)) + ':' +
                     (((octets[2] << 8) | octets[3]).toString(16));
    }

    const halves = normalized.split('::');
    if (halves.length > 2)
        return null;

    const left  = halves[0] === '' ? [] : halves[0].split(':');
    const right = halves.length === 1 || halves[1] === '' ? [] : halves[1].split(':');
    const zeros = 8 - left.length - right.length;

    if (zeros < 0 || (halves.length === 1 && zeros !== 0))
        return null;

    const words = [ ...left, ...Array(zeros).fill('0'), ...right ].map(word => parseInt(word, 16));

    return words.length === 8 && words.every(word => Number.isInteger(word) && word >= 0 && word <= 0xffff)
               ? words
               : null;

}

function isPublicIPAddress(address) {

    const ipv4 = ipv4Octets(address);

    if (ipv4 != null) {
        const [ first, second, third ] = ipv4;

        return !(first === 0                                      ||
                 first === 10                                     ||
                 first === 127                                    ||
                (first === 100 && second >= 64 && second <= 127)  ||
                (first === 169 && second === 254)                 ||
                (first === 172 && second >= 16 && second <= 31)   ||
                (first === 192 && second === 0 && third === 0)    ||
                (first === 192 && second === 0 && third === 2)    ||
                (first === 192 && second === 168)                 ||
                (first === 198 && (second === 18 || second === 19)) ||
                (first === 198 && second === 51 && third === 100) ||
                (first === 203 && second === 0 && third === 113)  ||
                 first >= 224);
    }

    const ipv6 = ipv6Words(address);

    if (ipv6 == null)
        return false;

    const [ first, second, third, fourth, fifth, sixth, seventh, eighth ] = ipv6;

    // IPv4-mapped and IPv4-compatible IPv6 addresses inherit the IPv4 policy.
    if (first === 0 && second === 0 && third === 0 && fourth === 0 && fifth === 0 &&
       (sixth === 0 || sixth === 0xffff)) {
        const mapped = `${(seventh >> 8) & 0xff}.${seventh & 0xff}.${(eighth >> 8) & 0xff}.${eighth & 0xff}`;
        return isPublicIPAddress(mapped);
    }

    // Public IPv6 unicast allocations live in 2000::/3. Requiring that range
    // also rejects transition mechanisms such as NAT64 that could encode a
    // private IPv4 destination behind an otherwise unfamiliar IPv6 literal.
    return (first & 0xe000) === 0x2000 &&
           !(first === 0x2001 && second === 0x0db8); // documentation

}

function parseLiveLinkHTTPSURL(value) {

    let url;

    try {
        url = new URL(value);
    }
    catch {
        throw new Error('Invalid live-link URL.');
    }

    if (url.protocol !== 'https:')
        throw new Error('Live-link URLs must use HTTPS.');

    if (url.username !== '' || url.password !== '')
        throw new Error('Live-link URLs must not contain user information.');

    url.hash = '';
    return url;

}

function validateResolvedAddresses(endpoints) {

    if (!Array.isArray(endpoints) || endpoints.length === 0)
        throw new Error('The live-link host did not resolve to an address.');

    for (const endpoint of endpoints) {
        if (endpoint == null || !isPublicIPAddress(endpoint.address))
            throw new Error('The live-link host resolves to a local, private, reserved or otherwise non-public address.');
    }

}

// A lexical startsWith() alone would let a prefix of "https://host/api" also
// cover "https://host/apievil". The match therefore has to end at a component
// boundary: either the prefix itself ends with one, or the URL continues with
// one ("/" for a deeper path, "?" for a query, "#" for a fragment).
function isWithinURLPrefix(href, prefix) {

    if (!href.startsWith(prefix))
        return false;

    if (href.length === prefix.length || prefix.endsWith('/'))
        return true;

    const boundary = href.charAt(prefix.length);
    return boundary === '/' || boundary === '?' || boundary === '#';

}

// The URLs checked here have already gained a query parameter - the live
// link's "lastUpdated" timestamp - before they reach this process. A prefix
// may itself end inside a query string ("https://host/ctrs?format=chargy"),
// and there the next parameter follows an "&", which is that component's
// boundary just as "/" is inside a path. Outside a query an "&" is an ordinary
// path character, so it only counts once the prefix carries a "?"; otherwise a
// prefix of "https://host/api" would cover "https://host/api&evil" again.
function isWithinURLPrefixAfterQueryAppend(href, prefix) {

    if (isWithinURLPrefix(href, prefix))
        return true;

    return prefix.includes('?') &&
           href.startsWith(prefix) &&
           href.charAt(prefix.length) === '&';

}

function isAllowedRedirect(fromURL, toURL, prefix) {
    return fromURL.origin === toURL.origin &&
           (prefix == null || prefix === '' || isWithinURLPrefixAfterQueryAppend(toURL.href, prefix));
}

function sanitizePayloadLimit(value, maximum = 10 * 1024 * 1024) {
    return Number.isFinite(value) && value > 0
               ? Math.min(Math.floor(value), maximum)
               : 1024 * 1024;
}

module.exports = {
    isPublicIPAddress,
    parseLiveLinkHTTPSURL,
    validateResolvedAddresses,
    isWithinURLPrefix,
    isWithinURLPrefixAfterQueryAppend,
    isAllowedRedirect,
    sanitizePayloadLimit
};
