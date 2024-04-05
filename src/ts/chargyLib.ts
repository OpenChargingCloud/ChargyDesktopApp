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

import * as exp from 'node:constants';
import * as chargyInterfaces  from './chargyInterfaces'
import Decimal                from 'decimal.js';


export function ParseJSON_LD<T>(Text:     string,
                                Context:  string = ""): T {

    let JObject = JSON.parse(Text);

    JObject["id"] = JObject["@id"];

    return JObject as T;

}

export function firstKey(obj: any) {
    for (let a in obj)
        return a;
}

export function firstValue(obj: any) {
    for (let a in obj)
        return obj[a];
}

export function parseUTC(UTCTime: string|number): any {

    const moment = require('moment');

    moment.locale(window.navigator.language);

    return typeof UTCTime === 'string'
               ? moment.utc(UTCTime).local()
               : moment.unix(UTCTime).local()

}

export function time2human(Time: string|number): any {

    const moment = require('moment');

    moment.locale(window.navigator.language);

    return (typeof Time === 'string'
                ? moment(Time)
                : moment.unix(Time)).
               format('dddd, D; MMM YYYY HH:mm:ss').
                   replace(".", "").    // Nov. -> Nov
                   replace(";", ".") +  // 14;  -> 14.
                   " Uhr";

}

export function UTC2human(UTCTime: string|number): any {

    const moment = require('moment');

    moment.locale(window.navigator.language);

    return (typeof UTCTime === 'string'
                ? moment.utc(UTCTime)
                : moment.unix(UTCTime)).
               format('dddd, D; MMM YYYY HH:mm:ss').
                   replace(".", "").    // Nov. -> Nov
                   replace(";", ".") +  // 14;  -> 14.
                   " Uhr";

}

export function parseOBIS(OBIS: string): string
{

    if (OBIS.length != 12)
        throw "Invalid OBIS number '" + OBIS + "'!";

    // DIN EN 62056-61:2002
    // https://wiki.volkszaehler.org/software/obis
    // https://github.com/volkszaehler/vzlogger/blob/master/src/Obis.cpp
    // https://www.promotic.eu/en/pmdoc/Subsystems/Comm/PmDrivers/IEC62056_OBIS.htm
    // https://www.bundesnetzagentur.de/DE/Service-Funktionen/Beschlusskammern/BK06/BK6_81_GPKE_GeLi/Mitteilung_nr_62/Anlagen/Codeliste_OBIS_Kennzahlen_2.2g.pdf?__blob=publicationFile&v=2
    // https://www.bundesnetzagentur.de/DE/Beschlusskammern/BK06/BK6_81_GPKE_GeLi/Mitteilung_Nr_20/Anlagen/Obis-Kennzahlen-System_2.0.pdf?__blob=publicationFile&v=2
    // https://www.edi-energy.de/index.php?id=38&tx_bdew_bdew%5Buid%5D=2084&tx_bdew_bdew%5Baction%5D=download&tx_bdew_bdew%5Bcontroller%5D=Dokument&cHash=0db4ac05eb3e647669c5e9ac7bca093b
    // http://www.nzr.de/download.php?id=612: 1.17.0 => Signierter Zählerstand (nur im EDL40-Modus)

    // format: "A-B:C.D.E[*&]F"
    // A, B, E, F are optional
    // C & D are mandatory
    const media       = parseInt(OBIS.substring( 0,  2), 16); // A =>  1: Energie
    const channel     = parseInt(OBIS.substring( 2,  4), 16); // B =>  0: No channels available
    const indicator   = parseInt(OBIS.substring( 4,  6), 16); // C =>  1: Wirkenergie Bezug P+, kWh
    const mode        = parseInt(OBIS.substring( 6,  8), 16); // D => 17: Signierter Momentanwert (vgl. 7)
    const quantities  = parseInt(OBIS.substring( 8, 10), 16); // E =>  0: Total
    const storage     = parseInt(OBIS.substring(10, 12), 16); // F

    return media + "-" + channel + ":" + indicator + "." + mode + "." + quantities + "*" + storage;

}

