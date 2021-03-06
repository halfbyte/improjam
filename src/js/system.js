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

const link = require('abletonlink')()

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
    this.availableCtrlTemplates = []
    this.useLink = false
    this.listTemplates()
    this.listCtrlTemplates()
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
      this.channels[i] = new Channel({ name: `Track ${i + 1}` }, this)
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
    ipcRenderer.on('chose-open-file', (event, path) => this.loadSong(path))
    ipcRenderer.on('chose-save-file', (event, path) => this.saveSong(path))
  }
  setupDeviceListener (device) {
    device.onmidimessage = this.onMIDIMessage
  }
  onMIDIMessage (event) {
    if (event.data.length === 1) {
      if (event.data[0] === 0xF8) {
        this.sequencer.midiTick(event.target.name)
      }
      if (event.data[0] === 0xFA) {
        this.sequencer.midiStart(event.target.name)
      }
      if (event.data[0] === 0xFC) {
        this.sequencer.midiStop(event.target.name)
      }
    }
    this.trigger('all-devices-message', event.data, event.target.name)
    this.trigger(`device-message.${event.target.name}`, event.data, event.target.name)
  }
  channelMessage (channel, data, deviceName) {
    if (data[0] === 248) { }
  }
  sendChannelMessage (track, data, time, channel) {
    console.log('CHMSG', track, data, time, channel)
    if (this.soloChannel != null && this.soloChannel !== track) { return }
    if (this.channels[track].muted && this.soloChannel !== track) { return }

    let outChannel = this.channels[track].outputChannel

    if (channel != null) {
      outChannel = channel
    }

    data[0] = data[0] | outChannel
    if (this.outputs[this.channels[track].outputDevice]) {
      if (time === 0) { time = performance.now() }
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
      const cfg = this.channels[channel].ctrlConfig[slot]
      if (cfg.cc != null) {
        this.sendChannelMessage(channel, [0xb0, cfg.cc, newValue], 0, cfg.channel)
      }
      if (cfg.nrpn != null) {
        const [msb, lsb] = cfg.nrpn
        this.sendChannelMessage(channel, [0xb0, 99, msb], 0, cfg.channel)
        this.sendChannelMessage(channel, [0xb0, 98, lsb], 0, cfg.channel)
        this.sendChannelMessage(channel, [0xb0, 6, newValue], cfg.channel)
      }
    }
  }
  sendSync (output, time) {
    this.outputs[output] != null && this.outputs[output].send([0xF8], time)
  }
  sendStart (output, time) {
    this.outputs[output] != null && this.outputs[output].send([0xFA], time)
  }
  sendStop (output, time) {
    this.outputs[output] != null && this.outputs[output] != null && this.outputs[output].send([0xFC], time)
  }

  setLinkStatus (val) {
    this.useLink = val
    if (this.useLink === true) {
      this.startLink()
    } else {
      this.stopLink()
    }
  }

  startLink () {
    link.startUpdate(20, (beat, phase, bpm) => {
      console.log('updated', beat, phase, bpm)
    })
  }

  stopLink () {
    link.stopUpdate()
  }

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
      channels: this.channels.map((ch) => ch.getConfig()),
      scaler: this.scaler.getConfig(),
      settings: {
        syncOuts: this.sequencer.syncOuts,
        syncIn: this.sequencer.syncIn,
        syncMode: this.sequencer.syncMode
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
    ipcRenderer.send('save-file')
  }

  // TODO: Implement a real save.
  saveSong (path) {
    const data = {
      patterns: this.sequencer.tracks,
      scaler: this.scaler.getConfig(),
      channels: this.channels.map((ch) => ch.getConfig()),
      settings: {
        tempo: this.sequencer.tempo,
        syncOuts: this.sequencer.syncOuts,
        swing: this.sequencer.swing,
        accent: this.matrixView.accent
      },
      version: '2.0'
    }
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
    ipcRenderer.send('open-file')
  }

  loadSong (path) {
    console.log('Loading Song from', path)
    const fs = require('fs')
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        dialogs.alert(`Error loading song: ${err}`)
      } else {
        const parsed = JSON.parse(data)
        if (parsed.patterns) {
          this.sequencer.loadPatterns(parsed.patterns, parsed.version)
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

  listCtrlTemplates () {
    const { app } = require('electron').remote
    const path = require('path')
    const appPath = app.getAppPath()
    const fs = require('fs')
    const fullPath = path.join(appPath, 'ctrl_templates')
    this.availableTemplates = []
    fs.readdir(fullPath, (err, files) => {
      if (err) { console.log('Error reading templates', err) }
      files.forEach(file => {
        const baseName = path.basename(file, '.json')
        this.availableCtrlTemplates.push(baseName)
      })
      m.redraw()
    })
  }

  loadCtrlTemplate (track, templateName) {
    const { app } = require('electron').remote
    const path = require('path')
    const appPath = app.getAppPath()
    const fs = require('fs')
    const fullPath = path.join(appPath, 'ctrl_templates', `${templateName}.json`)
    console.log('Loading ctrl_template from: ', fullPath)

    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        dialogs.alert(`Error loading template: ${err}`)
      } else {
        const parsed = JSON.parse(data)
        this.channels[track].setCtrlConfig(parsed)
        m.redraw()
      }
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
        dialogs.alert(`Error loading template: ${err}`)
      } else {
        const parsed = JSON.parse(data)
        if (parsed.channels) {
          parsed.channels.forEach((config, index) => {
            this.channels[index].setConfig(config)
          })
        }
        if (parsed.settings) {
          this.sequencer.syncOuts = parsed.settings.syncOuts || []
          this.sequencer.syncIn = parsed.settings.syncIn
          this.sequencer.syncMode = parsed.settings.syncMode || 'sync-out'
        }
        this.currentTemplate = templateName
        m.redraw()
      }
    })
  }
}

navigator.requestMIDIAccess({ sysex: true }).then((access) => {
  const midiSystem = new MIDISystem(access)
  window._midiSystem = midiSystem // for debugging purposes
  const root = document.getElementById('root')
  m.mount(root, { view: function () { return m(AppComponent, { system: midiSystem }) } })
}).catch((error) => {
  console.error(error)
})
