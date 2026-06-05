import { createRequire } from "node:module";
import { describe, expect, test, vi } from 'vitest';
import { expectVerificationReport, expectArchiveVerificationReport } from './testHelper';
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


describe('SAFE Tests', () => {

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

    test("SAFE value without signedData should fail", async () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <value transactionId="begin" context="Transaction.Begin">
        <publicKey encoding="plain">abc</publicKey>
    </value>
</values>`, "text/xml");

        const result = await new SAFEXML(createChargy()).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            status:  "InvalidSessionFormat",
            message: "Each value within the given XML container must contain signed data!"
        });

    });

    test("SAFE chargingStation with multiple direct EVSE elements should fail", async () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <chargingStation id="DE*GEF*STATION*CI*TESTS*1*A" xmlns="https://open.charging.cloud/CTR/2020/01">
        <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*1">
        </EVSE>
        <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*2">
        </EVSE>
    </chargingStation>
    <value transactionId="begin" context="Transaction.Begin">
        <signedData format="ALFEN">dummy</signedData>
    </value>
</values>`, "text/xml");

        const result = await new SAFEXML(createChargy()).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            status:  "InvalidSessionFormat",
            message: "Exception occured: The SAFE chargingStation XML element must not contain more than one EVSE element!"
        });

    });

    test("SAFE EVSE with multiple connector elements should fail", async () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <chargingStation id="DE*GEF*STATION*CI*TESTS*1*A" xmlns="https://open.charging.cloud/CTR/2020/01">
        <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*1">
            <connector id="1">
                <type>Type-2</type>
            </connector>
            <connector id="2">
                <type>CCS</type>
            </connector>
        </EVSE>
    </chargingStation>
    <value transactionId="begin" context="Transaction.Begin">
        <signedData format="ALFEN">dummy</signedData>
    </value>
</values>`, "text/xml");

        const result = await new SAFEXML(createChargy()).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            status:  "InvalidSessionFormat",
            message: "Exception occured: The SAFE EVSE XML element must not contain more than one connector element!"
        });

    });

    test("SAFE chargingStation with EVSEs container should fail", async () => {

        const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<values>
    <chargingStation id="DE*GEF*STATION*CI*TESTS*1*A" xmlns="https://open.charging.cloud/CTR/2020/01">
        <EVSEs>
            <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*1">
            </EVSE>
        </EVSEs>
    </chargingStation>
    <value transactionId="begin" context="Transaction.Begin">
        <signedData format="ALFEN">dummy</signedData>
    </value>
</values>`, "text/xml");

        const result = await new SAFEXML(createChargy()).tryToParseSAFEXML(xmlDocument);

        expect(result).toMatchObject({
            status:  "InvalidSessionFormat",
            message: "Exception occured: The SAFE chargingStation XML element must contain EVSE directly and no EVSEs container element!"
        });

    });





    test("SAFE Testdata 01", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-01_OCMFv0.1.xml",
            "SAFE/SAFE-Testdata-01_OCMFv0.1.expected.txt"
        );
    });


    test("SAFE Testdata 02 empty XML namespace", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_emptyXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 without XML namespace", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_withoutXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 with XML namespace", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_withXMLNamespace.xml",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });

    test("SAFE Testdata 02 with XML namespace via PDF/A-3", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-02_withXMLNamespace.pdf",
            "SAFE/SAFE-Testdata-02.expected.txt"
        );
    });


    test("SAFE Testdata 03 single measurement - should fail", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-03_singleMeasurement_ShouldFail.xml",
            "SAFE/SAFE-Testdata-03.expected.txt"
        );
    });


    test("SAFE Testdata 04", async () => {
        await expectArchiveVerificationReport(
            "SAFE/SAFE-Testdata-04.xml",
            "SAFE/SAFE-Testdata-04.expected.txt"
        );
    });

});
