
declare var jsSHA:    any;
declare var elliptic: any;
declare var moment:   any;

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

function parseUTC(UTCString: string): any {

    moment.locale(window.navigator.language);

    return moment.utc(UTCString).local();

}

function bufferToHex(buffer) : string {

    //return Array
    //    .from (new Uint8Array (buffer))
    //    .map (b => b.toString (16).padStart (2, "0"))
    //    .join("");

    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');

}

function sha256_(text)
{
    var hash = new jsSHA('SHA-256', 'TEXT');
    hash.update(text);
    return hash.getHash("HEX");
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

function intFromBytes(x ){
    var val = 0;
    for (var i = 0; i < x.length; ++i) {
        val += x[i];
        if (i < x.length-1) {
            val = val << 8;
        }
    }
    return val;
}

function getInt64Bytes(x) {

    var bytes = [];
    var i = 8;

    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while ( i )

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

    var bytes   = getInt64Bytes(timestamp);
    var buffer  = new ArrayBuffer(bytes.length);
    var tv      = new DataView(buffer);

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
