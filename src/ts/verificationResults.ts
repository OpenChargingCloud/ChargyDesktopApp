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

import {
    isISessionCryptoResult1,
    SessionVerificationResult
} from './interfaces/chargyInterfaces';
import type {
    ISessionCryptoResult
} from './interfaces/chargyInterfaces';
import type {
    IChargeTransparencyRecord
} from './interfaces/IChargeTransparencyRecord';

/**
 * Extracts the per-session verification results from a verified Charge Transparency
 * Record. When the record carries no usable session results, a single "no charge
 * transparency records found" result is returned instead.
 *
 * This is exactly the payload the renderer hands to the main process (and, in
 * --nogui / HTTP mode, to the CLI verification service) after a verification. It
 * is kept here as a pure, DOM-free function so the renderer (ChargyApp), the main
 * process and the tests can all share the very same logic instead of mirroring it.
 *
 * The "no records found" message is passed in so the renderer can localize it,
 * while non-UI callers (CLI service, tests) get a sensible English default.
 */
export function toSessionVerificationResults(
    CTR:              IChargeTransparencyRecord,
    noRecordsMessage: string = "No charge transparency records found!"
): ISessionCryptoResult[] | ISessionCryptoResult
{

    const verificationResults = (CTR.chargingSessions ?? [])
                                    .map(session => session.verificationResult)
                                    .filter(isISessionCryptoResult1);

    if (verificationResults.length > 0)
        return verificationResults;

    return {
        status:     SessionVerificationResult.Unvalidated,
        message:    noRecordsMessage,
        certainty:  0
    };

}
