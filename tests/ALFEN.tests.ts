import { describe, expect, test }                                    from 'vitest';
import { expectVerificationReport, expectBinaryVerificationReport }  from './testHelper';
import { readFileSync }                                              from "node:fs";
import { readQRCodeTextFromImage }                                   from '@open-charging-cloud/chargy-core';
import { normalizeXMLText }                                          from '@open-charging-cloud/chargy-core';


describe('ALFEN Tests', () => {

    test("ALFEN Testdata 03 - SAFE XML-Container", async () => {
        await expectVerificationReport(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer.xml",
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer.expected.txt"
        );
    });

    test("ALFEN Testdata 03 - SAFE XML-Container as QR Code PNG", async () => {
        await expectBinaryVerificationReport(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png",
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.expected.txt"
        );
    });

    test("ALFEN Testdata 03 - SAFE XML-Container as QR Code JPEG", async () => {
        await expectBinaryVerificationReport(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.jpg",
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.expected.txt"
        );
    });

    test("ALFEN Testdata 03 - SAFE XML-Container as QR Code SVG", async () => {
        await expectBinaryVerificationReport(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg",
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.expected.txt"
        );
    });


    // with Chargy Extensions...
    test("ALFEN Testdata 03 - SAFE XML-Container with Extensions", async () => {
        await expectVerificationReport(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_withExtensions.xml",
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_withExtensions.expected.txt"
        );
    });



    // Low-level tests for QR code reading...
    test("ALFEN Testdata 03 - QR Code PNG can be decoded", async () => {

        const qrCodeImage  = new Uint8Array(
            readFileSync(new URL("fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png", import.meta.url))
        );

        const expectedXML  = readFileSync(
            new URL("fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer.xml", import.meta.url),
            "utf8"
        );

        const qrText       = await readQRCodeTextFromImage(qrCodeImage, "image/png");

        expect(normalizeXMLText(qrText)).toBe(normalizeXMLText(expectedXML));

    });

});
