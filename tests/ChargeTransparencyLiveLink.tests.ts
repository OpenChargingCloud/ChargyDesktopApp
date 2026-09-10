import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

import type {
    IChargeTransparencyLiveLink,
    IFileInfo
} from "@open-charging-cloud/chargy-core";
import {
    Chargy,
    IsAChargeTransparencyLiveLink,
    IsAChargeTransparencyRecord,
    defaultRefreshSeconds,
    isCustomHeaderValue,
    isCustomHeaders,
    // The flat index renames it; ChargyCore and chargyApp both know it as
    // isLiveTransport.
    isTransport as isLiveTransport,
    parseOCMFBonnTariffTexts,
    verifyDocumentSignatures
} from "@open-charging-cloud/chargy-core";
import coreI18n  from "@open-charging-cloud/chargy-core/i18n.json";
import localI18n from "../src/i18n.json";
import {
    createTestChargy,
    mergeI18NDictionaries,
    parseJSONRecord
} from "./chargyTestRuntime";
import {
    documentSignatureState,
    measurementValueState,
    meterValueSessionState,
    worstLiveLinkState
} from "../src/ts/liveLinkStatus";

// The desktop bundle pulls pdfjs in through the Chargy core; the tests never
// render a PDF and must not load its worker.
vi.mock("pdfjs-dist", () => ({
    GlobalWorkerOptions: {}
}));

vi.stubGlobal("window", {
    navigator: {
        language: "en"
    }
});

const currentDirectory = fileURLToPath(new URL(".",  import.meta.url));
type DetectionResult   = ReturnType<Chargy["DetectAndConvertContentFormat"]>;

function readFixture(fileName: string): string {
    return readFileSync(join(currentDirectory, "fixtures", fileName), "utf8").trim();
}

function createChargy(): Chargy {
    return createTestChargy(Chargy, { i18n: mergeI18NDictionaries(coreI18n, localI18n) });
}

function readLiveLink(fileName: string): IChargeTransparencyLiveLink {

    const liveLink = parseJSONRecord(readFixture(fileName));

    if (!IsAChargeTransparencyLiveLink(liveLink))
        throw new Error("'" + fileName + "' is not a charge transparency live link!");

    return liveLink;

}

async function verifyChargeTransparencyLiveLink(fileName: string): DetectionResult {

    const fileInfo: IFileInfo = {
        name: fileName,
        type: "application/json",
        data: new TextEncoder().encode(readFixture(fileName))
    };

    return createChargy().DetectAndConvertContentFormat([ fileInfo ]);

}

