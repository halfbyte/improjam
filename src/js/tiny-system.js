import AppComponent from './components/app.js'
import PushDriver from './push-driver.js'
import PushDisplay from './push-display.js'
import Eventable from './eventable.js'


const m = require('mithril')

const SCALES = ['chromatic', 'min', 'min-m', 'min-h', 'maj']
const SCALEMAPS = {
  'chromatic': [0,1,2,3,4,5,6,7,8,9,10,11],
  'min': [0, 2, 3, 5, 7, 8, 10],
  'min-h': [0, 2, 3, 5, 7, 8, 11],
  'min-m': [0, 2, 3, 5, 7, 9, 11],
  'maj': [0, 2, 4, 5, 7, 9, 100],
}
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const OCTAVES = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
function enumerate(devices) {
  const hash = {}
  devices.forEach((device) => {
    if (!device.name.match(/Ableton Push/)) {
      hash[device.name] = device  
    }
    
  })
  return hash
}

const ANY = -1

const DEFAULT_CHANNEL_CONFIG = {
  outputDevice: 'IAC-Treiber Bus 1',
  inputDevice: ANY,
  outputChannel: 0,
  inputChannel: ANY
}

class Channel {
  constructor(config, system) {
    this.system = system;
    this.outputDevice = config.outputDevice
    this.inputDevice = config.inputDevice
    this.inputChannel = config.inputChannel
    this.outputChannel = config.outputChannel
    this.setupListeners()
  }
  setupListeners() {
    this.onmidimessage = this.onmidimessage.bind(this)
    this.attachListeners()
  }
  attachListeners() {
    this.system.remove(this.onmidimessage)
    if (this.inputDevice === ANY) {      
      this.system.on('all-devices-message', this.onmidimessage)
    } else {
      this.system.on(`device-message.${this.inputDevice}`, this.onmidimessage)
    }
  }
  onmidimessage(data, deviceName) {
    if (this.inputChannel === ANY) {
      this.system.channelMessage(this, data, deviceName)
    } else {
      const channel = data[0] & 0x0F
      if (this.inputChannel === channel) {
        this.system.channelMessage(this, data, deviceName)
      }
    }
  }
}


class Sequencer {
  constructor(system, numChannels) {
    let i;
    this.system = system
    this.tracks = []
    for(i=0;i<numChannels;i++) {
      this.tracks[i] = {
        // pattern to start at
        firstPattern: 0,
        // pattern to end with
        length: 1,
        // actual pattern data.
        data: [],
        mode: 'note',
      }
    }
    this.tempo = 120
    this.playing = false
    this.scheduleNextNotes = this.scheduleNextNotes.bind(this)
    this.tickWorker = new Worker('js/tick-worker.js')
    this.tickWorker.onmessage = this.scheduleNextNotes
  }
  start() {
    this.playing = true
    this.timerOffset = performance.now()
    this.nextTime = 0
    this.tick = 0
    this.scheduleNextNotes()
  }
  scheduleNextNotes() {
    let i, t;
    const numTracks = this.tracks.length;
    const currentTime = performance.now()

    const perTick = 60 / (this.tempo * 24 * 4) * 1000
    const perLoop = perTick * (256*24)
    const offsetInLoop = currentTime - this.timerOffset % perLoop
    const tickInLoop = Math.floor(offsetInLoop / perTick)
  
    if (currentTime > this.nextTime - (perTick * 4)) {
      for(i=0;i<48;i++) {
        const time = this.nextTime + (perTick * 4 * i)
        for(t=0;t<numTracks;t++) {
          const track = this.tracks[t]
          const trackOffset = track.firstPattern * (16*24)
          const trackLength = track.length * 16 * 24
          const tick = ((this.tick + i) % trackLength) + trackOffset          
          if (track.data[tick]) {
            track.data[tick].forEach((event) => {
              if (event.type === 'note') {
                
                this.sendNote(t, time, event.note, event.velocity, event.length * perTick)
              }  
            })
            const event = track.data[tick]
          }
        }
    
      }
      this.tick += i
      this.nextTime += (perTick * 48)
      if (this.tick >= (256*24)) { this.tick = 0 }
    }
    this.tickWorker.postMessage('request-tick')
    //setTimeout(this.scheduleNextNotes, 10)
  }
  sendNote(track, time, note, velocity, length) {
    this.system.sendChannelMessage(
      track, 
      [144, note, velocity],
      time
    )
    this.system.sendChannelMessage(
      track, 
      [128, note, velocity],
      time + length
    )
  }
  toggleNote(track, time, note, velocity=100, length=24) {
    if (this.tracks[track].data[time]) {
      const existing = this.tracks[track].data[time].find((n) => {
        return n.type === 'note' && n.note == note
      })
      if (existing) {
        this.tracks[track].data[time] = this.tracks[track].data[time].filter((ev) => {
          return !(ev.type === 'note' && ev.note == note)
        })
      } else {
        this.tracks[track].data[time].push({
          type: 'note', note: note, velocity: velocity, length: length 
        })
      }
    } else {
      this.tracks[track].data[time] = [
        {type: 'note', note: note, velocity: velocity, length: length}
      ]
    }
  }
}

