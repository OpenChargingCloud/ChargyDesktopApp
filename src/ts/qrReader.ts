/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import { Buffer }      from 'buffer';
import jsQR            from 'jsqr';
import * as chargyLib  from './chargyLib'

type QRImageData = {
    data:   Uint8ClampedArray;
    width:  number;
    height: number;
};

type RasterImageData = {
    data:   Uint8Array | Uint8ClampedArray;
    width:  number;
    height: number;
};

type CanvasImage = {
    naturalWidth?:  number;
    naturalHeight?: number;
    width:          number;
    height:         number;
};

type CanvasRenderingContext = {
    drawImage(image: CanvasImage, dx: number, dy: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): RasterImageData;
};

type CanvasSurface = {
    getContext(contextId: "2d"): CanvasRenderingContext | null;
};

type CanvasModule = {
    loadImage(data: Buffer): Promise<CanvasImage>;
    createCanvas(width: number, height: number): CanvasSurface;
};

type PNGModule = {
    PNG: {
        sync: {
            read(data: Buffer): RasterImageData;
        };
    };
};

type JPEGModule = {
    decode(data: Buffer, options: { useTArray: boolean; formatAsRGBA: boolean }): RasterImageData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function moduleDefault(value: unknown): unknown {
    return isRecord(value) && "default" in value
               ? value["default"]
               : value;
}

function isCanvasModule(value: unknown): value is CanvasModule {
    return isRecord(value) &&
           typeof value["loadImage"]    === "function" &&
           typeof value["createCanvas"] === "function";
}

function isPNGModule(value: unknown): value is PNGModule {
    if (!isRecord(value))
        return false;

    const png = value["PNG"];
    if (!isRecord(png))
        return false;

    const sync = png["sync"];

    return isRecord(value) &&
           isRecord(sync) &&
           typeof sync["read"] === "function";
}

function isJPEGModule(value: unknown): value is JPEGModule {
    return isRecord(value) &&
           typeof value["decode"] === "function";
}

async function imageDataFromBrowserCanvas(data:       ArrayBuffer | Uint8Array,
                                          mimeType?:  string): Promise<QRImageData | undefined> {

    if (typeof Blob              === "undefined" ||
        typeof createImageBitmap !== "function")
    {
        return undefined;
    }

    const imageBlob = new Blob([ chargyLib.toArrayBuffer(data) ], { type: mimeType ?? "application/octet-stream" });

    try
    {
        const bitmap = await createImageBitmap(imageBlob);

        try
        {
            const canvas = typeof OffscreenCanvas !== "undefined"
                               ? new OffscreenCanvas(bitmap.width, bitmap.height)
                               : typeof document !== "undefined"
                                     ? document.createElement("canvas")
                                     : undefined;

            if (canvas == null)
                return undefined;

            canvas.width  = bitmap.width;
            canvas.height = bitmap.height;

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
    catch
    {
        return undefined;
    }

}

async function imageDataFromBrowserImageElement(data:       ArrayBuffer | Uint8Array,
                                                mimeType?:  string): Promise<QRImageData | undefined> {

    if (typeof Blob      === "undefined" ||
        typeof URL       === "undefined" ||
        typeof Image     === "undefined" ||
        typeof document  === "undefined")
    {
        return undefined;
    }

    const imageBlob = new Blob([ chargyLib.toArrayBuffer(data) ], { type: mimeType ?? "application/octet-stream" });
    const imageUrl  = URL.createObjectURL(imageBlob);

    try
    {
        const image = new Image();

        await new Promise<void>((resolve, reject) => {
            image.onload  = () => {
                resolve();
            };
            image.onerror = () => {
                reject(new Error("Could not decode image."));
            };
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
        const canvasLib = moduleDefault(await importOptionalNodeModule("@napi-rs/canvas"));

        if (!isCanvasModule(canvasLib))
            return undefined;

        const image  = await canvasLib.loadImage(Buffer.from(chargyLib.toUint8Array(data)));
        const width  = image.naturalWidth  || image.width;
        const height = image.naturalHeight || image.height;

        if (width <= 0 || height <= 0)
            return undefined;

        const canvas  = canvasLib.createCanvas(width, height);
        const context = canvas.getContext("2d");

        if (context == null)
            return undefined;

        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(0, 0, width, height);

        return {
            data: new Uint8ClampedArray(imageData.data),
            width,
            height
        };
    }
    catch
    {
        return undefined;
    }

}

async function imageDataFromPNGOrJPEG(data:       ArrayBuffer | Uint8Array,
                                      mimeType?:  string): Promise<QRImageData | undefined> {

    try
    {

        const imageBytes = Buffer.from(chargyLib.toUint8Array(data));

        if (mimeType === "image/png")
        {
            const pngJS = moduleDefault(await importOptionalNodeModule("pngjs"));

            if (!isPNGModule(pngJS))
                return undefined;

            const png = pngJS.PNG.sync.read(imageBytes);

            return {
                data:   new Uint8ClampedArray(png.data),
                width:  png.width,
                height: png.height
            };
        }

        if (mimeType === "image/jpeg")
        {
            const jpegJS = moduleDefault(await importOptionalNodeModule("jpeg-js"));

            if (!isJPEGModule(jpegJS))
                return undefined;

            const jpeg = jpegJS.decode(imageBytes, { useTArray: true, formatAsRGBA: true });

            return {
                data:   new Uint8ClampedArray(jpeg.data),
                width:  jpeg.width,
                height: jpeg.height
            };
        }
    }
    catch
    { }

    return undefined;

}

async function importOptionalNodeModule(moduleName: string): Promise<unknown> {

    try
    {
        // Keep the optional Node-only dependencies invisible to Webpack's static resolver.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const createNodeRequire = new Function(`
            const directRequire = typeof require !== 'undefined' ? require : undefined;
            if (directRequire) return directRequire;

            const moduleBuiltin = globalThis.process?.getBuiltinModule?.('module');
            if (moduleBuiltin?.createRequire)
                return moduleBuiltin.createRequire(${JSON.stringify(import.meta.url)});

            return undefined;
        `) as () => ((moduleName: string) => unknown) | undefined;

        const nodeRequire = createNodeRequire();

        if (nodeRequire != null)
            return nodeRequire(moduleName);

        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const nodeImport = new Function("moduleName", "return import(moduleName)") as (moduleName: string) => Promise<unknown>;
        return await nodeImport(moduleName);
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
                                       () => imageDataFromNodeCanvas        (data),
                                       () => imageDataFromPNGOrJPEG         (data, mimeType),
                                       () => imageDataFromBrowserCanvas     (data, mimeType),
                                       () => imageDataFromBrowserImageElement(data, mimeType)
                                   ]
                                 : [
                                       () => imageDataFromBrowserCanvas     (data, mimeType),
                                       () => imageDataFromBrowserImageElement(data, mimeType),
                                       () => imageDataFromNodeCanvas        (data),
                                       () => imageDataFromPNGOrJPEG         (data, mimeType)
                                   ];

    for (const imageDataSource of imageDataSources)
    {
        const imageData = await imageDataSource();

        if (imageData == null)
            continue;

        const qrText = readQRCodeTextFromImageData(imageData);

        if (qrText && qrText.length > 0)
            return qrText;
    }

    return undefined;

}

export function readQRCodeTextFromImageData(imageData: QRImageData): string | undefined {

    const qrCode = jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
        { inversionAttempts: "attemptBoth" }
    );

    const qrText = qrCode?.data.trim();

    return qrText && qrText.length > 0
               ? qrText
               : undefined;

}