export const OBIS_RegExpr = new RegExp("((\\d+)\\-)?((\\d+):)?((\\d+)\\.)(\\d+)(\\.(\\d+))?(\\*(\\d+))?");

export function OBIS2Hex(OBIS: string): string
{

    //  1-0:1.8.0*255 => 0100010800ff

    let OBISElements = OBIS.match(OBIS_RegExpr);

    return OBISElements == null
               ? "000000000000"
               : parseInt(OBISElements[ 2] ?? "00").toString(16).padStart(2, "0") +   // optional  A
                 parseInt(OBISElements[ 4] ?? "00").toString(16).padStart(2, "0") +   // optional  B
                 parseInt(OBISElements[ 6] ?? "00").toString(16).padStart(2, "0") +   // mandatory C
                 parseInt(OBISElements[ 7] ?? "00").toString(16).padStart(2, "0") +   // mandatory D
                 parseInt(OBISElements[ 9] ?? "00").toString(16).padStart(2, "0") +   // optional  E
                 parseInt(OBISElements[11] ?? "00").toString(16).padStart(2, "0");    // optional  F

}

export function OBIS2MeasurementName(OBISString: string) : string
{
    switch (OBISString)
    {

        case "1-0:1.7.0*255":
            return "Total Real Power";

        case "1-0:1.8.0*198":
            return "ENERGY_TOTAL";

        case "1-0:1.8.0*255":
            return "ENERGY_TOTAL";

        case "1-0:1.17.0*255":
            return "ENERGY_TOTAL";

        // https://www.dzg.de/fileadmin/dzg/content/downloads/produkte-zaehler/gsh/DZG_GSH01_product_manual_2022_12_08.pdf
        // Obis Code         Description                                                                      Data Type   Unit   Scaler   Displayed Accuracy   OCMF Accuracy
        // ---------------   -------------------------------------------------------------------------------- ----------- ------ -------- -------------------- ---------------
        // 1-0:1.8.0*255     Total Import Mains Energy                Upper Line Content (Billing Relevant)   int64_t     kWh    -4       2                    3
        // 1-0:140.7.0*255   Line Loss Impedance                      Upper Line Content (Billing Relevant)   uint16_t    Ohm    -4
        // 1-0:152.8.0*255   Total Transaction Import Device Energy   Upper Line Content (Billing Relevant)
        //--------------------------------------------------------------------------------------------------------------------------------------------------------------------
        // 1-0:31.7.0*255    Phase L1 Current                         -                                       int32_t     A      -2       1                    -
        // 1-0:32.7.0*255    Phase L1 Voltage                         -                                       int32_t     V      -2       1                    -
        // 1-0:1.7.0*255     Total Import Mains Power                 -                                       int32_t     W      -2       1                    -
        // 1.0:156.7.0*255   Import Device Power                      -                                       int32_t     W      -2       1                    -
        // 1.0:154.7.0*255   Import Line Loss Power                   -                                       int32_t     W      -2       1                    -
        // 1-0:16.7.0*255    Total Device Power                       -                                       int64_t     W      -2       1                    -
        // 1-0:154.8.0*255   Total Import Line Loss Energy            -                                       int64_t     kWh    -4       2                    3
        // 1-0:156.8.0*255   Total Import Device Energy               -                                       int64_t     kWh    -4       2                    3

        case "1-0:152.8.0*255":
        case "01-00:98.08.00.FF":
            return "ENERGY_TOTAL";

        default:
            return OBISString;

    }
}

export function measurementName2human(In: string) : string
{
    switch (In)
    {

        case "ENERGY_TOTAL":
            return "Bezogene Energiemenge";

        default:
            return In;

    }
}

export function IsNullOrEmpty(value: string|undefined): boolean {
    return (!value || value === null || value == undefined || value == "" || value.length == 0);
}

