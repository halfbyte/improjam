import Eventable from './eventable.js'

// TODOS:
// * Implement on StateChange to enable connecting/disconnecting MIDI devices

const COLORS = {
  'off': 0,
  'red': 1,
  'light-red': 17,
  'green': 2,
  'light-green': 18,
  'blue': 3,
  'light-blue': 19,
  'yellow': 4,
  'orange': 5,
  'cyan': 6,
  'pink': 7,
  'light-cyan': 22,
  'light-pink': 23,
  'dark-grey': 8,
  'grey': 9,
  'light-grey': 10,
  'white': 11
}

const COLOR_VALUES = [
  [0, 0, 0, 0],
  [80, 0, 0, 0],
  [0, 127, 0, 0],
  [0, 0, 80, 0],
  [100, 127, 10, 0],
  [127, 64, 0, 0],
  [0, 80, 80, 0],
  [127, 0, 127, 0],
  [32, 32, 32, 32],
  [128, 128, 128, 128],
  [192, 192, 192, 192],
  [255, 255, 255, 255],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [255, 0, 0, 200],
  [20, 255, 20, 0],
  [20, 100, 255, 0],
  [255, 255, 0, 0],
  [255, 127, 20, 0],
  [0, 255, 255, 0],
  [255, 20, 255, 0]
]

const ALL_FUNCTION_BUTTONS = [
  3, 9, 102, 103, 104, 105, 106, 107, 108, 109, 30, 59,
  118, 52, 110, 112,
  119, 53, 11, 113,
  60, 61, 29, 20, 21, 22, 23, 24, 25, 26, 27, 28, 46,
  35, 43, 44, 47, 45,
  117, 42,
  116, 41,
  88, 40, 56, 57,
  87,
  90, 39, 58, 31, 50, 51,
  89, 38, 55,
  86, 37, 62, 54, 63,
  85, 36, 49, 48
]

