# OCMF-Test-01

A simulated **22 kW AC charging session of 5 minutes** with a new signed meter
reading every 10 seconds, during which the **grid operator limits the power to
6 kW for one minute**, published as a **series of 35 charge transparency live
links**, each signed as a whole and chained to its predecessor.

The conventions this document follows — the `encodings` notation, key ids,
signatures, canonicalization, the case of hexadecimal values — are described
once for all of these fixtures in [../README.md](../README.md). This file only
covers what is specific to `OCMF-Test-01`.

| File                          | |
| ----------------------------- | - |
| `OCMF-Test-01__TEMPLATE.json`     | the input template, hand-maintained, with `{{…}}` placeholders |
| `OCMF-Test-01__LRLMs.json`        | the legally relevant log messages of the session, hand-maintained, with relative times |
| `OCMF-Test-01__0000.json` … `__0034.json` | the generated series, always overwritten |
| `generateOCMFTest01.mjs`      | the generator |
| `privateKey_*.pem`            | the six private keys |
| `publicKey_*.pem`             | the matching public keys |

The generator fills the template once per document of the series:

1. the **public keys**, into the `{{publicKey:<name>}}` placeholders, each in
   the encoding its own entry declares,
2. `{{created}}` — the moment the generator ran, to the second, the same in
   every document — and the time source's `{{lastSynchronization}}`, a fixed
   45 min 32 s earlier,
3. `{{lastUpdated}}` and `{{updates}}` — the latter removed entirely in the
   first document, which supersedes nothing,
4. the **`signedMeterValues`** known at that point, into
   `{{signedMeterValues}}`,
5. the **`chargingPeriods`** begun so far, into `{{chargingPeriods}}`,
6. the **`legallyRelevantLogMessages`** published so far, into
   `{{legallyRelevantLogMessages}}`, each signed by the grid operator,
7. **two signatures over the whole document**, into the empty `signatures`
   array — one ECDSA, one Ed25519.

A property that has nothing to hold yet — no meter value, no period, no
message — is removed rather than left empty.

Everything else — identifiers, position, address, connector, transports, time
source — is taken from the template unchanged, including its layout: the
generator substitutes textually and only re-indents the blocks it inserts.

The time source names four PTB servers: `nts://ptbtime1.ptb.de`,
`nts://ptbtime2.ptb.de` and `nts://ptbtime4.ptb.de` share priority 1, so any
two of them satisfy `minServers: 2`, and `ntp://ptbtime3.ptb.de` is the
unauthenticated last resort at priority 2. `ptbtime4` is the one in Berlin,
which keeps the primary set from sitting in a single building. `serversURL`
points at PTB's own service list at
`https://time.ptb.de/files/ptb-ntp-services.json`.

## The series

The station publishes a new document after every **event** of the session: a
meter reading, or a legally relevant log message. 33 readings and one message
make 35 documents:

| Document                  | Event                               | Meter values | `lastUpdated`         | `updates`            |
| ------------------------- | ----------------------------------- | -----------: | --------------------- | -------------------- |
| `OCMF-Test-01__0000.json` | —                                   |            0 | `created`             | absent               |
| `OCMF-Test-01__0001.json` | start value, +00:00                 |            1 | `created` + 1 s       | docRefId of `__0000` |
| `OCMF-Test-01__0002.json` | reading, +00:10                     |            2 | `created` + 11 s      | docRefId of `__0001` |
| `OCMF-Test-01__0003.json` | reading, +00:20                     |            3 | `created` + 21 s      | docRefId of `__0002` |
| `OCMF-Test-01__0004.json` | power limit announced, +00:24       |            3 | `created` + 25 s      | docRefId of `__0003` |
| `OCMF-Test-01__0005.json` | reading, +00:30                     |            4 | `created` + 31 s      | docRefId of `__0004` |
| …                         | …                                   |            … | …                     | …                    |
| `OCMF-Test-01__0009.json` | extra reading, limit begins, +01:02 |            8 | `created` + 1 min 3 s | docRefId of `__0008` |
| …                         | …                                   |            … | …                     | …                    |
| `OCMF-Test-01__0016.json` | extra reading, limit ends, +02:02   |           15 | `created` + 2 min 3 s | docRefId of `__0015` |
| …                         | …                                   |            … | …                     | …                    |
| `OCMF-Test-01__0034.json` | end value, +05:00                   |           33 | `created` + 5 min 1 s | docRefId of `__0033` |

