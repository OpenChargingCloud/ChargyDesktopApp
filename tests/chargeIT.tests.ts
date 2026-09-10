import { describe, test } from 'vitest';
import { expectVerificationReport, expectVerificationReportInline, expectArchiveVerificationReport } from './testHelper';


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
            "chargeIT/bsm/bsm-ws36a-good.json",
            "chargeIT/bsm/bsm-ws36a-good.expected.txt"
        );
    });

    test("ocmf", async () => {
        await expectVerificationReport(
            "chargeIT/bsm/ocmf.xml",
            "chargeIT/bsm/ocmf.expected.txt"
        );
    });

    // The real BSM document in ocmf.xml carries no Identification Flags, so this
    // one supplies the IF branch. Generated and signed by generate_ocmf_withIF.mjs,
    // because IF sits inside the signed payload and cannot be added by hand.
    test("ocmf_withIF", async () => {
        await expectVerificationReport(
            "chargeIT/bsm/ocmf_withIF.xml",
            "chargeIT/bsm/ocmf_withIF.expected.txt"
        );
    });

    // The verification report does not list the identification flags, so passing
    // the two tests above would not actually show that IF was read. Asserted
    // directly instead: flags that are present have to reach the record, and an
    // absent IF has to become the empty array the OCMF specification asks for.
    test("ocmf_withIF carries the identification flags into the record", async () => {
        await expectVerificationReportInline(
            "chargeIT/bsm/ocmf_withIF.xml",
            {
                chargingSessions: [{
                    authorizationStart: {
                        identificationFlags: [ "RFID_PLAIN", "OCPP_AUTH" ]
                    }
                }]
            }
        );
    });

    test("ocmf without identification flags yields an empty list", async () => {
        await expectVerificationReportInline(
            "chargeIT/bsm/ocmf.xml",
            {
                chargingSessions: [{
                    authorizationStart: {
                        identificationFlags: []
                    }
                }]
            }
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
