/*
 * Copyright (c) 2018-2024 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
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

import * as chargyInterfaces  from './chargyInterfaces'


// Digital Calibration Certificate (DCC)
// Converted from XML definition at: https://gitlab.com/ptb/dcc/xsd-dcc/-/raw/master/dcc.xsd
//
// The goal is to provide an exact but pragmatic mapping between the XML schema and TypeScript
// interfaces allowing to verify all digital XML signatures also from the JSON representation.

/**
 * The root element that contains the four rings of the Digital Calibration Certificate (DCC).
 * @interface IDigitalCalibrationCertificate
 * @property {AdministrativeDataType} administrativeData - All essential administrative information about the calibration.
 * @property {Array<MeasurementResultType>} measurementResults - List of measurement results that are part of a DCC.
 * @property {Array<string>} [comments] - Optional comments about the calibration.
 * @property {ByteDataType} [document] - Optional binary encoded file of the DCC.
 * @property {string} schemaVersion - The version of the DCC schema, e.g. "3.2.1"
 * @property {Array<chargyInterfaces.ISignatureRS>} [signatures] - Optional list of digital signatures.
 */
export interface IDigitalCalibrationCertificate {
    "@id":                          string;
    "@context"?:                    string|Array<string>,
    administrativeData:             AdministrativeDataType,
    measurementResults:             Array<MeasurementResultType>,
    comments?:                      Array<string>,
    document?:                      ByteDataType,
    schemaVersion:                  string, // pattern: "3\.2\.1"
    signatures?:                    Array<chargyInterfaces.ISignatureRS>
}

/**
 * The element administrativeData contains all essential administrative information about the calibration.
 * The entries in this area are basically the same and regulated in all DCCs.
 * @interface AdministrativeDataType
 * @property {Array<SoftwareType>} software - A list of software elements.
 * @property {Array<RefTypeDefinitionType>} [refTypeDefinitions] - An optional list of information about the used refTypes in a DCC.
 * @property {CoreDataType} coreData - The core data of the DCC.
 * @property {Array<ItemType>} items - A list of items that are part of the calibration.
 * @property {CalibrationLaboratoryType} calibrationLaboratory - Information about the calibration laboratory.
 * @property {Array<RespPersonType>} respPersons - A list of responsible persons.
 * @property {ContactType} customer - Information about the customer.
 * @property {Array<StatementMetaDataType>} [statements] - Optional list of statements.
 */
export interface AdministrativeDataType {
    software:                       Array<SoftwareType>,
    refTypeDefinitions?:            Array<RefTypeDefinitionType>;
    coreData:                       CoreDataType,
    items:                          Array<ItemType>,
    calibrationLaboratory:          CalibrationLaboratoryType,
    respPersons:                    Array<RespPersonType>,
    customer:                       ContactType,
    statements?:                    Array<StatementMetaDataType>
}

/**
 * Information about a software including its name, version and a description.
 * @interface SoftwareType
 */
export interface SoftwareType {
    name:                           chargyInterfaces.IMultilanguageText;
    release:                        string;
    type?:                          'application' | 'bios' | 'driver' | 'editor' | 'firmware' | 'library' | 'os' | 'other';
    description?:                   RichContentType;
    id?:                            string;
    refType?:                       string;
}

/**
 * This type contains the information about the wording of the refTypes used in a DCC.
 * @interface RefTypeDefinitionType
 */
export interface RefTypeDefinitionType {
    name:                           chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    namespace:                      string;
    link:                           string;
    release?:                       string;
    value?:                         string;
    procedure?:                     string;
    refType?:                       string;
}

