import { describe, expect, test, vi } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport } from './testHelper';


describe('SAFE Tests', () => {

    test("SAFE Testdata 01", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-01_OCMFv0.1.xml",
            "SAFE/SAFE-Testdata-01_OCMFv0.1.expected.txt"
        );
    });


    test("SAFE Testdata 02 empty XML namespace", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_emptyXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 without XML namespace", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_withoutXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 with XML namespace", async () => {
        await expectArchiveVerificationReport(
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
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-03_singleMeasurement_ShouldFail.xml",
            "SAFE/SAFE-Testdata-03.expected.txt"
        );
    });


    test("SAFE Testdata 04", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-04.xml",
            "SAFE/SAFE-Testdata-04.expected.txt"
        );
    });

});