export function WhenNullOrEmpty(value: string|undefined, replacement: string): string {

    if (!value || value === null || value == undefined || value == "" || value.length == 0)
        return replacement;

    return value;

}

export function hex2bin(hex: string, Reverse?: Boolean) : string {

    if (Reverse)
    {

        let reversed: string[] = [];

        for (let i = 0; i < hex.length; i += 2)
            reversed.push(hex.substring(i, i + 2));

        return ("00000000" + (parseInt(reversed.reverse().join(""), 16)).toString(2)).substr(-8);

    }

    return ("00000000" + (parseInt(hex, 16)).toString(2)).substr(-8);

}

export function hex32(val: number) {
    val &= 0xFFFFFFFF;
    let hex = val.toString(16).toUpperCase();
    return ("00000000" + hex).slice(-8);
}

export function parseHexString(str: string): number[] {

    let result:number[] = [];

    while (str.length >= 2) {
        result.push(parseInt(str.substring(0, 2), 16));
        str = str.substring(2, str.length);
    }

    return result;

}

export function createHexString(arr: Iterable<number>) {

    let result = "";

    for (let value of arr) {
        let str = value.toString(16);
        str = str.length == 0 ? "00" :
              str.length == 1 ? "0" + str : 
              str.length == 2 ? str :
              str.substring(str.length-2, str.length);
        result += str;
    }

    return result;

}

export function buf2hex(buffer: ArrayBuffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), (x:number) => ('00' + x.toString(16)).slice(-2)).join('');
}

export function hexToArrayBuffer(hex: string): ArrayBuffer {

    if ((hex.length % 2) !== 0) {
        throw new RangeError('Expected string to be an even number of characters')
    }

    let view = new Uint8Array(hex.length / 2)

    for (let i = 0; i < hex.length; i += 2) {
        view[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }

    return view.buffer

}

export function intFromBytes(x: number[]){

    let val = 0;

    for (let i = 0; i < x.length; ++i) {
        val += x[i] ?? 0;
        if (i < x.length-1) {
            val = val << 8;
        }
    }

    return val;

}

export function getInt8Bytes(x: number) : number[] {

    let bytes:number[] = [];
    let i              = 1;

    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while (i)

    return bytes;

}

export function getInt16Bytes(x: number) : number[] {

    let bytes:number[] = [];
    let i              = 2;

    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while (i)

    return bytes;

}

export function getInt32Bytes(x: number) : number[] {

    let bytes:number[]  = [];
    let i               = 4;

    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while (i)

    return bytes;

}

export function getInt64Bytes(x: number) : number[] {

    let bytes:number[]  = [];
    let i               = 8;

    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while (i)

    return bytes;

}

export function SetHex(dv: DataView, hex: string, offset: number, reverse?: boolean): string
{

    const bytes   = parseHexString(hex);
    const buffer  = new ArrayBuffer(bytes.length);
    const tv      = new DataView(buffer);

    if (reverse)
        bytes.reverse();

    for (let i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i] ?? 0);
        tv.setUint8(i,          bytes[i] ?? 0);
    }

    return buf2hex(buffer);

}

export function SetTimestamp(dv: DataView, timestamp: any, offset: number, addLocalOffset: boolean = true): string
{

    if (typeof timestamp === 'string')
        timestamp = parseUTC(timestamp);

    const unixtime  = timestamp.unix() + (addLocalOffset ? 60 * timestamp.utcOffset() : 0); // Usage of utcOffset() is afaik EMH specific!
    const bytes     = getInt64Bytes(unixtime);
    const buffer    = new ArrayBuffer(8);
    const tv        = new DataView(buffer);

    for (let i = 4; i < bytes.length; i++) {
        dv.setUint8(offset + (bytes.length - i - 1), bytes[i] ?? 0);
        tv.setUint8(bytes.length - i - 1,            bytes[i] ?? 0);
    }

    return buf2hex(buffer);

}