export interface RichContentType {
    name?:                          chargyInterfaces.IMultilanguageText;
    content?:                       Array<IDCCStringWithLangType>;
    file?:                          Array<ByteDataType>;
    formula?:                       Array<FormulaType>;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface IDCCStringWithLangType {
    value:                          string;
    lang?:                          string; // ISO639 codes, example: 'en', 'de', etc.
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface FormulaType {
    latex?:                         string;
    mathml?:                        any;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface UsedMethodType {
    name:                           chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    norm?:                          Array<string>;
    reference?:                     Array<string>;
    id?:                            string;
    refType?:                       string;
}

export interface IdentificationType {
    issuer:                         'manufacturer' | 'calibrationLaboratory' | 'customer' | 'owner' | 'other';
    value:                          string;
    name?:                          chargyInterfaces.IMultilanguageText;
    id?:                            string;
    refType?:                       string;
}

export interface MeasuringEquipmentType {
    name:                           chargyInterfaces.IMultilanguageText;
    equipmentClass?:                Array<EquipmentClassType>;
    description?:                   RichContentType;
    certificate?:                   HashType;
    manufacturer?:                  ContactNotStrictType;
    model?:                         string;
    identifications?:               Array<IdentificationType>;
    measuringEquipmentQuantities?:  Array<PrimitiveQuantityType>;
    id?:                            string;
    refType?:                       string;
}

export interface PrimitiveQuantityType {
    name?:                          chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    noQuantity?:                    RichContentType;
    charsXMLList?:                  Array<string>;
    // References to SI types not shown, as they would be defined externally or adapted to local TypeScript definitions.
    real?:                          any; // Placeholder for actual type, as specific details were not provided.
    hybrid?:                        any;
    complex?:                       any;
    constant?:                      any;
    realListXMLList?:               any;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface EquipmentClassType {
    reference:                      string;
    classID:                        string;
    id?:                            string;
    refType?:                       string;
}

export interface HashType {
    referral:                       chargyInterfaces.IMultilanguageText;
    referralID:                     string;
    procedure:                      string;
    value:                          string;
    description?:                   RichContentType;
    inValidityRange?:               boolean;
    traceable?:                     boolean;
    linkedReport?:                  HashType;
    id?:                            string;
    refType?:                       string;
}

export interface LocationType {
    city?:                          string;
    countryCode?:                   string; // ISO3166 codes, example: 'DE', 'US', etc.
    postCode?:                      string;
    postOfficeBox?:                 string;
    state?:                         string;
    street?:                        string;
    streetNo?:                      string;
    further?:                       RichContentType;
    positionCoordinates?:           PositionCoordinatesType;
}

export interface PositionCoordinatesType {
    positionCoordinateSystem:       string;
    reference?:                     string;
    declaration?:                   RichContentType;
    positionCoordinate1:            RealQuantityType;
    positionCoordinate2:            RealQuantityType;
    positionCoordinate3?:           RealQuantityType;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface RealQuantityType {
    value:                          number;
    uncertainty?:                   number; // Optional uncertainty of the measurement
}

export interface ContactNotStrictType {
    name:                           chargyInterfaces.IMultilanguageText;
    eMail?:                         string;
    phone?:                         string;
    fax?:                           string;
    location?:                      LocationType;
    descriptionData?:               ByteDataType;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface ResultType {
    name:                           chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    data:                           DataType;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

/**
 * A measurement results with the methods, software and equipments used for the calibration.
 * Also contains influence conditions and a list of the actual results.
 */
export interface MeasurementResultType {
    name:                           chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    usedMethods?:                   Array<UsedMethodType>;
    usedSoftware?:                  Array<SoftwareType>;
    measuringEquipments?:           Array<MeasuringEquipmentType>;
    influenceConditions?:           Array<InfluenceConditionType>;
    results:                        Array<ResultType>;
    measurementMetaData?:           Array<StatementMetaDataType>;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

/**
 * The byteDataType defines a type which allows to add binary encoded files to the measurement result section.
 * @interface ByteDataType
 */
export interface ByteDataType {
    name?:                          chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    fileName:                       string;
    mimeType:                       string;
    dataBase64:                     string;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface XMLType {
    content:                        any; // Typically XML content, TypeScript has no specific type for XML, so 'any' is used.
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface QuantityType {
    name?:                          chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    noQuantity?:                    RichContentType;
    charsXMLList?:                  Array<string>;
    real?:                          any; // Placeholder for actual type, as specific details were not provided.
    hybrid?:                        any;
    complex?:                       any;
    constant?:                      any;
    realListXMLList?:               any;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface ListType {
    name?:                          chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    dateTime?:                      Date;
    dateTimeXMLList?:               Array<Date>;
    quantities?:                    Array<QuantityType>;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface DataType {
    text?:                          Array<RichContentType>;
    formula?:                       Array<FormulaType>;
    byteData?:                      Array<ByteDataType>;
    xml?:                           Array<XMLType>;
    quantity?:                      Array<QuantityType>;
    list?:                          Array<ListType>;
    id?:                            string;
    refId?:                         string[];
    refType?:                       string;
}

export interface InfluenceConditionType {
    name:                           chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    status?:                        'beforeAdjustment' | 'afterAdjustment' | 'beforeRepair' | 'afterRepair';
    certificate?:                   HashType;
    data:                           DataType;
    id?:                            string;
    refType?:                       string;
}

export interface StatementMetaDataType {
    name?:                          chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    countryCodeISO3166_1?:          Array<string>;
    convention?:                    string;
    traceable?:                     boolean;
    norm?:                          Array<string>;
    reference?:                     Array<string>;
    declaration?:                   RichContentType;
    valid?:                         boolean;
    validXMLList?:                  Array<boolean>;
    date?:                          Date;
    period?:                        string; // ISO 8601 duration
    respAuthority?:                 ContactType;
    conformity?:                    string;
    conformityXMLList?:             Array<string>;
    data?:                          DataType;
    nonSIDefinition?:               string;
    nonSIUnit?:                     string;
    location?:                      LocationType;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

export interface ContactType {
    name:                           chargyInterfaces.IMultilanguageText;
    eMail?:                         string;
    phone?:                         string;
    fax?:                           string;
    location:                       LocationType;
    descriptionData?:               ByteDataType;
    id?:                            string;
}


export interface ItemType {
    name:                           chargyInterfaces.IMultilanguageText;
    equipmentClass?:                EquipmentClassType[];
    description?:                   RichContentType;
    installedSoftwares?:            Array<SoftwareType>;
    manufacturer?:                  ContactNotStrictType;
    model?:                         string;
    identifications:                Array<IdentificationType>;
    itemQuantities?:                Array<PrimitiveQuantityType>;
    id?:                            string;
    refType?:                       string;
}

export interface RespPersonType {
    person:                         ContactNotStrictType;
    description?:                   RichContentType;
    role?:                          string;
    mainSigner?:                    boolean;
    cryptElectronicSeal?:           boolean;
    cryptElectronicSignature?:      boolean;
    cryptElectronicTimeStamp?:      boolean;
    id?:                            string;
    refType?:                       string;
}

// This type contains information about the location where the the calibration is performed.
export interface PerformanceLocationType {
    location:                       'laboratory' | 'customer' | 'laboratoryBranch' | 'customerBranch' | 'other';
    id?:                            string;
    refId?:                         Array<string>;  // References to other identifiable elements within the document.
    refType?:                       string;         // This could be a list or single string depending on other schema details not shown here.
}

//  This type contains information about the replaced DCC and the reason for the replacement.
export interface ReportAmendedSubstitutedType {
    typeOfChange:                   'amended' | 'substituted';
    replacedUniqueIdentifier:       string;
    id?:                            string;
    refType?:                       string;  // This could be a specific type or a string depending on the definitions of 'refTypesType' elsewhere in your schema.
}

export interface CoreDataType {
    countryCodeISO3166_1:           string;
    usedLangCodeISO639_1:           Array<string>;
    mandatoryLangCodeISO639_1:      Array<string>;
    uniqueIdentifier:               string;
    identifications?:               Array<IdentificationType>;
    receiptDate?:                   Date;
    beginPerformanceDate:           Date;
    endPerformanceDate:             Date;
    performanceLocation:            PerformanceLocationType;
    issueDate?:                     Date;
    reportAmendedSubstituted?:      ReportAmendedSubstitutedType;
    previousReport?:                HashType;
}

export interface StatementMetaDataType {
    name?:                          chargyInterfaces.IMultilanguageText;
    description?:                   RichContentType;
    countryCodeISO3166_1?:          Array<string>;
    convention?:                    string;
    traceable?:                     boolean;
    norm?:                          Array<string>;
    reference?:                     Array<string>;
    declaration?:                   RichContentType;
    valid?:                         boolean;
    validXMLList?:                  Array<boolean>;
    date?:                          Date;
    period?:                        string; // ISO 8601 duration
    respAuthority?:                 ContactType;
    conformity?:                    string;
    conformityXMLList?:             Array<string>;
    data?:                          DataType;
    nonSIDefinition?:               string;
    nonSIUnit?:                     string;
    location?:                      LocationType;
    id?:                            string;
    refId?:                         Array<string>;
    refType?:                       string;
}

/**
 * Information about the calibration laboratory.
 * @interface CalibrationLaboratoryType
 * @property {string} [calibrationLaboratoryCode] - Optional code of the calibration laboratory.
 * @property {ContactType} contact - Contact information about the calibration laboratory.
 */
export interface CalibrationLaboratoryType {
    calibrationLaboratoryCode?:     string;
    contact:                        ContactType;
    cryptElectronicSeal?:           boolean;
    cryptElectronicSignature?:      boolean;
    cryptElectronicTimeStamp?:      boolean;
}
