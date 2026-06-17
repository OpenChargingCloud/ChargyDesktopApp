const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

let generateTOTPs = null;

try
{
    ({
        generateTOTPs
    } = require(path.join(__dirname, '..', 'node_modules', '@open-charging-cloud', 'totp', 'dist', 'index.js')));
}
catch
{
    // Older CJS runtimes need the explicit async initializer exported below.
}

const ApiKeyRole = Object.freeze({
    EVDriver: "evDriver",
    Root:     "root"
});

const apiKeyRoles = new Set(Object.values(ApiKeyRole));
const defaultTOTPValidityTime   = 10;
const defaultTOTPLength         = 32;
const defaultTOTPHashAlgorithm  = "sha256";
const defaultTOTPAlphabet       = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function initializeTOTPGenerator() {

    if (typeof generateTOTPs === "function")
        return;

    const totpModule = await import('@open-charging-cloud/totp');

    if (typeof totpModule.generateTOTPs !== "function")
        throw new Error("@open-charging-cloud/totp does not export generateTOTPs.");

    generateTOTPs = totpModule.generateTOTPs;

}

function getTOTPGenerator() {

    if (typeof generateTOTPs !== "function")
        throw new Error("@open-charging-cloud/totp has not been initialized.");

    return generateTOTPs;

}

function parseApiKeyRole(value) {

    if (typeof value !== "string" || !apiKeyRoles.has(value))
        throw new Error("Invalid API key role: " + String(value));

    return value;

}

function parseApiKeyRoles(rawEntry) {

    if (Object.prototype.hasOwnProperty.call(rawEntry, "role"))
        throw new Error("API key entry must use roles, not role.");

    const rawRoles = rawEntry.roles;

    if (rawRoles == null)
        return [ ApiKeyRole.EVDriver ];

    if (!Array.isArray(rawRoles) || rawRoles.length === 0)
        throw new Error("API key roles must not be empty.");

    const parsedRoles = [];

    for (const roleValue of rawRoles)
    {
        const role = parseApiKeyRole(roleValue);

        if (!parsedRoles.includes(role))
            parsedRoles.push(role);
    }

    return parsedRoles;

}

function parseIsoTimestamp(value, fieldName) {

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value))
        throw new Error("Invalid API key " + fieldName + " timestamp.");

    const timestamp = new Date(value);

    if (Number.isNaN(timestamp.getTime()))
        throw new Error("Invalid API key " + fieldName + " timestamp.");

    return timestamp;

}

function parseOptionalIsoTimestamp(value, fieldName) {

    if (value == null)
        return undefined;

    return parseIsoTimestamp(value, fieldName);

}

function normalizeTOTPHashAlgorithm(value) {

    if (value == null)
        return defaultTOTPHashAlgorithm;

    if (typeof value !== "string" || value.trim() === "")
        throw new Error("Invalid TOTP hashAlgorithm.");

    const normalized = value.trim();

    if (normalized === "sha256" ||
        normalized === "sha384" ||
        normalized === "sha512")
    {
        return normalized;
    }

    throw new Error("Unsupported TOTP hashAlgorithm: " + value);

}

function normalizeTOTPAlphabet(value) {

    if (value == null)
        return defaultTOTPAlphabet;

    if (typeof value !== "string" || value.trim() === "")
        throw new Error("Invalid TOTP alphabet.");

    const normalized = value.trim();

    if (normalized.length < 4)
        throw new Error("The given TOTP alphabet must contain at least 4 characters.");

    if (new Set(normalized).size !== normalized.length)
        throw new Error("The given TOTP alphabet must not contain duplicate characters.");

    if (/\s/u.test(normalized))
        throw new Error("The given TOTP alphabet must not contain whitespace characters.");

    return normalized;

}

