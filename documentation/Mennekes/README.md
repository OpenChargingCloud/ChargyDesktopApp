# Mennekes EDL40 XML Format

The Mennekes EDL40 format is an XML based transparency data format for signed
charging process meter readings. It transports one or more charging processes
with embedded raw secp192r1 public keys and ECDSA signatures over an extended
SML-like 320 byte payload.

Chargy treats Mennekes EDL40 as one signed charging session per
`ChargingProcess`. Each session contains exactly one energy measurement with a
START and STOP value. The cryptographic verification is performed separately for
both values.

## XML Variants

Chargy accepts two XML shapes.

### Standalone ChargingProcess

```xml
<ChargingProcess xmlns="http://www.mennekes.de/Mennekes.EdlVerification.xsd">
  <ServerId>0901454D4800005BAE2F</ServerId>
  <PublicKey>6DACB9C5...</PublicKey>
  <MeteringPoint>DE*PWC*E00003*005</MeteringPoint>
  <SiteAddress>
    <ZipCode>38116</ZipCode>
    <Street>Bundesallee 100</Street>
    <Town>Braunschweig</Town>
  </SiteAddress>
  <CustomerIdent>874AD0FE</CustomerIdent>
  <TimestampCustomerIdent>2018-09-04T12:22:10+02:00</TimestampCustomerIdent>
  <MeasurementStart>...</MeasurementStart>
  <MeasurementEnd>...</MeasurementEnd>
</ChargingProcess>
```

The namespace is recommended, but Chargy also accepts a standalone
`ChargingProcess` without a namespace because some real world files omit it.

### Billing Wrapper

```xml
<Billing xmlns="http://www.mennekes.de/Mennekes.EdlVerification.xsd">
  <Customer>...</Customer>
  <Supplier>...</Supplier>
  <BillingPeriods>
    <BillingPeriod>
      <ChargingProcesses>
        <ChargingProcess>...</ChargingProcess>
      </ChargingProcesses>
    </BillingPeriod>
  </BillingPeriods>
</Billing>
```

For verification Chargy extracts all contained `ChargingProcess` elements. The
billing metadata is currently not part of the cryptographic payload.

## Namespace

The Mennekes XML namespace is:

```text
http://www.mennekes.de/Mennekes.EdlVerification.xsd
```

Chargy routes XML files with this namespace directly to the Mennekes parser. It
also detects `ChargingProcess` and `Billing` root elements without an XML
declaration or namespace.

## ChargingProcess Fields

| Field | Format | Notes |
|-------|--------|-------|
| `ServerId` | 20 hexadecimal chars | 10 bytes, copied to the signed payload. |
| `PublicKey` | 96 hexadecimal chars | Raw secp192r1 public key, `X || Y`, 48 bytes. |
| `MeteringPoint` | string | Used as EVSE id when present. |
| `SiteAddress` | XML object | Optional address metadata. |
| `CustomerIdent` | hexadecimal string | Contract or customer identifier, padded to 128 bytes in the signed payload. |
| `TimestampCustomerIdent` | ISO 8601 with offset | Timestamp for the customer identifier. |
| `MeasurementStart` | XML object | Signed start meter reading. |
| `MeasurementEnd` | XML object | Signed stop meter reading. |

## Measurement Fields

| Field | Format | Notes |
|-------|--------|-------|
| `TimestampCustomerIdent` | ISO 8601 with offset | Optional override for the charging-process level value. |
| `Timestamp` | ISO 8601 with offset | Meter reading timestamp. |
| `Signature` | 96 or 100 hexadecimal chars | Raw ECDSA `r || s`, optionally followed by two log bytes. |
| `EventCounter` | decimal integer | Used as log bytes when the signature is exactly 48 bytes. |
| `MeterStatus` | decimal integer | Low byte is stored in the signed payload. |
| `Value` | decimal integer | Raw meter value in Wh before applying `Scaler`. |
| `Scaler` | decimal integer | Exponent. Example: `-1` means `Value * 10^-1 Wh`. |
| `Pagination` | decimal integer | Must increase from START to STOP. |
| `SecondIndex` | decimal integer | Meter second index, stored little endian. |

## Signed Payload

The signed payload is exactly 320 bytes. Mennekes fills the fields up to byte
172. Bytes 173 through 319 remain zero.

| Offset | Length | Field | Byte order |
|--------|--------|-------|------------|
| 0 | 10 | Server ID | as hex bytes |
| 10 | 4 | Measurement timestamp | little endian local epoch seconds |
| 14 | 1 | Meter status | low byte |
| 15 | 4 | Second index | little endian |
| 19 | 4 | Pagination | little endian |
| 23 | 6 | OBIS ID | `01 00 01 11 00 ff` |
| 29 | 1 | Unit | `1e` for Wh |
| 30 | 1 | Scaler | signed byte stored as unsigned |
| 31 | 8 | Meter value | little endian |
| 39 | 2 | Log bytes | event counter or signature suffix |
| 41 | 128 | Customer ident | hex bytes, zero padded |
| 169 | 4 | Customer ident timestamp | little endian local epoch seconds |
| 173 | 147 | Reserved | zero filled |

The OBIS code represented by the byte sequence is:

```text
1-0:1.17.0*255
```

Chargy exposes it as the `ENERGY_TOTAL` measurement.

## Timestamp Conversion

The timestamp conversion intentionally reproduces the Java reference behavior.
The UTC epoch seconds of the ISO timestamp are calculated first, then the ISO
offset is added again:

```text
localEpochSeconds = utcEpochSeconds + offsetSeconds
```

Example:

```text
2018-09-04T12:22:14+02:00
UTC epoch:          1536056534
offset seconds:          7200
Mennekes epoch:     1536063734
```

This value is then encoded as a 4 byte integer and reversed into little endian
order for the signed payload.

## Signature Verification

The cryptographic parameters are:

| Parameter | Value |
|-----------|-------|
| Curve | secp192r1 / NIST P-192 |
| Algorithm | ECDSA |
| Hash | SHA-256 over the 320 byte payload |
| Hash truncation | first 24 bytes of SHA-256 |
| Public key | raw `X || Y`, 48 bytes, hex encoded |
| Signature | raw `r || s`, 48 bytes, hex encoded |

If the XML signature contains 50 bytes, Chargy uses the first 48 bytes as the
ECDSA signature and the final two bytes as the log bytes in the signed payload.
If the XML signature contains 48 bytes, Chargy derives the log bytes from
`EventCounter` as high byte / low byte.

Chargy verifies the signature through the existing browser-compatible
`elliptic`/`ACrypt` infrastructure rather than Node's `crypto` module.

## Validation Notes

Chargy separates parsing, cryptographic verification and simple legal
consistency checks:

1. Parsing checks that the required XML elements are present and have usable
   numeric or hexadecimal values.
2. Signature verification checks START and STOP independently.
3. Consistency validation checks that START and STOP have the same
   `EventCounter`, that `Pagination` increases, and that the meter value does
   not decrease.

Changing any signed field, such as `Value`, `Timestamp`, `SecondIndex`,
`Pagination`, `CustomerIdent` or `ServerId`, must invalidate the corresponding
signature.

## Test Fixtures

The Mennekes XML examples used by the test suite live in:

```text
tests/fixtures/Mennekes/test1.xml
tests/fixtures/Mennekes/test2.xml
```

`test1.xml` is a standalone `ChargingProcess` without a namespace.
`test2.xml` is a `Billing` document with the official Mennekes namespace and one
embedded `ChargingProcess`.

