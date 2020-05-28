"use strict";
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
function ParseJSON_LD(Text, Context = "") {
    var JObject = JSON.parse(Text);
    JObject["id"] = JObject["@id"];
    return JObject;
}
function firstKey(obj) {
    for (var a in obj)
        return a;
}
function firstValue(obj) {
    for (var a in obj)
        return obj[a];
}
function parseUTC(UTCTime) {
    var moment = require('moment');
    moment.locale(window.navigator.language);
    return typeof UTCTime === 'string'
        ? moment.utc(UTCTime).local()
        : moment.unix(UTCTime).local();
}
function UTC2human(UTCTime) {
    var moment = require('moment');
    moment.locale(window.navigator.language);
    return (typeof UTCTime === 'string'
        ? moment.utc(UTCTime)
        : moment.unix(UTCTime)).
        format('dddd, D; MMM YYYY HH:mm:ss').
        replace(".", ""). // Nov. -> Nov
        replace(";", ".") + // 14;  -> 14.
        " Uhr";
}
function parseOBIS(OBIS) {
    if (OBIS.length != 12)
        throw "Invalid OBIS number '" + OBIS + "'!";
    // DIN EN 62056-61:2002
    // https://wiki.volkszaehler.org/software/obis
    // https://github.com/volkszaehler/vzlogger/blob/master/src/Obis.cpp
    // https://www.promotic.eu/en/pmdoc/Subsystems/Comm/PmDrivers/IEC62056_OBIS.htm
    // https://www.bundesnetzagentur.de/DE/Service-Funktionen/Beschlusskammern/BK06/BK6_81_GPKE_GeLi/Mitteilung_nr_62/Anlagen/Codeliste_OBIS_Kennzahlen_2.2g.pdf?__blob=publicationFile&v=2
    // http://www.nzr.de/download.php?id=612: 1.17.0 => Signierter Zählerstand (nur im EDL40-Modus)
    // format: "A-B:C.D.E[*&]F"
    // A, B, E, F are optional
    // C & D are mandatory
    var media = parseInt(OBIS.substring(0, 2), 16); // A =>  1: Energie
    var channel = parseInt(OBIS.substring(2, 4), 16); // B =>  0: No channels available
    var indicator = parseInt(OBIS.substring(4, 6), 16); // C =>  1: Wirkenergie Bezug P+, kWh
    var mode = parseInt(OBIS.substring(6, 8), 16); // D => 17: Signierter Momentanwert (vgl. 7)
    var quantities = parseInt(OBIS.substring(8, 10), 16); // E =>  0: Total
    var storage = parseInt(OBIS.substring(10, 12), 16); // F
    return media + "-" + channel + ":" + indicator + "." + mode + "." + quantities + "*" + storage;
}
const OBIS_RegExpr = new RegExp("((\\d+)\\-)?((\\d+):)?((\\d+)\\.)(\\d+)(\\.(\\d+))?(\\*(\\d+))?");
function OBIS2Hex(OBIS) {
    //  1-0:1.8.0*255 => 0100010800ff
    var _a, _b, _c, _d, _e, _f;
    let OBISElements = OBIS.match(OBIS_RegExpr);
    return OBISElements == null
        ? "000000000000"
        : parseInt((_a = OBISElements[2]) !== null && _a !== void 0 ? _a : "00").toString(16).padStart(2, "0") + // optional  A
            parseInt((_b = OBISElements[4]) !== null && _b !== void 0 ? _b : "00").toString(16).padStart(2, "0") + // optional  B
            parseInt((_c = OBISElements[6]) !== null && _c !== void 0 ? _c : "00").toString(16).padStart(2, "0") + // mandatory C
            parseInt((_d = OBISElements[7]) !== null && _d !== void 0 ? _d : "00").toString(16).padStart(2, "0") + // mandatory D
            parseInt((_e = OBISElements[9]) !== null && _e !== void 0 ? _e : "00").toString(16).padStart(2, "0") + // optional  E
            parseInt((_f = OBISElements[11]) !== null && _f !== void 0 ? _f : "00").toString(16).padStart(2, "0"); // optional  F
}
function OBIS2MeasurementName(In) {
    switch (In) {
        case "1-0:1.8.0*255":
            return "ENERGY_TOTAL"; // Sum Li Active Power+ (Q1+QIV), Time integral 1 [kWh]
        case "1-0:1.17.0*255":
            return "ENERGY_TOTAL"; // Sum Li Active Power+ (Q1+QIV), Time integral 7 [kWh]
        default:
            return In;
    }
}
function measurementName2human(In) {
    switch (In) {
        case "ENERGY_TOTAL":
            return "Bezogene Energiemenge";
        default:
            return In;
    }
}
function IsNullOrEmpty(value) {
    return (!value || value === null || value == undefined || value == "" || value.length == 0);
}
function WhenNullOrEmpty(value, replacement) {
    if (!value || value === null || value == undefined || value == "" || value.length == 0)
        return replacement;
    return value;
}
function hex2bin(hex, Reverse) {
    if (Reverse) {
        let reversed = [];
        for (var i = 0; i < hex.length; i += 2)
            reversed.push(hex.substring(i, i + 2));
        return ("00000000" + (parseInt(reversed.reverse().join(""), 16)).toString(2)).substr(-8);
    }
    return ("00000000" + (parseInt(hex, 16)).toString(2)).substr(-8);
}
function hex32(val) {
    val &= 0xFFFFFFFF;
    var hex = val.toString(16).toUpperCase();
    return ("00000000" + hex).slice(-8);
}
function parseHexString(str) {
    var result = [];
    while (str.length >= 2) {
        result.push(parseInt(str.substring(0, 2), 16));
        str = str.substring(2, str.length);
    }
    return result;
}
function createHexString(arr) {
    var result = "";
    for (var i in arr) {
        var str = arr[i].toString(16);
        str = str.length == 0 ? "00" :
            str.length == 1 ? "0" + str :
                str.length == 2 ? str :
                    str.substring(str.length - 2, str.length);
        result += str;
    }
    return result;
}
function buf2hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), (x) => ('00' + x.toString(16)).slice(-2)).join('');
}
function hexToArrayBuffer(hex) {
    if ((hex.length % 2) !== 0) {
        throw new RangeError('Expected string to be an even number of characters');
    }
    var view = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
        view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return view.buffer;
}
function intFromBytes(x) {
    var val = 0;
    for (var i = 0; i < x.length; ++i) {
        val += x[i];
        if (i < x.length - 1) {
            val = val << 8;
        }
    }
    return val;
}
function getInt32Bytes(x) {
    var bytes = [];
    var i = 4;
    do {
        bytes[--i] = x & (255);
        x = x >> 8;
    } while (i);
    return bytes;
}
function getInt64Bytes(x) {
    var bytes = [];
    var i = 8;
    do {
        bytes[--i] = x & (255);
        x = x >> 8;
    } while (i);
    return bytes;
}
function SetHex(dv, hex, offset, reverse) {
    var bytes = parseHexString(hex);
    var buffer = new ArrayBuffer(bytes.length);
    var tv = new DataView(buffer);
    if (reverse)
        bytes.reverse();
    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i, bytes[i]);
    }
    return buf2hex(buffer);
}
function SetTimestamp(dv, timestamp, offset, addLocalOffset = true) {
    if (typeof timestamp === 'string')
        timestamp = parseUTC(timestamp);
    var unixtime = timestamp.unix() + (addLocalOffset ? 60 * timestamp.utcOffset() : 0); // Usage of utcOffset() is afaik EMH specific!
    var bytes = getInt64Bytes(unixtime);
    var buffer = new ArrayBuffer(8);
    var tv = new DataView(buffer);
    for (var i = 4; i < bytes.length; i++) {
        dv.setUint8(offset + (bytes.length - i - 1), bytes[i]);
        tv.setUint8(bytes.length - i - 1, bytes[i]);
    }
    return buf2hex(buffer);
}
function SetTimestamp32(dv, timestamp, offset, addLocalOffset = true) {
    if (typeof timestamp === 'string')
        timestamp = parseUTC(timestamp);
    var unixtime = timestamp.unix() + (addLocalOffset ? 60 * timestamp.utcOffset() : 0); // Usage of utcOffset() is afaik EMH specific!
    var bytes = getInt64Bytes(unixtime);
    var buffer = new ArrayBuffer(4);
    var tv = new DataView(buffer);
    for (var i = 4; i < bytes.length; i++) {
        dv.setUint8(offset + (bytes.length - i - 1), bytes[i]);
        tv.setUint8(bytes.length - i - 1, bytes[i]);
    }
    return buf2hex(buffer);
}
function SetInt8(dv, value, offset) {
    var buffer = new ArrayBuffer(1);
    var tv = new DataView(buffer);
    dv.setInt8(offset, value);
    tv.setInt8(0, value);
    return buf2hex(buffer);
}
function SetUInt32(dv, value, offset, reverse) {
    var bytes = getInt32Bytes(value);
    var buffer = new ArrayBuffer(bytes.length);
    var tv = new DataView(buffer);
    if (reverse)
        bytes.reverse();
    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i, bytes[i]);
    }
    return buf2hex(buffer);
}
function SetUInt64(dv, value, offset, reverse) {
    var bytes = getInt64Bytes(value);
    var buffer = new ArrayBuffer(bytes.length);
    var tv = new DataView(buffer);
    if (reverse)
        bytes.reverse();
    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i, bytes[i]);
    }
    return buf2hex(buffer);
}
function SetText(dv, text, offset) {
    //var bytes = new TextEncoder("utf-8").encode(text);
    var bytes = new TextEncoder().encode(text);
    var buffer = new ArrayBuffer(bytes.length);
    var tv = new DataView(buffer);
    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i, bytes[i]);
    }
    return buf2hex(buffer);
}
function Clone(obj) {
    if (obj == null || typeof (obj) != 'object')
        return obj;
    var temp = new obj.constructor();
    for (var key in obj)
        temp[key] = Clone(obj[key]);
    return temp;
}
function openFullscreen() {
    var elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    }
    else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    }
    else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        elem.webkitRequestFullscreen();
    }
    else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}
