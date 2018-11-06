/* global Worker */
const { initPush, sendFrame } = require('ableton-push-canvas-display')

const STANDARD_FONT = "16px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
const MODE_FONT = "italic 48px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
const STEP_FONT = "48px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
const REPEATS = ['1/4', '1/4t', '1/8', '1/8t', '1/16', '1/16t', '1/32', '1/32t']

export default class PushDisplay {
  constructor (system) {
    this.system = system
    this.canvas = document.getElementById('push-display-canvas')
    this.ctx = this.canvas.getContext('2d')
    this.installed = false
    initPush((err) => {
      if (err) {
        this.installed = false
      } else {
        this.installed = true
      }
    })
    this.tickWorker = new Worker('js/tick-worker.js')
    this.initDisplay()
    this.displayLoop = this.displayLoop.bind(this)
    this.displayLoop()
    this.tickWorker.onmessage = this.displayLoop
    this.frame = 0
  }
  initDisplay () {
    this.ctx.clearRect(0, 0, 960, 160)
    this.ctx.fillStyle = 'rgba(255,255,255,0.8)'
    this.ctx.fillText('Hello', 10, 10)
  }
  channelBgColor (selected, muted, solo) {
    if (selected) {
      if (solo) { return '#ff0' }
      if (muted) { return '#f66' }
      return '#fff'
    } else {
      if (solo) { return '#860' }
      if (muted) { return '#800' }
      return '#444'
    }
  }

