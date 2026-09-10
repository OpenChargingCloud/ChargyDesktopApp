# Charge Transparency Live

Fixtures for the charge transparency live link format
(`https://open.charging.cloud/contexts/chargeTransparency/live/link/1.0`).

| Fixture                            | |
| ---------------------------------- | - |
| `ChargeTransparencyLiveLink_1.json`| a full live link: the **final document** of the `OCMF-Test-01` series, byte-identical to `OCMF-Test-01__0034.json`. Generated, not hand-maintained. |
| `ChargeTransparencyLiveLink_2.json`| the minimal form: context, creation timestamp and live transports only |
| `OCMF-Test-01/`                    | the generated 22 kW charging session it comes from, see its own README |

This file collects the conventions that apply to **all** of them. Everything
below is about the format, not about one particular fixture.

## Names shared with a charge transparency record

A live link and a charge transparency record describe different things — one
charging session that is still running against a collection of finished ones —
but they describe them with the same words:

| Property | |
| -------- | - |
| `chargingStationOperator`             | who runs the station, with its `publicKeys` |
| `gridOperator`                        | who runs the grid the station draws from, with its `publicKeys` |
| `chargingStation`                     | `@id`, `geoLocation`, `address`, and the devices below it |
| `chargingStation.EVSE`                | `@id`, `powerType`, `maxPower` |
| `chargingStation.EVSE.energyMeter`    | `@id`, `manufacturer`, `model`, `hardware`, `firmware`, `signatureFormat`, `publicKeys` |
| `chargingStation.EVSE.connector`      | `standard`, `format`, `powerType`, `maxPower`, `cable` |
| `contract`                            | `@id` and `type` of the identification that started the session |
| `chargingPeriods`                     | the tariff element in force and the costs, per period of the session |
| `legallyRelevantLogMessages`          | what happened that a verifier has to know of, e.g. a grid power constraint |

An identifier is `@id` here as it is there, and the containment follows the
hardware: the meter and the connector below the EVSE, the EVSE below the
station, the position on the station rather than in a location of its own.

The cardinality is the one difference that remains. A live link describes
exactly one of each, so these are single objects where a record carries lists
(`chargingStationOperators`, `gridOperators`, `chargingStations`). The two
stay separate document types, and merging them would be wrong: a live link is
one session that has not finished, a record a collection of sessions that
have. What the shared names buy is that nothing has to be renamed when one is
read next to the other, and that an application can show a running session
with the code it already has for a finished one.

## Describing the encodings

A key or a signature is never just "hex". It is a **structure**, put into bytes
by some **serialization**, and those bytes are then turned into **text**.
Naming only the outermost step silently drops the two below it: a public key in
these documents is *SubjectPublicKeyInfo, encoded as DER, encoded as hex* —
three layers, not one.

Such a value is therefore described as an ordered `encodings` pipeline,
**innermost first**. Every entry is applied to the result of the previous one,
so the list reads left to right as "… encoded as … encoded as …":

```json
{
    "keyUsage":  [ "signCTRs" ],
    "algorithm": "ECDSA-secp256r1",
    "encodings": [ "SubjectPublicKeyInfo", "DER", "hex" ],
    "value":     "3059301306072A8648CE3D020106082A8648CE3D0301070342000..."
}
```

Where the notation is used:

| Value                          | `encodings`                                          |
| ------------------------------ | ---------------------------------------------------- |
| `publicKeys[].value`           | `["SubjectPublicKeyInfo", "DER", "hex"]` for EC keys, `["raw", "hex"]` for EdDSA and ML-DSA keys |
| `signatures[].keyId`           | `["SubjectPublicKeyInfo", "DER", "SHA-256", "hex"]` — declared once as `keyIdGeneration` |
| `signatures[].value`           | `["Ecdsa-Sig-Value", "DER", "hex"]` for ECDSA, `["raw", "hex"]` for EdDSA and ML-DSA, which have no ASN.1 layer |
| what `signatures[]` covers     | `["JSON", "JCS", "UTF-8"]`                           |
| `signedMeterValues.values[]`   | `["OCMF", "plain"]`                                  |

`SubjectPublicKeyInfo` is RFC 5280 §4.1.2.7, `PrivateKeyInfo` is PKCS#8
(RFC 5208 §5, renamed `OneAsymmetricKey` in RFC 5958), `Ecdsa-Sig-Value` is the
`SEQUENCE { r INTEGER, s INTEGER }` of RFC 3279 §2.2.3. `DER` is ITU-T X.690,
`JCS` is RFC 8785, `hex`/`base64`/`base64url` are RFC 4648 §8/§4/§5, `PEM` is
RFC 7468.

`plain` is the identity step: an OCMF document is already text, so it is
carried as it is. It is stated rather than omitted, because the alternatives at
that position are real — the same document can travel `base64` encoded, or
inside a QR code.

### Case of hexadecimal values

`hex` does not fix the case of the letters. RFC 4648 spells the base16 alphabet
with uppercase `A`–`F`, but lowercase is just as common in the wild, and both
decode to the same bytes.

**Therefore: every comparison of a `hex` value MUST be case-insensitive.** That
holds for key ids, public key values, signature values and any other `hex`
value in this format. A producer may emit either case — the values in these
fixtures are uppercase, which is presentation, not meaning. A consumer that
compares `hex` with `===` is wrong, even if it happens to work against these
files. ChargyCore already follows this rule where it compares hexadecimal
signatures and public keys.

