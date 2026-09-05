import { createRequire }          from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

type TransportAllowances = {
    insecureTransports:        boolean;
    privateNetworkTransports:  boolean;
};

type BuildFlagsInput = {
    isPackaged?:  boolean;
    argv?:        Array<string>;
    env?:         Record<string, string>;
};

type BuildFlagsModule = {
    resolveTransportAllowances:  (input?: BuildFlagsInput) => TransportAllowances;
    transportAllowanceWarnings:  (input?: BuildFlagsInput) => Array<string>;
};

const {
    resolveTransportAllowances,
    transportAllowanceWarnings
} = require("../src/buildFlags.cjs") as BuildFlagsModule;

const strict = { insecureTransports: false, privateNetworkTransports: false };

describe("buildFlags - what a run allows", () => {

    test("allows nothing by default, and nothing at all when packaged", () => {

        // A caller that says nothing gets the strict rules, and so does a
        // packaged application - no matter how loudly the command line or the
        // environment asks. This is what replaces the web application's "a
        // production build refuses to take the switch".
        expect(resolveTransportAllowances()).toEqual(strict);
        expect(resolveTransportAllowances({ isPackaged: false })).toEqual(strict);

        expect(resolveTransportAllowances({
            isPackaged:  true,
            argv:        [ "chargy.exe", "--allow-insecure-transports", "--allow-private-network-transports" ],
            env:         { CHARGY_ALLOW_INSECURE_TRANSPORTS: "1", CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS: "1" }
        })).toEqual(strict);

    });

    test("takes each switch from the command line, on its own", () => {

        expect(resolveTransportAllowances({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports" ]
        })).toEqual({ insecureTransports: true, privateNetworkTransports: false });

        expect(resolveTransportAllowances({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-private-network-transports" ]
        })).toEqual({ insecureTransports: false, privateNetworkTransports: true });

        // "npm run start:testbench" is both of them.
        expect(resolveTransportAllowances({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports", "--allow-private-network-transports" ]
        })).toEqual({ insecureTransports: true, privateNetworkTransports: true });

    });

    test("takes the same environment variables as the web application", () => {

        expect(resolveTransportAllowances({
            isPackaged:  false,
            env:         { CHARGY_ALLOW_INSECURE_TRANSPORTS: "1" }
        })).toEqual({ insecureTransports: true, privateNetworkTransports: false });

        expect(resolveTransportAllowances({
            isPackaged:  false,
            env:         { CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS: "true" }
        })).toEqual({ insecureTransports: false, privateNetworkTransports: true });

        // Anything that is not an affirmative is a no, not a yes.
        for (const value of [ "0", "", "no", "false", "please" ])
        {
            expect(resolveTransportAllowances({
                isPackaged:  false,
                env:         { CHARGY_ALLOW_INSECURE_TRANSPORTS: value }
            })).toEqual(strict);
        }

    });

    test("reads a switch only as a switch, never as a prefix of one", () => {

        // "--allow-insecure-transports-please" is not the switch, and neither
        // is a bare word that happens to contain it.
        expect(resolveTransportAllowances({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports-please", "allow-insecure-transports" ]
        })).toEqual(strict);

        // The "=value" spelling Chromium accepts means what it says.
        expect(resolveTransportAllowances({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports=1" ]
        })).toEqual({ insecureTransports: true, privateNetworkTransports: false });

        expect(resolveTransportAllowances({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports=0" ]
        })).toEqual(strict);

    });

    test("says out loud when a run is relaxed, and when a request was refused", () => {

        // A quiet run is the normal one.
        expect(transportAllowanceWarnings({ isPackaged: false })).toEqual([]);
        expect(transportAllowanceWarnings({ isPackaged: true  })).toEqual([]);

        expect(transportAllowanceWarnings({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports" ]
        })).toHaveLength(1);

        expect(transportAllowanceWarnings({
            isPackaged:  false,
            argv:        [ "electron", ".", "--allow-insecure-transports", "--allow-private-network-transports" ]
        })).toHaveLength(2);

        // A switch that was asked for and refused says so too: silence there
        // is indistinguishable from a switch that was never read.
        const refused = transportAllowanceWarnings({
                            isPackaged:  true,
                            argv:        [ "chargy.exe", "--allow-insecure-transports" ]
                        });

        expect(refused).toHaveLength(1);
        expect(refused[0]).toContain("Ignoring");

    });

});
