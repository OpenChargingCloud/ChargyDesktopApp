import { describe, test } from 'vitest';
import { expectArchiveVerificationReport, expectMultiArchiveVerificationReport } from './testHelper';


describe('ChargePoint Tests', () => {

    test("ChargePoint Testdata 2020-02 within BZIP2 container", async () => {
        await expectArchiveVerificationReport(
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload.tar.bz2",
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload.expected.txt"
        );
    });

    test("ChargePoint Testdata 2020-02 within BZIP2 container with public key 1", async () => {
        await expectMultiArchiveVerificationReport(
            [
                "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload.tar.bz2",
                "ChargePoint/Testdata-2020-02/0024b1000002e300_2.pem"
            ],
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload-withPublicKey.expected.txt"
        );
    });

    test("ChargePoint Testdata 2020-02 within BZIP2 container with public key 2", async () => {
        await expectMultiArchiveVerificationReport(
            [
                "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload.tar.bz2",
                "ChargePoint/Testdata-2020-02/0024b1000002e300_2-publicKey.chargy"
            ],
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload-withPublicKey.expected.txt"
        );
    });

    test("ChargePoint Testdata 2020-02 within BZIP2 container with public key 3", async () => {
        await expectMultiArchiveVerificationReport(
            [
                "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload.tar.bz2",
                "ChargePoint/Testdata-2020-02/0024b1000002e300_2-publicKey_minimal.chargy"
            ],
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload-withPublicKey.expected.txt"
        );
    });




    test("ChargePoint Testdata 2020-02 as .chargy file", async () => {
        await expectArchiveVerificationReport(
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2.chargy",
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload-withPublicKey.expected.txt"
        );
    });

    test("ChargePoint Testdata 2020-02 with public key within ZIP container", async () => {
        await expectArchiveVerificationReport(
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_withPublicKey.zip",
            "ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload-withPublicKey.expected.txt"
        );
    });

});
