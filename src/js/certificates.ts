/*
 * Copyright (c) 2018-2022 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class certificates {

    public GraphDefined:    any;
    public GraphDefinedCSO: any;
    public GraphDefinedEMP: any;

    constructor()
    {

        this.GraphDefined = {
            "@id":                    "6586r86f7f8d8f8f6s4w6d7df7f7tf86f7",
            "@context":               "https://open.charging.cloud/contexts/certificate+json",
            "name":                   "GraphDefined",
            "description": {
                "de":                 "GraphDefined GmbH"
            },
            "email":                  "mail@graphdefined.com",
            "web":                    "https://open.charging.cloud",
            "logoUrl":                "...",
            "revocationURLs":         [],
            "operations": {
                "signCertificates": {
                    "matchName":                   "*",
                    "matchEMail":                  "*",
                    "maxChilds":                   5
                },
                "provideCSOServices":              true,
                "provideEMPServices":              true,
                "signCommunicationEndpoints":      true,
                "signTarifs":                      true,
                "signMeterValues":                 true,
                "signEVSEAdminStatusChanges":      true,
                "signEVSEStatusChanges":           true,
                "signEVSEAvailablePowerChanges":   true,
                "signChargeDetailRecords":         true,
                "signTransparencyRecords":         true
            },
            "comment":                {
                "en":                 "Hello e-mobility world!"
            },
            "publicKeys": [
                {
                    "notBefore":      "2018-11-04T16:47:01Z",
                    "notAfter":       "2023-03-12T13:54:12Z",
                    "algorithm":      "secp192r1",
                    "format":         "DER",
                    "value":          "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                    "signatures":     [ ]
                },
                {
                    "notBefore":      "2020-11-04T16:47:01Z",
                    "notAfter":       "2030-03-12T13:54:12Z",
                    "algorithm":      "secp256k1",
                    "format":         "DER",
                    "value":          "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                    "signatures":     [ ]
                }
            ],
            "signatures": [
                {
                    "certificateId":    "6586r86f7f8d8f8f6s4w6d7df7f7tf86f7",
                    "notBefore":        "2018-11-04T16:47:01Z",
                    "notAfter":         "2023-03-12T13:54:12Z",
                    "comment": {
                        "en":           "A really useful service!"
                    },
                    "algorithm":        "secp192r1",
                    "format":           "DER",
                    "publicKey":        "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                    "value":            "303502181dce9223416d64e5362bc8eb46eddf23adcb74382b602e1f021900eca85b1a48bc1f64d25951e947c7e48fa0b070b82e2cae41"
                },
                {
                    "certificateId":    "6586r86f7f8d8f8f6s4w6d7df7f7tf86f7",
                    "notBefore":        "2018-11-04T16:47:01Z",
                    "notAfter":         "2023-03-12T13:54:12Z",
                    "comment": {
                        "en":           "A really useful service!"
                    },
                    "algorithm":        "secp256k1",
                    "format":           "DER",
                    "publicKey":        "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                    "value":            "304502210080f340e3d11a33dc9cb91583a4a487f7f76725aec690d38f459ee81c0438740802200f81bdfbf9c042699cdc0d8345dbbc3c78077e7952edf5fa648c1978b53649be"
                }
            ]
        };
        
        this.GraphDefinedCSO = {
            "@id":                    "sgfh9w43zt98w4gfh983qw",
            "@context":               "https://open.charging.cloud/contexts/chargingStationOperator/certificate",
            "name":                   "GraphDefinedCSO",
            "description": {
                "de":                 "Charging Station Operator Services"
            },
            "email":                  "mail@graphdefined.com",
            "web":                    "https://open.charging.cloud",
            "logoUrl":                "...",
            "eMobilityIds":           [ "DE*GEF" ],
            "operations": {
                "signCertificates": {
                    "matchId":                     "*",
                    "matchEMail":                  "*",
                    "matchEMobilityId":            "$DE\\*GEF",
                    "maxChilds":                   4
                },
                "CSOServices":                     true,
                "signCommunicationEndpoints":      true,
                "signTarifs":                      true,
                "signMeterValues":                 true,
                "signEVSEAdminStatusChanges":      true,
                "signEVSEStatusChanges":           true,
                "signEVSEAvailablePowerChanges":   true
            },
            "comment":                {
                "en":                 "Hello e-mobility world!"
            },
            "publicKeys": [
                {
                    "notBefore":      "2018-11-04T16:47:01Z",
                    "notAfter":       "2023-03-12T13:54:12Z",
                    "algorithm":      "secp192r1",
                    "format":         "DER",
                    "value":          "045dd7f4baef8cef4f6103bebab5bc8e74f80509b5fe806840466e8ada3b13d106c59b7a0f9503dfabfb23bcf46947ec67",
                    "signatures":     [ ]
                },
                {
                    "notBefore":      "2018-11-04T16:47:01Z",
                    "notAfter":       "2023-03-12T13:54:12Z",
                    "algorithm":      "secp256k1",
                    "format":         "DER",
                    "value":          "041921d6fe41ecfbc6fa47b2aa37339da45be76e675c9b677b83a838287e42799ab4dfeddbe8817d9cc2ad7108767e4e1add03028c5f335232384f55f8a3a90ea5",
                    "signatures":     [ ]
                }
            ],
            "signatures": [
                {
                    "certificateId":    "675efc9g97t68r67dzddd7d",
                    "comment": {
                        "en":           "A really useful charging service!"
                    },
                    "revocationURIs":   [],
                    "algorithm":        "secp256k1",
                    "format":           "DER",
                    "value":            "..."
                },
                {
                    "certificateId":    "6586r86f7f8d8f8f6s4w6d7df7f7tf86f7",
                    "comment": {
                        "en":           "A really useful charging service!"
                    },
                    "revocationURIs":   [],
                    "algorithm":        "secp256k1",
                    "format":           "DER",
                    "value":            "3045022100aa9f873cbe0b4305ee7ddf1526fb89a00fbbf2fb3fc3f1d7ba9c3a260523463002205bbdd0a3a0696e78f64e75515811e3e4ac00562eabe16ae244aa66e8814234e8"
                }
            ]
        };

        this.GraphDefinedEMP = {
            "@id":                    "675efc9g97t68r67dzddd7d",
            "@context":               "https://open.charging.cloud/contexts/eMobilityOperator/certificate",
            "name":                   "GraphDefinedEMP",
            "description": {
                "de":                 "E-Mobility Operator Services"
            },
            "email":                  "mail@graphdefined.com",
            "web":                    "https://open.charging.cloud",
            "logoUrl":                "...",
            "eMobilityIds":           [ "DE*GDF" ],
            "operations": {
                "signCertificates": {
                    "matchId":                     "*",
                    "matchEMail":                  "*",
                    "matchEMobilityId":            "$DE\\*GDF",
                    "maxChilds":                   4
                },
                "EMPServices":                     true,
                "signCommunicationEndpoints":      true,
                "signTarifs":                      true
            },
            "comment":                {
                "en":                 "Hello e-mobility world!"
            },
            "publicKeys": [
                {
                    "notBefore":      "2018-11-04T16:47:01Z",
                    "notAfter":       "2023-03-12T13:54:12Z",
                    "algorithm":      "secp192r1",
                    "format":         "DER",
                    "value":          "045dd7f4baef8cef4f6103bebab5bc8e74f80509b5fe806840466e8ada3b13d106c59b7a0f9503dfabfb23bcf46947ec67",
                    "signatures":     [ ]
                },
                {
                    "notBefore":      "2018-11-04T16:47:01Z",
                    "notAfter":       "2023-03-12T13:54:12Z",
                    "algorithm":      "secp256k1",
                    "format":         "DER",
                    "value":          "041921d6fe41ecfbc6fa47b2aa37339da45be76e675c9b677b83a838287e42799ab4dfeddbe8817d9cc2ad7108767e4e1add03028c5f335232384f55f8a3a90ea5",
                    "signatures":     [ ]
                }
            ],
            "signatures": [
                {
                    "certificateId":    "675efc9g97t68r67dzddd7d",
                    "comment": {
                        "en":           "A really useful charging service!"
                    },
                    "revocationURIs":   [],
                    "algorithm":        "secp256k1",
                    "format":           "DER",
                    "value":            "..."
                },
                {
                    "certificateId":    "6586r86f7f8d8f8f6s4w6d7df7f7tf86f7",
                    "comment": {
                        "en":           "A really useful charging service!"
                    },
                    "revocationURIs":   [],
                    "algorithm":        "secp256k1",
                    "format":           "DER",
                    "value":            "3045022100aa9f873cbe0b4305ee7ddf1526fb89a00fbbf2fb3fc3f1d7ba9c3a260523463002205bbdd0a3a0696e78f64e75515811e3e4ac00562eabe16ae244aa66e8814234e8"
                }
            ]
        };

    }

}
