/*
 * Copyright (c) 2018-2020 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

///<reference path="certificates.ts" />
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="Alfen01.ts" />
///<reference path="OCMFTypes.ts" />
///<reference path="OCMFv1_0.ts" />

class OCMF {

    //#region tryToParseOCMFv0_1(OCMFData, PublicKey?)

    private async tryToParseOCMFv0_1(OCMFData:    IOCMFData_v0_1,
                                     PublicKey?:  string) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        // {
        //     "FV": "0.1",
        //     "VI": "ABL",
        //     "VV": "1.4p3",
        //
        //     "PG": "T12345",
        //
        //     "MV": "Phoenix Contact",
        //     "MM": "EEM-350-D-MCB",
        //     "MS": "BQ27400330016",
        //     "MF": "1.0",
        //
        //     "IS": "VERIFIED",
        //     "IF": ["RFID_PLAIN", "OCPP_RS_TLS"],
        //     "IT": "ISO14443",
        //     "ID": "1F2D3A4F5506C7",
        //
        //     "RD": [{
        //         "TM": "2018-07-24T13:22:04,000+0200 S",
        //         "TX": "B",
        //         "RV": 2935.6,
        //         "RI": "1-b:1.8.e",
        //         "RU": "kWh",
        //         "EI": 567,
        //         "ST": "G"
        //     }]
        // }

        try
        {

            let VendorInformation  :string = OCMFData.VI != null ? OCMFData.VI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the vendor.
            let VendorVersion      :string = OCMFData.VV != null ? OCMFData.VV.trim() : ""; // Software version of the vendor.

            let paging             :string = OCMFData.PG != null ? OCMFData.PG.trim() : ""; // Paging, as this data might be part of a larger context.
            let transactionType     = OCMFTransactionTypes.undefined;
            switch (paging[0].toLowerCase())
            {

                case 't':
                    transactionType = OCMFTransactionTypes.transaction;
                    break;

                case 'f':
                    transactionType = OCMFTransactionTypes.fiscal;
                    break

            }
            let pagingId            = paging.substring(1);

            let MeterVendor        :string = OCMFData.MV != null ? OCMFData.MV.trim() : ""; // Vendor of the device, optional.
            let MeterModel         :string = OCMFData.MM != null ? OCMFData.MM.trim() : ""; // Model of the device, optional.
            let MeterSerial        :string = OCMFData.MS != null ? OCMFData.MS.trim() : ""; // Serialnumber of the device, might be optional.
            let MeterFirmware      :string = OCMFData.MF != null ? OCMFData.MF.trim() : ""; // Software version of the device.

            return {
                status:   SessionVerificationResult.InvalidSessionFormat
            }

        } catch (exception)
        {
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + exception.message
            }
        }

    }

    //#endregion

    //#region tryToParseOCMFv1_0(OCMFData, PublicKey?)

    public async tryToParseOCMF(OCMFValues:  IOCMFData_v1_0[],
                                PublicKey?:  string) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        try
        {

            var CTR:any = {

                "@id":       "1554181214441:-1965658344385548683:2",
                "@context":  "https://open.charging.cloud/contexts/CTR+json",
                "begin":     "2019-04-02T05:00:19Z",
                "end":       "2019-04-02T05:13:52Z",
                "description": {
                    "de":        "Alle OCMF-Ladevorgänge"
                },
                "contract": {
                    "@id":       "8057F5AA592904",
                    "type":      "RFID_TAG_ID",
                    "username":  "",
                    "email":     ""
                },
    
                "EVSEs": [{
                    "@id": "DE*BDO*E8025334492*2",
                    "meters": [{
                        "@id":              "0901454D48000083E076",
                        "vendor":           "EMH",
                        "vendorURL":        "http://www.emh-metering.de",
                        "model":            "eHZ IW8E EMH",
                        "hardwareVersion":  "1.0",
                        "firmwareVersion":  "123",
                        "signatureFormat":  "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                        "publicKeys": [{
                            "algorithm":        "secp192r1",
                            "format":           "DER",
                            "value":            "049EA8697F5C3126E86A37295566D560DE8EA690325791C9CBA79D30612B8EA8E00908FBAD5374812D55DCC3D809C3A36C",
                        }]
                    }]
    
                }],
    
                "chargingSessions": [{
    
                    "@id":                  "1554181214441:-1965658344385548683:2",
                    "@context":             "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json",
                    "begin":                null,
                    "end":                  null,
                    "EVSEId":               "DE*BDO*E8025334492*2",
    
                    "authorizationStart": {
                        "@id":              "8057F5AA592904",
                        "type":             "RFID_TAG_ID"
                    },
    
                    "signatureInfos": {
                        "hash":             "SHA512",
                        "hashTruncation":   "24",
                        "algorithm":        "ECC",
                        "curve":            "secp192r1",
                        "format":           "rs"
                    },
    
                    "measurements": [//{
    
                        // "energyMeterId":    "0901454D48000083E076",
                        // "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                        // "name":             "ENERGY_TOTAL",
                        // "obis":             "0100011100FF",
                        // "unit":             "WATT_HOUR",
                        // "unitEncoded":      30,
                        // "valueType":        "Integer64",
                        // "scale":            -1,
    
                        // "signatureInfos": {
                        //     "hash":            "SHA512",
                        //     "hashTruncation":  "24",
                        //     "algorithm":       "ECC",
                        //     "curve":           "secp192r1",
                        //     "format":          "rs"
                        // },
    
                        // "values": [
                        // {
                        //     "timestamp":        "2019-04-02T07:00:19+02:00",
                        //     "value":            "66260",
                        //     "infoStatus":       "08",
                        //     "secondsIndex":     65058,
                        //     "paginationId":     "00000012",
                        //     "logBookIndex":     "0006",
                        //     "signatures": [{
                        //         "r":    "71F76A80F170F87675AAEB19606BBD298355FDA7B0851700",
                        //         "s":    "2FAD322FA073255BD8B971BD69BFF051BCA9330703172E3C"
                        //     }]
                        // },
                        // {
                        //     "timestamp":        "2019-04-02T07:13:52+02:00",
                        //     "value":            "67327",
                        //     "infoStatus":       "08",
                        //     "secondsIndex":     65871,
                        //     "paginationId":     "00000013",
                        //     "logBookIndex":     "0006",
                        //     "signatures": [{
                        //         "r":    "6DF01D7603CB49BB76141F8E67B371351BF1F87C1F8D38AE",
                        //         "s":    "B3600A9432B8CE0A378126D4FB9D9581457651A5D208AD9E"
                        //     }]
                        // }
                    ]
    
                }]
    
             //   }]
            };

            // [  // Not standard compliant use of an array!
            //
            //   {
            //
            //       "FV": "1.0",
            //       "GI": "SEAL AG",
            //       "GS": "1850006a",
            //       "GV": "1.34",
            //
            //       "PG": "T9289",
            //
            //       "MV": "Carlo Gavazzi",
            //       "MM": "EM340-DIN.AV2.3.X.S1.PF",
            //       "MS": "******240084S",
            //       "MF": "B4",
            //
            //       "IS": true,
            //       "IL": "TRUSTED",
            //       "IF": ["OCCP_AUTH"],
            //       "IT": "ISO14443",
            //       "ID": "56213C05",
            //
            //       "RD": [{
            //           "TM": "2019-06-26T08:57:44,337+0000 U",
            //           "TX": "B",
            //           "RV": 268.978,
            //           "RI": "1-b:1.8.0",
            //           "RU": "kWh",
            //           "RT": "AC",
            //           "EF": "",
            //           "ST": "G"
            //       }],
            //
            //       "__signature": {      // Not standard compliant property key!
            //           "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
            //       }
            //
            //   },
            //
            //   [...]
            //
            // ]

            for (let OCMFData of OCMFValues)
            {

                let GatewayInformation :string    = OCMFData.GI != null ? OCMFData.GI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the gateway.
                let GatewaySerial      :string    = OCMFData.GS != null ? OCMFData.GS.trim() : ""; // Serial number of the gateway, might be mandatory.
                let GatewayVersion     :string    = OCMFData.GV != null ? OCMFData.GV.trim() : ""; // Software version of the gateway.

                let paging             :string    = OCMFData.PG != null ? OCMFData.PG.trim() : ""; // Paging, as this data might be part of a larger context.
                let TransactionType               = OCMFTransactionTypes.undefined;
                switch (paging[0].toLowerCase())
                {

                    case 't':
                        TransactionType = OCMFTransactionTypes.transaction;
                        break;

                    case 'f':
                        TransactionType = OCMFTransactionTypes.fiscal;
                        break

                }
                let Pagination                    = paging.substring(1);

                let MeterVendor         :string   = OCMFData.MV != null ? OCMFData.MV.trim() : "";    // Vendor of the device, optional.
                let MeterModel          :string   = OCMFData.MM != null ? OCMFData.MM.trim() : "";    // Model of the device, optional.
                let MeterSerial         :string   = OCMFData.MS != null ? OCMFData.MS.trim() : "";    // Serialnumber of the device, might be optional.
                let MeterFirmware       :string   = OCMFData.MF != null ? OCMFData.MF.trim() : "";    // Software version of the device.

                let IdentificationStatus:boolean  = OCMFData.IS != null ? OCMFData.IS        : false; // true, if user is assigned, else false.
                let IdentificationLevel :string   = OCMFData.IL != null ? OCMFData.IL.trim() : "";    // optional
                let IdentificationFlags :string[] = OCMFData.IF != null ? OCMFData.IF        : [];    // optional
                let IdentificationType  :string   = OCMFData.IT != null ? OCMFData.IT.trim() : "";    // The type of the authentication data.
                let IdentificationData  :string   = OCMFData.ID != null ? OCMFData.ID.trim() : "";    // The authentication data.

                let ChargePointIdType   :string   = OCMFData.CT != null ? OCMFData.CT.trim() : "";    // Type of the following ChargePointId: EVSEId|ChargingStationId|...
                let ChargePointId       :string   = OCMFData.CI != null ? OCMFData.CI.trim() : "";    // The identification of the charge point

                if (!OCMFData.RD || OCMFData.RD.length == 0)
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Each OCMF data set must have at least one meter reading!"
                    }

                for (let reading of OCMFData.RD)
                {

                    let metaTimestamp       = reading.TM.split(' ');
                    let Timestamp           = metaTimestamp[0];
                    let TimeStatus          = metaTimestamp[1];
                    let Transaction         = reading.TX;   // B|C,X|E,L,R,A,P|S|T | null
                    let Value               = reading.RV;   // typeof RV == 'number', but MUST NOT be rounded!
                    let OBIS                = reading.RI;   // OBIS-Code
                    let Unit                = reading.RU;   // Reading-Unit: kWh, ...
                    let CurrentType         = reading.RT;   // Reading-Current-Type
                    let ErrorFlags          = reading.EF;   // Error-Flags
                    let Status              = reading.ST;   // Status

                    if (CTR.chargingSessions[0].begin == null)
                        CTR.chargingSessions[0].begin = Timestamp;

                    CTR.chargingSessions[0].end = Timestamp;

                    if (CTR.chargingSessions[0].measurements.length == 0)
                        CTR.chargingSessions[0].measurements.push({
                            "energyMeterId":    MeterSerial,
                            "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                            "obis":             OBIS,        // "1-b:1.8.0"
                            "unit":             Unit,        // "kWh"
                            "currentType":      CurrentType, // "AC"
                            "values":           []
                        });

                    CTR.chargingSessions[0].measurements[0].values.push({
                        "timestamp":        Timestamp,          // "2019-06-26T08:57:44,337+0000"
                        "timeStatus":       TimeStatus,         // "U"
                        "transaction":      Transaction,        // "B"
                        "value":            Value,              // 2935.6
                        "transactionType":  TransactionType,    // "T"
                        "pagination":       Pagination,         // "9289"
                        "errorFlags":       ErrorFlags,         // ""
                        "status":           Status,             // "G"
                        "signatures": [{
                            "value": OCMFData["__signature"]["SD"]
                        }]
                    });

                }

                CTR.begin = CTR.chargingSessions[0].begin;
                CTR.end   = CTR.chargingSessions[0].end;

                CTR.chargingSessions[0].authorizationStart["@id"] = OCMFData.ID;
                CTR.chargingSessions[0].authorizationStart["type"] = OCMFData.IT;
                CTR.chargingSessions[0].authorizationStart["IS"] = OCMFData.IS;
                CTR.chargingSessions[0].authorizationStart["IL"] = OCMFData.IL;
                CTR.chargingSessions[0].authorizationStart["IF"] = OCMFData.IF;

            }

            return CTR;

        }
        catch (exception)
        {
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + exception.message
            }
        }

    }

    //#endregion


    //#region Try

    public async tryToParseOCMF2(OCMFValues:  string|string[],
                                 PublicKey?:  string) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        let commonVersion          = "";
        let OCMFDataList:Object[]  = [];

        if (typeof OCMFValues === 'string')
            OCMFValues = [ OCMFValues ];

        for (let OCMFValue of OCMFValues)
        {

            // OCMF|{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}
            let OCMFSections = OCMFValue.split('|');

            if (OCMFSections.length == 3)
            {

                if (OCMFSections[0] !== "OCMF")
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "The given data does not have a valid OCMF header!"
                    }

                let OCMFVersion           = "";
                let OCMFData:Object       = {};
                let OCMFSignature:Object  = {};

                try
                {

                    // http://hers.abl.de/SAFE/Datenformat_OCMF/Datenformat_OCMF_v1.0.pdf
                    // Ein Darstellungsformat, JSON-basiert (nachvollziehbar)
                    // Ein Übertragungsformat, JSON-basiert (vereinheitlicht)
                    //
                    // {
                    //     "FV": "1.0",
                    //     "GI": "SEAL AG",
                    //     "GS": "1850006a",
                    //     "GV": "1.34",
                    //
                    //     "PG": "T9289",
                    //
                    //     "MV": "Carlo Gavazzi",
                    //     "MM": "EM340-DIN.AV2.3.X.S1.PF",
                    //     "MS": "******240084S",
                    //     "MF": "B4",
                    //
                    //     "IS": true,
                    //     "IL": "TRUSTED",
                    //     "IF": ["OCCP_AUTH"],
                    //     "IT": "ISO14443",
                    //     "ID": "56213C05",
                    //
                    //     "RD": [{
                    //         "TM": "2019-06-26T08:57:44,337+0000 U",
                    //         "TX": "B",
                    //         "RV": 268.978,
                    //         "RI": "1-b:1.8.0",
                    //         "RU": "kWh",
                    //         "RT": "AC",
                    //         "EF": "",
                    //         "ST": "G"
                    //     }]
                    // }
                    // {
                    //     "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
                    // }

                    OCMFData       = JSON.parse(OCMFSections[1]);
                    OCMFSignature  = JSON.parse(OCMFSections[2]);
                    OCMFVersion    = OCMFData["FV"] != null ? OCMFData["FV"].trim() : ""; 

                }
                catch (exception)
                {
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Could not parse the given OCMF data!"
                    }
                }

                if (OCMFData      == null || OCMFData      == {})
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Could not parse the given OCMF data!"
                    }

                if (OCMFSignature == null || OCMFSignature == {})
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Could not parse the given OCMF signature!"
                    }

                if (commonVersion == "")
                    commonVersion = OCMFVersion;
                else
                    if (OCMFVersion != commonVersion)
                        "Invalid mixture of different OCMF versions within the given SAFE XML!";

                OCMFData["__signature"] = OCMFSignature;

                OCMFDataList.push(OCMFData);

            }

            else
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "The given data is not valid OCMF!"
                }

        }

        if (OCMFDataList.length == 1)
            return {
                status:   SessionVerificationResult.AtLeastTwoMeasurementsRequired,
                message:  "At least two OCMF measurements are required!"
            }

        if (OCMFDataList.length >= 2)
        {
            switch (commonVersion)
            {

                // case "0.1":
                //     return await this.tryToParseOCMFv0_1(OCMFDataList as IOCMFData_v0_1[], PublicKey);

                case "1.0":
                    return await this.tryToParseOCMF(OCMFDataList as IOCMFData_v1_0[], PublicKey);

                default:
                    return {
                        status:   SessionVerificationResult.InvalidSessionFormat,
                        message:  "Unknown OCMF version!"
                    }

            }
        }

        return {
            status:   SessionVerificationResult.InvalidSessionFormat,
            message:  "Unknown OCMF version!"
        }

    }

    //#endregion    


}
