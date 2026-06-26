import { describe, expect, test } from 'vitest';
import { expectVerificationReport, expectVerificationReportInline } from './testHelper';
import { Chargy, IsAChargeTransparencyRecord, SAFEXML } from '@open-charging-cloud/chargy-core';
import { createTestChargy, parseTestXML } from './chargyTestRuntime';


describe('SAFE Tests with Chargy Extensions', () => {

    test("SAFE chargingStation context is parsed into a JSON object", () => {

        const xmlDocument = parseTestXML(`<?xml version="1.0" encoding="UTF-8"?>
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
</values>`);

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
                    connectors: [{
                        "@id":   "1",
                        type:    "Type-2"
                    }]
                }]
            }]
        });

    });







//     test("XXSAFE chargingStation XML with multiple EVSE elements should fail", async () => {

//         const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
// <values>
//     <chargingStation id="DE*GEF*STATION*CI*TESTS*1*A" xmlns="https://open.charging.cloud/CTR/2020/01">
//         <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*1">
//         </EVSE>
//         <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*2">
//         </EVSE>
//     </chargingStation>
//     <value transactionId="begin" context="Transaction.Begin">
//         <signedData format="ALFEN">dummy</signedData>
//     </value>
// </values>`, "text/xml");

//         const result = await new SAFEXML(createChargy()).tryToParseSAFEXML(xmlDocument);

//         expect(result).toMatchObject({
//             status:  "InvalidSessionFormat",
//             message: "Exception occured: The SAFE chargingStation XML element must not contain more than one EVSE element!"
//         });

//     });

    test("SAFE OCMF v0.1 with chargingStation extensions is merged into the CTR", async () => {

        await expectVerificationReport(
            "SAFE/withChargyExtensions/SAFE-Testdata-01_OCMFv0.1_withExtensions.xml",
            "SAFE/withChargyExtensions/SAFE-Testdata-01_OCMFv0.1_withExtensions.expected.txt"
        );

    });

    test("SAFE OCMF v0.1 chargingStation extensions stay separate from the parsed OCMF CTR", async () => {

        const xmlText      = (await import("node:fs/promises")).readFile;
        const xmlDocument  = parseTestXML(
                                 await xmlText(new URL("./fixtures/SAFE/withChargyExtensions/SAFE-Testdata-01_OCMFv0.1_withExtensions.xml", import.meta.url), "utf8")
                             );

        const result       = await new SAFEXML(createTestChargy(Chargy)).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            chargingSessions: [{
                measurements: [{
                    energyMeterId: "BQ27400330016"
                }]
            }]
        });
        expect(IsAChargeTransparencyRecord(result)).toBe(true);

        if (IsAChargeTransparencyRecord(result))
            expect(result.chargingSessions?.[0]).not.toHaveProperty("EVSEId");

    });

    test("Multiple EVSE elements within the chargingStation XML should fail", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02_multipleEVSEs_shouldFail.xml",
            {
                status:  "InvalidSessionFormat",
                message: {
                    en: "Only one EVSE element is allowed within the given SAFE XML chargingStation element!"
                }
            }
        );

    });




    test("Multiple connector elements within the EVSE XML should fail", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02_multipleConnectors_shouldFail.xml",
            {
                status:  "InvalidSessionFormat",
                message: {
                    en: "Only one connector element is allowed within the given SAFE XML EVSE element!"
                }
            }
        );

    });

});