describe("Charge Transparency LiveLink", () => {

    test("recognizes live links by their JSON-LD context", () => {

        const liveLink = parseJSONRecord(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json"));

        expect(IsAChargeTransparencyLiveLink(liveLink)).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": "https://example.com/other" })).toBe(false);
        expect(IsAChargeTransparencyLiveLink(undefined)).toBe(false);

        // A malformed optional field does not un-recognise a live link: the
        // context identifies it, and a broken transport is dropped where the
        // transports are read, not by turning the whole document into an
        // "unknown format".
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, liveTransports: [ { type: "ftp", url: "https://example.com" } ] })).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, connector: 42 })).toBe(true);

        // What a live link cannot do without: when it was created, and a list
        // of transports to receive its updates through. A document missing
        // either of the two is not one.
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, created: undefined })).toBe(false);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, liveTransports: "not an array" })).toBe(false);

    });

    test("stays a live link, whether it carries meter values or not", async () => {

        // A live link describes a charging session that is still running, a
        // charge transparency record a collection of finished ones. Carrying
        // meter values does not turn the one into the other: the application
        // shows the live link on the left and its meter values on the right.
        const withMeterValues    = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(withMeterValues)).toBe(true);
        expect(IsAChargeTransparencyRecord  (withMeterValues)).toBe(false);

        const withoutMeterValues = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0000.json");

        expect(IsAChargeTransparencyLiveLink(withoutMeterValues)).toBe(true);

        // "created" is the moment the fixture was generated, so the test
        // cannot know it in advance: it is the document's own timestamp, to
        // the second, and the same one in every document of the series.
        const created = readLiveLink("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0000.json").created;

        expect(created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(readLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json").created).toBe(created);

        if (IsAChargeTransparencyLiveLink(withoutMeterValues))
        {
            expect(withoutMeterValues.created).toBe(created);
            expect(withoutMeterValues.liveTransports).toHaveLength(3);
        }

    });

    test("parses the signed meter values of a live link into a verified CTR", async () => {

        const ctr = await createChargy().TryToParseLiveLinkMeterValues(
                              readLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json")
                          );

        expect(IsAChargeTransparencyRecord(ctr)).toBe(true);

        expect(ctr?.chargingSessions).toHaveLength(1);

        const chargingSession = ctr?.chargingSessions?.[0];

        expect(chargingSession?.EVSEId).toBe("DE*GEF*E12345678*1");
        expect(chargingSession?.measurements).toHaveLength(1);

        const measurement = chargingSession?.measurements?.[0];

        // 33 OCMF documents, but the end document repeats the start value.
        expect(measurement?.name).toBe("ENERGY_TOTAL");
        expect(measurement?.values).toHaveLength(34);

        // The live link carries the public keys, so unlike a bare OCMF file
        // every meter value can actually be verified here.
        for (const measurementValue of measurement?.values ?? [])
            expect(measurementValue.result?.status).toBe("ValidSignature");

    });

    test("carries the grid operator's power constraint, and the charging periods it cuts", () => {

        // The announcement enters the series with a document of its own, at
        // +00:24: no new meter value, but the first legally relevant log
        // message - and every later document carries it unchanged.
        const before       = parseJSONRecord(readFixture("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0003.json"));
        const announcement = parseJSONRecord(readFixture("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0004.json"));
        const final        = parseJSONRecord(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json"));

        expect(before["legallyRelevantLogMessages"]).toBeUndefined();
        expect(announcement["legallyRelevantLogMessages"]).toHaveLength(1);
        expect(announcement["signedMeterValues"]).toEqual(before["signedMeterValues"]);
        expect(final["legallyRelevantLogMessages"]).toEqual(announcement["legallyRelevantLogMessages"]);

        // The relative times of the source file became real timestamps, and
        // the grid operator signed the message with both of its keys.
        const message = (announcement["legallyRelevantLogMessages"] as Array<Record<string, unknown>>)[0];
        const data    = message?.["data"] as Record<string, unknown>;

        expect(message?.["code"]).toBe("LimitationOfPowerConsumption");
        expect(message?.["timestamp"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(data["start"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(message?.["signatures"]).toHaveLength(2);

        // Three charging periods - before, during and after the limit - that
        // meet exactly, and are all closed once the session has ended.
        const periods = final["chargingPeriods"] as Array<Record<string, unknown>>;

        expect(periods).toHaveLength(3);
        expect(periods[0]?.["stopTimestamp"]).toBe(periods[1]?.["startTimestamp"]);
        expect(periods[1]?.["stopTimestamp"]).toBe(periods[2]?.["startTimestamp"]);
        expect(typeof periods[2]?.["stopTimestamp"]).toBe("string");

    });

    test("reports no meter values for a live link that has none yet", async () => {

        const ctr = await createChargy().TryToParseLiveLinkMeterValues(
                              readLiveLink("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0000.json")
                          );

        expect(ctr).toBeUndefined();

    });

    // The JSON payload of one OCMF document. The envelope is
    // "OCMF|<payload>|<signature>", and the payload may itself contain vertical
    // bars - a "TT" recording a tariff change does - so it is taken between the
    // FIRST and the LAST bar rather than by splitting on them.
    function ocmfPayloadOf(document: string): Record<string, unknown> {
        return JSON.parse(document.slice(document.indexOf("|") + 1, document.lastIndexOf("|"))) as Record<string, unknown>;
    }

    // The "TT" tariff text of one OCMF document.
    function tariffTextOf(document: string): string {
        return ocmfPayloadOf(document)["TT"] as string;
    }

    // The fixture carries exactly one log message; a helper that throws keeps
    // the tests below from quietly passing if it ever carries none.
    function firstLogMessageOf(liveLink: Record<string, unknown>): Record<string, unknown> {

        const logMessages = liveLink["legallyRelevantLogMessages"] as Array<Record<string, unknown>>;
        const logMessage  = logMessages[0];

        if (logMessage === undefined)
            throw new Error("The fixture carries no legally relevant log message!");

        return logMessage;

    }

    async function readTamperedLiveLink(change: (liveLink: Record<string, unknown>) => void): DetectionResult {

        const tampered = JSON.parse(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json")) as Record<string, unknown>;

        change(tampered);

        return createChargy().DetectAndConvertContentFormat([ {
            name: "tampered.json",
            type: "application/json",
            data: new TextEncoder().encode(JSON.stringify(tampered))
        } ]);

    }

    test("carries the verification of the signatures over the whole document", async () => {

        // ChargyCore verifies the operator's signatures over the live link
        // itself - the ones that tie its transport URLs and public keys to
        // whoever signed them - and hands the outcome on with the document.
        const liveLink = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(liveLink)).toBe(true);

        if (IsAChargeTransparencyLiveLink(liveLink))
        {
            expect(liveLink.signatureVerification?.status).toBe("allValid");
            expect(liveLink.signatureVerification?.validCount).toBe(2);
            expect(liveLink.warnings ?? []).toHaveLength(0);
        }

    });

    test("verifies the signatures a log message carries over itself", async () => {

        const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            // The power constraint is signed by the grid operator with one
            // ECDSA and one Ed25519 key, and the keys to check it live on the
            // gridOperator of the same document. Nothing to warn about.
            expect(report.legallyRelevantLogMessages).toHaveLength(1);
            expect(report.warnings ?? []).toHaveLength(0);
        }

    });

    test("warns when a log message was changed after it was signed", async () => {

        // Changing the message inside the document breaks both signatures -
        // the document covers the message, so the operator's signature fails
        // too. What the message's own signature adds is the answer to a
        // different question: an operator who re-signs the document around a
        // forged constraint produces a document that verifies, and only the
        // grid operator's signature still says the grid never asked for it.
        // Verified in isolation in DocumentSignatures.tests.ts.
        const report = await readTamperedLiveLink(liveLink => {
            firstLogMessageOf(liveLink)["data"] = { maxPower: "60 kW" };
        });

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            const warnings = report.warnings ?? [];

            expect(warnings.some(warning =>
                warning.message["en"]?.includes("log message does not match its content") === true)).toBe(true);

            // Both fail, and both are reported.
            expect(report.signatureVerification?.status).toBe("noneValid");
            expect(warnings.some(warning =>
                warning.message["en"]?.includes("signature of this document does not match") === true)).toBe(true);

            // Reported, not refused: the message and everything around it stay
            // readable.
            expect(report.legallyRelevantLogMessages).toHaveLength(1);
            expect(report.liveTransports).toHaveLength(3);
        }

    });

    test("warns about a log message that carries no signature of its own", async () => {

        const report = await readTamperedLiveLink(liveLink => {
            delete firstLogMessageOf(liveLink)["signatures"];
        });

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
            expect((report.warnings ?? []).some(warning =>
                warning.message["en"]?.includes("not signed in its own right") === true)).toBe(true);

    });

    test("warns about a broken document signature, but still reads the document", async () => {

        // A live link whose content was changed after signing: the transports,
        // the meter values and the station data are all still there and still
        // usable - only the signature no longer matches, which is worth saying
        // but not worth refusing the document over.
        const report = await readTamperedLiveLink(liveLink => {
            liveLink["description"] = { "en": "Something else entirely" };
        });

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            expect(report.signatureVerification?.status).toBe("noneValid");
            expect(report.liveTransports).toHaveLength(3);

            const warnings = report.warnings ?? [];

            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings.some(warning => warning.message["en"]?.includes("does not match its content") === true)).toBe(true);

            // Both signatures fail the same way, which is one thing worth
            // saying, not two. Deduplication has to compare the message keys:
            // the messages themselves are freshly built objects and would
            // never compare equal.
            expect(warnings).toHaveLength(1);
        }

    });

    test("warns about an unsigned document, but still reads it", async () => {

        // The signatures are optional: a live link without any is read exactly
        // as before, it just cannot be verified as a whole.
        const report = await readTamperedLiveLink(liveLink => {
            delete liveLink["signatures"];
        });

        expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

        if (IsAChargeTransparencyLiveLink(report))
        {
            expect(report.signatureVerification?.status).toBe("unsigned");
            expect(report.liveTransports).toHaveLength(3);
            expect((report.warnings ?? []).some(warning => warning.message["en"]?.includes("not signed") === true)).toBe(true);
        }

    });

    test("treats the first document of a series as valid, not as broken", async () => {

        // The first meter value of a running session is a start value, and a
        // single one of them is perfectly legal in a live link: there is simply
        // nothing to compute a consumption from yet. ChargyCore says so with
        // "AtLeastTwoMeasurementsRequired", which for a finished record would be
        // a defect - here it must not make the document look invalid, because
        // every signature it carries verified.
        const liveLink = readLiveLink("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0001.json");
        const chargy   = createChargy();
        const ctr      = await chargy.TryToParseLiveLinkMeterValues(liveLink);

        const chargingSession = ctr?.chargingSessions?.[0];

        expect(chargingSession?.verificationResult?.status).toBe("AtLeastTwoMeasurementsRequired");
        expect(meterValueSessionState(chargingSession?.verificationResult?.status)).toBeNull();

        const measurementValues = chargingSession?.measurements?.[0]?.values ?? [];

        expect(measurementValues).toHaveLength(1);

        const states = [
            documentSignatureState(verifyDocumentSignatures(liveLink)),
            ...measurementValues.map(value => measurementValueState(value.result?.status))
        ];

        expect(worstLiveLinkState(states)).toBe("valid");

    });

    test("reads the smallest live link there is, keeps its timestamp, and requires one", async () => {

        // Reading a document is not creating one: a timestamp put in while
        // reading would say when it was read, which in a legally relevant
        // document is not what "created" means. So the stated one is kept even
        // when the clock says otherwise...
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-13T10:11:12.000Z"));

        try
        {
            const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_2.json");

            expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

            if (IsAChargeTransparencyLiveLink(report))
            {
                expect(report.created).toBe("2026-09-06T22:58:14Z");
                expect(report.liveTransports).toHaveLength(1);
            }
        }
        finally
        {
            vi.useRealTimers();
        }

        // ...and a document that states none is not a live link at all, rather
        // than one with an invented creation time.
        const withoutCreated = parseJSONRecord(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_2.json"));
        delete withoutCreated["created"];

        expect(IsAChargeTransparencyLiveLink(withoutCreated)).toBe(false);

    });

    test("reads the custom headers of an https transport", () => {

        // A literal value and a value computed per request are the two shapes
        // a header value may have.
        expect(isLiveTransport({
            type:           "https",
            urls:           [ "https://api.example.com/live" ],
            refresh:         10,
            customHeaders:  {
                                "X-Key1": "headerValue1",
                                "X-TOTP": {
                                              valueProvider: "TOTP",
                                              parameters:    { sharedSecret: "abcdefghijklmnopqrstuvwxyz1234567890" }
                                          }
                            }
        })).toBe(true);

        expect(isCustomHeaderValue("headerValue1")).toBe(true);
        expect(isCustomHeaderValue({ valueProvider: "TOTP" })).toBe(true);
        expect(isCustomHeaderValue({ parameters: { sharedSecret: "s" } })).toBe(false);
        expect(isCustomHeaderValue(42)).toBe(false);

        // The header names are not the format's business, the shape of what
        // they carry is.
        expect(isCustomHeaders({})).toBe(true);
        expect(isCustomHeaders({ "X-Key1": [ "headerValue1" ] })).toBe(false);
        expect(isCustomHeaders([ "X-Key1" ])).toBe(false);
        expect(isCustomHeaders("X-Key1: headerValue1")).toBe(false);

    });

    test("validates the custom headers on every transport", () => {

        // An SSE stream is opened with an HTTP request and a websocket with an
        // HTTP handshake, so all three transports can carry headers - and all
        // three are validated.
        for (const type of [ "https", "httpSSE", "websocket" ])
        {
            expect(isLiveTransport({ type, urls: [ "https://api.example.com/live" ], customHeaders: { "X-Key1": "v" } })).toBe(true);
            expect(isLiveTransport({ type, urls: [ "https://api.example.com/live" ], customHeaders: "X-Key1: v"        })).toBe(false);
            expect(isLiveTransport({ type, urls: [ "https://api.example.com/live" ], customHeaders: { "X-Key1": 42 }   })).toBe(false);
            expect(isLiveTransport({ type, urls: [ "https://api.example.com/live" ]                                    })).toBe(true);
        }

    });

    test("leaves an https transport without a refresh period pollable", () => {

        // Absent no longer means "never ask again" but defaultRefreshSeconds:
        // a document that names a polling endpoint without saying how often
        // still wants its readers to see what the session does next.
        expect(isLiveTransport({ type: "https", urls: [ "https://api.example.com/live" ] })).toBe(true);
        expect(defaultRefreshSeconds).toBe(10);

        // What it does say is still type-checked, and still only on https.
        expect(isLiveTransport({ type: "https",     urls: [ "https://api.example.com/live" ], refresh: "10" })).toBe(false);
        expect(isLiveTransport({ type: "websocket", urls: [ "wss://api.example.com/live"   ], refresh: "10" })).toBe(true);

    });

    test("records the session's tariff changes in the OCMF tariff text", () => {

        const liveLink    = readLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");
        const documents   = liveLink.signedMeterValues?.values ?? [];
        const tariffTexts = documents.map(tariffTextOf);

        expect(documents.length).toBeGreaterThan(0);

        const base        = "001;EUR;0;35;0;0";
        const constrained = "001;EUR;0;25;0;0";

        // A tariff text names one tariff. This session has three tariff
        // periods, so "TT" carries the tariffs that have metered something so
        // far, in order and separated by a vertical bar - the extension
        // documented in the fixture README. The base price appears twice
        // because the session returns to it: these are periods, not distinct
        // tariffs.
        expect([ ...new Set(tariffTexts) ]).toEqual([
            base,
            base + "|" + constrained,
            base + "|" + constrained + "|" + base
        ]);

        // Every one of them is a tariff text this library reads back, and each
        // entry of a history is a well-formed Bonn tariff of its own.
        for (const tariffText of tariffTexts)
            for (const tariff of parseOCMFBonnTariffTexts(tariffText))
            {
                expect(tariff.code).toBe("001");
                expect(tariff.currency).toBe("EUR");
                expect(tariff.startFeeCents).toBe(0);

                // Neither tariff has a blocking fee, which profile 001
                // expresses as a fee of zero rather than by leaving the fields
                // out.
                if (tariff.code === "001")
                {
                    expect(tariff.blockingFeeCentsPerMinute).toBe(0);
                    expect(tariff.blockingFeeStartMinute).toBe(0);
                }
            }

        // The two prices of the session, and no others.
        expect([ ...new Set(tariffTexts.flatMap(tariffText =>
            parseOCMFBonnTariffTexts(tariffText).map(tariff =>
                tariff.code === "001" ? tariff.energyFeeCentsPerKWh : undefined))) ].
                    sort((left, right) => (left ?? 0) - (right ?? 0))).toEqual([ 25, 35 ]);

    });

    test("marks the readings at which the tariff changes with TX \"T\"", () => {

        const liveLink  = readLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");
        const documents = liveLink.signedMeterValues?.values ?? [];

        const readingsOf = (document: string): Array<string> =>
            (ocmfPayloadOf(document)["RD"] as Array<Record<string, unknown>>).
                map(reading => reading["TX"] as string);

        // OCMF has a reading reason for a tariff change, and the meter reads at
        // both ends of the power limit anyway - so both boundaries carry it.
        const tariffChanges = documents.filter(document => readingsOf(document).includes("T"));

        expect(tariffChanges).toHaveLength(2);

        // A "T" reading closes the interval under the previous tariff, so it is
        // still the last document of that tariff: its history is one entry
        // shorter than that of the document after it.
        for (const tariffChange of tariffChanges)
        {
            const index = documents.indexOf(tariffChange);
            const after = documents[index + 1];

            expect(after).toBeDefined();
            expect(parseOCMFBonnTariffTexts(tariffTextOf(after ?? "")).length).
                toBe(parseOCMFBonnTariffTexts(tariffTextOf(tariffChange)).length + 1);
        }

        // One "T" per tariff change, and the first and last readings of the
        // session keep their own reasons.
        expect(readingsOf(documents[0] ?? "")).toEqual([ "B" ]);
        expect(readingsOf(documents[documents.length - 1] ?? "")).toEqual([ "B", "E" ]);

    });

});
