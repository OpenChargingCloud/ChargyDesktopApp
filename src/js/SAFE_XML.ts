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

class SAFEXML  {

    //#region tryToParseSAFEXML(XMLDocument)

    public async tryToParseSAFEXML(XMLDocument: Document) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        const base32Decode = require('base32-decode');

        // The SAFE transparency software v1.0 does not understand its own
        // XML namespace. Therefore we have to guess the format.

        try
        {

            let commonFormat           = "";
            let commonPublicKey        = "";
            let signedValues:string[]  = [];

            let values = XMLDocument.querySelectorAll("values");
            if (values.length == 1)
            {
                let valueList = values[0].querySelectorAll("value");
                if (valueList.length >= 1)
                {
                    for (let i=0; i<valueList.length; i++)
                    {

                        let signedDataEncoding  = "";
                        let signedDataFormat    = "";
                        let signedDataValue     = "";
                        let publicKeyEncoding   = "";
                        let publicKeyValue      = "";

                        //#region <signedData>...</signedData>

                        var signedData = valueList[i].querySelector("signedData");
                        if (signedData != null)
                        {

                            signedDataEncoding = signedData.attributes.getNamedItem("encoding") !== null ? signedData.attributes.getNamedItem("encoding")!.value.trim().toLowerCase() : "";
                            signedDataFormat   = signedData.attributes.getNamedItem("format")   !== null ? signedData.attributes.getNamedItem("format")!.value.trim().toLowerCase()   : "";
                            signedDataValue    = signedData.textContent                         !== null ? signedData.textContent.trim()                                              : "";

                            switch (signedDataEncoding)
                            {

                                case "":
                                case "plain":
                                    signedDataValue = Buffer.from(signedDataValue, 'utf8').toString().trim();
                                    break;

                                case "base32":
                                    signedDataValue = Buffer.from(base32Decode(signedDataValue, 'RFC4648')).toString().trim();
                                    break;

                                case "base64":
                                    signedDataValue = Buffer.from(signedDataValue, 'base64').toString().trim();
                                    break;

                                case "hex":
                                    signedDataValue = Buffer.from(signedDataValue, 'hex').toString().trim();
                                    break;

                                default:
                                    return {
                                        status:   SessionVerificationResult.InvalidSessionFormat,
                                        message:  "Unkown signed data encoding within the given SAFE XML!"
                                    }

                            }

                            switch (signedDataFormat)
                            {

                                case "alfen":
                                    if (commonFormat == "")
                                        commonFormat = "alfen";
                                    else if (commonFormat != "alfen")
                                        return {
                                            status:   SessionVerificationResult.InvalidSessionFormat,
                                            message:  "Invalid mixture of different signed data formats within the given SAFE XML!"
                                        }
                                    break;

                                case "ocmf":
                                    if (commonFormat == "")
                                        commonFormat = "ocmf";
                                    else if (commonFormat != "ocmf")
                                        return {
                                            status:   SessionVerificationResult.InvalidSessionFormat,
                                            message:  "Invalid mixture of different signed data formats within the given SAFE XML!"
                                        }
                                    break;

                                default:
                                    return {
                                        status:   SessionVerificationResult.InvalidSessionFormat,
                                        message:  "Unkown signed data formats within the given SAFE XML!"
                                    }

                            }

                            if (signedDataValue.isNullOrEmpty())
                                return {
                                    status:   SessionVerificationResult.InvalidSessionFormat,
                                    message:  "The signed data value within the given SAFE XML must not be empty!"
                                }

                            signedValues.push(signedDataValue);

                        }
                        else
                            return {
                                status:   SessionVerificationResult.InvalidSessionFormat,
                                message:  "The signed data tag within the given SAFE XML must not be empty!"
                            }

                        //#endregion

                        //#region <publicKey>...</publicKey>

                        // Note: The public key is optional!
                        var publicKey  = valueList[i].querySelector("publicKey");
                        if (publicKey != null)
                        {

                            publicKeyEncoding = publicKey.attributes.getNamedItem("encoding")   !== null ? publicKey.attributes.getNamedItem("encoding")!.value.trim().toLowerCase()  : "";
                            publicKeyValue    = publicKey.textContent                           !== null ? publicKey.textContent.trim()                                               : "";

                            switch (publicKeyEncoding)
                            {

                                case "":
                                case "plain":
                                    publicKeyValue = Buffer.from(publicKeyValue, 'utf8').toString().trim();
                                    break;

                                case "base32":
                                    publicKeyValue = Buffer.from(base32Decode(publicKeyValue, 'RFC4648')).toString().trim();
                                    break;

                                case "base64":
                                    publicKeyValue = Buffer.from(publicKeyValue, 'base64').toString().trim();
                                    break;

                                case "hex":
                                    publicKeyValue = Buffer.from(publicKeyValue, 'hex').toString().trim();
                                    break;

                                default:
                                    return {
                                        status:   SessionVerificationResult.InvalidSessionFormat,
                                        message:  "Unkown public key encoding within the given SAFE XML!"
                                    }

                            }

                            if (publicKeyValue.isNullOrEmpty())
                                return {
                                    status:   SessionVerificationResult.InvalidSessionFormat,
                                    message:  "The public key within the given SAFE XML must not be empty!"
                                }

                            else if (commonPublicKey == "")
                                commonPublicKey = publicKeyValue;

                            else if (publicKeyValue != commonPublicKey)
                                return {
                                    status:   SessionVerificationResult.InvalidSessionFormat,
                                    message:  "Invalid mixture of different public keys within the given SAFE XML!"
                                }

                        }

                        //#endregion

                    }
                }
            }

            switch (commonFormat)
            {

                case "alfen":
                    return await new Alfen01().tryToParseALFENFormat(signedValues);

                case "ocmf":
                    return await new OCMF().tryToParseOCMF2(signedValues, commonPublicKey);

            }

            return {
                status:   SessionVerificationResult.InvalidSessionFormat
            }

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

}
