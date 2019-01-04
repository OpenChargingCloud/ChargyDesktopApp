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

    AddToBuffer(text:         string,
                bufferValue:  HTMLDivElement,
                infoDiv:      HTMLDivElement) 
    {

        let newText = CreateDiv(bufferValue, "entry", text);

        newText.onmouseenter = function(this: GlobalEventHandlers, ev: MouseEvent) {
            infoDiv.children[0].classList.add("overEntry");
            infoDiv.children[1].classList.add("overEntry");
        }

        newText.onmouseleave = function(this: GlobalEventHandlers, ev: MouseEvent) {
            infoDiv.children[0].classList.remove("overEntry");
            infoDiv.children[1].classList.remove("overEntry");
        }

        infoDiv.onmouseenter = function(this: GlobalEventHandlers, ev: MouseEvent) {
            newText.classList.add("overEntry");
        }

        infoDiv.onmouseleave = function(this: GlobalEventHandlers, ev: MouseEvent) {
            newText.classList.remove("overEntry");
        }

    }

}