export default class PushDriver extends Eventable {
  constructor (midiAccess) {
    super()
    this.debug = false
    this.installed = false
    this.onMidiInput = this.onMidiInput.bind(this)
    this.findMidiPorts(midiAccess)
    this.setupMatrix()
    this.setupFunctionLeds()
    this.setPalette()
    this.resetMidiMatrix()
    this.resetFunctionButtons()
  }
  findMidiPorts (midiAccess) {
    this.findInput(midiAccess.inputs)
    this.findOutput(midiAccess.outputs)
    if (this.input && this.output) {
      this.installed = true
      this.input.onmidimessage = this.onMidiInput
      console.log('PUSH INITIALIZED')
    }
  }
  findInput (inputs) {
    const device = this.findDevice(inputs)
    if (device) {
      this.input = device
    } else {
      this.input = null
    }
  }
  findOutput (outputs) {
    const device = this.findDevice(outputs)
    if (device) {
      this.output = device
    } else {
      this.output = null
    }
  }
  findDevice (ports) {
    var device = null
    ports.forEach((port) => {
      // MAC
      if (port.name.match(/Ableton Push 2 Live Port/)) {
        device = port
      // Windows
      } else if (!device && port.name.match(/Ableton Push 2/) && !port.name.match(/MIDI(IN|OUT)/)) {
        device = port
      }
    })
    return device
  }
  onMidiInput (event) {
    const command = event.data[0] & 0xF0
    if (command === 144) {
      const note = event.data[1]
      const velocity = event.data[2]
      if (note >= 36 && note <= 99) {
        const x = (note - 36) % 8
        const y = 7 - Math.floor((note - 36) / 8)
        const pos = (y * 8) + x
        this.trigger('push:matrix:on', pos, velocity)
      }
    } else if (command === 128) {
      const note = event.data[1]
      if (note >= 36 && note <= 99) {
        const x = (note - 36) % 8
        const y = 7 - Math.floor((note - 36) / 8)
        const pos = (y * 8) + x
        this.trigger('push:matrix:off', pos)
      }
    } else if (command === 0xb0) {
      const cc = event.data[1]
      const val = event.data[2]
      if (cc === 55 && event.data[2] > 0) {
        this.trigger('push:function:on', 'octave', 'up')
      } else if (cc === 54 && event.data[2] > 0) {
        this.trigger('push:function:on', 'octave', 'down')
      } else if (cc >= 102 && cc <= 109 && event.data[2] > 0) {
        this.trigger('push:channel:on', cc - 102)
      } else if (cc === 85 && val > 0) {
        this.trigger('push:function:on', 'play')
      } else if (cc === 86 && val > 0) {
        this.trigger('push:function:on', 'record')
      } else if (cc === 88 && val > 0) {
        this.trigger('push:function:on', 'duplicate')
      } else if (cc === 88 && val === 0) {
        this.trigger('push:function:off', 'duplicate')
      } else if (cc === 89 && val > 0) {
        this.trigger('push:function:on', 'automate')
      } else if (cc === 48 && val > 0) {
        this.trigger('push:function:on', 'select')
      } else if (cc === 48 && val === 0) {
        this.trigger('push:function:off', 'select')
      } else if (cc === 118 && val > 0) {
        this.trigger('push:function:on', 'delete')
      } else if (cc === 118 && val === 0) {
        this.trigger('push:function:off', 'delete')
      } else if (cc === 57 && val > 0) {
        this.trigger('push:function:on', 'accent')
      } else if (cc === 57 && val === 0) {
        this.trigger('push:function:off', 'accent')
      } else if (cc === 58 && val > 0) {
        this.trigger('push:function:on', 'scale')
      } else if (cc === 58 && val === 0) {
        this.trigger('push:function:off', 'scale')
      } else if (cc === 14) {
        const signed = val < 64 ? val : val - 128
        this.trigger('push:tempo', signed)
      } else if (cc === 15) {
        const signed = val < 64 ? val : val - 128
        this.trigger('push:swing', signed)
      } else if (cc >= 71 && cc <= 78) {
        const signed = val < 64 ? val : val - 128
        this.trigger('push:encoder', cc - 71, signed)
      } else if (cc >= 36 && cc <= 43 && val > 0) {
        this.trigger('push:repeat:on', cc - 36)
      } else if (cc >= 36 && cc <= 43 && val === 0) {
        this.trigger('push:repeat:off', cc - 36)
      } else if (cc === 59 && val > 0) {
        this.trigger('push:function:on', 'user')
      } else if (cc === 60 && val > 0) {
        this.trigger('push:function:on', 'mute')
      } else if (cc === 60 && val === 0) {
        this.trigger('push:function:off', 'mute')
      } else if (cc === 61 && val > 0) {
        this.trigger('push:function:on', 'solo')
      } else if (cc === 61 && val === 0) {
        this.trigger('push:function:off', 'solo')
      } else if (cc >= 20 && cc <= 27 && val > 0) {
        this.trigger('push:mute-solo', cc - 20)
      }
    } else if (command === 0xd0) {
      const velocity = event.data[1]
      this.trigger('push:pressure', velocity)
    } else if (command === 0xe0) {
      this.trigger('push:pitchbend', [event.data[1], event.data[2]])
    } else {
      console.log('unknown cmd', command, event.data)
    }
  }
  setupFunctionLeds () {
    this.currentFunctionLeds = []
    for (var i = 0; i < 128; i++) {
      this.currentFunctionLeds.push([0, 0])
    }
  }
  setupMatrix () {
    this.currentMatrix = []
    for (var i = 0; i < 64; i++) {
      this.currentMatrix.push([0, 0])
    }
  }
  sendSingleFunctionEntry (index, entry) {
    if (!this.installed) { return }
    this.output.send([0xb0 + (entry[0] & 0xF), index, entry[1]])
  }
  sendSingleMatrixEntry (index, entry) {
    if (!this.installed) { return }
    const x = index % 8
    const y = Math.floor(index / 8)
    const liveNote = 36 + ((7 - y) * 8 + x)
    this.output.send([144 + (entry[0] & 0xF), liveNote, entry[1]])
  }
  resetMidiMatrix () {
    if (this.debug) {
      for (var i = 0; i < 64; i++) {
        this.sendSingleMatrixEntry(i, [0, i])
      }
    } else {
      this.currentMatrix.forEach((entry, index) => {
        this.sendSingleMatrixEntry(index, entry)
      })
    }
  }
  setFunctionLeds (data) {
    const newState = Array.from(this.currentFunctionLeds)
    data.forEach((entry) => {
      const [index, config] = entry
      newState[index] = config
    })
    if (!this.debug) {
      this.sendLedsDiff(this.diffLeds(this.currentFunctionLeds, newState))
    }
    this.currentFunctionLeds = newState
  }
  setMatrix (data) {
    const newMatrix = []
    data.forEach((entry, index) => {
      if (COLORS[entry]) {
        newMatrix.push([0, COLORS[entry]])
      } else {
        newMatrix.push([0, 0])
      }
    })
    if (!this.debug) {
      this.sendDiff(this.diffMatrix(this.currentMatrix, newMatrix))
    }
    this.currentMatrix = newMatrix
  }
  setChannel (c) {
    const leds = []
    for (var i = 0; i < 8; i++) {
      leds.push([102 + i, [0, c === i ? COLORS.white : 0]])
    }
    this.setFunctionLeds(leds)
  }
  setPlaying (playing) {
    this.setFunctionLeds([[85, [0, playing ? COLORS.green : COLORS['dark-grey']]]])
  }
  setRecording (recording) {
    this.setFunctionLeds([[86, [recording ? 14 : 0, recording ? COLORS.red : COLORS['dark-grey']]]])
  }
  setAccent (on) {
    this.setFunctionLeds([[57, [0, on ? COLORS.white : COLORS['dark-grey']]]])
  }
  setAutomate (on, recording) {
    this.setFunctionLeds([[89, [0, on ? (recording ? COLORS.red : COLORS.green) : COLORS['dark-grey']]]])
  }
  sendDiff (diff) {
    if (diff.length === 0) { return }
    diff.forEach((entry) => {
      this.sendSingleMatrixEntry(entry[0], entry[1])
    })
  }
  sendLedsDiff (diff) {
    if (diff.length === 0) { return }
    diff.forEach((entry) => {
      this.sendSingleFunctionEntry(entry[0], entry[1])
    })
  }
  diffLeds (old, newM) {
    const diff = []
    for (var i = 0; i < 128; i++) {
      if (old[i][0] !== newM[i][0] || old[i][1] !== newM[i][1]) {
        diff.push([i, newM[i]])
      }
    }
    return diff
  }
  diffMatrix (old, newM) {
    const diff = []
    for (var i = 0; i < 64; i++) {
      if (old[i][0] !== newM[i][0] || old[i][1] !== newM[i][1]) {
        diff.push([i, newM[i]])
      }
    }
    return diff
  }
  resetFunctionButtons () {
    ALL_FUNCTION_BUTTONS.forEach((cc) => {
      this.sendSingleFunctionEntry(cc, [0, 0])
    })
    const leds = []
    const WHITE_BUTTONS = [55, 54, 59, 48, 118, 58, 88, 36, 37, 38, 39, 40, 41, 42, 43]
    WHITE_BUTTONS.forEach((cc) => {
      leds.push([cc, [0, COLORS.white]])
    })
    leds.push([60, [0, COLORS.red]])
    leds.push([61, [0, COLORS.yellow]])
    this.setFunctionLeds(leds)
  }
  setPalette () {
    if (!this.installed) { return }
    COLOR_VALUES.forEach((values, index) => {
      this.output.send([0xF0, 0x00, 0x21, 0x1D, 0x01, 0x01, 0x03, index,
        values[0] & 0x7F, values[0] >> 7 & 0x01,
        values[1] & 0x7F, values[1] >> 7 & 0x01,
        values[2] & 0x7F, values[2] >> 7 & 0x01,
        values[3] & 0x7F, values[3] >> 7 & 0x01,
        0xF7
      ])
    })
    this.output.send([0xF0, 0x00, 0x21, 0x1D, 0x01, 0x01, 0x05, 0xF7])
  }
  refreshMutes (channels) {
    const leds = []
    channels.forEach((ch, index) => {
      const color = ch.muted ? COLORS.red : COLORS['dark-grey']
      leds.push([20 + index, [0, color]])
    })
    this.setFunctionLeds(leds)
  }
  refreshSolo (soloChannel) {
    const leds = []
    for (var i = 0; i < 8; i++) {
      const color = (i === soloChannel) ? COLORS.yellow : COLORS['dark-grey']
      leds.push([20 + i, [0, color]])
    }
    this.setFunctionLeds(leds)
  }
  noMutes () {
    const leds = []
    for (var i = 0; i < 8; i++) {
      leds.push([20 + i, [0, 0]])
    }
    this.setFunctionLeds(leds)
  }
}
