import { describe, expect, test } from 'vitest';
import {
    Chargy,
    IsAChargeTransparencyRecord,
    OCMF,
    SessionVerificationResult,
    VerificationResult,
    type IChargingStation,
    type IOCMFChargeTransparencyRecord
} from '@open-charging-cloud/chargy-core';
import { createTestChargy } from './chargyTestRuntime';
import {
    createOCMFVersionTestData,
    supportedOCMFVersions,
    type OCMFVersionTestData,
    type SupportedOCMFVersion
} from './fixtures/OCMF/versionTestData';


async function expectVersionDataToParse(version:               SupportedOCMFVersion,
                                        includesFormatVersion: boolean): Promise<void>
{

    const testData = createOCMFVersionTestData(version, includesFormatVersion);
    const result   = await new OCMF(createTestChargy(Chargy)).TryToParseOCMFDocument(
        testData.document,
        testData.publicKeyBase64,
        "base64"
    );

    expect(IsAChargeTransparencyRecord(result)).toBe(true);
    if (!IsAChargeTransparencyRecord(result))
        throw new Error("Expected a charge transparency record");

    assertCommonMapping(result as IOCMFChargeTransparencyRecord, testData);

}


function assertCommonMapping(result:   IOCMFChargeTransparencyRecord,
                             testData: OCMFVersionTestData): void
{

    const expected    = testData.expected;
    const ocmf        = result.ocmf;
    const session     = result.chargingSessions?.[0];
    const measurement = session?.measurements[0];
    const values      = measurement?.values;

    expect(result.status).toBe(SessionVerificationResult.ValidSignature);
    expect(ocmf).toMatchObject({
        gatewayInformation:             expected.gatewayInformation,
        gatewaySerial:                  expected.gatewaySerial,
        gatewayVersion:                 expected.gatewayVersion,
        meterVendor:                    expected.meterVendor,
        meterModel:                     expected.meterModel,
        meterSerial:                    expected.meterSerial,
        meterFirmware:                  expected.meterFirmware,
        tariffText:                     expected.tariffText,
        tariffTextInterpretation:       expected.tariffText !== undefined
                                            ? {
                                                  raw:  expected.tariffText,
                                                  code: expected.tariffProfile
                                              }
                                            : undefined,
        controllerFirmwareVersion:      expected.controllerFirmwareVersion,
        lossCompensation:               expected.lossCompensation,
        chargePointIdentificationType:  expected.chargePointIdentificationType,
        chargePointIdentification:      expected.chargePointIdentification
    });
    expect(ocmf?.formatVersion).toBe(testData.includesFormatVersion ? testData.version : undefined);

    expect(session?.authorizationStart).toMatchObject({
        "@id":                  expected.identificationData,
        type:                   expected.identificationType,
        identificationStatus:   expected.identificationStatus
    });
    expect(session?.chargingStationId).toBe(expected.chargingStationId);
    expect(session?.EVSEId).toBe(expected.EVSEId);
    expect(session?.ConnectorId).toBe(expected.connectorId);
    if (expected.tariffText === undefined)
        expect(result.chargingTariffs).toBeUndefined();
    else
    {
        expect(result.chargingTariffs?.[0]).toMatchObject({
            "@id":     expected.tariffText,
            currency:  "EUR"
        });
        expect(result.chargingTariffs?.[0]?.elements?.length).toBeGreaterThan(0);
    }
    expect(session?.tariffId).toBe(expected.tariffText);
    if (expected.tariffText === undefined)
        expect(session?.chargingTariffs).toBeUndefined();
    else
        expect(session?.chargingTariffs?.[0]).toBe(result.chargingTariffs?.[0]);
    if (expected.lossCompensation !== undefined)
    {
        expect(session?.Connector?.cable).toMatchObject({
            lossCompensation:   expected.lossCompensation.LN,
            lossCompensationId: expected.lossCompensation.LI?.toString(),
            resistance:         expected.lossCompensation.LR,
            resistanceUnit:     expected.lossCompensation.LU
        });
    }
    if (expected.controllerFirmwareVersion !== undefined && expected.chargingStationId !== undefined)
    {
        expect(session?.chargingStation?.firmware?.version).toBe(expected.controllerFirmwareVersion);
        expect(result.chargingStations?.[0]?.firmware?.version).toBe(expected.controllerFirmwareVersion);
    }
    expect(measurement).toMatchObject({
        energyMeterId: expected.meterSerial,
        obis:          expected.obis,
        unit:          expected.unit,
        currentType:   "AC"
    });
    expect(values).toHaveLength(2);
    expect(values?.map(value => value.timestamp)).toEqual([
        expected.beginTimestamp,
        expected.endTimestamp
    ]);
    expect(values?.map(value => value.value.toNumber())).toEqual([
        expected.beginValue,
        expected.endValue
    ]);
    expect(values?.map(value => value.pagination)).toEqual([
        expected.pagination,
        expected.pagination
    ]);
    expect(values?.map(readErrorIndex)).toEqual([
        expected.errorIndex,
        expected.errorIndex
    ]);
    expect(values?.map(value => value.result?.status)).toEqual([
        VerificationResult.ValidSignature,
        VerificationResult.ValidSignature
    ]);
    expect(values?.map(value => value.ocmfDocument?.raw)).toEqual([
        testData.document,
        testData.document
    ]);
    expect(values?.[0]?.ocmfDocument?.payload).toEqual(testData.payload);

    if (expected.cumulatedLoss === undefined)
        expect(values?.map(value => value.cumulatedLoss)).toEqual([ undefined, undefined ]);
    else
        expect(values?.map(value => value.cumulatedLoss?.toNumber())).toEqual([ undefined, expected.cumulatedLoss ]);

}


