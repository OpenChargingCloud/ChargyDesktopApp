# TrustAnchor fixtures

These are public test artifacts for `@open-charging-cloud/wwcp-poi@0.1.0`.
**Never configure these keys as production trust roots.** The production JSONL
file remains independent and empty.

| File | Purpose |
| --- | --- |
| `compact.txt` | Compact `WWCP/TA-2` representation |
| `url.txt` | Equivalent URL representation with pins, quorum and mirror |
| `anchor.json` | Equivalent standalone JSON TrustAnchor |
| `anchor-response.json` | Equivalent JSON response containing `trustAnchor` |
| `untrusted-claims.json` | Valid anchor with injected local trust and validation claims, which must never be adopted |
| `qr-code.svg`, `qr-code.gif` | Scannable QR images containing `compact.txt` |
| `public-keys.jsonl` | Three public Ed25519 keys: two of holder A and one of holder B |
| `key-statement.json` | Real signatures by all three fixture keys; requires two distinct holders |
| `key-statement-expired.json` | Correctly signed statement that expired on 2 January 2026 |
| `invalid-compact.txt` | Malformed compact representation |
| `invalid-quorum.json` | Quorum larger than the number of holders |
| `duplicate-field.json` | Duplicate JSON quorum field, which must be rejected |
| `station-trust-gateway.json` | Genuine `trust-valid` station proof from WWCP_POI.TS conformance vectors; public test roots, source digest and evaluation time included |

All valid anchor representations have network ID `CHARGY-TA-TEST`, two sources
under reserved `.example` domains and a two-holder quorum. The KeyStatement is
valid from 1 January 2026 through 1 January 2030; tests evaluate it at
`2026-10-31T00:00:00.000Z`, independently of the system clock.

The fixture keys use Ed25519 seeds consisting of 32 repetitions of `0x01`,
`0x02` and `0x03`. These seeds are deliberately public test inputs. Only public
key material and signatures are included in the artifacts. Keys within the
KeyStatement are sorted by thumbprint. Each signature covers the library's
`KeyStatement.signingBytes('Ed25519', keyId)` with that key's corresponding seed.

Automated tests cover shared text/file routing, malformed documents, equivalent
representations, mixed-file rejection, unknown signers, explicit acceptance,
withdrawal, holder-based quorum, scope isolation, signature tampering and validity.

For manual browser testing, use **Paste**, **Load records**, drag and drop or
the camera scanner. Every recognized anchor opens the same preview. Import first,
to download and verify the KeyStatement, then optionally choose **Trust this key …**, inspect the scope and fingerprint,
and explicitly confirm or cancel. Reload to check persistence. Use the Trust
Anchors or Roaming networks settings to withdraw manual trust or delete the
anchor. Manual trust affects signer authorization and quorum; it cannot repair
invalid signatures or expired data. Before Import, no checks or trust controls
should be shown and no network request should be sent.

The reserved `.example` sources deliberately do not serve these fixtures. For
download testing, intercept their `/RNs/CHARGY-TA-TEST/keyStatement` endpoint and
return `key-statement.json`, as browser QA does. Alternatively, serve that path
with CORS on a local test server, adjust the anchor's `urls` and use a test-bench
build that explicitly allows insecure/private-network transports. Keep the network
ID, pins and quorum unchanged. The changed sources intentionally create a separate
local trust configuration. A production build does not allow those local URLs.

Select TrustAnchor files individually. A multi-file selection containing an anchor
is rejected as a whole; no selected files are silently discarded or imported.
