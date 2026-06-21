import { describe, expect, test } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport } from './testHelper';
import { Chargy, SAFEXML } from '@open-charging-cloud/chargy-core';
import { createTestChargy, parseTestXML } from './chargyTestRuntime';

describe('SAFE Tests', () => {

    test("SAFE value without signedData should fail", async () => {

        const xmlDocument = parseTestXML(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <value transactionId="begin" context="Transaction.Begin">
        <publicKey encoding="plain">abc</publicKey>
    </value>
</values>`);

        const result = await new SAFEXML(createTestChargy(Chargy)).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            status:  "InvalidSessionFormat",
            message: {
                en: "Each value within the given XML container must contain signed data!"
            }
        });

    });


    test("SAFE Testdata 01", async () => {
        await expectVerificationReport(
            "SAFE/SAFE-Testdata-01_OCMFv0.1.xml",
            "SAFE/SAFE-Testdata-01_OCMFv0.1.expected.txt"
        );
    });


    test("SAFE Testdata 02 empty XML namespace", async () => {
        await expectVerificationReport(
            "SAFE/SAFE-Testdata-02_emptyXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 without XML namespace", async () => {
        await expectVerificationReport(
            "SAFE/SAFE-Testdata-02_withoutXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 with XML namespace", async () => {
        await expectVerificationReport(
            "SAFE/SAFE-Testdata-02_withXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 with XML namespace via PDF/A-3", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_withXMLNamespace.pdf",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });


    test("SAFE Testdata 03 single measurement - should fail", async () => {
        await expectVerificationReport(
            "SAFE/SAFE-Testdata-03_singleMeasurement_ShouldFail.xml",
            "SAFE/SAFE-Testdata-03.expected.txt"
        );
    });


    test("SAFE Testdata 04", async () => {
        await expectVerificationReport(
            "SAFE/SAFE-Testdata-04.xml",
            "SAFE/SAFE-Testdata-04.expected.txt"
        );
    });

});
