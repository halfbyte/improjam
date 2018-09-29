import Eventable from './eventable.js'

// TODOS:
// * Implement on StateChange to enable connecting/disconnecting MIDI devices


const COLORS = {
  'pink': 1,
  'orange': 8,
  'red': 127,
  'green': 32,
  'blue': 125,
  'light-blue': 16,
  'light-green': 126
}

export default class PushDriver extends Eventable {
  constructor(midiAccess) {
    super()
    this.installed = false
    this.onMidiInput = this.onMidiInput.bind(this)
    this.findMidiPorts(midiAccess)
    this.setupMatrix()
    this.resetMidiMatrix()
    this.resetFunctionButtons()
  }
  findMidiPorts(midiAccess) {
    this.findInput(midiAccess.inputs)
    this.findOutput(midiAccess.outputs)
    if (this.input && this.output) {
      this.installed = true
      this.input.onmidimessage = this.onMidiInput
      console.log("PUSH INITIALIZED")
    }

  }
  findInput(inputs) {
    const device = this.findDevice(inputs)
    if (device) {
      this.input = device  
    } else {
      this.input = null
    }
  }
  findOutput(outputs) {
    const device = this.findDevice(outputs)
    if (device) {
      this.output = device  
    } else {
      this.output = null
    }
  }
  findDevice(ports) {
    var device = null
    ports.forEach((port) => {
      console.log(port.name)
      if (port.name.match(/Ableton Push 2 Live Port/)) {
        device = port
      }
    })
    return device
  }
  onMidiInput(event) {
    const command = event.data[0] & 0xF0
    if (command === 144) {
      const note = event.data[1]
      const velocity = event.data[2]
      if (note >= 36 && note <= 99) {
        const x = (note-36) % 8
        const y = 7 - Math.floor((note - 36) / 8)
        const pos = (y*8) + x
        console.log("push:matrix:on", pos, velocity)
        this.trigger('push:matrix:on', pos, velocity)
      }
    } else if (command === 128) {
      // send noteoff
    } else if (command === 0xb0) {
      const cc = event.data[1]
      if (cc === 55 && event.data[2] > 0) {
        this.trigger('push:function:on', 'octave', 'up')
      }
      if (cc === 54 && event.data[2] > 0) {
        this.trigger('push:function:on', 'octave', 'down')
      }
    }
  }
  setupMatrix() {
    this.currentMatrix = []
    for(var i=0;i<64;i++) {
      this.currentMatrix.push([0, 0])
    }
  }
  sendSingleMatrixEntry(index, entry) {
    if (!this.installed) { return; }
    const x = index % 8
    const y = Math.floor(index / 8)
    const liveNote = 36 + ((7 - y) * 8 + x)
    console.log("SEND", entry[0], entry[1])
    this.output.send([144 + (entry[0] & 0xF), liveNote, entry[1]])
  }
  resetMidiMatrix() {
    this.currentMatrix.forEach((entry, index) => {
      this.sendSingleMatrixEntry(index, entry)
    })
  }
  setMatrix(data) {
    const newMatrix = []
    data.forEach((entry, index) => {
      if (COLORS[entry]) {
        newMatrix.push([0,COLORS[entry]])
      } else {
        newMatrix.push([0,0])
      }
    })
    this.sendDiff(this.diffMatrix(this.currentMatrix, newMatrix))
    this.currentMatrix = newMatrix
  }
  sendDiff(diff) {
    diff.forEach((entry) => {
      this.sendSingleMatrixEntry(entry[0], entry[1])
    })
  }
  diffMatrix(old, newM) {
    const diff = []
    for(var i=0;i<64;i++) {
      if (old[i][0] != newM[i][0] || old[i][1] != newM[i][1]) {
        diff.push([i, newM[i]])
      }
    }
    return diff
  }
  resetFunctionButtons() {
    if (!this.installed) { return; }
    const WHITE_BUTTONS = [55,54]
    WHITE_BUTTONS.forEach((cc) => {
      this.output.send([0xb0, cc, 127])
    })
    
  }
}