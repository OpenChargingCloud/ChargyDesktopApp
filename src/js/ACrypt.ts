///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />

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
