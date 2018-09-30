/* global Worker, performance */
import AppComponent from './components/app.js'
import PushDriver from './push-driver.js'
import PushDisplay from './push-display.js'
import Eventable from './eventable.js'

const NUM_CHANNELS = 8
const m = require('mithril')

const SCALES = ['chromatic', 'min', 'min-m', 'min-h', 'maj']
const SCALEMAPS = {
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'min': [0, 2, 3, 5, 7, 8, 10],
  'min-h': [0, 2, 3, 5, 7, 8, 11],
  'min-m': [0, 2, 3, 5, 7, 9, 11],
  'maj': [0, 2, 4, 5, 7, 9, 100]
}
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const OCTAVES = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const DRUM_MODES = {
  'drums-circuit': [60, 62, 64, 65],
  'drums-volca': []
}

const PARAM_LIMITS = {
  length: [1, 64],
  velocity: [1, 127]
}

function enumerate (devices) {
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
  inputChannel: ANY,
  sequencerMode: 'notes'
}

class Channel {
  constructor (config, system) {
    this.system = system
    this.onmidimessage = this.onmidimessage.bind(this)
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
    this.outputDevice = config.outputDevice || DEFAULT_CHANNEL_CONFIG.outputDevice
    this.inputDevice = config.inputDevice || DEFAULT_CHANNEL_CONFIG.inputDevice
    this.inputChannel = config.inputChannel || DEFAULT_CHANNEL_CONFIG.inputChannel
    this.outputChannel = config.outputChannel || DEFAULT_CHANNEL_CONFIG.outputChannel
    this.sequencerMode = config.sequencerMode || DEFAULT_CHANNEL_CONFIG.sequencerMode
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
      muted: this.muted
    }
  }
}

