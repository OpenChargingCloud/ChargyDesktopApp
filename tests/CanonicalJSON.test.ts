import { describe, expect, test } from "vitest";

import {
    CanonicalJSONError,
    canonicalJSONBytes,
    canonicalJSONStringify
} from "@open-charging-cloud/chargy-core";

describe("CanonicalJSON", () => {

    test("serializes object properties in ordinal order without whitespace", () => {

        expect(canonicalJSONStringify({
            z: 1,
            a: true,
            nested: {
                b: 2,
                a: 1
            }
        })).toBe('{"a":true,"nested":{"a":1,"b":2},"z":1}');

    });

    test("keeps array order and canonicalizes objects inside arrays", () => {

        expect(canonicalJSONStringify([
            { z: 1, a: 2 },
            "text",
            null,
            false
        ])).toBe('[{"a":2,"z":1},"text",null,false]');

    });

    test("uses RFC 8259 JSON string escaping and UTF-8 bytes", () => {

        const json = canonicalJSONStringify({
            quote:   '"',
            newline: "\n",
            umlaut:  "ä"
        });

        expect(json).toBe('{"newline":"\\n","quote":"\\"","umlaut":"ä"}');
        expect(Array.from(canonicalJSONBytes({ a: "ä" }))).toEqual([
            123, 34, 97, 34, 58, 34, 195, 164, 34, 125
        ]);

    });

    test("serializes URLs as regular JSON string values", () => {

        expect(canonicalJSONStringify({
            z:   "https://example.org/z?b=2&a=1#fragment",
            url: "https://open.charging.cloud/contexts/charging-session"
        })).toBe('{"url":"https://open.charging.cloud/contexts/charging-session","z":"https://example.org/z?b=2&a=1#fragment"}');

    });

    test("serializes timestamps as regular JSON string values", () => {

        expect(canonicalJSONStringify({
            validUntil: "2026-12-31T23:59:59Z",
            created:    "2026-06-07T02:30:00.123+02:00",
            values:     [
                {
                    timestamp: "2026-06-07T00:30:00Z",
                    value:     42
                }
            ]
        })).toBe('{"created":"2026-06-07T02:30:00.123+02:00","validUntil":"2026-12-31T23:59:59Z","values":[{"timestamp":"2026-06-07T00:30:00Z","value":42}]}');

    });

    test("rejects values that are not valid JSON values", () => {

        expect(() => canonicalJSONStringify(undefined)).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify(Number.NaN)).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify(Number.POSITIVE_INFINITY)).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify(BigInt(1))).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify({ a: undefined })).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify({ a: () => true })).toThrow(CanonicalJSONError);

    });

    test("rejects sparse arrays and non-index array properties", () => {

        const sparseArray         = [1, , 3];
        const arrayWithProperty   = [1, 2] as Array<number> & { custom?: string };
        arrayWithProperty.custom  = "nope";

        expect(() => canonicalJSONStringify(sparseArray)).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify(arrayWithProperty)).toThrow(CanonicalJSONError);

    });

    test("rejects circular references and unsupported objects", () => {

        const circular: { self?: unknown } = {};
        circular.self = circular;

        expect(() => canonicalJSONStringify(circular)).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify(new Date("2026-01-01T00:00:00Z"))).toThrow(CanonicalJSONError);
        expect(() => canonicalJSONStringify(new Map())).toThrow(CanonicalJSONError);

    });

});
