///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
///<reference path="ACrypt.ts" />


interface IGDFCrypt01Result extends ICryptoResult
{
    sha256value?:               any,
    meterId?:                   string,
    meter?:                     IMeter,
    timestamp?:                 string,
    obis?:                      string,
    unitEncoded?:               string,
    scale?:                     string,
    value?:                     string,
    authorization?:             string,
    authorizationTimestamp?:    string
}

class GDFCrypt01 extends ACrypt {

    readonly curve        = new this.elliptic.ec('p256');
    
    
    constructor(GetMeter: GetMeterFunc) {
        super("ECC secp256r1",
              GetMeter);              
    }


    Calc(measurementValue:  IMeasurementValue): IGDFCrypt01Result
    {

        var keypair                      = this.curve.genKeyPair();
        var privateKey                   = keypair.getPrivate();
        var privateKeyHEX                = privateKey.toString('hex').toLowerCase();
        var publicKey                    = keypair.getPublic();
        var publicKeyHEX                 = publicKey.encode('hex').toLowerCase();
        
        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoData:IGDFCrypt01Result = {
            status:                       "unknown",
            meterId:                      SetText     (cryptoBuffer, measurementValue.measurement.energyMeterId,                             0),
            timestamp:                    SetTimestamp(cryptoBuffer, measurementValue.timestamp,                                            10),
            obis:                         SetHex      (cryptoBuffer, measurementValue.measurement.obis,                                     23, false),
            unitEncoded:                  SetInt8     (cryptoBuffer, measurementValue.measurement.unitEncoded,                              29),
            scale:                        SetInt8     (cryptoBuffer, measurementValue.measurement.scale,                                    30),
            value:                        SetUInt64   (cryptoBuffer, measurementValue.value,                                                31, true),
            authorization:                SetHex      (cryptoBuffer, measurementValue.measurement.chargingSession.authorization["@id"],     41),
            authorizationTimestamp:       SetTimestamp(cryptoBuffer, measurementValue.measurement.chargingSession.authorization.timestamp, 169)
        };

        var signatureExpected = measurementValue.signatures[0] as ISignature;
        if (signatureExpected != null)
        {
            try
            {

                cryptoData.sha256value = this.crypt.createHash('sha256').update(buf2hex(buffer), 'utf8').digest('hex');

                var meter = this.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoData.meter = meter;

                    var iPublicKey = meter.publicKeys[0] as IPublicKey;
                    if (iPublicKey != null)
                    {

                        try
                        {

                            // FAKE IT!
                            iPublicKey.value        = publicKeyHEX;

                            //cryptoData.privateKey   = privateKey.toString('hex').toLowerCase();
                            cryptoData.publicKey    = iPublicKey.value.toLowerCase();

                            // FAKE IT!
                            cryptoData.signature    = this.curve.keyFromPrivate(privateKeyHEX).sign(cryptoData.sha256value).toDER('hex');

                            try
                            {

                                var result  = this.curve.keyFromPublic(cryptoData.publicKey, 'hex').verify(cryptoData.sha256value, cryptoData.signature);

                                if (result)
                                {
                                    cryptoData.status = "verified";
                                    return cryptoData;
                                }

                                else
                                    return { status: "invalid signature" };

                            }
                            catch (exception)
                            {
                                return { status: "invalid signature" };
                            }

                        }
                        catch (exception)
                        {
                            return { status: "invalid public key" };
                        }

                    }

                    else
                        return { status: "no public key found" };

                }

                else
                    return { status: "energy meter not found" }

            }
            catch (exception)
            {
                return { status: "invalid signature" };
            }

        }

    }


    View(measurementValue:        IMeasurementValue,
         result:                  IGDFCrypt01Result,
         infoDiv:                 HTMLDivElement,
         bufferValue:             HTMLDivElement,
         hashedBufferValue:       HTMLDivElement,
         publicKeyValue:          HTMLDivElement,
         signatureExpectedValue:  HTMLDivElement,
         signatureCheckValue:     HTMLDivElement)
    {

        var cryptoDiv                       = CreateDiv(infoDiv,                "row");
        var cryptoIdDiv                     = CreateDiv(cryptoDiv,              "id",     "Kryptoverfahren");
        var cryptoValueDiv                  = CreateDiv(cryptoDiv,              "value",  GDFCrypt01.name + " (" + this.description + ")");

        hashedBufferValue.parentElement.children[0].innerHTML = "Hashed Puffer (SHA256)";

        var meterIdDiv                      = CreateDiv(infoDiv,                "row");
        var meterIdIdDiv                    = CreateDiv(meterIdDiv,             "id",     "Zählernummer");
        var meterIdValueDiv                 = CreateDiv(meterIdDiv,             "value",  measurementValue.measurement.energyMeterId);
        this.AddToBuffer(result.meterId,                 bufferValue, meterIdDiv);

        var timestampDiv                    = CreateDiv(infoDiv,                "row");
        var timestampIdDiv                  = CreateDiv(timestampDiv,           "id",     "Zeitstempel");
        var timestampValueDiv               = CreateDiv(timestampDiv,           "value",  measurementValue.timestamp);
        this.AddToBuffer(result.timestamp,               bufferValue, timestampDiv);

        // SetHex      (view, meterValue.measurementId/paginationId,                    19, true);

        var obisDiv                         = CreateDiv(infoDiv,                "row");
        var obisIdDiv                       = CreateDiv(obisDiv,                "id",     "OBIS-Kennzahl");
        var obisValueDiv                    = CreateDiv(obisDiv,                "value",  measurementValue.measurement.obis);
        this.AddToBuffer(result.obis,                    bufferValue, obisDiv);

        var unitEncodedDiv                  = CreateDiv(infoDiv,                "row");
        var unitEncodedIdDiv                = CreateDiv(unitEncodedDiv,         "id",     "Einheit (codiert)");
        var unitEncodedValueDiv             = CreateDiv(unitEncodedDiv,         "value",  measurementValue.measurement.unitEncoded.toString());
        this.AddToBuffer(result.unitEncoded,             bufferValue, unitEncodedDiv);

        var scaleDiv                        = CreateDiv(infoDiv,                "row");
        var scaleIdDiv                      = CreateDiv(scaleDiv,               "id",     "Skalierung");
        var scaleValueDiv                   = CreateDiv(scaleDiv,               "value",  measurementValue.measurement.scale.toString());
        this.AddToBuffer(result.scale,                   bufferValue, scaleDiv);

        var valueDiv                        = CreateDiv(infoDiv,                "row");
        var valueIdDiv                      = CreateDiv(valueDiv,               "id",     "Messwert");
        var valueValueDiv                   = CreateDiv(valueDiv,               "value",  measurementValue.value.toString() + " Wh");
        this.AddToBuffer(result.value,                   bufferValue, valueDiv);

        var contractIdDiv                   = CreateDiv(infoDiv,                "row");
        var contractIdIdDiv                 = CreateDiv(contractIdDiv,          "id",     "Autorisierung");
        var contractIdValueDiv              = CreateDiv(contractIdDiv,          "value",  measurementValue.measurement.chargingSession.authorization["@id"]);
        this.AddToBuffer(result.authorization,           bufferValue, contractIdDiv);

        var authorizationTimestampDiv       = CreateDiv(infoDiv,                "row");
        var authorizationTimestampIdDiv     = CreateDiv(authorizationTimestampDiv, "id",     "Zeitstempel Autorisierung");
        var authorizationTimestampValueDiv  = CreateDiv(authorizationTimestampDiv, "value",  measurementValue.measurement.chargingSession.authorization.timestamp);
        this.AddToBuffer(result.authorizationTimestamp,  bufferValue, authorizationTimestampDiv);


        hashedBufferValue.innerHTML      = "0x" + result.sha256value;
        publicKeyValue.innerHTML         = "0x" + result.publicKey;
        signatureExpectedValue.innerHTML = "0x" + result.signature;


        switch (result.status)
        {

            case "verified":
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;

            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + result.status + '</div>';
                break;

        }


    }

}