function parseTOTPApiKeyConfiguration(value, entryIndex) {

    if (value == null)
        return undefined;

    if (typeof value !== "object" || Array.isArray(value))
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP configuration must be a JSON object.");

    if (Object.prototype.hasOwnProperty.call(value, "encoding"))
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP configuration must use alphabet, not encoding.");

    if (typeof value.sharedSecrect !== "string" || value.sharedSecrect.trim() === "")
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP configuration must contain a non-empty sharedSecrect.");

    const sharedSecrect = value.sharedSecrect.trim();

    if (/\s/u.test(sharedSecrect))
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP sharedSecrect must not contain whitespace characters.");

    if (sharedSecrect.length < 16)
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP sharedSecrect must contain at least 16 characters.");

    const validityTime = value.validityTime == null
                             ? defaultTOTPValidityTime
                             : value.validityTime;

    if (!Number.isInteger(validityTime) || validityTime <= 0)
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP validityTime must be a positive integer.");

    const length = value.length == null
                       ? defaultTOTPLength
                       : value.length;

    if (!Number.isInteger(length) || length <= 16)
        throw new Error("API key entry " + (entryIndex + 1).toString() + " TOTP length must be greater than 16.");

    const hashAlgorithm = normalizeTOTPHashAlgorithm(value.hashAlgorithm);
    const alphabet      = normalizeTOTPAlphabet(value.alphabet);

    return {
        sharedSecrect,
        validityTime,
        length,
        hashAlgorithm,
        alphabet
    };

}

function parseApiKeyEntries(rawEntries) {

    if (!Array.isArray(rawEntries))
        throw new Error("API key file must contain a JSON array.");

    return rawEntries.map((rawEntry, index) => parseApiKeyEntry(rawEntry, index));

}

function parseApiKeyEntry(rawEntry, index = 0) {

    if (rawEntry == null || typeof rawEntry !== "object" || Array.isArray(rawEntry))
        throw new Error("API key entry " + (index + 1).toString() + " must be a JSON object.");

    if (Object.prototype.hasOwnProperty.call(rawEntry, "apiKey"))
        throw new Error("API key entry " + (index + 1).toString() + " must use token, not apiKey.");

    const token = rawEntry.token;

    if (typeof token !== "string" || token.trim() === "")
        throw new Error("API key entry " + (index + 1).toString() + " must contain a non-empty token.");

    const notBefore = parseOptionalIsoTimestamp(rawEntry.notBefore, "notBefore");
    const notAfter  = parseOptionalIsoTimestamp(rawEntry.notAfter,  "notAfter");

    if (notBefore != null && notAfter != null && notAfter.getTime() < notBefore.getTime())
        throw new Error("API key entry " + (index + 1).toString() + " has notAfter before notBefore.");

    return {
        token,
        totp: parseTOTPApiKeyConfiguration(rawEntry.totp, index),
        roles: parseApiKeyRoles(rawEntry),
        notBefore,
        notAfter
    };

}

function loadApiKeysFromFile(fileName) {

    const fileContent = fs.readFileSync(fileName, "utf8");
    return parseApiKeyEntries(JSON.parse(fileContent));

}

function serializeApiKeyEntry(entry) {

    const serializedEntry = {
        token: entry.token
    };

    if (entry.totp != null)
        serializedEntry.totp = {
            sharedSecrect: entry.totp.sharedSecrect,
            validityTime:  entry.totp.validityTime,
            length:        entry.totp.length,
            hashAlgorithm: entry.totp.hashAlgorithm,
            alphabet:      entry.totp.alphabet
        };

    if (Array.isArray(entry.roles))
        serializedEntry.roles = [ ...entry.roles ];

    if (entry.notBefore instanceof Date)
        serializedEntry.notBefore = entry.notBefore.toISOString();

    if (entry.notAfter instanceof Date)
        serializedEntry.notAfter = entry.notAfter.toISOString();

    return serializedEntry;

}

function serializeApiKeyEntries(apiKeyEntries) {
    return apiKeyEntries.map(serializeApiKeyEntry);
}

