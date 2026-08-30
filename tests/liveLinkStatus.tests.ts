import { describe, expect, test } from "vitest";

import { ChargyInterfaces as chargyInterfaces } from "@open-charging-cloud/chargy-core";
import type { IDocumentSignaturesResult, IDocumentSignatureResult } from "@open-charging-cloud/chargy-core";

import {
    documentSignatureState,
    measurementValueState,
    meterValueSessionState,
    worstLiveLinkState
} from "../src/ts/liveLinkStatus";

const SessionResult = chargyInterfaces.SessionVerificationResult;
const ValueResult   = chargyInterfaces.VerificationResult;

function verification(status:      IDocumentSignaturesResult["status"],
                      ...statuses: Array<IDocumentSignatureResult["status"]>): IDocumentSignaturesResult {
    return {
        status,
        validCount: statuses.filter(entry => entry === "validSignature").length,
        signatures: statuses.map((entry, index) => ({ index, status: entry }))
    };
}

describe("The verdict over a whole live link", () => {

    describe("the signatures over the document", () => {

        test("everything verified is valid", () => {
            expect(documentSignatureState(verification("allValid", "validSignature", "validSignature"))).toBe("valid");
        });

        test("a signature that does not match is invalid", () => {
            expect(documentSignatureState(verification("noneValid",  "invalidSignature"))).toBe("invalid");
            expect(documentSignatureState(verification("someValid",  "validSignature", "invalidSignature"))).toBe("invalid");
        });

        // The distinction the badge exists for: not being able to check a
        // signature is not the same as having checked it and found it wrong.
        test("a signature that cannot be judged is only a warning", () => {
            expect(documentSignatureState(verification("noneValid", "unknownPublicKey"))).toBe("warning");
            expect(documentSignatureState(verification("noneValid", "unsupportedAlgorithm"))).toBe("warning");
            expect(documentSignatureState(verification("noneValid", "malformed"))).toBe("warning");
            expect(documentSignatureState(verification("someValid", "validSignature", "unknownPublicKey"))).toBe("warning");
        });

        test("an unsigned document is a warning, not a failure", () => {
            expect(documentSignatureState(verification("unsigned"))).toBe("warning");
        });

    });

    describe("the verdict of the charging session", () => {

        // A single meter value is perfectly legal in a live link as long as it
        // is a start value, and a session that has not ended is what "live"
        // means. Neither says anything went wrong, so neither may colour the
        // badge - the meter values that exist decide on their own.
        test("a session that has only just begun says nothing either way", () => {
            expect(meterValueSessionState(SessionResult.AtLeastTwoMeasurementsRequired)).toBeNull();
        });

        test("a session that has not ended yet says nothing either way", () => {
            expect(meterValueSessionState(SessionResult.MissingStopValue)).toBeNull();
        });

        test("a verified session is valid", () => {
            expect(meterValueSessionState(SessionResult.ValidSignature)).toBe("valid");
        });

        test("an implausible measurement is a warning", () => {
            expect(meterValueSessionState(SessionResult.InplausibleMeasurement)).toBe("warning");
        });

        test("what is positively wrong is invalid", () => {
            for (const status of [
                SessionResult.InvalidSignature,
                SessionResult.InvalidPublicKey,
                SessionResult.InvalidMeasurement,
                SessionResult.InconsistentTimestamps,
                SessionResult.MissingStartValue,
                SessionResult.PublicKeyNotFound
            ])
                expect(meterValueSessionState(status)).toBe("invalid");
        });

        // A red cross needs evidence. An unknown verdict - one a later core
        // introduces - must not be turned into an accusation.
        test("an unknown or absent verdict is unvalidated, never invalid", () => {
            expect(meterValueSessionState(SessionResult.Unvalidated)).toBe("unvalidated");
            expect(meterValueSessionState(undefined)).toBe("unvalidated");
            expect(meterValueSessionState("SomethingALaterCoreAdded" as chargyInterfaces.SessionVerificationResult)).toBe("unvalidated");
        });

    });

    describe("a single meter value", () => {

        test("every kind of verified value is valid", () => {
            for (const status of [
                ValueResult.ValidSignature,
                ValueResult.ValidStartValue,
                ValueResult.ValidIntermediateValue,
                ValueResult.ValidStopValue
            ])
                expect(measurementValueState(status)).toBe("valid");
        });

        test("a broken signature is invalid", () => {
            expect(measurementValueState(ValueResult.InvalidSignature)).toBe("invalid");
            expect(measurementValueState(ValueResult.InvalidPublicKey)).toBe("invalid");
            expect(measurementValueState(ValueResult.ValidationError)).toBe("invalid");
        });

        // These name what a value is, not that it verified.
        test("a value that was merely classified is unvalidated", () => {
            expect(measurementValueState(ValueResult.StartValue)).toBe("unvalidated");
            expect(measurementValueState(ValueResult.IntermediateValue)).toBe("unvalidated");
            expect(measurementValueState(ValueResult.StopValue)).toBe("unvalidated");
            expect(measurementValueState(ValueResult.NoOperation)).toBe("unvalidated");
            expect(measurementValueState(undefined)).toBe("unvalidated");
        });

    });

    describe("putting it together", () => {

        test("the worst part decides", () => {
            expect(worstLiveLinkState([ "valid", "valid" ])).toBe("valid");
            expect(worstLiveLinkState([ "valid", "unvalidated" ])).toBe("unvalidated");
            expect(worstLiveLinkState([ "valid", "warning" ])).toBe("warning");
            expect(worstLiveLinkState([ "warning", "invalid" ])).toBe("invalid");
            expect(worstLiveLinkState([ "valid", "unvalidated", "warning", "invalid" ])).toBe("invalid");
        });

        test("nothing to go on is unvalidated, not valid", () => {
            expect(worstLiveLinkState([])).toBe("unvalidated");
        });

        // The case that sent a green live link red: the first document of a
        // series, with two good document signatures and one good start value.
        test("a live link with a single signed start value is valid", () => {

            const states: Array<ReturnType<typeof measurementValueState>> = [];

            states.push(documentSignatureState(verification("allValid", "validSignature", "validSignature")));

            const sessionState = meterValueSessionState(SessionResult.AtLeastTwoMeasurementsRequired);

            expect(sessionState).toBeNull();

            states.push(measurementValueState(ValueResult.ValidSignature));

            expect(worstLiveLinkState(states)).toBe("valid");

        });

    });

});


