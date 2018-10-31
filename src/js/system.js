/* eslint-env browser */
import AppComponent from './components/app.js'
import PushDriver from './push-driver.js'
import PushDisplay from './push-display.js'
import Eventable from './eventable.js'
import Channel from './channel.js'
import Sequencer from './sequencer.js'
import Scaler from './scaler.js'
import UI from './ui.js'

const dialogs = require('dialogs')()

const FILE_FILTER = [
  { name: 'Improjam File', extensions: ['improjam'] }
]

const { ipcRenderer } = require('electron')

const NUM_CHANNELS = 8
const m = require('mithril')

function enumerate (devices) {
  const hash = {}
  devices.forEach((device) => {
    if (!device.name.match(/Ableton Push/)) {
      hash[device.name] = device
    }
  })
  return hash
}

class MIDISystem extends Eventable {
  constructor (midiAccess) {
    super()
    this.pushDriver = new PushDriver(midiAccess)
    this.PushDisplay = new PushDisplay(this)
    this.inputs = enumerate(midiAccess.inputs)
    this.outputs = enumerate(midiAccess.outputs)
    this.setupChannels()
    this.setupListeners()
    this.scaler = new Scaler()
    this.sequencer = new Sequencer(this, this.channels.length)
    this.ui = new UI(this, this.sequencer)
    this.matrixView = this.ui
    this.soloChannel = null
    this.availableTemplates = []

    this.listTemplates()
    this.loadLastSong()
    this.initPushState()
    this.settingsOpen = false
    this.currentTemplate = 'settings'
  }
  initPushState () {
    this.pushDriver.setChannel(this.matrixView.selectedChannel)
    this.pushDriver.setAutomate(this.controllerMode, this.sequencer.recording)
  }
  setupChannels () {
    let i
    this.channels = []
    for (i = 0; i < NUM_CHANNELS; i++) {
      this.channels[i] = new Channel({}, this)
    }
  }

  clearAll () {
    if (this.sequencer) { this.sequencer.reset() }
    if (this.ui) { this.ui.reset() }
    if (this.scaler) { this.scaler.reset() }
    localStorage.removeItem('currentFile')
    this.adjustSaveAsMenu()
  }

  setupListeners () {
    this.onMIDIMessage = this.onMIDIMessage.bind(this)
    Object.keys(this.inputs).forEach((key) => {
      this.setupDeviceListener(this.inputs[key])
    })
    ipcRenderer.on('menu', (event, arg) => {
      if (arg === 'new') {
        if (confirm('Really Clear All?')) {
          this.clearAll()
          m.redraw()
        }
      } else if (arg === 'open') {
        this.loadAs()
      } else if (arg === 'save') {
        this.save()
      } else if (arg === 'save-as') {
        this.saveAs()
      } else if (arg === 'settings') {
        this.settingsOpen = !this.settingsOpen
        m.redraw()
      } else if (arg === 'save-template') {
        this.startSaveTemplate()
      }
    })
  }
  setupDeviceListener (device) {
    device.onmidimessage = this.onMIDIMessage
  }
  onMIDIMessage (event) {
    this.trigger('all-devices-message', event.data, event.target.name)
    this.trigger(`device-message.${event.target.name}`, event.data, event.target.name)
  }
  channelMessage (channel, data, deviceName) {
    if (data[0] === 248) { }
  }
  sendChannelMessage (track, data, time) {
    if (this.channels[track].muted) { return }
    if (this.soloChannel != null && this.soloChannel !== track) { return }
    data[0] = data[0] | this.channels[track].outputChannel
    if (this.outputs[this.channels[track].outputDevice]) {
      this.outputs[this.channels[track].outputDevice].send(data, time)
    }
  }
  sendControl (channel, slot, increment) {
    const oldValue = this.channels[channel].controlSlots[slot]
    var newValue = oldValue + increment
    if (newValue > 127) { newValue = 127 }
    if (newValue < 0) { newValue = 0 }
    if (oldValue !== newValue) {
      this.channels[channel].controlSlots[slot] = newValue
      this.sendChannelMessage(channel, [0xb0, slot + 71, newValue], 0)
    }
  }
  sendSync (output, time) {
    this.outputs[output].send([0xF8], time)
  }
  sendStart (output, time) {
    this.outputs[output].send([0xFA], time)
  }
  sendStop (output, time) {
    this.outputs[output].send([0xFC], time)
  }
  // TODO: Implement a real save.

  startSaveTemplate () {
    dialogs.prompt('Save Template', this.currentTemplate, this.saveTemplate.bind(this))
  }

