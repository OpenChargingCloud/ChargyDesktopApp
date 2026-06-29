import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
    Chargy,
    IsAChargeTransparencyRecord,
    PTB,
    SessionVerificationResult,
    VerificationResult,
    type IOCMFMeasurementValue,
    type IPTBContainer,
    type IPTBValidationError
} from '@open-charging-cloud/chargy-core';
import { createTestChargy } from './chargyTestRuntime';


function readPTBFixture(fileName: string): IPTBContainer {
    const content: unknown = JSON.parse(
        readFileSync(new URL("fixtures/PTBContainer/" + fileName, import.meta.url), "utf8")
    );

    return content as IPTBContainer;
}

async function detectPTBContainer(container: IPTBContainer): ReturnType<Chargy["DetectAndConvertContentFormat"]> {

    return createTestChargy(Chargy).DetectAndConvertContentFormat([{
        name: "ptb.json",
        type: "application/json",
        data: new TextEncoder().encode(JSON.stringify(container))
    }]);

}


describe('PTB Container Tests', () => {

    test("converts a PTB container carrying known valid OCMF test data", async () => {

        // The PTB format requires separate begin and end records. This fixture
        // deliberately reuses the already verified OCMF-Testdata-01 record for
        // both positions so that the test remains focused on the container.
        const container = readPTBFixture("ptb-ocmf-testdata-01.json");
        const result    = await detectPTBContainer(container);

        const sourceOCMF      = readFileSync(new URL("fixtures/OCMF/OCMF-Testdata-01.txt",           import.meta.url), "utf8").trim();
        const sourcePublicKey = readFileSync(new URL("fixtures/OCMF/OCMF-Testdata-01_publicKey.txt", import.meta.url), "utf8").trim();

        expect(container.ocmfBegin).toBe(sourceOCMF);
        expect(container.ocmfEnd).  toBe(sourceOCMF);
        expect(container.publicKey).toBe(Buffer.from(sourcePublicKey, "hex").toString("base64"));

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            throw new Error("Expected a charge transparency record");

        expect(result.chargingStations).toMatchObject([{
            "@id":       container.chargeboxIdentifier,
            address:     {
                city:       "Berlin",
                street:     "Teststrasse 1",
                postalCode: "10115",
                country:    "DE"
            },
            geoLocation: {
                lat: 52.5,
                lng: 13.4
            },
            EVSEs: [{
                "@id": container.chargeboxIdentifier
            }]
        }]);

        const session     = result.chargingSessions?.[0];
        const measurement = session?.measurements?.[0];
        const values      = measurement?.values as IOCMFMeasurementValue[] | undefined;

        expect(session?.EVSEId).toBe(container.chargeboxIdentifier);
        expect(measurement?.energyMeterId).toBe("******240084S");
        expect(measurement?.unit).toBe("kWh");
        expect(values).toHaveLength(2);
        expect(values?.map(value => value.result?.status)).toEqual([
            VerificationResult.ValidSignature,
            VerificationResult.ValidSignature
        ]);
        expect(values?.map(value => value.ocmfDocument?.raw)).toEqual([
            container.ocmfBegin,
            container.ocmfEnd
        ]);

    });

    test.skip("detects the PTB envelope and returns an OCMF CTR with location metadata", async () => {

        const container = readPTBFixture("ptb-simple.json");
        const result    = await detectPTBContainer(container);

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            throw new Error("Expected a charge transparency record");

        expect(result.chargingStations).toMatchObject([{
            "@id":       container.chargeboxIdentifier,
            address:     {
                city:   "Berlin",
                street: "Teststrasse 1"
            },
            geoLocation: {
                lat: 52.5,
                lng: 13.4
            },
            EVSEs: [{
                "@id": container.chargeboxIdentifier
            }]
        }]);

        const session     = result.chargingSessions?.[0];
        const measurement = session?.measurements?.[0];
        const values      = measurement?.values as IOCMFMeasurementValue[] | undefined;

        expect(session?.EVSEId).toBe(container.chargeboxIdentifier);
        expect(measurement?.energyMeterId).toBe("METER12345678");
        expect(measurement?.unit).toBe("Wh");
        expect(values).toHaveLength(2);
        expect(values?.map(value => value.result?.status)).toEqual([
            VerificationResult.ValidSignature,
            VerificationResult.ValidSignature
        ]);
        expect(values?.map(value => value.ocmfDocument?.raw)).toEqual([
            container.ocmfBegin,
            container.ocmfEnd
        ]);

    });


    test.skip("keeps a failed legacy OCMF signature in the Core CTR", async () => {

        const result = await detectPTBContainer(readPTBFixture("ptb-simple-signature_invalid.json"));

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            throw new Error("Expected a charge transparency record");

        const values = result.chargingSessions?.[0]?.measurements?.[0]?.values as IOCMFMeasurementValue[] | undefined;

        expect(values).toHaveLength(2);
        expect(values?.map(value => value.result?.status)).toEqual([
            VerificationResult.InvalidSignature,
            VerificationResult.ValidSignature
        ]);

    });


    test.skip("normalizes legacy town and zipCode aliases", async () => {

        const original  = readPTBFixture("ptb-simple.json");
        const container: IPTBContainer = {
            ...original,
            address: {
                street:  "Testweg",
                zipCode: "10115",
                town:    "Berlin"
            }
        };

        const result = await new PTB(createTestChargy(Chargy)).TryToParsePTBContainer(container);

        expect(IsAChargeTransparencyRecord(result)).toBe(true);
        if (!IsAChargeTransparencyRecord(result))
            throw new Error("Expected a charge transparency record");

        expect(result.chargingStations?.[0]?.address).toMatchObject({
            city:       "Berlin",
            postalCode: "10115"
        });

    });


    test("returns all container schema violations as a structured error", async () => {

        const original = readPTBFixture("ptb-simple.json");
        const invalidContainer: unknown = {
            ...original,
            formatVersion: "2.0",
            publicKey:     "not base64!",
            address: {
                street: "",
                town:   ""
            },
            geoLocation: {
                lat:      91,
                lng:      "13.4",
                altitude: 34
            },
            ocmfBegin: "changed"
        };

        const result = await new PTB(createTestChargy(Chargy)).TryToParsePTBContainer(invalidContainer);

        expect(IsAChargeTransparencyRecord(result)).toBe(false);
        expect(result.status).toBe(SessionVerificationResult.InvalidSessionFormat);

        const validationError = result as IPTBValidationError;
        expect(validationError.format).toBe("ptb");
        expect(validationError.issues.map(issue => issue.path)).toEqual(expect.arrayContaining([
            "$.formatVersion",
            "$.publicKey",
            "$.address.street",
            "$.address",
            "$.geoLocation.lat",
            "$.geoLocation.lng",
            "$.geoLocation.altitude",
            "$.ocmfBegin"
        ]));

    });

});