class Sequencer {
  constructor (system, numChannels) {
    let i
    this.system = system
    this.tracks = []
    for (i = 0; i < numChannels; i++) {
      this.tracks[i] = {
        // pattern to start at
        firstPattern: 0,
        // pattern to end with
        length: 1,
        // actual pattern data.
        data: [],
        mode: 'note'
      }
    }
    this.tempo = 120
    this.playing = false
    this.scheduleNextNotes = this.scheduleNextNotes.bind(this)
    this.tickWorker = new Worker('js/tick-worker.js')
    this.tickWorker.onmessage = this.scheduleNextNotes
    this.realTick = 0
    this.realStep = 0
    this.oldRealStep = 0
    this.openNotes = []
  }
  start () {
    this.playing = true
    this.startTime = performance.now()
    this.nextTime = performance.now()
    this.tick = 0
    this.scheduleNextNotes()
  }
  stop () {
    this.playing = false
  }
  playPause () {
    if (this.playing) {
      this.stop()
    } else {
      this.start()
    }
  }
  scheduleNextNotes () {
    if (!this.playing) { return }
    let i, t
    const numTracks = this.tracks.length
    const currentTime = performance.now()

    const perTick = 60 / (this.tempo * 24 * 4) * 1000

    const diff = (this.nextTime - currentTime) / perTick
    var realTick = Math.floor(this.tick - diff)
    if (realTick < 0) { realTick = 256 * 24 + realTick }
    this.realTick = realTick
    this.realStep = Math.floor(realTick / 24)
    if (this.realStep !== this.oldRealStep) {
      m.redraw()
      this.oldRealStep = this.realStep
    }

    if (currentTime > this.nextTime - (perTick * 4)) {
      for (i = 0; i < 48; i++) {
        const time = this.nextTime + (perTick * i)
        for (t = 0; t < numTracks; t++) {
          const track = this.tracks[t]
          const trackOffset = track.firstPattern * (16 * 24)
          const trackLength = track.length * 16 * 24
          const tick = ((this.tick + i) % trackLength) + trackOffset
          if (track.data[tick]) {
            track.data[tick].forEach((event) => {
              if (event.type === 'note') {
                this.sendNote(t, time, event.note, event.velocity, event.length * perTick)
              }
            })
          }
        }
      }
      this.tick += i
      this.nextTime += (perTick * 48)
      if (this.tick >= (256 * 24)) { this.tick = 0 }
    }
    this.tickWorker.postMessage('request-tick')
    // setTimeout(this.scheduleNextNotes, 10)
  }
  sendNote (track, time, note, velocity, length) {
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
  toggleNote (track, time, note, velocity = 100, length = 24) {
    if (this.recording) { return }
    if (this.tracks[track].data[time]) {
      const existing = this.tracks[track].data[time].find((n) => {
        return n.type === 'note' && n.note === note
      })
      if (existing) {
        this.tracks[track].data[time] = this.tracks[track].data[time].filter((ev) => {
          return !(ev.type === 'note' && ev.note === note)
        })
      } else {
        this.tracks[track].data[time].push({
          type: 'note', note: note, velocity: velocity, length: length
        })
        return true
      }
    } else {
      this.tracks[track].data[time] = [
        { type: 'note', note: note, velocity: velocity, length: length }
      ]
      return true
    }
  }
  // for realtime recording
  addNote (track, time, note, velocity = 100, length = 24) {
    console.log('AN', track, time, note, velocity, length)
    if (this.tracks[track].data[time]) {
      const existing = this.tracks[track].data[time].find((n) => {
        return n.type === 'note' && n.note === note
      })
      if (existing) {
        this.tracks[track].data[time] = this.tracks[track].data[time].filter((ev) => {
          return !(ev.type === 'note' && ev.note === note)
        })
      }
      this.tracks[track].data[time].push({
        type: 'note', note: note, velocity: velocity, length: length
      })
    } else {
      this.tracks[track].data[time] = [
        { type: 'note', note: note, velocity: velocity, length: length }
      ]
    }
  }
  previewNoteHit (track, note, velocity) {
    this.sendNote(track, performance.now(), note, velocity, 1)
  }
  previewNote (track, note, velocity) {
    this.system.sendChannelMessage(
      track,
      [144, note, velocity]
    )
  }
  previewNoteOff (track, note) {
    this.system.sendChannelMessage(
      track,
      [128, note, 0]
    )
  }
  recordNoteOn (track, note, velocity) {
    console.log('RNOn', track, note, velocity)
    if (!this.recording || !this.playing) { return }
    this.openNotes.push([this.realTick, track, note, velocity])
  }
  recordNoteOff (track, note) {
    if (!this.recording || !this.playing) { return }
    const openNote = this.openNotes.find((n) => {
      return n[1] === track && n[2] === note
    })
    if (openNote) {
      this.openNotes = this.openNotes.filter((n) => {
        console.log('ff', n[1], track, n[2], note)
        return n[1] !== track || n[2] !== note
      })

      const offTime = this.realTick
      const onRounded = Math.round(openNote[0] / 24)
      var offRounded = Math.round(offTime / 24)
      if (offRounded < onRounded) {
        offRounded += 256
      }
      const length = Math.max(1, offRounded - onRounded) * 24
      console.log('RNOFF', onRounded, offRounded, length, this.openNotes.length)
      const stepInPattern = onRounded % (this.tracks[track].length * 16)
      const time = (this.tracks[track].firstPattern * 16 + stepInPattern) * 24
      this.addNote(track, time, openNote[2], openNote[3], length)
    }
  }
  setPatternChain (channel, min, max) {
    this.tracks[channel].firstPattern = min
    this.tracks[channel].length = max - min + 1
  }
  deletePattern (channel, pattern) {
    const start = pattern * 16 * 24
    var i
    for (i = 0; i < (16 * 24); i++) {
      this.tracks[channel].data[i + start] = null
    }
  }
  deleteStep (channel, pattern, step) {
    console.log('DELETE', channel, pattern, step)
    const slot = (pattern * 16 + step) * 24
    this.tracks[channel].data[slot] = null
  }
  // this deletes all occurences of a specific note from the whole pattern
  deleteNote (channel, pattern, note) {
    const start = pattern * 16 * 24
    var i
    for (i = 0; i < (16 * 24); i++) {
      if (this.tracks[channel].data[i + start]) {
        const notes = this.tracks[channel].data[i + start].filter((n) => n.note !== note)
        this.tracks[channel].data[i + start] = notes
      }
    }
  }
  editParam (channel, pattern, note, param, increment) {
    const time = (pattern * 16 + note) * 24
    const notes = this.tracks[channel].data[time]
    if (notes && notes.length > 0) {
      const originalParam = notes[0][param]
      var newParam = originalParam + increment
      if (newParam < PARAM_LIMITS[param][0]) { newParam = PARAM_LIMITS[param][0] }
      if (newParam > PARAM_LIMITS[param][1]) { newParam = PARAM_LIMITS[param][1] }
      const newNotes = notes.map((note) => {
        note[param] = newParam
        return note
      })
      this.tracks[channel].data[time] = newNotes
    }
  }
  editLength (channel, pattern, note, increment) {
    const time = (pattern * 16 + note) * 24
    const notes = this.tracks[channel].data[time]
    if (notes && notes.length > 0) {
      const originalLen = notes[0].length / 24
      var newLen = originalLen + increment
      if (newLen < 1) { newLen = 1 }
      if (newLen > 64) { newLen = 64 }
      const newNotes = notes.map((note) => {
        note.length = newLen * 24
        return note
      })
      this.tracks[channel].data[time] = newNotes
    }
  }
  changeTempo (inc) {
    console.log('CHTMP', inc)
    var newTempo = this.tempo + inc
    if (newTempo > 200) {
      newTempo = 200
    }
    if (newTempo < 30) {
      newTempo = 30
    }
    this.tempo = newTempo
    m.redraw()
  }
}

class Scaler {
  constructor () {
    this.SCALES = SCALES
    this.SCALEMAPS = SCALEMAPS
    this.NOTES = NOTES
    this.OCTAVES = OCTAVES
    this.currentScale = 'min'
    this.currentRootNote = 'C'
    this.currentOctave = 3
  }
  note (row, pos) {
    // TODO: Build chromatic mode
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const noteInRow = map[pos % 7]
    const extraRow = Math.floor(pos / 7)
    const octaveNote = (this.currentOctave + extraRow + row + 1) * 12
    return octaveNote + rootNote + noteInRow
  }
  rowAndPos (note) {
    // TODO: Build chromatic mode
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const octaveNote = (this.currentOctave + 1) * 12
    const baseNote = note - octaveNote - rootNote

    const row = 1 - Math.floor(baseNote / 12)
    const noteInOct = (note - rootNote) % 12
    return [row, map.indexOf(noteInOct)]
  }
  octaveUp () {
    this.currentOctave++
    if (this.currentOctave > 10) { this.currentOctave = 10 }
  }
  octaveDown () {
    this.currentOctave--
    if (this.currentOctave < 0) { this.currentOctave = 0 }
  }
  getConfig () {
    return {
      currentScale: this.currentScale,
      currentRootNote: this.currentRootNote,
      currentOctave: this.currentOctave
    }
  }
  setConfig (config) {
    this.currentScale = config.currentScale || 'min'
    this.currentRootNote = config.currentRootNote || 'C'
    this.currentOctave = config.currentOctave || 3
  }
  editRootNote (inc) {
    const currentIndex = NOTES.indexOf(this.currentRootNote)
    var newIndex = currentIndex + inc
    if (newIndex > (NOTES.length - 1)) {
      newIndex = NOTES.length - 1
    }
    if (newIndex < 0) {
      newIndex = 0
    }
    this.currentRootNote = NOTES[newIndex]
  }
  editScale (inc) {
    const currentIndex = SCALES.indexOf(this.currentScale)
    var newIndex = currentIndex + inc
    if (newIndex > (SCALES.length - 1)) {
      newIndex = SCALES.length - 1
    }
    if (newIndex < 0) {
      newIndex = 0
    }
    this.currentScale = SCALES[newIndex]
  }
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
    this.SCALES = SCALES
    this.sequencer = new Sequencer(this, this.channels.length)
    this.matrixView = new MatrixView(this, this.sequencer)
    this.soloChannel = null

