# Complete signed POI live pilot

Generate with `npm run fixtures:poi-live-pilot:generate`. Public test keys only:
the existing P-256 test meter, CPO Ed25519 seed 161 and RNO seeds 42/44. No
production roots are modified. `provenance.json` records evaluation time,
selected price digest and every file's SHA-256.

The positive cumulative sequence is:

1. `00-waiting.json`: original signed live link and station proof, no readings.
2. `01-start.json`: genuine OCMF B at 00:05 UTC; historical and price evidence.
3. `02-intermediate.json`: genuine OCMF C at 00:10 UTC; POI evidence omitted.
4. `03-completed.json`: genuine OCMF E at 00:15 UTC; POI evidence omitted.

Use evaluation clock **2026-11-01T00:16:21Z**. The declared HTTPS endpoint needs a
provider serving this sequence. The browser capture supplies it locally, checks
real transport consent and explicitly authorizes two test holders through the
UI. It then tests update rejection, completion, price pinning and archive export.

| Counterexample/continuation | Expected behavior |
| --- | --- |
| `same-time-fork.json` | Genuine contradictory envelope at the accepted timestamp; reject |
| `replayed-waiting.json` | Replay of an earlier accepted version; reject |
| `bad-predecessor.json` | Genuine envelope names an incorrect predecessor; reject |
| `wrong-evse.json` | Genuine envelope changes EVSE; reject |
| `replaced-start.json` | Genuine envelope and new genuine start replace an accepted original; reject |
| `removed-start.json` | Genuine envelope removes accepted start; reject |
| `invalid-intermediate.json` | Valid envelope contains a tampered meter payload; reject |
| `foreign-meter.json` | Valid envelope and genuine meter signature name another meter; reject |
| `rate-conflict.json` | Genuine signed intermediate states 65 cents instead of the selected 35; reject |
| `invalid-document.json` | Envelope signature corrupted; reject |
| `repriced.json` | A different genuine CPO price proposal; retain original fixed price, show warning and keep the source envelope |
| `repriced-completed.json` | Valid end following the repriced envelope; original fixed price and warning retained |

The price expires before charging ends, deliberately exercising fixed-at-start
binding. The checkpoint is later than the start, so pre-charge publication and
customer consent remain unproven. The imported envelope keys establish document
continuity; their independent CPO authority is not asserted. Meter and price
authority follow the selected POI policy independently.

See [the illustrated live guide](../../../documentation/WWCP-POI-Live-Pilot.md).
