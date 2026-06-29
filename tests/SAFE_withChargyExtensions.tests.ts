import { DOMParser } from "@oozcitak/dom";
import { describe, expect, test } from 'vitest';
import { expectVerificationReport, expectVerificationReportInline } from './testHelper';
import { Chargy } from '@open-charging-cloud/chargy-core';
import { SAFEXML } from '@open-charging-cloud/chargy-core';
import { createTestChargy } from './chargyTestRuntime';


describe('SAFE Tests with Chargy Extensions', () => {

    test("SAFE chargingStation context is parsed into a JSON object", () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <chargingStation id="DE*GEF*STATION*CI*TESTS*1*A" xmlns="https://open.charging.cloud/CTR/2020/01">
        <description language="en">GraphDefined Charging Station - CI-Tests Pool 1 / Station A</description>
        <firmware>
            <version>3.0.25.2089</version>
        </firmware>
        <geoLocation>
            <latitude>50.387945</latitude>
            <longitude>10.4304</longitude>
        </geoLocation>
        <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*1">
            <description language="en">GraphDefined EVSE - CI-Tests Pool 1 / Station A / EVSE 1</description>
            <connector id="1">
                <type>Type-2</type>
            </connector>
        </EVSE>
    </chargingStation>
    <value transactionId="begin" context="Transaction.Begin">
        <signedData format="ALFEN">dummy</signedData>
    </value>
</values>`, "text/xml");


        const chargy   = createTestChargy(Chargy);
        const safeXml  = new SAFEXML(chargy);
        const context  = SAFEXML.ParseContainerInfos(xmlDocument, chargy);

        expect(safeXml).toBeDefined();
        expect(context).toEqual({
            chargingStations: [{
                "@id":             "DE*GEF*STATION*CI*TESTS*1*A",
                description:       {
                    en: "GraphDefined Charging Station - CI-Tests Pool 1 / Station A"
                },
                firmware: {
                    version:   "3.0.25.2089"
                },
                geoLocation:       {
                    lat: 50.387945,
                    lng: 10.4304
                },
                EVSEs: [{
                    "@id":         "DE*GEF*EVSE*CI*TESTS*1*A*1",
                    description:   {
                        en: "GraphDefined EVSE - CI-Tests Pool 1 / Station A / EVSE 1"
                    },
                    //meters:        [],
                    connectors: [{
                        "@id":   "1",
                        type:    "Type-2"
                    }]
                }]
            }]
        });

    });


    test("SAFE OCMF v0.1 with chargingStation extensions is merged into the CTR", async () => {

        await expectVerificationReport(
            "SAFE/withChargyExtensions/SAFE-Testdata-01_OCMFv0.1_withExtensions.xml",
            "SAFE/withChargyExtensions/SAFE-Testdata-01_OCMFv0.1_withExtensions.expected.txt"
        );

    });

    test("SAFE OCMF v0.1 chargingStation extensions are wired into the charging station and EVSE", async () => {

        const xmlText      = (await import("node:fs/promises")).readFile;
        const xmlDocument  = new DOMParser().parseFromString(
                                 await xmlText(new URL("./fixtures/SAFE/withChargyExtensions/SAFE-Testdata-01_OCMFv0.1_withExtensions.xml", import.meta.url), "utf8"),
                                 "text/xml"
                             );

        const result = await new SAFEXML(createTestChargy(Chargy)).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            chargingStations: [{
                "@id":             "DE*GEF*STATION*CI*TESTS*1*A",
                description:       { en: "GraphDefined Charging Station - CI-Tests Pool 1 / Station A" },
                firmware: {
                    version:       "3.0.25.2089"
                },
                geoLocation:       { lat: 50.387945, lng: 10.4304 },
                EVSEs: [{
                    "@id":         "DE*GEF*EVSE*CI*TESTS*1*A*1",
                    description:   { en: "GraphDefined EVSE - CI-Tests Pool 1 / Station A / EVSE 1" },
                    connectors:    [{ "@id": "1", type: "Type-2" }]
                }]
            }]
        //    chargingSessions: [{
        //        EVSEId: "DE*GEF*EVSE*CI*TESTS*1*A*1"
        //    }]
        });

    });






    test("ChargingStation XML without warnings", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02.xml",
            {
                status:  "ValidSignature",
                chargingStations: [{
                    "@id": "DE*GEF*STATION*CI*TESTS*1*A",
                    EVSEs: [{
                        "@id": "DE*GEF*EVSE*CI*TESTS*1*A*1",
                        connectors: [{
                            "@id": "1",
                            type:  "Type-2"
                        }]
                    }]
                }],
                chargingSessions: [{
                    chargingStationId: "DE*GEF*STATION*CI*TESTS*1*A",
                    EVSEId:            "DE*GEF*EVSE*CI*TESTS*1*A*1",
                    ConnectorId:       "1",
                    Connector: {
                        "@id": "1",
                        type:  "Type-2"
                    },
                    verificationResult: {
                        status: "ValidSignature"
                    }
                }]
            }
        );

    });

    test("Multiple EVSE elements within the chargingStation XML should warn only", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02_multipleEVSEs_shouldFail.xml",
            {
                status:  "ValidSignature",
                chargingStations: [{
                    "@id": "DE*GEF*STATION*CI*TESTS*1*A",
                    EVSEs: [{
                        "@id": "DE*GEF*EVSE*CI*TESTS*1*A*1",
                        connectors: [{
                            "@id": "1",
                            type:  "Type-1"
                        }]
                    }]
                }],
                warnings: [{
                    level:   "low",
                    message: {
                        en: "Only one EVSE element is allowed within the given SAFE XML chargingStation element!"
                    }
                }],
                chargingSessions: [{
                    chargingStationId: "DE*GEF*STATION*CI*TESTS*1*A",
                    EVSEId:            "DE*GEF*EVSE*CI*TESTS*1*A*1",
                    ConnectorId:       "1",
                    Connector: {
                        "@id": "1",
                        type:  "Type-1"
                    },
                    verificationResult: {
                        status: "ValidSignature"
                    }
                }]
            }
        );

    });

    test("Multiple connector elements within the EVSE XML should warn only", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02_multipleConnectors_shouldFail.xml",
            {
                status:  "ValidSignature",
                chargingStations: [{
                    "@id": "DE*GEF*STATION*CI*TESTS*1*A",
                    EVSEs: [{
                        "@id": "DE*GEF*EVSE*CI*TESTS*1*A*1",
                        connectors: [{
                            "@id": "1",
                            type:  "Type-2"
                        }]
                    }]
                }],
                warnings: [{
                    level:   "low",
                    message: {
                        en: "Only one connector element is allowed within the given SAFE XML EVSE element!"
                    }
                }],
                chargingSessions: [{
                    chargingStationId: "DE*GEF*STATION*CI*TESTS*1*A",
                    EVSEId:            "DE*GEF*EVSE*CI*TESTS*1*A*1",
                    ConnectorId:       "1",
                    Connector: {
                        "@id": "1",
                        type:  "Type-2"
                    },
                    verificationResult: {
                        status: "ValidSignature"
                    }
                }]
            }
        );

    });

});
