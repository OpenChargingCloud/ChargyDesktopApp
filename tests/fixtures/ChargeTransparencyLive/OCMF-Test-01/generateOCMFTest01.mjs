//
// Generates the OCMF-Test-01 fixture:
//
//   A 22 kW AC charging session of 5 minutes with a new signed meter reading
//   every 10 seconds, during which the grid operator limits the charging
//   power for one minute. The OCMF documents of the session are:
//
//       - the start value        (RD: B)     signed with the energyMeter key
//       - 31 intermediate values (RD: C,     signed with the
//                                 T at the   cpo_signEnergyMeterValues key
//                                 two tariff
//                                 changes)
//       - the end value          (RD: B, E)  signed with the energyMeter key
//
//   The end document carries the start AND the end reading, which is the
//   classic OCMF transaction document understood by existing solutions.
//
//   The tariff changes with the power limit, so the documents state it in "TT"
//   as a tariff text of the Bonner Eichrechtstage - and, because that format
//   names a single tariff, as the list of the tariffs in effect so far,
//   separated by a vertical bar:
//
//       001;EUR;0;35;0;0
//       001;EUR;0;35;0;0|001;EUR;0;25;0;0
//       001;EUR;0;35;0;0|001;EUR;0;25;0;0|001;EUR;0;35;0;0
//
//   The readings where it changes carry the OCMF reading reason for a tariff
//   change, TX "T". See "The tariff texts" in the README next to this file.
//
//   The power constraint comes from OCMF-Test-01__LRLMs.json, the legally
//   relevant log messages of the session, whose times are relative to the
//   start reading ("+00:24"). The generator turns them into real timestamps,
//   signs every message with both grid operator keys, and lets the session
//   follow them: the meter takes an extra reading when the constraint begins
//   and when it ends, the power in between stays below the limit, and the
//   charging periods are cut at both ends of it.
//
//   Those documents, the log messages, the charging periods and the public
//   keys are filled into the placeholders of OCMF-Test-01__TEMPLATE.json, and
//   the result is signed as a whole by both operator document keys, one ECDSA
//   and one Ed25519.
//
//   The output is not a single file but a SERIES: OCMF-Test-01__0000.json has
//   no meter values yet, __0001.json has the first one, and so on, with one
//   document per event - a reading or a log message - up to the end value.
//   Each document states when it was last updated and references the one it
//   supersedes by the hash of that document, which chains the series together
//   cryptographically.
//
//   Usage:
//
//       node generateOCMFTest01.mjs [--individual|--incremental]
//                                   [--template <file>]
//                                   [--log-messages <file>|--no-log-messages]
//                                   [--output <basename>] [--no-live-link]
//
//   --individual  (default) every intermediate document contains just its own
//                 reading
//   --incremental every intermediate document contains all readings of the
//                 session so far, i.e. the start value and every intermediate
//                 value up to that point
//
//   The charging power is not constant: the first interval ramps up and the
//   last interval ramps down, the intervals in between fluctuate around the
//   nominal 22 kW. The fluctuation comes from a seeded PRNG, so the reading
//   VALUES are identical on every run. Their timestamps are not: the series
//   is created the moment the generator runs, and every timestamp in it
//   follows from that moment. (Nor are the ECDSA signatures, which are
//   randomized by design.)
//

import { generateKeyPairSync, createPrivateKey, createPublicKey, createHash,
         sign as ecdsaSign, verify as ecdsaVerify } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync,
         readFileSync, writeFileSync }                       from "node:fs";
import { join }                                              from "node:path";

const outputDirectory  = import.meta.dirname;

const sessionDuration  = 300;                               // seconds
const readingInterval  = 10;                                // seconds
const startMeterValue  = 1234;                              // kWh
// The series is created the moment the generator runs, and the meter takes
// its start reading one second later. Whole seconds, because that is the
// precision every timestamp of the document has.
const createdTimestamp = Math.floor(Date.now() / 1000) * 1000;
const startTimestamp   = createdTimestamp + 1000;
const timeZone         = "Europe/Berlin";                   // the meter's local time, for the OCMF "TM" fields

// How long before "created" the time source last synchronized. A fixed
// distance, so that it stays plausible against "syncInterval" on every run.
const lastSynchronizationAge = 45 * 60 + 32;                // seconds

const nominalPower     = 22;                                // kW
const rampUpPower      = 12.4;                              // kW, mean power of the first interval
const rampDownPower    =  9.6;                              // kW, mean power of the last interval
const powerNoise       =  1.0;                              // kW, peak deviation while charging
const powerNoiseSeed   = 20260828;

// While the grid operator limits the power, the station aims a little below
// the limit and fluctuates less, so that the limit is never exceeded.
const constrainedPowerMargin = 0.2;                         // kW below the limit
const constrainedPowerNoise  = 0.2;                         // kW, peak deviation while constrained


//#region Command line parameters

const cliArguments  = process.argv.slice(2);

let   writeMode     = "individual";
let   templateFile     = join(outputDirectory, "OCMF-Test-01__TEMPLATE.json");
let   logMessagesFile  = join(outputDirectory, "OCMF-Test-01__LRLMs.json");
let   outputFile       = join(outputDirectory, "OCMF-Test-01.json");

// The live link fixture next to this directory is by definition the final
// document of the series, the one carrying the end meter value. It is only
// written for the default output, so that test runs into other directories
// cannot clobber it.
let   liveLinkFile  = join(outputDirectory, "..", "ChargeTransparencyLiveLink_1.json");

