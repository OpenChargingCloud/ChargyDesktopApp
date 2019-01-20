
function ParseJSON_LD<T>(Text:    string,
    Context: string = null): T {

var JObject = JSON.parse(Text);

JObject["id"] = JObject["@id"];

return JObject as T;

}

function firstKey(obj) {
for (var a in obj) return a;
}

function firstValue(obj) {
for (var a in obj) return obj[a];
}

function parseUTC(UTCTime: string|number): any {

    var moment = require('moment');

    moment.locale(window.navigator.language);

    return typeof UTCTime === 'string'
               ? moment.utc(UTCTime).local()
               : moment.unix(UTCTime).local()

}

function parseOBIS(OBIS: string): string
{

    if (OBIS.length != 12)
        return OBIS;

    // https://wiki.volkszaehler.org/software/obis
    // https://github.com/volkszaehler/vzlogger/blob/master/src/Obis.cpp
    // https://www.promotic.eu/en/pmdoc/Subsystems/Comm/PmDrivers/IEC62056_OBIS.htm
    // https://www.bundesnetzagentur.de/DE/Service-Funktionen/Beschlusskammern/BK06/BK6_81_GPKE_GeLi/Mitteilung_nr_62/Anlagen/Codeliste_OBIS_Kennzahlen_2.2g.pdf?__blob=publicationFile&v=2
    // http://www.nzr.de/download.php?id=612: 1.17.0 => Signierter Zählerstand (nur im EDL40-Modus)

    // format: "A-B:C.D.E[*&]F"
    // A, B, E, F are optional
    // C & D are mandatory
    var media       = parseInt(OBIS.substring( 0,  2), 16); // A
    var channel     = parseInt(OBIS.substring( 2,  4), 16); // B
    var indicator   = parseInt(OBIS.substring( 4,  6), 16); // C =>  1: Wirkenergie Bezug P+, kWh
    var mode        = parseInt(OBIS.substring( 6,  8), 16); // D => 17: Signierter Momentanwert (vgl. 7)
    var quantities  = parseInt(OBIS.substring( 8, 10), 16); // E =>  0: Total
    var storage     = parseInt(OBIS.substring(10, 12), 16); // F

    return media + "-" + channel + ":" + indicator + "." + mode + "." + quantities + "*" + storage;

}

function translateMeasurementName(In: string) : string
{
    switch (In)
    {

        case "ENERGY_TOTAL":
            return "Bezogene Energiemenge";

        default:
            return In;

    }
}

function bufferToHex(buffer) : string {

    //return Array
    //    .from (new Uint8Array (buffer))
    //    .map (b => b.toString (16).padStart (2, "0"))
    //    .join("");

    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');

}

function hex32(val) {
    val &= 0xFFFFFFFF;
    var hex = val.toString(16).toUpperCase();
    return ("00000000" + hex).slice(-8);
}

function parseHexString(str: string) {

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
              str.substring(str.length-2, str.length);
        result += str;
    }
    return result;
}

function buf2hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function intFromBytes(x){
    var val = 0;
    for (var i = 0; i < x.length; ++i) {
        val += x[i];
        if (i < x.length-1) {
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
        x = x>>8;
    } while (i)

    return bytes;

}

function getInt64Bytes(x) {

    var bytes = [];
    var i = 8;

    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while (i)

    return bytes;

}

function SetHex(dv: DataView, hex: string, offset: number, reverse?: boolean): string
{

    var bytes   = parseHexString(hex);
    var buffer  = new ArrayBuffer(bytes.length);
    var tv      = new DataView(buffer);
    
    if (reverse)
        bytes.reverse();

    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i,          bytes[i]);
    }

    return buf2hex(buffer);

}

function SetTimestamp(dv: DataView, timestamp: any, offset: number): string
{

    if (typeof timestamp === 'string')
        timestamp = parseUTC(timestamp);

    var unixtime  = timestamp.unix();
    var bytes     = getInt64Bytes(unixtime);
    var buffer    = new ArrayBuffer(8);
    var tv        = new DataView(buffer);

    for (var i = 4; i < bytes.length; i++) {
        dv.setUint8(offset + (bytes.length - i - 1), bytes[i]);
        tv.setUint8(bytes.length - i - 1,            bytes[i]);
    }

    return buf2hex(buffer);

}

function SetTimestamp32(dv: DataView, timestamp: any, offset: number): string
{

    if (typeof timestamp === 'string')
        timestamp = parseUTC(timestamp);

    var unixtime  = timestamp.unix() + 60 * timestamp.utcOffset(); // Usage of utcOffset() is afaik EMH specific!
    var bytes     = getInt64Bytes(unixtime);
    var buffer    = new ArrayBuffer(4);
    var tv        = new DataView(buffer);

    for (var i = 4; i < bytes.length; i++) {
        dv.setUint8(offset + (bytes.length - i - 1), bytes[i]);
        tv.setUint8(bytes.length - i - 1,            bytes[i]);
    }

    return buf2hex(buffer);

}

function SetInt8(dv: DataView, value: number, offset: number): string
{

    var buffer  = new ArrayBuffer(1);
    var tv      = new DataView(buffer);

    dv.setInt8(offset, value);
    tv.setInt8(0,      value);

    return buf2hex(buffer);

}

function SetUInt32(dv: DataView, value: number, offset: number, reverse?: boolean): string
{

    var bytes   = getInt32Bytes(value);
    var buffer  = new ArrayBuffer(bytes.length);
    var tv      = new DataView(buffer);

    if (reverse)
        bytes.reverse();

    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i,          bytes[i]);
    }

    return buf2hex(buffer);

}

function SetUInt64(dv: DataView, value: number, offset: number, reverse?: boolean): string
{

    var bytes   = getInt64Bytes(value);
    var buffer  = new ArrayBuffer(bytes.length);
    var tv      = new DataView(buffer);

    if (reverse)
        bytes.reverse();

    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i,          bytes[i]);
    }

    return buf2hex(buffer);

}

function SetText(dv: DataView, text: string, offset: number): string
{

    //var bytes = new TextEncoder("utf-8").encode(text);
    var bytes   = new TextEncoder().encode(text);
    var buffer  = new ArrayBuffer(bytes.length);
    var tv      = new DataView(buffer);

    for (var i = 0; i < bytes.length; i++) {
        dv.setUint8(offset + i, bytes[i]);
        tv.setUint8(i,          bytes[i]);
    }

    return buf2hex(buffer);

}


function Clone(obj) {

    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = new obj.constructor();

    for(var key in obj)
        temp[key] = Clone(obj[key]);

    return temp;

}


function openFullscreen() {

  var elem = document.documentElement as any;

  if (elem.requestFullscreen) {
      elem.requestFullscreen();

  } else if (elem.mozRequestFullScreen) { /* Firefox */
      elem.mozRequestFullScreen();

  } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
      elem.webkitRequestFullscreen();

  } else if (elem.msRequestFullscreen) { /* IE/Edge */
      elem.msRequestFullscreen();
  }

}

function closeFullscreen() {

  var d = document as any;

  if (d.exitFullscreen) {
      d.exitFullscreen();

  } else if (d.mozCancelFullScreen) { /* Firefox */
      d.mozCancelFullScreen();

  } else if (d.webkitExitFullscreen) { /* Chrome, Safari and Opera */
      d.webkitExitFullscreen();

  } else if (d.msExitFullscreen) { /* IE/Edge */
      d.msExitFullscreen();
  }

}


function CreateDiv(ParentDiv:   HTMLDivElement,
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
