import { createRequire } from "node:module";
import { describe, expect, test, vi } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport, expectVerificationReportInline } from './testHelper';
import { Chargy } from '../src/ts/chargy';
import { SAFEXML } from '../src/ts/SAFE_XML';

const require = createRequire(import.meta.url);
const { DOMParser } = require("@oozcitak/dom");

function createChargy(): Chargy {

    return new Chargy(
        {},
        "en",
        require("elliptic"),
        require("moment"),
        require("asn1.js"),
        require("base32-decode"),
        () => ""
    );

}


describe('SAFE Tests with Chargy Extensions', () => {

    test("SAFE chargingStation context is parsed into a JSON object", async () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <chargingStation id="DE*GEF*STATION*CI*TESTS*1*A" xmlns="https://open.charging.cloud/CTR/2020/01">
        <description language="en">GraphDefined Charging Station - CI-Tests Pool 1 / Station A</description>
        <softwareVersion>3.0.25.2089</softwareVersion>
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

        const safeXml  = new SAFEXML(createChargy());
        const context  = SAFEXML.ParseChargingStationContext(xmlDocument);

        expect(safeXml).toBeDefined();
        expect(context).toEqual({
            ChargingStationId: "DE*GEF*STATION*CI*TESTS*1*A",
            EVSEId:            "DE*GEF*EVSE*CI*TESTS*1*A*1",
            chargingStation: {
                "@id":             "DE*GEF*STATION*CI*TESTS*1*A",
                description:       {
                    en: "GraphDefined Charging Station - CI-Tests Pool 1 / Station A"
                },
                firmwareVersion:   "3.0.25.2089",
                softwareVersion:   "3.0.25.2089",
                geoLocation:       {
                    lat: 50.387945,
                    lng: 10.4304
                },
                EVSE: {
                    "@id":         "DE*GEF*EVSE*CI*TESTS*1*A*1",
                    description:   {
                        en: "GraphDefined EVSE - CI-Tests Pool 1 / Station A / EVSE 1"
                    },
                    meters:        [],
                    connector:     {
                        "@id": "1",
                        type: "Type-2",
                        looses: 0
                    }
                }
            },
            EVSE: {
                "@id":         "DE*GEF*EVSE*CI*TESTS*1*A*1",
                description:   {
                    en: "GraphDefined EVSE - CI-Tests Pool 1 / Station A / EVSE 1"
                },
                meters:        [],
                connector:     {
                    "@id": "1",
                    type: "Type-2",
                    looses: 0
                }
            },
            connector: {
                "@id": "1",
                type: "Type-2",
                looses: 0
            }
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

    test("Multiple EVSE elements within the chargingStation XML should fail", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02_multipleEVSEs_shouldFail.xml",
            {
                status:  "InvalidSessionFormat",
                message: "Exception occured: The SAFE chargingStation XML element must not contain more than one EVSE element!"
            }
        );

    });




    test("Multiple connector elements within the EVSE XML should fail", async () => {

        await expectVerificationReportInline(
            "SAFE/withChargyExtensions/SAFE-Testdata-02_multipleConnectors_shouldFail.xml",
            {
                status:  "InvalidSessionFormat",
                message: "Exception occured: The SAFE EVSE XML element must not contain more than one connector element!"
            }
        );

    });

});
