# Porsche Charging Data Format (PCDF)

The Porsche Charging Data Format (PCDF) is a compact, line-oriented transparency
data format for a single signed DC charging session. It is built from fixed-order
key-value fields after the OBIS-like prefix `128.8.0`.

Chargy treats PCDF as a single signed session data set. Unlike OCMF, PCDF does
not contain a JSON payload and it does not normally provide separate signed
START and STOP meter readings. The signed record contains the relevant session
timestamps, flags, energy value, meter identity, embedded public key and ECDSA
signature.

## General Structure

A PCDF record is one string:

```text
128.8.0(ST:<value>)(CT:<value>)(CD:<value>)(TV:<value>)(BV:<value>)(CSC:<value>)(SP:<value>)(RV:<value>)(SI:<value>)(CS:<value>)(HW:<value>)(DT:<value>)(PK:<value>)(SG:<value>)
```

All fields are mandatory and must appear in this exact order.

The parser also accepts optional `STX` and `ETX` control characters around the
record:

```text
\x02128.8.0(...)(SG:...)\x03
```

## Signed Payload

The signed payload is the exact UTF-8 byte sequence from the `128.8.0` prefix up
to, but not including, the `(SG:` field.

```text
128.8.0(ST:260101120000)...(DT:0)(PK:04...)
```

The signature is calculated over:

```text
SHA-256(signedPayload)
```

and verified as:

```text
ECDSA over secp256r1 / prime256v1, DER encoded signature
```

The public key in `PK` is embedded in the PCDF record itself. Chargy accepts the
raw uncompressed EC point:

```text
04 || X-coordinate || Y-coordinate
```

This is 65 bytes, encoded as 130 hexadecimal characters. For public key files,
Chargy can also normalize a DER/SPKI encoded P-256 public key to the raw point
before comparing it to the embedded key.

## Fields

| Field | Name | Format | Notes |
|-------|------|--------|-------|
| `ST` | Start Time | `YYMMDDHHmmss` | UTC-style timestamp. Year must be `19` or later. |
| `CT` | Current/Stop Time | `YYMMDDHHmmss` | Must be greater than or equal to `ST`. |
| `CD` | Charging Duration | `HHmmss` | Hours `00`-`99`, minutes and seconds `00`-`59`. |
| `TV` | Time Validity | `0` or `1` | `1` means the timestamp is valid. |
| `BV` | Billing Validity | `0` or `1` | `0` means billing is not possible and is treated as an invalid session. |
| `CSC` | Charging Session Counter | decimal integer | Must be non-negative. |
| `SP` | Stop Present | `0` or `1` | `1` means the final session data is present. `0` is invalid for billing verification. |
| `RV` | Reading Value | `NNNN.NNN*kWh` | Energy value in kWh with exactly 4 integer and 3 fractional digits. |
| `SI` | Session Info | `<idTag>*<type>*<transactionId>` | `type` is one character in the range `1`-`5`. |
| `CS` | Software Checksum | 8 hexadecimal chars | Stored as lowercase internally. |
| `HW` | Hardware Serial | 11 chars | Meter hardware serial. |
| `DT` | DC Meter Type | decimal integer | `0` means PES DCMeter EU, other values are currently unknown. |
| `PK` | Public Key | 130 hexadecimal chars | Uncompressed P-256 EC point, beginning with `04`. |
| `SG` | Signature | hexadecimal DER | ASN.1 DER encoded ECDSA signature. |

## Session Info Types

The second component of `SI` is preserved as a string. The known values are:

| Type | Meaning |
|------|---------|
| `1` | RFID |
| `2` | EMAID |
| `3` | Credit card |
| `4` | Remote |
| `5` | NFC |

Example:

```text
(SI:DE-PORSCHE-EMAID*2*tx-2026-00042)
```

## Complete Shape Example

This example is shortened in the `PK` and `SG` fields for readability. A real
record must contain the full 130-character public key and the complete DER
signature.

```text
128.8.0(ST:260101120000)(CT:260101123045)(CD:003045)(TV:1)(BV:1)(CSC:42)(SP:1)(RV:0042.125*kWh)(SI:DE-PORSCHE-EMAID*2*tx-2026-00042)(CS:513f627b)(HW:PDCM1234567)(DT:0)(PK:04aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899)(SG:3045022100...)
```

## Variant Examples

### RFID Session

An RFID-authenticated session uses `SI:<idTag>*1*<transactionId>`.

```text
128.8.0(ST:260501162017)(CT:260501162234)(CD:000217)(TV:1)(BV:1)(CSC:1)(SP:1)(RV:0003.276*kWh)(SI:55*1*959bff1e-7164-4132-b783-4a9feed1bfee)(CS:513f627b)(HW:12345678901)(DT:0)(PK:04...)(SG:3045...)
```

### EMAID Session

An EMAID-authenticated session uses `SI:<emaid>*2*<transactionId>`.

```text
128.8.0(ST:260601081500)(CT:260601090245)(CD:004745)(TV:1)(BV:1)(CSC:18)(SP:1)(RV:0028.750*kWh)(SI:DE8PORC1234567890*2*tx-emaid-00018)(CS:a1b2c3d4)(HW:PDCM1234567)(DT:0)(PK:04...)(SG:3044...)
```

