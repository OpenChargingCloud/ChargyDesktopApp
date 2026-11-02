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

## Verification

Run `npm run typecheck`, `npm run test:typecheck`, `npm run lint`, `npm test`
and `npm run pack`. The POI fixtures and tests live under `tests/`. The package
can be smoke-tested from `dist/win-unpacked` by opening Trust Management and
loading `tests/fixtures/TrustAnchors/anchor.json`.

The ChargyWebApp documentation contains the protocol background and browser
screenshots. Those screenshots describe the web layout and are not desktop
screenshots.
