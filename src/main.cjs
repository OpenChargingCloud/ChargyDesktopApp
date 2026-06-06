// Modules to control application life and create native browser window
const { app, BrowserWindow, clipboard, dialog, ipcMain, shell }  = require('electron')
const path                                                       = require('path');
const fs                                                         = require('fs');
const crypto                                                     = require('crypto');
const http                                                       = require('http');
const stringify                                                  = require('safe-stable-stringify');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let   mainWindow;
const applicationEdition         = "Community Edition";
const copyright                  = "&copy; 2018-2026 GraphDefined GmbH";
let   applicationFileName        = "";
let   appAsarFileName            = "";
let   fileToOpen                 = "";
let   httpHost                   = "";
let   httpPort                   = 0;
let   httpServer                 = null;
let   nextHttpRequestId          = 0;

const mapboxAccessToken          = "pk.eyJ1IjoiYWh6ZiIsImEiOiJOdEQtTkcwIn0.Cn0iGqUYyA6KPS8iVjN68w";
const mapboxStartGeoCoordinates  = [50.9279287, 11.5731785];
const mapboxStartMapZoom         = 12;

const httpApiMaxContentSize      = 20*1024*1024;
const httpApiRequestTimeoutMs    = 30000;

const allowedReadPaths           = new Set();
const allowedSavePaths           = new Set();
const pendingHttpRequests        = new Map();

function normalizePath(fileName) {

    if (typeof fileName !== "string" || fileName.trim() === "")
        return "";

    return path.resolve(fileName.replace(/^file:\/\//i, ""));

}

function allowReadPath(fileName) {
    const normalizedPath = normalizePath(fileName);
    if (normalizedPath !== "")
        allowedReadPaths.add(normalizedPath);
    return normalizedPath;
}

function isAllowedWebUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === "https:" ||
               parsedUrl.protocol === "mailto:" ||
               parsedUrl.protocol === "tel:";
    }
    catch {
        return false;
    }
}

function sha512File(fileName) {
    return new Promise((resolve, reject) => {
        const hash    = crypto.createHash('sha512');
        const stream  = fs.createReadStream(fileName);
        stream.on('data',  data => hash.update(data));
        stream.on('error', reject);
        stream.on('end',   () => resolve(hash.digest('hex')));
    });
}

function normalizeListenHost(host) {

    if (host.startsWith("[") && host.endsWith("]"))
        return host.substring(1, host.length - 1);

    return host;

}

function sessionVerificationResultToText(status) {

    switch (status)
    {

        case "NoChargeTransparencyRecordsFound":
            return "No charge transparency records found";

        case "UnknownSessionFormat":
            return "Unknown session format";

        case "InvalidSessionFormat":
            return "Invalid session format";

        case "PublicKeyNotFound":
            return "Public key not found";

        case "InvalidPublicKey":
            return "Invalid public key";

        case "InvalidSignature":
            return "Invalid signature";

        case "Unvalidated":
            return "Unvalidated";

        case "ValidSignature":
            return "Valid signature";

        case "InconsistentTimestamps":
            return "Inconsistent timestamps";

        case "AtLeastTwoMeasurementsRequired":
            return "At least two measurements required";

        default:
            return status || "Unknown session format";

    }

}

function isChargeTransparencyRecord(result) {
    return result != null &&
           Array.isArray(result.chargingSessions);
}

function sendPlainText(response, statusCode, text) {
    response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(text);
}

function sendJson(response, statusCode, value, pretty = false) {
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(stringify(value, null, pretty ? 2 : 0));
}

function dispatchHttpRequestToRenderer(httpRequest) {

    if (mainWindow == null || mainWindow.webContents == null || mainWindow.webContents.isDestroyed())
        return Promise.reject(new Error("Chargy renderer is not ready."));

    const requestId = (++nextHttpRequestId).toString();

    return new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {
            pendingHttpRequests.delete(requestId);
            reject(new Error("Chargy HTTP request timed out."));
        }, httpApiRequestTimeoutMs);

        pendingHttpRequests.set(requestId, {
            resolve,
            reject,
            timeout
        });

        mainWindow.webContents.send("receiveHttpRequest", {
            id:           requestId,
            operation:    httpRequest.operation,
            pretty:       httpRequest.pretty,
            contentType:  httpRequest.contentType,
            data:         httpRequest.data.buffer.slice(httpRequest.data.byteOffset, httpRequest.data.byteOffset + httpRequest.data.byteLength)
        });

    });

}

