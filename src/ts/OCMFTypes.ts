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

export const enum OCMFTransactionTypes
{
    undefined,
    fiscal,
    transaction
}

export const enum TimeStatusTypes {
    unknown,
    informative,
    syncronized,
    relative
}

export interface IOCMFReading {
    TM:         string, // Timestamp
    TX?:        string, // Transaction
    RV?:        string, // typeof RV == 'number', but MUST NOT be rounded!
    RI?:        string, // Reading-Identification == OBIS-Code
    RU?:        string, // Reading-Unit: kWh, ...
    RT?:        string, // Reading-Current-Type
    EF?:        string, // Error-Flags
    ST:         string  // Status
}

export interface IOCMFSignature {
    SA?:        string,
    SE?:        string,
    SM?:        string,
    SD:         string
}

export interface IOCMFData {

    FV:         string,

    PG:         string,

    MV:         string,
    MM:         string,
    MS:         string,
    MF:         string,

    IS:         boolean,
    IL?:        string,
    IF?:        string[],
    IT:         string,
    ID:         string,

    CT?:        string,
    CI?:        string,
    C2I?:        string,

    RD:         Array<IOCMFReading>,

    signature:  IOCMFSignature

}

export interface IOCMFData_v0_1 extends IOCMFData {
    VI:         string,
    VV:         string,
}

export interface IOCMFData_v1_0 extends IOCMFData {
    GI:         string,
    GS:         string,
    GV:         string,
}

export interface IOCMFData_v0_1_Signed {
    data:       IOCMFData_v0_1,
    signature:  any
}

export interface IOCMFData_v1_0_Signed {
    data:       IOCMFData_v1_0,
    signature:  any
}

