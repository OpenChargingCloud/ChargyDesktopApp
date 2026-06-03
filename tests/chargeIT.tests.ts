import { describe, expect, test, vi } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport } from './testHelper';


describe('chargeIT Tests', () => {

    test("chargeIT-Testdata-02", async () => {
        await expectVerificationReport(
            "chargeIT/chargeIT-Testdata-02.chargy",
            "chargeIT/chargeIT-Testdata-02.expected.txt"
        );
    });

    test("chargeIT-Testdata-02 in ZIP archive", async () => {
        await expectArchiveVerificationReport(
            "chargeIT/chargeIT-Testdata-02.zip",
            "chargeIT/chargeIT-Testdata-02.expected.txt"
        );
    });

    test("chargeIT-Testdata-02 in TAR archive", async () => {
        await expectArchiveVerificationReport(
            "chargeIT/chargeIT-Testdata-02.tar",
            "chargeIT/chargeIT-Testdata-02.expected.txt"
        );
    });

    test("chargeIT-Testdata-02 in TAR.GZ archive", async () => {
        await expectArchiveVerificationReport(
            "chargeIT/chargeIT-Testdata-02.tar.gz",
            "chargeIT/chargeIT-Testdata-02.expected.txt"
        );
    });

    test("chargeIT-Testdata-02 in TAR.BZ2 archive", async () => {
        await expectArchiveVerificationReport(
            "chargeIT/chargeIT-Testdata-02.tar.bz2",
            "chargeIT/chargeIT-Testdata-02.expected.txt"
        );
    });

});