async function handleChargyHttpRequest(request, response) {

    const requestUrl = new URL(request.url || "/", "http://localhost");

    if (request.method !== "POST" ||
        (requestUrl.pathname !== "/verify" && requestUrl.pathname !== "/convert"))
    {
        sendPlainText(response, 400, "Please use POST /verify for the verification of transparency records or POST /convert for conversion.");
        return;
    }

    const contentLengthHeader = Array.isArray(request.headers["content-length"])
                                    ? request.headers["content-length"][0]
                                    : request.headers["content-length"];

    if (contentLengthHeader != null)
    {
        const contentLength = parseInt(contentLengthHeader, 10);

        if (isNaN(contentLength))
        {
            sendPlainText(response, 400, "The size of the transmitted transparency record is invalid!");
            return;
        }

        if (contentLength > httpApiMaxContentSize)
        {
            sendPlainText(response, 413, "The size of the transmitted transparency record is too large!");
            return;
        }
    }

    const binaryData = [];
    let contentSize  = 0;
    let rejected     = false;

    request.on("data", binaryDataChunk => {

        if (rejected)
            return;

        contentSize += binaryDataChunk.length;

        if (contentSize > httpApiMaxContentSize)
        {
            rejected = true;
            sendPlainText(response, 413, "The size of the transmitted transparency record is too large!");
            request.destroy();
            return;
        }

        binaryData.push(binaryDataChunk);

    });

    request.on("error", exception => {
        if (!response.headersSent)
            sendPlainText(response, 400, "Could not read the transmitted transparency record: " + exception.message);
    });

    request.on("end", async () => {

        if (rejected)
            return;

        if (contentSize === 0)
        {
            sendPlainText(response, 400, "Please upload any kind of transparency record(s) for verification.");
            return;
        }

        try
        {
            const rendererResponse = await dispatchHttpRequestToRenderer({
                operation:    requestUrl.pathname.substring(1),
                pretty:       requestUrl.searchParams.has("pretty"),
                contentType:  Array.isArray(request.headers["content-type"])
                                  ? request.headers["content-type"][0]
                                  : request.headers["content-type"],
                data:         Buffer.concat(binaryData)
            });

            if (!rendererResponse.ok)
            {
                sendJson(response, 400, { message: rendererResponse.message ?? "Invalid transparency format!" });
                return;
            }

            const result = rendererResponse.result;

            if (!isChargeTransparencyRecord(result))
            {
                sendJson(response, 400, { message: result?.message ?? "Invalid transparency format!" });
                return;
            }

            if (requestUrl.pathname === "/verify")
            {
                const results = result.chargingSessions
                                      .map(session => session.verificationResult)
                                      .filter(singleResult => singleResult != null)
                                      .map(singleResult => sessionVerificationResultToText(singleResult.status));

                sendJson(response, 200, results.length > 1 ? results : results[0]);
                return;
            }

            sendJson(response, 200, result, requestUrl.searchParams.has("pretty"));

        }
        catch (exception)
        {
            sendJson(response, 500, { message: exception.message ?? "Could not process transparency record!" });
        }

    });

}

function startHttpAPI() {

    if (httpPort === 0 || httpServer != null)
        return;

    const listenHost = httpHost !== ""
                           ? normalizeListenHost(httpHost)
                           : undefined;

    httpServer = http.createServer(handleChargyHttpRequest);

    httpServer.on("error", exception => {
        console.log("Could not start HTTP API: " + exception);
        httpServer = null;
    });

    httpServer.listen(httpPort, listenHost, () => {
        console.log("Chargy HTTP API listening on " + (httpHost !== "" ? httpHost : "*") + ":" + httpPort);
    });

}