export function SetTimestamp32(dv: DataView, timestamp: any, offset: number, addLocalOffset: boolean = true): string
{

    if (typeof timestamp === 'string')
        timestamp = parseUTC(timestamp);

    const unixtime  = timestamp.unix() + (addLocalOffset ? 60 * timestamp.utcOffset() : 0); // Usage of utcOffset() is afaik EMH specific!
    const bytes     = getInt64Bytes(unixtime);
    const buffer    = new ArrayBuffer(4);
    const tv        = new DataView(buffer);

    for (let i = 4; i < bytes.length; i++) {
        dv.setUint8(offset + (bytes.length - i - 1), bytes[i] ?? 0);
        tv.setUint8(bytes.length - i - 1,            bytes[i] ?? 0);
    }

    return buf2hex(buffer);

}

export function SetInt8(dv: DataView, value: number, offset: number): string
{

    const buffer  = new ArrayBuffer(1);
    const tv      = new DataView(buffer);

    dv.setInt8(offset, value);
    tv.setInt8(0,      value);

    return buf2hex(buffer);

}

export function SetUInt32(dv: DataView, value: number, offset: number, reverse?: boolean): string
{

    const bytes   = getInt32Bytes(value);
    const buffer  = new ArrayBuffer(bytes.length);
    const tv      = new DataView(buffer);

    if (reverse)
        bytes.reverse();

    for (let i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i] ?? 0);
        tv.setUint8(i,          bytes[i] ?? 0);
    }

    return buf2hex(buffer);

}

export function SetUInt64(dv: DataView, value: number, offset: number, reverse?: boolean): string
{

    const bytes   = getInt64Bytes(value);
    const buffer  = new ArrayBuffer(bytes.length);
    const tv      = new DataView(buffer);

    if (reverse)
        bytes.reverse();

    for (let i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i] ?? 0);
        tv.setUint8(i,          bytes[i] ?? 0);
    }

    return buf2hex(buffer);

}

export function SetUInt64D(dv: DataView, value: Decimal, offset: number, reverse?: boolean): string
{
    return SetUInt64(dv,
                     value.toNumber(),
                     offset,
                     reverse);
}

export function SetText(dv: DataView, text: string, offset: number): string
{

    //var bytes = new TextEncoder("utf-8").encode(text);
    const bytes   = new TextEncoder().encode(text);
    const buffer  = new ArrayBuffer(bytes.length);
    const tv      = new DataView(buffer);

    for (let i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i] ?? 0);
        tv.setUint8(i,          bytes[i] ?? 0);
    }

    return buf2hex(buffer);

}


export function SetUInt32_withCode(dv: DataView, value: number, scale: number, obis: number, offset: number, reverse?: boolean): string
{

    const valueBytes  = getInt32Bytes(value);
    const scaleBytes  = getInt8Bytes(scale);
    const obisBytes   = getInt8Bytes(obis);
    const buffer      = new ArrayBuffer(valueBytes.length + 2);
    const tv          = new DataView(buffer);

    if (reverse)
        valueBytes.reverse();

    for (let i = 0; i < valueBytes.length; i++) {
        dv.setUint8(offset + i, valueBytes[i] ?? 0);
        tv.setUint8(i,          valueBytes[i] ?? 0);
    }

    dv.setUint8(offset + valueBytes.length,     scaleBytes[0] ?? 0);
    tv.setInt8 (         valueBytes.length,     scaleBytes[0] ?? 0);
    dv.setUint8(offset + valueBytes.length + 1, obisBytes[0]  ?? 0);
    tv.setInt8 (         valueBytes.length + 1, obisBytes[0]  ?? 0);

    const result = buf2hex(buffer);

    return result.substr(0, 8) + "·" + result.substr(8, 2) + "·" + result.substr(10, 2);

}