  updateDisplay () {
    const ctx = this.ctx
    // clear in a way that makes transparency work
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.fillRect(0, 0, 960, 160)
    ctx.font = "bold 200px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(8,8,8,1)'
    ctx.fillText('improjam', 480, 144)

    ctx.font = STANDARD_FONT

    if (this.system.sequencer) {
      const s = this.system.sequencer.realStep % 16
      ctx.fillStyle = 'rgba(128, 128, 128,0.3)'
      ctx.font = STEP_FONT
      ctx.textAlign = 'center'
      ctx.fillRect(0, 150, (s + 1) * 60, 10)
      ctx.fillStyle = '#fff'
      ctx.font = STANDARD_FONT
      ctx.textAlign = 'start'
      ctx.fillText(`Step: ${this.system.sequencer.realStep}`, 10, 150)
      ctx.fillText(`Tempo: ${this.system.sequencer.tempo}`, 250, 150)
      ctx.fillText(`Swing: ${this.system.sequencer.swing}`, 370, 150)
    }
    if (this.system.scaler) {
      ctx.textAlign = 'start'
      ctx.fillStyle = '#fff'
      ctx.fillText(`Octave: ${this.system.scaler.currentOctave}`, 130, 150)
    }
    if (this.system.matrixView && this.system.matrixView.editNote != null) {
      const time = (this.system.matrixView.selectedPattern[this.system.matrixView.selectedChannel] * 16 + this.system.matrixView.editNote)
      const notes = this.system.sequencer.tracks[this.system.matrixView.selectedChannel].data[time]
      if (notes && notes.length > 0) {
        var note = notes[0] // only display data for first note
        if (this.system.matrixView.noteForSelectedDrum()) {
          note = notes.find((n) => n.note === this.system.matrixView.noteForSelectedDrum())
        }
        if (note) {
          ctx.textAlign = 'center'
          ctx.fillText('Length', 60, 50)
          ctx.fillText(`${note.length}`, 60, 70)
          ctx.fillText('Velocity', 180, 50)
          ctx.fillText(`${note.velocity}`, 180, 70)
          ctx.fillText('Nudge', 300, 50)
          ctx.fillText(`${note.nudge || 0}`, 300, 70)
          ctx.fillText('Repeat', 420, 50)
          ctx.fillText(`${note.repeat || 1}`, 420, 70)
          ctx.textAlign = 'left'
          ctx.fillText(`Step: ${this.system.matrixView.selectedNote}`, 850, 150)
        }
      }
    } else if (this.system.matrixView && this.system.matrixView.scaleMode) {
      ctx.textAlign = 'center'
      ctx.fillText('Root Note', 60, 50)
      ctx.fillText(`${this.system.scaler.currentRootNote}`, 60, 70)
      ctx.fillText('Scale', 180, 50)
      ctx.fillText(`${this.system.scaler.currentScale}`, 180, 70)
    } else if (this.system.matrixView && this.system.matrixView.controllerMode) {
      for (var slot = 0; slot < 8; slot++) {
        const slotValue = this.system.channels[this.system.matrixView.selectedChannel].controlSlots[slot]
        const channel = this.system.channels[this.system.matrixView.selectedChannel] // .outputChannel
        const ctrlName = this.system.channels[this.system.matrixView.selectedChannel].ctrlConfig[slot].name
        const width = slotValue / 127.0 * 110
        ctx.fillStyle = '#ccc'
        ctx.fillRect(5 + (120 * slot), 30, width, 20)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#fff'
        ctx.fillText(`${slotValue}`, 120 * slot + 60, 47)
        ctx.fillText(ctrlName, 120 * slot + 60, 67)
      }
    }

    ctx.fillStyle = '#ccc'
    ctx.textAlign = 'center'

    for (var i = 0; i < 8; i++) {
      if (this.system.matrixView && this.system.matrixView.selectedChannel === i) {
        ctx.fillStyle = this.channelBgColor(true, (this.system.channels && this.system.channels[i].muted), this.system.soloChannel === i)
        ctx.fillRect(i * 120 + 5, 0, 110, 25)
        ctx.fillStyle = '#000'
        if (this.system.sequencer && this.system.sequencer.tracks[i].name != null) {
          ctx.fillText(`${this.system.sequencer.tracks[i].name}`, i * 120 + 60, 17)
        } else {
          ctx.fillText(`Track ${i + 1}`, i * 120 + 60, 17)
        }
      } else {
        ctx.fillStyle = this.channelBgColor(false, (this.system.channels && this.system.channels[i].muted), this.system.soloChannel === i)
        ctx.fillRect(i * 120 + 5, 0, 110, 20)
        ctx.fillStyle = '#fff'
        if (this.system.sequencer && this.system.sequencer.tracks[i].name != null) {
          ctx.fillText(`${this.system.sequencer.tracks[i].name}`, i * 120 + 60, 17)
        } else {
          ctx.fillText(`Track ${i + 1}`, i * 120 + 60, 17)
        }
      }
    }

    if (this.system.ui && this.system.ui.copyMode) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#f80'
      var text = 'copy'
      if (this.system.ui.copySource) {
        const src = this.system.ui.copySource
        text += `[${src[0] + 1}:${src[1] + 1}]`
      }
      if (this.system.ui.copyDest) {
        const dest = this.system.ui.copyDest
        text += `>[${dest[0] + 1}:${dest[1] + 1}]`
      }
      ctx.fillText(text, 480, 100)
    } else if (this.system.ui && this.system.ui.deleteMode) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#f00'
      var text = 'delete'
      if (this.system.ui.deletedPattern) {
        const [c, p] = this.system.ui.deletedPattern
        text += `[${c + 1}:${p + 1}]`
      }
      ctx.fillText(text, 480, 100)
    } else if (this.system.ui && this.system.ui.muteMode) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#f00'
      ctx.fillText('mute', 480, 100)
    } else if (this.system.ui && this.system.ui.soloMode) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#ff0'
      ctx.fillText('solo', 480, 100)
    } else if (this.system.ui && this.system.ui.scaleMode) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#fff'
      ctx.fillText('scale', 480, 100)
    } else if (this.system.ui && this.system.ui.selectMode) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#fff'
      ctx.fillText('select', 480, 100)
    } else if (this.system.ui && this.system.ui.repeat) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#fff'
      ctx.fillText('repeat: ' + REPEATS[this.system.ui.repeat], 480, 100)
    } else if (this.system.sequencer && this.system.sequencer.recording) {
      ctx.font = MODE_FONT
      ctx.textAlign = 'left'
      ctx.fillStyle = '#f00'
      ctx.fillText('record!', 480, 100)
    }
  }
  displayLoop () {
    this.updateDisplay()
    if (!this.installed) {
      this.tickWorker.postMessage('request-tick')
      return
    }
    sendFrame(this.ctx, (error) => {
      if (error) { console.error('sendFrame Error', error) }
      this.frame++
      this.tickWorker.postMessage('request-tick')
    })
  }
}