`created` is the moment the generator ran, to the second, and it is the same
in **every** document of the series: one second before the meter takes its
start reading, which is when `OCMF-Test-01__0001.json` is written. Times
written as `+mm:ss` here and in the log messages file count from that start
reading. From there `lastUpdated` follows the events. The `TM` fields of the
OCMF readings state the same instants in the meter's local time,
`Europe/Berlin`, with the UTC offset in force on the day of the run.

`__0000.json` carries no meter values, and the whole `signedMeterValues`
property is absent rather than present and empty — there is nothing yet whose
encoding could be described. `__0034.json` carries the end value, so a
hypothetical `__0035.json` would
not be allowed to add anything; see [../README.md](../README.md) for the rules
a series has to satisfy.

## The power constraint

`OCMF-Test-01__LRLMs.json` holds the legally relevant log messages of the
session, hand-maintained like the template. Its times are **relative to the
start reading**: `"+00:24"` is 24 seconds after the meter took its start
value, and the generator turns every such time — the message's own
`timestamp` as well as the `start` it announces — into the real timestamp of
the run. Durations such as `"1 min"` stay as they are.

The one message in it is the grid operator's announcement, at +00:24, that the
charging power is limited to 6 kW from +01:02 for one minute. The generator
makes the session follow it:

- at **+00:24** an extra document, `__0004.json`, is published: no new meter
  value, but the announcement under `legallyRelevantLogMessages`, signed by
  both grid operator keys. Every later document carries it, byte for byte,
- at **+01:02** and at **+02:02** the meter takes an **extra reading**, so that
  the limited minute is delimited by signed values, and the station publishes
  a document for each,
- in between, the charging power stays below the limit: 5.69 … 5.98 kW, where
  the intervals around it run at 21 … 23 kW.

The announcement is signed the way the document is: over its canonical form
without its own `signatures`, one ECDSA and one Ed25519 signature, each
referencing its key by `keyId`. Those are the `signGridPowerConstraints` keys
listed under `gridOperator.publicKeys`.

This fixture grows by exactly one value per document, which is the simple case.
The format explicitly allows more than one at a time, and a verifier must not
assume otherwise.

The last document of the series is also written to
`../ChargeTransparencyLiveLink_1.json`, byte for byte: the completed session
*is* the full live link fixture, so there is nothing to keep in sync by hand.
That copy is skipped when `--output` points somewhere else, and can be
suppressed with `--no-live-link`.

## The 33 signed meter values

| `values[]` | Role         | `PG`        | `RD` readings | `TX`     | Signing key                 |
| ---------- | ------------ | ----------- | ------------- | -------- | --------------------------- |
| 0          | start        | `T1`        | 1             | `B`      | `energyMeter`               |
| 1 … 31     | intermediate | `T2` … `T32`| 1 (see below) | `C`, `T` | `cpo_signEnergyMeterValues` |
| 32         | end          | `T33`       | 2             | `B`, `E` | `energyMeter`               |