export function SetText_withLength(dv: DataView, text: string, offset: number): string
{

    //var bytes = new TextEncoder("utf-8").encode(text);
    const bytes   = new TextEncoder().encode(text);
    const buffer  = new ArrayBuffer(4 + bytes.length);
    const tv      = new DataView(buffer);

    dv.setInt32(offset, bytes.length);
    tv.setInt32(0,      bytes.length);

    for (let i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + 4 + i, bytes[i] ?? 0);
        tv.setUint8(         4 + i, bytes[i] ?? 0);
    }

    const result = buf2hex(buffer);

    return bytes.length > 0
               ? result.substr(0, 8) + "·" + result.substr(8)
               : result;

}


export function Clone(obj: any) {

    if (obj == null || typeof(obj) != 'object')
        return obj;

    var temp = new obj.constructor();

    for(var key in obj)
        temp[key] = Clone(obj[key]);

    return temp;

}


export function openFullscreen() {

    var elem = document.documentElement as any;

    if (elem.requestFullscreen) {
        elem.requestFullscreen();

    } else if (elem.mozRequestFullScreen) {     /* Firefox */
        elem.mozRequestFullScreen();

    } else if (elem.webkitRequestFullscreen) {  /* Chrome, Safari and Opera */
        elem.webkitRequestFullscreen();

    } else if (elem.msRequestFullscreen) {      /* IE/Edge */
        elem.msRequestFullscreen();
    }

}

export function closeFullscreen() {

    var d = document as any;

    if (d.exitFullscreen) {
        d.exitFullscreen();

    } else if (d.mozCancelFullScreen) {         /* Firefox */
        d.mozCancelFullScreen();

    } else if (d.webkitExitFullscreen) {        /* Chrome, Safari and Opera */
        d.webkitExitFullscreen();

    } else if (d.msExitFullscreen) {            /* IE/Edge */
        d.msExitFullscreen();
    }

}


export function CreateDiv(ParentDiv:   HTMLDivElement,
                          ClassName?:  string,
                          InnerHTML?:  string) : HTMLDivElement
{

    let childDiv            = ParentDiv.appendChild(document.createElement('div'));

    if (ClassName != null)
        childDiv.className  = ClassName;

    if (InnerHTML != null)
        childDiv.innerHTML  = InnerHTML;

    return childDiv;

}

export function CreateDiv2(ParentDiv:        HTMLDivElement,
                           ChildClassName:   string,
                      //     ChildAClassName:  string,
                           ChildAInnerHTML:  string,
                     //      ChildBClassName:  string,
                           ChildBInnerHTML:  string) : HTMLDivElement
{

    let childDiv            = ParentDiv.appendChild(document.createElement('div'));
        childDiv.className  = ChildClassName;

    let childADiv           = childDiv.appendChild(document.createElement('div'));
    childADiv.className     = ChildClassName + "Id";
    childADiv.innerHTML     = ChildAInnerHTML;

    let childBDiv           = childDiv.appendChild(document.createElement('div'));
    childBDiv.className     = ChildClassName + "Value";
    childBDiv.innerHTML     = ChildBInnerHTML;

    return childDiv;

}


export function OpenExternal(URL: string)
{

    var shell = require('electron').shell;

    shell.openExternal(URL);

}


export interface String {
    isNullOrEmpty():    boolean;
    isNotNullOrEmpty(): boolean;
}

// String.prototype.isNullOrEmpty = function() {
//     return !(typeof this === "string" && this.length > 0);
// }

// String.prototype.isNotNullOrEmpty = function() {
//     return typeof this === "string" && this.length > 0;
// }

export function pad(text: string|undefined, paddingValue: number) {

    if (text == null || text == undefined)
        text = "";

    return (text + Array(2*paddingValue).join('0')).substring(0, 2*paddingValue);

};

// export async function sha224(message: string|DataView) {

//     let hashBuffer = null;
//     const SHA224 = require("sha224");

//     if (typeof message === 'string')
//         hashBuffer = SHA224(Buffer.from(message, 'utf8'));
//     else
//         hashBuffer = SHA224(message);

