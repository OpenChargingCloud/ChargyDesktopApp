# Chargy CLI Mode

Status: 2026-06-16. This document describes the current CLI-related code paths in `src/main.cjs`, `src/cliArguments.cjs`, `src/apiKeys.cjs`, `src/ts/apiKeys.ts`, `src/httpApi.cjs`, `src/applicationMetadata.cjs`, `src/ts/chargyApp.ts`, and the CLI/HTTP tests in `tests/cliArguments.test.ts`, `tests/apiKeys.test.ts`, and `tests/httpApi.test.ts`.

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
src/apiKeys.cjs
src/ts/apiKeys.ts
src/httpApi.cjs
src/applicationMetadata.cjs
```

`src/cliArguments.cjs` contains the side-effect-free argument parser and help text rendering. `src/apiKeys.cjs` contains API-key JSON parsing and validity checks. `src/ts/apiKeys.ts` contains the TypeScript API-key enum, interfaces, authentication-result union, and TypeGuards used by tests and future typed code. `src/httpApi.cjs` contains the Node HTTP handler and server startup wrapper for the CLI HTTP API. `src/applicationMetadata.cjs` contains shared application metadata such as edition, copyright, package version, and `package.json`. These modules are used by `src/main.cjs`; the tests read the same metadata module so the expected help output does not duplicate the version, edition, or copyright strings.

The parser, help contract, API-key contract, and HTTP routing contract are covered by:

```text
tests/cliArguments.test.ts
tests/apiKeys.test.ts
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
- `--apiKeys=file`

This path is now covered by parser/help text tests and by a local Electron smoke check.

### `--lang`

Sets the CLI language for early CLI output such as `--help` and `--help output`.

Both `--lang=de` and the space-separated `--lang de` form are accepted:

```bash
npm run start -- --help --lang=de
npm run start -- --help --lang en
npm run start -- --nogui --lang de session.chargy
npm run start -- --help output --lang=de
```

`--lang` is the only documented language option. The currently supported language values are:

- `de`
- `en`

The explicit CLI parameter wins over environment defaults. Unsupported explicit values fall back to `en`.

The space-separated `--lang de` form only consumes the following token when it is a recognized language, so a file argument such as `--lang session.chargy` is never swallowed as a language value: the file stays a file and the unusable `--lang` falls back to `en`. (An unsupported bare token like `--lang fr` is consequently treated as a file argument; use `--lang=fr` if you really mean a language value.) When no CLI language is set, the CLI parser checks the usual process locale variables in this order:

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

