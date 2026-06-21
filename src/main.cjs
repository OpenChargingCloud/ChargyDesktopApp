// Modules to control application life and create native browser window
const { app, BrowserWindow, clipboard, dialog, ipcMain, shell }  = require('electron')
const path                                                       = require('path');
const fs                                                         = require('fs');
const crypto                                                     = require('crypto');
const {
    parseCliArguments,
    hasNoActionableInput,
    createMainHelpText,
    createOutputHelpText
}                                                                = require('./cliArguments.cjs');
const {
    createApiKeyAuthenticator,
    initializeTOTPGenerator,
    loadApiKeysFromFile
}                                                                = require('./apiKeys.cjs');
const {
    startChargyHttpServer
}                                                                = require('./httpApi.cjs');
const {
    renderCliVerification
}                                                                = require('./verificationService.cjs');
const {
    normalizePath,
    isAllowedWebUrl,
    createPathAllowList,
    isVideoOnlyMediaPermission
}                                                                = require('./mainSecurity.cjs');
const {
    applicationEdition,
    copyright,
    packageJson
}                                                                = require('./applicationMetadata.cjs');
const cliI18N                                                    = require('./i18n_CLI.json');
const coreI18N                                                   = require('@open-charging-cloud/chargy-core/i18n.json');
const desktopI18N                                                = require('./i18n.json');
const rendererI18N                                               = {
    ...coreI18N,
    ...desktopI18N
};

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let   mainWindow;
let   applicationFileName        = "";
let   appAsarFileName            = "";
let   fileToOpen                 = "";
let   httpHost                   = "";
let   httpPort                   = 0;
let   httpServer                 = null;
let   nextHttpRequestId          = 0;
let   apiKeyAuthenticator        = null;
let   apiKeyEntries              = [];
let   apiKeysFileName            = null;

const mapboxAccessToken          = "pk.eyJ1IjoiYWh6ZiIsImEiOiJOdEQtTkcwIn0.Cn0iGqUYyA6KPS8iVjN68w";
const mapboxStartGeoCoordinates  = [50.9279287, 11.5731785];
const mapboxStartMapZoom         = 12;

const httpApiRequestTimeoutMs    = 30000;

const readPaths                  = createPathAllowList();
const savePaths                  = createPathAllowList();
const pendingHttpRequests        = new Map();

function allowReadPath(fileName) {
    return readPaths.allow(fileName);
}

