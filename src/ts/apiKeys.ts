export enum ApiKeyRole {
    EVDriver = "evDriver",
    Root     = "root"
}

export interface RawApiKeyEntry {
    token:      string;
    roles?:     ApiKeyRole[];
    notBefore?: string;
    notAfter?:  string;
}

export interface ParsedApiKeyEntry {
    token:      string;
    roles:      ApiKeyRole[];
    notBefore?: Date;
    notAfter?:  Date;
}

export interface ApiKeyCredential {
    token: string;
    roles: ApiKeyRole[];
}

export type ApiKeyAuthenticationFailureReason =
    "missing" |
    "unknown" |
    "invalid-now" |
    "not-before" |
    "not-after";

export type ApiKeyAuthenticationResult =
    | {
          ok:          true;
          credential:  ApiKeyCredential;
      }
    | {
          ok:      false;
          reason:  ApiKeyAuthenticationFailureReason;
      };

export function isApiKeyRole(value: unknown): value is ApiKeyRole {
    return value === ApiKeyRole.EVDriver ||
           value === ApiKeyRole.Root;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value != null &&
           typeof value === "object" &&
           !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" &&
           value.trim() !== "";
}

function isValidIsoTimestamp(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value))
        return false;

    return !Number.isNaN(new Date(value).getTime());
}

function hasValidTimestampWindow(notBefore: string | Date | undefined, notAfter: string | Date | undefined): boolean {
    if (notBefore == null || notAfter == null)
        return true;

    return new Date(notAfter).getTime() >= new Date(notBefore).getTime();
}

function isRawApiKeyRoles(value: unknown): value is ApiKeyRole[] {
    return value == null ||
           (Array.isArray(value) &&
            value.length > 0 &&
            value.every(isApiKeyRole));
}

function isParsedApiKeyRoles(value: unknown): value is ApiKeyRole[] {
    return Array.isArray(value) &&
           value.length > 0 &&
           value.every(isApiKeyRole);
}

export function isRawApiKeyEntry(value: unknown): value is RawApiKeyEntry {

    if (!isPlainObject(value))
        return false;

    const notBefore = value["notBefore"];
    const notAfter  = value["notAfter"];
    const timestampWindowNotBefore = typeof notBefore === "string" ? notBefore : undefined;
    const timestampWindowNotAfter  = typeof notAfter  === "string" ? notAfter  : undefined;

    return isNonEmptyString(value["token"]) &&
           isRawApiKeyRoles(value["roles"]) &&
           (notBefore == null || (typeof notBefore === "string" && isValidIsoTimestamp(notBefore))) &&
           (notAfter  == null || (typeof notAfter  === "string" && isValidIsoTimestamp(notAfter))) &&
           hasValidTimestampWindow(timestampWindowNotBefore, timestampWindowNotAfter);

}

export function isRawApiKeyEntryArray(value: unknown): value is RawApiKeyEntry[] {
    return Array.isArray(value) &&
           value.every(isRawApiKeyEntry);
}

export function isParsedApiKeyEntry(value: unknown): value is ParsedApiKeyEntry {

    if (!isPlainObject(value))
        return false;

    const notBefore = value["notBefore"];
    const notAfter  = value["notAfter"];
    const timestampWindowNotBefore = notBefore instanceof Date ? notBefore : undefined;
    const timestampWindowNotAfter  = notAfter  instanceof Date ? notAfter  : undefined;

    return isNonEmptyString(value["token"]) &&
           isParsedApiKeyRoles(value["roles"]) &&
           (notBefore == null || (notBefore instanceof Date && !Number.isNaN(notBefore.getTime()))) &&
           (notAfter  == null || (notAfter  instanceof Date && !Number.isNaN(notAfter.getTime()))) &&
           hasValidTimestampWindow(timestampWindowNotBefore, timestampWindowNotAfter);

}

export function isParsedApiKeyEntryArray(value: unknown): value is ParsedApiKeyEntry[] {
    return Array.isArray(value) &&
           value.every(isParsedApiKeyEntry);
}