for (let i = 0; i < cliArguments.length; i++)
{
    switch (cliArguments[i])
    {

        case "--individual":
            writeMode     = "individual";
            break;

        case "--incremental":
            writeMode     = "incremental";
            break;

        case "--template":
            templateFile     = cliArguments[++i] ?? templateFile;
            break;

        case "--log-messages":
            logMessagesFile  = cliArguments[++i] ?? logMessagesFile;
            break;

        case "--no-log-messages":
            logMessagesFile  = null;
            break;

        case "--output":
            outputFile    = cliArguments[++i] ?? outputFile;
            liveLinkFile  = null;
            break;

        case "--no-live-link":
            liveLinkFile  = null;
            break;

        default:
            console.error("Unknown parameter: " + cliArguments[i]);
            console.error("Usage: node generateOCMFTest01.mjs [--individual|--incremental] " +
                          "[--template <file>] [--log-messages <file>|--no-log-messages] " +
                          "[--output <basename>] [--no-live-link]");
            process.exit(1);

    }
}

//#endregion


mkdirSync(outputDirectory, { recursive: true });


//#region Key management

function loadOrCreateKeyPair(name, algorithm)
{

    const privateKeyPath = join(outputDirectory, "privateKey_" + name + ".pem");

    if (existsSync(privateKeyPath))
    {
        const privateKey = createPrivateKey(readFileSync(privateKeyPath, "utf8"));
        return { name, algorithm, privateKey, publicKey: createPublicKey(privateKey) };
    }

    const { privateKey, publicKey } = algorithm === "EdDSA-Ed25519"
                                          ? generateKeyPairSync("ed25519")
                                          : generateKeyPairSync("ec", { namedCurve: "prime256v1" });

    return { name, algorithm, privateKey, publicKey };

}

function writeKeyPair(keyPair)
{

    writeFileSync(join(outputDirectory, "privateKey_" + keyPair.name + ".pem"),
                  keyPair.privateKey.export({ type: "pkcs8", format: "pem" }),
                  "utf8");

    writeFileSync(join(outputDirectory, "publicKey_"  + keyPair.name + ".pem"),
                  keyPair.publicKey.export({ type: "spki", format: "pem" }),
                  "utf8");

}

function signBytes(keyPair, data)
{

    // Ed25519 hashes internally, so it takes no separate digest algorithm.
    return keyPair.algorithm === "EdDSA-Ed25519"
               ? ecdsaSign(null,     data, keyPair.privateKey)
               : ecdsaSign("sha256", data, keyPair.privateKey);

}

function verifyBytes(keyPair, data, signature)
{

    return keyPair.algorithm === "EdDSA-Ed25519"
               ? ecdsaVerify(null,     data, keyPair.publicKey, signature)
               : ecdsaVerify("sha256", data, keyPair.publicKey, signature);

}

//#endregion


//#region Applying an encodings pipeline to a public key

function derLengthSize(bytes, index)
{
    return bytes[index] < 0x80 ? 1 : 1 + (bytes[index] & 0x7F);
}

function derLength(bytes, index)
{

    if (bytes[index] < 0x80)
        return bytes[index];

    let length = 0;

    for (let i = 1; i <= (bytes[index] & 0x7F); i++)
        length = length * 256 + bytes[index + i];

    return length;

}

// The byte form of a public key for the given structure.
function publicKeyBytes(publicKey, structure)
{

    const spki = publicKey.export({ type: "spki", format: "der" });

    if (structure === "SubjectPublicKeyInfo")
        return spki;

    // The BIT STRING payload of the SPKI, i.e. the bare key material without
    // its ASN.1 wrapper. This is what EdDSA and ML-DSA keys usually travel as.
    if (structure === "raw")
    {

        // SubjectPublicKeyInfo ::= SEQUENCE { AlgorithmIdentifier, BIT STRING }
        let index = 1 + derLengthSize(spki, 1);

        if (spki[index] !== 0x30)
            throw new Error("The SPKI does not start with an AlgorithmIdentifier!");

        index += 1 + derLengthSize(spki, index + 1) + derLength(spki, index + 1);

        if (spki[index] !== 0x03)
            throw new Error("The SPKI does not contain a BIT STRING!");

        const length = derLength(spki, index + 1);
        const start  = index + 1 + derLengthSize(spki, index + 1);

        if (spki[start] !== 0x00)
            throw new Error("The SPKI BIT STRING has unused bits!");

        return spki.subarray(start + 1, start + length);

    }

    throw new Error("Unsupported public key structure: " + String(structure));

}

// Applies an encodings pipeline such as [ "SubjectPublicKeyInfo", "DER", "hex" ]
// or [ "raw", "hex" ] or [ "SubjectPublicKeyInfo", "DER", "SHA-256", "hex" ]
// to a public key.
function encodePublicKey(publicKey, pipeline)
{

    let index      = 0;
    const structure = pipeline[index++];

    if (structure === "SubjectPublicKeyInfo" && pipeline[index++] !== "DER")
        throw new Error('A "SubjectPublicKeyInfo" must be serialized as "DER"!');

    let bytes = publicKeyBytes(publicKey, structure);

    for (; index < pipeline.length; index++)
    {
        switch (pipeline[index])
        {

            case "SHA-256":    bytes = createHash("sha256").update(bytes).digest();  break;
            case "SHA-384":    bytes = createHash("sha384").update(bytes).digest();  break;
            case "SHA-512":    bytes = createHash("sha512").update(bytes).digest();  break;

            case "hex":        return bytes.toString("hex").toUpperCase();
            case "base64":     return bytes.toString("base64");
            case "base64url":  return bytes.toString("base64url");

            default:
                throw new Error("Unsupported encodings step: " + String(pipeline[index]));

        }
    }

    throw new Error("An encodings pipeline must end with a text encoding!");

}

// The key id is always computed over the CANONICAL form named by
// "keyIdGeneration", no matter how the key itself is stored in the document.
// Hashing the raw key material of an Ed25519 key would yield a different id
// than hashing its SubjectPublicKeyInfo, so the two must not be mixed.
function keyIdOf(publicKey, keyIdGeneration)
{
    return encodePublicKey(publicKey, keyIdGeneration);
}

