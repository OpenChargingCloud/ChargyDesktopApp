/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The one verdict shown over a whole charge transparency live link, and the
// steps it is made of.
//
// Two independent things decide it, and both are signatures: those over the
// document - which make the transport URLs and the listed public keys the
// operator's - and those over every single meter value. The worst of them wins,
// because a verdict over the whole is only ever as good as its weakest part.
//
// The rule that shapes all of this: a red cross needs evidence that something
// is wrong. A verdict that merely says "this cannot be determined" must never
// look like a failure - a live link describes a charging session that is still
// running, so half of what would be a defect in a finished record is simply the
// normal state here.

import { ChargyInterfaces as chargyInterfaces } from '@open-charging-cloud/chargy-core';
import type { IDocumentSignaturesResult }       from '@open-charging-cloud/chargy-core';


/** What the badge over a live link says. */
export type LiveLinkOverallState = "valid" | "warning" | "invalid" | "unvalidated";


/**
 * What a document's own signatures amount to.
 *
 * A signature that demonstrably does not match is the only outcome that says
 * something is wrong. An unknown key, or an algorithm this application does not
 * implement, says merely that it cannot be judged here - which is a weaker
 * statement and must not look the same.
 */
export function documentSignatureState(verification: IDocumentSignaturesResult): LiveLinkOverallState {

    if (verification.signatures.some(signature => signature.status === "invalidSignature"))
        return "invalid";

    return verification.status === "allValid" ? "valid" : "warning";

}


/**
 * What a charging session's own verdict means for a live link.
 *
 * Returns null where the verdict says nothing about whether anything is wrong.
 * A session with a single reading has no consumption to compute yet, and one
 * without a stop value has not ended - which is what "live" means. For a
 * finished charge transparency record both would be defects; for a live link
 * they are the everyday case, and the meter values that do exist still speak
 * for themselves.
 */
export function meterValueSessionState(status: chargyInterfaces.SessionVerificationResult | undefined): LiveLinkOverallState | null {

    switch (status)
    {

        case chargyInterfaces.SessionVerificationResult.ValidSignature:
            return "valid";

        case chargyInterfaces.SessionVerificationResult.InplausibleMeasurement:
            return "warning";

        case chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired:
        case chargyInterfaces.SessionVerificationResult.MissingStopValue:
            return null;

        // Everything that is positively wrong: a broken chain, a signature that
        // does not hold, a key that cannot be used.
        case chargyInterfaces.SessionVerificationResult.UnknownCTRFormat:
        case chargyInterfaces.SessionVerificationResult.NoChargeTransparencyRecordsFound:
        case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
        case chargyInterfaces.SessionVerificationResult.InvalidSessionFormat:
        case chargyInterfaces.SessionVerificationResult.InconsistentTimestamps:
        case chargyInterfaces.SessionVerificationResult.MissingStartValue:
        case chargyInterfaces.SessionVerificationResult.InvalidStartValue:
        case chargyInterfaces.SessionVerificationResult.InvalidIntermediateValue:
        case chargyInterfaces.SessionVerificationResult.InvalidStopValue:
        case chargyInterfaces.SessionVerificationResult.EnergyMeterNotFound:
        case chargyInterfaces.SessionVerificationResult.InvalidMeasurement:
        case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
        case chargyInterfaces.SessionVerificationResult.UnknownPublicKeyFormat:
        case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
        case chargyInterfaces.SessionVerificationResult.UnknownSignatureFormat:
        case chargyInterfaces.SessionVerificationResult.InvalidSignature:
            return "invalid";

        // Not validated, or a verdict a later core introduced: nothing was
        // established, neither good nor bad.
        default:
            return "unvalidated";

    }

}


/** The same question for a single meter value. */
export function measurementValueState(status: chargyInterfaces.VerificationResult | undefined): LiveLinkOverallState {

    switch (status)
    {

        case chargyInterfaces.VerificationResult.ValidSignature:
        case chargyInterfaces.VerificationResult.ValidStartValue:
        case chargyInterfaces.VerificationResult.ValidIntermediateValue:
        case chargyInterfaces.VerificationResult.ValidStopValue:
            return "valid";

        case chargyInterfaces.VerificationResult.UnknownCTRFormat:
        case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
        case chargyInterfaces.VerificationResult.InvalidMeasurement:
        case chargyInterfaces.VerificationResult.InvalidStartValue:
        case chargyInterfaces.VerificationResult.InvalidIntermediateValue:
        case chargyInterfaces.VerificationResult.InvalidStopValue:
        case chargyInterfaces.VerificationResult.PublicKeyNotFound:
        case chargyInterfaces.VerificationResult.UnknownPublicKeyFormat:
        case chargyInterfaces.VerificationResult.InvalidPublicKey:
        case chargyInterfaces.VerificationResult.UnknownSignatureFormat:
        case chargyInterfaces.VerificationResult.InvalidSignature:
        case chargyInterfaces.VerificationResult.ValidationError:
            return "invalid";

        // Unvalidated, NoOperation and the bare StartValue / IntermediateValue /
        // StopValue kinds say what a value is, not that it verified.
        default:
            return "unvalidated";

    }

}


/**
 * The verdict over all of it: the worst part decides, and nothing to go on at
 * all is "unvalidated" rather than a claim in either direction.
 */
export function worstLiveLinkState(states: Array<LiveLinkOverallState>): LiveLinkOverallState {

    if (states.length === 0)             return "unvalidated";

    if (states.includes("invalid"))      return "invalid";
    if (states.includes("warning"))      return "warning";
    if (states.includes("unvalidated"))  return "unvalidated";

    return "valid";

}


/**
 * The same verdict in the vocabulary the command line speaks.
 *
 * The GUI can show a badge that means "this cannot be judged"; a process exit
 * code cannot. It has three outcomes, and the CLI contract reserves the
 * successful one for a verification where everything held: only "valid"
 * becomes ValidSignature and therefore exit code 0.
 *
 * A warning is not a failure - but it is not a confirmation either, and a
 * script that reads exit code 0 would take it for one. So it maps, like a state
 * with nothing to go on at all, to Unvalidated: "nothing was established here",
 * which the exit-code mapping turns into 2 rather than into success.
 */
export function liveLinkVerificationResult(state: LiveLinkOverallState): chargyInterfaces.SessionVerificationResult {

    switch (state)
    {

        case "valid":
            return chargyInterfaces.SessionVerificationResult.ValidSignature;

        case "invalid":
            return chargyInterfaces.SessionVerificationResult.InvalidSignature;

        // "warning" and "unvalidated": checked, and nothing was established.
        default:
            return chargyInterfaces.SessionVerificationResult.Unvalidated;

    }

}