The readings are ten seconds apart, +00:00 to +05:00, plus the two extra ones
at +01:02 and +02:02 where the power limit begins and ends. Those two are the
tariff changes of the session and carry `TX` = `T` rather than `C` — see
[`TX` = `T` at the tariff changes](#tx--t-at-the-tariff-changes). In every
other respect they are intermediate values like any other.

The **end document carries the start and the end reading**, which is the
classic OCMF transaction document that existing solutions expect. It is signed
with the same key as the start document, so a verifier that only knows the
energy meter public key can still check the complete billing-relevant pair.

Because of that, the start reading appears twice across the series — once in
the start document and once in the end document. Importing all 33 documents at
once therefore yields 34 measurement values, of which the first two are the
same reading.

All OCMF documents share the same `FV`/`GI`/`GS`/`GV`/`MV`/`MM`/`MS`/`MF`/`IS`/
`IL`/`IT`/`ID`/`CT`/`CI`/`CF` values. They differ in `PG`, in `RD` — and in
`TT`, which grows as the tariff changes; see
[The tariff texts](#the-tariff-texts).

## Write modes

The generator controls how much history an intermediate document carries:

| Mode                      | Intermediate document `n` contains                 |
| ------------------------- | -------------------------------------------------- |
| `--individual` (default)  | only its own reading: `[C]`                        |
| `--incremental`           | the whole session so far: `[B, C, …, C]`           |

The start and the end document are unaffected by the mode.

## Power profile

The session is not charged at a constant 22 kW:

- the **first** interval ramps up and stays clearly below the nominal power
  (12.31 kW),
- the **last** interval ramps down (9.04 kW),
- the **limited minute**, +01:02 to +02:02, stays below the 6 kW the grid
  operator allows (5.69 … 5.98 kW),
- the intervals in between fluctuate around 22 kW (21.17 … 22.97 kW), so the
  differences between two consecutive readings are visibly noisy instead of
  being a constant 0.0611 kWh.

Meter 1234.0000 → 1235.5042 kWh, i.e. **1.5042 kWh** over 300 s, mean 18.05 kW.
The fluctuation comes from a seeded PRNG, therefore the reading values are
identical on every run of the generator. Their timestamps are not, see above.

## Charging periods

The document states its `chargingPeriods`, cut wherever the applicable tariff
element changes — here at both ends of the power limit, so the session has
three of them:

| Period | From   | To     | Tariff element                            | Energy     | Cost       |
| ------ | ------ | ------ | ----------------------------------------- | ---------: | ---------: |
| 1      | +00:00 | +01:02 | 0.35 EUR/kWh                              | 0.3586 kWh | 0.1255 EUR |
| 2      | +01:02 | +02:02 | 0.25 EUR/kWh, restricted to `max_power` 6 | 0.0969 kWh | 0.0242 EUR |
| 3      | +02:02 | +05:00 | 0.35 EUR/kWh                              | 1.0487 kWh | 0.3670 EUR |

All three carry the same `chargingTariffId`; what differs is the
`activeChargingTariffElement`, whose `restrictions.max_power` is what makes
the limited minute a period of its own. The lower price during the limit is
an assumption of this fixture, not a rule of the format.

The periods grow with the series: a document lists every period begun so far,
closed — with a `stopTimestamp` — where the session has passed its end, and
the current one still open with its costs still growing. Their boundaries
coincide with signed meter values, as the format asks, which is one reason for
the two extra readings.

### The tariff texts

Every OCMF document states its tariff in `TT`, in the tariff text format of the
Bonner Eichrechtstage — `<profile>;<currency>;<W>;<X>[;<Y>[;<Z>]]`, amounts in
cents. Both tariffs of this session use profile `001` (start fee, energy price,
blocking fee from a given minute); neither has a start fee or a blocking fee,
so only the energy price differs:

| Tariff                | Bonn tariff text     |
| --------------------- | -------------------- |
| 0.35 EUR/kWh          | `001;EUR;0;35;0;0`   |
| 0.25 EUR/kWh (limited)| `001;EUR;0;25;0;0`   |

A blocking fee of zero cents per minute is no blocking fee, whatever minute it
would start in; profile `001` has no shorter form that leaves the fields out.

#### Extending `TT` for a tariff change

**A Bonn tariff text names one tariff. This session has three tariff periods,
so this fixture extends the format: `TT` carries the tariffs that have metered
something so far, separated by a vertical bar and in the order they took
effect.** The list grows with the session:

| From the reading at | `TT`                                                     |
| ------------------- | -------------------------------------------------------- |
| +00:00              | `001;EUR;0;35;0;0`                                        |
| +01:02              | `001;EUR;0;35;0;0｜001;EUR;0;25;0;0`                      |
| +02:02              | `001;EUR;0;35;0;0｜001;EUR;0;25;0;0｜001;EUR;0;35;0;0`    |

(The bars above are drawn wide only so the table stays readable; the field uses
the ordinary `|`.)

Why an extension is needed at all: OCMF carries one `TT` per document, and a
document is not free to describe two prices. A charging session whose tariff
changes therefore has no way to say so — while OCMF itself clearly expects the
case, because it reserves a reading reason for it (`TX` = `T`, see below). The
single-tariff form is the special case of this one: a session that never
changes tariff writes a list of one, which is byte-identical to what the
Bonner Eichrechtstage define.

Three properties are worth stating, because they are what a reader can rely on:

- **The last entry is the tariff in effect** at the document's last reading.
  Everything before it is the history that led there.
- **The entries are tariff periods, not distinct tariffs.** A tariff that comes
  back is written again — which is why the base price appears twice above, and
  why the list is never deduplicated.
- **The list only grows.** Document *n+1* repeats the list of document *n* and
  may append to it, so a reader holding the newest document holds the whole
  history and needs no earlier one.

A boundary reading — the one carrying `TX` = `T` — still closes the interval
metered under the *previous* tariff, so it is the last document of that tariff
and its list is one entry shorter than that of the document after it.

`parseOCMFBonnTariffTexts()` in `src/OCMF_BET_TariffTextExtension.ts` reads the
list; `parseOCMFBonnTariffText()` reads a single entry.

The vertical bar is also what separates the three parts of the OCMF envelope,
but `TT` lives inside the JSON payload, which ChargyCore reads by tracking the
brace depth of the JSON rather than by splitting the envelope on bars. A reader
that does split must take the payload between the **first** and the **last**
bar, never by counting them.

#### `TX` = `T` at the tariff changes

OCMF defines a reading reason for a tariff change, and this fixture uses it:
the readings at +01:02 and +02:02 — both ends of the power limit, where the
meter reads anyway — carry `TX` = `T` instead of `C`. The first reading keeps
`B`, the last keeps `E`.

So the two ways a document tells a reader about the tariff agree with each
other: `TX` = `T` marks *where* the tariff changed, `TT` says *what* it changed
to and what it was before.

#### Not part of the grouping key

`TT` is deliberately **not** part of the key ChargyCore groups OCMF documents
by. It used to be, which split this session in two — the documents metered
under the lower tariff formed a second group, and since only the first group is
returned, seven signed meter values were dropped without a word. Documents
before and after a tariff change belong to one charging session; OCMF says so
itself by having a reading reason for the change.

## Keys## Keys

Six key pairs, each as a private and a public PEM file:

| Key pair                    | Algorithm         | Held by                   | Signs                             |
| --------------------------- | ----------------- | ------------------------- | --------------------------------- |
| `energyMeter`               | `ECDSA-secp256r1` | the energy meter          | the start and the end value       |
| `cpo_signEnergyMeterValues` | `ECDSA-secp256r1` | the charge point operator | the 31 intermediate values        |
| `cpo_signCTRs`              | `ECDSA-secp256r1` | the charge point operator | the whole document                |
| `cpo_signCTRs_Ed25519`      | `EdDSA-Ed25519`   | the charge point operator | the whole document                |
| `ven_signPCs`               | `ECDSA-secp256r1` | the grid operator         | the power constraint announcement |
| `ven_signPCs_Ed25519`       | `EdDSA-Ed25519`   | the grid operator         | the power constraint announcement |

The operator holds **two keys for `signCTRs`** and both sign, so the document
carries two signatures over the same content. That covers three cases that a
single-key fixture cannot: more than one key per key usage (which is the normal
state during a key rotation), two different signature algorithms side by side
(which is what adding a post-quantum algorithm looks like), and a key whose
stored representation differs from the one its id is computed over.

The grid operator (`gridOperator`, `DE*VEN`) holds two keys for
**`signGridPowerConstraints`**, the usage under which it signs power
constraints, and both sign the one announcement of this session. The keys are
listed from the first document on, well before the announcement: a verifier
has to know them before the first constraint arrives, not with it.

How the keys appear in the generated document, and their ids under this
document's `keyIdGeneration` of
`["SubjectPublicKeyInfo", "DER", "SHA-256", "hex"]`:

| Key pair                    | Stored in the document as              | Key id                                                             |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `energyMeter`               | `["SubjectPublicKeyInfo","DER","hex"]` | `0CFEFC81F7537DB1D2B85AE423BFA45835E664D6F4E77021F6ADBC5B83C7E89C` |
| `cpo_signEnergyMeterValues` | `["SubjectPublicKeyInfo","DER","hex"]` | `845352A3A3695B74785A8FED76BA21FBA3670AD63E12A7EB8E95FA2182AA7EC9` |
| `cpo_signCTRs`              | `["SubjectPublicKeyInfo","DER","hex"]` | `2D5BEE2B13118410C5FF9D6DDC0EEE2E03AB978FA1BC838AEE3655EB7095B9F1` |
| `cpo_signCTRs_Ed25519`      | `["raw","hex"]`                        | `A2F94A58FB75E25BC2CECDF582819B6D44F3705D0C3BADD6391E9D536D5671E8` |
| `ven_signPCs`               | `["SubjectPublicKeyInfo","DER","hex"]` | `A6346E58D78BE0C49CCD9CEE3BE21743E4FC51170679F1C16337AF4FF2155693` |
| `ven_signPCs_Ed25519`       | `["raw","hex"]`                        | `A48E0EE1B9BDBE41637EF4059B68B698A0F28948280CD12FEA29800BB53646D6` |

The Ed25519 key is stored **raw**, deliberately: that is the representation
EdDSA and ML-DSA keys usually travel in, and ChargyCore's OCMF verification
requires it for those algorithms. Its id is nevertheless the hash of its
canonical `SubjectPublicKeyInfo` — hashing the stored raw bytes would give
`33B0E501CEB297863D0B5D8FD813DB983C7338CA5596FC29DC61760649670707` instead. See
[../README.md](../README.md) for why the canonical form wins.

The `.pem` files are `["PrivateKeyInfo", "DER", "base64", "PEM"]` and
`["SubjectPublicKeyInfo", "DER", "base64", "PEM"]` respectively, for OpenSSL
and other general-purpose tools.

These are **test keys without any protection** — they exist only to make the
fixtures verifiable and must never be used anywhere else.

## Expected verification result

OCMF does not embed the public key into the signed document, so importing the
OCMF documents on their own yields the measurement status `PublicKeyNotFound`.
Inside this document the keys are present, tagged by `keyUsage`.

## Regenerating

`generateOCMFTest01.mjs` reads the template and writes the whole series next to
itself, overwriting it every time:

    node tests/fixtures/ChargeTransparencyLive/OCMF-Test-01/generateOCMFTest01.mjs

    node tests/fixtures/ChargeTransparencyLive/OCMF-Test-01/generateOCMFTest01.mjs --incremental --template other__TEMPLATE.json --log-messages other__LRLMs.json --output other.json

`--output` names the **base**: `other.json` produces `other__0000.json`,
`other__0001.json` and so on. `--log-messages` names the log messages file,
`OCMF-Test-01__LRLMs.json` next to the generator by default; `--no-log-messages`
runs the session without any, and therefore without a power limit, without the
extra readings, and with a single charging period.

Existing `privateKey_*.pem` files are reused, so the public keys and their key
ids stay stable; only new key pairs are generated when a private key file is
missing. The meter reading values are reproducible, but every run still
rewrites every timestamp — the series is created the moment the generator
runs — and every signature value: ECDSA is randomized by design, and although
Ed25519 is deterministic (RFC 8032), the content it signs is not — the OCMF
documents inside `signedMeterValues` carry ECDSA signatures of their own, and
those are part of the signed content.

Because the documents are chained, a rerun rewrites the whole series: a new
signature on `__0000.json` changes its `docRefId`, which changes the `updates`
of `__0001.json`, and so on down the chain. There is no way to regenerate a
single document of a series in place.

The generator evaluates the `keyIdGeneration` and `docRefIdGeneration`
pipelines of the template and the `encodings` of every public key entry instead
of hard-wiring SHA-256 and SPKI, and aborts if a placeholder is missing, occurs
twice or is left unresolved, if a key entry states an algorithm that does not
match its key pair, if the template lacks `keyIdGeneration` or
`docRefIdGeneration`, if there is no empty `signatures` array, if a log message
has no relative `timestamp` or no empty `signatures` array of its own, or if a
power limit starts before it is announced or ends after the session.
