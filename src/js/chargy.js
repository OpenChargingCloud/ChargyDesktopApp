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
///<reference path="certificates.ts" />
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
class Chargy {
    //#endregion
    constructor(elliptic, moment) {
        this.chargingStationOperators = new Array();
        this.chargingPools = new Array();
        this.chargingStations = new Array();
        this.EVSEs = new Array();
        this.meters = new Array();
        this.chargingSessions = new Array();
        this.eMobilityProviders = new Array();
        this.mediationServices = new Array();
        this.currentCTR = {};
        this.internalCTR = {};
        //#region GetMethods...
        this.GetChargingPool = (Id) => {
            for (var chargingPool of this.chargingPools) {
                if (chargingPool["@id"] === Id)
                    return chargingPool;
            }
            return null;
        };
        this.GetChargingStation = (Id) => {
            for (var chargingStation of this.chargingStations) {
                if (chargingStation["@id"] === Id)
                    return chargingStation;
            }
            return null;
        };
        this.GetEVSE = (Id) => {
            for (var evse of this.EVSEs) {
                if (evse["@id"] === Id)
                    return evse;
            }
            return null;
        };
        this.GetMeter = (Id) => {
            for (var meter of this.meters) {
                if (meter["@id"] === Id)
                    return meter;
            }
            return null;
        };
        this.elliptic = elliptic;
        this.moment = moment;
    }
    //#endregion
    //#region CheckMeterPublicKeySignature(...)
    async CheckMeterPublicKeySignature(chargingStation, evse, meter, publicKey, signature) {
        // For now: Do not enforce this feature!
        if (chargingStation == null || evse == null || meter == null || publicKey == null || signature == null)
            return ""; // "<i class=\"fas fa-exclamation-circle\"></i> Unbekannter Public Key!";
        try {
            var toCheck = {
                "@id": chargingStation["@id"],
                "description": chargingStation.description,
                "geoLocation": chargingStation.geoLocation,
                "address": chargingStation.address,
                "softwareVersion": chargingStation.softwareVersion,
                "EVSE": {
                    "@id": evse["@id"],
                    "description": evse.description,
                    "sockets": evse.sockets,
                    "meter": {
                        "@id": meter["@id"],
                        "vendor": meter.vendor,
                        "model": meter.model,
                        "firmwareVersion": meter.firmwareVersion,
                        "signatureFormat": meter.signatureFormat,
                        "publicKey": {
                            "algorithm": publicKey.algorithm,
                            "format": publicKey.format,
                            "value": publicKey.value,
                            "signature": {
                                "signer": signature.signer,
                                "timestamp": signature.timestamp,
                                "comment": signature.comment,
                                "algorithm": signature.algorithm,
                                "format": signature.format
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
                verify(sha256value, signature.signature);
            if (result)
                return "<i class=\"fas fa-check-circle\"></i>" + signature.signer;
        }
        catch (exception) { }
        return "<i class=\"fas fa-times-circle\"></i>" + signature.signer;
    }
    //#endregion
    //#region decompressFiles(FileInfos)
    async decompressFiles(FileInfos) {
        //#region Initial checks
        var _a, _b;
        if (FileInfos == null || FileInfos.length == 0)
            return FileInfos;
        const fileType = require('file-type');
        const decompress = require('decompress');
        const decompressTar = require('decompress-tar');
        const decompressTargz = require('decompress-targz');
        const decompressTarbz2 = require('decompress-tarbz2');
        // const decompressTarxz  = require('decompress-tarxz'); // Does not compile!
        const decompressUnzip = require('decompress-unzip');
        const decompressGz = require('decompress-gz');
        const decompressBzip2 = require('decompress-bzip2');
        //#endregion
        // DataInfos.sort(function (a, b) {
        //     if (a.name < b.name) return -1;
        //     if (a.name > b.name) return +1;
        //     return 0;
        // });
        let archiveFound = false;
        let expandedFileInfos = new Array();
        do {
            archiveFound = false;
            expandedFileInfos = new Array();
            for (let FileInfo of FileInfos) {
                if (FileInfo.data != null && FileInfo.data.byteLength > 0) {
                    try {
                        const filetype = await fileType.fromBuffer(FileInfo.data);
                        const mimeType = filetype === null || filetype === void 0 ? void 0 : filetype.mime;
                        if (mimeType != null &&
                            mimeType != undefined &&
                            mimeType != "text/xml" &&
                            mimeType != "text/json" &&
                            mimeType != "application/xml" &&
                            mimeType != "application/json") {
                            let compressedFiles = await decompress(Buffer.from(FileInfo.data), { plugins: [decompressTar(),
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
                            if (compressedFiles.length == 1 && compressedFiles[0].path == null) {
                                expandedFileInfos.push({ name: FileInfo.name.substring(0, FileInfo.name.lastIndexOf('.')),
                                    data: compressedFiles[0].data });
                                continue;
                            }
                            //#endregion
                            //#region A chargepoint compressed archive file
                            let CTRfile = null;
                            let dataFile = "";
                            let singatureFile = "";
                            if (compressedFiles.length >= 2) {
                                for (let file of compressedFiles) {
                                    if (file.type === "file" && file.path === "secrrct") {
                                        try {
                                            dataFile = new TextDecoder('utf-8').decode(file.data);
                                        }
                                        catch (Exception) {
                                            console.debug("Invalid chargepoint CTR file!");
                                        }
                                    }
                                    if (file.type === "file" && file.path === "secrrct.sign") {
                                        try {
                                            singatureFile = buf2hex(file.data);
                                        }
                                        catch (Exception) {
                                            console.debug("Invalid chargepoint CTR file!");
                                        }
                                    }
                                }
                                if (dataFile != null && dataFile.length > 0 && singatureFile != null && singatureFile != "") {
                                    CTRfile = JSON.parse(dataFile);
                                    CTRfile.original = btoa(dataFile); // Save the original JSON with whitespaces for later signature verification!
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
                            for (let compressedFile of compressedFiles) {
                                if (compressedFile.type === "file") {
                                    expandedFileInfos.push({
                                        name: (_a = compressedFile.path) === null || _a === void 0 ? void 0 : _a.substring((_b = compressedFile.path.lastIndexOf('/') + 1) !== null && _b !== void 0 ? _b : FileInfo.name),
                                        data: compressedFile.data
                                    });
                                }
                            }
                            //#endregion
                            continue;
                        }
                        expandedFileInfos.push({
                            name: FileInfo.name,
                            data: FileInfo.data
                        });
                    }
                    catch (exception) {
                        expandedFileInfos.push({
                            name: FileInfo.name,
                            data: FileInfo.data,
                            exception: exception
                        });
                    }
                }
            }
            if (archiveFound)
                FileInfos = expandedFileInfos;
        } while (archiveFound);
        return expandedFileInfos;
    }
    //#endregion
    //#region detectAndConvertContentFormat(FileInfos)
    async detectAndConvertContentFormat(FileInfos) {
        //#region Initial checks
        var _a;
        if (FileInfos == null || FileInfos.length == 0)
            return {
                status: SessionVerificationResult.InvalidSessionFormat,
                message: "Unknown data format!"
            };
        const fileType = require('file-type');
        const decompress = require('decompress');
        const decompressTar = require('decompress-tar');
        const decompressTargz = require('decompress-targz');
        const decompressTarbz2 = require('decompress-tarbz2');
        // const decompressTarxz  = require('decompress-tarxz'); // Does not compile!
        const decompressUnzip = require('decompress-unzip');
        const decompressGz = require('decompress-gz');
        const decompressBzip2 = require('decompress-bzip2');
        //#endregion
        // DataInfos.sort(function (a, b) {
        //     if (a.name < b.name) return -1;
        //     if (a.name > b.name) return +1;
        //     return 0;
        // });
        let expandedFiles = await this.decompressFiles(FileInfos);
        //#region Process JSON/XML/text files
        let processedFiles = new Array();
        for (let expandedFile of expandedFiles) {
            let processedFile = expandedFile;
            let textContent = (_a = new TextDecoder('utf-8').decode(expandedFile.data)) === null || _a === void 0 ? void 0 : _a.trim();
            // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
            // conversion translates it to FEFF (UTF-16 BOM)
            if ((textContent === null || textContent === void 0 ? void 0 : textContent.charCodeAt(0)) === 0xFEFF)
                textContent = textContent.substr(1);
            // XML processing...
            if (textContent === null || textContent === void 0 ? void 0 : textContent.startsWith("<?xml")) {
                try {
                    let XMLDocument = new DOMParser().parseFromString(textContent, "text/xml");
                    //#region XML namespace found...
                    let xmlns = XMLDocument.lookupNamespaceURI(null);
                    if (xmlns != null) {
                        switch (xmlns) {
                            case "http://www.mennekes.de/Mennekes.EdlVerification.xsd":
                                processedFile.result = await new Mennekes().tryToParseMennekesXML(XMLDocument);
                                break;
                            case "http://transparenz.software/schema/2018/07":
                                processedFile.result = await new SAFEXML().tryToParseSAFEXML(XMLDocument);
                                break;
                            // The SAFE transparency software v1.0 does not understand its own
                            // XML namespace. Therefore we have to guess the format.
                            case "":
                                processedFile.result = await new SAFEXML().tryToParseSAFEXML(XMLDocument);
                                break;
                        }
                    }
                    //#endregion
                    //#region ..., or plain XML.
                    else {
                        // The SAFE transparency software v1.0 does not understand its own
                        // XML namespace. Therefore we have to guess the format.
                        processedFile.result = await new SAFEXML().tryToParseSAFEXML(XMLDocument);
                    }
                    //#endregion
                }
                catch (exception) {
                    processedFile.result = {
                        status: SessionVerificationResult.InvalidSessionFormat,
                        message: "Unknown or invalid XML data format!",
                        exception: exception
                    };
                }
            }
            // OCMF processing
            else if (textContent === null || textContent === void 0 ? void 0 : textContent.startsWith("OCMF|{"))
                processedFile.result = await new OCMF().tryToParseOCMF2(textContent);
            // ALFEN processing
            else if (textContent === null || textContent === void 0 ? void 0 : textContent.startsWith("AP;"))
                processedFile.result = await new Alfen01().tryToParseALFENFormat(textContent);
            // Public key processing (PEM format)
            else if ((textContent === null || textContent === void 0 ? void 0 : textContent.startsWith("-----BEGIN PUBLIC KEY-----")) && (textContent === null || textContent === void 0 ? void 0 : textContent.endsWith("-----END PUBLIC KEY-----"))) {
                try {
                    const keyId = (processedFile.name.indexOf('.') > -1
                        ? processedFile.name.substring(0, processedFile.name.indexOf('.'))
                        : processedFile.name).replace("-publicKey", "");
                    const publicKeyPEM = textContent.replace("-----BEGIN PUBLIC KEY-----", "").
                        replace("-----END PUBLIC KEY-----", "").
                        split('\n').
                        map((line) => line.trim()).
                        filter((line) => line !== '' && !line.startsWith('#')).
                        join("");
                    // https://lapo.it/asn1js/ for a visual check...
                    // https://github.com/indutny/asn1.js
                    const ASN1 = require('asn1.js');
                    const ASN1_OIDs = ASN1.define('OIDs', function () {
                        //@ts-ignore
                        this.key('oid').objid();
                    });
                    const ASN1_PublicKey = ASN1.define('PublicKey', function () {
                        //@ts-ignore
                        this.seq().obj(
                        //@ts-ignore
                        this.key('oids').seqof(ASN1_OIDs), 
                        //@ts-ignore
                        this.key('publicKey').bitstr());
                    });
                    const publicKeyDER = ASN1_PublicKey.decode(Buffer.from(publicKeyPEM, 'base64'), 'der');
                    const KeyType_OID = publicKeyDER.oids[0].join(".");
                    let KeyType = "unknown";
                    switch (KeyType_OID) {
                        case "1.2.840.10045.2.1":
                            KeyType = "ecPublicKey"; // ANSI X9.62 public key type
                            break;
                    }
                    const Curve_OID = publicKeyDER.oids[1].join(".");
                    let Curve = "unknown";
                    switch (Curve_OID) {
                        // Koblitz 224-bit curve
                        case "1.3.132.0.32":
                            Curve = "secp224k1";
                            break;
                        // NIST/ANSI X9.62 named 256-bit elliptic curve used with SHA256
                        case "1.2.840.10045.3.1.7":
                            Curve = "secp256r1"; // also: ANSI prime256v1, NIST P-256
                            break;
                        // NIST/ANSI X9.62 named 384-bit elliptic curve used with SHA384
                        case "1.3.132.0.34":
                            Curve = "secp384r1"; // also: ANSI prime384v1, NIST P-384
                            break;
                        // NIST/ANSI X9.62 named 521-bit elliptic curve used with SHA512
                        case "1.3.132.0.35":
                            Curve = "secp521r1"; // also: ANSI prime521v1, NIST P-521
                            break;
                    }
                    processedFile.result = {
                        "@id": keyId,
                        "@context": "https://open.charging.cloud/contexts/CTR+json",
                        publicKeys: [
                            {
                                id: keyId,
                                type: {
                                    oid: KeyType_OID,
                                    description: KeyType
                                },
                                curve: {
                                    oid: Curve_OID,
                                    description: Curve
                                },
                                value: buf2hex(publicKeyDER.publicKey.data)
                            }
                        ]
                    };
                }
                catch (exception) {
                    // Just ignore this file...
                }
            }
            // JSON processing
            else if ((textContent === null || textContent === void 0 ? void 0 : textContent.startsWith("{")) || (textContent === null || textContent === void 0 ? void 0 : textContent.startsWith("["))) {
                try {
                    let JSONContent = JSON.parse(textContent);
                    switch (JSONContent["@context"]) {
                        case "https://open.charging.cloud/contexts/CTR+json":
                            processedFile.result = JSONContent;
                            break;
                        default:
                            // The current chargeIT mobility format does not provide any context or format identifiers
                            processedFile.result = await new ChargeIT().tryToParseChargeITJSON(JSONContent);
                            // The current chargepoint format does not provide any context or format identifiers
                            if (isISessionCryptoResult(processedFile.result))
                                processedFile.result = await new Chargepoint01().tryToParseChargepointJSON(JSONContent);
                            break;
                    }
                }
                catch (exception) {
                    return {
                        status: SessionVerificationResult.InvalidSessionFormat,
                        message: "Unknown or invalid JSON data format!",
                        exception: exception
                    };
                }
            }
            processedFiles.push(processedFile);
        }
        //#endregion
        //#region If a single CTR had been found...
        if (processedFiles.length == 1) {
            if (IsAChargeTransparencyRecord(processedFiles[0].result))
                return this.processChargeTransparencyRecord(processedFiles[0].result);
            else
                return processedFiles[0].result;
        }
        //#endregion
        //#region If multiple CTR had been found => merge them into a single one
        else if (processedFiles.length > 1) {
            let CTR = await this.mergeChargeTransparencyRecords(processedFiles.map(file => file.result));
            if (IsAChargeTransparencyRecord(CTR))
                return this.processChargeTransparencyRecord(CTR);
        }
        //#endregion
        return {
            status: SessionVerificationResult.InvalidSessionFormat,
            message: "Unbekanntes Transparenzdatensatzformat!"
        };
    }
    //#endregion
    //#region mergeChargeTransparencyRecord(CTRs)
    async mergeChargeTransparencyRecords(CTRs) {
        //#region Initial checks
        if (CTRs == null || CTRs.length == 0)
            return {
                status: SessionVerificationResult.InvalidSessionFormat,
                message: "Ungültiges Transparenzdatensatzformat!"
            };
        //#endregion
        let mergedCTR = {
            "@id": "",
            "@context": ""
        };
        for (let currentCTR of CTRs) {
            if (IsAChargeTransparencyRecord(currentCTR)) {
                if (mergedCTR["@id"] === "")
                    mergedCTR["@id"] = currentCTR["@id"];
                if (mergedCTR["@context"] === "")
                    mergedCTR["@context"] = currentCTR["@context"];
                if (!mergedCTR.begin || (mergedCTR.begin && currentCTR.begin && mergedCTR.begin > currentCTR.begin))
                    mergedCTR.begin = currentCTR.begin;
                if (!mergedCTR.end || (mergedCTR.end && currentCTR.end && mergedCTR.end < currentCTR.end))
                    mergedCTR.end = currentCTR.end;
                if (!mergedCTR.description)
                    mergedCTR.description = currentCTR.description;
                //ToDo: Is this a really good idea? Or should we fail, whenever this information is different?
                if (!mergedCTR.contract)
                    mergedCTR.contract = currentCTR.contract;
                if (!mergedCTR.chargingStationOperators)
                    mergedCTR.chargingStationOperators = currentCTR.chargingStationOperators;
                else if (currentCTR.chargingStationOperators)
                    for (let chargingStationOperator of currentCTR.chargingStationOperators)
                        mergedCTR.chargingStationOperators.push(chargingStationOperator);
                if (!mergedCTR.chargingPools)
                    mergedCTR.chargingPools = currentCTR.chargingPools;
                else if (currentCTR.chargingPools)
                    for (let chargingPool of currentCTR.chargingPools)
                        mergedCTR.chargingPools.push(chargingPool);
                if (!mergedCTR.chargingStations)
                    mergedCTR.chargingStations = currentCTR.chargingStations;
                else if (currentCTR.chargingStations)
                    for (let chargingStation of currentCTR.chargingStations)
                        mergedCTR.chargingStations.push(chargingStation);
                // publicKeys
                if (!mergedCTR.chargingSessions)
                    mergedCTR.chargingSessions = currentCTR.chargingSessions;
                else if (currentCTR.chargingSessions)
                    for (let chargingSession of currentCTR.chargingSessions)
                        mergedCTR.chargingSessions.push(chargingSession);
                if (!mergedCTR.eMobilityProviders)
                    mergedCTR.eMobilityProviders = currentCTR.eMobilityProviders;
                else if (currentCTR.eMobilityProviders)
                    for (let eMobilityProvider of currentCTR.eMobilityProviders)
                        mergedCTR.eMobilityProviders.push(eMobilityProvider);
                if (!mergedCTR.mediationServices)
                    mergedCTR.mediationServices = currentCTR.mediationServices;
                else if (currentCTR.mediationServices)
                    for (let mediationService of currentCTR.mediationServices)
                        mergedCTR.mediationServices.push(mediationService);
            }
            else if (IsAPublicKeyLookup(currentCTR)) {
                if (!mergedCTR.publicKeys)
                    mergedCTR.publicKeys = new Array();
                for (let publicKey of currentCTR.publicKeys)
                    mergedCTR.publicKeys.push(publicKey);
            }
        }
        if (mergedCTR["@id"] === "" || mergedCTR["@context"] === "")
            return {
                status: SessionVerificationResult.InvalidSessionFormat,
                message: "Ungültiges Transparenzdatensatzformat!"
            };
        return mergedCTR;
    }
    //#endregion
    //#region processChargeTransparencyRecord(CTR)
    async processChargeTransparencyRecord(CTR) {
        //#region Initial checks
        if (!IsAChargeTransparencyRecord(CTR))
            return {
                status: SessionVerificationResult.InvalidSessionFormat,
                message: "Unbekanntes Transparenzdatensatzformat!"
            };
        //#endregion
        //#region Data
        this.chargingStationOperators = [];
        this.chargingPools = [];
        this.chargingStations = [];
        this.EVSEs = [];
        this.meters = [];
        this.chargingSessions = [];
        this.eMobilityProviders = [];
        this.mediationServices = [];
        //#endregion
        //ToDo: Verify @context
        try {
            this.currentCTR = CTR;
            this.internalCTR = JSON.parse(JSON.stringify(CTR)); // Operate on a copy of the data!
            //#region Process operators (pools, stations, evses, tariffs, ...)
            if (this.internalCTR.chargingStationOperators) {
                for (var chargingStationOperator of this.internalCTR.chargingStationOperators) {
                    this.chargingStationOperators.push(chargingStationOperator);
                    if (chargingStationOperator.chargingPools) {
                        for (var chargingPool of chargingStationOperator.chargingPools) {
                            this.chargingPools.push(chargingPool);
                            if (chargingPool.chargingStations) {
                                for (var chargingStation of chargingPool.chargingStations) {
                                    this.chargingStations.push(chargingStation);
                                    if (chargingStation.EVSEs) {
                                        for (var EVSE of chargingStation.EVSEs) {
                                            EVSE.chargingStation = chargingStation;
                                            EVSE.chargingStationId = chargingStation["@id"];
                                            this.EVSEs.push(EVSE);
                                            if (EVSE.meters) {
                                                for (var meter of EVSE.meters) {
                                                    meter.EVSE = EVSE;
                                                    meter.EVSEId = EVSE["@id"];
                                                    meter.chargingStation = chargingStation;
                                                    meter.chargingStationId = chargingStation["@id"];
                                                    this.meters.push(meter);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (chargingStationOperator.chargingStations) {
                        for (var chargingStation of chargingStationOperator.chargingStations) {
                            this.chargingStations.push(chargingStation);
                            if (chargingStation.EVSEs) {
                                for (var EVSE of chargingStation.EVSEs) {
                                    EVSE.chargingStation = chargingStation;
                                    EVSE.chargingStationId = chargingStation["@id"];
                                    this.EVSEs.push(EVSE);
                                    if (EVSE.meters) {
                                        for (var meter of EVSE.meters) {
                                            meter.EVSE = EVSE;
                                            meter.EVSEId = EVSE["@id"];
                                            meter.chargingStation = chargingStation;
                                            meter.chargingStationId = chargingStation["@id"];
                                            this.meters.push(meter);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (chargingStationOperator.EVSEs) {
                        for (var EVSE of chargingStationOperator.EVSEs) {
                            // EVSE.chargingStation    = chargingStation;
                            // EVSE.chargingStationId  = chargingStation["@id"];
                            this.EVSEs.push(EVSE);
                            if (EVSE.meters) {
                                for (var meter of EVSE.meters) {
                                    meter.EVSE = EVSE;
                                    meter.EVSEId = EVSE["@id"];
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
                for (var chargingPool of this.internalCTR.chargingPools) {
                    this.chargingPools.push(chargingPool);
                    if (chargingPool.chargingStations) {
                        for (var chargingStation of chargingPool.chargingStations) {
                            this.chargingStations.push(chargingStation);
                            if (chargingStation.EVSEs) {
                                for (var EVSE of chargingStation.EVSEs) {
                                    EVSE.chargingStation = chargingStation;
                                    EVSE.chargingStationId = chargingStation["@id"];
                                    this.EVSEs.push(EVSE);
                                    if (EVSE.meters) {
                                        for (var meter of EVSE.meters) {
                                            meter.EVSE = EVSE;
                                            meter.EVSEId = EVSE["@id"];
                                            meter.chargingStation = chargingStation;
                                            meter.chargingStationId = chargingStation["@id"];
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
                for (var chargingStation of this.internalCTR.chargingStations) {
                    this.chargingStations.push(chargingStation);
                    if (chargingStation.EVSEs) {
                        for (var EVSE of chargingStation.EVSEs) {
                            EVSE.chargingStation = chargingStation;
                            EVSE.chargingStationId = chargingStation["@id"];
                            this.EVSEs.push(EVSE);
                            if (EVSE.meters) {
                                for (var meter of EVSE.meters) {
                                    meter.EVSE = EVSE;
                                    meter.EVSEId = EVSE["@id"];
                                    meter.chargingStation = chargingStation;
                                    meter.chargingStationId = chargingStation["@id"];
                                    this.meters.push(meter);
                                }
                            }
                        }
                    }
                    if (chargingStation.meters) {
                        for (var meter of chargingStation.meters) {
                            meter.chargingStation = chargingStation;
                            meter.chargingStationId = chargingStation["@id"];
                            this.meters.push(meter);
                        }
                    }
                }
            }
            //#endregion
            if (this.internalCTR.chargingSessions) {
                for (let chargingSession of this.internalCTR.chargingSessions) {
                    chargingSession.ctr = this.internalCTR;
                    chargingSession.verificationResult = await this.processChargingSession(chargingSession);
                    this.chargingSessions.push(chargingSession);
                }
            }
            return this.internalCTR;
        }
        catch (exception) {
            return {
                status: SessionVerificationResult.InvalidSessionFormat,
                message: "Exception occured: " + exception.message
            };
        }
    }
    //#endregion
    //#region processChargingSession(chargingSession)
    async processChargingSession(chargingSession) {
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
        if (chargingSession == null ||
            chargingSession.measurements == null) {
            return {
                status: SessionVerificationResult.InvalidSessionFormat
            };
        }
        switch (chargingSession["@context"]) {
            case "https://open.charging.cloud/contexts/SessionSignatureFormats/GDFCrypt01+json":
                chargingSession.method = new GDFCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);
            case "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json":
                chargingSession.method = new EMHCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);
            case "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json":
                chargingSession.method = new OCMFv1_0(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);
            case "https://open.charging.cloud/contexts/SessionSignatureFormats/ChargepointCrypt01+json":
                chargingSession.method = new ChargepointCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);
            case "https://open.charging.cloud/contexts/SessionSignatureFormats/AlfenCrypt01+json":
                chargingSession.method = new AlfenCrypt01(this);
                return await chargingSession.method.VerifyChargingSession(chargingSession);
            default:
                return {
                    status: SessionVerificationResult.UnknownSessionFormat
                };
        }
    }
}
//# sourceMappingURL=chargy.js.map