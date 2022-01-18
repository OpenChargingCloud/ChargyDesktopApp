/*
 * Copyright (c) 2018-2021 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

///<reference path="certificates.ts" />
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
///<reference path="ACrypt.ts" />

//import fileType from 'file-type';

class Chargy {

    //#region Data

    public  readonly elliptic:      any;
    public  readonly moment:        any;
    public  readonly asn1:          any;
    public  readonly base32Decode:  any;

    private chargingStationOperators  = new Array<IChargingStationOperator>();
    private chargingPools             = new Array<IChargingPool>();
    private chargingStations          = new Array<IChargingStation>();
    private EVSEs                     = new Array<IEVSE>();
    private meters                    = new Array<IMeter>();
    private chargingSessions          = new Array<IChargingSession>();

    private eMobilityProviders        = new Array<IEMobilityProvider>();
    private mediationServices         = new Array<IMediationService>();

    public  currentCTR                = {} as IChargeTransparencyRecord;
    public  internalCTR               = {} as IChargeTransparencyRecord;

    //#endregion

    constructor(elliptic:      any,
                moment:        any,
                asn1:          any,
                base32Decode:  any) {

        this.elliptic      = elliptic;
        this.moment        = moment;
        this.asn1          = asn1;
        this.base32Decode  = base32Decode;

    }

    //#region GetMethods...

    public GetChargingPool: GetChargingPoolFunc = (Id: string) => {

        for (var chargingPool of this.chargingPools)
        {
            if (chargingPool["@id"] === Id)
                return chargingPool;
        }

        return null;

    }

    public GetChargingStation: GetChargingStationFunc = (Id: string) => {

        for (var chargingStation of this.chargingStations)
        {
            if (chargingStation["@id"] === Id)
                return chargingStation;
        }

        return null;

    }

    public GetEVSE: GetEVSEFunc = (Id: string) => {

        for (var evse of this.EVSEs)
        {
            if (evse["@id"] === Id)
                return evse;
        }

        return null;

    }

    public GetMeter: GetMeterFunc = (Id: string) => {

        for (var meter of this.meters)
        {
            if (meter["@id"] === Id)
                return meter;
        }

        return null;

    }

    //#endregion


    //#region CheckMeterPublicKeySignature(...)

    public async CheckMeterPublicKeySignature(chargingStation:  any,
                                              evse:             any,
                                              meter:            any,
                                              publicKey:        any,
                                              signature:        any): Promise<string>
    {

        // For now: Do not enforce this feature!
        if (chargingStation == null || evse == null || meter == null || publicKey == null || signature == null)
            return "";// "<i class=\"fas fa-exclamation-circle\"></i> Unbekannter Public Key!";

        try
        {

            var toCheck = {

                "@id":                  chargingStation["@id"],
                "description":          chargingStation.description,
                "geoLocation":          chargingStation.geoLocation,
                "address":              chargingStation.address,
                "softwareVersion":      chargingStation.softwareVersion,

                "EVSE": {
                    "@id":                      evse["@id"],
                    "description":              evse.description,
                    "sockets":                  evse.sockets,

                    "meter": {
                        "@id":                      meter["@id"],
                        "vendor":                   meter.vendor,
                        "model":                    meter.model,
                        "firmwareVersion":          meter.firmwareVersion,
                        "signatureFormat":          meter.signatureFormat,

                        "publicKey": {
                            "algorithm":                publicKey.algorithm,
                            "format":                   publicKey.format,
                            "value":                    publicKey.value,

                            "signature": {
                                "signer":                   signature.signer,
                                "timestamp":                signature.timestamp,
                                "comment":                  signature.comment,
                                "algorithm":                signature.algorithm,
                                "format":                   signature.format
                            }

                        }

                    }

                }
 
            };

            //ToDo: Checking the timestamp might be usefull!

            var sha256value = await sha256(JSON.stringify(toCheck));
                              //this.crypt.createHash('sha256').
                              //           update(Input, 'utf8').
                              //           digest('hex');

            var result = new this.elliptic.ec('secp256k1').
                                  keyFromPublic(signature.publicKey, 'hex').
                                  verify       (sha256value,
                                                signature.signature);


            if (result)
                return "<i class=\"fas fa-check-circle\"></i>" + signature.signer;


        }
        catch (exception)
        { }

        return "<i class=\"fas fa-times-circle\"></i>" + signature.signer;

    }

    //#endregion


    //#region decompressFiles(FileInfos)

    public async decompressFiles(FileInfos: Array<IFileInfo>): Promise<Array<IFileInfo>> {

        //#region Initial checks

        if (FileInfos == null || FileInfos.length == 0)
            return FileInfos;

        //const fileType         = require('file-type');
        const fileType         = import('file-type');
        const decompress       = require('decompress');
        const decompressTar    = require('decompress-tar');
        const decompressTargz  = require('decompress-targz');
        const decompressTarbz2 = require('decompress-tarbz2');
       // const decompressTarxz  = require('decompress-tarxz'); // Does not compile!
        const decompressUnzip  = require('decompress-unzip');
        const decompressGz     = require('decompress-gz');
        const decompressBzip2  = require('decompress-bzip2');

        //#endregion

        let archiveFound      = false;
        let expandedFileInfos = new Array<IFileInfo>();

        do {

            archiveFound      = false;
            expandedFileInfos = new Array<IFileInfo>();

            for (let FileInfo of FileInfos)
            {

                if (FileInfo.data != null && FileInfo.data.byteLength > 0)
                {

                    try
                    {

                        const filetype = await (await fileType).fileTypeFromBuffer(FileInfo.data);    //.fileTypeFromBuffer(FileInfo.data);

                        if (filetype?.mime == undefined)
                            expandedFileInfos.push({
                                                  name:       FileInfo.name,
                                                  data:       FileInfo.data,
                                                  exception:  "Unknown file type!"
                                              });

                        else (filetype.mime.toString() != "text/xml"        &&
                              filetype.mime.toString() != "text/json"       &&
                              filetype.mime.toString() != "application/xml" &&
                              filetype.mime.toString() != "application/json")
                        {

                            let compressedFiles:Array<TarInfo> = await decompress(Buffer.from(FileInfo.data),
                                                                                  { plugins: [ decompressTar(),
                                                                                               decompressTargz(),
                                                                                               decompressTarbz2(),
                                                                                               //decompressTarxz(),
                                                                                               decompressUnzip(),
                                                                                               decompressGz(),
                                                                                               decompressBzip2()
                                                                                             ] });

                            if (compressedFiles.length == 0)
                                continue;

                            archiveFound = true;

                            //#region A single compressed file without a path/filename, e.g. within bz2

                            if (compressedFiles.length == 1 && compressedFiles[0].path == null)
                            {
                                expandedFileInfos.push({ name: FileInfo.name.substring(0, FileInfo.name.lastIndexOf('.')),
                                                        data: compressedFiles[0].data });
                                continue;
                            }

                            //#endregion

                            //#region A chargepoint compressed archive file

                            let CTRfile:any    = null;
                            let dataFile       = "";
                            let singatureFile  = "";

                            if (compressedFiles.length >= 2)
                            {

                                for (let file of compressedFiles)
                                {

                                    if (file.type === "file" && file.path === "secrrct")
                                    {
                                        try
                                        {
                                            dataFile = new TextDecoder('utf-8').decode(file.data);
                                        }
                                        catch (Exception)
                                        {
                                            console.debug("Invalid chargepoint CTR file!")
                                        }
                                    }

                                    if (file.type === "file" && file.path === "secrrct.sign")
                                    {
                                        try
                                        {
                                            singatureFile = buf2hex(file.data);
                                        }
                                        catch (Exception)
                                        {
                                            console.debug("Invalid chargepoint CTR file!")
                                        }
                                    }

                                }

                                if (dataFile != null && dataFile.length > 0 && singatureFile != null && singatureFile != "")
                                {
                                    CTRfile           = JSON.parse(dataFile);
                                    CTRfile.original  = btoa(dataFile); // Save the original JSON with whitespaces for later signature verification!
                                    CTRfile.signature = singatureFile;
                                    expandedFileInfos.push({
                                        name: FileInfo.name,
                                        data: new TextEncoder().encode(JSON.stringify(CTRfile))
                                    });
                                    continue;
                                }

                            }

                            //#endregion

                            //#region Multiple files

                            for (let compressedFile of compressedFiles)
                            {
                                if (compressedFile.type === "file")
                                {
                                    expandedFileInfos.push({
                                                          name: compressedFile.path?.substring(compressedFile.path.lastIndexOf('/') + 1 ?? FileInfo.name),
                                                          data: compressedFile.data
                                                      });
                                }
                            }

                            //#endregion

                            continue;

                        }

                        expandedFileInfos.push({
                                              name:  FileInfo.name,
                                              data:  FileInfo.data
                                          });

                    }
                    catch (exception)
                    {
                        expandedFileInfos.push({
                                              name:       FileInfo.name,
                                              data:       FileInfo.data,
                                              exception:  exception
                                          });
                    }

                }

            }

            if (archiveFound)
                FileInfos = expandedFileInfos;

        }
        while (archiveFound);

        return expandedFileInfos;

    }

    //#endregion

    //#region detectAndConvertContentFormat(FileInfos)

    public async detectAndConvertContentFormat(FileInfos: Array<IFileInfo>): Promise<IChargeTransparencyRecord|ISessionCryptoResult> {

        //#region Initial checks

        if (FileInfos == null || FileInfos.length == 0)
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Keine Transparenzdatensätze gefunden!",
            }

        //#endregion

        let expandedFiles  = await this.decompressFiles(FileInfos);

        //#region Process JSON/XML/text files

        let processedFiles = new Array<IExtendedFileInfo>();

        for (let expandedFile of expandedFiles)
        {

            let processedFile  = expandedFile as IExtendedFileInfo;
            let textContent    = new TextDecoder('utf-8').decode(expandedFile.data)?.trim();

            // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
            // conversion translates it to FEFF (UTF-16 BOM)
            if (textContent?.charCodeAt(0) === 0xFEFF)
                textContent = textContent.substr(1);

            // XML processing...
            if (textContent?.startsWith("<?xml"))
            {
                try
                {

                    let XMLDocument  = new DOMParser().parseFromString(textContent, "text/xml");

                    //#region XML namespace found...

                    let xmlns        = XMLDocument.lookupNamespaceURI(null);
                    if (xmlns != null)
                    {
                    
                        switch (xmlns)
                        {

                            case "http://www.mennekes.de/Mennekes.EdlVerification.xsd":
                                processedFile.result = await new Mennekes().tryToParseMennekesXML(XMLDocument);
                                break;

                            case "http://transparenz.software/schema/2018/07":
                                processedFile.result = await new SAFEXML(this).tryToParseSAFEXML(XMLDocument);
                                break;

                            // The SAFE transparency software v1.0 does not understand its own
                            // XML namespace. Therefore we have to guess the format.
                            case "":
                                processedFile.result = await new SAFEXML(this).tryToParseSAFEXML(XMLDocument);
                                break;

                        }

                    }

                    //#endregion

                    //#region ..., or plain XML.

                    else
                    {

                        // The SAFE transparency software v1.0 does not understand its own
                        // XML namespace. Therefore we have to guess the format.
                        processedFile.result = await new SAFEXML(this).tryToParseSAFEXML(XMLDocument);

                    }

                    //#endregion

                } catch (exception)
                {
                    processedFile.result = {
                        status:     SessionVerificationResult.InvalidSessionFormat,
                        message:    "Unbekanntes oder ungültiges XML-Transparenzdatensatzformat!",
                        exception:  exception
                    }
                }
            }

            // OCMF processing
            else if (textContent?.startsWith("OCMF|{"))
                processedFile.result = await new OCMF(this).tryToParseOCMF2(textContent);

            // ALFEN processing
            else if (textContent?.startsWith("AP;"))
                processedFile.result = await new Alfen01(this).tryToParseALFENFormat(textContent);

            // Public key processing (PEM format)
            else if (textContent?.startsWith("-----BEGIN PUBLIC KEY-----") &&
                     textContent?.endsWith  ("-----END PUBLIC KEY-----"))
            {

                try
                {

                    const keyId          = (processedFile.name.indexOf('.') > -1
                                                ? processedFile.name.substring(0, processedFile.name.indexOf('.'))
                                                : processedFile.name).replace("-publicKey", "");

                    const publicKeyPEM   = textContent.replace("-----BEGIN PUBLIC KEY-----", "").
                                                       replace("-----END PUBLIC KEY-----",   "").
                                                       split  ('\n').
                                                       map    ((line) => line.trim()).
                                                       filter ((line) => line !== '' && !line.startsWith('#')).
                                                       join   ("");

                    // https://lapo.it/asn1js/ for a visual check...
                    // https://github.com/indutny/asn1.js
                    const ASN1_OIDs      = this.asn1.define('OIDs', function() {
                        //@ts-ignore
                        this.key('oid').objid()
                    });

                    const ASN1_PublicKey = this.asn1.define('PublicKey', function() {
                        //@ts-ignore
                        this.seq().obj(
                            //@ts-ignore
                            this.key('oids').seqof(ASN1_OIDs),
                            //@ts-ignore
                            this.key('publicKey').bitstr()
                        );
                    });

                    const publicKeyDER   = ASN1_PublicKey.decode(Buffer.from(publicKeyPEM, 'base64'), 'der');

                    const KeyType_OID    = publicKeyDER.oids[0].join(".") as string;
                    let   KeyType        = "unknown";
                    switch (KeyType_OID)
                    {
                        case "1.2.840.10045.2.1":
                            KeyType      = "ecPublicKey";   // ANSI X9.62 public key type
                            break;
                    }

                    const Curve_OID      = publicKeyDER.oids[1].join(".") as string;
                    let   Curve          = "unknown";
                    switch (Curve_OID)
                    {

                        // Koblitz 224-bit curve
                        case "1.3.132.0.32":
                            Curve        = "secp224k1";
                            break;

                        // NIST/ANSI X9.62 named 256-bit elliptic curve used with SHA256
                        case "1.2.840.10045.3.1.7":
                            Curve        = "secp256r1";    // also: ANSI prime256v1, NIST P-256
                            break;

                        // NIST/ANSI X9.62 named 384-bit elliptic curve used with SHA384
                        case "1.3.132.0.34":
                            Curve        = "secp384r1";    // also: ANSI prime384v1, NIST P-384
                            break;

                        // NIST/ANSI X9.62 named 521-bit elliptic curve used with SHA512
                        case "1.3.132.0.35":
                            Curve        = "secp521r1";    // also: ANSI prime521v1, NIST P-521
                            break;

                    }

                    processedFile.result = {
                        "@id":       keyId,
                        "@context":  "https://open.charging.cloud/contexts/CTR+json",
                        publicKeys: [
                            {
                                "@id":            keyId,
                                "@context":       "https://open.charging.cloud/contexts/publicKey+json",
                                "subject":        keyId,
                                type: {
                                    oid:          KeyType_OID,
                                    name:         KeyType
                                },
                                algorithm: {
                                    oid:          Curve_OID,
                                    name:         Curve
                                },
                                value:  buf2hex(publicKeyDER.publicKey.data)
                            }
                        ]
                    };

                }
                catch (exception)
                {
                    processedFile.result = {
                        status:     SessionVerificationResult.InvalidSessionFormat,
                        message:    "Unbekanntes oder ungültiges Public-Key-Datenformat!",
                        exception:  exception
                    }
                }

            }

            // JSON processing
            else if (textContent?.startsWith("{") || textContent?.startsWith("["))
            {
                try
                {

                    const JSONContent = JSON.parse(textContent);
                    const JSONContext = (JSONContent["@context"] as string)?.trim() ?? "";

                    if      (JSONContext.startsWith("https://open.charging.cloud/contexts/CTR+json"))
                        processedFile.result = JSONContent as IChargeTransparencyRecord;

                    else if (JSONContext.startsWith("https://open.charging.cloud/contexts/publicKey+json"))
                        processedFile.result = JSONContent as IPublicKeyInfo;

                    else if (JSONContext.startsWith("https://www.chargeit-mobility.com/contexts/charging-station-json"))
                        processedFile.result = await new ChargeIT(this).tryToParseChargeITContainerFormatJSON(JSONContent);

                    else
                    {

                        // The older chargeIT mobility format does not provide any context or format identifiers
                        processedFile.result = await new ChargeIT(this).tryToParseChargeITContainerFormatJSON(JSONContent);

                        // The current chargepoint format does not provide any context or format identifiers
                        if (!isISessionCryptoResult(processedFile.result))
                            processedFile.result = await new Chargepoint01(this).tryToParseChargepointJSON(JSONContent);

                    }


                } catch (exception)
                {
                    processedFile.result = {
                        status:     SessionVerificationResult.InvalidSessionFormat,
                        message:    "Unbekanntes oder ungültiges JSON-Transparenzdatensatzformat!",
                        exception:  exception
                    }
                }
            }

            if (processedFile.result == undefined)
            {
                processedFile.result = {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Unbekanntes oder ungültiges Transparenzdatensatzformat!",
                }
            }

            processedFiles.push(processedFile);

        }

        //#endregion


        //#region If a single CTR had been found...

        if (processedFiles.length == 1)
        {

            if (IsAChargeTransparencyRecord(processedFiles[0].result))
                return this.processChargeTransparencyRecord(processedFiles[0].result);

            if (IsAPublicKeyLookup(processedFiles[0].result))
                return {
                    status:   SessionVerificationResult.InvalidSessionFormat,
                    message:  "Unbekanntes oder ungültiges Transparenzdatensatzformat!",
                };

            return processedFiles[0].result;

        }

        //#endregion

        //#region If multiple CTR had been found => merge them into a single one

        else if (processedFiles.length > 1)
        {

            let mergedCTR:IChargeTransparencyRecord = {
                "@id":      "",
                "@context": ""
            };

            for (const processedFile of processedFiles)
            {

                const processedFileResult = processedFile?.result;

                if (IsAChargeTransparencyRecord(processedFileResult))
                {

                    if (mergedCTR["@id"] === "")
                        mergedCTR["@id"] = processedFileResult["@id"];

                    if (mergedCTR["@context"] === "")
                        mergedCTR["@context"] = processedFileResult["@context"];

                    if (!mergedCTR.begin || (mergedCTR.begin && processedFileResult.begin && mergedCTR.begin > processedFileResult.begin))
                        mergedCTR.begin = processedFileResult.begin;

                    if (!mergedCTR.end || (mergedCTR.end && processedFileResult.end && mergedCTR.end < processedFileResult.end))
                        mergedCTR.end = processedFileResult.end;

                    if (!mergedCTR.description)
                        mergedCTR.description = processedFileResult.description;

                    //ToDo: Is this a really good idea? Or should we fail, whenever this information is different?
                    if (!mergedCTR.contract)
                        mergedCTR.contract = processedFileResult.contract;


                    if (!mergedCTR.chargingStationOperators)
                        mergedCTR.chargingStationOperators = processedFileResult.chargingStationOperators;
                    else if (processedFileResult.chargingStationOperators)
                        for (let chargingStationOperator of processedFileResult.chargingStationOperators)
                            mergedCTR.chargingStationOperators.push(chargingStationOperator);

                    if (!mergedCTR.chargingPools)
                        mergedCTR.chargingPools = processedFileResult.chargingPools;
                    else if (processedFileResult.chargingPools)
                        for (let chargingPool of processedFileResult.chargingPools)
                            mergedCTR.chargingPools.push(chargingPool);

                    if (!mergedCTR.chargingStations)
                        mergedCTR.chargingStations = processedFileResult.chargingStations;
                    else if (processedFileResult.chargingStations)
                        for (let chargingStation of processedFileResult.chargingStations)
                            mergedCTR.chargingStations.push(chargingStation);

                    // publicKeys

                    if (!mergedCTR.chargingSessions)
                        mergedCTR.chargingSessions = processedFileResult.chargingSessions;
                    else if (processedFileResult.chargingSessions)
                        for (let chargingSession of processedFileResult.chargingSessions)
                            mergedCTR.chargingSessions.push(chargingSession);

                    if (!mergedCTR.eMobilityProviders)
                        mergedCTR.eMobilityProviders = processedFileResult.eMobilityProviders;
                    else if (processedFileResult.eMobilityProviders)
                        for (let eMobilityProvider of processedFileResult.eMobilityProviders)
                            mergedCTR.eMobilityProviders.push(eMobilityProvider);

                    if (!mergedCTR.mediationServices)
                        mergedCTR.mediationServices = processedFileResult.mediationServices;
                    else if (processedFileResult.mediationServices)
                        for (let mediationService of processedFileResult.mediationServices)
                            mergedCTR.mediationServices.push(mediationService);

                }

                else if (IsAPublicKeyInfo(processedFileResult))
                {

                    if (!mergedCTR.publicKeys)
                        mergedCTR.publicKeys = new Array<IPublicKeyInfo>();

                    mergedCTR.publicKeys.push(processedFileResult);

                }

                else if (IsAPublicKeyLookup(processedFileResult))
                {

                    if (!mergedCTR.publicKeys)
                        mergedCTR.publicKeys = new Array<IPublicKeyInfo>();

                    for (const publicKey of processedFileResult.publicKeys)
                        mergedCTR.publicKeys.push(publicKey);

                }

                else
                {

                    if (mergedCTR.invalidDataSets === undefined)
                        mergedCTR.invalidDataSets = new Array<IExtendedFileInfo>();

                    mergedCTR.invalidDataSets.push(processedFile);

                }

            }

            if (IsAChargeTransparencyRecord(mergedCTR))
                return this.processChargeTransparencyRecord(mergedCTR);

        }

        //#endregion

        return {
            status:   SessionVerificationResult.InvalidSessionFormat,
            message:  "Keine Transparenzdatensätze gefunden!"
        }

    }

    //#endregion

    //#region processChargeTransparencyRecord(CTR)

    public async processChargeTransparencyRecord(CTR: IChargeTransparencyRecord): Promise<IChargeTransparencyRecord|ISessionCryptoResult>
    {

        //#region Initial checks

        if (!IsAChargeTransparencyRecord(CTR))
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Unbekanntes Transparenzdatensatzformat!"
            }

        //#endregion

        //#region Data

        this.chargingStationOperators  = [];
        this.chargingPools             = [];
        this.chargingStations          = [];
        this.EVSEs                     = [];
        this.meters                    = [];
        this.chargingSessions          = [];

        this.eMobilityProviders        = [];
        this.mediationServices         = [];

        //#endregion

        //ToDo: Verify @context

        try
        {

            this.currentCTR                = CTR;
            this.internalCTR               = JSON.parse(JSON.stringify(CTR)); // Operate on a copy of the data!

            //#region Process operators (pools, stations, evses, tariffs, ...)

            if (this.internalCTR.chargingStationOperators)
            {

                for (var chargingStationOperator of this.internalCTR.chargingStationOperators)
                {

                    this.chargingStationOperators.push(chargingStationOperator);

                    if (chargingStationOperator.chargingPools) {

                        for (var chargingPool of chargingStationOperator.chargingPools)
                        {

                            this.chargingPools.push(chargingPool);

                            if (chargingPool.chargingStations)
                            {

                                for (var chargingStation of chargingPool.chargingStations)
                                {

                                    this.chargingStations.push(chargingStation);

                                    if (chargingStation.EVSEs) {

                                        for (var EVSE of chargingStation.EVSEs)
                                        {

                                            EVSE.chargingStation    = chargingStation;
                                            EVSE.chargingStationId  = chargingStation["@id"];

                                            this.EVSEs.push(EVSE);

                                            if (EVSE.meters) {

                                                for (var meter of EVSE.meters)
                                                {

                                                    meter.EVSE               = EVSE;
                                                    meter.EVSEId             = EVSE["@id"];

                                                    meter.chargingStation    = chargingStation;
                                                    meter.chargingStationId  = chargingStation["@id"];

                                                    this.meters.push(meter);

                                                }

                                            }

                                        }

                                    }

                                }

                            }

                        }

                    }

                    if (chargingStationOperator.chargingStations)
                    {

                        for (var chargingStation of chargingStationOperator.chargingStations)
                        {

                            this.chargingStations.push(chargingStation);

                            if (chargingStation.EVSEs) {

                                for (var EVSE of chargingStation.EVSEs)
                                {
        
                                    EVSE.chargingStation    = chargingStation;
                                    EVSE.chargingStationId  = chargingStation["@id"];
        
                                    this.EVSEs.push(EVSE);
        
                                    if (EVSE.meters) {
        
                                        for (var meter of EVSE.meters)
                                        {
        
                                            meter.EVSE               = EVSE;
                                            meter.EVSEId             = EVSE["@id"];
        
                                            meter.chargingStation    = chargingStation;
                                            meter.chargingStationId  = chargingStation["@id"];
        
                                            this.meters.push(meter);
        
                                        }
        
                                    }
        
                                }

                            }

                        }

                    }

                    if (chargingStationOperator.EVSEs) {

                        for (var EVSE of chargingStationOperator.EVSEs)
                        {

                            // EVSE.chargingStation    = chargingStation;
                            // EVSE.chargingStationId  = chargingStation["@id"];

                            this.EVSEs.push(EVSE);

                            if (EVSE.meters) {

                                for (var meter of EVSE.meters)
                                {

                                    meter.EVSE               = EVSE;
                                    meter.EVSEId             = EVSE["@id"];

                                    // meter.chargingStation    = chargingStation;
                                    // meter.chargingStationId  = chargingStation["@id"];

                                    this.meters.push(meter);

                                }

                            }

                        }

                    }

                }

            }

            //#endregion

            //#region Process pools     (       stations, evses, tariffs, ...)

            if (this.internalCTR.chargingPools) {

                for (var chargingPool of this.internalCTR.chargingPools)
                {

                    this.chargingPools.push(chargingPool);

                    if (chargingPool.chargingStations)
                    {

                        for (var chargingStation of chargingPool.chargingStations)
                        {

                            this.chargingStations.push(chargingStation);

                            if (chargingStation.EVSEs) {

                                for (var EVSE of chargingStation.EVSEs)
                                {

                                    EVSE.chargingStation    = chargingStation;
                                    EVSE.chargingStationId  = chargingStation["@id"];

                                    this.EVSEs.push(EVSE);

                                    if (EVSE.meters) {

                                        for (var meter of EVSE.meters)
                                        {
        
                                            meter.EVSE               = EVSE;
                                            meter.EVSEId             = EVSE["@id"];
        
                                            meter.chargingStation    = chargingStation;
                                            meter.chargingStationId  = chargingStation["@id"];
        
                                            this.meters.push(meter);
        
                                        }
        
                                    }

                                }

                            }

                        }

                    }

                }

            }

            //#endregion

            //#region Process stations  (                 evses, tariffs, ...)

            if (this.internalCTR.chargingStations) {

                for (var chargingStation of this.internalCTR.chargingStations)
                {

                    this.chargingStations.push(chargingStation);

                    if (chargingStation.EVSEs) {

                        for (var EVSE of chargingStation.EVSEs)
                        {

                            EVSE.chargingStation    = chargingStation;
                            EVSE.chargingStationId  = chargingStation["@id"];

                            this.EVSEs.push(EVSE);

                            if (EVSE.meters) {

                                for (var meter of EVSE.meters)
                                {

                                    meter.EVSE               = EVSE;
                                    meter.EVSEId             = EVSE["@id"];

                                    meter.chargingStation    = chargingStation;
                                    meter.chargingStationId  = chargingStation["@id"];

                                    this.meters.push(meter);

                                }

                            }

                        }

                    }

                    if (chargingStation.meters) {

                        for (var meter of chargingStation.meters)
                        {

                            meter.chargingStation    = chargingStation;
                            meter.chargingStationId  = chargingStation["@id"];

                            this.meters.push(meter);

                        }

                    }

                }

            }

            //#endregion

            if (this.internalCTR.chargingSessions)
            {
                for (let chargingSession of this.internalCTR.chargingSessions)
                {
                    chargingSession.ctr                = this.internalCTR;
                    chargingSession.verificationResult = await this.processChargingSession(chargingSession);
                    this.chargingSessions.push(chargingSession);
                }
            }

            return this.internalCTR;

        }
        catch (exception)
        {
            return {
                status:   SessionVerificationResult.InvalidSessionFormat,
                message:  "Exception occured: " + (exception instanceof Error ? exception.message : exception)
            }
        }

    }

    //#endregion

    //#region processChargingSession(chargingSession)

    public async processChargingSession(chargingSession: IChargingSession) : Promise<ISessionCryptoResult>
    {

        //ToDo: Verify @id exists
        //ToDo: Verify @context
        //ToDo: Verify begin & end
        //ToDo: Verify chargingStationOperatorId  => set chargingStationOperator
        //ToDo: Verify chargingPoolId             => set chargingPool
        //ToDo: Verify chargingStationId          => set chargingStation
        //ToDo: Verify EVSEId                     => set EVSE
        //ToDo: Verify meterId                    => set meter
        //ToDo: Verify tariffId                   => set tariff
        //ToDo: Verify measurements exists & count >= 1

        if (chargingSession              == null ||
            chargingSession.measurements == null)
        {
            return {
                status: SessionVerificationResult.InvalidSessionFormat
            }
        }

        switch (chargingSession["@context"])
        {

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/GDFCrypt01+json":
                chargingSession.method = new GDFCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json":
                chargingSession.method = new EMHCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json":
                chargingSession.method = new OCMFv1_0(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargePointCrypt01+json":
                chargingSession.method = new ChargePointCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/AlfenCrypt01+json":
                chargingSession.method = new AlfenCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            case "https://open.charging.cloud/contexts/SessionSignatureFormats/bsm-ws36a-v0+json":
                chargingSession.method = new BSMCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);

            default:
                return {
                    status: SessionVerificationResult.UnknownSessionFormat
                }

        }

    }

    //#endregion

}
