# Completed charging session with an EVSE proof

Drag **[completed-session-with-evse-proof.chargy](completed-session-with-evse-proof.chargy)**
onto Chargy, or select it with the normal file chooser. It is a PTB-style
container holding genuine signed OCMF start/end documents and a `poiEvidence`
extension with the matching EVSE inclusion proof.

The example contains a **30-minute**, **11 kWh** completed session. Both original
OCMF payloads name EVSE `DE*POI*E1*1` and meter serial `CHARGY-POI-METER-001`.
Their separate ECDSA P-256 signatures use the same DER-SPKI public key that the
EVSE proof includes for that meter. The static tariff is **EUR 0.35/kWh**; both
OCMF tariff texts state the same amount. This is a static tariff demonstration,
not a proof of a dynamic price's applicability or independent publication.

## First use in a fresh browser profile

1. Drop the `.chargy` file. ChargyCore checks both OCMF signatures immediately.
   The POI section initially has no trusted authorization, even though the file
   contains a TrustAnchor, KeyStatement and proof.
2. Select **Inspect supplied TrustAnchor …**. The first dialog shows only anchor
   content and explains that the next step reads the supplied file, without
   contacting its declared network source.
3. Select **Import**. The original supplied KeyStatement is checked and saved.
   Valid signatures do not automatically authorize the two signers.
4. Inspect the fingerprint of each of the **two independent holders**, choose
   **Trust this key …** and explicitly confirm each decision. These are public
   demonstration keys; authorize them only for this example policy.
5. Close the dialog. The selected session's station proof is checked against
   current local trust and time. The green status identifies the EVSE and number
   of included static tariffs. Expand the details for station, meter/key,
   tariff, counted holders, root, Merkle path and original signed data.
6. The separate meter-key result selects that EVSE's meter, verifies its declared
   key identity and rechecks the original OCMF with that key. Expand its details
   for provenance, fingerprints and the new crypto-detail buttons. Historical
   association remains explicitly unproven.

The complete supplied-proof path works **offline**. No source is fetched merely
by dropping the file or accepting the supplied bootstrap. **Load and verify
station proof** is a separate explicit network request, using only sources in
the selected saved policy. `poi.example` is deliberately a documentation host;
the example does not provide a public live server there. A failed refresh cannot
be reported as a successful fresh retrieval.

The same file can be opened again after a reload: local trust is retained and
the proof is reverified. Export preserves the POI evidence as JSON strings to
retain signed decimal precision. The example is for one completed session;
multi-session evidence needs an explicit matching `sessionId` and EVSE, and
competing or contradictory supplied evidence is rejected.

## Freshness and regeneration

The fixture's genuine root attestations have a short validity period (23 hours
after `generatedAt`, recorded in [provenance.json](provenance.json)). The normal
app uses its real current clock and **will reject an expired proof**. There is no
fixture-specific bypass or implicit backdating. Regenerate a fresh demonstration:

```sh
npm run fixtures:poi-session:generate
```

This signs a new example with the same public test keys, using current time. For
a repeatable timestamp, pass `-- --at 2026-11-01T12:00:00.000Z`. ECDSA signatures
can differ between regenerations. Run the session tests and regenerate screenshots
when updating checked-in fixture bytes; provenance hashes must match.

`trust-anchor.txt` and `key-statement.json` are separately inspectable artifacts.
The network/KeyStatement/certificates/attestations are generated through the
WWCP/POI APIs. The proof includes a genuine audit path: a second station
is represented only by its sibling hash. Its commit ID identifies a synthetic
attested demo version, without a change-set history, witnesses or checkpoints.

## Trust and key boundary

The fixture generator uses **public test keys only**: fixed Ed25519 seeds 41/43
for identity keys and 42/44 for certified operational keys, plus the documented
public OCMF test meter key from `ChargeTransparencyLive/OCMF-Test-01`. These are
never bundled production trust roots. The test explicitly verifies key identity,
both original measurement signatures, requested EVSE, meter serial and tariff
inclusion; removing local signer authorization prevents station verification.

Core's original container-key check and the new explicit proven-key recheck
remain separate results. The latter uses a binding recreated from current local
authorization and the original proof; imported validation flags or serialized
bindings never grant authority. This P-256/OCMF pilot proves current association
and checks signatures, not historical installation or tariff applicability.

## Counterexamples

| File | Expected result after the same explicit demo-key authorization |
| --- | --- |
| `container-key-conflict.chargy` | Container key differs; signatures pass with the proven EVSE key; conflict stays visible, including after export/reimport |
| `foreign-meter-key-proof.chargy` | Valid attested station associates another key; original reading signatures fail with it |
| `wrong-meter-proof.chargy` | Valid proof names a different meter serial; no association |
| `ambiguous-meter-keys.chargy` | Valid proof lists two candidates; no automatic trial selection |
| `tampered-end-reading.chargy` | End reading changed without signing again; static proof still passes but measurement signature fails |

The changed station declarations are genuinely re-attested by the public demo
RNO keys. All files and their hashes are listed in `provenance.json`. No private
production keys are involved. See the
[meter-key guide](../../../documentation/WWCP-POI-Meter-Key-Handoff.md).

See [the illustrated feature guide](../../../documentation/WWCP-POI-Session-Integration.md).