//   //  const hashArray  = Array.from(hashBuffer);                                       // convert hash to byte array
//     const hashHex    = hashBuffer.toString("hex");

//     return hashHex;

// }


/**
 * Calculate the SHA256 hash
 * @param message a text of data view
 * @returns true, when the given text exists and is a valid string
 */
export async function sha256(message: string|DataView): Promise<string> {

    let hashBuffer: ArrayBuffer | null = null;

    if (typeof message === 'string')
        hashBuffer = await crypto.subtle.digest('SHA-256', Buffer.from(message, 'utf8'));
    else
        hashBuffer = await crypto.subtle.digest('SHA-256', message);

    const hashArray  = Array.from(new Uint8Array(hashBuffer));                                       // convert hash to byte array
    const hashHex    = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string

    return hashHex;

}

/**
 * Calculate the SHA384 hash
 * @param message a text of data view
 * @returns true, when the given text exists and is a valid string
 */
export async function sha384(message: string|DataView): Promise<string> {

    let hashBuffer: ArrayBuffer | null = null;

    if (typeof message === 'string')
        hashBuffer = await crypto.subtle.digest('SHA-384', Buffer.from(message, 'utf8'));
    else
        hashBuffer = await crypto.subtle.digest('SHA-384', message);

    const hashArray  = Array.from(new Uint8Array(hashBuffer));                                       // convert hash to byte array
    const hashHex    = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string

    return hashHex;

}

/**
 * Calculate the SHA512 hash
 * @param message a text of data view
 * @returns true, when the given text exists and is a valid string
 */
export async function sha512(message: string|DataView): Promise<string> {

    let hashBuffer: ArrayBuffer | null = null;

    if (typeof message === 'string')
        hashBuffer = await crypto.subtle.digest('SHA-512', Buffer.from(message, 'utf8'));
    else
        hashBuffer = await crypto.subtle.digest('SHA-512', message);

    const hashArray  = Array.from(new Uint8Array(hashBuffer));                                       // convert hash to byte array
    const hashHex    = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('').toLowerCase(); // convert bytes to hex string

    return hashHex;

}


/**
 * Ensures, that the given json object exists and is a valid json object
 * @param value a json object
 * @returns true, when the given json object exists and is a valid json object
 */
export function isMandatoryJSONObject(value: any): value is any {
    return typeof value === "object" && !Array.isArray(value);
}

/**
 * Checks, whether the given json object exists and if yes wether it is a valid json object
 * @param jsonObject a json object
 * @returns true, when the given json object does not exist or when it exists, that it is a valid json object
 */
export function isOptionalJSONObject(value: any): value is any | undefined | null {

    return value === null      ||
           value === undefined ||
           (typeof value === "object" && !Array.isArray(value));

}

/**
 * Ensures, that the given json array exists and is a valid json array
 * @param value a json array
 * @returns true, when the given json array exists and is a valid json array
 */
export function isMandatoryJSONArray(value: any): value is any[] {
    return Array.isArray(value);
}

/**
 * Ensures, that the given json array of strings exists and is a valid json array of strings
 * @param value a json array of strings
 * @returns true, when the given json array exists of strings and is a valid json array of strings
 */
export function isMandatoryArrayOfStrings(value: any): value is string[] {
    return Array.isArray(value) && value.every(element => typeof element === "string");
}

/**
 * Checks, whether the given json array exists and if yes wether it is a valid json array
 * @param value a json array
 * @returns true, when the given json array does not exist or when it exists and is a valid json array
 */
export function isOptionalJSONArray(value: any): value is any[] {

    return value === undefined ||
           value === null      ||
           Array.isArray(value);

}

/**
 * Checks, whether the given json array of strings exists and if yes wether it is a valid json array of strings
 * @param value a json array of strings
 * @returns true, when the given json array of strings does not exist or when it exists and is a valid json array of strings
 */
