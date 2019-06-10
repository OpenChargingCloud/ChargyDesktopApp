/*
 * Copyright (c) 2018-2019 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Mobile App <https://github.com/OpenChargingCloud/ChargyMobileApp>
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

    readonly description:  string;
    readonly GetMeter:     GetMeterFunc;

    readonly elliptic  = require('elliptic');
    readonly moment    = require('moment');
    // variable 'crypto' is already defined differently in Google Chrome!
    readonly crypt     = require('electron').remote.require('crypto');

    constructor(description:  string,
                GetMeter:     GetMeterFunc) { 

        this.description  = description;
        this.GetMeter     = GetMeter;

    }


    CreateLine(id:         string,
               value:      string|number,
               valueHEX:   string,
               infoDiv:    HTMLDivElement,
               bufferDiv:  HTMLDivElement)
    {

        var lineDiv = CreateDiv(infoDiv, "row");
                      CreateDiv(lineDiv, "id",    id);
                      CreateDiv(lineDiv, "value", (typeof value === "string" ? value : value.toString()));

        this.AddToBuffer(valueHEX, bufferDiv, lineDiv);

    }


    AddToBuffer(valueHEX:   string,
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