const commandLineArguments = process.argv.length >= 2 &&
                             process.argv[0].endsWith("electron.exe") &&
                             process.argv[1] === "."
                                 // Run in development mode via run.sh
                                 // [
                                 //   'D:\\Coding\\OpenChargingCloud\\ChargyDesktopApp\\node_modules\\electron\\dist\\electron.exe',
                                 //   '.',
                                 //   '--inspect'
                                 // ]
                                 ? process.argv.slice(2)
                                 // Run the installed executable (via command line)
                                 // [
                                 //   'C:\\Program Files\\Chargy Transparenzsoftware\\Chargy Transparenzsoftware.exe',
                                 //   '--inspect'
                                 // ]
                                 : process.argv.slice(1);

for (const commandLineArgument of commandLineArguments) {
    if (typeof commandLineArgument === "string" && !commandLineArgument.startsWith("-"))
        allowReadPath(commandLineArgument);
}


function createWindow () {

    // Note: When the icon could not be loaded all will fail silently!
    //       Also test the app via starting it from the command line within a different directory.
    mainWindow = new BrowserWindow({

        width:              1500,
        height:             900,
        autoHideMenuBar:    true,
        icon:               `${app.getAppPath()}/src/icons/chargy_icon.png`,

        webPreferences: {
            preload:                  path.join(__dirname, 'preload.cjs'),
            nodeIntegration:          false,
            nodeIntegrationInWorker:  false,
            contextIsolation:         true,
            sandbox:                  true,
            enableRemoteModule:       false,
            webSecurity:              true,
            allowRunningInsecureContent: false
        },

        // Don't show the window until it's ready, this prevents any white flickering
        show:              false

    });

    mainWindow.removeMenu();
    mainWindow.loadFile(path.join(app.getAppPath(), 'src', 'index.html'));

    mainWindow.webContents.once('did-finish-load', () => {
        startHttpAPI();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedWebUrl(url))
            shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const targetUrl = new URL(url);
        const appUrl = new URL(`file://${path.join(app.getAppPath(), 'src', 'index.html')}`);
        if (targetUrl.href !== appUrl.href)
            event.preventDefault();
    });

    if (app.commandLine.hasSwitch('inspect') && !app.commandLine.hasSwitch('nogui'))
        mainWindow.webContents.openDevTools();

    // Emitted when the window is closed
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    });

    // Show main window when page is ready
    mainWindow.once('ready-to-show', () => {

        if (!app.commandLine.hasSwitch('nogui'))
            mainWindow.show();

        // This event seems to fire too early!

        // const filteredcommandLineArguments = commandLineArguments.filter(parameter => !parameter.startsWith('-'));

        // if (filteredcommandLineArguments.length > 0)
        //     mainWindow.webContents.send('receiveFilesToOpen', filteredcommandLineArguments);

        // else if (ipcFilesToOpen != "")
        //     mainWindow.webContents.send('receiveFilesToOpen', ipcFilesToOpen);

    });

    // Register key short-cut for Ctrl+V (Paste)
    require('electron-localshortcut').register(mainWindow, 'Ctrl+V', () => {
        if (mainWindow != null)
            mainWindow.webContents.send('receiveReadClipboard');
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

    //console.log(process.env);

    switch (process.platform)
    {

        case "win32":
            applicationFileName  = !process.argv[0].endsWith("electron.exe")
                                       ? process.argv[0].substring(process.argv[0].lastIndexOf(path.sep) + path.sep.length, process.argv[0].length)
                                       : "";
            appAsarFileName      = path.join('resources', 'app.asar');
            break;

        case "linux":
        case "freebsd":
        case "openbsd":
            applicationFileName  = "/opt/Chargy Transparenzsoftware" + (applicationEdition !== "" ? " " + applicationEdition : "") + "/chargytransparenzsoftware";
            appAsarFileName      = "/opt/Chargy Transparenzsoftware" + (applicationEdition !== "" ? " " + applicationEdition : "") + "/resources/app.asar";
            break;

        case "darwin":
            applicationFileName  = "/Applications/Chargy Transparenzsoftware" + (applicationEdition !== "" ? " " + applicationEdition : "") + ".app/Contents/MacOS/Chargy Transparenzsoftware" + (applicationEdition !== "" ? " " + applicationEdition : "");
            appAsarFileName      = "/Applications/Chargy Transparenzsoftware" + (applicationEdition !== "" ? " " + applicationEdition : "") + ".app/Contents/Resources/app.asar";
            break;

    }

    if (app.commandLine.hasSwitch('help'))
    {

        //#region Init stuff

        // Just to make the cli help not look broken!
        if (applicationFileName === "")
            applicationFileName = "Chargy Transparenzsoftware.exe";

        if (appAsarFileName     === "")
            appAsarFileName     = path.join('resources', 'app.asar');


        let helpTopic = "";

        for (let i=0; i<commandLineArguments.length; i++)
        {
            if (commandLineArguments[i] === "--help" && i+1 <= commandLineArguments.length && commandLineArguments[i+1] === "output")
                helpTopic = "output";
        }

        //#endregion

        console.log("Chargy E-Mobility Transparency Software " + applicationEdition + " v" + app.getVersion());
        console.log(copyright.replace("&copy;", "(c)"));
        console.log("");

        switch (helpTopic)
        {

            case "output":
                console.log("Usage: " + applicationFileName + " --output=[text (default)|csv|json|xml|chargy] file1, file2, ...");
                console.log("");
                console.log("Set the verification result output format in cli/debug mode");
                console.log("");
                console.log(" text               The default human readable output format.");
                console.log(" csv                Use the CSV (comma seperated values) format.");
                console.log(" json               Use the JSON format.");
                console.log(" xml                Use the XML format.");
                console.log(" chargy             In combination with '--export' include the verification results into the charge transpary file.");
                break;

            default:
                console.log("Usage: " + applicationFileName + " [switches] file1, file2, ...");
                console.log("");
                console.log("Switches:");
                console.log(" --help             Show this information");
              //console.log(" --help topic       Show information on the given topic");
                console.log(" --inspect          Run in debug mode, enable inspector and open development tools");
                console.log(" --nogui            Run in command line mode (cli mode)");
              //console.log(" --output=format    Set the verification result output format in cli/debug mode [text (default)|csv|json|xml|chargy]");
              //console.log(" --export filename  Convert all input files into the Chargy Transparency Format and save the result to the given file");
                break;

        }

        console.log("");
        app.quit();

    }

    if (app.commandLine.hasSwitch('version'))
    {
        console.log(app.getVersion());
        app.quit();
    }

    if (app.commandLine.hasSwitch('http'))
    {

        let httpConfig = app.commandLine.getSwitchValue("http");

        if (httpConfig !== "")
        {

            const lastIndex = httpConfig.lastIndexOf(":");

            if (lastIndex > -1)
            {
                httpHost =          httpConfig.substring(0, lastIndex);
                httpPort = parseInt(httpConfig.substring(lastIndex + 1));
            }
            else
            {
                httpHost = "localhost";
                httpPort = parseInt(httpConfig);
            }

            if (isNaN(httpPort))
            {
                console.log("Invalid TCP port for chargy HTTP API: " + httpConfig);
                app.exit(1); // Will not exit at once!
            }

        }
        else
        {
            httpHost = "localhost";
            httpPort = 8080;
        }

    }

    createWindow();

});

