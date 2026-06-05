import { createRequire } from "node:module";
import { describe, expect, test, vi } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport, expectVerificationReportInline } from './testHelper';
import { Chargy } from '../src/ts/chargy';
import { SAFEXML } from '../src/ts/SAFE_XML';

const require = createRequire(import.meta.url);
const { DOMParser } = require("@oozcitak/dom");

function createChargy(): Chargy {

    return new Chargy(
        {},
        "en",
        require("elliptic"),
        require("moment"),
        require("asn1.js"),
        require("base32-decode"),
        () => ""
    );

}

describe('SAFE Tests', () => {

    test("SAFE value without signedData should fail", async () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <value transactionId="begin" context="Transaction.Begin">
        <publicKey encoding="plain">abc</publicKey>
    </value>
</values>`, "text/xml");

        const result = await new SAFEXML(createChargy()).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            status:  "InvalidSessionFormat",
            message: "Each value within the given XML container must contain signed data!"
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