    this.sequencer.tracks[0].data[0] = [{
      type: 'note',
      note: 48,
      length: 6, // four quarter notes
      velocity: 100
    }, {
      type: 'note',
      note: 60 + 3,
      length: 24, // four quarter notes
      velocity: 100
    }, {
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
    this.setupPushBindings()
    this.load()
    this.initPushState()
  }
  initPushState () {
    this.pushDriver.setChannel(this.matrixView.selectedChannel)
  }
  setupChannels () {
    let i
    this.channels = []
    for (i = 0; i < NUM_CHANNELS; i++) {
      this.channels[i] = new Channel(DEFAULT_CHANNEL_CONFIG, this)
    }
  }
  setupListeners () {
    this.onMIDIMessage = this.onMIDIMessage.bind(this)
    Object.keys(this.inputs).forEach((key) => {
      this.setupDeviceListener(this.inputs[key])
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
    // console.log(channel, data, deviceName)
  }
  sendChannelMessage (track, data, time) {
    if (this.channels[track].muted) { return }
    if (this.soloChannel != null && this.soloChannel !== track) { return }
    data[0] = data[0] | this.channels[track].outputChannel
    if (this.outputs[this.channels[track].outputDevice]) {
      this.outputs[this.channels[track].outputDevice].send(data, time)
    }
  }
  setupPushBindings () {
    this.pushDriver.on('push:function:on', (fun, ...params) => {
      if (fun === 'octave') {
        if (params[0] === 'up') {
          this.scaler.octaveUp()
          m.redraw()
        }
        if (params[0] === 'down') {
          this.scaler.octaveDown()
          m.redraw()
        }
      } else if (fun === 'save') {
        this.save()
      }
    })
    this.pushDriver.on('push:channel:on', (channel) => {
      this.matrixView.selectedChannel = channel
      m.redraw()
      this.pushDriver.setChannel(channel)
    })
    this.pushDriver.on('push:play', (channel) => {
      this.sequencer.playPause()
      m.redraw()
    })
  }
  // TODO: Implement a real save.
  save () {
    const { app } = require('electron').remote
    const path = require('path')
    const userDataPath = app.getPath('userData')
    const fs = require('fs')
    const fullPath = path.join(userDataPath, 'settings.json')
    console.log('SAVING TO: ', fullPath)
    // gather data
    const data = {
      patterns: this.sequencer.tracks,
      channels: this.channels.map((ch) => ch.getConfig()),
      scaler: this.scaler.getConfig(),
      settings: {
        tempo: this.sequencer.tempo,
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
  }
  load () {
    const { app } = require('electron').remote
    const path = require('path')
    const userDataPath = app.getPath('userData')
    const fs = require('fs')
    const fullPath = path.join(userDataPath, 'settings.json')
    console.log('Loading from: ', fullPath)

    fs.readFile(fullPath, 'utf8', (err, data) => {
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
        if (parsed.settings) {
          this.sequencer.tempo = parsed.settings.tempo || 120
          this.matrixView.accent = !!parsed.settings.accent
        }
      }
    })
  }
}

const COLOR_NAMES = {
  pattern: 'red',
  selectedPattern: 'light-red',
  step: 'green',
  selectedStep: 'light-green',
  activeStep: 'white',
  note: 'blue',
  rootNote: 'cyan',
  selectedNote: 'light-blue',
  selectedRootNote: 'light-cyan'
}

function maxInSet (set) {
  var max = 0
  set.forEach((entry) => { max = (entry > max) ? entry : max })
  return max
}
function minInSet (set) {
  var min = maxInSet(set)
  set.forEach((entry) => { min = (entry < min) ? entry : min })
  return min
}

class MatrixView {
  constructor (system, sequencer) {
    this.system = system
    this.sequencer = sequencer
    this.leds = []
    for (var i = 0; i < 64; i++) { this.leds.push('off') }
    this.selectedChannel = 0
    this.selectedPattern = 0
    this.selectedNote = null
    this.editNote = null
    this.noteOffset = 48
    this.selectedDrum = 0
    this.selectedPatterns = new Set()
    this.selectMode = false
    this.deleteMode = false
    this.muteMode = false
    this.accent = false
    this.system.pushDriver.on('push:matrix:on', (led, velocity) => {
      this.ledClick(led, velocity)
      if (led < 16) {
        if (this.selectMode) {
          this.selectedPattern = led
        } else if (this.deleteMode) {
          this.sequencer.deletePattern(this.selectedChannel, led)
        } else {
          this.selectedPatterns.add(led)
          const max = maxInSet(this.selectedPatterns)
          const min = minInSet(this.selectedPatterns)
          this.sequencer.setPatternChain(this.selectedChannel, min, max)
          this.selectedPattern = min
        }
        m.redraw()
      }
      if (led >= 16 && led < 48) {
        if (this.editNote === null) {
          this.editNote = led - 16
        }
      }
    })
    this.system.pushDriver.on('push:matrix:off', (led, velocity) => {
      this.ledOff(led)
      if (led < 16) {
        this.selectedPatterns.delete(led)
      }
      if (led >= 16 && led < 48) {
        if (this.editNote === led - 16) {
          this.editNote = null
        }
      }
    })
    this.system.pushDriver.on('push:function:on', (fun) => {
      if (fun === 'select') {
        this.selectMode = true
      }
      if (fun === 'delete') {
        this.deleteMode = true
      }
      if (fun === 'accent') {
        this.accent = !this.accent
        m.redraw()
      }
      if (fun === 'scale') {
        this.scaleMode = true
      }
      if (fun === 'mute') {
        this.muteMode = true
        m.redraw()
      }
      if (fun === 'solo') {
        this.soloMode = true
        m.redraw()
      }
      if (fun === 'record') {
        this.system.sequencer.recording = !this.system.sequencer.recording
        m.redraw()
      }
    })
    this.system.pushDriver.on('push:function:off', (fun) => {
      if (fun === 'select') {
        this.selectMode = false
      }
      if (fun === 'delete') {
        this.deleteMode = false
      }
      if (fun === 'scale') {
        this.scaleMode = false
      }
      if (fun === 'mute') {
        this.muteMode = false
        m.redraw()
      }
      if (fun === 'solo') {
        this.soloMode = false
        m.redraw()
      }
    })
    this.system.pushDriver.on('push:encoder', (encoder, increment) => {
      if (this.editNote != null) {
        if (encoder === 0) {
          this.sequencer.editLength(this.selectedChannel, this.selectedPattern, this.editNote, increment)
        } else if (encoder === 1) {
          this.sequencer.editParam(this.selectedChannel, this.selectedPattern, this.editNote, 'velocity', increment)
        }
      } else if (this.scaleMode) {
        if (encoder === 0) {
          this.system.scaler.editRootNote(increment)
        } else if (encoder === 1) {
          this.system.scaler.editScale(increment)
        }
      }
    })
    this.system.pushDriver.on('push:tempo', (increment) => {
      this.sequencer.changeTempo(increment)
    })
    this.system.pushDriver.on('push:mute-solo', (channel) => {
      if (this.muteMode) {
        this.system.channels[channel].muted = !this.system.channels[channel].muted
      } else if (this.soloMode) {
        if (this.system.soloChannel === channel) {
          this.system.soloChannel = null
        } else {
          this.system.soloChannel = channel
        }
      }

      m.redraw()
    })
  }
  refreshLeds () {
    var i
    for (i = 0; i < 64; i++) {
      this.leds[i] = 'off'
    }
    const track = this.sequencer.tracks[this.selectedChannel]
    // active patterns
    const lastPattern = track.firstPattern + track.length
    for (i = track.firstPattern; i < lastPattern; i++) {
      this.leds[i] = COLOR_NAMES.pattern
    }
    this.leds[this.selectedPattern] = COLOR_NAMES.selectedPattern

    if (this.system.channels[this.selectedChannel].sequencerMode === 'notes') {
      this.refreshForNotesSequencer()
    } else {
      this.refreshForDrumsSequencer(this.system.channels[this.selectedChannel].sequencerMode)
    }
    this.system.pushDriver.setAccent(this.accent)
    this.system.pushDriver.setPlaying(this.sequencer.playing)
    this.system.pushDriver.setRecording(this.sequencer.recording)

    if (this.muteMode) {
      this.system.pushDriver.refreshMutes(this.system.channels)
    } else if (this.soloMode) {
      this.system.pushDriver.refreshSolo(this.system.soloChannel)
    } else {
      this.system.pushDriver.noMutes()
    }
  }
  refreshForNotesSequencer () {
    var i
    const track = this.sequencer.tracks[this.selectedChannel]
    // steps
    for (i = 0; i < 32; i++) {
      if (track.data[24 * (i + (this.selectedPattern * 16))] && track.data[24 * (i + (this.selectedPattern * 16))].length > 0) {
        this.leds[16 + i] = COLOR_NAMES.step
      }
      const stepInPattern = this.sequencer.realStep % (this.sequencer.tracks[this.selectedChannel].length * 16)
      const firstPattern = this.sequencer.tracks[this.selectedChannel].firstPattern
      if (this.sequencer.playing && (i + ((this.selectedPattern - firstPattern) * 16)) === stepInPattern) {
        this.leds[16 + i] = COLOR_NAMES.activeStep
      }
    }
    if (this.selectedNote != null) {
      this.leds[16 + this.selectedNote] = COLOR_NAMES.selectedStep
    }

    // notes
    for (i = 0; i < 16; i++) {
      if (i % 8 === 0 || i % 8 === 7) {
        this.leds[48 + i] = COLOR_NAMES.rootNote
      } else {
        this.leds[48 + i] = COLOR_NAMES.note
      }
    }
    if (this.selectedNote != null && track.data[24 * (this.selectedNote + (this.selectedPattern * 16))]) {
      const notes = track.data[24 * (this.selectedNote + (this.selectedPattern * 16))]
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
  refreshForDrumsSequencer (mode) {
    var i
    const track = this.sequencer.tracks[this.selectedChannel]
    for (i = 0; i < 32; i++) {
      const notes = track.data[24 * (i + (this.selectedPattern * 16))]
      if (notes != null) {
        notes.forEach((note) => {
          if (note.note === this.noteForSelectedDrum()) {
            this.leds[16 + i] = COLOR_NAMES.selectedStep
          }
        })
      }
      const stepInPattern = this.sequencer.realStep % (this.sequencer.tracks[this.selectedChannel].length * 16)
      const firstPattern = this.sequencer.tracks[this.selectedChannel].firstPattern
      if (this.sequencer.playing && (i + ((this.selectedPattern - firstPattern) * 16)) === stepInPattern) {
        this.leds[16 + i] = COLOR_NAMES.activeStep
      }
    }
    if (mode === 'drums') {
      for (i = 0; i < 16; i++) {
        this.leds[i + 48] = COLOR_NAMES.note
      }
      this.leds[this.selectedDrum + 48] = COLOR_NAMES.selectedNote
    }
  }
  setNote (pos) {
    const color = (pos % 8 === 0 || pos % 8 === 7) ? COLOR_NAMES.selectedRootNote : COLOR_NAMES.selectedNote
    this.leds[pos] = color
  }
  ledState (index) {
    this.refreshLeds()
    this.system.pushDriver.setMatrix(this.leds)
    return this.leds[index]
  }

  ledClick (index, velocity = 100) {
    if (this.accent) { velocity = 100 }
    if (this.system.channels[this.selectedChannel].sequencerMode === 'notes') {
      if (index >= 16 && index < 48) {
        if (this.deleteMode) {
          this.sequencer.deleteStep(this.selectedChannel, this.selectedPattern, index - 16)
        }
        this.selectedNote = index - 16
      }
      if (index >= 48) {
        const row = 1 - Math.floor((index - 48) / 8)
        const pos = index % 8
        const note = this.system.scaler.note(row, pos)
        if (!this.deleteMode) {
          this.sequencer.recordNoteOn(this.selectedChannel, note, velocity)
        }
        if (this.deleteMode) {
          this.sequencer.deleteNote(this.selectedChannel, this.selectedPattern, note)
        } else if (this.selectedNote != null) {
          const time = 24 * (this.selectedNote + (this.selectedPattern * 16))
          if (this.sequencer.toggleNote(this.selectedChannel, time, note, velocity)) {
            this.sequencer.previewNote(this.selectedChannel, note, velocity)
          }
        } else {
          this.sequencer.previewNote(this.selectedChannel, note, velocity)
        }
      }
    } else {
      if (index >= 16 && index < 48) {
        const time = 24 * (index - 16 + (this.selectedPattern * 16))
        const note = this.noteForSelectedDrum()
        if (note != null) {
          if (this.deleteMode) {
            this.sequencer.deleteStep(this.selectedChannel, this.selectedPattern, index - 16)
          } else {
            this.sequencer.toggleNote(this.selectedChannel, time, note, velocity)
          }
        }
      }
      if (index >= 48) {
        var slot = index - 48
        this.selectedDrum = slot
        if (this.deleteMode) {
          this.sequencer.deleteNote(this.selectedChannel, this.selectedPattern, this.noteForSelectedDrum())
        } else if (!this.selectMode) {
          this.sequencer.previewNoteHit(this.selectedChannel, this.noteForSelectedDrum(), velocity)
          this.sequencer.recordNoteOn(this.selectedChannel, this.noteForSelectedDrum(), velocity)
          this.sequencer.recordNoteOff(this.selectedChannel, this.noteForSelectedDrum())
        }
      }
    }
    m.redraw()
  }
  ledOff (index) {
    if (index >= 16 && index < 48 && this.system.channels[this.selectedChannel].sequencerMode === 'notes') {
      if (this.selectedNote === index - 16) {
        this.selectedNote = null
      }
    }
    if (index >= 48) {
      const row = 1 - Math.floor((index - 48) / 8)
      const pos = index % 8
      const note = this.system.scaler.note(row, pos)
      this.sequencer.previewNoteOff(this.selectedChannel, note)
      this.sequencer.recordNoteOff(this.selectedChannel, note)
    }
    m.redraw()
  }
  noteForSelectedDrum () {
    const mode = this.system.channels[this.selectedChannel].sequencerMode
    if (mode === 'drums') {
      return this.selectedDrum + 36
    } else {
      if (this.selectedDrum < DRUM_MODES[mode].length) {
        return DRUM_MODES[mode][this.selectedDrum]
      }
    }
  }
}

navigator.requestMIDIAccess({ sysex: true }).then((access) => {
  const midiSystem = new MIDISystem(access)
  const root = document.getElementById('root')
  m.mount(root, { view: function () { return m(AppComponent, { system: midiSystem }) } })
}).catch((error) => {
  console.error(error)
})
