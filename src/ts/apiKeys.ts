export enum ApiKeyRole {
    EVDriver = "evDriver",
    Root     = "root"
}

export type TOTPHashAlgorithm = "sha256" | "sha384" | "sha512";

export interface RawApiKeyEntry {
    token:      string;
    totp?:      IRawTOTPApiKeyConfiguration;
    roles?:     ApiKeyRole[];
    notBefore?: string;
    notAfter?:  string;
}

export interface ParsedApiKeyEntry {
    token:      string;
    totp?:      ITOTPApiKeyConfiguration;
    roles:      ApiKeyRole[];
    notBefore?: Date;
    notAfter?:  Date;
}

export interface IRawTOTPApiKeyConfiguration {
    sharedSecrect:  string;
    validityTime?:  number;
    length?:        number;
    hashAlgorithm?: TOTPHashAlgorithm;
    alphabet?:      string;
}

export interface ITOTPApiKeyConfiguration {
    sharedSecrect:  string;
    validityTime:   number;
    length:         number;
    hashAlgorithm?: TOTPHashAlgorithm;
    alphabet?:      string;
}

export interface ApiKeyCredential {
    token: string;
    roles: ApiKeyRole[];
}

export type ApiKeyAuthenticationFailureReason =
    "missing" |
    "malformed" |
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

function hasRejectedLegacyFields(value: Record<string, unknown>): boolean {
    return Object.prototype.hasOwnProperty.call(value, "apiKey") ||
           Object.prototype.hasOwnProperty.call(value, "role");
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

function hasNoWhitespace(value: string): boolean {
    return !/\s/u.test(value);
}

function hasUniqueCharacters(value: string): boolean {
    return new Set(value).size === value.length;
}

function isSupportedTOTPHashAlgorithm(value: unknown): value is string {

    if (value == null)
        return true;

    if (typeof value !== "string" || value.trim() === "")
        return false;

    const normalized = value.trim();

    return normalized === "sha256" ||
           normalized === "sha384" ||
           normalized === "sha512";

}

function isTOTPAlphabet(value: unknown): value is string {

    if (value == null)
        return true;

    return typeof value === "string" &&
           value.trim().length >= 4 &&
           hasNoWhitespace(value.trim()) &&
           hasUniqueCharacters(value.trim());

}

function hasRejectedLegacyTOTPFields(value: Record<string, unknown>): boolean {
    return Object.prototype.hasOwnProperty.call(value, "encoding");
}

function isRawTOTPApiKeyConfiguration(value: unknown): value is IRawTOTPApiKeyConfiguration {

    if (!isPlainObject(value) || hasRejectedLegacyTOTPFields(value))
        return false;

    const sharedSecrect = value["sharedSecrect"];
    const validityTime  = value["validityTime"];
    const length        = value["length"];

    return isNonEmptyString(sharedSecrect) &&
           sharedSecrect.trim().length >= 16 &&
           hasNoWhitespace(sharedSecrect.trim()) &&
           (validityTime == null || (typeof validityTime === "number" && Number.isInteger(validityTime) && validityTime > 0)) &&
           (length       == null || (typeof length       === "number" && Number.isInteger(length)       && length > 16)) &&
           isSupportedTOTPHashAlgorithm(value["hashAlgorithm"]) &&
           isTOTPAlphabet(value["alphabet"]);

}

function isParsedTOTPApiKeyConfiguration(value: unknown): value is ITOTPApiKeyConfiguration {

    if (!isPlainObject(value) || hasRejectedLegacyTOTPFields(value))
        return false;

    const sharedSecrect = value["sharedSecrect"];
    const validityTime  = value["validityTime"];
    const length        = value["length"];

    return isNonEmptyString(sharedSecrect) &&
           sharedSecrect.trim().length >= 16 &&
           hasNoWhitespace(sharedSecrect.trim()) &&
           typeof validityTime === "number" &&
           Number.isInteger(validityTime) &&
           validityTime > 0 &&
           typeof length === "number" &&
           Number.isInteger(length) &&
           length > 16 &&
           isSupportedTOTPHashAlgorithm(value["hashAlgorithm"]) &&
           isTOTPAlphabet(value["alphabet"]);

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

    if (!isPlainObject(value) || hasRejectedLegacyFields(value))
        return false;

    const notBefore = value["notBefore"];
    const notAfter  = value["notAfter"];
    const timestampWindowNotBefore = typeof notBefore === "string" ? notBefore : undefined;
    const timestampWindowNotAfter  = typeof notAfter  === "string" ? notAfter  : undefined;

    return isNonEmptyString(value["token"]) &&
           (value["totp"] == null || isRawTOTPApiKeyConfiguration(value["totp"])) &&
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

    if (!isPlainObject(value) || hasRejectedLegacyFields(value))
        return false;

    const notBefore = value["notBefore"];
    const notAfter  = value["notAfter"];
    const timestampWindowNotBefore = notBefore instanceof Date ? notBefore : undefined;
    const timestampWindowNotAfter  = notAfter  instanceof Date ? notAfter  : undefined;

    return isNonEmptyString(value["token"]) &&
           (value["totp"] == null || isParsedTOTPApiKeyConfiguration(value["totp"])) &&
           isParsedApiKeyRoles(value["roles"]) &&
           (notBefore == null || (notBefore instanceof Date && !Number.isNaN(notBefore.getTime()))) &&
           (notAfter  == null || (notAfter  instanceof Date && !Number.isNaN(notAfter.getTime()))) &&
           hasValidTimestampWindow(timestampWindowNotBefore, timestampWindowNotAfter);

}

export function isParsedApiKeyEntryArray(value: unknown): value is ParsedApiKeyEntry[] {
    return Array.isArray(value) &&
           value.every(isParsedApiKeyEntry);
}