This applies to `hex` only. In `base64` and `base64url` the case *is*
significant: upper and lower case letters are different symbols with different
values, and comparing them case-insensitively would conflate distinct byte
strings.

**Case-insensitive comparison does not mean case-insensitive content.** A
signature covers bytes, and a hexadecimal value inside the signed content is
part of those bytes. Re-casing it changes them. Measured against
`OCMF-Test-01`:

| Change                                              | Document signature |
| --------------------------------------------------- | ------------------ |
| `keyId` in the signature entry re-cased              | still valid — `signatures` is excluded from the signed data |
| the signature `value` itself re-cased                | still valid — it is the signature, not the signed content |
| a `publicKeys[].value` re-cased                      | **broken** |
| an `SD` inside one of the OCMF documents re-cased    | **broken** — the OCMF document is a signed value of the outer document |

So: normalize case *when comparing two values*, never normalize a document and
then verify it. Canonicalization (JCS) orders and reformats JSON, but it does
not and must not touch the content of a string.

### hex is a convention here, not a rule

These fixtures write every byte string as `hex` because it is the easiest to
read and diff, and because it is what Chargy's existing public key fixtures
use. That is a convention of the fixtures, not a requirement of the format —
`encodings` carries the choice per value precisely so that it can differ.

It starts to matter with post-quantum algorithms, where `hex` costs a third
more than `base64`:

| Algorithm    | Public key | as hex | as base64 | Signature | as hex | as base64 |
| ------------ | ---------: | -----: | --------: | --------: | -----: | --------: |
| ECDSA P-256  |     91 B   |    182 |       124 |   ~71 B   |   ~142 |       ~96 |
| Ed25519      |     44 B   |     88 |        60 |    64 B   |    128 |        88 |
| ML-DSA-44    |  1 312 B   |  2 624 |     1 752 | 2 420 B   |  4 840 |     3 228 |
| ML-DSA-65    |  1 952 B   |  3 904 |     2 604 | 3 309 B   |  6 618 |     4 412 |
| ML-DSA-87    |  2 592 B   |  5 184 |     3 456 | 4 627 B   |  9 254 |     6 172 |

(Public key sizes are the bare key material; an SPKI wrapper adds a few bytes.
Measured with `@noble/post-quantum`, which ChargyCore already depends on.)

An ML-DSA-87 signature is over nine thousand characters in `hex`. Switching
that one value to `["raw", "base64"]` changes nothing else in the document —
and it is also why signatures reference their key by a 64-character id instead
of repeating a 5 184-character key.

### Other cases the same notation covers

| `encodings`                                          | |
| ---------------------------------------------------- | - |
| `["COSE_Key", "CBOR", "base64url"]`                  | a COSE key (RFC 9052 §7) serialized as CBOR (RFC 8949), transported base64url |
| `["SubjectPublicKeyInfo", "DER", "base64", "PEM"]`   | the classic `-----BEGIN PUBLIC KEY-----` file |
| `["PrivateKeyInfo", "DER", "base64", "PEM"]`         | the matching `-----BEGIN PRIVATE KEY-----` file |
| `["ECPoint", "hex"]`                                 | the bare uncompressed point `04 \|\| X \|\| Y` (SEC 1 §2.3.3), i.e. the same key material as SPKI but without the ASN.1 wrapper |
| `["raw", "hex"]`                                     | Ed25519 / Ed448 / ML-DSA keys, which are plain octet strings with no ASN.1 layer at all |

Three properties fall out of writing it this way:

- **The serialization layer is optional.** It only appears when the structure
  is an ASN.1 type. `["raw", "hex"]` has no `DER` entry, and that absence is
  meaningful rather than an omission — which a fixed `format` field cannot
  express.
- **Composite names win where they exist.** `PEM` already means
  "base64 of DER, with armor" and `JWK` already means "a JSON object with
  `kty`/`crv`/`x`/`y`", so they are single entries instead of being taken apart
  again.
- **`algorithm` is redundant for some structures and required for others.**
  A `SubjectPublicKeyInfo` carries `id-ecPublicKey` and `prime256v1` as OIDs
  inside its own bytes; a `raw` key carries nothing, so there the algorithm has
  to be stated next to it.

For comparison, ChargyCore currently describes public keys with two independent
fields, `format` (`PublicKeyFormats.DER` | `PublicKeyFormats.XY`) and
`encoding` (`hex` | `base32` | `base64`). `DER` there means the SPKI case, and
`XY` is not a serialization at all but the coordinate pair in separate `x`/`y`
properties — the structure layer showing through a field meant for the
serialization layer.

## Public keys

Public keys are listed where they belong: the operator ones under
`chargingStationOperator.publicKeys`, the grid operator ones under
`gridOperator.publicKeys`, the meter one under
`chargingStation.EVSE.energyMeter.publicKeys`. Each entry states its
`keyUsage`, its `algorithm`, its `encodings` and its `value`.

The `encodings` of the individual keys are deliberately **not** hoisted to the
document level although they are often identical, because they legitimately may
differ: a raw Ed25519 key can sit next to an EC `SubjectPublicKeyInfo` in the
same list.

## Key ids

How a key id is computed is declared once for the whole document:

