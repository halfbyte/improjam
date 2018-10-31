const { Menu, app } = require('electron')

function makeMenu (win) {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CommandOrControl+N', click: () => win.webContents.send('menu', 'new') },
        { label: 'Open...', accelerator: 'CommandOrControl+O', click: () => win.webContents.send('menu', 'open') },
        { label: 'Save', accelerator: 'CommandOrControl+S', click: () => win.webContents.send('menu', 'save'), id: 'save' },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu', 'save-as'), id: 'save-as', enabled: false },
        { label: 'Save Template...', click: () => win.webContents.send('menu', 'save-template') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      'label': 'Preferences',
      submenu: [
        { label: 'Settings...', accelerator: 'CommandOrControl+,', click: () => win.webContents.send('menu', 'settings') }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click () { require('electron').shell.openExternal('https://electronjs.org') }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })

    // Edit menu
    template[1].submenu.push(
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [
          { role: 'startspeaking' },
          { role: 'stopspeaking' }
        ]
      }
    )

    // Window menu
    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  }

  return Menu.buildFromTemplate(template)
}
module.exports = makeMenu
