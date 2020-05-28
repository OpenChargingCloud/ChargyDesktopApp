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
///<reference path="chargyInterfaces.ts" />
///<reference path="chargyLib.ts" />
class ACrypt {
    //#endregion
    constructor(description, chargy) {
        this.description = description;
        this.chargy = chargy;
    }
    //#region Protected methods
    CreateLine(id, value, valueHEX, infoDiv, bufferDiv) {
        var lineDiv = CreateDiv(infoDiv, "row");
        CreateDiv(lineDiv, "id", id);
        CreateDiv(lineDiv, "value", (typeof value === "string" ? value : value === null || value === void 0 ? void 0 : value.toString()));
        this.AddToVisualBuffer(valueHEX, bufferDiv, lineDiv);
    }
    AddToVisualBuffer(valueHEX, bufferDiv, lineDiv) {
        let newText = CreateDiv(bufferDiv, "entry", valueHEX);
        newText.onmouseenter = function (ev) {
            lineDiv.children[0].classList.add("overEntry");
            lineDiv.children[1].classList.add("overEntry");
        };
        newText.onmouseleave = function (ev) {
            lineDiv.children[0].classList.remove("overEntry");
            lineDiv.children[1].classList.remove("overEntry");
        };
        lineDiv.onmouseenter = function (ev) {
            newText.classList.add("overEntry");
        };
        lineDiv.onmouseleave = function (ev) {
            newText.classList.remove("overEntry");
        };
    }
}
//# sourceMappingURL=ACrypt.js.map