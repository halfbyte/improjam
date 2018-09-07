// Hello

// Modules to control application life and create native browser window
const path = require('path')
const {app, BrowserWindow, protocol} = require('electron')
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

require('electron-reload')(__dirname);


let mainWindow

const base = app.getAppPath();
const scheme = "app"
// Create the protocol
const srcPath = path.join(base, 'src')
require('./src/create-protocol')(scheme, srcPath);

// const protocolServeName = protocolServe({cwd: srcPath, app, protocol});

// The protocol we created needs to be registered
protocol.registerStandardSchemes([scheme], { secure: true });


function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1024, height: 768})

  // and load the index.html of the app.
  mainWindow.loadURL('app://./index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
