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
    ACrypt.prototype.AddToBuffer = function (text, bufferValue, infoDiv) {
        var newText = CreateDiv(bufferValue, "entry", text);
        newText.onmouseenter = function (ev) {
            infoDiv.children[0].classList.add("overEntry");
            infoDiv.children[1].classList.add("overEntry");
        };
        newText.onmouseleave = function (ev) {
            infoDiv.children[0].classList.remove("overEntry");
            infoDiv.children[1].classList.remove("overEntry");
        };
        infoDiv.onmouseenter = function (ev) {
            newText.classList.add("overEntry");
        };
        infoDiv.onmouseleave = function (ev) {
            newText.classList.remove("overEntry");
        };
    };
    return ACrypt;
}());
