# ALFEN Transparency Format

The ALFEN transparency format used by Chargy is a compact, line-oriented signed
meter value format. It is commonly transported inside a SAFE XML container as
`<signedData format="ALFEN">...</signedData>`, but Chargy also accepts raw
`AP;...` lines directly.

Each ALFEN line signs one meter value. A charging session therefore normally
contains at least two signed lines: one for the start value and one for the stop
value. Chargy verifies every line independently and then reports the overall
session as valid only when all included signed values verify.

## Transport Shapes

Chargy accepts ALFEN data in these forms:

| Shape | Example | Notes |
|-------|---------|-------|
| SAFE XML container | `<values><value><signedData format="ALFEN">AP;...</signedData></value></values>` | Main transport shape in the test fixtures. |
| SAFE XML with Chargy extensions | `<chargingStation>...</chargingStation>` plus signed values | Adds station, EVSE, connector and location metadata. |
| Raw text | `AP;0;3;...` | One or multiple newline-separated ALFEN lines. |
| Quoted raw text | `"AP;0;3;..."` | Chargy strips the surrounding quotes. |
| QR code image | PNG, JPEG, SVG | Chargy decodes the QR text and then parses the embedded XML/text. |

The SAFE XML parser also supports optional `signedData` encodings such as
`plain`, `base32`, `base64` and `hex` before handing the decoded ALFEN text to
the ALFEN parser.

## Line Structure

An ALFEN signed value is a semicolon-separated record:

```text
AP;<type>;3;<publicKey>;<dataSet>;<signature>;
```

The trailing semicolon is accepted. Without it the record has six fields;
with it the split result has seven fields.

Example:

```text
AP;0;3;AJB42AIR7NC5W5MCFWZHMIQD7SSYVIUCHYEJ7Z2E;BIHEIWSHAAA2WZUSOYYDCNWTWAFACRC2I4ADGAEFAYAAAABA6SLUQAB2NSTVYAIAAEEAB7Y6ACJVQAAAAAAAAABQGQ3UCN2BIJAUKMBVIM4DCAAAAAAAAAATAAAAAIYAAAAA====;X736PV2AD3IVH5LQJ4SPMZLMYNZNGOUBNLF23B7UBYAFOV6KXVPIMIVZJLKBNLJVSQAN7DJLMTWL2===;
```

## Fields

| Field | Name | Format | Notes |
|-------|------|--------|-------|
| `AP` | Format id | literal string | Required. |
| `<type>` | Value type | one character | Known values are `0` start, `1` stop, `2` intermediate. Chargy currently keeps input order as authoritative. |
| `3` | Blob version | literal string | Required current version. |
| `<publicKey>` | Public key | RFC4648 Base32 | Decodes to 25 bytes, secp192r1 compressed EC point. Must be equal for all lines in one session. |
| `<dataSet>` | Signed data set | RFC4648 Base32 | Decodes to exactly 82 bytes. |
| `<signature>` | Signature | RFC4648 Base32 | Decodes to exactly 48 bytes, raw `r || s`. |

Chargy rejects a session when public key, adapter id, adapter firmware version,
adapter checksum, meter id, OBIS id, unit, scalar, UID or internal session id
change between signed lines.

## Signed Data Set

The signed ALFEN data set is exactly 82 bytes. Numeric values are encoded little
endian unless noted otherwise.

| Offset | Length | Field | Notes |
|--------|--------|-------|-------|
| 0 | 10 | Adapter id | Hex encoded in Chargy display. |
| 10 | 4 | Adapter firmware version | ASCII text, for example `v014`. |
| 14 | 2 | Adapter firmware checksum | Hex encoded. |
| 16 | 10 | Meter id | Hex encoded. |
| 26 | 2 | Meter status | Stored little endian, displayed as reversed hex. |
| 28 | 2 | Adapter status | Stored little endian, displayed as reversed hex. |
| 30 | 4 | Second index | Signed 32-bit little endian. |
| 34 | 4 | Timestamp | Unix timestamp, little endian. |
| 38 | 6 | OBIS id | Parsed into standard OBIS notation. |
| 44 | 1 | Unit encoded | `0x1e` means Wh. |
| 45 | 1 | Scalar | Signed byte in the data set. |
| 46 | 8 | Meter value | Signed 64-bit little endian. |
| 54 | 20 | UID | ASCII authorization/customer id, null padded. |
| 74 | 4 | Internal session id | Signed 32-bit little endian. |
| 78 | 4 | Pagination counter | Signed 32-bit little endian. |

During verification Chargy reconstructs the same 82 byte payload from the parsed
Chargy measurement value and compares the ECDSA signature against that rebuilt
payload.

## Signature Verification

The cryptographic parameters are:

| Parameter | Value |
|-----------|-------|
| Curve | secp192r1 / NIST P-192 |
| Algorithm | ECDSA |
| Hash | SHA-256 over the 82 byte data set |
| Public key | Base32 encoded compressed secp192r1 point, 25 bytes decoded |
| Signature | Base32 encoded raw `r || s`, 48 bytes decoded |

