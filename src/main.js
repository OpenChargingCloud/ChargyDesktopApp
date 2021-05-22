// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path                                    = require('path');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let applicationEdition    = "ChargePoint Edition";
let copyright             = "&copy; 2018-2021 GraphDefined GmbH";
let applicationFileName   = "";
let appAsarFileName       = "";
let commandLineArguments  = [];
let fileToOpen            = "";


// Run in development mode via run.sh
// [
//   'D:\\Coding\\OpenChargingCloud\\ChargyDesktopApp\\node_modules\\electron\\dist\\electron.exe',
//   '.',
//   '--debug'
// ]
if (process.argv.length >= 2 && process.argv[0].endsWith("electron.exe") && process.argv[1] === ".")
    commandLineArguments = process.argv.slice(2);

// Run the installed executable (via command line)
// [
//   'C:\\Program Files\\Chargy Transparenzsoftware\\Chargy Transparenzsoftware.exe',
//   '--debug'
// ]
else
    commandLineArguments = process.argv.slice(1);


function createWindow () {

    // Note: When the icon could not be loaded all will fail silently!
    //       Also test the app via starting it from the command line within a different directory.
    mainWindow = new BrowserWindow({

        width:              1500,
        height:             900,
        autoHideMenuBar:    true,
        icon:               `${app.getAppPath()}/src/icons/chargy_icon.png`,

        webPreferences: {
            nodeIntegration:          true,
            nodeIntegrationInWorker:  true,
            contextIsolation:         false
       //     preload:          path.join(__dirname, 'preload.js')
        },

        // Don't show the window until it's ready, this prevents any white flickering
        show:              false

    });

    mainWindow.removeMenu();
    mainWindow.loadURL(`file://${app.getAppPath()}/src/index.html`);

    if (app.commandLine.hasSwitch('debug') && !app.commandLine.hasSwitch('nogui'))
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

        console.log("Chargy Transparenzsoftware " + applicationEdition + " v" + app.getVersion());
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
                console.log(" --debug            Run in debug modus and open development tools");
                console.log(" --nogui            Run in command line modus (cli mode)");
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

    createWindow();

});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
        createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
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
    fileToOpen = path;
    if (mainWindow != null)
        mainWindow.webContents.send('receiveFileToOpen', fileToOpen);
});



ipcMain.on('isDebug', (event) => {
  event.returnValue = app.commandLine.hasSwitch('debug');
});

ipcMain.on('noGUI', (event) => {
  event.returnValue = app.commandLine.hasSwitch('nogui');
});

ipcMain.on('getAppFileNames', (event) => {
    event.returnValue = [ applicationFileName, appAsarFileName ];
});

ipcMain.on('getAppVersion', (event) => {
    event.returnValue = app.getVersion();
});

ipcMain.on('getAppEdition', (event) => {
    event.returnValue = applicationEdition;
});

ipcMain.on('getCopyright', (event) => {
    event.returnValue = copyright;
});

ipcMain.on('getCommandLineArguments', (event) => {
    event.returnValue = commandLineArguments;
});

ipcMain.on('getPackageJson', (event) => {
    event.returnValue = require('../package.json');
});

ipcMain.on('getFileToOpen', (event) => {
    event.returnValue = fileToOpen;
});

ipcMain.on('showSaveDialog', (event, arg) => {
    event.returnValue = dialog.showSaveDialogSync(null,
                                                  {
                                                      title:        'Transparenzdatensätze exportieren',
                                                      defaultPath:  app.getPath('documents') + '/Ladevorgaenge.chargy',
                                                  });
})

ipcMain.on('setVerificationResult', (event, result) => {

    event.returnValue = true;

    //console.log(result);

    if (app.commandLine.hasSwitch('nogui') || app.commandLine.hasSwitch('debug'))
    {

        if (!Array.isArray(result))
            result = [ result ];

        for (let singleResult of result)
        {

            //#region Convert status enum to text

            let status = "";

            switch (singleResult.status)
            {

                case 0:
                    status = "Unknown session format";

                case 1:
                    status = "Invalid session format";
                    break;

                case 2:
                    status = "Public key not found";
                    break;

                case 3:
                    status = "Invalid public key";
                    break;

                case 4:
                    status = "Invalid signature";
                    break;

                case 5:
                    status = "Valid signature";
                    break;

                case 6:
                    status = "Inconsistent timestamps";
                    break;

                case 7:
                    status = "At least two measurements required";
                    break;

                default:
                    status = "Unknown session format";
                    break;

            }

            //#endregion

            console.log(status + (singleResult.message != null ? " - " + singleResult.message : ""));

        }

    }

    if (app.commandLine.hasSwitch('nogui'))
    {
        mainWindow = null;
        app.exit(0);
    }

});
