/* eslint-env browser */
import { maxInSet, minInSet } from './in-set.js'
const m = require('mithril')

const REPEAT_MODE = [24 * 4, 18 * 4, 12 * 4, 9 * 4, 6 * 4, 18, 12, 9]

const COLOR_NAMES = {
  pattern: 'red',
  selectedPattern: 'light-red',
  step: 'green',
  selectedStep: 'light-green',
  activeStep: 'white',
  note: 'blue',
  rootNote: 'cyan',
  selectedNote: 'light-blue',
  selectedRootNote: 'light-cyan',
  activeNote: 'white'
}

const DRUM_MODES = {
  'drums-circuit': [60, 62, 64, 65],
  'drums-volca': []
}

export default class UI {
  constructor (system, sequencer) {
    this.system = system
    this.sequencer = sequencer
    this.leds = []
    this.reset()
    for (var i = 0; i < 64; i++) { this.leds.push('off') }
    this.system.pushDriver.on('push:matrix:on', (led, velocity) => {
      this.ledClick(led, velocity)
      if (led < 16) {
        if (this.selectMode) {
          this.selectedPattern[this.selectedChannel] = led
        } else if (this.copyMode) {
          if (!this.copySource) {
            this.copySource = [this.selectedChannel, led]
          } else {
            // just for display
            this.copyDest = [this.selectedChannel, led]
            this.sequencer.copyPattern(this.copySource, [this.selectedChannel, led])
          }
        } else if (this.deleteMode) {
          this.deletedPattern = [this.selectedChannel, led]
          this.sequencer.deletePattern(this.selectedChannel, led)
        } else {
          this.selectedPatterns.add(led)
          const max = maxInSet(this.selectedPatterns)
          const min = minInSet(this.selectedPatterns)
          this.sequencer.setPatternChain(this.selectedChannel, min, max)
          this.selectedPattern[this.selectedChannel] = min
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
    this.system.pushDriver.on('push:function:on', (fun, ...params) => {
      if (fun === 'select') {
        this.selectMode = true
      }
      if (fun === 'delete') {
        this.deletedPattern = null
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
      if (fun === 'octave') {
        if (params[0] === 'up') {
          console.log(this.editNote)
          if (this.editNote != null) {
            this.system.sequencer.editOctave(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.editNote, 1)
          } else {
            this.system.scaler.octaveUp()
          }
          m.redraw()
        }
        if (params[0] === 'down') {
          if (this.editNote != null) {
            this.system.sequencer.editOctave(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.editNote, -1)
          } else {
            this.system.scaler.octaveDown()
          }
          m.redraw()
        }
      }
      if (fun === 'automate') {
        this.controllerMode = !this.controllerMode
        this.system.pushDriver.setAutomate(this.controllerMode, this.system.recording)
      }
      if (fun === 'duplicate') {
        this.copyMode = true
        this.copySource = null
        this.copyDest = null
      }
      if (fun === 'user') {
        this.system.save()
      }
      if (fun === 'play') {
        this.system.sequencer.playPause()
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
      if (fun === 'duplicate') {
        this.copyMode = false
      }
    })
    this.system.pushDriver.on('push:repeat:on', (repeat) => {
      this.sequencer.setRepeat(this.selectedChannel, REPEAT_MODE[repeat])
      this.repeat = repeat
    })
    this.system.pushDriver.on('push:repeat:off', (repeat) => {
      this.sequencer.clearRepeat()
      this.repeat = null
    })
    this.system.pushDriver.on('push:pressure', (velocity) => {
      this.sequencer.setRepeatPressure(velocity)
    })
    this.system.pushDriver.on('push:pitchbend', (data) => {
      this.sequencer.sendPitchBend(this.selectedChannel, data)
    })
    this.system.pushDriver.on('push:encoder', (encoder, increment) => {
      if (this.editNote != null) {
        if (encoder === 0) {
          this.sequencer.editParam(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.editNote, this.noteForSelectedDrum(), 'length', this.slowIncrement(encoder, increment, 8))
        } else if (encoder === 1) {
          this.sequencer.editParam(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.editNote, this.noteForSelectedDrum(), 'velocity', this.slowIncrement(encoder, increment, 2))
        } else if (encoder === 2) {
          this.sequencer.editParam(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.editNote, this.noteForSelectedDrum(), 'nudge', this.slowIncrement(encoder, increment, 8))
        } else if (encoder === 3) {
          this.sequencer.editParam(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.editNote, this.noteForSelectedDrum(), 'repeat', this.slowIncrement(encoder, increment, 32))
        }
      } else if (this.scaleMode) {
        if (encoder === 0) {
          this.system.scaler.editRootNote(this.slowIncrement(encoder, increment, 16))
        } else if (encoder === 1) {
          this.system.scaler.editScale(this.slowIncrement(encoder, increment, 16))
        }
      } else if (this.controllerMode) {
        this.system.sendControl(this.selectedChannel, encoder, increment)
      }
    })
    this.system.pushDriver.on('push:tempo', (increment) => {
      this.sequencer.changeTempo(increment)
    })
    this.system.pushDriver.on('push:swing', (increment) => {
      this.sequencer.changeSwing(increment)
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
    this.system.pushDriver.on('push:channel:on', (channel) => {
      this.selectChannel(channel)
      m.redraw()
    })
  }
  slowIncrement (encoder, increment, factor) {
    const oldValue = Math.floor(this.encoderCache[encoder] / factor)
    this.encoderCache[encoder] += increment
    const newValue = Math.floor(this.encoderCache[encoder] / factor)
    return newValue - oldValue
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
    this.leds[this.selectedPattern[this.selectedChannel]] = COLOR_NAMES.selectedPattern

    if (this.system.channels[this.selectedChannel].sequencerMode === 'notes') {
      this.refreshForNotesSequencer()
    } else {
      this.refreshForDrumsSequencer(this.system.channels[this.selectedChannel].sequencerMode)
    }
    this.system.pushDriver.setMatrix(this.leds)

    this.system.pushDriver.setAccent(this.accent)
    this.system.pushDriver.setPlaying(this.sequencer.playing)
    this.system.pushDriver.setRecording(this.sequencer.recording)
    this.system.pushDriver.setAutomate(this.controllerMode, this.sequencer.recording)

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
      if (track.data[(i + (this.selectedPattern[this.selectedChannel] * 16))] && track.data[(i + (this.selectedPattern[this.selectedChannel] * 16))].length > 0) {
        this.leds[16 + i] = COLOR_NAMES.step
      }
      const stepInPattern = this.sequencer.realStep % (this.sequencer.tracks[this.selectedChannel].length * 16)
      const firstPattern = this.sequencer.tracks[this.selectedChannel].firstPattern
      if (this.sequencer.playing && (i + ((this.selectedPattern[this.selectedChannel] - firstPattern) * 16)) === stepInPattern) {
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
    if (this.system.scaler.currentScale === 'chromatic') {
      this.leds[48] = 'off'
      this.leds[51] = 'off'
      this.leds[55] = 'off'
    }
    if (this.selectedNote != null && track.data[(this.selectedNote + (this.selectedPattern[this.selectedChannel] * 16))]) {
      const notes = track.data[(this.selectedNote + (this.selectedPattern[this.selectedChannel] * 16))]
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
    if (this.sequencer && this.sequencer.playing) {
      const notes = this.sequencer.notesForStep(this.selectedChannel, this.sequencer.realStep)

      if (notes && notes.length > 0) {
        notes.forEach((note) => {
          const [row, pos] = this.system.scaler.rowAndPos(note.note)
          if (pos != null) {
            if (row >= 0 && row <= 1) {
              const led = 48 + (row) * 8 + pos
              this.leds[led] = COLOR_NAMES.activeNote
            }
          }
        })
      }
    }
  }
  refreshForDrumsSequencer (mode) {
    var i
    const track = this.sequencer.tracks[this.selectedChannel]
    for (i = 0; i < 32; i++) {
      const notes = track.data[(i + (this.selectedPattern[this.selectedChannel] * 16))]
      if (notes != null) {
        notes.forEach((note) => {
          if (note.note === this.noteForSelectedDrum()) {
            this.leds[16 + i] = COLOR_NAMES.selectedStep
          }
        })
      }
      const stepInPattern = this.sequencer.realStep % (this.sequencer.tracks[this.selectedChannel].length * 16)
      const firstPattern = this.sequencer.tracks[this.selectedChannel].firstPattern
      if (this.sequencer.playing && (i + ((this.selectedPattern[this.selectedChannel] - firstPattern) * 16)) === stepInPattern) {
        this.leds[16 + i] = COLOR_NAMES.activeStep
      }
    }
    if (mode === 'drums') {
      for (i = 0; i < 16; i++) {
        this.leds[i + 48] = COLOR_NAMES.note
      }
      this.leds[this.selectedDrum + 48] = COLOR_NAMES.selectedNote
      if (this.sequencer && this.sequencer.playing) {
        const notes = this.sequencer.notesForStep(this.selectedChannel, this.sequencer.realStep)

        if (notes && notes.length > 0) {
          notes.forEach((note) => {
            const pad = this.selectedDrumForNote(note.note)
            if (pad != null) {
              this.leds[pad + 48] = COLOR_NAMES.activeNote
            }
          })
        }
      }
    }
  }
  setNote (pos) {
    const color = (pos % 8 === 0 || pos % 8 === 7) ? COLOR_NAMES.selectedRootNote : COLOR_NAMES.selectedNote
    this.leds[pos] = color
  }
  ledState (index) {
    return this.leds[index]
  }

  ledClick (index, velocity = 100) {
    if (this.accent) { velocity = 100 }
    if (this.system.channels[this.selectedChannel].sequencerMode === 'notes') {
      if (index >= 16 && index < 48) {
        if (this.deleteMode) {
          this.sequencer.deleteStep(this.selectedChannel, this.selectedPattern[this.selectedChannel], index - 16)
        }
        this.selectedNote = index - 16
      }
      if (index >= 48) {
        const row = 1 - Math.floor((index - 48) / 8)
        const pos = index % 8
        const note = this.system.scaler.note(row, pos)
        if (note == null) { return }
        if (!this.deleteMode) {
          this.sequencer.recordNoteOn(this.selectedChannel, note, velocity)
        }
        if (this.deleteMode) {
          this.sequencer.deleteNote(this.selectedChannel, this.selectedPattern[this.selectedChannel], note)
        } else if (this.selectedNote != null) {
          const time = (this.selectedNote + (this.selectedPattern[this.selectedChannel] * 16))
          if (this.sequencer.toggleNote(this.selectedChannel, time, note, velocity)) {
            this.sequencer.previewNote(this.selectedChannel, note, velocity)
          }
        } else {
          this.sequencer.previewNote(this.selectedChannel, note, velocity)
        }
      }
    } else {
      if (index >= 16 && index < 48) {
        const note = this.noteForSelectedDrum()
        if (note != null) {
          if (this.deleteMode) {
            this.sequencer.deleteStep(this.selectedChannel, this.selectedPattern[this.selectedChannel], index - 16)
          } else {
            this.noteEditDelay = performance.now()
            this.savedVelocity = velocity
          }
        }
      }
      if (index >= 48) {
        var slot = index - 48
        this.selectedDrum = slot
        if (this.deleteMode) {
          this.sequencer.deleteNote(this.selectedChannel, this.selectedPattern[this.selectedChannel], this.noteForSelectedDrum())
        } else if (!this.selectMode) {
          this.sequencer.previewNote(this.selectedChannel, this.noteForSelectedDrum(slot), velocity)
          this.sequencer.recordNoteOn(this.selectedChannel, this.noteForSelectedDrum(slot), velocity)
        }
      }
    }
    m.redraw()
  }
  ledOff (index) {
    if (this.system.channels[this.selectedChannel].sequencerMode === 'notes') {
      if (index >= 16 && index < 48) {
        if (this.selectedNote === index - 16) {
          this.selectedNote = null
        }
      }
      if (index >= 48) {
        const row = 1 - Math.floor((index - 48) / 8)
        const pos = index % 8
        const note = this.system.scaler.note(row, pos)
        if (note == null) { return }
        this.sequencer.previewNoteOff(this.selectedChannel, note)
        this.sequencer.recordNoteOff(this.selectedChannel, note)
      }
    } else {
      if (index >= 48) {
        const slot = index - 48
        this.sequencer.previewNoteOff(this.selectedChannel, this.noteForSelectedDrum(slot))
        this.sequencer.recordNoteOff(this.selectedChannel, this.noteForSelectedDrum(slot))
      }
      if (performance.now() - this.noteEditDelay < 300) {
        const time = (index - 16 + (this.selectedPattern[this.selectedChannel] * 16))
        const note = this.noteForSelectedDrum()
        this.sequencer.toggleNote(this.selectedChannel, time, note, this.savedVelocity)
      }
    }
    m.redraw()
  }
  noteForSelectedDrum (drum = null) {
    if (drum == null) {
      drum = this.selectedDrum
    }
    const mode = this.system.channels[this.selectedChannel].sequencerMode
    if (mode === 'drums') {
      const row = Math.floor(drum / 8)
      const col = drum % 8
      const pad = (1 - row) * 8 + col
      return pad + this.system.scaler.currentOctave * 12
    } else {
      if (DRUM_MODES[mode] && drum < DRUM_MODES[mode].length) {
        return DRUM_MODES[mode][drum]
      }
    }
  }
  selectedDrumForNote (note) {
    const mode = this.system.channels[this.selectedChannel].sequencerMode
    if (mode === 'drums') {
      const pad = note - (this.system.scaler.currentOctave * 12)
      if (pad < 0 || pad > 15) { return null }
      const row = 1 - Math.floor(pad / 8)
      const col = pad % 8
      return row * 8 + col
    } else {
      return 0
    }
  }

  selectChannel (ch) {
    ch = parseInt(ch, 10)
    this.selectedOctave[this.selectedChannel] = this.system.scaler.currentOctave
    this.selectedChannel = ch
    this.system.scaler.currentOctave = this.selectedOctave[this.selectedChannel]
    this.system.pushDriver.setChannel(ch)
  }

  reset () {
    this.selectedChannel = 0
    this.selectedPattern = [0, 0, 0, 0, 0, 0, 0, 0]
    this.selectedOctave = [3, 3, 3, 3, 3, 3, 3, 3]
    this.selectedNote = null
    this.editNote = null
    this.noteOffset = 48
    this.selectedDrum = 0
    this.selectedPatterns = new Set()
    this.selectMode = false
    this.deleteMode = false
    this.muteMode = false
    this.controllerMode = false
    this.copyMode = false
    this.accent = false
    this.encoderCache = [0, 0, 0, 0, 0, 0, 0, 0]
    this.repeat = null
  }
}
