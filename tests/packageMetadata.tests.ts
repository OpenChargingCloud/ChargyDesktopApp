import { describe, expect, test } from "vitest";
import { parsePackageMetadata } from "../src/ts/packageMetadata";

describe("fetched package metadata", () => {
    test("retains versions needed by the about screen", () => {
        expect(parsePackageMetadata({
            version: "1.4.7",
            dependencies: { moment: "^2.30.1" },
            devDependencies: { typescript: "~5.9.3" }
        })).toEqual({
            version: "1.4.7",
            dependencies: { moment: "^2.30.1" },
            devDependencies: { typescript: "~5.9.3" }
        });
    });

    test("malformed or missing versions cannot crash string formatting", () => {
        expect(parsePackageMetadata({
            version: { value: "1.4.7" },
            dependencies: { moment: "^2.30.1", elliptic: null, leaflet: 42 },
            devDependencies: null
        })).toEqual({ dependencies: { moment: "^2.30.1" } });
        expect(parsePackageMetadata({})).toEqual({});
    });

    test.each([null, [], "not a package", 42])("rejects a non-object response: %j", value => {
        expect(() => parsePackageMetadata(value)).toThrow("Invalid package metadata");
    });
});
