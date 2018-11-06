/* global m */

const m = require('mithril')
const ANY = -1

const DEFAULT_CTRL_CONFIG = [
  { 'name': 'Ctrl 1', 'cc': '71' },
  { 'name': 'Ctrl 2', 'cc': '72' },
  { 'name': 'Ctrl 3', 'cc': '73' },
  { 'name': 'Ctrl 4', 'cc': '74' },
  { 'name': 'Ctrl 5', 'cc': '75' },
  { 'name': 'Ctrl 6', 'cc': '76' },
  { 'name': 'Ctrl 7', 'cc': '77' },
  { 'name': 'Ctrl 8', 'cc': '78' }
]

const DEFAULT_CHANNEL_CONFIG = {
  inputDevice: ANY,
  outputChannel: 0,
  inputChannel: ANY,
  sequencerMode: 'notes',
  ctrlConfig: DEFAULT_CTRL_CONFIG
}

export default class Channel {
  constructor (config, system) {
    this.system = system
    this.onmidimessage = this.onmidimessage.bind(this)
    this.controlSlots = [0, 0, 0, 0, 0, 0, 0, 0]
    this.setConfig(config)
  }
  attachListeners () {
    this.system.remove(this.onmidimessage)
    if (this.inputDevice === ANY) {
      this.system.on('all-devices-message', this.onmidimessage)
    } else {
      this.system.on(`device-message.${this.inputDevice}`, this.onmidimessage)
    }
  }
  onmidimessage (data, deviceName) {
    if (this.inputChannel === ANY) {
      this.system.channelMessage(this, data, deviceName)
    } else {
      const channel = data[0] & 0x0F
      if (this.inputChannel === channel) {
        this.system.channelMessage(this, data, deviceName)
      }
    }
  }
  setConfig (config) {
    const firstOutputDevice = Object.keys(this.system.outputs)
    const firstInputDevice = Object.keys(this.system.inputs)
    this.outputDevice = config.outputDevice || firstOutputDevice
    this.inputDevice = config.inputDevice || firstInputDevice
    this.inputChannel = config.inputChannel || DEFAULT_CHANNEL_CONFIG.inputChannel
    this.outputChannel = config.outputChannel || DEFAULT_CHANNEL_CONFIG.outputChannel
    this.sequencerMode = config.sequencerMode || DEFAULT_CHANNEL_CONFIG.sequencerMode
    this.ctrlConfig = config.ctrlConfig || DEFAULT_CHANNEL_CONFIG.ctrlConfig
    this.muted = !!config.muted
    this.attachListeners()
    m.redraw()
  }
  getConfig () {
    return {
      outputDevice: this.outputDevice,
      inputDevice: this.inputDevice,
      inputChannel: this.inputChannel,
      outputChannel: this.outputChannel,
      sequencerMode: this.sequencerMode,
      ctrlConfig: this.ctrlConfig,
      muted: this.muted
    }
  }
}