function closeFullscreen() {
    var d = document;
    if (d.exitFullscreen) {
        d.exitFullscreen();
    }
    else if (d.mozCancelFullScreen) { /* Firefox */
        d.mozCancelFullScreen();
    }
    else if (d.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        d.webkitExitFullscreen();
    }
    else if (d.msExitFullscreen) { /* IE/Edge */
        d.msExitFullscreen();
    }
}
function CreateDiv(ParentDiv, ClassName, InnerHTML) {
    let childDiv = ParentDiv.appendChild(document.createElement('div'));
    if (ClassName != null)
        childDiv.className = ClassName;
    if (InnerHTML != null)
        childDiv.innerHTML = InnerHTML;
    return childDiv;
}
function CreateDiv2(ParentDiv, ChildClassName, 
//     ChildAClassName:  string,
ChildAInnerHTML, 
//      ChildBClassName:  string,
ChildBInnerHTML) {
    let childDiv = ParentDiv.appendChild(document.createElement('div'));
    childDiv.className = ChildClassName;
    let childADiv = childDiv.appendChild(document.createElement('div'));
    childADiv.className = ChildClassName + "Id";
    childADiv.innerHTML = ChildAInnerHTML;
    let childBDiv = childDiv.appendChild(document.createElement('div'));
    childBDiv.className = ChildClassName + "IdValue";
    childBDiv.innerHTML = ChildBInnerHTML;
    return childDiv;
}
function OpenExternal(URL) {
    var shell = require('electron').shell;
    shell.openExternal(URL);
}
String.prototype.isNullOrEmpty = function () {
    return !(typeof this === "string" && this.length > 0);
};
String.prototype.isNotNullOrEmpty = function () {
    return typeof this === "string" && this.length > 0;
};
function pad(text, paddingValue) {
    if (text == null || text == undefined)
        text = "";
    return (text + Array(2 * paddingValue).join('0')).substring(0, 2 * paddingValue);
}
;
async function sha224(message) {
    let hashBuffer = null;
    const SHA224 = require("sha224");
    if (typeof message === 'string')
        hashBuffer = SHA224(Buffer.from(message, 'utf8'));
    else
        hashBuffer = SHA224(message);
    //  const hashArray  = Array.from(hashBuffer);                                       // convert hash to byte array
    const hashHex = hashBuffer.toString("hex");
    return hashHex;
}
async function sha256(message) {
    let hashBuffer = null;
    if (typeof message === 'string')
        hashBuffer = await crypto.subtle.digest('SHA-256', Buffer.from(message, 'utf8'));
    else
        hashBuffer = await crypto.subtle.digest('SHA-256', message);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert hash to byte array
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string
    return hashHex;
}
async function sha384(message) {
    let hashBuffer = null;
    if (typeof message === 'string')
        hashBuffer = await crypto.subtle.digest('SHA-384', Buffer.from(message, 'utf8'));
    else
        hashBuffer = await crypto.subtle.digest('SHA-384', message);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert hash to byte array
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string
    return hashHex;
}
async function sha512(message) {
    let hashBuffer = null;
    if (typeof message === 'string')
        hashBuffer = await crypto.subtle.digest('SHA-512', Buffer.from(message, 'utf8'));
    else
        hashBuffer = await crypto.subtle.digest('SHA-512', message);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert hash to byte array
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string
    return hashHex;
}
//# sourceMappingURL=chargyLib.js.map