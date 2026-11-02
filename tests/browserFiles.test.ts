import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
    browserFileNameFromNameAndType,
    browserFileTypeFromName,
    browserFileTypeFromNameOrData,
    normalizeDroppedSVGImageData
} from "../src/ts/browserFiles";

describe("browser file helpers", () => {

    test("uses the file extension when a dropped SVG has no browser MIME type", () => {

        expect(browserFileTypeFromName("ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg", "")).toBe("image/svg+xml");

    });

    test("detects SVG content when a dropped SVG has no browser MIME type", () => {

        const svgData = readFileSync(
            new URL("fixtures/ChargeTransparencyLive/ChargeTransparencyLiveLink_2.svg", import.meta.url)
        );

        expect(
            browserFileTypeFromNameOrData(
                "unknown",
                "",
                new Uint8Array(svgData).buffer
            )
        ).toBe("image/svg+xml");

    });

    test("adds an SVG file extension when SVG content was detected without a useful name", () => {

        expect(browserFileNameFromNameAndType("unknown", "image/svg+xml")).toBe("unknown.svg");
        expect(browserFileNameFromNameAndType("ChargeTransparencyLiveLink_2.svg", "image/svg+xml")).toBe("ChargeTransparencyLiveLink_2.svg");

    });

    test("adds explicit SVG dimensions from the viewBox for browser QR decoding", () => {

        const svgData = readFileSync(
            new URL("fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg", import.meta.url)
        );

        const normalizedData = normalizeDroppedSVGImageData(
            "ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg",
            "",
            new Uint8Array(svgData).buffer
        );

        const normalizedSVG = new TextDecoder().decode(normalizedData);

        expect(normalizedSVG).toContain("width=\"101\"");
        expect(normalizedSVG).toContain("height=\"101\"");

        // This one draws its QR code as paths, and every path that does not
        // already say so is told to render crisply.
        expect(normalizedSVG).toContain("<path shape-rendering=\"crispEdges\"");

    });

    test("adds crisp SVG shape rendering for browser QR decoding", () => {

        const svgData = readFileSync(
            new URL("fixtures/ChargeTransparencyLive/ChargeTransparencyLiveLink_2.svg", import.meta.url)
        );

        const normalizedData = normalizeDroppedSVGImageData(
            "ChargeTransparencyLiveLink_2.svg",
            "",
            new Uint8Array(svgData).buffer
        );

        const normalizedSVG = new TextDecoder().decode(normalizedData);

        // This one draws its QR code as rects and already says "crispEdges" on
        // each of them; what it leaves to the reader is the <svg> tag itself
        // and the background rect.
        expect(normalizedSVG).toContain("shape-rendering=\"crispEdges\"");
        expect(normalizedSVG).toContain("<rect shape-rendering=\"crispEdges\"");
        expect(normalizedSVG).toContain("image-rendering: pixelated");

    });

});
