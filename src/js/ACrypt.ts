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
 
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />

abstract class ACrypt {

    //#region Data

    readonly description:  string;
    readonly chargy:       Chargy;

    readonly curve192r1:   any;
    readonly curve224k1:   secp224k1;
    readonly curve256r1:   any;
    readonly curve384r1:   any;
    readonly curve521r1:   any;

    //#endregion

    constructor(description:  string,
                chargy:       Chargy) {

        this.description  = description;
        this.chargy       = chargy;

        // NIST/ANSI X9.62 named 192-bit elliptic curve: secp192r1
        // https://www.secg.org/sec2-v2.pdf
        this.curve192r1   = new this.chargy.elliptic.ec('p192');

        // Koblitz 224-bit curve: secp224k1
        // https://www.secg.org/sec2-v2.pdf
        this.curve224k1   = new secp224k1();

        // NIST/ANSI X9.62 named 256-bit elliptic curve: secp256r1
        // https://www.secg.org/sec2-v2.pdf
        this.curve256r1   = new this.chargy.elliptic.ec('p256');

        // NIST/ANSI X9.62 named 384-bit elliptic curve: secp384r1
        // https://www.secg.org/sec2-v2.pdf
        this.curve384r1   = new this.chargy.elliptic.ec('p384');

        // NIST/ANSI X9.62 named 521-bit elliptic curve: secp521r1
        // https://www.secg.org/sec2-v2.pdf
        this.curve521r1   = new this.chargy.elliptic.ec('p521');

    }

    //#region Protected methods

    protected CreateLine(id:         string,
                         value:      string|number,
                         valueHEX:   string,
                         infoDiv:    HTMLDivElement,
                         bufferDiv:  HTMLDivElement)
    {

        var lineDiv = CreateDiv(infoDiv, "row");
                      CreateDiv(lineDiv, "id",    id);
                      CreateDiv(lineDiv, "value", (typeof value === "string" ? value : value?.toString()));

        this.AddToVisualBuffer(valueHEX, bufferDiv, lineDiv);

    }

    protected AddToVisualBuffer(valueHEX:   string,
                                bufferDiv:  HTMLDivElement,
                                lineDiv:    HTMLDivElement)
    {

        let newText = CreateDiv(bufferDiv, "entry", valueHEX);

        newText.onmouseenter = function(this: GlobalEventHandlers, ev: MouseEvent) {
            lineDiv.children[0].classList.add("overEntry");
            lineDiv.children[1].classList.add("overEntry");
        }

        newText.onmouseleave = function(this: GlobalEventHandlers, ev: MouseEvent) {
            lineDiv.children[0].classList.remove("overEntry");
            lineDiv.children[1].classList.remove("overEntry");
        }

        lineDiv.onmouseenter = function(this: GlobalEventHandlers, ev: MouseEvent) {
            newText.classList.add("overEntry");
        }

        lineDiv.onmouseleave = function(this: GlobalEventHandlers, ev: MouseEvent) {
            newText.classList.remove("overEntry");
        }

    }

    //#endregion


    abstract GenerateKeyPair(): any;



    abstract SignChargingSession  (chargingSession:         IChargingSession,
                                   privateKey:              any):              Promise<ISessionCryptoResult>;

    abstract VerifyChargingSession(chargingSession:         IChargingSession): Promise<ISessionCryptoResult>;



    abstract SignMeasurement      (measurementValue:        IMeasurementValue,
                                   privateKey:              any):               Promise<ICryptoResult>;

    abstract VerifyMeasurement    (measurementValue:        IMeasurementValue): Promise<ICryptoResult>;

    abstract ViewMeasurement      (measurementValue:        IMeasurementValue,
                                   introDiv:                HTMLDivElement,
                                   infoDiv:                 HTMLDivElement,
                                   bufferValue:             HTMLDivElement,
                                   hashedBufferValue:       HTMLDivElement,
                                   publicKeyValue:          HTMLDivElement,
                                   signatureExpectedValue:  HTMLDivElement,
                                   signatureCheckValue:     HTMLDivElement) : void;

}
