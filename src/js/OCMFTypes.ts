/*
 * Copyright (c) 2018-2019 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

const enum OCMFTransactionTypes
{
    undefined,
    fiscal,
    transaction
}

interface IOCMFData {

    FV:         string,

    PG:         string,

    MV:         string,
    MM:         string,
    MS:         string,
    MF:         string,

}

interface IOCMFData_v0_1 extends IOCMFData {
    VI:         string,
    VV:         string,
}

interface IOCMFData_v1_0 extends IOCMFData {
    GI:         string,
    GS:         string,
    GV:         string,
}