```json
"keyIdGeneration": [ "SubjectPublicKeyInfo", "DER", "SHA-256", "hex" ]
```

which is the encodings notation again — a fingerprint is simply a pipeline with
a hash step in it. Hashing the `SubjectPublicKeyInfo` rather than the bare
point binds the algorithm into the identity; `["ECPoint", "SHA-256", "hex"]`
would be the other choice, and the declaration says which one is meant.

Unlike the per-key `encodings`, this one **is** hoisted, and for a reason that
is not "it repeats": it **must not vary**, because ids computed differently
would not be comparable. That is the criterion for hoisting anything to the
document level.

`keyIdGeneration` sits inside the signed content, so the hash algorithm cannot
be swapped for a weaker one after the fact.

### The id is computed over the canonical form

`keyIdGeneration` names the **canonical** form of a key, which is not
necessarily the form the document stores it in. A key listed as
`["raw", "hex"]` still gets the id of its `SubjectPublicKeyInfo`.

This matters as soon as more than one algorithm is in play, and `OCMF-Test-01`
demonstrates it: its Ed25519 operator key is stored raw, because that is the
representation EdDSA and ML-DSA keys usually travel in, yet its id is

```
SHA-256(SubjectPublicKeyInfo) = A2F94A58FB75E25BC2CECDF582819B6D44F3705D0C3BADD6391E9D536D5671E8
SHA-256(raw key material)     = 33B0E501CEB297863D0B5D8FD813DB983C7338CA5596FC29DC61760649670707
```

— the first one. Hashing whatever bytes the document happens to carry would be
easier to implement, but the same key would then have different ids depending
on how it was written down, which defeats the purpose of an identifier. Fixing
one canonical form is what X.509 does with the SubjectKeyIdentifier and what
RFC 7638 does for JWK thumbprints.

The price is that a consumer holding a raw key has to be able to wrap it into
its `SubjectPublicKeyInfo` to compute the id, which needs the algorithm OID.
That is the reason the algorithm is stated next to every key.

## Naming algorithms

Two fields carry an algorithm name, and they name different things:

| Field                  | Names                                                |
| ---------------------- | ---------------------------------------------------- |
| `publicKeys[].algorithm` | the **key type** — `ECDSA-secp256r1`, `EdDSA-Ed25519`, `ML-DSA-65` |
| `signatures[].algorithm` | the **complete signature scheme**, including the digest where the scheme has a separate one — `ECDSA-secp256r1-SHA256`, `EdDSA-Ed25519`, `ML-DSA-65` |

The vocabulary is ChargyCore's `OCMF_SIGNATURE_ALGORITHMS`.

For ECDSA the two differ, because the digest is a free choice that the key does
not determine: the same P-256 key can sign with SHA-256 or SHA-384. For Ed25519
and ML-DSA they coincide, because those schemes fix their hashing internally —
there is no `EdDSA-Ed25519-SHA512` to write. The apparent redundancy for those
algorithms is not a mistake; the fields answer different questions and only
happen to give the same answer.

## Signatures

A document may carry **more than one signature**, over the same signed content,
by different keys and with different algorithms. `OCMF-Test-01` does exactly
that: the operator signs it once with ECDSA and once with Ed25519, which is
also what a migration to post-quantum signatures looks like in practice — the
new algorithm is added alongside the old one before the old one is dropped.

A signature entry names its key by **key id**, not by where the key sits and
not by what it is allowed to do:

```json
{
    "keyId":       "2D5BEE2B13118410C5FF9D6DDC0EEE2E03AB978FA1BC838AEE3655EB7095B9F1",
    "algorithm":   "ECDSA-secp256r1-SHA256",
    "signedData":  {
                       "excludedProperties": [ "signatures" ],
                       "encodings":          [ "JSON", "JCS", "UTF-8" ]
                   },
    "encodings":   [ "Ecdsa-Sig-Value", "DER", "hex" ],
    "value":       "3044..."
}
```

To verify: take the document, **remove** the `signatures` property (remove, not
empty — hence `excludedProperties`), canonicalize the remainder, and check the
signature over those UTF-8 bytes with the key the `keyId` resolves to.
Then check that *that* key is listed with the key usage the position requires.

Canonicalization is **JCS, RFC 8785**: no whitespace, object keys sorted by
UTF-16 code unit, RFC 8259 string escaping, ECMAScript number serialization.
That is what makes the signature independent of the layout of the JSON file, so
these fixtures can stay readable and hand-formatted. ChargyCore's
`canonicalJSONStringify()` produces exactly these bytes.

Since ChargyCore 0.14.0 this check is built in: reading a live link through
`DetectAndConvertContentFormat()` verifies every signature the document
carries — resolving each key by its id, wrapping a raw-stored key into its
`SubjectPublicKeyInfo` form for that — and attaches the outcome to the document
as `signatureVerification` plus non-fatal `warnings`. An unsigned or badly
signed document is reported, never refused.

### Why the key id, and why nothing else

- A structural path such as *"the operator key with key usage `signCTRs`"* is
  not an identifier. It stops being unique the moment the operator has two such
  keys — which is not an edge case but the normal state during a key rotation,
  where the old and the new key are valid side by side.
- A **prefix** of the key would not work either: the first 54 of the 182 hex
  characters are identical for every P-256 `SubjectPublicKeyInfo`, because that
  is the algorithm OID part. A prefix captures exactly the non-distinguishing
  end.
