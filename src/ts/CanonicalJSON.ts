/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export class CanonicalJSONError extends TypeError {

    public constructor(message: string) {
        super(message);
        this.name = "CanonicalJSONError";
    }

}

/**
 * Deterministic RFC 8259 JSON serialization for signature input.
 *
 * Objects are emitted with ordinally sorted property names, arrays keep their
 * original order, and no insignificant whitespace is written. This is meant
 * as a stable JSON byte representation; it is intentionally strict about
 * values which are not representable as RFC 8259 JSON.
 */
export function canonicalJSONStringify(value: unknown): string {
    return serializeJSONValue(value, "$", new WeakSet());
}

export function canonicalJSONBytes(value: unknown): Uint8Array {
    return new TextEncoder().encode(canonicalJSONStringify(value));
}

function serializeJSONValue(value: unknown,
                            path:  string,
                            seen:  WeakSet<object>): string {

    switch (typeof value)
    {

        case "string":
            return JSON.stringify(value);

        case "number":
            if (!Number.isFinite(value))
                throw new CanonicalJSONError(`Non-finite number at ${path} is not valid JSON.`);

            return JSON.stringify(value);

        case "boolean":
            return value ? "true" : "false";

        case "object":
            if (value === null)
                return "null";

            return Array.isArray(value)
                       ? serializeJSONArray(value, path, seen)
                       : serializeJSONObject(value, path, seen);

        case "bigint":
            throw new CanonicalJSONError(`BigInt at ${path} is not valid JSON.`);

        case "undefined":
            throw new CanonicalJSONError(`Undefined value at ${path} is not valid JSON.`);

        case "function":
            throw new CanonicalJSONError(`Function at ${path} is not valid JSON.`);

        case "symbol":
            throw new CanonicalJSONError(`Symbol at ${path} is not valid JSON.`);

    }

}

function serializeJSONArray(value: unknown[],
                            path:  string,
                            seen:  WeakSet<object>): string {

    if (seen.has(value))
        throw new CanonicalJSONError(`Circular reference at ${path} is not valid JSON.`);

    seen.add(value);

    const indexedKeys = new Set<string>();

    for (let i = 0; i < value.length; i++)
    {
        if (!Object.prototype.hasOwnProperty.call(value, i))
            throw new CanonicalJSONError(`Sparse array slot at ${path}[${i}] is not valid JSON.`);

        indexedKeys.add(String(i));
    }

    for (const key of Object.keys(value))
    {
        if (!indexedKeys.has(key))
            throw new CanonicalJSONError(`Non-index array property ${formatPathProperty(key)} at ${path} is not valid JSON.`);
    }

    rejectEnumerableSymbolProperties(value, path);

    const serializedItems = value.map((item, index) =>
        serializeJSONValue(item, `${path}[${index}]`, seen)
    );

    seen.delete(value);

    return `[${serializedItems.join(",")}]`;

}

function serializeJSONObject(value: object,
                             path:  string,
                             seen:  WeakSet<object>): string {

    if (Object.prototype.toString.call(value) !== "[object Object]")
        throw new CanonicalJSONError(`Unsupported object at ${path} is not valid JSON.`);

    if (seen.has(value))
        throw new CanonicalJSONError(`Circular reference at ${path} is not valid JSON.`);

    seen.add(value);
    rejectEnumerableSymbolProperties(value, path);

    const serializedProperties = Object.keys(value)
                                       .sort(compareOrdinal)
                                       .map(key => {
                                           const serializedKey   = JSON.stringify(key);
                                           const serializedValue = serializeJSONValue(
                                               (value as Record<string, unknown>)[key],
                                               `${path}${formatPathProperty(key)}`,
                                               seen
                                           );

                                           return `${serializedKey}:${serializedValue}`;
                                       });

    seen.delete(value);

    return `{${serializedProperties.join(",")}}`;

}

function rejectEnumerableSymbolProperties(value: object,
                                          path:  string): void {

    for (const symbol of Object.getOwnPropertySymbols(value))
    {
        if (Object.prototype.propertyIsEnumerable.call(value, symbol))
            throw new CanonicalJSONError(`Symbol property at ${path} is not valid JSON.`);
    }

}

function compareOrdinal(left:  string,
                        right: string): number {

    return left < right ? -1 : left > right ? 1 : 0;

}

function formatPathProperty(propertyName: string): string {

    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)
               ? `.${propertyName}`
               : `[${JSON.stringify(propertyName)}]`;

}

