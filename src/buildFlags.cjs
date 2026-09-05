// What this build allows beyond the transport rules that hold everywhere.
//
// A live link document comes from outside and may name any URL at all, so the
// application speaks only encrypted transports (https, wss) and only to hosts
// on the public internet. A test bench needs one or both of those refusals
// lifted - but that is a decision for whoever runs the application, never for
// the document, and never for a setting a user could be talked into flipping
// while the application is open.
//
// The web application decides this at compile time, with webpack's
// DefinePlugin. A desktop application cannot: its main process ships as source
// and is what actually opens the connection, so a constant baked into the
// renderer bundle would leave the two halves free to disagree - the renderer
// deciding to poll and the main process refusing, which looks exactly like a
// bug. Here the main process decides instead, once at startup, and hands the
// answer to the renderer with the rest of its context. There is one source of
// truth and both halves read it.
//
// What replaces "a production build refuses the switch" is `isPackaged`: a
// packaged application never takes these switches, whatever asks. Only a
// checkout being run by a developer can, and only when it says so on the
// command line:
//
//     npm run start:testbench
//     electron . --allow-insecure-transports
//     CHARGY_ALLOW_INSECURE_TRANSPORTS=1 npm start
//
// Kept Electron-free so the boundary can be tested.

const insecureTransportsSwitch       = 'allow-insecure-transports';
const privateNetworkTransportsSwitch = 'allow-private-network-transports';

// The same environment variables the web application takes, so that a
// developer switching between the two applications does not have to remember
// two spellings.
const insecureTransportsVariable       = 'CHARGY_ALLOW_INSECURE_TRANSPORTS';
const privateNetworkTransportsVariable = 'CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS';

// "--allow-insecure-transports", and the "=value" spelling Chromium also
// accepts for its own switches. A bare switch means yes; an explicit value
// means what it says, so a script can pass "=0" without having to build the
// command line conditionally.
function hasCommandLineSwitch(argv, name) {

    if (!Array.isArray(argv))
        return false;

    return argv.some(argument => {

        if (typeof argument !== 'string')
            return false;

        if (argument === `--${name}`)
            return true;

        return argument.startsWith(`--${name}=`) &&
               isAffirmative(argument.slice(name.length + 3));

    });

}

function isAffirmative(value) {
    return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function isRequested(argv, env, switchName, variableName) {

    if (hasCommandLineSwitch(argv, switchName))
        return true;

    const value = env?.[variableName];

    return typeof value === 'string' && isAffirmative(value);

}

/**
 * What this run allows, from what it was started with.
 *
 * `isPackaged` is the gate: a packaged application answers "no" to both,
 * whatever the command line or the environment says. Everything else is a
 * developer's checkout, where the switches mean what they say.
 */
function resolveTransportAllowances({ isPackaged = true, argv = [], env = {} } = {}) {

    if (isPackaged)
        return { insecureTransports: false, privateNetworkTransports: false };

    return {
        insecureTransports:        isRequested(argv, env, insecureTransportsSwitch,       insecureTransportsVariable),
        privateNetworkTransports:  isRequested(argv, env, privateNetworkTransportsSwitch, privateNetworkTransportsVariable)
    };

}

/**
 * What to say about a run that weakens a transport rule, as lines to log.
 *
 * A run with one of these switches on is a test bench, and whoever started it
 * should be able to see that it is - the rule it relaxes is otherwise
 * invisible until a document happens to exercise it. A packaged application
 * never has them on, so this stays quiet where it matters; a switch that was
 * asked for and refused says so too, because silence there is indistinguishable
 * from a switch that was never read.
 */
function transportAllowanceWarnings({ isPackaged = true, argv = [], env = {} } = {}) {

    const warnings  = [];
    const allowed   = resolveTransportAllowances({ isPackaged, argv, env });

    for (const [ allowance, switchName, variableName, description ] of [
        [ 'insecureTransports',       insecureTransportsSwitch,       insecureTransportsVariable,       'unencrypted (http://, ws://) live link transports' ],
        [ 'privateNetworkTransports', privateNetworkTransportsSwitch, privateNetworkTransportsVariable, 'live link transports to hosts on the local network' ]
    ]) {

        if (allowed[allowance])
            warnings.push(`This run allows ${description}. It is a test bench and must not be shipped.`);

        else if (isRequested(argv, env, switchName, variableName))
            warnings.push(`Ignoring --${switchName}: a packaged Chargy never allows ${description}.`);

    }

    return warnings;

}

module.exports = {
    resolveTransportAllowances,
    transportAllowanceWarnings
};
