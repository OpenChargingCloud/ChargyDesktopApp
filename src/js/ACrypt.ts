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

    parseOBIS(OBIS: string): string
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


    abstract VerifyChargingSession(chargingSession:   IChargingSession): ISessionCryptoResult;

    abstract SignMeasurement(measurementValue:        IMeasurementValue,
                             privateKey:              any,
                             publicKey:               any): ICryptoResult;

    abstract VerifyMeasurement(measurementValue:      IMeasurementValue): ICryptoResult;

    abstract ViewMeasurement(measurementValue:        IMeasurementValue,
                             infoDiv:                 HTMLDivElement,
                             bufferValue:             HTMLDivElement,
                             hashedBufferValue:       HTMLDivElement,
                             publicKeyValue:          HTMLDivElement,
                             signatureExpectedValue:  HTMLDivElement,
                             signatureCheckValue:     HTMLDivElement) : void;

}