function isAllowedCameraPermissionRequest(webContents, permission, details) {

    if (mainWindow == null ||
        mainWindow.webContents == null ||
        webContents !== mainWindow.webContents)
    {
        return false;
    }

    return isVideoOnlyMediaPermission(permission, details);

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

function startHttpAPI() {

    if (httpPort === 0 || httpServer != null)
        return;

    httpServer = startChargyHttpServer({
        host: httpHost,
        port: httpPort,
        dispatchHttpRequest: dispatchHttpRequestToRenderer,
        language: cliArguments.language,
        i18n: cliI18N,
        apiKeyAuthenticator,
        apiKeyEntries,
        apiKeysFileName,
        log: console.log
    });

    httpServer.on("error", () => {
        httpServer = null;
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

const cliArguments = parseCliArguments(commandLineArguments);

for (const commandLineFile of cliArguments.files)
    allowReadPath(commandLineFile);


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
app.whenReady().then(async () => {

    try
    {
        await initializeTOTPGenerator();
    }
    catch (exception)
    {
        console.log("Could not load the TOTP generator: " + (exception.message ?? exception));
        app.exit(1); // Will not exit at once!
        return;
    }

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

    if (cliArguments.help)
    {

        //#region Init stuff

        // Just to make the cli help not look broken!
        if (applicationFileName === "")
            applicationFileName = "Chargy Transparenzsoftware.exe";

        if (appAsarFileName     === "")
            appAsarFileName     = path.join('resources', 'app.asar');


        //#endregion

        switch (cliArguments.helpTopic)
        {

            case "output":
                console.log(createOutputHelpText(applicationFileName,
                                                 app.getVersion(),
                                                 applicationEdition,
                                                 copyright,
                                                 cliArguments.language,
                                                 cliI18N));
                break;

            default:
                console.log(createMainHelpText(applicationFileName,
                                               app.getVersion(),
                                               applicationEdition,
                                               copyright,
                                               cliArguments.language,
                                               cliI18N));
                break;

        }

        console.log("");
        app.quit();
        return;

    }

    if (cliArguments.version)
    {
        console.log(app.getVersion());
        app.quit();
        return;
    }

    // --nogui with neither a file to verify nor the HTTP API enabled has nothing
    // to do. Show the usage help and exit cleanly instead of starting an invisible
    // renderer window that would never receive a verification result.
    if (hasNoActionableInput(cliArguments))
    {

        if (applicationFileName === "")
            applicationFileName = "Chargy Transparenzsoftware.exe";

        console.log(createMainHelpText(applicationFileName,
                                       app.getVersion(),
                                       applicationEdition,
                                       copyright,
                                       cliArguments.language,
                                       cliI18N));
        console.log("");
        app.quit();
        return;

    }

    if (cliArguments.http.enabled)
    {

        if (cliArguments.http.error !== undefined)
        {
            console.log(cliArguments.http.error);
            app.exit(1); // Will not exit at once!
            return;
        }

        httpHost = cliArguments.http.host;
        httpPort = cliArguments.http.port;

        if (cliArguments.apiKeys === "")
        {
            console.log("--apiKeys requires a JSON file name.");
            app.exit(1); // Will not exit at once!
            return;
        }

        if (cliArguments.apiKeys != null && cliArguments.apiKeys !== "")
        {
            try
            {
                apiKeysFileName     = cliArguments.apiKeys;
                apiKeyEntries       = loadApiKeysFromFile(cliArguments.apiKeys);
                apiKeyAuthenticator = createApiKeyAuthenticator(apiKeyEntries);
            }
            catch (exception)
            {
                console.log("Could not load HTTP API keys from " + cliArguments.apiKeys + ": " + (exception.message ?? exception));
                app.exit(1); // Will not exit at once!
                return;
            }
        }

    }

    createWindow();

});

app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', event => {
        event.preventDefault();
    });

    contents.session.setPermissionCheckHandler((webContents, permission, _requestingOrigin, details) => {
        return isAllowedCameraPermissionRequest(webContents, permission, details);
    });

    contents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
        callback(isAllowedCameraPermissionRequest(webContents, permission, details));
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
        packageJson,
        i18n:         rendererI18N,
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
        savePaths.allow(fileName);

    return fileName;
});

ipcMain.handle('writeTextFile', async (_event, fileName, content) => {
    const normalizedPath = normalizePath(fileName);
    if (!savePaths.has(normalizedPath))
        throw new Error('Saving to this path was not approved by the user.');

    await fs.promises.writeFile(normalizedPath, content, 'utf-8');
    return true;
});

ipcMain.handle('readFile', async (_event, fileName) => {
    const normalizedPath = normalizePath(fileName);
    if (!readPaths.has(normalizedPath))
        throw new Error('Reading this path was not approved by the application.');

    const data = await fs.promises.readFile(normalizedPath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});

ipcMain.handle('readClipboardText', async () => {
    return clipboard.readText();
});

ipcMain.handle('readClipboardImage', async () => {

    const image = clipboard.readImage();
   
    if (image == null || image.isEmpty())
        return null;

    const data = image.toPNG();

    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

});

ipcMain.handle('calculateApplicationHash', async () => {

    if (applicationFileName === "" || appAsarFileName === "")
        return "";

    const sha512a = await sha512File(applicationFileName);
    const sha512b = await sha512File(appAsarFileName);

    return crypto.createHash('sha512').update(sha512a).update(sha512b).digest('hex');

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

    const noGUI = app.commandLine.hasSwitch('nogui');

    if (noGUI || app.commandLine.hasSwitch('inspect'))
    {

        const { output, exitCode } = renderCliVerification(result, {
            output:    cliArguments.output,
            language:  cliArguments.language,
            i18n:      cliI18N
        });

        process.stdout.write(output);

        if (noGUI)
        {
            mainWindow = null;
            app.exit(exitCode);
        }

    }

});
