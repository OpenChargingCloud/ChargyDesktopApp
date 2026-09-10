import { describe, expect, test } from "vitest";
import {
    decodeMetrologicalValue,
    encodeMetrologicalValue,
    formatMetrologicalValue,
    jsonToMcbor,
    mcborToJson,
    parseMetrologicalValue
} from "@vanaheimr/metrological-cbor";
import { ChargeTransparencyLiveLinkContext, IsAChargeTransparencyLiveLink } from "@open-charging-cloud/chargy-core";
import type {
    IConnector,
    IChargeTransparencyLiveLink,
    ISignedMeterValues,
    Watt
} from "@open-charging-cloud/chargy-core";

describe("Metrological JSON boundary examples", () => {
    test("recognizes context lists while rejecting malformed context entries", () => {

        // Everything a live link must have, so that the context list is the
        // only thing these three cases differ in.
        const liveLink = {
            created:         "2026-09-06T22:58:14Z",
            liveTransports:  [ { type: "https", urls: [ "https://api1.example.com/live" ] } ]
        };

        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": [ "https://example.org/extension", ChargeTransparencyLiveLinkContext ] })).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": [ 42, ChargeTransparencyLiveLinkContext ] })).toBe(false);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": [ "https://example.org/extension" ] })).toBe(false);

    });

    test("retains resolution and uncertainty through a CBOR reading", () => {
        for (const text of [ "22.00 kW", "(230.00 ±0.12) V, k=2", "150 µΩ" ]) {
            const reading = parseMetrologicalValue(text);
            const bytes   = encodeMetrologicalValue(reading);
            const decoded = decodeMetrologicalValue(bytes);
            expect(encodeMetrologicalValue(decoded)).toEqual(bytes);
            expect(formatMetrologicalValue(decoded)).toBe(formatMetrologicalValue(reading));
        }
        expect(formatMetrologicalValue(parseMetrologicalValue("22.00 kW"))).toBe("22.00 kW");
    });

    test("converts only schema-selected quantity fields", () => {
        const power: Watt = "22.00 kW";
        const connector = { maxPower: power } satisfies IConnector;
        const document = { power: connector.maxPower, note: "1 h" };
        const options = { readings: (_text: string, path: readonly (string | number)[]): boolean =>
            path.length === 1 && path[0] === "power" };
        const bytes = jsonToMcbor(document, options);
        const json  = mcborToJson(bytes);
        expect(json).toEqual(document);
        expect(jsonToMcbor(json, options)).toEqual(bytes);
    });

    test("exposes the meter-value container through the public live-link type", () => {
        const signedMeterValues: ISignedMeterValues = {
            encodings: [ "OCMF", "plain" ],
            values: [ "OCMF|payload|signature" ]
        };
        const link: Pick<IChargeTransparencyLiveLink, "signedMeterValues"> = { signedMeterValues };
        expect(link.signedMeterValues?.values).toEqual(signedMeterValues.values);
    });
});
