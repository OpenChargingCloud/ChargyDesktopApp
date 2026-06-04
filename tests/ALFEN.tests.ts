import { describe, test } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport } from './testHelper';


describe('ALFEN Tests', () => {

    test("ALFEN Testdata 03 - SAFE XML-Container with Extensions", async () => {
        await expectVerificationReport(
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_withExtensions.xml",
            "ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_withExtensions.expected.txt"
        );
    });

});