- The **key usage is not stated** by the signature. Which usage is required
  follows from what is signed — a charge transparency record needs `signCTRs`,
  whatever the signature claims. A `keyUsage` in the signature could therefore
  only be redundant or wrong, and would be a second source of truth that can
  disagree with the first.
- The **signer is not stated** either: it follows from where the resolved key
  is listed.
- The full public key inline would work but does not scale: an ML-DSA-87 public
  key is about 2.6 kB, whereas the id stays 64 characters whatever the
  algorithm. This is the same idea as the X.509 SubjectKeyIdentifier
  (RFC 5280 §4.2.1.2), the JWK thumbprint (RFC 7638) and `kid` in JOSE and
  COSE.

## Signed meter values

`signedMeterValues` states once how its values are encoded, so `values` is a
plain list of documents:

```json
"signedMeterValues": {
    "encodings": [ "OCMF", "plain" ],
    "values": [
        "OCMF|{...}|{...}"
    ]
}
```

Format and encoding do not change from one meter value to the next, which is
the same hoisting criterion as for `keyIdGeneration`.

### What ChargyCore reads

Recognizing a live link does not touch this section: `signedMeterValues` is not
part of `IChargeTransparencyLiveLink` and `IsAChargeTransparencyLiveLink()`
never looks at it. It is read on request, by
`Chargy.TryToParseLiveLinkMeterValues()`, which returns the values as an
ordinary charge transparency record — verified with the public keys of the
very same document, and leaving the live link a live link.

The candidate keys are collected from `chargingStationOperator.publicKeys` and
`chargingStation.EVSE.energyMeter.publicKeys`, keeping the entries whose
`keyUsage`, if stated at all, contains `signMeterValues` or
`signEnergyMeterValues`. That is why the meter key and the operator's
`signEnergyMeterValues` key both have to be listed: between them they cover the
start, the intermediate and the end values, and a session signed by two keys
cannot be verified from one of them.

Two of the conventions above are load-bearing for that path, and a document
that ignores either still verifies by hand but yields nothing through
ChargyCore:

- only `encodings[0] == "OCMF"` is read. A value carried as `base64`, or in
  another meter value format, is left alone rather than guessed at.
