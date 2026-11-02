# Public trust-succession fixtures

All private keys here are public test seeds. Regenerate with
`npm run fixtures:poi-succession:generate`; do not edit signed data or extend
validity without signing again. Use evaluation time `2026-11-01T00:16:21.000Z`.

- `policy-transition.json`: old and new two-holder identity quorums sign a new
  anchor URL, identity keys, statement and operational certificates. This is the
  experimental compact delegation profile, not a complete RN change history.
- `epoch-transition.json`: an independent epoch-only scenario, signed old final
  checkpoint, deterministic epoch-2 genesis and signed first checkpoint. Do not
  apply both sequence-0 examples consecutively; they are independent worlds.
- `missing-old-quorum.json`, `missing-new-quorum.json`, `tampered-target-url.json`
  and `wrong-genesis.json`: genuinely test the missing authority or altered
  structure. The wrong-genesis wrapper is signed again so rejection is structural.
- `invalid-target-certificate.json`: both transition quorums sign genuinely, but
  an invalid target operational certificate still prevents acceptance.
- `live-price-only-key.json`: a genuine station proof and CPO self-signature do
  not turn a price-only key into an authorized envelope-signing key.
- `live-forged-first.json` and `live-wrong-cpo.json`: valid document signatures
  that cannot establish the proven CPO's authority.
- `live-key-transition.json`, then `live-after-key-transition.json`: genuine
  old/new co-signing, new RNO-attested CPO key set, then the new key used alone.
- `live-key-change-without-cosignature.json` and
  `live-key-change-without-poi.json`: neither requirement can substitute for the other.
- `live-after-policy-transition.json`: follows the key-transition series after
  explicit policy adoption. It retains the original fixed price and includes a
  new real signed end reading and station/checkpoint evidence for its new policy
  interval. Original start/intermediate readings remain byte-for-byte unchanged.

Begin with `POILive/01-start.json`, explicitly accept its two bootstrap identity
holders, then deliver the rotation files through its live endpoint. Apply the
policy certificate through Roaming networks → Verified trust succession before
delivering the final policy-transition envelope. The browser capture performs
this exact flow using the real app, local routes and native IndexedDB.

`vectors.json` is the shared Node-test input, `provenance.json` contains hashes and
test-key seeds. No fixture root is added to production trust. The epoch example
uses a separate browser installation to avoid clearing accepted policy decisions.