function saveApiKeysToFile(fileName, apiKeyEntries) {

    if (typeof fileName !== "string" || fileName.trim() === "")
        return;

    const temporaryFileName = fileName + ".tmp-" + process.pid.toString() + "-" + Date.now().toString();
    const fileContent       = JSON.stringify(serializeApiKeyEntries(apiKeyEntries), null, 2) + "\n";

    fs.writeFileSync(temporaryFileName, fileContent, "utf8");
    fs.renameSync(temporaryFileName, fileName);

}

function normalizeHeaderValue(headerValue) {

    if (Array.isArray(headerValue))
        return headerValue.length > 0 ? String(headerValue[0]).trim() : "";

    return typeof headerValue === "string"
               ? headerValue.trim()
               : "";

}

function parseAuthorizationHeader(headerValue) {

    const authorization = normalizeHeaderValue(headerValue);

    if (authorization === "")
        return { ok: false, reason: "missing" };

    const parts  = authorization.split(/\s+/u);
    const scheme = parts[0]?.toLowerCase();

    if (scheme === "bearer")
    {
        if (parts.length !== 2 || parts[1] === "")
            return { ok: false, reason: "malformed" };

        return {
            ok:     true,
            scheme: "bearer",
            secret: parts[1]
        };
    }

    if (scheme === "totp")
    {
        if (parts.length !== 3 || parts[1] === "" || parts[2] === "")
            return { ok: false, reason: "malformed" };

        return {
            ok:     true,
            scheme: "totp",
            token:  parts[1],
            totp:   parts[2]
        };
    }

    return { ok: false, reason: "malformed" };

}

function dateToMilliseconds(value) {

    if (value instanceof Date)
        return value.getTime();

    return new Date(value).getTime();

}

function generateTOTPApiKeyValue(totpConfiguration, now = new Date(), slotOffset = 0) {

    const nowMs = dateToMilliseconds(now);

    if (Number.isNaN(nowMs))
        throw new Error("Invalid TOTP timestamp.");

    const validityTime = totpConfiguration.validityTime ?? defaultTOTPValidityTime;
    const slotMs       = validityTime * 1000;
    const timestamp    = nowMs + slotOffset * slotMs;

    if (timestamp < 0)
        throw new Error("Invalid TOTP timestamp.");

    return getTOTPGenerator()({
        sharedSecret: totpConfiguration.sharedSecrect,
        validityTime,
        totpLength:   totpConfiguration.length ?? defaultTOTPLength,
        alphabet:     normalizeTOTPAlphabet(totpConfiguration.alphabet),
        timestamp,
        hashAlgorithm: normalizeTOTPHashAlgorithm(totpConfiguration.hashAlgorithm)
    }).current;

}

function constantTimeEquals(left, right) {

    if (typeof left !== "string" || typeof right !== "string")
        return false;

    const leftBuffer  = Buffer.from(left,  "utf8");
    const rightBuffer = Buffer.from(right, "utf8");

    if (leftBuffer.length !== rightBuffer.length)
        return false;

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);

}

function isTOTPApiKeyValue(headerToken, totpConfiguration, now) {

    return [ -1, 0, 1 ].some(slotOffset => {

        try
        {
            return constantTimeEquals(
                headerToken,
                generateTOTPApiKeyValue(totpConfiguration, now, slotOffset)
            );
        }
        catch
        {
            return false;
        }

    });

}

function findApiKeyEntriesByAuthorization(headerValue, apiKeyEntries, now = new Date()) {

    const authorization = parseAuthorizationHeader(headerValue);

    if (authorization.ok !== true || !Array.isArray(apiKeyEntries))
        return [];

    const nowMs = dateToMilliseconds(now);

    if (Number.isNaN(nowMs))
        return [];

    return apiKeyEntries.filter(candidate => {

        if (authorization.scheme === "bearer")
            return candidate.totp == null &&
                   constantTimeEquals(candidate.token, authorization.secret);

        if (authorization.scheme === "totp")
            return candidate.totp != null &&
                   candidate.token === authorization.token &&
                   isTOTPApiKeyValue(authorization.totp, candidate.totp, now);

        return false;

    });

}

