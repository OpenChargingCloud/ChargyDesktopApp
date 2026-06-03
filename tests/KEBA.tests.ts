import { describe, test } from 'vitest';
import { expectArchiveVerificationReport } from './testHelper';


describe('KEBA Tests', () => {

    test("KEBA Testdata within a SAFE XML container", async () => {
        await expectArchiveVerificationReport(
            "KEBA/KEBA_container.xml",
            "KEBA/KEBA_container.expected.txt"
        );
    });

});