app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', event => {
        event.preventDefault();
    });

    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
        createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {

    if (httpServer != null)
    {
        httpServer.close();
        httpServer = null;
    }

    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin')
        app.quit();
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null)
        createWindow();
});

// Mac OS X IPC communication "file open with..."
app.on('open-file', (event, path) => {
    event.preventDefault();
    fileToOpen = allowReadPath(path);
    if (mainWindow != null)
        mainWindow.webContents.send('receiveFileToOpen', fileToOpen);
});

ipcMain.on('getAppContext', (event) => {
    event.returnValue = {
        appEdition:  applicationEdition,
        copyright,
        commandLineArguments,
        packageJson:  require('../package.json'),
        i18n:         require('../i18n.json'),
        httpConfig:   [ httpHost, httpPort ],
        mapbox: {
            accessToken:          mapboxAccessToken,
            startGeoCoordinates:  mapboxStartGeoCoordinates,
            startMapZoom:         mapboxStartMapZoom
        },
        fileToOpen,
        isDebug:   app.commandLine.hasSwitch('inspect'),
        noGUI:     app.commandLine.hasSwitch('nogui'),
        platform:  process.platform,
        versions: {
            chrome:    process.versions.chrome,
            electron:  process.versions.electron,
            node:      process.versions.node,
            openssl:   process.versions.openssl
        }
    };
});

