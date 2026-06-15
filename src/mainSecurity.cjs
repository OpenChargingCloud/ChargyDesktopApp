// Pure, Electron-free security helpers used by src/main.cjs.
//
// These functions enforce the trust boundaries of the desktop app: which files
// the renderer is allowed to read/write, which external URLs may be opened, and
// which permission requests (camera) are acceptable. Keeping them here makes the
// boundary unit-testable without starting Electron (see tests/mainSecurity.test.ts).

const path = require('path');

function normalizePath(fileName) {

    if (typeof fileName !== "string" || fileName.trim() === "")
        return "";

    return path.resolve(fileName.replace(/^file:\/\//i, ""));

}

function isAllowedWebUrl(url) {

    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === "https:"  ||
               parsedUrl.protocol === "mailto:" ||
               parsedUrl.protocol === "tel:";
    }
    catch {
        return false;
    }

}

// An allow-list of normalized file paths. The renderer may only read/write a
// path that was explicitly granted (a command line file, an "open with..." file,
// or a path the user picked in a native save dialog).
function createPathAllowList() {

    const allowed = new Set();

    return {

        allow(fileName) {
            const normalizedPath = normalizePath(fileName);
            if (normalizedPath !== "")
                allowed.add(normalizedPath);
            return normalizedPath;
        },

        has(normalizedPath) {
            return allowed.has(normalizedPath);
        },

        isAllowed(fileName) {
            const normalizedPath = normalizePath(fileName);
            return normalizedPath !== "" && allowed.has(normalizedPath);
        }

    };

}

// True only for a video-only (no audio) media permission request on the main
// frame - the QR-code camera scanner. The caller still has to verify that the
// request originates from the app's own renderer.
function isVideoOnlyMediaPermission(permission, details) {

    if (permission !== "media")
        return false;

    if (details?.isMainFrame === false)
        return false;

    const mediaTypes = Array.isArray(details?.mediaTypes)
                           ? details.mediaTypes
                           : typeof details?.mediaType === "string"
                                 ? [ details.mediaType ]
                                 : [];

    return mediaTypes.includes("video") &&
          !mediaTypes.includes("audio");

}

module.exports = {
    normalizePath,
    isAllowedWebUrl,
    createPathAllowList,
    isVideoOnlyMediaPermission
};