`--nogui` with neither a file to verify nor `--http` has nothing to do. Instead of starting an invisible renderer that would never receive a verification result, the main process prints the usage help and exits with `0`. The decision is the pure predicate `hasNoActionableInput(cliArguments)` in `src/cliArguments.cjs` (covered by `tests/cliArguments.test.ts`).

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
npm run start -- --nogui --http=127.0.0.1:8080 --apiKeys=api-keys.json
```

Parsing:

- `--http` starts on `localhost:8080`.
- `--http=PORT` starts on `localhost:PORT`.
- `--http=HOST:PORT` starts on the given host and port.
- Invalid ports are rejected with `Invalid TCP port for chargy HTTP API: ...`.

The HTTP server starts after the renderer has loaded. It currently supports:

- `GET /`
- `GET /apiKeys`
- `ADD /apiKeys`
- `DELETE /apiKeys`
- `POST /verify`
- `POST /convert`

`GET /` returns a small `text/plain` help text for the HTTP service. It lists the known endpoints and the request headers relevant for authentication, content negotiation and language negotiation. It intentionally stays reachable without an `Authorization` header, even when API-key authentication is enabled.

`GET /apiKeys` returns API-key metadata as JSON. It requires a known `Authorization` request header, but it does not require that token to be inside its `notBefore`/`notAfter` validity window. A non-root token returns all configured entries using the same token, which can be multiple entries when validity windows differ. A token with the `root` role returns the complete configured API-key array. Missing, malformed or unknown authorization values return `401`.

`ADD /apiKeys` adds one API-key entry from a JSON request body. It requires a valid, currently active `Authorization` value with the `root` role. The request body must be a single API-key JSON object, not an array. The new entry is parsed through the same validation and defaulting rules as the API-key file. If an identical canonical entry already exists, including configured optional fields such as `totp`, `roles`, `notBefore`, and `notAfter`, the server returns `409 Conflict`. Otherwise the entry is added to the running server configuration, persisted to the original `--apiKeys` JSON file, and returned as JSON with `201 Created`.

`DELETE /apiKeys` deletes one API-key entry matching the uploaded JSON request body. It requires a valid, currently active `Authorization` value with the `root` role. The request body must be a single API-key JSON object. The object is parsed and canonicalized with the same rules as `ADD /apiKeys`; exactly one configured entry must match. If no entry matches, the server returns `404 Not Found`. If multiple configured entries match the uploaded object, the server returns `409 Conflict`. Otherwise the matching entry is removed from the running server configuration, persisted to the original `--apiKeys` JSON file, and returned as JSON with `200 OK`.

Successful `ADD /apiKeys` and `DELETE /apiKeys` operations rewrite the complete canonical API-key array to the configured `--apiKeys` file using a temporary file followed by rename. If persistence fails, the in-memory change is rolled back and the server returns `500`.

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
- `GET /apiKeys`: `application/json`
- `ADD /apiKeys`: `application/json`
- `DELETE /apiKeys`: `application/json`
- `POST /verify`: `application/json`, `text/plain`, `text/csv`, `application/xml`
- `POST /convert`: `application/json`

If no acceptable response content type is found, the server returns `406`.

`POST /convert` returns the converted Charge Transparency Record. Add `?pretty` for indented JSON.

Examples:

```bash
curl "http://127.0.0.1:8080/"
curl -H "Authorization: Bearer root-secret" "http://127.0.0.1:8080/apiKeys"
curl -H "Authorization: Bearer root-secret" -H "Content-Type: application/json" -X ADD --data '{"token":"new-driver-secret"}' "http://127.0.0.1:8080/apiKeys"
curl -H "Authorization: Bearer root-secret" -H "Content-Type: application/json" -X DELETE --data '{"token":"new-driver-secret"}' "http://127.0.0.1:8080/apiKeys"
curl -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -H "Accept: text/plain" -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -H "Accept: text/csv" -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -H "Accept: application/xml" -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/verify"
curl -X POST --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" "http://127.0.0.1:8080/convert?pretty"
```

### `--apiKeys`

`--apiKeys` enables API-key authentication for the HTTP API and expects a JSON file name.

```bash
npm run start -- --nogui --http=127.0.0.1:8080 --apiKeys=api-keys.json
npm run start -- --nogui --http=127.0.0.1:8080 --apiKeys api-keys.json
```

When `--apiKeys` is configured:

- `GET /` stays open without authentication.
- `GET /apiKeys` requires a known `Authorization` value.
- `GET /apiKeys` returns all entries using the request token for non-root tokens, even when that token is not yet valid or already expired.
- `GET /apiKeys` returns the complete configured API-key array when the request token has the `root` role.
- `ADD /apiKeys` requires a valid active `root` authorization.
- `ADD /apiKeys` accepts one API-key JSON object, persists the updated API-key list, returns `201` for new entries and `409` for duplicates.
- `DELETE /apiKeys` requires a valid active `root` authorization.
- `DELETE /apiKeys` accepts one API-key JSON object, persists the updated API-key list when exactly one entry matches, returns `404` when no entry matches, and returns `409` when multiple entries match.
- `POST /verify` and `POST /convert` require the `Authorization` request header.
- Missing, unknown, not-yet-valid, or expired keys return `401`.
- The validity-window checks apply to `POST /verify` and `POST /convert`, not to `GET /apiKeys`.
- Empty API-key files are valid JSON but allow no protected request through.
- Static API keys use `Authorization: Bearer <static-api-secret>` and compare the bearer secret directly with the configured `token`.
- TOTP API keys use `Authorization: TOTP <token> <totp>` and compare the TOTP value with the generated one-time password for the previous, current, or next time slot.
- Roles are parsed and validated. `root` expands `GET /apiKeys` from the entries matching the request token to the complete configured API-key array.

API-key file format:

```json
[
  {
    "token": "driver-secret",
    "roles": [ "evDriver" ],
    "notAfter": "2026-06-30T23:59:59Z"
  },
  {
    "token": "driver-secret",
    "roles": [ "evDriver" ],
    "notBefore": "2026-07-01T00:00:00Z"
  },
  {
    "token": "root-secret",
    "roles": [ "evDriver", "root" ],
    "notBefore": "2026-01-01T00:00:00Z",
    "notAfter": "2026-12-31T23:59:59Z"
  },
  {
    "token": "totp-driver",
    "totp": {
      "sharedSecrect": "secureChargingSecret2026",
      "validityTime": 10,
      "length": 24,
      "hashAlgorithm": "sha256",
      "alphabet": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    },
    "roles": [ "evDriver" ]
  }
]
```

Fields:

- `token`: required non-empty string. For static API keys this is the bearer secret in `Authorization: Bearer <static-api-secret>`. For TOTP entries it is the stable key identifier returned in metadata and authentication results and used as the first value in `Authorization: TOTP <token> <totp>`.
- `totp`: optional object enabling a time-based one-time password API key for this entry.
- `roles`: optional array of enum values. Supported values are `evDriver` and `root`; the default is `[ "evDriver" ]`.
- `notBefore`: optional ISO 8601 timestamp. When absent, the token is valid immediately.
- `notAfter`: optional ISO 8601 timestamp. When absent, the token does not expire by time.

TOTP fields:

- `sharedSecrect`: required shared secret string. The current field name follows the TypeScript interface spelling. It must contain at least 16 characters and no whitespace.
- `validityTime`: optional time-slot length in seconds; default is `10`.
- `length`: optional generated TOTP length; default is `32`, and configured values must be greater than `16`.
- `hashAlgorithm`: optional HMAC algorithm. Accepted values are `sha256`, `sha384`, and `sha512`; the default is `sha256`.
- `alphabet`: optional alphabet used for generated TOTP characters. The default alphabet is digits plus lower- and upper-case ASCII letters. Custom alphabets need at least 4 unique non-whitespace characters.

The TOTP implementation uses the `@open-charging-cloud/totp` package, which implements the DynamicQRCodes algorithm: HMAC over the 8-byte big-endian time slot, an offset from the last hash byte, and character selection from the configured alphabet. The server accepts the generated values for the previous, current, and next slot to absorb small clock differences between client and server.

Authenticated request example:

```bash
curl -H "Authorization: Bearer driver-secret" \
     -X POST \
     --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" \
     "http://127.0.0.1:8080/verify"