// The energy meter signs the start and the end value, the charge point
// operator signs the intermediate values and the whole document. The operator
// holds two keys for signing documents, an ECDSA and an Ed25519 one, and both
// sign: heterogeneous keys and more than one key per key usage are the normal
// case, not an edge case.
//
// The grid operator holds two keys of its own, for signing power constraints:
// every legally relevant log message it announces is signed with both.
const keyPairs = [
    loadOrCreateKeyPair("energyMeter",               "ECDSA-secp256r1"),
    loadOrCreateKeyPair("cpo_signEnergyMeterValues", "ECDSA-secp256r1"),
    loadOrCreateKeyPair("cpo_signCTRs",              "ECDSA-secp256r1"),
    loadOrCreateKeyPair("cpo_signCTRs_Ed25519",      "EdDSA-Ed25519"),
    loadOrCreateKeyPair("ven_signPCs",               "ECDSA-secp256r1"),
    loadOrCreateKeyPair("ven_signPCs_Ed25519",       "EdDSA-Ed25519")
];

for (const keyPair of keyPairs)
    writeKeyPair(keyPair);

const keyPairsByName = new Map(keyPairs.map(keyPair => [ keyPair.name, keyPair ]));

const [ energyMeterKeyPair, cpoSignEnergyMeterValuesKeyPair,
        cpoSignCTRsKeyPair, cpoSignCTRsEd25519KeyPair,
        venSignPCsKeyPair,  venSignPCsEd25519KeyPair ] = keyPairs;

//#endregion


//#region Legally relevant log messages

// A relative time in the log messages file, "+mm:ss" or "+hh:mm:ss", counted
// from the start reading of the session. Seconds, or null for any other text.
function parseRelativeTime(text)
{

    const match = typeof text === "string"
                      ? /^\+(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(text)
                      : null;

    return match === null
               ? null
               : Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);

}

// "1 min", "90 s", "2 h": a duration in seconds.
function parseDuration(text)
{

    const match = /^(\d+(?:\.\d+)?)\s*(s|sec|min|h)$/.exec(String(text).trim());

    if (match === null)
        throw new Error("Unsupported duration: " + JSON.stringify(text));

    return Number(match[1]) * { s: 1, sec: 1, min: 60, h: 3600 }[match[2]];

}

// "6 kW": a power in kW.
function parsePower(text)
{

    const match = /^(\d+(?:\.\d+)?)\s*kW$/.exec(String(text).trim());

    if (match === null)
        throw new Error("Unsupported power: " + JSON.stringify(text));

    return Number(match[1]);

}

// The same message with every relative time replaced by the real timestamp,
// wherever it sits: the message's own timestamp as well as the start of the
// constraint it announces.
function resolveRelativeTimes(value)
{

    if (typeof value === "string")
    {
        const seconds = parseRelativeTime(value);
        return seconds === null ? value : utcTimestamp(seconds);
    }

    if (Array.isArray(value))
        return value.map(resolveRelativeTimes);

    if (value !== null && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([ key, entry ]) => [ key, resolveRelativeTimes(entry) ]));

    return value;

}

// The log messages of the session, each with the second it is published at,
// in the order they are published. A power constraint among them says from
// when, for how long, and down to what: the meter takes an extra reading at
// both ends of it, the charging power in between stays below the limit, and
// the charging periods are cut there.
const logMessages      = [];
const powerConstraints = [];

if (logMessagesFile !== null)
{

    const logMessagesJSON = JSON.parse(readFileSync(logMessagesFile, "utf8"));

    if (!Array.isArray(logMessagesJSON))
        throw new Error("The log messages file must contain an array of messages!");

    for (const messageJSON of logMessagesJSON)
    {

        const at = parseRelativeTime(messageJSON.timestamp);

        if (at === null)
            throw new Error('A log message must have a relative "timestamp" such as "+00:24", not ' +
                            JSON.stringify(messageJSON.timestamp) + "!");

        if (!Array.isArray(messageJSON.signatures) || messageJSON.signatures.length !== 0)
            throw new Error('A log message must contain an empty "signatures" array!');

        if (messageJSON.code === "LimitationOfPowerConsumption")
        {

            const start = parseRelativeTime(messageJSON.data?.start);

            if (start === null)
                throw new Error('A power limitation must state a relative "start" such as "+01:02"!');

            const end   = start + parseDuration(messageJSON.data?.duration);

            if (start < at)
                throw new Error("A power limitation cannot start before it is announced!");

            if (end > sessionDuration)
                throw new Error("A power limitation must end before the session does!");

            powerConstraints.push({ announcedAt: at, start, end, maxPower: parsePower(messageJSON.data?.maxPower) });

        }

        logMessages.push({ at, message: resolveRelativeTimes(messageJSON) });

    }

    logMessages.sort((left, right) => left.at - right.at);

}

//#endregion


//#region Meter readings

// The UTC offset of the meter's local time at the given instant, in minutes.
function timeZoneOffsetAt(timestamp)
{

    // "GMT+02:00", "GMT-03:30", or a bare "GMT" when the offset is zero.
    const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
                       .formatToParts(new Date(timestamp))
                       .find(part => part.type === "timeZoneName")
                       .value;

    const match  = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(offset);

    if (match === null)
        throw new Error("Unexpected UTC offset " + offset + " for " + timeZone + "!");

    return match[1] === undefined
               ? 0
               : (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));

}

// Five minutes of charging are not worth simulating a DST change in, so the
// offset at the start of the session serves the whole session.
const timeZoneOffset = timeZoneOffsetAt(startTimestamp);