class Scaler {
  constructor() {
    this.SCALES = SCALES
    this.SCALEMAPS = SCALEMAPS
    this.NOTES = NOTES
    this.OCTAVES = OCTAVES
    this.currentScale = 'min'
    this.currentRootNote = 'C'
    this.currentOctave = 3
  }
  note(row, pos) {
    // TODO: Build chromatic mode
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const noteInRow = map[pos % 7]
    const extraRow = Math.floor(pos / 7)
    const octaveNote = (this.currentOctave + extraRow + row + 1) * 12
    return octaveNote + rootNote + noteInRow
  }
  rowAndPos(note) {
    // TODO: Build chromatic mode
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const octaveNote = (this.currentOctave + 1) * 12
    const baseNote = note - octaveNote - rootNote
    
    const row = 1 - Math.floor(baseNote / 12)
    const noteInOct = note % 12
    return [row, map.indexOf(noteInOct)]
  }
  octaveUp() {
    this.currentOctave++
    if (this.currentOctave > 10) { this.currentOctave = 10 }
  }
  octaveDown() {
    this.currentOctave--
    if (this.currentOctave < 0) { this.currentOctave = 0 }
  }
}

class MIDISystem extends Eventable {
  constructor(midiAccess) {
    super()
    this.pushDriver = new PushDriver(midiAccess)
    this.PushDisplay = new PushDisplay()
    this.inputs = enumerate(midiAccess.inputs)
    this.outputs = enumerate(midiAccess.outputs)
    this.setupChannels()
    this.setupListeners()
    this.scaler = new Scaler()
    this.SCALES = SCALES
    this.sequencer = new Sequencer(this, this.channels.length)
    this.matrixView = new MatrixView(this, this.sequencer)
    this.sequencer.tracks[0].data[0] = [{
      type: 'note',
      note: 48,
      length: 6, // four quarter notes
      velocity: 100
    },{
      type: 'note',
      note: 60 + 3,
      length: 24, // four quarter notes
      velocity: 100
    },{
      type: 'note',
      note: 48 + 7,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[96] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[192] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[288] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[288 + 48] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[288 + 96] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.start()
    this.setupPushBindings()
  }
  setupChannels() {
    let i;
    this.channels = []
    for(i=0;i<16;i++) {
      this.channels[i] = new Channel(DEFAULT_CHANNEL_CONFIG, this)
    }
  }
  setupListeners() {
    this.onMIDIMessage = this.onMIDIMessage.bind(this)
    Object.keys(this.inputs).forEach((key) => {
      this.setupDeviceListener(this.inputs[key])      
    })
  }
  setupDeviceListener(device) {
    device.onmidimessage = this.onMIDIMessage
  }
  onMIDIMessage(event) {
    this.trigger('all-devices-message', event.data, event.target.name)
    this.trigger(`device-message.${event.target.name}`, event.data, event.target.name)
  }
  channelMessage(channel, data, deviceName) {
    if (data[0] === 248) { return; }
    //console.log(channel, data, deviceName)
  }
  sendChannelMessage(track, data, time) {
    
    data[0] = data[0] | this.channels[track].outputChannel
    if (this.outputs[this.channels[track].outputDevice]) { 
      this.outputs[this.channels[track].outputDevice].send(data, time)
    }
  }
  setupPushBindings() {
    this.pushDriver.on('push:function:on', (fun, ...params) => {
      if (fun === 'octave') {
        if (params[0] == 'up') {
          this.scaler.octaveUp()
          m.redraw()
        }
        if (params[0] == 'down') {
          this.scaler.octaveDown()
          m.redraw()
        }
      }
    })
  }
}

class MatrixView {

  constructor(system, sequencer) {
    this.system = system
    this.sequencer = sequencer
    this.leds = []
    for(var i=0;i<64;i++) { this.leds.push('off') }
    this.selectedChannel = 0
    this.selectedPattern = 0
    this.selectedNote = 0
    this.noteOffset = 48
    this.system.pushDriver.on('push:matrix:on', (led) => {
      this.ledClick(led)
    })
  }
  refreshLeds() {
    for(var i=0;i<64;i++) {
      this.leds[i] = 'off'
    }
    const track = this.sequencer.tracks[this.selectedChannel]
    // active patterns
    const lastPattern = track.firstPattern + track.length
    for(var i=track.firstPattern;i<lastPattern;i++) {
      this.leds[i] = 'red'
    }
    this.leds[this.selectedPattern] = 'orange'
    
    // steps
    for(var i=0;i<32;i++) {
      if (track.data[24*(i + (this.selectedPattern * 16))] && track.data[24*(i + (this.selectedPattern * 16))].length > 0) {
        this.leds[16+i] = 'green'
      }
    }
    this.leds[16 + this.selectedNote] = 'light-green'
    // notes

    for(var i=0;i<16;i++) {
      if (i % 8 === 0 || i % 8 === 7) {
        this.leds[48 + i] = 'dark-teal'

      } else {
        this.leds[48 + i] = 'blue'
      }
    }

    if (track.data[24*(this.selectedNote + (this.selectedPattern * 16))]) {
      const notes = track.data[24*(this.selectedNote + (this.selectedPattern * 16))]
      notes.forEach((note) => {
        const [row, pos] = this.system.scaler.rowAndPos(note.note)
        if (pos != null) {
          if (row >= 0 && row <= 1 && pos > 0) {
            this.setNote(48 + ((row) * 8) + pos)            
          } else if (pos === 0) {
            if (row === -1) {
              this.setNote(48 + 7)
            } else if (row === 0) {
              this.setNote(48 + 8 + 7)
              this.setNote(48)
            } else if (row === 1) {
              this.setNote(48 + 8)
            }
          }
              
        } 
        
      })
    }
  }
  setNote(pos) {
    const color = (pos % 8 === 0 || pos % 8 === 7) ? 'teal' : 'light-blue'
    this.leds[pos] = color
  }
  ledState(index) {
    this.refreshLeds()
    this.system.pushDriver.setMatrix(this.leds)
    return this.leds[index]
    
  }
  ledClick(index, velocity=100) {
    if (index < 16) {
      this.selectedPattern = index
    }
    if (index >= 16 && index < 48) {
      this.selectedNote = index - 16
    }
    if (index >= 48) {
      const time = 24*(this.selectedNote + (this.selectedPattern * 16))
      const row = 1 - Math.floor((index - 48) / 8)
      const pos = index % 8
      const note = this.system.scaler.note(row, pos)
      this.sequencer.toggleNote(this.selectedChannel, time, note, velocity)
    }
    m.redraw()
  }
  
}

navigator.requestMIDIAccess().then((access) => {
  const midiSystem = new MIDISystem(access)
  const root = document.getElementById('root')
  m.mount(root, { view: function() { return m(AppComponent, {system: midiSystem})} })
}).catch( (error) => {
  console.error(error)
})