ipcMain.handle('showSaveDialog', async () => {
    const fileName = dialog.showSaveDialogSync(null,
                                               {
                                                   title:        'Transparenzdatensätze exportieren',
                                                   defaultPath:  app.getPath('documents') + '/Ladevorgaenge.chargy',
                                               });
    if (fileName != null)
        allowedSavePaths.add(normalizePath(fileName));

    return fileName;
});

ipcMain.handle('writeTextFile', async (_event, fileName, content) => {
    const normalizedPath = normalizePath(fileName);
    if (!allowedSavePaths.has(normalizedPath))
        throw new Error('Saving to this path was not approved by the user.');

    await fs.promises.writeFile(normalizedPath, content, 'utf-8');
    return true;
});

ipcMain.handle('readFile', async (_event, fileName) => {
    const normalizedPath = normalizePath(fileName);
    if (!allowedReadPaths.has(normalizedPath))
        throw new Error('Reading this path was not approved by the application.');

    const data = await fs.promises.readFile(normalizedPath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});

ipcMain.handle('readClipboardText', async () => {
    return clipboard.readText();
});

ipcMain.handle('calculateApplicationHash', async () => {
    if (applicationFileName === "" || appAsarFileName === "")
        return "";

    const sha512a = await sha512File(applicationFileName);
    const sha512b = await sha512File(appAsarFileName);
    return crypto.createHash('sha512').update(sha512a).update(sha512b).digest('hex');
});

ipcMain.handle('sha256Hex', async (_event, content) => {
    return crypto.createHash('sha256').update(String(content), 'utf8').digest('hex');
});

ipcMain.handle('openExternal', async (_event, url) => {
    if (!isAllowedWebUrl(url))
        return false;

    await shell.openExternal(url);
    return true;
})

ipcMain.on('completeHttpRequest', (event, requestId, result) => {

    if (mainWindow == null ||
        event.sender !== mainWindow.webContents)
    {
        return;
    }

    const pendingHttpRequest = pendingHttpRequests.get(requestId);

    if (pendingHttpRequest == null)
        return;

    pendingHttpRequests.delete(requestId);
    clearTimeout(pendingHttpRequest.timeout);
    pendingHttpRequest.resolve(result);

});

ipcMain.on('setVerificationResult', (event, result) => {

    event.returnValue = true;

    //console.log(result);

    if (app.commandLine.hasSwitch('nogui') || app.commandLine.hasSwitch('inspect'))
    {

        if (!Array.isArray(result))
            result = [ result ];

        for (let singleResult of result)
        {

            //#region Convert status enum to text

            let status = "";

            status = singleResult.status;
            // switch (singleResult.status)
            // {

            //     case 0:
            //         status = "No charge transparency records found";
            //         break;

            //     case 1:
            //         status = "Unknown session format";
            //         break;

            //     case 2:
            //         status = "Invalid session format";
            //         break;

            //     case 3:
            //         status = "Public key not found";
            //         break;

            //     case 4:
            //         status = "Invalid public key";
            //         break;

            //     case 5:
            //         status = "Invalid signature";
            //         break;

            //     case 6:
            //         status = "Unvalidated";
            //         break;

            //     case 7:
            //         status = "Valid signature";
            //         break;

            //     case 8:
            //         status = "Inconsistent timestamps";
            //         break;

            //     case 9:
            //         status = "At least two measurements required";
            //         break;

            //     default:
            //         status = "Unknown session format";
            //         break;

            // }

            //#endregion

            console.log(status + (singleResult.message ? " - " + singleResult.message : ""));

        }

    }

    if (app.commandLine.hasSwitch('nogui'))
    {
        mainWindow = null;
        app.exit(0);
    }

});
