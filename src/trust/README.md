# Mitgelieferte vertrauenswürdige Public Keys

Die Datei [`trusted-public-keys.jsonl`](trusted-public-keys.jsonl) ist die
versionierte Quelle für die Public Keys, denen diese Chargy-Auslieferung
automatisch vertraut. Sie ist zunächst leer: Es sind keine Produktionsschlüssel
festgelegt. Eine leere Liste bedeutet, dass kein Unterzeichner darüber
autorisiert ist. Testschlüssel werden nicht in die Auslieferung aufgenommen.

## Format und Pflege

UTF-8 ohne BOM, ein vollständiges JSON-Objekt pro Zeile, kein äußeres Array.
Leerzeilen sind erlaubt; Kommentare sind kein JSON und werden abgewiesen.
Ein Eintrag verwendet das Public-Key-Format von `@open-charging-cloud/wwcp-poi`:

| Feld | Inhalt |
| --- | --- |
| `@id` | SHA-256 COSE Key Thumbprint: 64 kleine Hexadezimalzeichen |
| `key` | Öffentlicher COSE-Schlüssel als deterministisches CBOR, Base64-kodiert |
| `holder` | Optional: Schlüsselinhaber; mehrere Schlüssel desselben Inhabers begründen keine zusätzlichen Stimmen |
| `notBefore`, `notAfter` | Optional: Gültigkeitsgrenzen im WWCP-POI-Zeitformat |
| `usages` | Optional: Schlüsselverwendungen gemäß WWCP POI |

Beispiel einer syntaktisch gültigen Zeile mit einem **öffentlichen Testschlüssel**
aus den WWCP-POI-Testvektoren (nicht als Produktionsschlüssel übernehmen):

```jsonl
{"@id":"d4b12cbb4d99d31d4dc27faa2305608e39ae563dc22af5905eb4b5e04943675b","key":"owEBIAYhWCASIqoApgZM7BHnn1eNnDvp9e0uVNSeFKo8x/VhEAnwLg=="}
```

Nur öffentliche Schlüssel eintragen. Die Bibliothek prüft unter anderem
Schlüsselmaterial, Thumbprint und Gültigkeitsfelder. Private oder symmetrische
Schlüssel, doppelte IDs, doppelte JSON-Felder und fehlerhafte Zeilen werden
abgewiesen. Fehlermeldungen nennen Datei und Zeilennummer.

Einträge ergänzen, ändern oder entfernen und die App neu bauen. Die Datei ist
Teil der überprüfbaren Repository-Änderung; ein QR-Code, Import oder externer
Server kann ihren Inhalt nicht ändern. Der spätere Signaturverifier muss
zusätzlich die Gültigkeit und die erlaubte Verwendung eines Schlüssels zur
jeweiligen Prüfzeit berücksichtigen.

## Einbindung in die App

Webpack liest die JSONL-Datei beim Build als `asset/source` ein. Der Loader
[`../../build-tools/trustedPublicKeysLoader.cjs`](../../build-tools/trustedPublicKeysLoader.cjs)
validiert jede Zeile mit demselben Parser wie die App. Bei fehlerhaften
Einträgen schlägt der Build fehl; die Datei darf nicht fehlen. Der Parser
nutzt das vorhandene WWCP-POI-Paket. Die Build-Werkzeuge benötigen wie das
Projekt insgesamt Node.js ab 22.18.0 (native TypeScript-Unterstützung).

[`../ts/bundledTrustedPublicKeys.ts`](../ts/bundledTrustedPublicKeys.ts)
stellt der App die geparsten Public Keys als schreibgeschütztes Array bereit.
Für Vertrauensprüfungen und die Anzahl in der Vorschau wird
`getActiveBundledTrustedPublicKeys(store)` verwendet: Die Funktion entfernt
die vom Nutzer lokal gelöschten Keys aus der mitgelieferten Liste. Bei einem
Speicherfehler schlägt sie fehl, statt die Ausschlüsse zu umgehen.
Der Inhalt wird direkt in das
JavaScript-Bundle eingebettet, ohne zusätzlichen Request und ohne separate
JSONL-Datei, die nach der Auslieferung neben dem Bundle geändert werden könnte.
Änderungen an der JSONL-Datei werden beim nächsten Bundle-Build übernommen.

Die Liste entscheidet über Schlüsselvertrauen. Sie beweist allein weder eine
Signatur über einen gescannten Anchor noch ein erfülltes Quorum. Die drei
Prüfstatus bleiben getrennt; das aktuelle unsignierte QR-Format wird durch
einen passenden Listeneintrag nicht als signiert angezeigt.

## Spätere Zertifikate und Nutzerverwaltung

Unter **Einstellungen → Trust Management → Mitgelieferte Public Keys**
können Nutzer Keys bereits für diese Installation löschen und wiederherstellen.
Die Ausschlüsse liegen in IndexedDB und bleiben nach Neustarts erhalten.
Gespeicherte Trust Anchors sind unter dem benachbarten Punkt **Trust Anchors**
löschbar. Siehe [WWCP POI in der Desktop-App](../../documentation/WWCP-POI-Desktop.md).

JSON-/CBOR-Zertifikate und zusätzliche nutzerverwaltete Einträge werden später
über einen eigenen Parser beziehungsweise Store angebunden. Bis zu dieser Erweiterung
akzeptiert die JSONL-Datei nur das oben beschriebene Public-Key-Format.
Zertifikate werden nicht ungeprüft wie Public Keys behandelt. Die
Normalisierung auf öffentliche Schlüssel und deren Herkunft bleibt von
Speicherung, Benutzeroberfläche und kryptografischer Prüfung getrennt.

Prüfen: `npm run typecheck`, `npm run test:typecheck`, `npm run lint`,
`npm test`, `npm run bundle`.

## Publication witnesses

`publication-witness-policy.json` is the separate build-time policy for witness
organizations, explicit `price-publication-and-time` roles, network scopes,
public keys, validity, clock uncertainty and organization quorum. It intentionally
ships no witness keys. An RNO/CPO key does not automatically receive a witness
role. Never add fixture keys here. Existing POI key restrictions apply; use the
experimental `witnessPublications` usage or an explicitly unrestricted witness key.

Users can review/replace this policy and remove individual witnesses under
Settings → Trust Management → Publication witnesses. A saved explicit policy
overrides the build configuration for that installation. Decisions remain in
the separate `ChargyPOIWitnessTrust` IndexedDB database; receipt/archive imports
never restore them. Policy acceptance authorizes the named organizations and
their clocks, while network retrieval still needs the explicit load action.
See [WWCP POI in the desktop app](../../documentation/WWCP-POI-Desktop.md).
