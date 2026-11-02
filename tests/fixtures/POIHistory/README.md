# Archived POI sessions with original signed readings

Start with [archived-session.chargy](archived-session.chargy): Drag & Drop or use
the normal file chooser. It contains a 30-minute, 11 kWh session from 1 June 2026,
10:00–10:30 UTC, EVSE `DE*POI*E1*1`, meter `CHARGY-POI-METER-001`.

Inspect/import the supplied current TrustAnchor/KeyStatement and explicitly
authorize both public demo holders. The historical proof embeds a different old
KeyStatement and operational certificates which expired in June. They are
checked at the original reading times. A real checkpoint from 2 June is signed
by different operational keys and has a genuine one-leaf commit InclusionProof.
A witness signature is supplied but never automatically trusted by the app.

Use **Archive evidence**, then Settings → Trust Management → **Session evidence**
to reopen/recheck, export or delete it. Removing the anchor retains the archive
and removes its authorization. Opening/exporting/reimporting never restores
decisions from the audit snapshot. The full path uses supplied data offline.

| File | Expected result |
| --- | --- |
| `archived-session.chargy` | Original signatures and RNO assignment at signed times pass; commit inclusion passes; independent witness/time pending |
| `expired-bootstrap-session.chargy` | Expired bootstrap can be inspected/imported explicitly as a historical reference; current validity stays expired and each unknown key requires manual trust. No newly issued statement/server is needed |
| `missing-checkpoint.chargy` | Assignment and signatures pass; inclusion remains pending |
| `wrong-period.chargy` | Start reading lies outside the signed attestation interval |
| `conflicting-assignments.chargy` | Different keys are genuinely attested for the same reading time; conflict fails |
| `tampered-checkpoint.chargy` | Modified commit leaf cannot validate against the signed checkpoint |
| `key-rotation.chargy` | Two non-overlapping RNO-attested assignments validate both original signatures with different keys; the container's single key conflicts with the second key; inclusion/succession history deliberately absent |

`trusted-witnesses.json` is test input for an **explicit caller-authorized library
policy**, not a production root list and not an app auto-import. Provenance and
all `.chargy` hashes are in [provenance.json](provenance.json). Public deterministic
Ed25519 demo seeds and existing published P-256 test private keys are identified
there; never use them as production trust roots.

Regenerate with `npm run fixtures:poi-history:generate`. The generator uses the
existing POISession example as its station/bootstrap template and signs all old
documents again; ECDSA signature bytes may differ. Recheck provenance and renew
the historical screenshots after regeneration. This is an experimental
TS-library envelope composing existing WWCP proofs, not a finalized new WWCP
wire schema. It does not prove independent actual time, latest/sole membership,
continuous installation, historical tariff applicability or pre-charge publication.

See [the illustrated implementation guide](../../../documentation/WWCP-POI-Historical-Sessions.md).
