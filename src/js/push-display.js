/* global Worker */
const { initPush, sendFrame } = require('ableton-push-canvas-display')

export default class PushDisplay {
  constructor (system) {
    console.log("WH")
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
  updateDisplay () {
    const ctx = this.ctx
    // clear in a way that makes transparency work
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.fillRect(0, 0, 960, 160)
    ctx.font = "bold 200px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(8,8,8,1)'
    ctx.fillText('improjam', 480, 144)

    ctx.font = "16px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    ctx.textAlign = 'start'
    ctx.fillStyle = '#fff'
    if (this.system.sequencer) {
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
      const time = (this.system.matrixView.selectedPattern * 16 + this.system.matrixView.editNote) * 24
      const notes = this.system.sequencer.tracks[this.system.matrixView.selectedChannel].data[time]
      if (notes && notes.length > 0) {
        const note = notes[0] // only display data for first note
        ctx.textAlign = 'center'
        ctx.fillText('Length', 60, 50)
        ctx.fillText(`${note.length / 24}`, 60, 70)
        ctx.fillText('Velocity', 180, 50)
        ctx.fillText(`${note.velocity}`, 180, 70)
      }
    } else if (this.system.matrixView && this.system.matrixView.scaleMode) {
      ctx.textAlign = 'center'
      ctx.fillText('Root Note', 60, 50)
      ctx.fillText(`${this.system.scaler.currentRootNote}`, 60, 70)
      ctx.fillText('Scale', 180, 50)
      ctx.fillText(`${this.system.scaler.currentScale}`, 180, 70)
    } else if (this.system.matrixView && this.system.matrixView.controllerMode) {
      for(var slot=0;slot<8;slot++) {
        const slotValue = this.system.channels[this.system.matrixView.selectedChannel].controlSlots[slot]
        const width = slotValue / 127.0 * 110
        ctx.fillStyle = '#ccc'
        ctx.fillRect(5 + (120 * slot), 30, width, 20)
        ctx.textAlign = 'center'
        ctx.fillStyle = "#fff"
        ctx.fillText(`${slotValue}`, 120 * slot + 60, 47)
      }
    }

    if (this.system.matrixView && this.system.matrixView.selectedNote != null) {
      ctx.textAlign = 'left'
      ctx.fillText(`Step: ${this.system.matrixView.selectedNote}`, 370, 150)
    }



    ctx.fillStyle = '#ccc'
    ctx.textAlign = 'center'
    for (var i = 0; i < 8; i++) {
      if (this.system.matrixView && this.system.matrixView.selectedChannel === i) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(i * 120 + 5, 0, 110, 25)
        ctx.fillStyle = '#000'
        ctx.fillText(`${i + 1}`, i * 120 + 60, 17)
      } else {
        ctx.fillStyle = '#444'
        ctx.fillRect(i * 120 + 5, 0, 110, 20)
        ctx.fillStyle = '#fff'
        ctx.fillText(`${i + 1}`, i * 120 + 60, 17)
      }
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
