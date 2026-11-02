# Witnessed-publication fixtures

PUBLIC TEST KEYS ONLY. Drag `session-before-start.chargy` into Chargy, inspect
and import its anchor, then explicitly accept the two test root holders. The
station, original OCMF values, CPO price/assignment and checkpoint verify, while
the publication-witness claim initially remains untrusted.

Under Settings → Trust Management → Publication witnesses, select
`witness-policy.json`, review it, and explicitly accept the organizations and
their clock bounds. Reopen the session: the exact offer is witnessed before its
signed 1 June 2026, 10:00 UTC start. Organization A has two Ed25519 keys and still
counts once; organization B uses ML-DSA-65. The required quorum is two organizations.

`no-receipts.chargy` exercises optional receipt retrieval. `late-receipt`,
`clock-overlap`, `same-organization` and `unknown-witness` cannot meet the pre-start
quorum. `wrong-price`, `wrong-signed-price`, `wrong-tariff`, `wrong-checkpoint`,
`tampered-receipt`, `future-receipt` and
`private-source` are negative examples, without invalidating the genuine CPO price
signatures themselves. Candidate lists never grant local witness authority.

The four `live-00…03` JSON files are a separately signed cumulative live series
with publication before the signed 1 November 2026, 00:05 UTC start. Its price
remains 0.35 EUR/kWh. Related packets must keep their history; the independent
completed/live fixture worlds reuse network/version coordinates and must be
separated using the real Observed versions reset UI or a fresh installation.
Resetting history preserves local anchor/witness decisions.

Generate with `npm run fixtures:poi-publication:generate`. `vectors.json` is also
used by the shared library tests. `provenance.json` records the fixed evaluation
time, public test seeds and generated file hashes. The generator signs every
modified checkpoint, receipt and original live envelope genuinely. It changes no
production trust configuration. These experimental receipts prove no customer
agreement, actual physical start time, continuous availability or globally
latest/sole offer. See the [publication guide](../../../documentation/WWCP-POI-Price-Publication.md).
