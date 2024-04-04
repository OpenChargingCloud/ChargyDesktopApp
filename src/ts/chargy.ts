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

import { Buffer }                           from 'node:buffer';
import { fileTypeFromBuffer }               from 'file-type';

import { Alfen, AlfenCrypt01 }              from './Alfen'
import { BSMCrypt01 }                       from './BSMCrypt01'
import { ChargeIT }                         from './chargeIT'
import { ChargePoint, ChargePointCrypt01 }  from './chargePoint'
import { EMHCrypt01 }                       from './EMHCrypt01'
import { GDFCrypt01 }                       from './GDFCrypt01'
import { Mennekes }                         from './Mennekes'
import { OCMF, OCMFv1_x }                   from './OCMF'
import { SAFEXML }                          from './SAFE_XML'
import { XMLContainer }                     from './XMLContainer'
import { OCPI }                             from './OCPI'
import * as chargyInterfaces                from './chargyInterfaces'
import * as chargyLib                       from './chargyLib'
import * as pdfjsLib                        from 'pdfjs-dist';

export class Chargy {

    //#region Data

    public  readonly i18n:          any;
    public  readonly UILanguage:    string;
    public  readonly elliptic:      any;
    public  readonly moment:        any;
    public  readonly asn1:          any;
    public  readonly base32Decode:  any;

    private chargingStationOperators  = new Array<chargyInterfaces.IChargingStationOperator>();
    private chargingPools             = new Array<chargyInterfaces.IChargingPool>();
    private chargingStations          = new Array<chargyInterfaces.IChargingStation>();
    private EVSEs                     = new Array<chargyInterfaces.IEVSE>();
    private meters                    = new Array<chargyInterfaces.IMeter>();
    private chargingSessions          = new Array<chargyInterfaces.IChargingSession>();

    private eMobilityProviders        = new Array<chargyInterfaces.IEMobilityProvider>();
    private mediationServices         = new Array<chargyInterfaces.IMediationService>();

    public  currentCTR                = {} as chargyInterfaces.IChargeTransparencyRecord;
    public  internalCTR               = {} as chargyInterfaces.IChargeTransparencyRecord;

    //#endregion

    constructor(i18n:          any,
                UILanguage:    string,
                elliptic:      any,
                moment:        any,
                asn1:          any,
                base32Decode:  any) {

        this.i18n          = i18n;
        this.UILanguage    = UILanguage;
        this.elliptic      = elliptic;
        this.moment        = moment;
        this.asn1          = asn1;
        this.base32Decode  = base32Decode;

    }

    //#region GetMethods...

    public GetLocalizedMessage(Text: string): string
    {

        const multiLanguage = this.i18n[Text];

        if (multiLanguage !== undefined)
        {

            const localLanguage = multiLanguage[this.UILanguage];
            if (localLanguage !== undefined)
                return localLanguage;

            const english = multiLanguage["en"];
            if (english !== undefined)
                return english;

        }

        return "Undefined Error!";

    }

    public GetLocalizedMessageWithParameter(Text:       string,
                                            Parameter:  any): string
    {

        const multiLanguage = this.i18n[Text];

        if (multiLanguage !== undefined)
        {

            const localLanguage = multiLanguage[this.UILanguage];
            if (localLanguage !== undefined)
                return localLanguage.replace("%p", Parameter);

            const english = multiLanguage["en"];
            if (english !== undefined)
                return english.replace("%p", Parameter);

        }

        return "Undefined Error!";

    }


    public GetChargingPool: chargyInterfaces.GetChargingPoolFunc = (Id: string) => {

        for (var chargingPool of this.chargingPools)
        {
            if (chargingPool["@id"] === Id)
                return chargingPool;
        }

        return null;

    }

    public GetChargingStation: chargyInterfaces.GetChargingStationFunc = (Id: string) => {

        for (var chargingStation of this.chargingStations)
        {
            if (chargingStation["@id"] === Id)
                return chargingStation;
        }

        return null;

    }

