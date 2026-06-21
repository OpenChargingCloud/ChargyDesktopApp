import { describe, expect, test } from 'vitest';
import './testHelper';   // Mocks 'pdfjs-dist' and stubs 'window' before chargy.ts is imported!
import { Chargy } from '@open-charging-cloud/chargy-core';
import { OCPI } from '@open-charging-cloud/chargy-core';
import { createTestChargy } from './chargyTestRuntime';


describe('OCPI Tests', () => {

    test("Old chargeIT container with OCMF data merges placeInfo and meterInfo into the CTR", async () => {

        const result = await new OCPI(createTestChargy(Chargy)).tryToParseOCPIFormat({

            "placeInfo": {
                "evseId": "DE*GEF*EVSE*CI*TESTS*2*B*1",
                "geoLocation": {
                    "lat": 50.387945,
                    "lon": 10.4304
                },
                "address": {
                    "street":  "Biberweg 18",
                    "zipCode": "53111",
                    "town":    "Bonn"
                }
            },

            "meterInfo": {
                "manufacturerURL": "https://www.phoenixcontact.com",
                "hardwareVersion": "r1.0"
            },

            "encoding_method": "OCMF",
            "public_key":      "3056301006072A8648CE3D020106052B8104000A034200044E4970098EEFF5E0E286E3A38552679771B89315A49DDDF66EBAC6F176FB02DF9841091010E6850510540DAD0CF967FD8DE0AB25198282B39597DDCE09EDF459",
            "signed_values": [
                {
                    "signed_data": 'OCMF|{"FV":"0.1","VI":"ABL","VV":"1.4p3","PG":"T12345","MV":"Phoenix Contact","MM":"EEM-350-D-MCB","MS":"BQ27400330016","MF":"1.0","IS":"VERIFIED","IF":["RFID_PLAIN","OCPP_RS_TLS"],"IT":"ISO14443","ID":"1F2D3A4F5506C7","RD":[{"TM":"2018-07-24T13:22:04,000+0200 S","TX":"B","RV":2935.6,"RI":"1-b:1.8.e","RU":"kWh","EI":567,"ST":"G"}]}|{"SA":"ECDSA-secp256k1-SHA256","SD":"3046022100A7F1FD39278A88432E1AB81229C34CE1066885D0EAD8810DB900018A4960888302210089004420623749BF75561F29685CD87D6853EC08E83BD1A15C5DAFF9F03F4115"}'
                }
            ]

        });

        expect(result).toMatchObject({

            chargingPools: [{
                chargingStations: [{
                    geoLocation:  { lat: 50.387945, lng: 10.4304 },
                    address:      { street: "Biberweg 18", postalCode: "53111", city: "Bonn" },
                    EVSEs: [{
                        "@id":    "DE*GEF*EVSE*CI*TESTS*2*B*1",
                        meters: [{
                            "@id":              "BQ27400330016",
                            // The signed OCMF payload values always win...
                            "manufacturer":     "Phoenix Contact",
                            "model":            "EEM-350-D-MCB",
                            "firmwareVersion":  "1.0",
                            // ...the container infos only fill the gaps!
                            "manufacturerURL":  "https://www.phoenixcontact.com",
                            "hardwareVersion":  "r1.0"
                        }]
                    }]
                }]
            }],

            chargingSessions: [{
                EVSEId: "DE*GEF*EVSE*CI*TESTS*2*B*1"
            }]

        });

    });

});
