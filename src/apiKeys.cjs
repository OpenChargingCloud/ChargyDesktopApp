const fs = require('fs');

const ApiKeyRole = Object.freeze({
    EVDriver: "evDriver",
    Root:     "root"
});

const apiKeyRoles = new Set(Object.values(ApiKeyRole));

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

function parseApiKeyEntries(rawEntries) {

    if (!Array.isArray(rawEntries))
        throw new Error("API key file must contain a JSON array.");

    return rawEntries.map((rawEntry, index) => {

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
            roles: parseApiKeyRoles(rawEntry),
            notBefore,
            notAfter
        };

    });

}

function loadApiKeysFromFile(fileName) {

    const fileContent = fs.readFileSync(fileName, "utf8");
    return parseApiKeyEntries(JSON.parse(fileContent));

}

function normalizeApiKeyHeader(headerValue) {

    if (Array.isArray(headerValue))
        return headerValue.length > 0 ? String(headerValue[0]).trim() : "";

    return typeof headerValue === "string"
               ? headerValue.trim()
               : "";

}

function findApiKeyEntriesByHeader(headerValue, apiKeyEntries) {

    const token = normalizeApiKeyHeader(headerValue);

    if (token === "" || !Array.isArray(apiKeyEntries))
        return [];

    return apiKeyEntries.filter(candidate => candidate.token === token);

}

function isApiKeyEntryActiveAt(entry, nowMs) {

    if (entry.notBefore != null && nowMs < entry.notBefore.getTime())
        return false;

    if (entry.notAfter != null && nowMs > entry.notAfter.getTime())
        return false;

    return true;

}

function authenticateApiKeyHeader(headerValue, apiKeyEntries, now = new Date()) {

    const token = normalizeApiKeyHeader(headerValue);

    if (token === "")
        return { ok: false, reason: "missing" };

    if (!Array.isArray(apiKeyEntries) || apiKeyEntries.length === 0)
        return { ok: false, reason: "unknown" };

    const matchingEntries = findApiKeyEntriesByHeader(headerValue, apiKeyEntries);

    if (matchingEntries.length === 0)
        return { ok: false, reason: "unknown" };

    const nowMs = now instanceof Date
                      ? now.getTime()
                      : new Date(now).getTime();

    if (Number.isNaN(nowMs))
        return { ok: false, reason: "invalid-now" };

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

    return headerValue => authenticateApiKeyHeader(headerValue, apiKeyEntries, nowProvider());

}

module.exports = {
    ApiKeyRole,
    authenticateApiKeyHeader,
    createApiKeyAuthenticator,
    findApiKeyEntriesByHeader,
    loadApiKeysFromFile,
    parseApiKeyEntries,
    parseApiKeyRole,
    parseApiKeyRoles
};
