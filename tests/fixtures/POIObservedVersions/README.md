# Coherent signed observation-history fixtures

All keys are PUBLIC TEST KEYS, inherited from the POI live pilot. Import a fixture
by Drag & Drop and explicitly accept both TA identity holders. Use the fixed
evaluation clock `2026-11-01T00:16:21.000Z`; signed station attestations expire.

`vectors.json` contains revisions 0–3, a competing revision 1, CPO price sequences
0–2, a competing price sequence 1, checkpoints 0–2, a competing checkpoint 1 and
an individually signed later-epoch checkpoint. The last is not an authenticated
epoch transition. `provenance.json` records file hashes and public signing seeds.

`archive-0.chargy`, `archive-1.chargy` and `archive-2.chargy` contain the same genuine
P-256/OCMF start/end readings and CPO-signed fixed price of 0.35 EUR/kWh. Later
checkpoints also include newer offers valid only after the original start. The
selected old station/price has a real inclusion proof into each checkpoint.

Import 2, reload, then import 0: historical signatures, price binding and inclusion
remain valid. A current station request for revision 0 is nevertheless older than
locally observed revision 2.

Import 1, then `checkpoint-fork-1.chargy`: both checkpoints carry genuine RNO quorum
signatures, but disagree at the same epoch/sequence. Returning to 1 must not hide
the conflict. Import 2, then `price-fork-1.chargy`: a later genuine checkpoint
contains a genuinely CPO-signed competing price sequence. Math and inclusion can
be valid while local consistency fails.

Reset only between independent experiments via Settings → Trust Management →
Observed versions. Do not reset while testing persistence of a contradiction.
Reset does not remove accepted keys or archived session evidence.

Regenerate with `npm run fixtures:poi-observations:generate`; this signs all modified
data with public fixture private keys. Do not hand-edit signed data or extend its
validity without resigning. The shared comparison rules never authenticate the
metadata alone; service tests run actual signature, authority and inclusion checks.
