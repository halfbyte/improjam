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
  [64, 64, 64, 0],
  [128, 128, 128, 0],
  [192, 192, 192, 0],
  [255, 255, 255, 0],
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

export default class PushDriver extends Eventable {
  constructor (midiAccess) {
    super()
    this.debug = false
    this.installed = false
    this.onMidiInput = this.onMidiInput.bind(this)
    this.findMidiPorts(midiAccess)
    this.setupMatrix()
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
      if (port.name.match(/Ableton Push 2 Live Port/)) {
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
      // send noteoff
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
        this.trigger('push:play')
      }
    }
  }
  setupMatrix () {
    this.currentMatrix = []
    for (var i = 0; i < 64; i++) {
      this.currentMatrix.push([0, 0])
    }
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
    for (var i = 0; i < 8; i++) {
      this.output.send([0xb0, 102 + i, c === i ? COLORS.white : 0])
    }
  }
  setPlaying (playing) {
    this.output.send([0xb0, 85, playing ? COLORS.green : COLORS.red])
  }
  sendDiff (diff) {
    diff.forEach((entry) => {
      this.sendSingleMatrixEntry(entry[0], entry[1])
    })
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
    if (!this.installed) { return }
    const WHITE_BUTTONS = [55, 54]
    WHITE_BUTTONS.forEach((cc) => {
      this.output.send([0xb0, cc, 127])
    })
  }
  setPalette () {
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
}
