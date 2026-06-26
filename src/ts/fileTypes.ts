export function getMimeTypeFromFileName(fileName: string | undefined | null): string | undefined {

    const normalizedFileName = (fileName ?? "").toLowerCase();

    if (normalizedFileName.endsWith(".chargy"))  return "application/chargy";
    if (normalizedFileName.endsWith(".json"))    return "application/json";
    if (normalizedFileName.endsWith(".xml"))     return "application/xml";
    if (normalizedFileName.endsWith(".zip"))     return "application/zip";
    if (normalizedFileName.endsWith(".tar.gz"))  return "application/gzip";
    if (normalizedFileName.endsWith(".tgz"))     return "application/gzip";
    if (normalizedFileName.endsWith(".tar.bz2")) return "application/x-bzip2";
    if (normalizedFileName.endsWith(".tar"))     return "application/x-tar";
    if (normalizedFileName.endsWith(".pdf"))     return "application/pdf";
    if (normalizedFileName.endsWith(".png"))     return "image/png";
    if (normalizedFileName.endsWith(".jpg"))     return "image/jpeg";
    if (normalizedFileName.endsWith(".jpeg"))    return "image/jpeg";
    if (normalizedFileName.endsWith(".svg"))     return "image/svg+xml";
    if (normalizedFileName.endsWith(".webp"))    return "image/webp";
    if (normalizedFileName.endsWith(".gif"))     return "image/gif";
    if (normalizedFileName.endsWith(".bmp"))     return "image/bmp";

    return undefined;

}
