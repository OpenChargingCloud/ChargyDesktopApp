// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let filename = "";

function createWindow () {

    // Create the browser window
    mainWindow = new BrowserWindow({

        width:              1500,
        height:             900,
        autoHideMenuBar:    true,
        icon:               'build/chargy_icon.png',

        webPreferences: {
            nodeIntegration:  true,
            preload:          path.join(__dirname, 'preload.js')
        },

        // Don't show the window until it's ready, this prevents any white flickering
        show:              false

    })

    mainWindow.removeMenu();
    mainWindow.loadFile('src/index.html')

    if (app.commandLine.hasSwitch('debug') && !app.commandLine.hasSwitch('nogui'))
        mainWindow.webContents.openDevTools()

    // Emitted when the window is closed
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    // Show main window when page is ready
    mainWindow.on('ready-to-show', () => {
        if (!app.commandLine.hasSwitch('nogui'))
            mainWindow.show();
    })

    // Register key short-cut for PASTE
    require('electron-localshortcut').register(mainWindow, 'Ctrl+V', () => {
        if (mainWindow != null)
            mainWindow.webContents.send('receiveReadClipboard');
    });

}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
        createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin')
        app.quit()
})

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null)
        createWindow()
})

// IPC communication for Mac OS X
// https://medium.com/@nornagon/electrons-remote-module-considered-harmful-70d69500f31#d978
app.on('open-file', (event, path) => {
    event.preventDefault();
    filename = path;
    if (mainWindow != null)
        mainWindow.webContents.send('receiveFileToOpen', path);
});


ipcMain.on('isDebug', (event) => {
  event.returnValue = app.commandLine.hasSwitch('debug');
});

ipcMain.on('noGUI', (event) => {
  event.returnValue = app.commandLine.hasSwitch('nogui');
});

ipcMain.on('getChargyFilename', (event) => {
    event.returnValue = filename;
});

ipcMain.on('getAppVersion', (event) => {
    event.returnValue = app.getVersion();
});

ipcMain.on('getCommandLineArguments', (event) => {
    event.returnValue = process.argv.slice(2);
});

ipcMain.on('getPackageJson', (event) => {
    event.returnValue = require('../package.json');
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

            let status = "";

            switch (singleResult.status)
            {

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

            console.log(status + (singleResult.message != null ? " - " + singleResult.message : ""));

        }

    }

    if (app.commandLine.hasSwitch('nogui'))
        app.quit();

});
