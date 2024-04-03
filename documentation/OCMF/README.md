# Open Charge Metering Format (OCMF)

The Chargy Transparency Software supports the [Open Charge Metering Format (OCMF)](https://github.com/SAFE-eV/OCMF-Open-Charge-Metering-Format) from version __v1.0__ up to the latest __v1.2__.

## Parsing OCMF documents

The general structure of an OCMF document is the following:

```
OCMF|<payload>|<signature>
```

Our OCMF parser understands OCMF data on a singe line or on multiple lines. Even within the embedded JSON you can use newline characters, e.g. to pretty print the JSON document:

```
OCMF|{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}
```

```
OCMF|
{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|
{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}
```

```
OCMF|
{
    "FV": "1.0",
    "GI": "SEAL AG",
    "GS": "1850006a",
    "GV": "1.34",
    "PG": "T9289",
    "MV": "Carlo Gavazzi",
    "MM": "EM340-DIN.AV2.3.X.S1.PF",
    "MS": "******240084S",
    "MF": "B4",
    "IS": true,
    "IL": "TRUSTED",
    "IF": [
        "OCCP_AUTH"
    ],
    "IT": "ISO14443",
    "ID": "56213C05",
    "RD": [
        {
            "TM": "2019-06-26T08:57:44,337+0000 U",
            "TX": "B",
            "RV": 268.978,
            "RI": "1-b:1.8.0",
            "RU": "kWh",
            "RT": "AC",
            "EF": "",
            "ST": "G"
        }
    ]
}|
{
    "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
}
```

Multiple OCMF documents within e.g. a single text document are possible, e.g. for individual signed START and STOP meter values of a charging session. But a single OCMF document having a valid START and STOP meter value and just a single signature can already be a valid charge transparency record (_see also:_ [Limitations](Limitations)):

```
OCMF|<payload1>|<signature1>
OCMF|<payload2>|<signature2>
```

```
OCMF|
<payload1>|
<signature1>
OCMF|
<payload2>|
<signature2>
```


## Differences to the Specification

1. The specification defines that the `|` separator must not appear within the OCMF payload or signature sections. Despite this, Chargy is cautious about relying on vendors to remember this rule, particularly since the `|` character frequently appears in the free text section of charging tariffs. As a precaution, Chargy employs a stateful parser capable of handling the `|` character within the OCMF payload and signature sections.

2. The specification isn't clear on the correct handling of an empty `Identification Flags` (`IF`) property. Although the _Identification Flags_ array is __optional__, the expectation is that if it's empty, it should be sent as such rather than being omitted. However, it appears that vendors tend to remove this property altogether when it's empty. Therefore Chargy has to tread this property as ___optional___ when parsing OCMF documents.

3. The specification includes `ECDSA-secp384r1-SHA256` and `ECDSA-brainpool384r1-SHA256` algorithms. However, within the cryptographic community, there's a consensus that pairing these elliptic curves with the `SHA256` hash algorithm is not as secure as advertised. The concern arises because the 256-bit output of SHA256 is significantly smaller than the 384-bit block size of the ECC algorithms making the hash algorithm the weakest part of the entire algorithm. Chargy has implemented these algorithms to maintain interoperability, but it also supports the more secure pairings of `ECDSA-secp384r1-SHA384` and `ECDSA-brainpool384r1-SHA384` to address these severe security concerns.

4. `ISO 15118-20` specifies `SHA512` and `secp521r1` as the standard algorithms. Given this standard, it is reasonable to also support these algorithms in the context of the calibration law. Consequently, Chargy extends the OCMF specification to include `ECDSA-secp521r1-SHA512` signatures.



## Limitations

1. OCMF defines a container format designed to encapsulate multiple meter values, rather than focusing on individual signed meter values. Consequently, the OCMF signature serves to authenticate the entire container of meter values as a single entity, ___even when the individual meter values have very different timestamps___, instead of validating each meter value independently. This distinction has significant implications for its integration within EV roaming protocols such as OICP or OCPI. These protocols require that each charging session explicitly provides a START and STOP meter value, with each being digitally signed independently. Also for security reasons it is recommended not to group meter values of very different timestamps within a single OCMF document!

2. As OCMF does not define a __canonical format__ for the JSON serialization of the payload, we have to use the original payload _(ocmfRAWPayload)_ for calculating the signature. This means that non-functional JSON whitespaces can break the signature calculation and therefore inhibit a meaningful interoperability of the signature verification process with other data formats! While Chargy is capable of converting between the OCMF format and other Charge Transparency Formats, this conversion is only possible if the original digital signature was created using the canonical JSON representation of the OCMF payload.  This is a ___major design flaw___ in the OCMF standard!    
Some vendors for instance use a JSON serialization format like `OCMF|{"FV" : "1.0", "GI" : "SEAL AG", ...`.
This practice results in the previously mentioned interoperability issues. 
