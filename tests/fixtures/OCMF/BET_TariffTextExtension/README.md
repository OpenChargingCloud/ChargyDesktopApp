# BET OCMF Tariff Text Extension fixtures

This directory contains three complete OCMF 1.4 documents for each tariff
text profile defined by the Bonner Eichrechtstage:

- `001`: start fee, energy price and blocking fee after a given minute
- `002`: start fee, energy price and blocking fee after charging ends
- `003`: start fee and charging-time price

Every `.ocmf` file is a standalone OCMF document containing two readings. The
tariff does not change within any of them, so every `TT` here names a single
tariff. For the extended form that records a tariff change — the same texts
separated by a vertical bar — see `documentation/OCMF/README.md`, "Recording a
tariff change".
The numbered baseline fixtures use ECDSA P-256/SHA-256; the explicitly named
Ed25519, Ed448, and ML-DSA-65 fixtures exercise Chargy's modern signature
extensions. Each baseline fixture's `.expected.json` file describes the tariff
interpretation and the relevant normalized CTR fields.

The ECDSA baseline documents use the same public test key:

- `publicKey.pem` for OpenSSL and other general-purpose tools
- `publicKey.txt` as hexadecimal DER/SPKI, matching Chargy's existing OCMF
  public-key fixture format

Each modern fixture has a matching raw `*.publicKey.hex` key and the equivalent
standards-based SubjectPublicKeyInfo in `*.publicKey.pem`. The Ed25519 and Ed448
PEMs follow RFC 8410; the ML-DSA-65 PEM follows RFC 9881.

The automated tests verify every embedded signature against its matching key
and check that each PEM contains exactly the public key from its `.hex` file.
When an OCMF document is imported alone, the resulting measurement status is
nevertheless `PublicKeyNotFound`, because OCMF does not embed the public key
in the signed document itself.