```

TOTP request example, schematically:

```bash
curl -H "Authorization: TOTP totp-driver <generated-current-totp>" \
     -X POST \
     --data-binary "@tests/fixtures/OCMF/OCMF-Testdata-01.txt" \
     "http://127.0.0.1:8080/verify"
```

HTTP limits:

- `GET /` and `GET /apiKeys` are accepted for service/admin metadata.
- Verification and conversion use `POST` only.
- Only `/`, `/apiKeys`, `/verify`, and `/convert` are accepted.
- Maximum request size is 20 MiB.
- Main-to-renderer request timeout is 30 seconds.
- Per-request socket read timeout is 30 seconds (slow clients receive `408` and are disconnected).
- Verification and conversion requests are serialized against the single shared renderer, so concurrent requests cannot interleave on shared state. Throughput is therefore one verification at a time.

> **Security note — network binding.**
> By default `--http` binds to `localhost`, so the verification API is only reachable from the same machine. Binding to a non-loopback address exposes it to the network:
>
> ```bash
> npm run start -- --http=0.0.0.0:8080      # reachable from ANY host on the network
> npm run start -- --http=192.168.1.10:8080 # reachable from the local network
> ```
>
> The HTTP API has **no TLS**. If `--apiKeys` is not configured, anyone who can reach the bound address can submit transparency records for verification and conversion and read the results. `--apiKeys` restricts protected endpoints to callers that know a currently valid key, but the key still travels as a plain HTTP header unless TLS is provided by a reverse proxy or another trusted transport layer. Only bind to a non-loopback address on a trusted, isolated network, and prefer placing a reverse proxy with TLS and access control in front of it. When the server is started on a non-loopback address it logs a warning to make this explicit.

`src/httpApi.cjs` is intentionally renderer-agnostic. `src/main.cjs` injects `dispatchHttpRequestToRenderer(...)`, while tests inject a stub dispatcher and exercise the real Node HTTP server on an OS-assigned port.

## CLI Output Formats

`--output` selects the stdout format for file verification in `--nogui` / `--inspect` mode. The format selection, rendering and exit-code mapping live in `src/verificationService.cjs`, a pure, Electron-free module shared with the HTTP API's rendering (`src/outputFormats.cjs`).

```bash
npm run start -- --nogui --output=text  record.chargy   # default
npm run start -- --nogui --output=csv   record.chargy
npm run start -- --nogui --output=json  record.chargy
npm run start -- --nogui --output=xml   record.chargy
```

- `text` (default): one localized status line per session, with ` - <message>` appended when present.
- `csv`: a `session,status` table with the localized status text (same renderer as `POST /verify`).
- `xml`: a `<verificationResults>` document (same renderer as `POST /verify`).
- `json`: an array of `{ session, status, text, message }` objects.

Status texts honor `--lang=de|en`. An unsupported `--output` value is a technical error (exit code `1`).

### Exit Codes

The verification service maps results to a stable contract (`src/verificationService.cjs`):

| Code | Meaning |
| ---- | ------- |
| `0`  | Technically successful verification, every session has a valid signature. |
| `1`  | Technical error: invalid arguments (e.g. invalid `--http` port or unsupported `--output`), unreadable file, renderer not ready. |
| `2`  | Technically successful verification, but at least one session is not valid. |
| `3`  | Unknown or unsupported transparency data format (no parseable record). |

`--help` and `--version` exit with `0`. In `--nogui` mode the process now exits with the mapped code from `setVerificationResult`.

## Not Implemented Yet

### `--output=chargy` and `--export filename`

The `chargy` output format and `--export` are documented in the output help topic but not implemented. They require the full Charge Transparency Record plus a CLI export path; export currently exists only in the GUI through the export button, `showSaveDialog()`, and `writeTextFile(...)`.

## CLI and HTTP Tests

The CLI and HTTP tests are in:

```text
tests/cliArguments.test.ts        # src/cliArguments.cjs (parsing, language, help text, IPv6)
tests/apiKeys.test.ts             # src/apiKeys.cjs and src/ts/apiKeys.ts (JSON parsing, roles, timestamps, authentication, TypeGuards)
tests/httpApi.test.ts             # src/httpApi.cjs (routing, negotiation, 413/500, serialization, timeout)
tests/verificationService.test.ts # src/verificationService.cjs (output formats, exit codes)
tests/mainSecurity.test.ts        # src/mainSecurity.cjs (path allow-list, URL/permission filters)
tests/cliVerificationFlow.test.ts # real Chargy core -> CLI service: --nogui file flow, output + exit codes
tests/verificationResults.test.ts # src/ts/verificationResults.ts (CTR -> session results extraction + fallback)
```

They run without Electron and cover the pure modules that `src/main.cjs` is built from. They also import `src/applicationMetadata.cjs`, so expected version, edition, and copyright values come from the same metadata source as the Electron main process instead of being duplicated in the test file.

The Electron-free module layout extracted from `src/main.cjs` is:

- `src/cliArguments.cjs` - argument parsing, language detection, help text.
- `src/apiKeys.cjs` - parsing API-key JSON files and validating `Authorization` request headers.
- `src/ts/apiKeys.ts` - TypeScript API-key enum, interfaces, authentication-result union and TypeGuards.
- `src/outputFormats.cjs` - shared CSV/XML/JSON/text rendering and localized status text (used by HTTP and CLI).
- `src/verificationService.cjs` - CLI `--output` rendering and exit-code mapping.
- `src/httpApi.cjs` - the Node HTTP server, optional API-key authentication, content negotiation, size/timeout guards, dispatch serialization.
- `src/asyncMutex.cjs` - the serialization primitive shared-renderer dispatch runs through.
- `src/mainSecurity.cjs` - file path allow-list plus external-URL and camera-permission filters.

Run only the CLI argument tests:

```bash
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts
```

Run the CLI argument and HTTP API tests:

```bash
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts tests/httpApi.test.ts
```

Run the CLI argument, API-key and HTTP API tests:

```bash
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts tests/apiKeys.test.ts tests/httpApi.test.ts
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
- `--apiKeys file` and `--apiKeys=file` parse the API-key JSON file path.
- Main help text contains the currently implemented switches.
- Main help text is rendered in German when requested.
- Output help text marks the output formats as not implemented yet.
- Output help text is rendered in German when requested.
- Help text expectations use `src/applicationMetadata.cjs` for application version, edition, and copyright.
- The HTTP API starts a real Node server on a free port.
- `GET /` returns HTTP service help without renderer dispatch.
- `GET /` stays reachable without `Authorization` when API-key authentication is enabled.
- `GET /apiKeys` rejects missing API keys with `401`.
- `GET /apiKeys` returns entries matching the request token for known non-root tokens, even outside the validity window.
- `GET /apiKeys` returns the complete configured API-key array for root tokens.
- `ADD /apiKeys` requires root authorization, adds and persists a new API key, and rejects canonical duplicates with `409`.
- `ADD /apiKeys` rejects valid non-root authorization with `403`.
- `DELETE /apiKeys` requires root authorization, deletes and persists exactly one matching API key, returns `404` for missing matches, and rejects ambiguous matches with `409`.
- `POST /verify` rejects missing, expired or unknown API keys with `401`.
- `POST /verify` accepts valid Bearer authorizations from the `Authorization` request header.
- `POST /verify` accepts valid TOTP authorizations from the `Authorization` request header.
- The former `API-Key` request header is not accepted.
- `POST /convert` also rejects missing API keys with `401`.
- `POST /verify` dispatches to the renderer bridge and returns verification text.
- `POST /verify` honors `Accept` for JSON, text, CSV, and XML responses.
- `POST /verify` localizes verification text with the configured CLI language.
- `POST /verify` supports `Accept-Language` as a per-request language override.
- `POST /verify` can upload a QR-code PNG transparency record and verify it through the real Chargy core.
- `POST /convert?pretty` dispatches to the renderer bridge and returns the converted Charge Transparency Record.
- `POST /convert?pretty` can upload a QR-code PNG transparency record and convert it through the real Chargy core.
- Unsupported `Accept` content types are rejected with `406`.
- Unsupported methods and empty bodies are rejected before renderer dispatch.
- API-key TypeScript interfaces and TypeGuards validate raw JSON entries, parsed entries, role enums, timestamp windows, and rejected legacy fields.
- TOTP API keys are parsed with defaults, reject weak malformed configuration, generate `@open-charging-cloud/totp`/DynamicQRCodes-compatible slot values, accept previous/current/next slots, and do not allow the static `token` identifier as a request key.
- API-key JSON files are parsed, `token` is the required secret field, repeated tokens are allowed, `notBefore` and `notAfter` are optional, roles default to `[ "evDriver" ]`, multiple roles such as `[ "evDriver", "root" ]` are accepted, legacy `apiKey` and singular `role` fields are rejected, and invalid timestamps are rejected.

