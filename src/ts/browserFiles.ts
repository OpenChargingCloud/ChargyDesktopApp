export function browserFileTypeFromName(fileName: string,
                                        fileType: string): string {

    const trimmedFileType = fileType.trim();

    if (trimmedFileType !== "")
        return trimmedFileType;

    const lowerFileName = fileName.toLowerCase();

    if (lowerFileName.endsWith(".svg"))
        return "image/svg+xml";

    if (lowerFileName.endsWith(".png"))
        return "image/png";

    if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg"))
        return "image/jpeg";

    if (lowerFileName.endsWith(".gif"))
        return "image/gif";

    if (lowerFileName.endsWith(".webp"))
        return "image/webp";

    if (lowerFileName.endsWith(".bmp"))
        return "image/bmp";

    return "";

}

function isSVGImageData(data: ArrayBuffer|Uint8Array): boolean {

    const svgText = new TextDecoder().decode(data).trimStart();

    return svgText.startsWith("<svg") ||
          (svgText.startsWith("<?xml") && /<svg\b/i.test(svgText));

}

export function browserFileTypeFromNameOrData(fileName: string,
                                              fileType: string,
                                              data:     ArrayBuffer|Uint8Array): string {

    const detectedFileType = browserFileTypeFromName(fileName, fileType);

    if (detectedFileType !== "")
        return detectedFileType;

    if (isSVGImageData(data))
        return "image/svg+xml";

    return "";

}

export function browserFileNameFromNameAndType(fileName: string,
                                               fileType: string): string {

    const trimmedFileName = fileName.trim() !== ""
                                ? fileName.trim()
                                : "unknown";
    const lowerFileName   = trimmedFileName.toLowerCase();

    if (fileType === "image/svg+xml" && !lowerFileName.endsWith(".svg"))
        return trimmedFileName + ".svg";

    return trimmedFileName;

}

function addCrispShapeRenderingToSVGElements(svgText: string): { text: string; changed: boolean } {

    let changed = false;

    const text = svgText.replace(/<(path|rect)\b([^>]*)>/gi,
                                 (match: string, tagName: string, attributes: string): string => {

        if (/\sshape-rendering\s*=/.test(attributes))
            return match;

        changed = true;

        return "<" + tagName + " shape-rendering=\"crispEdges\"" + attributes + ">";

                                 });

    return { text, changed };

}

export function normalizeDroppedSVGImageData(fileName: string,
                                             fileType: string,
                                             data:     ArrayBuffer): ArrayBuffer|Uint8Array {

    const lowerFileName = fileName.toLowerCase();

    if (fileType !== "image/svg+xml" && !lowerFileName.endsWith(".svg") && !isSVGImageData(data))
        return data;

    const svgText = new TextDecoder().decode(data);

    if (!svgText.trimStart().startsWith("<svg") &&
        !svgText.trimStart().startsWith("<?xml"))
    {
        return data;
    }

    const svgTagMatch = svgText.match(/<svg\b[^>]*>/i);

    if (svgTagMatch == null)
        return data;

    const svgTag      = svgTagMatch[0];
    const svgTagIndex = svgTagMatch.index;

    if (svgTagIndex == null)
        return data;

    let svgAttributes = "";

    if (!/\sshape-rendering\s*=/.test(svgTag))
        svgAttributes += " shape-rendering=\"crispEdges\"";

    if (!/\sstyle\s*=/.test(svgTag))
        svgAttributes += " style=\"image-rendering: pixelated\"";

    const hasWidth  = /\swidth\s*=/.test(svgTag);
    const hasHeight = /\sheight\s*=/.test(svgTag);

    const crispElements = addCrispShapeRenderingToSVGElements(svgText);

    if (hasWidth && hasHeight && svgAttributes === "" && !crispElements.changed)
        return data;

    if (!hasWidth || !hasHeight)
    {
        const viewBoxMatch = svgTag.match(/\sviewBox\s*=\s*["']\s*([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*["']/i);

        if (viewBoxMatch != null)
        {
            const width  = Number(viewBoxMatch[3]);
            const height = Number(viewBoxMatch[4]);

            if (Number.isFinite(width)  && width  > 0 &&
                Number.isFinite(height) && height > 0)
            {
                if (!hasWidth)
                    svgAttributes += " width=\"" + width.toString() + "\"";

                if (!hasHeight)
                    svgAttributes += " height=\"" + height.toString() + "\"";
            }
        }
    }

    if (svgAttributes === "" && !crispElements.changed)
        return data;

    const normalizedSVGText = crispElements.text;
    const normalized        = normalizedSVGText.slice(0, svgTagIndex + svgTag.length - 1) +
                              svgAttributes +
                              normalizedSVGText.slice(svgTagIndex + svgTag.length - 1);

    return new TextEncoder().encode(normalized);

}