The raw signature is split into two 24 byte numbers:

```text
r = signature[0..23]
s = signature[24..47]
```

Chargy verifies each measurement value with the public key embedded in the
ALFEN line itself. No external public key file is required for normal ALFEN
verification.

## SAFE XML Container

The common ALFEN XML form is:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<values>
  <value>
    <signedData format="ALFEN">AP;0;3;...;</signedData>
  </value>
  <value>
    <signedData format="ALFEN">AP;1;3;...;</signedData>
  </value>
</values>
```

Chargy routes this through the SAFE XML parser first. The SAFE parser collects
all `<signedData format="ALFEN">` values, checks that the signed-data format and
encoding are consistent, decodes them if needed, and passes the resulting ALFEN
lines to the ALFEN parser.

## Chargy Extensions

The SAFE XML container may include additional Chargy metadata:

```xml
<chargingStation id="DE*GEF*STATION*CI*TESTS*1*A"
                 xmlns="https://open.charging.cloud/CTR/2020/01">
  <description language="en">GraphDefined Charging Station</description>
  <softwareVersion>3.0.25.2089</softwareVersion>
  <geoLocation>
    <latitude>50.387945</latitude>
    <longitude>10.4304</longitude>
  </geoLocation>
  <EVSE id="DE*GEF*EVSE*CI*TESTS*1*A*1">
    <connector id="1">
      <type>Type-2</type>
    </connector>
  </EVSE>
</chargingStation>
```

Chargy uses this metadata for the generated CTR station, EVSE, connector,
software version and location fields. It is not part of the ALFEN signed data.

## Chargy Mapping

After parsing, Chargy creates one charge transparency record with one charging
session and one energy measurement.

| ALFEN source | Chargy field |
|--------------|--------------|
| Adapter id | measurement adapter id |
| Adapter firmware version | meter firmware version |
| Adapter firmware checksum | meter firmware checksum |
| Meter id | meter id / energy meter id |
| UID | authorization id / contract id |
| Internal session id | session id |
| OBIS id | measurement OBIS |
| Unit encoded | measurement unit code |
| Scalar | measurement scale |
| Meter value | measurement value |
| Timestamp | measurement timestamp |
| Pagination counter | measurement value pagination id |

The OBIS id is converted from the six raw bytes to standard notation, for
example:

```text
01 00 01 08 00 ff -> 1-0:1.8.0*255
```

`1-0:1.8.0*255` is displayed as `ENERGY_TOTAL`.

## Status Fields

Chargy decodes the two status words for display.

### Meter Status

The meter status covers meter-side conditions such as:

| Bit | Meaning |
|-----|---------|
| 0 | RTC error |
| 1 | EEPROM error |
| 2 | Dataflash error |
| 8 | Phase L1 failure |
| 9 | Phase L2 failure |
| 10 | Phase L3 failure |
| 11 | Phase sequence wrong |

### Adapter Status

The adapter status covers LMN adapter conditions such as:

| Bit | Meaning |
|-----|---------|
| 0 | Adapter fatal error |
| 10 | Stop and start meter reading mismatch |
| 11 | Intermediate command |
| 12 | Stop charge command |
| 13 | Start charge command |
| 14 | Adapter memory error |
| 15 | Meter communication error |

These status flags are part of the signed 82 byte data set.

## QR Code Support

ALFEN data is also tested as QR code content. Chargy can read PNG, JPEG and SVG
QR code images, extract the embedded XML/text, and then run the same SAFE/ALFEN
parsing path.

The QR fixtures live beside the XML fixtures:

```text
tests/fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.png
tests/fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.jpg
tests/fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg
```

## Test Fixtures

The primary ALFEN fixtures live in:

```text
tests/fixtures/ALFEN/
```

Important files:

| File | Purpose |
|------|---------|
| `ALFEN-Testdata-03_SAFEXMLContainer.xml` | Minimal SAFE XML container with ALFEN signed values. |
| `ALFEN-Testdata-03_SAFEXMLContainer_withExtensions.xml` | SAFE XML container with station, EVSE, connector and geolocation metadata. |
| `ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.*` | Same XML data encoded as QR code image. |
| `*.expected.txt` | Expected parser and verification summaries. |

Additional historical ALFEN examples are stored under:

```text
documentation/Alfen/
```

These are useful as reference material, but the active automated tests use the
fixtures under `tests/fixtures/ALFEN`.

## Validation Notes

Chargy distinguishes parsing, consistency checks and cryptographic
verification:

1. Parsing checks the `AP` prefix, blob version, decoded public key length,
   decoded data set length and decoded signature length.
2. Consistency checks ensure that all signed lines in one session refer to the
   same adapter, meter, OBIS id, unit, scalar, UID and internal session id.
3. Verification rebuilds the 82 byte payload and verifies each raw ECDSA
   signature with the embedded secp192r1 public key.

Changing any signed field inside the data set, or rebuilding the data set with a
different UID, session id, value, status, timestamp or pagination counter, must
invalidate the corresponding signature.

