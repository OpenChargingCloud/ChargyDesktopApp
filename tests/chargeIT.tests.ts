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


describe('chargeIT BSM Tests', () => {

    test("bsm-ws36a-good", async () => {
        await expectVerificationReport(
            "chargeIT/BSM/bsm-ws36a-good.json",
            "chargeIT/BSM/bsm-ws36a-good.expected.txt"
        );
    });

    test("ocmf", async () => {
        await expectVerificationReport(
            "chargeIT/BSM/ocmf.xml",
            "chargeIT/BSM/ocmf.expected.txt"
        );
    });

    test("ocmf_withoutIF", async () => {
        await expectVerificationReport(
            "chargeIT/BSM/ocmf_withoutIF.xml",
            "chargeIT/BSM/ocmf_withoutIF.expected.txt"
        );
    });

});


describe('chargeIT New Container Format Tests', () => {

    test("bsm-ws36a-good-new-style-header", async () => {
        await expectVerificationReport(
            "chargeIT/new_container_format/bsm-ws36a-good-new-style-header.json",
            "chargeIT/new_container_format/bsm-ws36a-good-new-style-header.expected.txt"
        );
    });

    test("bsm-ws36a-good-with-non-zero-scale-factors", async () => {
        await expectVerificationReport(
            "chargeIT/new_container_format/bsm-ws36a-good-with-non-zero-scale-factors.json",
            "chargeIT/new_container_format/bsm-ws36a-good-with-non-zero-scale-factors.expected.txt"
        );
    });

    test("ev-charging-chargy-with-display-format-hints", async () => {
        await expectVerificationReport(
            "chargeIT/new_container_format/ev-charging-chargy-with-display-format-hints.json",
            "chargeIT/new_container_format/ev-charging-chargy-with-display-format-hints.expected.txt"
        );
    });

});
