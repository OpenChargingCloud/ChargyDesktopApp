# Chargy CLI Mode

Status: 2026-06-15. This document describes the current CLI-related code paths in `src/main.cjs`, `src/cliArguments.cjs`, `src/httpApi.cjs`, `src/applicationMetadata.cjs`, `src/ts/chargyApp.ts`, and the CLI/HTTP tests in `tests/cliArguments.test.ts` and `tests/httpApi.test.ts`.

Chargy can be started with `--nogui` and used as a small CLI-oriented test tool. This does not create a second application. The certified entry point remains the same Electron binary. The cleanup work separates only pure, testable CLI building blocks from the Electron startup code so that the GUI app and CLI mode still share one executable and one verification implementation.

## Basic Usage

Development mode:

```bash
npm run start -- --help
npm run start -- --help --lang=de
npm run start -- --version
npm run start -- --nogui tests/fixtures/OCMF/OCMF-Testdata-01.txt
```

Installed application, schematically:

```bash
chargytransparenzsoftware --help
chargytransparenzsoftware --nogui file1.chargy file2.pem
```

Electron switch names are case-insensitive in practice, so `--noGUI` is accepted like `--nogui`. The code and help text use `--nogui`.

## Architecture

The current direction is "one binary, two startup paths":

- `src/main.cjs` remains the Electron main entry point.
- Early CLI-only decisions such as `--help`, `--version`, argument parsing, and HTTP endpoint parsing are delegated to pure CommonJS helpers.
- These helpers can be tested with Vitest without starting Electron.
- GUI mode and CLI verification mode still run through the same application binary.

The first extracted CLI building blocks are:

```text
src/cliArguments.cjs
src/httpApi.cjs
src/applicationMetadata.cjs
```

`src/cliArguments.cjs` contains the side-effect-free argument parser and help text rendering. `src/httpApi.cjs` contains the Node HTTP handler and server startup wrapper for the CLI HTTP API. `src/applicationMetadata.cjs` contains shared application metadata such as edition, copyright, package version, and `package.json`. These modules are used by `src/main.cjs`; the tests read the same metadata module so the expected help output does not duplicate the version, edition, or copyright strings.

The parser, help contract, and HTTP routing contract are covered by:

```text
tests/cliArguments.test.ts
tests/httpApi.test.ts
```

This is intentionally not a standalone CLI app. It is a shared contract module used by the Electron main process.

## Implemented Options

### `--help`

Prints the main help text and exits before creating a BrowserWindow.

```bash
npm run start -- --help
```

The help text currently documents:

- `--help`
- `--lang=de|en`
- `--inspect`
- `--nogui`
- `--http[=host:port]`

This path is now covered by parser/help text tests and by a local Electron smoke check.

### `--lang`

Sets the CLI language for early CLI output such as `--help` and `--help output`.

```bash
npm run start -- --help --lang=de
npm run start -- --help --lang=en
npm run start -- --help output --lang=de
```

`--lang` is the only documented language option. The currently supported language values are:

- `de`
- `en`

The explicit CLI parameter wins over environment defaults. Unsupported explicit values fall back to `en`. When no CLI language is set, the CLI parser checks the usual process locale variables in this order:

1. `LC_ALL`
2. `LC_MESSAGES`
3. `LANG`

Values such as `de_DE.UTF-8` are normalized to `de`. Unsupported languages fall back to `en`.

This is the CLI equivalent of the browser language used by the GUI. A browser exposes `navigator.language` and `navigator.languages`; a command-line process usually gets its default locale through environment variables instead.

`--lang` is intentionally not forwarded to the normal GUI startup path. The GUI continues to choose its own language from the stored UI preference and the Electron renderer/browser language. This keeps a CLI-only setting from unexpectedly changing the interactive app.

CLI translations live in `src/i18n_CLI.json`. The GUI/WebApp translations remain in `src/i18n.json`, which avoids coupling CLI help maintenance to the shared GUI dictionary.

