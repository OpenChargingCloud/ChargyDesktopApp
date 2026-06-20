import { describe, expect, test }                       from 'vitest';
import { expectBinaryVerificationReport,
         expectVerificationReport,
         expectVerificationReportWithValidationRules }  from './testHelper';
import { readFileSync }                                 from "node:fs";
import { readQRCodeTextFromImage }                      from '@open-charging-cloud/chargy-core';
import { normalizeXMLText }                             from '@open-charging-cloud/chargy-core';


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


    // Signed, yet still implausible...
    test("ALFEN Testdata 04 - SAFE XML-Container with 2.1 MWh signed delta", async () => {
        await expectVerificationReport(
            "ALFEN/ALFEN-Testdata-04_2_1MWh_SAFEXMLContainer.xml",
            "ALFEN/ALFEN-Testdata-04_2_1MWh_SAFEXMLContainer.expected.txt"
        );
    });

    test("ALFEN Testdata 04 - SAFE XML-Container with 2.1 MWh signed delta and relaxed validation rules", async () => {
        await expectVerificationReportWithValidationRules(
            "ALFEN/ALFEN-Testdata-04_2_1MWh_SAFEXMLContainer.xml",
            "ALFEN/ALFEN-Testdata-04_2_1MWh_SAFEXMLContainer_relaxedValidationRules.expected.txt",
            "validationRules/validationRules_5MWh.json"
        );
    });

    test("ALFEN Testdata 05 - SAFE XML-Container with 1.9 MWh and 8 intermediate values", async () => {
        await expectVerificationReport(
            "ALFEN/ALFEN-Testdata-05_1_9MWh_8Intermediates_SAFEXMLContainer.xml",
            "ALFEN/ALFEN-Testdata-05_1_9MWh_8Intermediates_SAFEXMLContainer.expected.txt"
        );
    });

});