export function isOptionalArrayOfStrings(value: any): value is string[] | undefined | null {

    return value === undefined ||
           value === null      ||
           (Array.isArray(value) && value.every(element => typeof element === "string"));

}






/**
 * Checks, whether the given json array exists and if yes wether it is a valid json object
 * @param jsonArray a json object
 * @returns true, when the given json array does not exist or when it exists, that it is a valid json array
 */
export function isOptionalJSONArrayError(jsonArray: any) {

    if (jsonArray !== undefined && jsonArray !== null)
        return typeof jsonArray !== "object" || !Array.isArray(jsonArray);

    return false;

}

/**
 * Checks, whether the given json array exists and if yes wether it is a valid json object
 * @param jsonArray a json object
 * @returns true, when the given json array does not exist or when it exists, that it is a valid json array
 */
 export function isOptionalJSONArrayOk(jsonArray: any) {

    if (jsonArray !== undefined && jsonArray !== null)
        return typeof jsonArray === "object" && Array.isArray(jsonArray);

    return true;

}


/**
 * Ensures, that the given boolean exists and is a valid boolean
 * @param value a boolean
 * @returns true, when the given boolean exists and is a valid boolean
 */
export function isMandatoryBoolean(value: any): value is boolean {
    return typeof value === "boolean";
}

/**
 * Ensures, that the given text exists and is a valid string
 * @param value a string
 * @returns true, when the given text exists and is a valid string
 */
export function isMandatoryString(value: any): value is string {
    return typeof value === "string";
}

/**
 * Ensures, that the given text is a valid string, if it exists
 * @param value a string
 * @returns true, when the given text is a valid string, if it exists
 */
export function isOptionalString(value: any): value is string | undefined | null {

    return typeof value === "string"  ||
                  value === undefined ||
                  value === null;

}

/**
 * Ensures, that the given text exists and is a valid URL
 * @param value an URL
 * @returns true, when the given text exists and is a valid URL
 */
export function isMandatoryURL(value: any): value is string | undefined | null {
    return typeof value === "string" && value.startsWith("https://");
}

/**
 * Ensures, that the given text is a valid URL, if it exists
 * @param value an URL
 * @returns true, when the given text is a valid URL, if it exists
 */
export function isOptionalURL(value: any): value is string | undefined | null {

    return (typeof value === "string" && value.startsWith("https://") ||
                   value === undefined ||
                   value === null);

}


/**
 * Ensures, that the given number exists and is a valid number
 * @param value a number
 * @returns true, when the given number exists and is a valid number
 */
export function isMandatoryNumber(value: any): value is number {
    return typeof value === "number";
}

/**
 * Ensures, that the given number is a valid number, if it exists
 * @param value a number
 * @returns true, when the given number is a valid number, if it exists
 */
export function isOptionalNumber(value: any): value is number | undefined | null {

    return typeof value === "number"  ||
                  value === undefined ||
                  value === null;

}

/**
 * Ensures, that the given decimal number exists and is a valid decimal number
 * @param value a decimal number
 * @returns true, when the given decimal number exists and is a valid decimal number
 */
export function isMandatoryDecimal(value: any): value is Decimal {

    if (value instanceof Decimal || typeof value === "number")
        return true;

    if (typeof value === "string") {
        try
        {
            const decimalValue = new Decimal(value);
            return true;
        }
        catch (e) {
        }
    }

    return false;

}

/**
 * Ensures, that the given decimal number is a valid decimal number, if it exists
 * @param value a decimal number
 * @returns true, when the given decimal number is a valid decimal number, if it exists
 */
export function isOptionalDecimal(value: any): value is Decimal | undefined | null {

    if (value instanceof Decimal ||
        typeof value === "number"||
        value === undefined ||
        value === null)
    {
        return true;
    }

    if (typeof value === "string") {
        try
        {
            const decimalValue = new Decimal(value);
            return true;
        }
        catch (e) {
        }
    }

    return false;

}