- a public key whose `encodings` do not end in `hex` is skipped, because `hex`
  is what is passed on to the OCMF parser. This is a real limit on the freedom
  [hex is a convention here, not a rule](#hex-is-a-convention-here-not-a-rule)
  describes: the choice is per value in the format, but not yet in this reader.

Neither is reported. A live link whose keys are written in `base64` is a valid
live link with working transports whose meter values simply do not verify, so
the two limits are worth knowing before a producer exercises the freedom.

## Live transports

A live link describes a charging session that is still running, so it says
where the next version of itself can be had. `liveTransports` lists the ways,
each with a `type` of `https`, `websocket` or `httpSSE` and a list of `urls`.
An entry of that list is either the URL itself or an object carrying it
alongside a `priority` and a `weight`. A `totp` gives the shared secret and the
time step for the one-time password those endpoints expect.

An `https` transport has to be asked, where the other two deliver on their own,
so it may state how often to ask:

```json
{
    "type":    "https",
    "urls":    [ "https://api1.example.com/chargingSessions/OCMF-Test-01/transparency/live?token=abcdef" ],
    "refresh":  10
}
```

`refresh` is a number of **seconds**. **Its absence means 10 seconds**, not
"do not poll": an `https` transport exists to be asked, and a document that
names one without saying how often still wants its readers to see what the
session does next. A value that is not a positive number is treated as absent.

A client clamps what it is told rather than obeying it — the Chargy WebApp
polls no faster than every 5 seconds and no slower than once a day, whatever
the document says.

**Every** transport may state the HTTP headers that belong on every request to
it — an API key its endpoint expects, a tenant selector. An `https` poll, the
opening request of an `httpSSE` stream and the handshake of a `websocket` are
all HTTP requests, and all three can face an endpoint that expects a header:

```json
"customHeaders": {
    "X-Key1":  "headerValue1",
    "X-TOTP":  {
                   "valueProvider":  "TOTP",
                   "parameters":   { "sharedSecret": "abcdefghijklmnopqrstuvwxyz1234567890" }
               }
}
```

#### Header names

A name is an HTTP field name, which RFC 9110 defines as a `token`: one or more
of the characters

    A-Z  a-z  0-9  ! # $ % & ' * + - . ^ _ ` | ~

and nothing else — no spaces, no colons, no non-ASCII, no empty name. HTTP
compares names case-insensitively, so a document that states `X-Key` and
`x-key` states **one** header; which of the two wins is the client's rule, not
this format's (the Chargy WebApp keeps the first).

Some names are legal tokens and still never arrive: a browser refuses to let a
page set `Host`, `Origin`, `Referer`, `Cookie`, `Content-Length`, `Connection`,
`Date`, `Expect`, `Keep-Alive`, `TE`, `Trailer`, `Transfer-Encoding`,
`Upgrade`, `Via`, `Accept-Encoding`, `Accept-Charset`, or anything beginning
with `Proxy-` or `Sec-`. Stating one is asking for something that cannot
happen. Operators should use their own names — `X-…`, `Authorization`, an API
key header their backend defines.

#### Header values

**A value is always a string: the literal text to send.** A JSON object in a
value position is never a value — it is always a **call to a value provider**,
because some values cannot be written into a document at all: a one-time
password would be stale the moment it was. Nothing else is a value; a number, a
boolean, an array or `null` is a mistake, and the entry is dropped.

```json
"X-Key1":  "headerValue1",
"X-TOTP":  { "valueProvider": "TOTP", "parameters": { "sharedSecret": "…" } }
```

| Property | Required | Format | Meaning |
|----------|----------|--------|---------|
| `valueProvider` | yes | string | Which provider computes the value. Compared case-insensitively. |
| `parameters` | no | object | What that provider needs. Its shape belongs to the provider. |

Version 1.0 defines this shape, not the providers themselves. A client that
does not know a provider sends **no header** for it rather than the description
of one, and the request goes out without it.

#### The `TOTP` provider

The one provider the Chargy WebApp implements. It computes the value with
[`@open-charging-cloud/totp`](https://www.npmjs.com/package/@open-charging-cloud/totp),
freshly for **every single request**:

```json
"X-TOTP": {
    "valueProvider": "TOTP",
    "parameters": {
        "sharedSecret":  "abcdefghijklmnopqrstuvwxyz1234567890",
        "validityTime":   30,
        "totpLength":     12,
        "alphabet":      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "hashAlgorithm": "sha256"
    }
}
```

| Parameter | Required | Meaning | Default |
|-----------|----------|---------|---------|
| `sharedSecret` | yes | Shared secret, at least 16 characters, no whitespace | — |
| `validityTime` | no | Slot duration in seconds | `30` |
| `totpLength` | no | Length of the generated token | `12` |
| `alphabet` | no | Characters the token is built from | digits + lower + upper case |
| `hashAlgorithm` | no | `sha256`, `sha384` or `sha512` | `sha256` |

The **moment is not a parameter**: it is always the instant the request is
made. A timestamp taken from a document would freeze the password at whatever
instant it was written, which is the one thing a time-based password must never
be. Of the three passwords the generator returns — previous, current, next —
the current one is sent; the other two exist for a verifier that has to
tolerate a clock difference, and sending them would be the client tolerating
its own. A provider whose parameters do not hold up (no secret, a secret the
generator refuses) contributes no header, and the request still goes out.

#### What a client drops

A client sends only what it can send. The Chargy WebApp drops the individual
entries that fail any rule above — a name that is not a token or one the
browser would refuse, a value that is not visible ASCII, an empty or
implausibly long value, a second spelling of a name already taken, a provider
it does not know — and caps how many headers one document may add to every
request. One unusable entry costs its own header and nothing else: neither the
other headers nor the request. The headers reach the URLs of the transport that
stated them and nothing else, and no redirect carries them anywhere unvetted.

The request says which version the client already has, as
`lastUpdated=<timestamp>` next to whatever the URL already carries, so a server
that keeps track of it can answer with less than the whole document instead of
sending everything again. A server that does not care ignores the parameter.

What comes back replaces the document on screen only if it is **newer**, and
`lastUpdated` is what decides that — the same document, an older one, or one
whose `@id` names a different session changes nothing. Neither does a request
that fails: the transports belong to the operator, and a station that cannot be
reached for a while is not a reason to drop a document that was loaded
successfully.

### What operators must provide: CORS

Transparency software runs in browsers, and a browser only lets a page read a
cross-origin answer when the server allows it. Endpoints behind `https` and
`httpSSE` transports therefore **must** answer with

    Access-Control-Allow-Origin: *

Clients fetch anonymously — no cookies, no ambient credentials; the access
token travels in the URL — so the wildcard is safe and correct here. Without
this header no browser-based verifier can ever read the answer, whatever its
user allows: this is the one thing no client can fix on its own side.
`websocket` transports are not subject to CORS; a server that cares should
check the `Origin` header itself.

A transport that states `customHeaders` needs more than that one header. A
custom header is not on the CORS safelist, so the browser asks before it sends
anything: an `OPTIONS` request to the very same URL, carrying nothing of the
actual request but its description — no cookies, and not the header it is
asking about.

    OPTIONS /chargingSessions/1234567890/transparency/live?token=abcdef HTTP/1.1
    Host: api1.example.com
    Origin: https://chargy.charging.cloud
    Access-Control-Request-Method: GET
    Access-Control-Request-Headers: x-key1

The endpoint has to answer that with a 2xx and no redirect, and it must not
require authentication for it — the preflight has nothing to authenticate with:

    HTTP/1.1 204 No Content
    Access-Control-Allow-Origin:  *
    Access-Control-Allow-Methods: GET, OPTIONS
    Access-Control-Allow-Headers: X-Key1
    Access-Control-Max-Age:       600

`Access-Control-Allow-Headers` has to name **every** header the document
states, compared case-insensitively; `*` is valid here precisely because the
request carries no credentials. `Access-Control-Max-Age` is what keeps a
ten-second poll from paying for a preflight every single time — Chrome caps the
value at 7200 seconds, Firefox at 86400. An endpoint that echoes the `Origin`
instead of answering `*` owes a `Vary: Origin`, or a cache in between will hand
the wrong permission to the next reader.

And the answer to the actual `GET` still needs its own
`Access-Control-Allow-Origin`: a preflight only permits the request to be sent,
it does not make the response readable.

### What a client may do with these URLs

The URLs arrive inside a document from outside, and the signatures do not make
them benign — a malicious operator signs a malicious document flawlessly (see
[What the signatures do not prove](#what-the-signatures-do-not-prove)). A
client is therefore expected to guard the connection:

- only encrypted transports are contacted (`https`, `wss`),
- hosts that are not on the public internet are refused, so a document cannot
  turn the reader's browser into a probe for the network behind their router,
- the `refresh` period is clamped from below — the Chargy WebApp polls no
  faster than every 5 seconds, whatever the document says — and answers are
  capped in size,
- and endpoints the installation has not pre-approved are only contacted with
  the **user's consent**, asked once per origin and remembered: trust on first
  use, revocable at any time. The consent is **per origin**, decided one origin
  at a time even when a single document lists several: approving the operator's
  server a reader recognises does not carry along an attacker's server listed
  beside it.

None of this is configurable at runtime, and no document can ask for an
exception: the rules are what the client is, not what it is set to.

### What a test bench may do, and what it costs

An endpoint under development is often none of those things — it speaks plain
`http`, or it sits on the local network. The Chargy WebApp therefore takes that
decision where such a decision belongs, at **build time**. Not at run time, and
not by mode either: an ordinary development build is exactly as strict as a
production one. Only a build that was explicitly asked for it —

    npm run start:testbench

— relaxes anything, and it relaxes exactly three things:

- `http://` and `ws://` URLs are used at all (`--env insecureTransports`),
- hosts on the local network are reached (`--env privateNetworkTransports`),
- and the page's own Content-Security-Policy adds `http:` and `ws:` to its
  `connect-src`, because the browser is a second gate in front of every rule
  the application applies itself: without this the application would decide to
  poll and the browser would refuse it.

Everything else stays exactly as it is: the consent dialog per origin,
`externalURLs.conf`, the clamped `refresh`, the capped answer size, the refused
redirect, and the validation of the custom headers. An application served from
`localhost` could always talk to `localhost`, with or without this build.

**A production build compiles none of it in.** `npm run build:production`
ignores both switches — the environment variable, the `--env` argument, and
anything else that asks — prints a warning saying so, and keeps its
`connect-src` at `'self' https: wss:`. What is shipped can never speak
plaintext. Between a development and a production build the generated page does
not differ here at all; between either of those and a test bench build it
differs in one token list, the `connect-src`.

The consequence belongs to whoever writes documents, not just to whoever builds
clients: **a document whose transports name `http://`, `ws://` or a
local-network host reloads on a test bench and nowhere else.** In every
deployed client it is refused with a console line and nothing else — no dialog,
no error on screen, because a document that cannot be reloaded is not a broken
document. Such transports are a bench shape, never a published one.

### How the remembered decisions are stored

The remembered decisions are themselves worth protecting, and the Chargy WebApp
stores them the way OpenSSH stores a hashed `known_hosts`: **the origin is not
written down**. Each entry keeps a fresh random salt and the keyed hash of the
origin (`HMAC-SHA-256`, the salt as key), together with the decision, its date,
and the operator name the user saw in the consent dialog as a human-readable
label. The store can still answer *"have I seen this origin?"* — the candidate
arrives in plain text with every live link — but a copy of the store answers
little on its own. The label is the document's claim, not a verified identity
— it is what the user consented under, kept for recognition, and a label that
contains the origin's own hostname is not stored at all, so no name can smuggle
the plain text back in:

- It no longer reveals **where its owner charges**. A list of consented
  live-data origins is a movement profile: which operators, since when. A
  synced browser profile, a backup, or a moment of access to the machine
  should not hand that out.
- It is worthless as a **harvesting target against the operators**. A clear
  text store would double as a curated list of CPO live-data endpoints,
  exactly what address-harvesting attacks collect; a hashed one names no
  server. This is the same reasoning that put hashing into OpenSSH's
  `known_hosts`, where the file had turned into a road map for worms.
- The **per-entry salt** prevents precomputed tables and correlation: the same
  origin hashes differently in every entry and every installation, so two
  stores cannot be matched against each other, and nobody can tell whether two
  readers charge with the same operator.
- The honest limit, the same one OpenSSH has: endpoints on **public lists**
  can still be tested against each entry, one guess at a time. The protection
  is real for what is not publicly enumerable, and it turns "read the file"
  into "brute-force every entry" for everything else.

The hash **algorithm is stored per entry**, so a future switch — say, to
HMAC-SHA512 — needs no migration: new entries simply use the new algorithm,
old ones keep matching with theirs, and an entry whose algorithm a version
does not know is preserved rather than deleted.

Decisions also **expire on disuse**, after six months without use by default;
the settings screen accepts anything from 1 to 120 months, or turns expiry off.
Every time a decision actually decides something — an allowed origin is polled,
a denied one is blocked — its clock restarts, so an entry in regular use never
expires and nobody is asked to re-confirm what they demonstrably still rely on.
What fades is what stopped being used: a stale "always" whose server no longer
appears in any document, entries for endpoints an operator has long since
retired. Idle expiry, not forced re-consent.

Two gates decide this, and they are independent. `externalURLs.conf` is what
the application consults: an origin listed there is polled without a dialog,
and so is the installation's own origin; any other origin prompts the user.
The Content-Security-Policy is what the browser enforces: `connect-src` bounds
which hosts the page may reach at all. A deployment that lists an operator's
hosts in `externalURLs.conf` therefore gives its users no dialog for those
hosts, and one that additionally narrows `connect-src` to the same hosts lets
the browser refuse everything else — including, then, the very origins a trust
dialog might otherwise offer, so on such a deployment approving one has no
effect. The two gates have to agree: a prefix allowed in `externalURLs.conf`
but missing from `connect-src` is refused by the browser rather than by Chargy.

A self-hosting operator whose documents only ever point at its own servers can
close the dialog off entirely with a `mode strict` line in `externalURLs.conf`.
In strict mode an origin no prefix covers is never offered and never polled —
only the listed prefixes and the app's own origin reload — so a driver is never
asked a trust question they cannot judge, and the deployment behaves the same
in every browser regardless of what any user answered before. The operator then
has to list every server its documents reach; an unlisted one simply does not
reload, with only a console message to show for it. The default is `mode open`:
the trust dialog as described above. This shapes only whether Chargy *asks*;
what the browser *permits* is still the `connect-src` gate, and the two are set
independently.

## A series of documents

A live link is not written once. It is published again every time something is
added to it, so what a station produces is a **series** of documents that
describe the same charging session at growing levels of completeness. The first
one has no meter values at all — only `created`, the keys, the time source and
everything else that is known before the session starts. Every later one adds
the meter values that arrived since.

A document without meter values omits `signedMeterValues` **entirely**, rather
than carrying it with an empty `values` array: the property describes how the
meter values are encoded, and with none present there is nothing to describe.
The distinction is worth fixing in one direction or the other, because a
verifier otherwise cannot tell "not started yet" from "malformed".

Three properties tie the series together:

| Property             | |
| -------------------- | - |
| `created`            | when the series began. **Identical in every document of the series.** |
| `lastUpdated`        | when this particular document was written, i.e. when its newest meter value entered it. |
| `updates`            | the document this one supersedes, referenced by its `docRefId`. Absent in the first document, which supersedes nothing. |

`lastUpdated` alone would give the documents a temporal order, which is worth
little: timestamps are written by the same party that writes everything else,
and reordering or dropping a document leaves no trace. `updates` makes the
order cryptographic. Each document names its predecessor by a hash over that
predecessor's exact bytes, so a document cannot be removed from the middle,
inserted, or replaced without breaking the link that points at it.

### docRefId

How a document is referenced is declared once per document:

```json
"docRefIdGeneration": [ "SHA-256", "hex" ]
```

The reference is computed over the document **as a whole, its signatures
included**, canonicalized as everywhere else. That is deliberately *not* the
same input the signatures themselves cover, which excludes `signatures` — and
the difference matters: a document that is re-signed is a different published
version, gets a different `docRefId`, and therefore no longer satisfies the
`updates` of its successor. The reference identifies one published version, not
one payload.

When a document carries `updates`, that value is computed with the
`docRefIdGeneration` **of the document carrying it**, not of the document being
referenced. The two are normally the same and only differ while a series
migrates to another hash, which is exactly when the rule has to be unambiguous.

Stating the procedure instead of fixing it in the specification is again about
**cryptographic agility**. SHA-256 will not be adequate forever, and a format
that hardcodes it needs a new version — and a new verifier — to move on.
A format that declares it needs one changed array: a series can switch to
SHA-512 or SHA-3 mid-flight, later documents state the new pipeline, and every
older document stays verifiable with the pipeline it was written with, without
anyone having to know which specification revision produced it. This is the
same reasoning as behind `keyIdGeneration` and the `encodings` pipelines: the
document says how it was made, so a verifier never has to infer it from a
version number.

### What a later document may contain

The meter values of a series are append-only. Verifying a series therefore also
means checking that no document quietly rewrites history:

- Every value present in a document must be present, **unchanged and at the
  same position**, in every later document.
- The array may only **grow**. It is explicitly allowed to grow by more than
  one value at a time — a station that was offline for a while publishes
  everything it buffered in one go.
- Once a document contains an **end value** (`TX: "E"`), no later document may
  add anything. The session is over; a value appearing afterwards means the
  series is not what it claims to be.
- The tariff list in an OCMF document's `TT` may only **grow**, and the entries
  already there must stay unchanged and in place. It records the tariffs that
  have been in effect so far, so a later document appends to that history and
  never rewrites it — the same append-only rule as for the values themselves.
  See [The tariff texts](OCMF-Test-01/README.md#the-tariff-texts).
- `lastUpdated` must not go backwards.

None of this follows from the signatures. Each document is perfectly signed on
its own; these are rules about the *relationship* between documents, and a
verifier that looks at one document in isolation cannot check them.

## Time source

Every timestamp in a document is only worth as much as the clock behind it, so
the document states where that clock comes from:

```json
"timeSource": {
    "isLegalTime":          true,
    "authority":            "Physikalisch-Technische Bundesanstalt",
    "accuracy":             "+-2 ms",
    "stratum":              2,
    "syncInterval":         "PT1H",
    "lastSynchronization":  "2026-08-28T11:14:27Z",
    "minServers":           2,
    "serversURL":           "https://time.ptb.de/files/ptb-ntp-services.json",
    "servers": [
        { "server": "nts://ptbtime1.ptb.de", "priority": 1 },
        { "server": "nts://ptbtime2.ptb.de", "priority": 1 },
        { "server": "nts://ptbtime4.ptb.de", "priority": 1 },
        { "server": "ntp://ptbtime3.ptb.de", "priority": 2 }
    ]
}
```

The split follows the same criterion as everywhere else: `isLegalTime`, the
`authority`, the achieved `accuracy`, the resulting `stratum`, the sync timing
and `minServers` describe **the clock**, of which there is one, so they sit on
the `timeSource` object; `servers` lists the endpoints it is disciplined by.

### The server URI carries the rest

`server` is a URI whose scheme determines protocol, authentication and default
port, so those do not have to be spelled out per entry:

| Scheme  | Time transfer | Authentication | Default port |
| ------- | ------------- | -------------- | ------------ |
| `ntp://`| NTPv4 (RFC 5905), UDP | none | 123 |
| `nts://`| NTPv4 with NTS extension fields, UDP | NTS (RFC 8915) | NTS-KE on TCP 4460, time transfer on UDP 123 |

A non-default port is written into the URI as usual
(`nts://ptbtime1.ptb.de:4461`).

Note what the `nts://` row makes visible: NTS is **two** exchanges. Key
establishment runs over TLS on TCP port 4460, and the time transfer that
follows is ordinary NTP over UDP, normally on 123, with the negotiated keys in
NTS extension fields. Spelling this out per entry as
`"protocol": "NTPv4", "port": 4460` describes no single wire endpoint and is
simply wrong; the URI names the *service* and leaves the two ports to the
scheme definition. That is the strongest argument for the URI form — it removes
a field combination that cannot be filled in correctly.

Neither `ntp` nor `nts` is an IANA-registered URI scheme, so the table above is
part of this format rather than something a consumer can look up.

Stating the scheme at all matters, not just for brevity: plain NTP is
unauthenticated, so a claim of legal time resting on it is only as good as the
network path. The example deliberately mixes both, which is what a real
deployment with a fallback tends to look like — and it makes the weaker leg
visible instead of hiding it behind a single `isLegalTime: true`.

### serversURL

Time server authorities publish their service lists in machine-readable form —
PTB does so at `https://time.ptb.de/files/ptb-ntp-services.json` — and stations
configure themselves from it instead of carrying a hand-maintained list.
`serversURL` records where that configuration came from. It is named to pair
with the `servers` right below it, in the same spirit as `imageURLs` elsewhere
in the document.

The two are not redundant, and which one a verifier may rely on is worth being
explicit about:

- `servers` is the **record**: the endpoints this station actually used, frozen
  into the document and covered by its signatures.
- `serversURL` is the **provenance**: where that list was configured from. Its
  content lives on someone else's web server, may have changed since, and is
  **not** covered by any signature here — only the URL string itself is.

So a verifier reads `servers`. Fetching `serversURL` is a live network
operation that answers a different question — "does this station use the
servers the authority currently publishes?" — and belongs to the same category
as the other external checks described at the end of this document.

### minServers

`minServers` is how many of the listed servers have to agree before the
resulting time is considered valid; it defaults to **2**. One source cannot be
checked against anything, so a single reachable server is not enough to detect
a falseticker — that is why NTP clients traditionally want several.

The priorities follow from it: three servers share priority 1, so any two of
them satisfy `minServers` and one may drop out without the time becoming
unusable. `ptbtime3` at priority 2 is the last resort, and it is the
unauthenticated one — reaching for it is a visible degradation, not a silent
one.

Where those servers stand matters as much as how many there are. `ptbtime1`,
`ptbtime2` and `ptbtime3` sit at PTB in Braunschweig, `ptbtime4` in Berlin, so
the primary set is not concentrated in one location. Three servers in one
building would satisfy `minServers: 2` on paper and fail together in practice.

`accuracy` uses the same value-with-unit string style as `maxPower` elsewhere
in the document.

## What the signatures do not prove

All of the above is worth being precise about what it buys, because it is less
than it looks.

Every signature in such a document is made by the operator, with keys the
operator itself put into the document. A verifier reading nothing but this file
can therefore establish **consistency**: that the meter values belong together,
that nothing was altered after signing, that each value was signed by the key
it claims. It cannot establish **authenticity**. An operator who wants to
publish fabricated numbers generates a fresh key pair, invents the readings,
signs them, lists its own public keys next to them — and the document verifies
perfectly, in every check described here.

The same holds for everything the document merely asserts. `isLegalTime: true`
is a claim about a clock nobody outside the station can observe;
`"authority": "Physikalisch-Technische Bundesanstalt"` is a string the operator
wrote. Signing them proves that the operator committed to those statements, not
that they are true.

What is missing is a **trust anchor**: something outside the document that
binds the public keys to a specific, calibrated meter and to an accredited
operator. In practice that is a certificate chain or a key registry, the
records of the calibration authority, the conformity documentation of the meter
and the accompanying Eichrecht paperwork. Where the keys come from and who
vouches for them is deliberately **out of scope** for these fixtures — they
demonstrate the document format, not the public key infrastructure it has to be
embedded in.

Cryptography here moves the question from "are these numbers correct?" to "is
this key the right key?". That is a real gain, because the second question has
to be answered once per key instead of once per meter value. It is not the same
as an answer.
