# Session price evidence fixtures

Public test material only. Regenerate with `npm run fixtures:poi-prices:generate`.
No production trust roots are added. Deterministic test seeds and file SHA-256
digests are recorded in `provenance.json`. The meter uses the existing public
P-256 test key; CPO prices and assignments use Ed25519 or ML-DSA-65.

Drop `session-with-price.chargy` into Chargy. Inspect its supplied TrustAnchor,
then explicitly accept the two public test holders. This establishes local
authorization, not customer agreement. The price panel checks genuine CPO
signatures, the historically associated signed start, the exact selected price
and checkpoint inclusion separately. The completed session also contains genuine
signed start/end readings and historical station evidence.

The fixed evaluation clock is **2026-11-01T00:16:21Z**. Charging starts on
1 June at 10:00 UTC and ends thirty minutes later. Its fixed-at-start offer is
active at start but expires after five minutes. The assignment is a CPO
confirmation signed one minute after start. The checkpoint is signed on 2 June.
Neither pre-start publication nor customer consent is asserted. The included
witness remains unauthorized unless the caller supplies an independent policy.

| File | Expected scoped result |
| --- | --- |
| `session-with-price.chargy` | Valid Ed25519 CPO assignment, original start, rate match and inclusion |
| `pqc-price.chargy` | Same checks with genuine ML-DSA-65 CPO signatures |
| `decimal-price.chargy` | Signed `0.3500` retained exactly through parse/display/export |
| `empty-prices.chargy` | Missing price evidence |
| `missing-agreement.chargy` | Valid offer/inclusion, actual session assignment unproven |
| `missing-publication.chargy` | Valid assignment, missing price inclusion |
| `invalid-signature.chargy` | Invalid CPO price signature |
| `wrong-evse.chargy` | Genuine price signature for another EVSE |
| `expired-price.chargy` | Genuine price not active at start |
| `foreign-tariff.chargy` | Genuine price naming a tariff outside this EVSE's references |
| `unauthorized-key.chargy` | RNO-authenticated CPO key without `priceStatements` usage |
| `wrong-session.chargy` | Genuine CPO assignment to a different original-start digest |
| `contract-mode.chargy` | Contract mode requires an additional profile |
| `variable-binding.chargy` | Variable binding requires an additional profile |
| `signed-rate-conflict.chargy` | Genuine 65-cent OCMF start conflicts with genuine 35-cent CPO price |
| `tampered-publication.chargy` | Inclusion's embedded price signature is invalid |
| `checkpoint-fork.chargy` | Genuine station/price checkpoints conflict at the same coordinate |
| `split-price-chain.chargy` | Genuine conflicting price statements at one sequence |
| `broken-price-chain.chargy` | Genuine price chain with an incorrect previous digest |
| `ambiguous-offers.chargy` | Pool and EVSE candidates without a signed selection |
| `conditional-price.chargy` | Conditional tariff elements are explicitly unsupported |

Changed declarations, station roots, attestations, commitments, checkpoints and
meter documents are signed again by the generator. Intentional signature/proof
corruption is limited to the named invalid fixtures. Test outcomes are never
embedded as authority. See the illustrated
[session price guide](../../../documentation/WWCP-POI-Session-Prices.md).