Local verification after the first extraction:

```text
npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts tests/httpApi.test.ts
51 passed

npx vitest run --config tests/vitest.config.ts tests/cliArguments.test.ts tests/apiKeys.test.ts tests/httpApi.test.ts
80 passed

npm run test:typecheck
passed

npm test
201 passed, 2 skipped

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
   The old `documentation/CLI.md` mentions `--debug`; the current code uses `--inspect`. `--output` is now implemented for `text/csv/json/xml`; `--output=chargy` and `--export` remain documented but unimplemented.

2. File verification in CLI mode is still too coupled to Electron renderer startup.
   `--nogui` file verification still needs BrowserWindow, DOM, CSS, the renderer bundle, and a working Electron renderer startup. The output rendering and exit-code mapping are now a pure, tested module (`src/verificationService.cjs`), but the real verification still lives behind the renderer bridge because the Chargy core is only built into the webpack renderer bundle.

3. `SessionVerificationResult` values are now mapped in `src/outputFormats.cjs` for localized text and in `src/verificationService.cjs` for exit codes. Unknown values still fall back to their raw string for display and to exit code `2`.

4. ~~`--nogui` without files and without HTTP mode has no clear completion path.~~ Resolved: it now prints the usage help and exits with `0` via `hasNoActionableInput(...)`.

5. Local `--nogui` end-to-end smoke tests are currently blocked in this Windows environment by Electron failing before renderer startup with `GPU process isn't usable`. The callback regression is fixed in source, but this separate Electron startup issue still needs investigation for reliable E2E coverage.