The same CLI language is also passed to the CLI HTTP API as its default language. Individual HTTP requests can override that default with the standard `Accept-Language` request header. Human-readable `/verify` status texts such as `Valid signature` are translated through `src/i18n_CLI.json`.

### `--help output`

Prints a help topic for output formats.

```bash
npm run start -- --help output
```

The topic still describes `text`, `csv`, `json`, `xml`, and `chargy`, but these output formats are not implemented yet. The help text now says this explicitly.

### `--version`

Prints `app.getVersion()` and exits before creating a BrowserWindow.

```bash
npm run start -- --version
```

This path is now covered by argument parsing tests and by a local Electron smoke check.

### `--inspect`

Enables debug mode. Without `--nogui`, the main process opens DevTools after the window has loaded.

```bash
npm run start -- --inspect
```

When files are passed together with `--inspect`, the main process is intended to print verification results via `setVerificationResult`. That path currently depends on the same renderer callback as `--nogui`.

### `--nogui`

Starts Chargy without showing the main window. Internally this still creates a BrowserWindow, loads `src/index.html`, and executes the bundled renderer (`src/build/chargyApp-bundle.js`).

```bash
npm run start -- --nogui file1.chargy
npm run start -- --nogui payload.tar.bz2 public-key.pem
```

Current flow:

1. `src/main.cjs` receives the raw command-line arguments.
2. `src/cliArguments.cjs` parses switches and file arguments.
3. File arguments are registered as allowed read paths.
4. The renderer filters file arguments again and reads them via IPC (`readFile`).
5. `Chargy.DetectAndConvertContentFormat(...)` detects, converts, and verifies the input.
6. The main process should print results through `setVerificationResult` and exit in `--nogui` mode.

Successful Charge Transparency Record verification now reports session verification results back to the main process again. In `--nogui` mode this happens before GUI rendering, so the CLI path does not depend on rendering `showChargeTransparencyRecord(...)` before it can print and exit. In debug/inspect mode the GUI is still rendered and the verification result is also sent to stdout.

### File Arguments

All non-switch arguments are treated as input files.

Examples:

```bash
npm run start -- --nogui tests/fixtures/OCMF/OCMF-Testdata-01.txt
npm run start -- --nogui tests/fixtures/ChargePoint/Testdata-2020-02/0024b1000002e300_2_123017065_payload.tar.bz2 tests/fixtures/ChargePoint/Testdata-2020-02/0024b1000002e300_2.pem
```

Supported formats come from Chargy's content detection and the existing fixture tests, including `.chargy`, `.xml`, `.json`, `.txt`, `.pdf`, `.zip`, `.tar`, `.tar.gz`, `.tar.bz2`, QR-code image files, and separate public key files.

Current limitations:

- File names starting with `-` are treated as switches and are not loaded.
- In development mode, the raw argument slicing still contains Electron-specific assumptions.
- `--nogui` without input files and without HTTP mode has no clear exit path yet.

### `--http`

The HTTP mode exists in the code and is included in the main help text. Its argument parsing is covered by `tests/cliArguments.test.ts`. The Node HTTP server startup and routing for `/verify` and `/convert` are covered by `tests/httpApi.test.ts` with a stubbed renderer dispatcher.

```bash
npm run start -- --http
npm run start -- --http=8080
npm run start -- --http=127.0.0.1:8080
npm run start -- --nogui --http=127.0.0.1:8080
```

Parsing:

- `--http` starts on `localhost:8080`.
- `--http=PORT` starts on `localhost:PORT`.
- `--http=HOST:PORT` starts on the given host and port.
- Invalid ports are rejected with `Invalid TCP port for chargy HTTP API: ...`.

The HTTP server starts after the renderer has loaded. It currently supports:

- `GET /`
- `POST /verify`
- `POST /convert`

`GET /` returns a small `text/plain` help text for the HTTP service. It lists the known endpoints and the request headers relevant for content and language negotiation.

`POST /verify` returns only session verification results. A single session returns one JSON string; multiple sessions return a JSON array.

The returned status text uses the configured CLI language by default:

```bash
npm run start -- --http=127.0.0.1:8080 --lang=de
```