    public GetEVSE: chargyInterfaces.GetEVSEFunc = (Id: string) => {

        for (var evse of this.EVSEs)
        {
            if (evse["@id"] === Id)
                return evse;
        }

        return null;

    }

    public GetMeter: chargyInterfaces.GetMeterFunc = (Id: string) => {

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

            var sha256value = await chargyLib.sha256(JSON.stringify(toCheck));
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


    //#region (private) decompressFiles(FileInfos)

    private async decompressFiles(FileInfos: Array<chargyInterfaces.IFileInfo>): Promise<Array<chargyInterfaces.IFileInfo>> {

        //#region Initial checks

        if (FileInfos == null || FileInfos.length == 0)
            return FileInfos;

        //const require = createRequire(import.meta.url);

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
        let expandedFileInfos = new Array<chargyInterfaces.IFileInfo>();

        do
        {

            archiveFound      = false;
            expandedFileInfos = new Array<chargyInterfaces.IFileInfo>();

            for (let FileInfo of FileInfos)
            {

                if (FileInfo.data != null && FileInfo.data.byteLength > 0)
                {

                    try
                    {

                        const filetype = await fileTypeFromBuffer(FileInfo.data);

                        if (filetype?.mime == undefined)
                        {

                            if (FileInfo.name.endsWith(".chargy"))
                                expandedFileInfos.push({
                                                      name:       FileInfo.name,
                                                      data:       FileInfo.data,
                                                      info:       ".chargy file"
                                                  });

                            else
                                expandedFileInfos.push({
                                                      name:       FileInfo.name,
                                                      data:       FileInfo.data,
                                                      exception:  "Unknown file type!"
                                                  });

                            continue;

                        }

                        else if (filetype.mime.toString() === "text/xml" ||
                                 filetype.mime.toString() === "application/xml"
                                 )
                        {
                            expandedFileInfos.push({
                                                  name:  FileInfo.name,
                                                  data:  FileInfo.data,
                                                  info:  "XML file"
                                              });
                            continue;
                        }

                        else if (filetype.mime.toString() === "text/json" ||
                                 filetype.mime.toString() === "application/json"
                                 )
                        {
                            expandedFileInfos.push({
                                                  name:  FileInfo.name,
                                                  data:  FileInfo.data,
                                                  info:  "JSON file"
                                              });
                            continue;
                        }

                        else if (filetype.mime.toString() === "application/zip"     ||
                                 filetype.mime.toString() === "application/x-bzip2" ||
                                 filetype.mime.toString() === "application/gzip"    ||
                                 filetype.mime.toString() === "application/x-tar")
                        {

                            try
                            {

                                let compressedFiles:Array<chargyInterfaces.TarInfo> = await decompress(Buffer.from(FileInfo.data),
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

                                if (compressedFiles.length == 1 && compressedFiles[0]?.path == null)
                                {
                                    expandedFileInfos.push({
                                                          name:  FileInfo.name.substring(0, FileInfo.name.lastIndexOf('.')),
                                                          data:  compressedFiles[0]?.data
                                                      });
                                    continue;
                                }

                                //#endregion

                                //#region A chargepoint compressed archive file

                                let CTRfile:any    = null;
                                let dataFile       = "";
                                let signatureFile  = "";

                                if (compressedFiles.length >= 2)
                                {

                                    for (let file of compressedFiles)
                                    {
                                        if (file.type === "file")
                                        {
                                            switch (file.path)
                                            {

                                                case "secrrct":
                                                {
                                                    try
                                                    {
                                                        dataFile = new TextDecoder('utf-8').decode(file.data);
                                                    }
                                                    catch (Exception)
                                                    {
                                                        console.debug("Invalid chargepoint 'secrrct' file!")
                                                    }
                                                }
                                                break;

                                                case "secrrct.sign":
                                                {
                                                    try
                                                    {
                                                        signatureFile = chargyLib.buf2hex(file.data);
                                                    }
                                                    catch (Exception)
                                                    {
                                                        console.debug("Invalid chargepoint 'secrrct.sign' file!")
                                                    }
                                                }
                                                break;

                                            }
                                        }

                                    }

                                    if (dataFile?.     length > 0 &&
                                        signatureFile?.length > 0)
                                    {
                                        try
                                        {

                                            CTRfile           = JSON.parse(dataFile);

                                            // Save the 'original' JSON with whitespaces for later signature verification!
                                            CTRfile.original  = btoa(dataFile);
                                            CTRfile.signature = signatureFile;

                                            expandedFileInfos.push({
                                                name: FileInfo.name,
                                                data: new TextEncoder().encode(JSON.stringify(CTRfile))
                                            });

                                        }
                                        catch (Exception)
                                        {
                                            console.debug("Could not parse chargepoint 'secrrct' file!")
                                        }
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

                            }
                            catch (exception) {
                                console.log("Error decompressing files: " + exception);
                            }

                            continue;

                        }

                        // expandedFileInfos.push({
                        //                       name:  FileInfo.name,
                        //                       data:  FileInfo.data
                        //                   });

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

    //#region DetectAndConvertContentFormat(FileInfos)

    public async DetectAndConvertContentFormat(FileInfos: Array<chargyInterfaces.IFileInfo>): Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult> {

        //#region Initial checks

        if (FileInfos == null || FileInfos.length == 0) return {
            status:    chargyInterfaces.SessionVerificationResult.NoChargeTransparencyRecordsFound,
            message:   this.GetLocalizedMessage("No charge transparency records found!"),
            certainty: 0
        }

        let expandedFiles  = new Array<chargyInterfaces.IFileInfo>();
        let processedFiles = new Array<chargyInterfaces.IExtendedFileInfo>();

        //#endregion

        //#region Process PDF/A-3 and compressed files

        if (FileInfos && FileInfos.length > 0)
        {
            for (var fileInfo of FileInfos)
            {

                //#region Process PDF/A-3 attachments

                if (fileInfo.type === "application/pdf" || fileInfo.name.endsWith(".pdf"))
                {

                    const pdfWorkerSrc = require('pdfjs-dist/build/pdf.worker.mjs');
                    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

                    const pdfDocument  = fileInfo.data
                                            ? await pdfjsLib.getDocument(fileInfo.data).promise
                                            : fileInfo.path
                                                  ? await pdfjsLib.getDocument(fileInfo.path).promise
                                                  : null;

                    if (pdfDocument)
                    {
                        try
                        {

                            const attachments = await pdfDocument.getAttachments();

                            Object.keys(attachments).forEach(fileName => {

                                const attachment = attachments[fileName];

                                if (attachment.filename.endsWith('.chargy'))
                                    expandedFiles.push({
                                        name:  attachment.filename,
                                        path:  FileInfos[0]?.path,
                                        type:  "application/chargy",
                                        data:  attachment.content,
                                        info:  "A CHARGY file extracted from a PDF/A-3 or newer attachment"
                                    });

                                else if (attachment.filename.endsWith('.xml'))
                                    expandedFiles.push({
                                        name:  attachment.filename,
                                        path:  FileInfos[0]?.path,
                                        type:  "application/xml",
                                        data:  attachment.content,
                                        info:  "A XML file extracted from a PDF/A-3 or newer attachment"
                                    });

                                else if (attachment.filename.endsWith('.json'))
                                    expandedFiles.push({
                                        name:  attachment.filename,
                                        path:  FileInfos[0]?.path,
                                        type:  "application/json",
                                        data:  attachment.content,
                                        info:  "A JSON file extracted from a PDF/A-3 or newer attachment"
                                    });

                                else if (attachment.filename.endsWith('.csv'))
                                    expandedFiles.push({
                                        name:  attachment.filename,
                                        path:  FileInfos[0]?.path,
                                        type:  "text/csv",
                                        data:  attachment.content,
                                        info:  "A CSV file extracted from a PDF/A-3 or newer attachment"
                                    });

                            });

                        } catch (error) {
                            console.error(`Error extracting PDF/A-3 attachments: ${error}`);
                        }
                    }

                }

                //#endregion

                //#region Process compressed files

                else if (fileInfo.type === "application/x-zip-compressed" ||
                         fileInfo.type === "application/x-compressed"     ||
                         fileInfo.type === "application/zip"              ||
                         fileInfo.type === "application/x-bzip2"          ||
                         fileInfo.type === "application/gzip"             ||
                         fileInfo.type === "application/x-gzip"           ||
                         fileInfo.type === "application/x-tar")
                {

                    try
                    {

                        const decompressedFiles = await this.decompressFiles([fileInfo]);

                        for (var decompressedFile of decompressedFiles)
                            expandedFiles.push(decompressedFile);

                    }
                    catch (exception)
                    {
                        console.log("Error decompressing files: " + exception);
                    }

                }

                //#endregion

                else
                    expandedFiles.push(fileInfo);

            }
        }

        //#endregion

        //#region Process JSON/XML/text files

        for (let expandedFile of expandedFiles)
        {

            let processedFile  = expandedFile as chargyInterfaces.IExtendedFileInfo;
            let textContent    = new TextDecoder('utf-8').decode(expandedFile.data)?.trim();

            // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
            // conversion translates it to FEFF (UTF-16 BOM)
            if (textContent?.charCodeAt(0) === 0xFEFF)
                textContent = textContent.substring(1);

            //#region XML processing...

            if (textContent?.startsWith("<?xml"))
            {
                try
                {

                    let XMLDocument = new DOMParser().parseFromString(textContent, "text/xml");

                    //#region XML namespace found...

                    let xmlns = XMLDocument.lookupNamespaceURI(null);
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

                                if (processedFile.result.status && processedFile.result.status !== chargyInterfaces.SessionVerificationResult.Unvalidated)
                                    processedFile.result = await new XMLContainer(this).tryToParseXMLContainer(XMLDocument);

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

                        if (processedFile.result.status &&
                           (processedFile.result.status === chargyInterfaces.SessionVerificationResult.Unvalidated ||
                            processedFile.result.status === chargyInterfaces.SessionVerificationResult.InvalidSignature))
                        {
                            processedFile.result = await new XMLContainer(this).tryToParseXMLContainer(XMLDocument);
                        }

                    }

                    //#endregion

                } catch (exception)
                {
                    processedFile.result = {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:    this.GetLocalizedMessage("UnknownOrInvalidXMLChargeTransparencyFormat"),
                        exception:  exception,
                        certainty: 0
                    }
                }
            }

            //#endregion

            //#region OCMF processing

            else if (textContent?.startsWith("OCMF"))
                processedFile.result = await new OCMF(this).TryToParseOCMFDocument(textContent);

            //#endregion

            //#region ALFEN processing

            else if (textContent?.startsWith("AP;"))
                processedFile.result = await new Alfen(this).TryToParseALFENFormat(textContent, {});

            //#endregion

            //#region Public key processing (PEM format)

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
                                value:  chargyLib.buf2hex(publicKeyDER.publicKey.data),
                                certainty: 0
                            }
                        ]
                    };

                }
                catch (exception)
                {
                    processedFile.result = {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidPublicKey,
                        message:    this.GetLocalizedMessage("UnknownOrInvalidPublicKeyFormat"),
                        exception:  exception,
                        certainty: 0
                    }
                }

            }

            //#endregion

            //#region JSON processing

            else if (textContent?.startsWith("{") || textContent?.startsWith("["))
            {
                try
                {

                    const JSONContent = JSON.parse(textContent);
                    const JSONContext = (JSONContent["@context"] as string)?.trim() ?? "";

                    if      (JSONContext.startsWith("https://open.charging.cloud/contexts/CTR+json"))
                        processedFile.result = JSONContent as chargyInterfaces.IChargeTransparencyRecord;

                    else if (JSONContext.startsWith("https://open.charging.cloud/contexts/publicKey+json"))
                        processedFile.result = JSONContent as chargyInterfaces.IPublicKeyInfo;

                    else if (JSONContext.startsWith("https://www.lichtblick.de/contexts/charging-station-json") ||
                             JSONContext.startsWith("https://www.eneco.com/contexts/charging-station-json")     ||
                             JSONContext.startsWith("https://www.chargeit-mobility.com/contexts/charging-station-json"))
                    {
                        processedFile.result = await new ChargeIT(this).TryToParseChargeITContainerFormat(JSONContent);
                    }

                    // Some formats do not provide any context or format identifiers...
                    else
                    {

                        const results = [
                            await new ChargeIT(this).     TryToParseChargeITContainerFormat(JSONContent),
                            await new ChargePoint(this).TryToParseChargepointFormat      (JSONContent),
                            await new OCPI(this).         tryToParseOCPIFormat             (JSONContent)
                        ];

                        //#region Filter and sort results

                        const filteredResults = results.filter((ctr) => {

                            // At this point we currently only know whether the CTR data format is correct,
                            // but NOT whether the crypto signatures are correct!
                            return chargyInterfaces.isISessionCryptoResult1(ctr);// &&
                                //ctr.status === chargyInterfaces.SessionVerificationResult.Unvalidated;

                        });

                        const sortedResults = filteredResults.sort((ctr1, ctr2) => {

                            if (ctr1.certainty > ctr2.certainty) {
                                return -1;
                            }

                            if (ctr1.certainty < ctr2.certainty) {
                                return 1;
                            }

                            return 0;

                        });

                        if (sortedResults.length >= 1 && sortedResults[0])
                            processedFile.result = sortedResults[0];

                        //#endregion

                    }

                }
                catch (exception) {
                    processedFile.result = {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:    this.GetLocalizedMessage("UnknownOrInvalidJSONChargeTransparencyFormat"),
                        exception:  exception,
                        certainty:  0
                    }
                }
            }

            //#endregion


            if (processedFile.result == undefined) {
                processedFile.result = {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   this.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord"),
                    certainty: 0
                }
            }

            processedFiles.push(processedFile);

        }

        //#endregion


        //#region If a single CTR had been found...

        if (processedFiles.length == 1)
        {

            var processedFile = processedFiles[0];
            if (processedFile)
            {

                if (chargyInterfaces.IsAChargeTransparencyRecord(processedFile.result))
                    return this.processChargeTransparencyRecord(processedFile.result);

                if (chargyInterfaces.IsAPublicKeyLookup(processedFile.result))
                    return {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:    this.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord"),
                        certainty:  0
                    };

                // Can only be an ISessionCryptoResult/error message!
                return processedFile.result;

            }

            return {
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:    this.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord"),
                certainty:  0
            };

        }

        //#endregion

        //#region If multiple CTR had been found => Merge them into a single CTR!

        else if (processedFiles.length > 1)
        {

            let mergedCTR:chargyInterfaces.IChargeTransparencyRecord = {
                "@id":      "",
                "@context": "",
                certainty:   0
            };

            for (const processedFile of processedFiles)
            {

                const processedFileResult = processedFile?.result;

                if (chargyInterfaces.IsAChargeTransparencyRecord(processedFileResult))
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

                else if (chargyInterfaces.IsAPublicKeyInfo(processedFileResult))
                {

                    if (!mergedCTR.publicKeys)
                        mergedCTR.publicKeys = new Array<chargyInterfaces.IPublicKeyInfo>();

                    mergedCTR.publicKeys.push(processedFileResult);

                }

                else if (chargyInterfaces.IsAPublicKeyLookup(processedFileResult))
                {

                    if (!mergedCTR.publicKeys)
                        mergedCTR.publicKeys = new Array<chargyInterfaces.IPublicKeyInfo>();

                    for (const publicKey of processedFileResult.publicKeys)
                        mergedCTR.publicKeys.push(publicKey);

                }

                else
                {

                    if (mergedCTR.invalidDataSets === undefined)
                        mergedCTR.invalidDataSets = new Array<chargyInterfaces.IExtendedFileInfo>();

                    mergedCTR.invalidDataSets.push(processedFile);

                }

            }

            if (chargyInterfaces.IsAChargeTransparencyRecord(mergedCTR))
                return this.processChargeTransparencyRecord(mergedCTR);

        }

        //#endregion

        return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   this.GetLocalizedMessage("No charge transparency records found!"),
            certainty: 0
        }

    }

    //#endregion

    //#region (private) processChargeTransparencyRecord(CTR)

    private async processChargeTransparencyRecord(CTR: chargyInterfaces.IChargeTransparencyRecord): Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        //#region Initial checks

        if (!chargyInterfaces.IsAChargeTransparencyRecord(CTR))
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   this.GetLocalizedMessage("UnknownOrInvalidJSONChargeTransparencyFormat"),
                certainty: 0
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

            // We operate on an agumented copy of the data!
            this.internalCTR  = chargyLib.CloneCTR(CTR);
            this.currentCTR   = CTR;

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
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

    }

    //#endregion

    //#region (private) processChargingSession(chargingSession)

    private async processChargingSession(chargingSession: chargyInterfaces.IChargingSession) : Promise<chargyInterfaces.ISessionCryptoResult>
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
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   this.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                certainty: 0
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
                chargingSession.method = new OCMFv1_x(this);
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
                    status:    chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                    message:   this.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                    certainty: 0
                }

        }

    }

    //#endregion




    public MergeChargeTransparencyRecords(CTRs: Array<chargyInterfaces.IChargeTransparencyRecord>): chargyInterfaces.IChargeTransparencyRecord
    {

        const mergedCTR:chargyInterfaces.IChargeTransparencyRecord = {
            "@id":       "",
            "@context":  "",
            certainty:    0
        };

        for (const ctr of CTRs)
        {

            //Note: the CTRs might have different @context values and additional context/format specific data!

            if (mergedCTR["@id"] === "")
                mergedCTR["@id"] = ctr["@id"];

            if (mergedCTR["@context"] === "")
                mergedCTR["@context"] = ctr["@context"];

            if (!mergedCTR.begin || (mergedCTR.begin && ctr.begin && mergedCTR.begin > ctr.begin))
                mergedCTR.begin = ctr.begin;

            if (!mergedCTR.end || (mergedCTR.end && ctr.end && mergedCTR.end < ctr.end))
                mergedCTR.end = ctr.end;

            if (!mergedCTR.description)
                mergedCTR.description = ctr.description;

            //ToDo: Is this a really good idea? Or should we fail, whenever this information is different?
            if (!mergedCTR.contract)
                mergedCTR.contract = ctr.contract;


            if (!mergedCTR.chargingStationOperators)
                mergedCTR.chargingStationOperators = ctr.chargingStationOperators;
            else if (ctr.chargingStationOperators)
                for (let chargingStationOperator of ctr.chargingStationOperators)
                    mergedCTR.chargingStationOperators.push(chargingStationOperator);

            if (!mergedCTR.chargingPools)
                mergedCTR.chargingPools = ctr.chargingPools;
            else if (ctr.chargingPools)
                for (let chargingPool of ctr.chargingPools)
                    mergedCTR.chargingPools.push(chargingPool);

            if (!mergedCTR.chargingStations)
                mergedCTR.chargingStations = ctr.chargingStations;
            else if (ctr.chargingStations)
                for (let chargingStation of ctr.chargingStations)
                    mergedCTR.chargingStations.push(chargingStation);

            // publicKeys

            if (!mergedCTR.chargingSessions)
                mergedCTR.chargingSessions = ctr.chargingSessions;
            else if (ctr.chargingSessions)
                for (let chargingSession of ctr.chargingSessions)
                    mergedCTR.chargingSessions.push(chargingSession);

            if (!mergedCTR.eMobilityProviders)
                mergedCTR.eMobilityProviders = ctr.eMobilityProviders;
            else if (ctr.eMobilityProviders)
                for (let eMobilityProvider of ctr.eMobilityProviders)
                    mergedCTR.eMobilityProviders.push(eMobilityProvider);

            if (!mergedCTR.mediationServices)
                mergedCTR.mediationServices = ctr.mediationServices;
            else if (ctr.mediationServices)
                for (let mediationService of ctr.mediationServices)
                    mergedCTR.mediationServices.push(mediationService);

        }

        return mergedCTR;

    }



}
