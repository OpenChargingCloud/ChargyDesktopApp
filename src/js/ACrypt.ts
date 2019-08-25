/*
 * Copyright (c) 2018-2019 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

    readonly description:                   string;
    readonly GetMeter:                      GetMeterFunc;
    readonly CheckMeterPublicKeySignature:  CheckMeterPublicKeySignatureFunc;

    readonly elliptic: any;
    readonly moment:   any;
    // variable 'crypto' is already defined differently in Google Chrome!
    readonly crypt     = require('electron').remote.require('crypto');

    constructor(description:                   string,
                GetMeter:                      GetMeterFunc,
                CheckMeterPublicKeySignature:  CheckMeterPublicKeySignatureFunc) {

        this.description                   = description;
        this.GetMeter                      = GetMeter;
        this.CheckMeterPublicKeySignature  = CheckMeterPublicKeySignature;

        this.elliptic                      = require('elliptic');
        this.moment                        = require('moment');

    }

    protected pad(text: string|undefined, paddingValue: number) {

        if (text == null || text == undefined)
            text = "";

        return (text + Array(2*paddingValue).join('0')).substring(0, 2*paddingValue);

    };


    protected CreateLine(id:         string,
                         value:      string|number,
                         valueHEX:   string,
                         infoDiv:    HTMLDivElement,
                         bufferDiv:  HTMLDivElement)
    {

        var lineDiv = CreateDiv(infoDiv, "row");
                      CreateDiv(lineDiv, "id",    id);
                      CreateDiv(lineDiv, "value", (typeof value === "string" ? value : value.toString()));

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

    async sha256(message: DataView) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', message);// new TextEncoder().encode(message));
        const hashArray  = Array.from(new Uint8Array(hashBuffer));                                       // convert hash to byte array
        const hashHex    = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string
        return hashHex;
    }

    abstract VerifyChargingSession(chargingSession:   IChargingSession): ISessionCryptoResult;

    abstract SignMeasurement(measurementValue:        IMeasurementValue,
                             privateKey:              any,
                             publicKey:               any): ICryptoResult;

    abstract VerifyMeasurement(measurementValue:      IMeasurementValue): ICryptoResult;

    abstract ViewMeasurement(measurementValue:        IMeasurementValue,
                             introDiv:                HTMLDivElement,
                             infoDiv:                 HTMLDivElement,
                             bufferValue:             HTMLDivElement,
                             hashedBufferValue:       HTMLDivElement,
                             publicKeyValue:          HTMLDivElement,
                             signatureExpectedValue:  HTMLDivElement,
                             signatureCheckValue:     HTMLDivElement) : void;

}
