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
import { ACrypt }             from './ACrypt'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import * as ocmf              from './OCMF'

export interface IOCMFv1_0MeasurementValue extends ocmf.IOCMFMeasurementValue
{
    statusMeter:                   string,
    secondsIndex:                  number,
    paginationId:                  string,
    logBookIndex:                  string
}

export interface IOCMFv1_0Result extends chargyInterfaces.ICryptoResult
{
    sha256value?:                  any,
    meterId?:                      string,
    meter?:                        chargyInterfaces.IMeter,
    timestamp?:                    string,
    infoStatus?:                   string,
    secondsIndex?:                 string,
    paginationId?:                 string,
    obis?:                         string,
    unitEncoded?:                  string,
    scale?:                        string,
    value?:                        string,
    logBookIndex?:                 string,
    authorizationStart?:           string,
    authorizationStop?:            string,
    authorizationStartTimestamp?:  string,
    publicKey?:                    string,
    publicKeyFormat?:              string,
    publicKeySignatures?:          any,
    signature?:                    chargyInterfaces.ISignatureRS
}


export class OCMFv1_0 extends ACrypt {

    readonly curve = new this.chargy.elliptic.ec('p256');

    constructor(chargy:  Chargy) {
        super("ECC secp192r1",
              chargy);
    }


    async VerifyChargingSession(chargingSession: chargyInterfaces.IChargingSession): Promise<chargyInterfaces.ISessionCryptoResult>
    {

        let sessionResult:chargyInterfaces.SessionVerificationResult = chargyInterfaces.SessionVerificationResult.Unvalidated;

        if (chargingSession.measurements)
        {
            for (var measurement of chargingSession.measurements)
            {

                measurement.chargingSession = chargingSession;

                // Must include at least two measurements (start & stop)
                if (measurement.values && measurement.values.length > 1)
                {

                    //#region Verify measurements...

                    for (var measurementValue of measurement.values)
                    {
                        measurementValue.measurement = measurement;
                        await this.VerifyMeasurement(measurementValue as IOCMFv1_0MeasurementValue);
                    }

                    //#endregion

                    //#region Find an overall result...

                    for (var measurementValue of measurement.values)
                    {
                        if (measurementValue.result)
                        {
                            switch (measurementValue.result.status)
                            {

                                // Unvalidated
                                // UnknownCTRFormat

                                case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.EnergyMeterNotFound;
                                    break;

                                case chargyInterfaces.VerificationResult.UnknownSignatureFormat:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.UnknownSignatureFormat;
                                    break;
    
                                case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.PublicKeyNotFound;
                                    break;

                                case chargyInterfaces.VerificationResult.UnknownPublicKeyFormat:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.UnknownPublicKeyFormat;
                                    break;

                                case chargyInterfaces.VerificationResult.InvalidPublicKey:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.InvalidPublicKey;
                                    break;

                                // InvalidMeasurement
                                // InvalidStartValue
                                // InvalidIntermediateValue
                                // InvalidStopValue

                                case chargyInterfaces.VerificationResult.InvalidSignature:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.InvalidSignature;
                                    break;

                                // NoOperation
                                // StartValue
                                // IntermediateValue
                                // StopValue

                                case chargyInterfaces.VerificationResult.ValidSignature:
                                    sessionResult = chargyInterfaces.SessionVerificationResult.ValidSignature;
                                    break;

                                // ValidStartValue
                                // ValidIntermediateValue
                                // ValidStopValue
                                // ValidationError

                            }
                        }

                        if (sessionResult !== chargyInterfaces.SessionVerificationResult.ValidSignature)
                            break;

                    }

                    //#endregion

                }

                else
                    sessionResult = chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired;

            }
        }

        return {
            status:    sessionResult,
            certainty: .5
        } ;

    }

