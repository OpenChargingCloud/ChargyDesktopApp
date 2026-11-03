# WWCP POI in Chargy Desktop

The desktop app incorporates the WWCP POI trust, station proof, session,
historical evidence, price, publication witness, live session, observed version,
and trust succession flows from ChargyWebApp. The UI is available through
**Settings → Trust Management**, trust-anchor QR codes and files, and the POI
section of a charging session.

## Dependencies

The integration uses the published `@open-charging-cloud/wwcp-poi@0.2.0`
and `@open-charging-cloud/chargy-core@0.18.0` releases from npm. The exact
versions and tarball integrities are recorded in `package-lock.json`, so a
clean checkout does not need sibling library checkouts. TypeScript remains
pinned to 6.0.3.

## Desktop transport and storage

POI documents requested over the network use the Electron main-process fetch
broker through `src/ts/poiFetch.ts`. The broker enforces URL, DNS, redirect,
timeout and response-size rules. Normal operation requires HTTPS. The existing
`start:testbench` flags allow explicitly configured insecure/private transport
for local tests. Files and QR codes are parsed in the renderer without granting
network trust. Trust anchors, bundled-key exclusions, witness policies,
observed versions and session archives use local IndexedDB stores. The bundled
production-key and publication-witness lists are initially empty; test keys
are not authorized by default.

## Open journal changes

After an authenticated journal transaction commits changed observations, other
renderers of the same installation invalidate pending POI results and recheck
their retained originals under current local authorization. Duplicate observations,
check-time/audit-only changes and aborted writes send no notification. Messages
carry no trusted verdict or replacement state. The selected policy and accepted
original readings/fixed price remain; live requests and polling stop until an
explicit reconnect. An old asynchronous completion cannot restore green POI
consistency. Independent original decoding can finish and receives a fresh check,
so another writer cannot hide a concurrent signed contradiction by cancelling it.

The WebApp-owned Windows Electron regression uses this app's real renderer,
preload and IndexedDB, plus a second renderer in an isolated QA profile. Both
receive genuine signed originals; holder trust is confirmed through the UI.
No main-process IPC permission or production root is widened. After building
Desktop, run from ChargyWebApp with its existing Playwright installation:

```sh
node build-tools/checkDesktopPOIObservations.mjs --desktop ../ChargyDesktopApp
```

The report and screenshot use a temporary directory unless --output-dir is
supplied. The shared Web/Mobile browser suites additionally exercise held meter
crypto, an in-flight live response, duplicate suppression and failed writes.
Native device camera and packaging acceptance remain separate.

## Verification

Run `npm run typecheck`, `npm run test:typecheck`, `npm run lint`, `npm test`
and `npm run pack`. The POI fixtures and tests live under `tests/`. The package
can be smoke-tested from `dist/win-unpacked` by opening Trust Management and
loading `tests/fixtures/TrustAnchors/anchor.json`.

The ChargyWebApp documentation contains the protocol background and browser
screenshots. Those screenshots describe the web layout and are not desktop
screenshots.
