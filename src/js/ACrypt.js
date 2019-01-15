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
    ACrypt.prototype.parseOBIS = function (OBIS) {
        if (OBIS.length != 12)
            return OBIS;
        // https://wiki.volkszaehler.org/software/obis
        // https://github.com/volkszaehler/vzlogger/blob/master/src/Obis.cpp
        // https://www.bundesnetzagentur.de/DE/Service-Funktionen/Beschlusskammern/BK06/BK6_81_GPKE_GeLi/Mitteilung_nr_62/Anlagen/Codeliste_OBIS_Kennzahlen_2.2g.pdf?__blob=publicationFile&v=2
        // http://www.nzr.de/download.php?id=612: 1.17.0 => Signierter Zählerstand (nur im EDL40-Modus)
        // format: "A-B:C.D.E[*&]F"
        // A, B, E, F are optional
        // C & D are mandatory
        var media = parseInt(OBIS.substring(0, 2), 16); // A
        var channel = parseInt(OBIS.substring(2, 4), 16); // B
        var indicator = parseInt(OBIS.substring(4, 6), 16); // C =>  1: Wirkenergie Bezug P+, kWh
        var mode = parseInt(OBIS.substring(6, 8), 16); // D => 17: Signierter Momentanwert (vgl. 7)
        var quantities = parseInt(OBIS.substring(8, 10), 16); // E =>  0: Total
        var storage = parseInt(OBIS.substring(10, 12), 16); // F
        return media + "-" + channel + ":" + indicator + "." + mode + "." + quantities + "*" + storage;
    };
    return ACrypt;
}());
