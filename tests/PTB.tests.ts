import { describe, expect, test, vi } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport } from './testHelper';


describe('PTB Tests', () => {

    test.skip("PTB input", async () => {
        await expectVerificationReport(
            "PTB/ptb-simple.json",
            "PTB/ptb-simple.expected.txt"
        );
    });

    test.skip("PTB input - must fail!", async () => {
        await expectVerificationReport(
            "PTB/ptb-simple-signature_invalid.json",
            "PTB/ptb-simple-signature_invalid.expected.txt"
        );
    });

});