  saveTemplate (templateName) {
    if (templateName == null) { return }
    const { app } = require('electron').remote
    const path = require('path')
    const userDataPath = app.getPath('userData')
    const fs = require('fs')
    const dir = path.join(userDataPath, 'templates')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
    const fullPath = path.join(dir, `${templateName}.json`)
    // gather data
    const data = {
      patterns: this.sequencer.tracks,
      channels: this.channels.map((ch) => ch.getConfig()),
      scaler: this.scaler.getConfig(),
      settings: {
        tempo: this.sequencer.tempo,
        swing: this.sequencer.swing,
        syncOuts: this.sequencer.syncOuts,
        accent: this.matrixView.accent
      }
    }
    // write config
    fs.writeFile(fullPath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('Error saving settings', err)
      } else {
        console.log('Settings saved')
      }
    })
    this.listTemplates()
  }
  save () {
    if (localStorage.getItem('currentFile') != null) {
      this.saveSong(localStorage.getItem('currentFile'))
    } else {
      this.saveAs()
    }
  }

  saveAs () {
    const { dialog } = require('electron').remote
    const path = dialog.showSaveDialog({ filters: FILE_FILTER, properties: ['openFile'], title: 'Save Improjam Song' })
    if (path) {
      this.saveSong(path)
    }
  }

  // TODO: Implement a real save.
  saveSong (path) {
    console.log('SAVING TO', path)
    // gather data
    const data = {
      patterns: this.sequencer.tracks,
      scaler: this.scaler.getConfig(),
      channels: this.channels.map((ch) => ch.getConfig()),
      settings: {
        tempo: this.sequencer.tempo,
        syncOuts: this.sequencer.syncOuts,
        swing: this.sequencer.swing,
        accent: this.matrixView.accent
      }
    }
    // write config
    const fs = require('fs')
    fs.writeFile(path, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('Error saving Song', err)
      } else {
        console.log('Song saved')
        localStorage.setItem('currentFile', path)
        this.adjustSaveAsMenu()
      }
    })
  }

  adjustSaveAsMenu () {
    const { Menu } = require('electron').remote
    const menu = Menu.getApplicationMenu()
    const saveAs = menu.getMenuItemById('save-as')
    saveAs.enabled = localStorage.getItem('currentFile') != null
  }

  loadLastSong () {
    if (localStorage.getItem('currentFile') != null) {
      this.loadSong(localStorage.getItem('currentFile'))
      this.adjustSaveAsMenu()
    }
  }

  loadAs () {
    const { dialog } = require('electron').remote
    const paths = dialog.showOpenDialog({ filters: FILE_FILTER, properties: ['openFile'], title: 'Open Improjam Song' })
    if (paths) {
      this.loadSong(paths[0])
    }
  }

  loadSong (path) {
    console.log('Loading Song from', path)
    const fs = require('fs')
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        console.log("Couldn't load settings", err)
      } else {
        const parsed = JSON.parse(data)
        if (parsed.patterns) {
          this.sequencer.tracks = parsed.patterns
        }
        if (parsed.channels) {
          parsed.channels.forEach((config, index) => {
            this.channels[index].setConfig(config)
          })
        }
        if (parsed.scaler) {
          this.scaler.setConfig(parsed.scaler)
        }
        if (parsed.channels) {
          parsed.channels.forEach((config, index) => {
            this.channels[index].setConfig(config)
          })
        }
        if (parsed.settings) {
          this.sequencer.syncOuts = parsed.settings.syncOuts || []
          this.sequencer.tempo = parsed.settings.tempo || 120
          this.sequencer.swing = parsed.settings.swing || 0
          this.sequencer.syncOut = parsed.settings.syncOut || -1
          this.matrixView.accent = !!parsed.settings.accent
        }
        m.redraw()
      }
    })
  }

  listTemplates () {
    const { app } = require('electron').remote
    const path = require('path')
    const userDataPath = app.getPath('userData')
    const fs = require('fs')
    const fullPath = path.join(userDataPath, 'templates')
    this.availableTemplates = []
    fs.readdir(fullPath, (err, files) => {
      if (err) { console.log('Error reading templates', err) }
      files.forEach(file => {
        const baseName = path.basename(file, '.json')
        this.availableTemplates.push(baseName)
      })
      m.redraw()
    })
  }

  loadTemplate (templateName) {
    const { app } = require('electron').remote
    const path = require('path')
    const userDataPath = app.getPath('userData')
    const fs = require('fs')
    const fullPath = path.join(userDataPath, 'templates', `${templateName}.json`)
    console.log('Loading settings from: ', fullPath)

    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        console.log("Couldn't load settings", err)
      } else {
        const parsed = JSON.parse(data)
        if (parsed.channels) {
          parsed.channels.forEach((config, index) => {
            this.channels[index].setConfig(config)
          })
        }
        if (parsed.settings) {
          this.sequencer.syncOuts = parsed.settings.syncOuts || []
        }
        this.currentTemplate = templateName
      }
    })
  }
}

navigator.requestMIDIAccess({ sysex: true }).then((access) => {
  const midiSystem = new MIDISystem(access)
  const root = document.getElementById('root')
  m.mount(root, { view: function () { return m(AppComponent, { system: midiSystem }) } })
}).catch((error) => {
  console.error(error)
})
