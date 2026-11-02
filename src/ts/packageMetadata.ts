export interface PackageMetadata {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

function stringEntries(value: unknown): Record<string, string> | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;

    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
    ));
}

/** Only the string fields used by the about screen are accepted from fetched JSON. */
export function parsePackageMetadata(value: unknown): PackageMetadata {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid package metadata");

    const object = value as Record<string, unknown>;
    const metadata: PackageMetadata = {};
    if (typeof object["version"] === "string")
        metadata.version = object["version"];

    const dependencies = stringEntries(object["dependencies"]);
    if (dependencies !== undefined)
        metadata.dependencies = dependencies;

    const devDependencies = stringEntries(object["devDependencies"]);
    if (devDependencies !== undefined)
        metadata.devDependencies = devDependencies;

    return metadata;
}