function formatOCMFTimestamp(offsetSeconds)
{

    const localTime  = new Date(startTimestamp + offsetSeconds * 1000 + timeZoneOffset * 60 * 1000);
    const pad        = (value, length = 2) => String(value).padStart(length, "0");

    const sign       = timeZoneOffset < 0 ? "-" : "+";
    const offset     = Math.abs(timeZoneOffset);

    return pad(localTime.getUTCFullYear(), 4) + "-" +
           pad(localTime.getUTCMonth() + 1)   + "-" +
           pad(localTime.getUTCDate())        + "T" +
           pad(localTime.getUTCHours())       + ":" +
           pad(localTime.getUTCMinutes())     + ":" +
           pad(localTime.getUTCSeconds())     + "," +
           pad(localTime.getUTCMilliseconds(), 3)   +
           sign + pad(Math.floor(offset / 60)) + pad(offset % 60) +
           " S";

}

// Seeded PRNG (mulberry32), so that the meter readings are reproducible.
function createRandom(seed)
{

    let state = seed >>> 0;

    return () => {
        state  = (state + 0x6D2B79F5) >>> 0;
        let t  = Math.imul(state ^ (state >>> 15), state | 1);
        t     ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

}

const random         = createRandom(powerNoiseSeed);

// When the meter reads: every ten seconds, plus once at each end of a power
// constraint, so that the constrained energy is delimited by signed values.
const readingOffsets = [ ...new Set([
                           ...Array.from({ length: sessionDuration / readingInterval + 1 }, (_, i) => i * readingInterval),
                           ...powerConstraints.flatMap(constraint => [ constraint.start, constraint.end ])
                       ]) ].sort((left, right) => left - right);

const readingCount   = readingOffsets.length;
const readings       = [];

// The constraint an interval of the session falls into, if any. An interval
// never straddles one, because the meter reads at both ends of it.
function constraintOf(from, to)
{
    return powerConstraints.find(constraint => constraint.start <= from && to <= constraint.end);
}

// Where the tariff changes. OCMF has a reading reason of its own for this,
// TX "T", and the meter reads at both ends of a power constraint anyway - so
// those readings are the tariff changes of this session: the lower price
// begins when the limit does, and ends with it.
const tariffChangeOffsets = new Set(
    powerConstraints.flatMap(constraint => [ constraint.start, constraint.end ]).
                     filter(offset => offset > 0 && offset < sessionDuration)
);

// The meter is counted in units of 0.1 Wh (1e-4 kWh) to keep the differences
// between two readings exact and free of floating point artefacts.
let   meterValueE4   = Math.round(startMeterValue * 10000);

for (let i = 0; i < readingCount; i++)
{

    if (i > 0)
    {

        const from       = readingOffsets[i - 1];
        const to         = readingOffsets[i];
        const constraint = constraintOf(from, to);

        const meanPower  = constraint !== undefined  ? constraint.maxPower - constrainedPowerMargin
                         : i === 1                   ? rampUpPower
                         : i === readingCount - 1    ? rampDownPower
                         :                             nominalPower;

        const noise      = constraint !== undefined  ? constrainedPowerNoise : powerNoise;
        const power      = meanPower + (2 * random() - 1) * noise;

        meterValueE4    += Math.round(power * (to - from) / 3600 * 10000);

    }

    readings.push({
        "TM":  formatOCMFTimestamp(readingOffsets[i]),
        "TX":  i === 0                                     ? "B"
             : i === readingCount - 1                      ? "E"
             : tariffChangeOffsets.has(readingOffsets[i])  ? "T"
             :                                               "C",
        "RV":  "@@" + (meterValueE4 / 10000).toFixed(4) + "@@",
        "RI":  "1-0:1.8.0*255",
        "RU":  "kWh",
        "RT":  "AC",
        "EF":  "",
        "ST":  "G"
    });

}

function readingValue(reading)
{
    return Number(reading.RV.replaceAll("@", ""));
}

// Mean power of the interval ending at reading i, derived from the readings.
function intervalPower(i)
{

    return i === 0
               ? null
               : (readingValue(readings[i]) - readingValue(readings[i - 1])) * 3600 /
                 (readingOffsets[i] - readingOffsets[i - 1]);

}

//#endregion


//#region Charging periods

// The tariff: one price for energy, and a lower one while the grid operator
// limits the power. A charging period ends wherever the applicable tariff
// element changes, which here is at both ends of a power constraint.
const chargingTariffId = "DE*GEF*T-AC22";
const currency         = "EUR";
const energyPrice      = 0.35;                              // EUR/kWh
const constrainedPrice = 0.25;                              // EUR/kWh while the power is limited

function tariffElementFor(constraint)
{

    return constraint === undefined
               ? { "price_components": [ { "type": "ENERGY", "price": energyPrice,      "step_size": 1 } ] }
               : { "price_components": [ { "type": "ENERGY", "price": constrainedPrice, "step_size": 1 } ],
                   "restrictions":     { "max_power": constraint.maxPower } };

}

// The same two tariffs as an OCMF "TT" field, in the tariff text format of the
// Bonner Eichrechtstage: "<profile>;<currency>;<W>;<X>[;<Y>[;<Z>]]", with every
// amount in cents.
//
// Profile 001 is "start fee, energy price, blocking fee from a given minute".
// Neither of these tariffs has a start fee or a blocking fee, so W, Y and Z are
// zero and only X differs: a blocking fee of zero cents per minute is no
// blocking fee, whatever minute it would start in.
//
// A Bonn tariff text names one tariff, which is all a document needs as long as
// the tariff does not change. This session's does, so "TT" carries the tariffs
// that have metered something so far, separated by a vertical bar and in the
// order they took effect - see parseOCMFBonnTariffTexts() in
// src/OCMF_BET_TariffTextExtension.ts, and "The tariff texts" in the README
// next to this file.
function bonnTariffText(centsPerKWh)
{
    return [ "001", currency, 0, centsPerKWh, 0, 0 ].join(";");
}

const baseTariffText        = bonnTariffText(Math.round(energyPrice      * 100));
const constrainedTariffText = bonnTariffText(Math.round(constrainedPrice * 100));

// Which reading is which, so a document can be placed in the session without
// the readings carrying an offset of their own - they are written into "RD"
// verbatim, and a helper property would travel into the signed payload.
const indexOfReading = new Map(readings.map((reading, index) => [ reading, index ]));

// The "TT" field of one document: every tariff that has metered something by
// its last reading, in the order they took effect.
//
// A reading closes the interval since the reading before it, so a tariff period
// only enters the list once the session has passed its start - the boundary
// reading itself, the one carrying TX "T", still closes the interval under the
// previous tariff and is the last document of it. One reading later the new
// tariff appears at the end of the list.
//
// A tariff that comes back is written again rather than referenced: the entries
// are tariff periods, not distinct tariffs, so a session that returns to its
// base price ends with that price twice in the list.
function tariffTextFor(includedReadings)
{

    const indices = includedReadings.map(reading => indexOfReading.get(reading));
    const last    = readingOffsets[Math.max(...indices)];

    return chargingPeriodDefinitions.
               filter((period, index) => index === 0 || period.start < last).
               map(period => period.constraint === undefined ? baseTariffText : constrainedTariffText).
               join("|");

}

// The periods of the whole session, cut at every constraint boundary.
const periodBoundaries = [ ...new Set([
                             0,
                             ...powerConstraints.flatMap(constraint => [ constraint.start, constraint.end ]),
                             sessionDuration
                         ]) ].sort((left, right) => left - right);

const chargingPeriodDefinitions = periodBoundaries.slice(0, -1).map((start, index) => {
    const end = periodBoundaries[index + 1];
    return { start, end, constraint: constraintOf(start, end) };
});

const readingValueAt = new Map(readingOffsets.map((offset, index) => [ offset, readingValue(readings[index]) ]));

// The charging periods as they stand after the reading at the given offset:
// the ones begun so far, closed where the session has passed their end, the
// current one still open with its costs still growing.
function chargingPeriodsAsOf(offset)
{

    return chargingPeriodDefinitions
               .filter(period => period.start <= offset)
               .map(period => {

                   const closed = period.end <= offset;
                   const energy = Number((readingValueAt.get(Math.min(period.end, offset)) -
                                          readingValueAt.get(period.start)).toFixed(4));
                   const price  = period.constraint === undefined ? energyPrice : constrainedPrice;
                   const cost   = Number((energy * price).toFixed(4));

                   return {
                       "startTimestamp":               utcTimestamp(period.start),
                       ...(closed ? { "stopTimestamp": utcTimestamp(period.end) } : {}),
                       "chargingTariffId":             chargingTariffId,
                       "activeChargingTariffElement":  tariffElementFor(period.constraint),
                       "costs":                        {
                                                           "total":     cost,
                                                           "currency":  currency,
                                                           "energy":    { "amount": energy, "unit": "kWh", "cost": cost }
                                                       }
                   };

               });

}

//#endregion


//#region OCMF document creation

function createOCMFDocument(paginationId, includedReadings, keyPair)
{

    const payload = {
        "FV":  "1.4",
        "GI":  "GraphDefined Charging Station",
        "GS":  "CS-OCMF-TEST-01",
        "GV":  "1.0.0",
        "PG":  "T" + paginationId,
        "MV":  "GraphDefined",
        "MM":  "GD-OCMF-AC22",
        "MS":  "GD-METER-OCMF-TEST-01",
        "MF":  "1.0.0",
        "IS":  true,
        "IL":  "TRUSTED",
        "IF":  [ "RFID_PLAIN" ],
        "IT":  "ISO14443",
        "ID":  "04A9B7C21E5D80",
        "CT":  "EVSEID",
        "CI":  "DE*GEF*E12345678*1",
        "TT":  tariffTextFor(includedReadings),
        "CF":  "1.0.0",
        "RD":  includedReadings
    };

    // OCMF reading values are JSON numbers, but the meter emits them with a
    // fixed resolution of 4 decimals, which JSON.stringify() would truncate.
    const rawPayload  = JSON.stringify(payload).replace(/"@@([0-9.]+)@@"/g, "$1");

    const signature   = ecdsaSign("sha256", Buffer.from(rawPayload, "utf8"), keyPair.privateKey);

    if (!ecdsaVerify("sha256", Buffer.from(rawPayload, "utf8"), keyPair.publicKey, signature))
        throw new Error("Signature of OCMF document " + paginationId + " does not verify!");

    return "OCMF|" + rawPayload + "|" + JSON.stringify({
        "SA":  "ECDSA-secp256r1-SHA256",
        "SE":  "hex",
        "SM":  "application/x-der",
        "SD":  signature.toString("hex").toUpperCase()
    });

}

//#endregion


//#region The OCMF documents of the charging session

const documents = [];

// The start value, signed with the energy meter key.
documents.push({
    "role":      "start",
    "readings":  [ readings[0] ],
    "keyPair":   energyMeterKeyPair
});

// The intermediate values, signed with the CPO meter value key.
for (let i = 1; i < readingCount - 1; i++)
    documents.push({
        "role":      "intermediate",
        "readings":  writeMode === "incremental"
                         ? readings.slice(0, i + 1)
                         : [ readings[i] ],
        "keyPair":   cpoSignEnergyMeterValuesKeyPair
    });

// The end value, signed with the energy meter key. It carries the start AND
// the end reading, which is the classic OCMF transaction document understood
// by existing solutions.
documents.push({
    "role":      "end",
    "readings":  [ readings[0], readings.at(-1) ],
    "keyPair":   energyMeterKeyPair
});

// The encodings are a property of the series, not of a single meter value,
// therefore they are stated once for all of them: every value is an OCMF
// document in its plain textual form, not encoded any further.
const signedMeterValuesEncodings = [ "OCMF", "plain" ];

const signedMeterValueDocuments  = documents.map((document, index) =>
                                       createOCMFDocument(index + 1,
                                                          document.readings,
                                                          document.keyPair));

//#endregion


//#region JSON helpers

// These arrays are short enough to stay on one line, which JSON.stringify()
// would not do.
const inlineArrayProperties = [ "encodings", "keyUsage", "excludedProperties" ];

function renderJSON(value)
{

    let text = JSON.stringify(value, null, 4);

    for (const property of inlineArrayProperties)
        text = text.replace(new RegExp('"' + property + '": \\[[^\\]]*\\]', "g"),
                            match => '"' + property + '": [ ' +
                                     JSON.parse(match.slice(match.indexOf("[")))
                                         .map(entry => JSON.stringify(entry))
                                         .join(", ") + " ]");

    return text;

}

function indentationOf(text, index)
{
    return text.slice(text.lastIndexOf("\n", index) + 1).match(/^[ \t]*/)[0];
}

function indentContinuationLines(text, indentation)
{
    return text.split("\n").map((line, index) => index === 0 ? line : indentation + line).join("\n");
}

// Replaces "{{name}}" by the given JSON text, keeping the layout of the
// template intact.
function fillPlaceholder(text, name, replacement)
{

    const placeholder  = '"{{' + name + '}}"';
    const index        = text.indexOf(placeholder);

    if (index === -1)
        throw new Error("The template does not contain the placeholder " + placeholder + "!");

    if (text.indexOf(placeholder, index + 1) !== -1)
        throw new Error("The template contains the placeholder " + placeholder + " more than once!");

    return text.slice(0, index) +
           indentContinuationLines(replacement, indentationOf(text, index)) +
           text.slice(index + placeholder.length);

}

// Replaces the empty array of the given property by the given JSON text.
function fillEmptyArray(text, property, replacement)
{

    const match = new RegExp('("' + property + '"\\s*:\\s*)\\[\\s*\\]').exec(text);

    if (match === null)
        throw new Error('The template does not contain an empty "' + property + '" array!');

    return text.slice(0, match.index) +
           match[1] +
           indentContinuationLines(replacement, indentationOf(text, match.index)) +
           text.slice(match.index + match[0].length);

}

// RFC 8785 (JCS): no whitespace, object keys sorted by UTF-16 code unit,
// RFC 8259 string escaping, ECMAScript number serialization.
function canonicalJSON(value)
{

    if (value === null)              return "null";
    if (typeof value === "boolean")  return value ? "true" : "false";
    if (typeof value === "string")   return JSON.stringify(value);

    if (typeof value === "number")
    {
        if (!Number.isFinite(value))
            throw new Error("Non-finite numbers are not valid JSON!");
        return JSON.stringify(value);
    }

    if (Array.isArray(value))
        return "[" + value.map(canonicalJSON).join(",") + "]";

    if (typeof value === "object")
        return "{" + Object.keys(value)
                           .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
                           .map(key => JSON.stringify(key) + ":" + canonicalJSON(value[key]))
                           .join(",") + "}";

    throw new Error("Unsupported JSON value of type " + typeof value + "!");

}

//#endregion


//#region Filling the template

const templateText = readFileSync(templateFile, "utf8");
const templateJSON = JSON.parse(templateText);

if (!Array.isArray(templateJSON.keyIdGeneration))
    throw new Error('The template must contain a "keyIdGeneration" pipeline!');

if (!Array.isArray(templateJSON.docRefIdGeneration))
    throw new Error('The template must contain a "docRefIdGeneration" pipeline!');

// Every public key entry states its own "encodings", and the generator honours
// them instead of assuming one representation: an Ed25519 key may well travel
// as raw bytes next to an EC key in SubjectPublicKeyInfo form.
function collectPublicKeyPlaceholders(value, found = [])
{

    if (Array.isArray(value))
        for (const entry of value)
            collectPublicKeyPlaceholders(entry, found);

    else if (value !== null && typeof value === "object")
    {

        const placeholder = /^\{\{publicKey:(.+)\}\}$/.exec(
                                typeof value["value"] === "string" ? value["value"] : ""
                            );

        if (placeholder !== null)
        {

            if (!Array.isArray(value["encodings"]))
                throw new Error("The public key entry " + placeholder[0] + " has no encodings!");

            found.push({ name: placeholder[1], encodings: value["encodings"], algorithm: value["algorithm"] });

        }

        for (const entry of Object.values(value))
            collectPublicKeyPlaceholders(entry, found);

    }

    return found;

}

let baseText     = templateText;
const publicKeys = new Map();

for (const { name, encodings, algorithm } of collectPublicKeyPlaceholders(templateJSON))
{

    const keyPair = keyPairsByName.get(name);

    if (keyPair === undefined)
        throw new Error("The template references an unknown key: " + name);

    if (algorithm !== keyPair.algorithm)
        throw new Error("The template states " + String(algorithm) + " for " + name +
                        ", but that key pair is " + keyPair.algorithm + "!");

    const encoded = encodePublicKey(keyPair.publicKey, encodings);

    publicKeys.set(name, { encodings, value: encoded });
    baseText = fillPlaceholder(baseText, "publicKey:" + name, JSON.stringify(encoded));

}

// When the series began: the moment this run started, identical in every
// document of the series. The last synchronization of the time source sits a
// fixed while before it.
const created = isoTimestamp(createdTimestamp);

baseText = fillPlaceholder(baseText, "created",             JSON.stringify(created));
baseText = fillPlaceholder(baseText, "lastSynchronization", JSON.stringify(isoTimestamp(createdTimestamp - lastSynchronizationAge * 1000)));

// Removes the line carrying the given property, for the properties a document
// does not have yet.
function removeLine(text, needle)
{

    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    const lines   = text.split(newline);
    const index   = lines.findIndex(line => line.includes(needle));

    if (index === -1)
        throw new Error("The template has no line containing " + needle + "!");

    lines.splice(index, 1);

    return lines.join(newline);

}

//#endregion


//#region Document references

// Applies a pipeline such as [ "SHA-256", "hex" ] to a byte string.
function applyBytePipeline(bytes, pipeline)
{

    for (const step of pipeline)
    {
        switch (step)
        {

            case "SHA-256":    bytes = createHash("sha256").update(bytes).digest();  break;
            case "SHA-384":    bytes = createHash("sha384").update(bytes).digest();  break;
            case "SHA-512":    bytes = createHash("sha512").update(bytes).digest();  break;

            case "hex":        return bytes.toString("hex").toUpperCase();
            case "base64":     return bytes.toString("base64");
            case "base64url":  return bytes.toString("base64url");

            default:
                throw new Error("Unsupported pipeline step: " + String(step));

        }
    }

    throw new Error("A pipeline must end with a text encoding!");

}

// The reference to a document is computed over the document AS A WHOLE, its
// signatures included, because it has to identify exactly this published
// version. That is deliberately not the same input as the one the signatures
// cover, which excludes "signatures".
function docRefIdOf(documentJSON)
{
    return applyBytePipeline(Buffer.from(canonicalJSON(documentJSON), "utf8"),
                             templateJSON.docRefIdGeneration);
}

// "YYYY-MM-DDThh:mm:ssZ", the precision every timestamp of the document has.
function isoTimestamp(timestamp)
{
    return new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function utcTimestamp(offsetSeconds)
{
    return isoTimestamp(startTimestamp + offsetSeconds * 1000);
}

//#endregion


//#region Writing the series

const keyIds = new Map(keyPairs.map(keyPair =>
                   [ keyPair.name, keyIdOf(keyPair.publicKey, templateJSON.keyIdGeneration) ]));

// The operator signs with both of its document keys. The signature encodings
// differ because the algorithms do: ECDSA produces an ASN.1 Ecdsa-Sig-Value,
// Ed25519 produces 64 raw bytes with no ASN.1 layer at all.
const documentSigners = [
    { keyPair: cpoSignCTRsKeyPair,         encodings: [ "Ecdsa-Sig-Value", "DER", "hex" ] },
    { keyPair: cpoSignCTRsEd25519KeyPair,  encodings: [ "raw", "hex" ] }
];

// The grid operator signs its log messages the same way, with both of its keys.
const logMessageSigners = [
    { keyPair: venSignPCsKeyPair,          encodings: [ "Ecdsa-Sig-Value", "DER", "hex" ] },
    { keyPair: venSignPCsEd25519KeyPair,   encodings: [ "raw", "hex" ] }
];

// The signatures cover everything but the "signatures" array itself. The
// property is removed, not emptied, and the remainder is canonicalized before
// hashing, so that the signature does not depend on the layout.
function signatureEntries(signers, json, what)
{

    const { signatures, ...signedProperties } = json;

    if (!Array.isArray(signatures) || signatures.length !== 0)
        throw new Error(what + ' must contain an empty "signatures" array!');

    const canonical = Buffer.from(canonicalJSON(signedProperties), "utf8");

    return signers.map(signer => {

        const signature = signBytes(signer.keyPair, canonical);

        if (!verifyBytes(signer.keyPair, canonical, signature))
            throw new Error("The signature of " + signer.keyPair.name + " over " + what + " does not verify!");

        // The key is referenced by its id only: who signed follows from where
        // that key is listed, and which key usage is required follows from
        // what is signed.
        return {
            "keyId":       keyIds.get(signer.keyPair.name),
            "algorithm":   signer.keyPair.algorithm === "EdDSA-Ed25519"
                               ? "EdDSA-Ed25519"
                               : "ECDSA-secp256r1-SHA256",
            "signedData":  {
                               "excludedProperties":  [ "signatures" ],
                               "encodings":           [ "JSON", "JCS", "UTF-8" ]
                           },
            "encodings":   signer.encodings,
            "value":       signature.toString("hex").toUpperCase()
        };

    });

}

// The log messages as published: real timestamps, signed by the grid
// operator. They are signed once, so every document carries the same bytes.
const signedLogMessages = logMessages.map(({ message }) => ({
    ...message,
    "signatures":  signatureEntries(logMessageSigners, message, "a log message")
}));

// What happens during the session, in the order it happens: every reading
// and every log message makes the station publish a new document. A log
// message at the same second as a reading follows that reading.
const events = [
    ...readingOffsets.map((at, index)   => ({ at, kind: "reading",    index })),
    ...logMessages.   map(({ at }, index) => ({ at, kind: "logMessage", index }))
].sort((left, right) => left.at - right.at ||
                        (left.kind === right.kind ? 0 : left.kind === "reading" ? -1 : 1));

const outputBase       = outputFile.replace(/\.json$/i, "");
const writtenDocuments = [];

let previousDocRefId = null;

for (let n = 0; n <= events.length; n++)
{

    let text = baseText;

    // Document n is what the station publishes after event n; document 0 is
    // what it publishes before anything has happened.
    const event        = n === 0 ? null : events[n - 1];
    const valueCount   = events.slice(0, n).filter(entry => entry.kind === "reading").   length;
    const messageCount = events.slice(0, n).filter(entry => entry.kind === "logMessage").length;

    // The moment the newest event entered the document. Before the first one
    // there is nothing to update, so the document still carries its own
    // creation time.
    const lastUpdated = event === null
                            ? created
                            : utcTimestamp(event.at);

    text = fillPlaceholder(text, "lastUpdated", JSON.stringify(lastUpdated));

    // The document this one supersedes, referenced by its hash. The first
    // document of a series supersedes nothing.
    text = n === 0
               ? removeLine(text, '"updates"')
               : fillPlaceholder(text, "updates", JSON.stringify(previousDocRefId));

    // The meter values known so far. Before the first one there are none, and
    // the whole property is absent rather than present and empty: there is
    // nothing yet whose encoding could be described.
    text = valueCount === 0
               ? removeLine(text, '"signedMeterValues"')
               : fillPlaceholder(text, "signedMeterValues", renderJSON({
                     "encodings":  signedMeterValuesEncodings,
                     "values":     signedMeterValueDocuments.slice(0, valueCount)
                 }));

    // The charging periods as of the newest reading, absent before the first.
    text = valueCount === 0
               ? removeLine(text, '"chargingPeriods"')
               : fillPlaceholder(text, "chargingPeriods",
                                 renderJSON(chargingPeriodsAsOf(readingOffsets[valueCount - 1])));

    // The log messages published so far, absent before the first.
    text = messageCount === 0
               ? removeLine(text, '"legallyRelevantLogMessages"')
               : fillPlaceholder(text, "legallyRelevantLogMessages",
                                 renderJSON(signedLogMessages.slice(0, messageCount)));

    const unresolvedPlaceholder = /\{\{[^}]*\}\}/.exec(text);

    if (unresolvedPlaceholder !== null)
        throw new Error("Unresolved placeholder " + unresolvedPlaceholder[0] + " in " + templateFile + "!");

    const entries = signatureEntries(documentSigners, JSON.parse(text), "The template");

    text = fillEmptyArray(text, "signatures", renderJSON(entries));

    const fileName = outputBase + "__" + String(n).padStart(4, "0") + ".json";

    writeFileSync(fileName, text, "utf8");

    const docRefId = docRefIdOf(JSON.parse(text));

    writtenDocuments.push({ n, fileName, lastUpdated, docRefId, event,
                            updates: previousDocRefId, values: valueCount,
                            bytes: Buffer.byteLength(text, "utf8") });

    previousDocRefId = docRefId;

}

// The last document of the series IS the live link fixture.
if (liveLinkFile !== null)
    copyFileSync(writtenDocuments.at(-1).fileName, liveLinkFile);

//#endregion


for (const keyPair of keyPairs)
    console.log(keyPair.name.padEnd(28) + keyPair.algorithm.padEnd(18) +
                "keyId " + keyIds.get(keyPair.name) +
                (publicKeys.has(keyPair.name)
                     ? "   in document as " + JSON.stringify(publicKeys.get(keyPair.name).encodings)
                     : "   not in the document"));

console.log("");
console.log("write mode:  " + writeMode);
console.log("template:    " + templateFile);
console.log("created:     " + created);
console.log("start value: " + readings[0].TM + "   (" + timeZone + ")");
console.log("output:      " + outputBase + "__0000.json ... __" +
            String(events.length).padStart(4, "0") + ".json");
console.log("");

for (const document of writtenDocuments)
    console.log(document.fileName.split(/[\\/]/).pop().padEnd(26) +
                String(document.values).padStart(2) + " meter value(s)  " +
                "lastUpdated " + document.lastUpdated + "  " +
                String(document.bytes).padStart(6) + " bytes  " +
                "docRefId " + document.docRefId.slice(0, 16) + "..." +
                (document.updates === null
                     ? "  updates nothing"
                     : "  updates " + document.updates.slice(0, 16) + "...") +
                (document.event?.kind === "logMessage"
                     ? "  + log message " + logMessages[document.event.index].message.code
                     : ""));

const totalEnergy = readingValue(readings.at(-1)) - readingValue(readings[0]);

console.log("");
console.log("documents:     " + writtenDocuments.length +
            "   meter values: 0 .. " + signedMeterValueDocuments.length +
            "   log messages: " + logMessages.length);
console.log("total energy:  " + totalEnergy.toFixed(4) + " kWh  (mean " +
            (totalEnergy * 3600 / sessionDuration).toFixed(2) + " kW)");

// The numbers the README quotes for the power profile: the ramps, and the
// range while charging, constrained intervals apart from the free ones.
const intervalPowers = readings.map((_, index) => intervalPower(index)).slice(1);
const constrained    = readings.slice(1).map((_, index) => constraintOf(readingOffsets[index], readingOffsets[index + 1]) !== undefined);
const whileFree      = intervalPowers.slice(1, -1).filter((_, index) => !constrained[index + 1]);
const whileLimited   = intervalPowers.filter((_, index) => constrained[index]);

console.log("power profile: ramp up " + intervalPowers[0].toFixed(2) + " kW, " +
            "charging " + Math.min(...whileFree).toFixed(2) + " .. " +
            Math.max(...whileFree).toFixed(2) + " kW, " +
            (whileLimited.length > 0
                 ? "limited " + Math.min(...whileLimited).toFixed(2) + " .. " +
                   Math.max(...whileLimited).toFixed(2) + " kW, "
                 : "") +
            "ramp down " + intervalPowers.at(-1).toFixed(2) + " kW");

for (const constraint of powerConstraints)
    console.log("constraint:    announced at +" + constraint.announcedAt + " s, " +
                "max " + constraint.maxPower + " kW from +" + constraint.start + " s to +" + constraint.end + " s");

for (const period of chargingPeriodsAsOf(sessionDuration))
    console.log("period:        " + period.startTimestamp + " .. " + period.stopTimestamp + "  " +
                period.costs.energy.amount.toFixed(4) + " kWh  " +
                period.costs.total.toFixed(4) + " " + period.costs.currency +
                (period.activeChargingTariffElement.restrictions !== undefined
                     ? "  (max " + period.activeChargingTariffElement.restrictions.max_power + " kW)"
                     : ""));

if (liveLinkFile !== null)
{
    console.log("live link:     " + liveLinkFile);
    console.log("               is a copy of " +
                writtenDocuments.at(-1).fileName.split(/[\\/]/).pop());
}
