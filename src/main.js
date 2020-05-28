// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {

  // Create the browser window.
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

  // Remove the menu
  mainWindow.removeMenu();

  // and load the index.html of the app.
  mainWindow.loadFile('src/index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  // Show main window when page is ready
  mainWindow.on('ready-to-show', () => {

    if (app.commandLine.hasSwitch('nogui'))
      console.log("No app GUI!");

    console.log(process.argv);
    if (!process.argv.slice(2).some(file => file?.toLowerCase() == "-nogui"))
    {
     // console.log("No GUI!");
      mainWindow.show()
    }

  })

  require('electron-localshortcut').register(mainWindow, 'Ctrl+V', () => {
    if (mainWindow != null)
      mainWindow.webContents.send('receiveReadClipboard');
  });

}

console.log(process.argv);


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// IPC communication for Mac OS X
// https://medium.com/@nornagon/electrons-remote-module-considered-harmful-70d69500f31#d978
var filename = "";
app.on('open-file', (event, path) => {
    event.preventDefault();
    filename = path;
    if (mainWindow != null)
        mainWindow.webContents.send('receiveFileToOpen', path);
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