### Remote Authorization

Remote authorization uses session info type `4`.

```text
128.8.0(ST:260701211000)(CT:260701215800)(CD:004800)(TV:1)(BV:1)(CSC:105)(SP:1)(RV:0017.925*kWh)(SI:remote-user-42*4*remote-tx-105)(CS:7f12ab90)(HW:98765432109)(DT:0)(PK:04...)(SG:3046...)
```

### NFC Authorization

NFC authorization uses session info type `5`.

```text
128.8.0(ST:260802073015)(CT:260802081500)(CD:004745)(TV:1)(BV:1)(CSC:106)(SP:1)(RV:0011.400*kWh)(SI:nfc-token-7*5*nfc-tx-106)(CS:0000abcd)(HW:98765432109)(DT:0)(PK:04...)(SG:3045...)
```

### Zero Energy Session

The value format allows `0000.000*kWh`. Whether such a record is acceptable for
billing depends on the surrounding business context, but the PCDF field itself
is syntactically valid.

```text
128.8.0(ST:260901101500)(CT:260901101700)(CD:000200)(TV:1)(BV:1)(CSC:107)(SP:1)(RV:0000.000*kWh)(SI:testuser*1*zero-energy-107)(CS:abcdef12)(HW:12345678901)(DT:0)(PK:04...)(SG:3044...)
```

### Unknown Meter Type

`DT:0` is currently known as PES DCMeter EU. Other values are parsed and kept,
but displayed as unknown meter types.

```text
128.8.0(ST:261001120000)(CT:261001124500)(CD:004500)(TV:1)(BV:1)(CSC:108)(SP:1)(RV:0020.000*kWh)(SI:testuser*1*unknown-meter-108)(CS:1234abcd)(HW:12345678901)(DT:99)(PK:04...)(SG:3045...)
```

### STX/ETX Wrapped Record

Some transports wrap the payload with ASCII control characters. Chargy strips a
leading `STX` (`0x02`) and a trailing `ETX` (`0x03`) before parsing.

```text
\x02128.8.0(ST:260501162017)(CT:260501162234)(CD:000217)(TV:1)(BV:1)(CSC:1)(SP:1)(RV:0003.276*kWh)(SI:55*1*959bff1e-7164-4132-b783-4a9feed1bfee)(CS:513f627b)(HW:12345678901)(DT:0)(PK:04...)(SG:3045...)\x03
```

### Quoted Record

Some sources provide the complete PCDF string as a quoted text value. Chargy
accepts this form as well.

```text
"128.8.0(ST:260501162017)(CT:260501162234)(CD:000217)(TV:1)(BV:1)(CSC:1)(SP:1)(RV:0003.276*kWh)(SI:55*1*959bff1e-7164-4132-b783-4a9feed1bfee)(CS:513f627b)(HW:12345678901)(DT:0)(PK:04...)(SG:3045...)"
```

## Invalid but Signed Variants

The following records can be cryptographically signed but are not considered
valid charging transparency data for billing verification.

### Billing Invalid

`BV:0` means that billing is not possible because the DC meter reported an
error.

```text
128.8.0(ST:260501162017)(CT:260501162234)(CD:000217)(TV:1)(BV:0)(CSC:1)(SP:1)(RV:0003.276*kWh)(SI:55*1*959bff1e-7164-4132-b783-4a9feed1bfee)(CS:513f627b)(HW:12345678901)(DT:0)(PK:04...)(SG:3045...)
```

### Stop Data Missing

`SP:0` means that the final session data is missing. Chargy reports this as an
invalid session.

```text
128.8.0(ST:260501162017)(CT:260501162234)(CD:000217)(TV:1)(BV:1)(CSC:1)(SP:0)(RV:0003.276*kWh)(SI:55*1*959bff1e-7164-4132-b783-4a9feed1bfee)(CS:513f627b)(HW:12345678901)(DT:0)(PK:04...)(SG:3045...)
```

### Tampered Reading Value

Changing any character in the signed payload, for example `RV`, must invalidate
the signature.

```text
128.8.0(ST:260501162017)(CT:260501162234)(CD:000217)(TV:1)(BV:1)(CSC:1)(SP:1)(RV:0003.277*kWh)(SI:55*1*959bff1e-7164-4132-b783-4a9feed1bfee)(CS:513f627b)(HW:12345678901)(DT:0)(PK:04...)(SG:original-signature-from-0003.276-record)
```

## Validation Notes

Chargy distinguishes parsing, semantic validation and cryptographic
verification:

1. Parsing checks the prefix, field order and the presence of all mandatory
   fields.
2. Validation checks timestamp ranges, flags, reading value format, session
   information, software checksum length, hardware serial length, public key
   shape and DER signature shape.
3. Verification checks the embedded public key and the ECDSA signature over the
   signed payload.

When an external public key is supplied, it must match the embedded `PK` value
byte-for-byte after normalization. Otherwise the record is rejected with a wrong
public-key error before the signature is trusted.