## Next Test Layers

Parsing, help text, HTTP routing/negotiation, output rendering, exit codes and the `main.cjs` security helpers are now covered without Electron. The remaining layers are:

### CLI Verification Service Tests (done)

`tests/cliVerificationFlow.test.ts` exercises the full `--nogui` success path without Electron: it reads a real fixture, runs it through `Chargy.DetectAndConvertContentFormat(...)` in Node, extracts the per-session results, and feeds them into `verificationService.renderCliVerification(...)`, asserting text/CSV/JSON output and exit code `0`.

The extraction step (CTR → session verification results, plus the "no records" fallback) is no longer mirrored in the test: it now lives in the shared pure function `toSessionVerificationResults(...)` in `src/ts/verificationResults.ts`, which `src/ts/chargyApp.ts -> publishVerificationResult(...)` and the tests both use. Its own branches (per-session results, dropping sessions without a result, the localized/default fallback, and an invalid-signature session mapping to exit code `2`) are covered directly in `tests/verificationResults.test.ts`. Non-CTR / unparseable inputs never reach this path in production — the renderer routes them through `doGlobalError(...)` instead.

### Electron Smoke Tests

Keep these few and focused:

- `--help` prints usage and exits with `0`.
- `--version` prints the package version and exits with `0`.
- `--nogui charge_transparency_record.chargy` prints a result and exits.
- `--nogui missing-file` exits with a defined technical error.
- `--http=127.0.0.1:PORT` starts the Electron-backed API, answers `/verify`, and shuts down.

### Exit-Code Contract (implemented)

Implemented in `src/verificationService.cjs` and applied by `src/main.cjs` in `--nogui` mode (see the [Exit Codes](#exit-codes) table above):

- `0`: technically successful verification and all sessions valid.
- `1`: technical error, for example invalid arguments, unreadable file, renderer not ready.
- `2`: technically successful verification, but at least one session is invalid.
- `3`: unknown or unsupported data format.

## Summary

The CLI mode remains part of the same Electron application and binary. The CLI parameter contract, output formatting (`--output`), exit-code mapping, HTTP routing/negotiation, request serialization and timeouts, and the `main.cjs` security helpers are now extracted into pure, Electron-free modules and tested without starting Electron. The remaining step is to run the Chargy verification core directly in Node for the `--nogui` file path, so the only part still requiring a renderer is the GUI itself, while keeping `src/main.cjs` as the single binary entry point.
