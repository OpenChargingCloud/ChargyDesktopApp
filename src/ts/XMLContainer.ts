/*
 * Copyright (c) 2018-2024 GraphDefined GmbH <achim.friedland@graphdefined.com>
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
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import { EMHCrypt01 }         from './EMHCrypt01'
import { Alfen01 }            from './Alfen01'
import { OCMF }               from './OCMF'

interface XMLContainerCommonFormat {
    publicKey:             string;
    meterValueSignatures:  Array<string>;
    signatureMethod:       string;
    encodingMethod:        string;
    encodedMeterValues:    Array<string>;
}

export class XMLContainer {

    private readonly chargy: Chargy;

    constructor(chargy: Chargy) {
        this.chargy = chargy;
    }

    //#region tryToParseXMLContainer(XMLDocument)

    public async tryToParseXMLContainer(XMLDocument: Document) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            let common: XMLContainerCommonFormat = {
                publicKey:             "",
                meterValueSignatures:  [],
                signatureMethod:       "",
                encodingMethod:        "",
                encodedMeterValues:    []
            };

            let values = XMLDocument.querySelectorAll("signedMeterValues");
            if (values.length == 1)
            {

                const valueList = values[0]?.querySelectorAll("signedMeterValue");

                if (valueList        != null &&
                    valueList.length >= 1)
                {
                    for (let i=0; i<valueList.length; i++) {

                        //#region publicKey

                        // Note: The public key might be optional...
                        let publicKey = valueList[i]?.querySelector("publicKey");
                        if (publicKey != null)
                        {

                            let publicKeyEncoding  = publicKey.attributes.getNamedItem("encoding")?.value?.trim()?.toLowerCase() ?? "";
                            let publicKeyValue     = publicKey.textContent?.trim() ?? "";

                            switch (publicKeyEncoding)
                            {

                                case "":
                                case "plain":
                                    publicKeyValue = Buffer.from(publicKeyValue, 'utf8').toString().trim();
                                    break;

                                case "base32":
                                    publicKeyValue = Buffer.from(this.chargy.base32Decode(publicKeyValue, 'RFC4648')).toString().trim();
                                    break;

                                case "base64":
                                    publicKeyValue = Buffer.from(publicKeyValue, 'base64').toString().trim();
                                    break;

                                case "hex": // Some people put whitespaces, '-' or ':' into the hex format!
                                    publicKeyValue = Buffer.from(publicKeyValue.replace(/[^a-fA-F0-9]/g, ''), 'hex').toString().trim();
                                    break;

                                default:
                                    return {
                                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                        message:   "Unkown public key encoding within the given XML container!",
                                        certainty: 0
                                    }

                            }

                            if (chargyLib.IsNullOrEmpty(publicKeyValue))
                                return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   "The public key within the given XML container must not be empty!",
                                    certainty: 0
                                }

                            else if (common.publicKey == "")
                                common.publicKey = publicKeyValue;

                            else if (publicKeyValue != common.publicKey)
                                return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   "Invalid mixture of different public keys within the given XML container!",
                                    certainty: 0
                                }

                        }

                        //#endregion

                        //#region meterValueSignature

                        let meterValueSignature = valueList[i]?.querySelector("meterValueSignature");
                        if (meterValueSignature != null)
                        {

                            let meterValueSignatureEncoding  = meterValueSignature.attributes.getNamedItem("encoding")?.value?.trim()?.toLowerCase() ?? "";
                            let meterValueSignatureValue     = meterValueSignature.textContent?.trim() ?? "";

                            switch (meterValueSignatureEncoding)
                            {

                                case "":
                                case "plain":
                                    meterValueSignatureValue = Buffer.from(meterValueSignatureValue, 'utf8').toString().trim();
                                    break;

                                case "base32":
                                    meterValueSignatureValue = Buffer.from(this.chargy.base32Decode(meterValueSignatureValue, 'RFC4648')).toString().trim();
                                    break;

                                case "base64":
                                    meterValueSignatureValue = Buffer.from(meterValueSignatureValue, 'base64').toString().trim();
                                    break;

                                case "hex":
                                    meterValueSignatureValue = Buffer.from(meterValueSignatureValue, 'hex').toString().trim();
                                    break;

                                default:
                                    return {
                                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                        message:   "Unkown meter value signature encoding within the given XML container!",
                                        certainty: 0
                                    }

                            }

                            if (chargyLib.IsNullOrEmpty(meterValueSignatureValue))
                                return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   "The meter value signature within the given XML container must not be empty!",
                                    certainty: 0
                                }

                            common.meterValueSignatures.push(meterValueSignatureValue);

                        }

                        //#endregion

                        //#region signatureMethod

                        let signatureMethod = valueList[i]?.querySelector("signatureMethod")?.textContent?.trim()?.toLowerCase() ?? "";

                        if (common.signatureMethod == "")
                            common.signatureMethod = signatureMethod;

                        else if (common.signatureMethod != signatureMethod)
                            return {
                                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different signature methods within the given XML container!",
                                certainty:  0
                            }

                        //#endregion

                        //#region encodingMethod

                        let encodingMethod  = valueList[i]?.querySelector("encodingMethod")?.textContent?.trim()?.toLowerCase() ?? "";

                        if (common.encodingMethod == "")
                            common.encodingMethod = encodingMethod;

                        else if (common.encodingMethod != encodingMethod)
                            return {
                                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different signed data formats within the given XML container!",
                                certainty:  0
                            }

                        //#endregion

                        //#region encodedMeterValue

                        let encodedMeterValue = valueList[i]?.querySelector("encodedMeterValue");
                        if (encodedMeterValue != null)
                        {

                            let signedDataEncoding = encodedMeterValue.attributes.getNamedItem("encoding")?.value?.trim() ?? "";
                            let signedDataValue    = encodedMeterValue.textContent?.trim()                                ?? "";

                            switch (signedDataEncoding)
                            {

                                case "":
                                case "plain":
                                    signedDataValue = Buffer.from(signedDataValue, 'utf8').toString().trim();
                                    break;

                                case "base32":
                                    signedDataValue = Buffer.from(this.chargy.base32Decode(signedDataValue, 'RFC4648')).toString().trim();
                                    break;

                                case "base64":
                                    signedDataValue = Buffer.from(signedDataValue, 'base64').toString().trim();
                                    break;

                                case "hex":
                                    signedDataValue = Buffer.from(signedDataValue, 'hex').toString().trim();
                                    break;

                                default:
                                    return {
                                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                        message:   "Unkown signed data encoding within the given XML container!",
                                        certainty: 0
                                    }

                            }

                            if (chargyLib.IsNullOrEmpty(signedDataValue))
                                return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   "The signed data value within the given XML container must not be empty!",
                                    certainty: 0
                                }

                            common.encodedMeterValues.push(signedDataValue);

                        }
                        else
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "The signed data tag within the given XML container must not be empty!",
                                certainty: 0
                            }

                        //#endregion

                    }
                }

            }

            //ToDo: Convert this XML into Chargy JSON data structures!

            //switch (common.encodingMethod)
            //{

                //case "alfen":
                //    return await new Alfen01(this.chargy).tryToParseALFENFormat(signedValues);

                //case "ocmf":
                //    return await new OCMF(this.chargy).tryToParseOCMF2(signedValues, common.publicKey);

                //case "edl":
                //    return await new EMHCrypt01(this.chargy).try(signedValues, common.publicKey);

            //}

            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                certainty: 0
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

    }

    //#endregion

}
