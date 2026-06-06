/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import jsQR from 'jsqr';

type QRImageData = {
    data:   Uint8ClampedArray;
    width:  number;
    height: number;
};

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {

    if (data instanceof ArrayBuffer)
        return data;

    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

}

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {

    return data instanceof Uint8Array
               ? data
               : new Uint8Array(data);

}

async function imageDataFromBrowserCanvas(data: ArrayBuffer | Uint8Array,
                                          mimeType?: string): Promise<QRImageData | undefined> {

    if (typeof Blob === "undefined" ||
        typeof createImageBitmap !== "function")
    {
        return undefined;
    }

    const imageBlob = new Blob([ toArrayBuffer(data) ], { type: mimeType ?? "application/octet-stream" });

    try
    {
        const bitmap = await createImageBitmap(imageBlob);

        try
        {
            const canvas = typeof OffscreenCanvas !== "undefined"
                               ? new OffscreenCanvas(bitmap.width, bitmap.height)
                               : undefined;

            if (canvas == null)
                return undefined;

            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context == null)
                return undefined;

            context.drawImage(bitmap, 0, 0);

            const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

            return {
                data:   imageData.data,
                width:  imageData.width,
                height: imageData.height
            };
        }
        finally
        {
            bitmap.close();
        }
    }
    catch (exception)
    {
        throw new Error("Node canvas QR decode failed: " + (exception instanceof Error ? exception.message : exception));
    }

}

async function imageDataFromBrowserImageElement(data: ArrayBuffer | Uint8Array,
                                                mimeType?: string): Promise<QRImageData | undefined> {

    if (typeof Blob      === "undefined" ||
        typeof URL       === "undefined" ||
        typeof Image     === "undefined" ||
        typeof document  === "undefined")
    {
        return undefined;
    }

    const imageBlob = new Blob([ toArrayBuffer(data) ], { type: mimeType ?? "application/octet-stream" });
    const imageUrl  = URL.createObjectURL(imageBlob);

    try
    {
        const image = new Image();

        await new Promise<void>((resolve, reject) => {
            image.onload  = () => resolve();
            image.onerror = () => reject(new Error("Could not decode image."));
            image.src     = imageUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width  = image.naturalWidth  || image.width;
        canvas.height = image.naturalHeight || image.height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context == null || canvas.width <= 0 || canvas.height <= 0)
            return undefined;

        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        return {
            data:   imageData.data,
            width:  imageData.width,
            height: imageData.height
        };
    }
    catch
    {
        return undefined;
    }
    finally
    {
        URL.revokeObjectURL(imageUrl);
    }

}

async function imageDataFromNodeCanvas(data: ArrayBuffer | Uint8Array): Promise<QRImageData | undefined> {

    try
    {
        const nodeRequire = new Function(`
            const directRequire = typeof require !== 'undefined' ? require : undefined;
            if (directRequire) return directRequire;

            const moduleBuiltin = globalThis.process?.getBuiltinModule?.('module');
            if (moduleBuiltin?.createRequire)
                return moduleBuiltin.createRequire(${JSON.stringify(import.meta.url)});

            return undefined;
        `)() as ((moduleName: string) => any) | undefined;
        const nodeImport  = new Function("moduleName", "return import(moduleName)") as (moduleName: string) => Promise<any>;
        const canvasModule = nodeRequire
                                 ? nodeRequire("@napi-rs/canvas")
                                 : await nodeImport("@napi-rs/canvas");
        const canvasLib    = canvasModule.default ?? canvasModule;

        const image       = await canvasLib.loadImage(Buffer.from(toUint8Array(data)));
        const width       = image.naturalWidth  || image.width;
        const height      = image.naturalHeight || image.height;

        if (width <= 0 || height <= 0)
            return undefined;

        const canvas      = canvasLib.createCanvas(width, height);
        const context     = canvas.getContext("2d");

        context.drawImage(image, 0, 0);

        const imageData   = context.getImageData(0, 0, width, height);

        return {
            data:   new Uint8ClampedArray(imageData.data),
            width,
            height
        };
    }
    catch
    {
        return undefined;
    }

}

export async function readQRCodeTextFromImage(data:       ArrayBuffer | Uint8Array,
                                              mimeType?:  string): Promise<string | undefined> {

    const imageDataSources = typeof document === "undefined"
                                 ? [
                                       () => imageDataFromNodeCanvas(data),
                                       () => imageDataFromBrowserCanvas(data, mimeType),
                                       () => imageDataFromBrowserImageElement(data, mimeType)
                                   ]
                                 : [
                                       () => imageDataFromBrowserCanvas(data, mimeType),
                                       () => imageDataFromBrowserImageElement(data, mimeType),
                                       () => imageDataFromNodeCanvas(data)
                                   ];

    for (const imageDataSource of imageDataSources)
    {
        const imageData = await imageDataSource();

        if (imageData == null)
            continue;

        const qrCode = jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            { inversionAttempts: "attemptBoth" }
        );

        const qrText = qrCode?.data?.trim();

        if (qrText && qrText.length > 0)
            return qrText;
    }

    return undefined;

}
