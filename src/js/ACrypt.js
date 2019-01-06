///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
var ACrypt = /** @class */ (function () {
    function ACrypt(description, GetMeter) {
        this.elliptic = require('elliptic');
        this.moment = require('moment');
        // variable 'crypto' is already defined differently in Google Chrome!
        this.crypt = require('electron').remote.require('crypto');
        this.description = description;
        this.GetMeter = GetMeter;
    }
    ACrypt.prototype.CreateLine = function (id, value, valueHEX, infoDiv, bufferDiv) {
        var lineDiv = CreateDiv(infoDiv, "row");
        CreateDiv(lineDiv, "id", id);
        CreateDiv(lineDiv, "value", (typeof value === "string" ? value : value.toString()));
        this.AddToBuffer(valueHEX, bufferDiv, lineDiv);
    };
    ACrypt.prototype.AddToBuffer = function (valueHEX, bufferDiv, lineDiv) {
        var newText = CreateDiv(bufferDiv, "entry", valueHEX);
        newText.onmouseenter = function (ev) {
            lineDiv.children[0].classList.add("overEntry");
            lineDiv.children[1].classList.add("overEntry");
        };
        newText.onmouseleave = function (ev) {
            lineDiv.children[0].classList.remove("overEntry");
            lineDiv.children[1].classList.remove("overEntry");
        };
        lineDiv.onmouseenter = function (ev) {
            newText.classList.add("overEntry");
        };
        lineDiv.onmouseleave = function (ev) {
            newText.classList.remove("overEntry");
        };
    };
    return ACrypt;
}());