function isApiKeyEntryActiveAt(entry, nowMs) {

    if (entry.notBefore != null && nowMs < entry.notBefore.getTime())
        return false;

    if (entry.notAfter != null && nowMs > entry.notAfter.getTime())
        return false;

    return true;

}

function authenticateAuthorizationHeader(headerValue, apiKeyEntries, now = new Date()) {

    const authorization = parseAuthorizationHeader(headerValue);

    if (authorization.ok !== true)
        return { ok: false, reason: authorization.reason };

    if (!Array.isArray(apiKeyEntries) || apiKeyEntries.length === 0)
        return { ok: false, reason: "unknown" };

    const nowMs = now instanceof Date
                      ? now.getTime()
                      : new Date(now).getTime();

    if (Number.isNaN(nowMs))
        return { ok: false, reason: "invalid-now" };

    const matchingEntries = findApiKeyEntriesByAuthorization(headerValue, apiKeyEntries, now);

    if (matchingEntries.length === 0)
        return { ok: false, reason: "unknown" };

    const activeEntry = matchingEntries.find(entry => isApiKeyEntryActiveAt(entry, nowMs));

    if (activeEntry == null)
    {
        const hasNotYetValidEntry = matchingEntries.some(entry => entry.notBefore != null && nowMs < entry.notBefore.getTime());
        const hasExpiredEntry     = matchingEntries.some(entry => entry.notAfter  != null && nowMs > entry.notAfter.getTime());

        return {
            ok:     false,
            reason: hasNotYetValidEntry && !hasExpiredEntry
                        ? "not-before"
                        : "not-after"
        };
    }

    return {
        ok: true,
        credential: {
            token: activeEntry.token,
            roles:  activeEntry.roles
        }
    };

}

function createApiKeyAuthenticator(apiKeyEntries, nowProvider = () => new Date()) {

    if (!Array.isArray(apiKeyEntries))
        return null;

    return headerValue => authenticateAuthorizationHeader(headerValue, apiKeyEntries, nowProvider());

}

function canonicalizeApiKeyEntry(entry) {

    return {
        token:     entry.token,
        totp:      entry.totp != null
                       ? {
                             sharedSecrect:  entry.totp.sharedSecrect,
                             validityTime:   entry.totp.validityTime,
                             length:         entry.totp.length,
                             hashAlgorithm:  entry.totp.hashAlgorithm,
                             alphabet:       entry.totp.alphabet
                         }
                       : undefined,
        roles:     Array.isArray(entry.roles) ? [ ...entry.roles ].sort() : [],
        notBefore: entry.notBefore instanceof Date ? entry.notBefore.toISOString() : undefined,
        notAfter:  entry.notAfter  instanceof Date ? entry.notAfter. toISOString() : undefined
    };

}

function apiKeyEntriesEqual(left, right) {
    return JSON.stringify(canonicalizeApiKeyEntry(left)) ===
           JSON.stringify(canonicalizeApiKeyEntry(right));
}

function hasApiKeyEntry(apiKeyEntries, candidate) {
    return Array.isArray(apiKeyEntries) &&
           apiKeyEntries.some(entry => apiKeyEntriesEqual(entry, candidate));
}

module.exports = {
    ApiKeyRole,
    authenticateAuthorizationHeader,
    apiKeyEntriesEqual,
    createApiKeyAuthenticator,
    findApiKeyEntriesByAuthorization,
    generateTOTPApiKeyValue,
    hasApiKeyEntry,
    initializeTOTPGenerator,
    loadApiKeysFromFile,
    parseAuthorizationHeader,
    parseApiKeyEntry,
    parseApiKeyEntries,
    parseApiKeyRole,
    parseApiKeyRoles,
    parseTOTPApiKeyConfiguration,
    saveApiKeysToFile,
    serializeApiKeyEntries,
    serializeApiKeyEntry
};
