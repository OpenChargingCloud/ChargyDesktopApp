# BET OCMF Tariff Text Extension fixtures

This directory contains three complete OCMF 1.4 documents for each tariff
text profile defined by the Bonner Eichrechtstage:

- `001`: start fee, energy price and blocking fee after a given minute
- `002`: start fee, energy price and blocking fee after charging ends
- `003`: start fee and charging-time price

Every `.txt` file is a standalone OCMF document containing two readings and
an ECDSA P-256/SHA-256 signature. Its `.expected.json` file describes the
tariff interpretation and the relevant normalized CTR fields.

All documents use the same public test key:

- `publicKey.pem` for OpenSSL and other general-purpose tools
- `publicKey.txt` as hexadecimal DER/SPKI, matching Chargy's existing OCMF
  public-key fixture format

The automated tests verify every embedded signature against `publicKey.pem`.
When an OCMF document is imported alone, the resulting measurement status is
nevertheless `PublicKeyNotFound`, because OCMF does not embed the public key
in the signed document itself.