For HTTP clients, the standard `Accept-Language` request header wins per request:

```bash
curl -H "Accept-Language: de-DE,de;q=0.9,en;q=0.8" \
     -X POST \
     --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" \
     "http://127.0.0.1:8080/verify"
```

Language selection priority for `/verify` status texts:

1. `Accept-Language` request header
2. `--lang=de|en`
3. process locale fallback (`LC_ALL`, `LC_MESSAGES`, `LANG`)
4. English

Only `de` and `en` are currently supported. Region tags such as `de-DE` or `en-US` are normalized to `de` and `en`. Standard `q` weights are honored; unsupported languages are ignored and fall back to the next priority level.

The `Accept` request header selects the response content type. Standard `q` weights, exact media types, `type/*`, and `*/*` are honored.

Supported response content types:

- `GET /`: `text/plain`
- `POST /verify`: `application/json`, `text/plain`, `text/csv`, `application/xml`
- `POST /convert`: `application/json`

If no acceptable response content type is found, the server returns `406`.

`POST /convert` returns the converted Charge Transparency Record. Add `?pretty` for indented JSON.

Examples:

```bash
curl "http://127.0.0.1:8080/"
curl -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -H "Accept: text/plain" -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -H "Accept: text/csv" -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -H "Accept: application/xml" -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/convert?pretty"
```

HTTP limits:

- Only `POST` is accepted.
- Only `/verify` and `/convert` are accepted.
- Maximum request size is 20 MiB.
- Main-to-renderer request timeout is 30 seconds.

`src/httpApi.cjs` is intentionally renderer-agnostic. `src/main.cjs` injects `dispatchHttpRequestToRenderer(...)`, while tests inject a stub dispatcher and exercise the real Node HTTP server on an OS-assigned port.

## Not Implemented Yet

### `--output=...`

`--help output` documents output formats, but `--output` is not evaluated by the current code. The only implemented stdout format for file verification is the simple main-process status line:

```text
status + optional " - message"
```

Successful Charge Transparency Record verification sends session verification results through `setVerificationResult(...)` again. Rich output formats such as JSON, CSV, XML, or updated Chargy exports are still not implemented.

### `--export filename`

The old help text hinted at `--export`, and the output help topic still mentions `chargy` together with `--export`. There is no CLI implementation for it yet.

Export currently exists only in the GUI path through the export button, `showSaveDialog()`, and `writeTextFile(...)`.

### Stable Exit Codes

There is no full documented exit-code contract yet. Current behavior:

- `--help` exits with `0`.
- `--version` exits with `0`.
- Invalid HTTP port configuration exits with `1`.
- `setVerificationResult` currently exits with `0` in `--nogui`, regardless of the verification result.
- Successful file verification in `--nogui` now sends session verification results through `setVerificationResult`.

A future contract should likely distinguish technical failures from successful verification with invalid signatures.

## CLI and HTTP Tests

The CLI and HTTP tests are in:

```text
tests/cliArguments.test.ts
tests/httpApi.test.ts
```

They run without Electron and cover `src/cliArguments.cjs` plus `src/httpApi.cjs`, the modules that are also used by `src/main.cjs`. They also import `src/applicationMetadata.cjs`, so expected version, edition, and copyright values come from the same metadata source as the Electron main process instead of being duplicated in the test file.

Run only the CLI argument tests:

```bash
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts
```

Run the CLI argument and HTTP API tests:

```bash
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts tests/httpApi.test.ts
```

Run the test TypeScript typecheck:

```bash
npm run test:typecheck
```

Current covered cases:

- `--help` is detected and not treated as an input file.
- `--help output` is detected as the `output` help topic.
- `--version` is detected.
- `--noGUI` is normalized to `--nogui`.
- `--lang=de` sets German as the CLI language.
- `LANG=de_DE.UTF-8` is normalized to `de` when no CLI language is set.
- Unsupported explicit languages fall back to `en`.
- Non-switch arguments are kept as input files.
- `--http` defaults to `localhost:8080`.
- `--http=18080` parses as `localhost:18080`.
- `--http=127.0.0.1:18080` parses host and port.
- Invalid HTTP ports report a parser error.
- Main help text contains the currently implemented switches.
- Main help text is rendered in German when requested.
- Output help text marks the output formats as not implemented yet.
- Output help text is rendered in German when requested.
- Help text expectations use `src/applicationMetadata.cjs` for application version, edition, and copyright.
- The HTTP API starts a real Node server on a free port.
- `GET /` returns HTTP service help without renderer dispatch.
- `POST /verify` dispatches to the renderer bridge and returns verification text.
- `POST /verify` honors `Accept` for JSON, text, CSV, and XML responses.
- `POST /verify` localizes verification text with the configured CLI language.
- `POST /verify` supports `Accept-Language` as a per-request language override.
- `POST /verify` can upload a QR-code PNG transparency record and verify it through the real Chargy core.
- `POST /convert?pretty` dispatches to the renderer bridge and returns the converted Charge Transparency Record.
- `POST /convert?pretty` can upload a QR-code PNG transparency record and convert it through the real Chargy core.
- Unsupported `Accept` content types are rejected with `406`.
- Unsupported methods and empty bodies are rejected before renderer dispatch.

Local verification after the first extraction:

```text
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts tests/httpApi.test.ts
33 passed

npm run test:typecheck
passed

npm test
124 passed, 2 skipped

npm run start -- --help
exit 0, clean help output

npm run start -- --help --lang=de
exit 0, German help output

npm run start -- --version
exit 0, clean version output
```

The important improvement is that `--help` and `--version` now return before `createWindow()`, so these CLI information paths no longer start the renderer.

## Remaining Risks From Refactoring

1. CLI documentation and implementation drifted apart.
   The old `documentation/CLI.md` mentions `--debug`; the current code uses `--inspect`. `--output` and `--export` are documented historically but not implemented.

2. File verification in CLI mode is still too coupled to Electron renderer startup.
   `--nogui` file verification still needs BrowserWindow, DOM, CSS, the renderer bundle, and a working Electron renderer startup. The HTTP request handling layer is now testable without Electron, but the real verification implementation still lives behind the renderer bridge.

3. `SessionVerificationResult` values are not fully mapped in `main.cjs`.
   Unknown values fall back to their raw string.

4. `--nogui` without files and without HTTP mode has no clear completion path.

5. Local `--nogui` end-to-end smoke tests are currently blocked in this Windows environment by Electron failing before renderer startup with `GPU process isn't usable`. The callback regression is fixed in source, but this separate Electron startup issue still needs investigation for reliable E2E coverage.

## Next Test Layers

The current tests cover only parsing and help text. The next layers should be:

### CLI Verification Service Tests

Extract a pure service that can:

- receive parsed CLI options,
- read input bytes or accept already loaded file data,
- call `Chargy.DetectAndConvertContentFormat(...)`,
- serialize text/JSON/XML/CSV output,
- decide exit codes.

This can be tested with the existing fixtures without starting Electron.

### Electron Smoke Tests

Keep these few and focused:

- `--help` prints usage and exits with `0`.
- `--version` prints the package version and exits with `0`.
- `--nogui charge_transparency_record.chargy` prints a result and exits.
- `--nogui missing-file` exits with a defined technical error.
- `--http=127.0.0.1:PORT` starts the Electron-backed API, answers `/verify`, and shuts down.

### Suggested Exit-Code Contract

Proposed future contract:

- `0`: technically successful verification and all sessions valid.
- `1`: technical error, for example invalid arguments, unreadable file, renderer not ready.
- `2`: technically successful verification, but at least one session is invalid.
- `3`: unknown or unsupported data format.

## Summary

The CLI mode remains part of the same Electron application and binary. The first cleanup step extracts and tests the CLI parameter contract without splitting the app. `--help` and `--version` are now clean early-exit paths. The next meaningful step is to move file verification and output formatting behind a similarly pure service, while keeping `src/main.cjs` as the single binary entry point.
