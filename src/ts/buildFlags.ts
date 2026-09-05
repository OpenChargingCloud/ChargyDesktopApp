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

// What this run allows beyond the transport rules that hold everywhere.
//
// A live link document comes from outside and may name any URL at all, so the
// application speaks only encrypted transports and only to hosts on the public
// internet. A test bench needs one or both of those refusals lifted - and that
// is a decision for whoever runs the application, never for the document and
// never for a setting a user could be talked into flipping.
//
// The web application takes that decision at compile time, with webpack's
// DefinePlugin, because there the bundle is the whole application. Here it is
// not: the main process opens the connection and applies these same rules
// again, so a constant baked into this bundle could disagree with the process
// that actually enforces them - the renderer deciding to poll and the main
// process refusing, which looks exactly like a bug.
//
// So the main process decides, once at startup, and hands the answer down with
// the rest of the application context (see src/buildFlags.cjs). This module is
// only what reads it, and what a missing or malformed answer means: no.
//
// A packaged Chargy never allows either of them, whatever asks.

import type { ITransportAllowances } from './liveLinkTrust';

/** What the main process reports about the run, as far as this concerns us. */
export interface IAppContextTransportAllowances {
    transportAllowances?: {
        insecureTransports?:        boolean;
        privateNetworkTransports?:  boolean;
    };
}

/**
 * What this run allows, as the main process resolved it.
 *
 * Anything other than an explicit `true` reads as "not allowed": an older main
 * process that does not send the field at all, a context that arrived
 * malformed. The strict rules are what a missing answer means.
 */
export function transportAllowancesOf(appContext: IAppContextTransportAllowances): ITransportAllowances {

    const allowances = appContext.transportAllowances;

    return {
        insecureTransports:        allowances?.insecureTransports       === true,
        privateNetworkTransports:  allowances?.privateNetworkTransports === true
    };

}

/**
 * What to say about a run that weakens a transport rule.
 *
 * A run with one of these switches on is a test bench, and whoever opens the
 * console should be able to see that it is - the rule it relaxes is otherwise
 * invisible until a document happens to exercise it. The main process says the
 * same thing on its own console; this is the half of the application the user
 * has the developer tools open on.
 */
export function transportAllowanceWarnings(allowances: ITransportAllowances): Array<string> {

    const warnings = new Array<string>();

    if (allowances.insecureTransports === true)
        warnings.push("This run allows unencrypted (http://, ws://) live link transports. It is a test bench and must not be shipped.");

    if (allowances.privateNetworkTransports === true)
        warnings.push("This run allows live link transports to hosts on the local network. It is a test bench and must not be shipped.");

    return warnings;

}
