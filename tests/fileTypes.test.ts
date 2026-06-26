import { describe, expect, test } from "vitest";
import { getMimeTypeFromFileName } from "../src/ts/fileTypes";


describe("file type helpers", () => {

    test("infers SVG MIME type from dropped file names", () => {
        expect(getMimeTypeFromFileName("ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg")).toBe("image/svg+xml");
        expect(getMimeTypeFromFileName("C:\\tmp\\ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.SVG")).toBe("image/svg+xml");
    });

    test("infers QR image MIME types from dropped file names", () => {
        expect(getMimeTypeFromFileName("qr.png")).toBe("image/png");
        expect(getMimeTypeFromFileName("qr.jpg")).toBe("image/jpeg");
        expect(getMimeTypeFromFileName("qr.jpeg")).toBe("image/jpeg");
        expect(getMimeTypeFromFileName("qr.webp")).toBe("image/webp");
    });

});