    async VerifyMeasurement(measurementValue: IOCMFv1_0MeasurementValue): Promise<IOCMFv1_0Result>
    {

        measurementValue.method = this;

        // The measurement was already verified by the outer OCMF signature!

        return {
            status: measurementValue.result?.status ?? chargyInterfaces.VerificationResult.Unvalidated
        }

    }

    async ViewMeasurement(measurementValue:      IOCMFv1_0MeasurementValue,
                          introDiv:              HTMLDivElement,
                          infoDiv:               HTMLDivElement,
                          PlainTextDiv:          HTMLDivElement,
                          HashedPlainTextDiv:    HTMLDivElement,
                          PublicKeyDiv:          HTMLDivElement,
                          SignatureExpectedDiv:  HTMLDivElement,
                          SignatureCheckDiv:     HTMLDivElement)
    {

        if (!measurementValue.measurement  ||
            !measurementValue.ocmfDocument ||
            !measurementValue.measurement.chargingSession)
        {
            return {
                status: chargyInterfaces.VerificationResult.InvalidMeasurement
            }
        }

        const cryptoSpan      = introDiv.querySelector('#cryptoAlgorithm') as HTMLSpanElement;
        cryptoSpan.innerHTML  = measurementValue.ocmfDocument.publicKey && typeof(measurementValue.ocmfDocument.publicKey) !== 'string'
                                    ? "OCMFCrypt01 (" + measurementValue.ocmfDocument.publicKey.algorithm + ")"
                                    : "OCMFCrypt01";

        //#region Plain text

        if (PlainTextDiv)
        {

            if (PlainTextDiv.parentElement &&
                PlainTextDiv.parentElement &&
                PlainTextDiv.parentElement.children[0])
            {
                PlainTextDiv.parentElement.children[0].innerHTML  = "Plain text (OCMF|&lt;payload&gt;|&lt;signature&gt;)";
            }

            PlainTextDiv.innerHTML = '<span class="ocmfHighlight">OCMF</span>' + (measurementValue.ocmfDocument.raw?.substring(4) ?? "");

            const firstIndex = PlainTextDiv.innerHTML.indexOf('|');
            if (firstIndex !== -1) {
                PlainTextDiv.innerHTML = PlainTextDiv.innerHTML.substring(0, firstIndex) + '<span style="color: red;">|</span>' + PlainTextDiv.innerHTML.substring(firstIndex + 1);
            }

            const lastIndex = PlainTextDiv.innerHTML.lastIndexOf('|');
            if (lastIndex !== -1 && lastIndex !== firstIndex) { // Überprüfen, dass es nicht das gleiche Vorkommen ist
                PlainTextDiv.innerHTML = PlainTextDiv.innerHTML.substring(0, lastIndex) + '<span style="color: red;">|</span><span class="ocmfHighlight">' + PlainTextDiv.innerHTML.substring(lastIndex + 1) + '</span>';
            }

            PlainTextDiv.style.fontFamily  = "monospace";
            //PlainTextDiv.style.whiteSpace  = "pre";
            PlainTextDiv.style.maxHeight   = "25vh";
            PlainTextDiv.style.overflowY   = "scroll";

        }

        //#endregion

        //#region Hashed plain text

        if (HashedPlainTextDiv)
        {

            if (HashedPlainTextDiv.parentElement &&
                HashedPlainTextDiv.parentElement &&
                HashedPlainTextDiv.parentElement.children[0])
            {
                HashedPlainTextDiv.parentElement.children[0].innerHTML = "Hashed payload (" + measurementValue.ocmfDocument.hashAlgorithm + ")";
            }

            HashedPlainTextDiv.innerHTML  = measurementValue.ocmfDocument.hashValue?.match(/.{1,8}/g)?.join(" ")
                                                ?? "0x00000000000000000000000000000000000";

        }

        //#endregion

        //#region Public key

        if (PublicKeyDiv && measurementValue.ocmfDocument?.publicKey)
        {

            if (PublicKeyDiv.parentElement &&
                PublicKeyDiv.parentElement &&
                PublicKeyDiv.parentElement.children[0])
            {

                PublicKeyDiv.parentElement.children[0].innerHTML = typeof measurementValue.ocmfDocument?.publicKey === 'string'
                                                                       ? "Public Key"
                                                                       : "Public Key (" + measurementValue.ocmfDocument.publicKey.algorithm + ", " +
                                                                                          measurementValue.ocmfDocument.publicKey.encoding + ")";

            }

            PublicKeyDiv.innerHTML = typeof measurementValue.ocmfDocument.publicKey === 'string'
                                         ? measurementValue.ocmfDocument.publicKey
                                         : "der: " + (measurementValue.ocmfDocument.publicKey.value ?? "-") + "<br /><br />" +
                                           "x:   " +  measurementValue.ocmfDocument.publicKey.x.match(/.{1,8}/g)?.join(" ") + "<br />" +
                                           "y:   " +  measurementValue.ocmfDocument.publicKey.y.match(/.{1,8}/g)?.join(" ");

        }

        //#endregion

        //#region Public key signatures (optional)

        if (PublicKeyDiv &&
            PublicKeyDiv.parentElement &&
            PublicKeyDiv.parentElement &&
            PublicKeyDiv.parentElement.children[3])
        {
            PublicKeyDiv.parentElement.children[3].innerHTML = "";
        }

        const result = measurementValue.result as IOCMFv1_0Result;

        if (!chargyLib.IsNullOrEmpty(result.publicKeySignatures)) {

            for (const signature of result.publicKeySignatures)
            {

                try
                {

                    const signatureDiv = PublicKeyDiv?.parentElement?.children[3]?.appendChild(document.createElement('div'));

                    if (signatureDiv)
                        signatureDiv.innerHTML = await this.chargy.CheckMeterPublicKeySignature(measurementValue.measurement.chargingSession.chargingStation,
                                                                                                measurementValue.measurement.chargingSession.EVSE,
                                                                                                //@ts-ignore
                                                                                                measurementValue.measurement.chargingSession.EVSE.meters[0],
                                                                                                //@ts-ignore
                                                                                                measurementValue.measurement.chargingSession.EVSE.meters[0].publicKeys[0],
                                                                                                signature);

                }
                catch (exception)
                { }

            }

        }

        //#endregion

        //#region Signature expected

        if (SignatureExpectedDiv && measurementValue.ocmfDocument?.signature.SD)
        {

            if (SignatureExpectedDiv.parentElement &&
                SignatureExpectedDiv.parentElement  &&
                SignatureExpectedDiv.parentElement.children[0])
            {
                SignatureExpectedDiv.parentElement.children[0].innerHTML  = "Erwartete Signatur (rs, hex)";
            }

            SignatureExpectedDiv.innerHTML = "der: " +  measurementValue.ocmfDocument?.signature.SD + "<br /><br />" +
                                             "r:   " + (measurementValue.ocmfDocument?.signatureRS?.r?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") ?? "-") + "<br />" +
                                             "s:   " + (measurementValue.ocmfDocument?.signatureRS?.s?.toLowerCase().padStart(56, '0').match(/.{1,8}/g)?.join(" ") ?? "-");

        }

        //#endregion

        //#region Signature check

        if (SignatureCheckDiv && measurementValue.measurement.chargingSession.verificationResult)
        {
            switch (measurementValue.measurement.chargingSession.verificationResult.status)
            {

                // case SessionVerificationResult.UnknownCTRFormat:
                //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Unbekanntes Transparenzdatenformat</div>';
                //     break;

                // case SessionVerificationResult.EnergyMeterNotFound:
                //     signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Energiezähler</div>';
                //     break;

                case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültiger Public Key</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

                case chargyInterfaces.SessionVerificationResult.ValidSignature:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                    break;


                default:
                    SignatureCheckDiv.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">Ungültige Signatur</div>';
                    break;

            }
        }

        //#endregion

    }

}
