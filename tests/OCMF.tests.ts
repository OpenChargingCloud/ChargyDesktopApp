import { describe, test } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport, expectVerificationReportWithPublicKey } from './testHelper';


describe('OCMF Tests', () => {

    test("OCMF Testdata 01", async () => {
        await expectVerificationReportWithPublicKey(
            "OCMF/OCMF-Testdata-01.txt",
            "OCMF/OCMF-Testdata-01_publicKey.txt",
            "OCMF/OCMF-Testdata-01.expected.txt"
        );
    });

    test("OCMF Testdata 01 zipped", async () => {
        await expectArchiveVerificationReport(
            "OCMF/OCMF-Testdata-01.zip",
            "OCMF/OCMF-Testdata-01.expected.txt"
        );
    });

    // Two OCMF strings with two readings each!
    test("OCMF DZG Testdata 01", async () => {
        await expectVerificationReport(
            "OCMF/OCMF-DZG-01.txt",
            "OCMF/OCMF-DZG-01.expected.txt"
        );
    });

});
