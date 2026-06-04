/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import { Chargy }             from './chargy'
import { Alfen }              from './Alfen'
import { OCMF }               from './OCMF'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'

export class SAFEXML  {

    private readonly chargy: Chargy;

    constructor(chargy: Chargy) {
        this.chargy  = chargy;
    }

    //#region tryToParseSAFEXML(XMLDocument)

    public async tryToParseSAFEXML(XMLDocument: Document) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        // The SAFE transparency software v1.0 does not understand its own
        // XML namespace. Therefore we have to guess the format.

        try
        {


            // <values>
            //     <value transactionId="..." context="Transaction.Begin">
            //         <signedData format="..." encoding="...">...</signedData>
            //         <publicKey encoding="...">...</publicKey>
            //     </value>
            //     <value transactionId="..." context="Transaction.End">
            //         <signedData format="..." encoding="...">...</signedData>
            //         <publicKey encoding="...">...</publicKey>
            //     </value>
            // </values>
            if (XMLDocument.documentElement?.nodeName  === "values" ||
                XMLDocument.documentElement?.localName === "values")
            {

                const signedDataValues          = new Array<string>();

                let   commonSignedDataFormat    = "";
                let   commonSignedDataEncoding  = "";
                let   commonPublicKeyEncoding   = "";
                let   commonPublicKey           = "";

                for (const value of chargyLib.getElementsByLocalName(XMLDocument, "value"))
                {

                    // The public key might be null or empty for some formats!
                    const publicKey   = chargyLib.getElementsByLocalName(value, "publicKey")[0];
                    const signedData  = chargyLib.getElementsByLocalName(value, "signedData")[0];

                    if (signedData != null)
                    {

                        const signedDataFormat = signedData.attributes.getNamedItem("format")?.  value?.trim()?.toLowerCase() ?? "";

                        if (commonSignedDataFormat === "")
                            commonSignedDataFormat = signedDataFormat;
                        else if (signedDataFormat !== commonSignedDataFormat)
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different signed data formats within the given XML container!",
                                certainty:  0
                            }


                        const signedDataEncoding = signedData.attributes.getNamedItem("encoding")?.value?.trim()?.toLowerCase() ?? "";

                        if (commonSignedDataEncoding === "")
                            commonSignedDataEncoding = signedDataEncoding;
                        else if (signedDataEncoding !== commonSignedDataEncoding)
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different signed data encodings within the given XML container!",
                                certainty:  0
                            }


                        const signedDataValue = signedData.textContent?.trim() ?? "";

                        if (chargyLib.IsNullOrEmpty(signedDataValue))
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "The signed data value within the given XML container must not be empty!",
                                certainty:  0
                            }


                        const publicKeyEncoding  = publicKey?.attributes.getNamedItem("encoding")?.value?.trim()?.toLowerCase() ?? "";

                        if (commonPublicKeyEncoding === "")
                            commonPublicKeyEncoding = publicKeyEncoding;
                        else if (publicKeyEncoding !== commonPublicKeyEncoding)
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different public key encodings within the given XML container!",
                                certainty:  0
                            }

                        if (commonPublicKeyEncoding !== ""    &&
                            commonPublicKeyEncoding !== "hex" &&
                            commonPublicKeyEncoding !== "plain" )
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Unkown public key encoding within the given XML container!",
                                certainty:  0
                            }


                        const publicKeyValue  = publicKey?.textContent?.trim()?.replace(/\s+/g, "") ?? "";

                        if (commonPublicKey === "")
                            commonPublicKey = publicKeyValue;
                        else if (publicKeyValue !== commonPublicKey)
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different public keys within the given XML container!",
                                certainty:  0
                            }

                        switch (commonSignedDataEncoding)
                        {

                            case "":
                            case "plain":
                                signedDataValues.push(Buffer.from(signedDataValue, 'utf8').toString().trim());
                                break;

                            case "base32":
                                signedDataValues.push(Buffer.from(this.chargy.base32Decode(signedDataValue, 'RFC4648')).toString().trim());
                                break;

                            case "base64":
                                signedDataValues.push(Buffer.from(signedDataValue, 'base64').toString().trim());
                                break;

                            case "hex": // Some people put whitespaces, '-' or ':' into the hex format!
                                signedDataValues.push(Buffer.from(signedDataValue.replace(/[^a-fA-F0-9]/g, ''), 'hex').toString().trim());
                                break;

                            default:
                                return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   "Unkown signed data encoding within the given SAFE XML!",
                                    certainty:  0
                                }

                        }

                    }

                }

                if (signedDataValues.length > 0)
                {

                    switch (commonSignedDataFormat)
                    {

                        case "alfen":
                            return await new Alfen(this.chargy).
                                             TryToParseALFENFormat(
                                                 signedDataValues,
                                                 {}
                                             );

                        case "ocmf":
                            return await new OCMF(this.chargy).
                                             TryToParseOCMFDocuments(
                                                 signedDataValues,
                                                 commonPublicKey,
                                                 commonPublicKeyEncoding
                                             );

                        default:
                            return {
                                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:    this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                                certainty:  0
                            }

                    }
                }

            }

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

        return {
            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:    this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
            certainty:  0
        }

    }

    //#endregion

}