export function parseNumber(value: string): number | null {

    if (value.trim().length > 0) {

        const parsedNumber = Number(value);

        if (!isNaN(parsedNumber) && isFinite(parsedNumber))
            return parsedNumber;

    }

    return null;

}



export function InformationRelevanceToString(InfoRelevance: chargyInterfaces.InformationRelevance) : string
{
    switch (InfoRelevance) {
        case chargyInterfaces.InformationRelevance.Ignored:      return "Ignored";
        case chargyInterfaces.InformationRelevance.Informative:  return "Informative";
        case chargyInterfaces.InformationRelevance.Important:    return "Important";
        default:                                                 return "Unknown";
    }
}


export function CloneCTR(CTR: chargyInterfaces.IChargeTransparencyRecord): chargyInterfaces.IChargeTransparencyRecord
{

    // const jsonSerializer = (key:string, value:any) => {
    //     return value instanceof Decimal ? value.toNumber() : value;
    // };

    var clonedCTR = JSON.parse(JSON.stringify(CTR)) as chargyInterfaces.IChargeTransparencyRecord;   //, jsonSerializer));

    if (clonedCTR.chargingSessions)
    {
        for (const session of clonedCTR.chargingSessions) {
            for (const measurement of session.measurements) {
                for (const value of measurement.values) {
                    if (typeof value.value === 'string' || typeof value.value === 'number')
                        value.value = new Decimal(value.value);
                }
            }
        }
    }

    return clonedCTR;

}


//#region jsonPrettyPrinter(value, KeyLookup?)

export function jsonPrettyPrinter(value:       any,
                                  KeyLookup?: (path: string, key: string) => string): string
{

    return _jsonPrettyPrinter(
               value,
               0,
               "",
               KeyLookup ?? ((path: string, key: string) => key)
           );

}

function _jsonPrettyPrinter(value:        any,
                            indentLevel:  number,
                            path:         string,
                            keyLookup:   (path: string, key: string) => string): string
{

    const indent = '&nbsp;'.repeat(indentLevel * 4);
    let   html   = '';

    //#region Arrays

    if (Array.isArray(value)) {

        html += '[<br />';

        value.forEach((item, index) => {

            html += `${indent}&nbsp;&nbsp;&nbsp;&nbsp;${_jsonPrettyPrinter(item, indentLevel + 1, path, keyLookup)}`;

            if (index < value.length - 1)
                html += ',';

            html += '<br />';

        });

        html += `${indent}]`;

    }

    //#endregion

    //#region Objects

    else if (typeof value === 'object' && value !== null)
    {

        html += '{<br />';
        const keys = Object.keys(value);

        let maxKeyLength = 0;

        keys.forEach(key => {
            maxKeyLength          = Math.max(keyLookup(path, key).length + 1, maxKeyLength);
        });

        keys.forEach((key, index) => {

            const newPath         = path ? `${path}.${key}` : key;
            const keyName         = keyLookup(path, key);
            const requiredSpaces  = '&nbsp;'.repeat(maxKeyLength - keyName.length);
            html += `${indent}&nbsp;&nbsp;&nbsp;&nbsp;${'<span class="jsonKeyName">' + keyName + '</span>' + requiredSpaces + '(<span class="jsonKey">' + key + '</span>)'}: ${_jsonPrettyPrinter(value[key], indentLevel + 1, newPath, keyLookup)}`;

            if (index < keys.length - 1)
                html += ',';

            html += '<br />';

        });

        html += `${indent}}`;

    }

    //#endregion

    //#region Primitive types

    else if (typeof value === 'string')
        html += `<span class="jsonString">"${value}"</span>`;

    else if (typeof value === 'number')
        html += `<span class="jsonNumber">${value}</span>`;

    else if (typeof value === 'boolean')
        html += `<span class="jsonBoolean">${value}</span>`;

    //#endregion

    else
        html += value;

    return html;

}

//#endregion