function readErrorIndex(value: unknown): number | undefined {

    if (typeof value !== "object" || value === null)
        return undefined;

    const errorIndex = (value as Record<string, unknown>)["errorIndex"];
    return typeof errorIndex === "number" ? errorIndex : undefined;

}


describe.each(supportedOCMFVersions)("OCMF version %s", version => {

    test("parses deterministic randomized version data", async () => {
        await expectVersionDataToParse(version, true);
    });

    test("parses the same version-specific data without FV", async () => {
        await expectVersionDataToParse(version, false);
    });

});


test("randomized version data covers EVSEID and CBIDC mappings", () => {

    const identificationTypes = supportedOCMFVersions
                                    .map(version => createOCMFVersionTestData(version, true).expected.chargePointIdentificationType)
                                    .filter(type => type !== undefined);

    expect(new Set(identificationTypes)).toEqual(new Set([ "EVSEID", "CBIDC" ]));

});


test("maps signed CF onto a CBIDC charging station firmware", async () => {

    const testData = createOCMFVersionTestData("1.3", true, "CBIDC");
    const result   = await new OCMF(createTestChargy(Chargy)).TryToParseOCMFDocument(
        testData.document,
        testData.publicKeyBase64,
        "base64"
    );

    expect(IsAChargeTransparencyRecord(result)).toBe(true);
    if (!IsAChargeTransparencyRecord(result))
        throw new Error("Expected a charge transparency record");

    expect(result.chargingSessions?.[0]?.chargingStation).toMatchObject({
        "@id":     testData.expected.chargingStationId,
        firmware: {
            version: testData.expected.controllerFirmwareVersion
        }
    });
    expect(result.chargingStations?.[0]).toMatchObject({
        "@id":     testData.expected.chargingStationId,
        firmware: {
            version: testData.expected.controllerFirmwareVersion
        }
    });

});


test("signed CF overrides container charging station firmware for EVSEID", async () => {

    const testData        = createOCMFVersionTestData("1.4", false, "EVSEID");
    const containerStation: IChargingStation = {
        "@id":     "unsigned-container-station",
        firmware: {
            version: "unsigned-container-firmware"
        },
        EVSEs: [{
            "@id": testData.expected.EVSEId ?? "missing-evse-id"
        }]
    };
    const result = await new OCMF(createTestChargy(Chargy)).TryToParseOCMFDocument(
        testData.document,
        testData.publicKeyBase64,
        "base64",
        {
            chargingStations: [ containerStation ]
        }
    );

    expect(IsAChargeTransparencyRecord(result)).toBe(true);
    if (!IsAChargeTransparencyRecord(result))
        throw new Error("Expected a charge transparency record");

    expect(result.chargingSessions?.[0]).toMatchObject({
        chargingStationId: containerStation["@id"],
        EVSEId:            testData.expected.EVSEId,
        chargingStation: {
            firmware: {
                version: testData.expected.controllerFirmwareVersion
            }
        }
    });
    expect(result.chargingStations?.[0]?.firmware?.version).toBe(testData.expected.controllerFirmwareVersion);
    expect(containerStation.firmware?.version).toBe("unsigned-container-firmware");

});


test("signed LC overrides matching container cable data", async () => {

    const testData = createOCMFVersionTestData("1.2", true, "EVSEID");
    const result   = await new OCMF(createTestChargy(Chargy)).TryToParseOCMFDocument(
        testData.document,
        testData.publicKeyBase64,
        "base64",
        {
            EVSEs: [{
                "@id": testData.expected.EVSEId ?? "missing-evse-id",
                connectors: [{
                    "@id": "container-connector",
                    cable: {
                        length:             7.5,
                        lossCompensation:   "unsigned-name",
                        lossCompensationId: "999",
                        resistance:         999,
                        resistanceUnit:     "uOhm"
                    }
                }]
            }]
        }
    );

    expect(IsAChargeTransparencyRecord(result)).toBe(true);
    if (!IsAChargeTransparencyRecord(result))
        throw new Error("Expected a charge transparency record");

    expect(result.chargingSessions?.[0]?.Connector).toMatchObject({
        "@id": "container-connector",
        cable: {
            length:             7.5,
            lossCompensation:   testData.expected.lossCompensation?.LN,
            lossCompensationId: testData.expected.lossCompensation?.LI?.toString(),
            resistance:         testData.expected.lossCompensation?.LR,
            resistanceUnit:     testData.expected.lossCompensation?.LU
        }
    });

});
