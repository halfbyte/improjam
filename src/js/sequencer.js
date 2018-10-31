/* eslint-env browser */
const m = require('mithril')

const PARAM_LIMITS = {
  length: [1, 64],
  velocity: [1, 127],
  repeat: [1, 4]
}
const PARAM_FACTORS = {
  length: 24,
  velocity: 1,
  repeat: 1
}

const STEPS_TO_SCHEDULE = 48

export default class Sequencer {
  constructor (system, numChannels) {
    this.numChannels = numChannels
    this.system = system
    this.clearTracks()
    this.tempo = 120
    this.swing = 0
    this.playing = false
    this.scheduleNextNotes = this.scheduleNextNotes.bind(this)
    this.tickWorker = new Worker('js/tick-worker.js')
    this.tickWorker.onmessage = this.scheduleNextNotes
    this.realTick = 0
    this.realStep = 0
    this.oldRealStep = 0
    this.openNotes = []
    this.openRepeatNotes = []
    this.syncOuts = []
    this.nextTime = performance.now()
    this.tick = 0
    this.scheduleNextNotes()
  }
  clearTracks () {
    var i
    this.tracks = []
    for (i = 0; i < this.numChannels; i++) {
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
  }

  reset () {
    this.clearTracks()
    this.tempo = 120
    this.swing = 0
    this.stop()
  }

  start () {
    this.playing = true
    this.tick = 0
    this.syncOuts.forEach((so) => this.system.sendStart(so, this.nextTime - 10))
  }
  stop () {
    this.playing = false
    this.syncOuts.forEach((so) => this.system.sendStop(so, this.nextTime))
  }
  playPause () {
    if (this.playing) {
      this.stop()
    } else {
      this.start()
    }
  }
  notesForStep (t, step) {
    const track = this.tracks[t]
    const trackOffset = track.firstPattern * (16 * 24)
    const trackLength = track.length * 16 * 24
    const tick = ((step * 24) % trackLength) + trackOffset
    return track.data[tick]
  }
  scheduleNextNotes () {
    let i, t
    const numTracks = this.tracks.length
    const currentTime = performance.now()

    const perTick = 60 / (this.tempo * 24 * 4) * 1000

    const diff = (this.nextTime - currentTime) / perTick

    if (this.playing) {
      var realTick = Math.floor(this.tick - diff)
      if (realTick < 0) { realTick = 256 * 24 + realTick }
      this.realTick = realTick
      this.realStep = Math.floor(realTick / 24)
      if (this.realStep !== this.oldRealStep) {
        m.redraw()
        this.oldRealStep = this.realStep
      }
    } else {
      this.realStep = 0
      if (this.realStep !== this.oldRealStep) {
        m.redraw()
        this.oldRealStep = this.realStep
      }
    }

    if (currentTime > this.nextTime - (perTick * 4)) {
      for (i = 0; i < STEPS_TO_SCHEDULE; i++) {
        if (i % 4 === 0) {
          this.sendTick(this.nextTime + (perTick * (i)))
        }
        var swingOff = 0
        if ((this.tick + i) % 48 === 24) {
          swingOff = this.swing / 2.0
        }
        const time = this.nextTime + (perTick * (i + swingOff))
        if (this.repeat != null && (this.tick + i) % this.repeat.repeat === 0) {
          this.openRepeatNotes.forEach((noteConfig) => {
            const [channel, note, velocity] = noteConfig
            if (channel === this.repeat.channel) {
              this.sendNote(channel, time, note, velocity, this.repeat.repeat, null, perTick)
            }
          })
        }

        if (this.playing) {
          for (t = 0; t < numTracks; t++) {
            const track = this.tracks[t]
            const trackOffset = track.firstPattern * (16 * 24)
            const trackLength = track.length * 16 * 24
            const tick = ((this.tick + i) % trackLength) + trackOffset
            if (track.data[tick]) {
              track.data[tick].forEach((event) => {
                if (event.type === 'note') {
                  this.sendNote(t, time, event.note, event.velocity, event.length, event.repeat, perTick)
                }
              })
            }
          }
        }
      }
      this.tick += i
      this.nextTime += (perTick * i)
      if (this.tick >= (256 * 24)) { this.tick = 0 }
    }
    this.tickWorker.postMessage('request-tick')
    // setTimeout(this.scheduleNextNotes, 10)
  }
  sendTick (time) {
    this.syncOuts.forEach((so) => this.system.sendSync(so, time))
  }
  sendNote (track, time, note, velocity, length, repeat, perTick) {
    if (repeat == null || repeat <= 1) {
      this.system.sendChannelMessage(
        track,
        [144, note, velocity],
        time
      )
      this.system.sendChannelMessage(
        track,
        [128, note, velocity],
        time + (length * perTick)
      )
    } else {
      const stepLen = 24 * perTick / repeat
      const steps = (length / 24) * repeat
      for (var i = 0; i < steps; i++) {
        this.system.sendChannelMessage(
          track,
          [144, note, velocity],
          time + (i * stepLen)
        )
        this.system.sendChannelMessage(
          track,
          [128, note, velocity],
          time + (i * stepLen) + stepLen
        )
      }
    }
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
          type: 'note', note: note, velocity: velocity, length: length, repeat: 1
        })
        return true
      }
    } else {
      this.tracks[track].data[time] = [
        { type: 'note', note: note, velocity: velocity, length: length, repeat: 1 }
      ]
      return true
    }
  }
  // for realtime recording
  addNote (track, time, note, velocity = 100, length = 24) {
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
        type: 'note', note: note, velocity: velocity, length: length, repeat: 1
      })
    } else {
      this.tracks[track].data[time] = [
        { type: 'note', note: note, velocity: velocity, length: length, repeat: 1 }
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
    this.openRepeatNotes.push([track, note, velocity])
  }
  previewNoteOff (track, note) {
    this.system.sendChannelMessage(
      track,
      [128, note, 0]
    )
    this.openRepeatNotes = this.openRepeatNotes.filter((n) => {
      return n[0] !== track || n[1] !== note
    })
  }
  recordNoteOn (track, note, velocity) {
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
        return n[1] !== track || n[2] !== note
      })

      const offTime = this.realTick
      const onRounded = Math.round(openNote[0] / 24)
      var offRounded = Math.round(offTime / 24)
      if (offRounded < onRounded) {
        offRounded += 256
      }
      const length = Math.max(1, offRounded - onRounded) * 24
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
  copyPattern (src, dest) {
    const [srcChannel, srcPattern] = src
    const [destChannel, destPattern] = dest

    for (var i = 0; i < (16 * 26); i++) {
      this.tracks[destChannel].data[i + (destPattern * 16 * 24)] = this.tracks[srcChannel].data[i + (srcPattern * 16 * 24)]
    }
  }
  deleteStep (channel, pattern, step) {
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
  clampParamToLimits (value, param) {
    if (value < PARAM_LIMITS[param][0]) { value = PARAM_LIMITS[param][0] }
    if (value > PARAM_LIMITS[param][1]) { value = PARAM_LIMITS[param][1] }
    return value
  }
  editParam (channel, pattern, step, drumNote, param, increment) {
    const time = (pattern * 16 + step) * 24
    const notes = this.tracks[channel].data[time]
    if (notes && notes.length > 0) {
      if (drumNote) {
        const foundNote = notes.find((note) => note.note === drumNote)
        const oldParam = (foundNote[param] || PARAM_LIMITS[param][0]) / PARAM_FACTORS[param]
        const newParam = this.clampParamToLimits(oldParam + increment, param)
        const newNotes = notes.map((note) => {
          if (note.note === drumNote) {
            note[param] = newParam * PARAM_FACTORS[param]
          }
          return note
        })
        this.tracks[channel].data[time] = newNotes
      } else {
        const oldParam = (notes[0][param] || PARAM_LIMITS[param][0]) / PARAM_FACTORS[param]
        const newParam = this.clampParamToLimits(oldParam + increment, param)
        const newNotes = notes.map((note) => {
          note[param] = newParam * PARAM_FACTORS[param]
          return note
        })
        this.tracks[channel].data[time] = newNotes
      }
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
  editOctave (channel, pattern, note, increment) {
    const time = (pattern * 16 + note) * 24
    const notes = this.tracks[channel].data[time]
    if (notes && notes.length > 0) {
      const newNotes = notes.map((note) => {
        const newNote = note.note + (increment * 12)
        if (newNote >= 0 || newNote <= 127) {
          note.note = newNote
        }
        return note
      })
      this.tracks[channel].data[time] = newNotes
    }
  }
  changeTempo (inc) {
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
  changeSwing (inc) {
    var newSwing = this.swing + inc
    if (newSwing > 48) {
      newSwing = 48
    }
    if (newSwing < -48) {
      newSwing = -48
    }
    this.swing = newSwing
    m.redraw()
  }
  setRepeat (channel, repeat) {
    this.repeat = { channel: channel, repeat: repeat }
  }
  clearRepeat () {
    this.repeat = null
  }
}
