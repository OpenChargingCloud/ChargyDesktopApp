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

    const rawRoles = rawEntry.roles != null
                         ? rawEntry.roles
                         : rawEntry.role;

    if (rawRoles == null)
        return [ ApiKeyRole.EVDriver ];

    const roleValues = Array.isArray(rawRoles)
                           ? rawRoles
                           : [ rawRoles ];

    if (roleValues.length === 0)
        throw new Error("API key roles must not be empty.");

    const parsedRoles = [];

    for (const roleValue of roleValues)
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

function parseApiKeyEntries(rawEntries) {

    if (!Array.isArray(rawEntries))
        throw new Error("API key file must contain a JSON array.");

    const seenApiKeys = new Set();

    return rawEntries.map((rawEntry, index) => {

        if (rawEntry == null || typeof rawEntry !== "object" || Array.isArray(rawEntry))
            throw new Error("API key entry " + (index + 1).toString() + " must be a JSON object.");

        const apiKey = rawEntry.apiKey;

        if (typeof apiKey !== "string" || apiKey.trim() === "")
            throw new Error("API key entry " + (index + 1).toString() + " must contain a non-empty apiKey.");

        if (seenApiKeys.has(apiKey))
            throw new Error("Duplicate API key entry.");

        seenApiKeys.add(apiKey);

        const notBefore = parseIsoTimestamp(rawEntry.notBefore, "notBefore");
        const notAfter  = parseIsoTimestamp(rawEntry.notAfter,  "notAfter");

        if (notAfter.getTime() < notBefore.getTime())
            throw new Error("API key entry " + (index + 1).toString() + " has notAfter before notBefore.");

        return {
            apiKey,
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

function authenticateApiKeyHeader(headerValue, apiKeyEntries, now = new Date()) {

    const apiKey = normalizeApiKeyHeader(headerValue);

    if (apiKey === "")
        return { ok: false, reason: "missing" };

    if (!Array.isArray(apiKeyEntries) || apiKeyEntries.length === 0)
        return { ok: false, reason: "unknown" };

    const entry = apiKeyEntries.find(candidate => candidate.apiKey === apiKey);

    if (entry == null)
        return { ok: false, reason: "unknown" };

    const nowMs = now instanceof Date
                      ? now.getTime()
                      : new Date(now).getTime();

    if (Number.isNaN(nowMs))
        return { ok: false, reason: "invalid-now" };

    if (nowMs < entry.notBefore.getTime())
        return { ok: false, reason: "not-before" };

    if (nowMs > entry.notAfter.getTime())
        return { ok: false, reason: "not-after" };

    return {
        ok: true,
        credential: {
            apiKey: entry.apiKey,
            roles:  entry.roles
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
    loadApiKeysFromFile,
    parseApiKeyEntries,
    parseApiKeyRole,
    parseApiKeyRoles
};
