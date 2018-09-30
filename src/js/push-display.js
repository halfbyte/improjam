/* global requestAnimationFrame */
const { initPush, sendFrame } = require('ableton-push-canvas-display')

export default class PushDisplay {
  constructor (system) {
    this.system = system
    this.canvas = document.getElementById('push-display-canvas')
    this.ctx = this.canvas.getContext('2d')
    initPush((err) => {
      if (err) {
        console.error('Error while initializing push', err)
      }
    })
    this.initDisplay()
    this.displayLoop = this.displayLoop.bind(this)
    this.displayLoop()
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
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillText('improjam', 480, 144)

    ctx.font = "16px 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    ctx.fillStyle = '#ccc'
    ctx.textAlign = 'center'
    for (var i = 0; i < 8; i++) {
      if (this.system.matrixView && this.system.matrixView.selectedChannel === i) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(i * 120 + 5, 0, 110, 25)
      } else {
        ctx.fillStyle = '#ccc'
        ctx.fillRect(i * 120 + 5, 0, 110, 20)
      }
      ctx.fillStyle = '#000'
      ctx.fillText(`${i + 1}`, i * 120 + 60, 17)
    }
  }
  displayLoop () {
    this.updateDisplay()
    sendFrame(this.ctx, (error) => {
      if (error) { console.error('sendFrame Error', error) }
      this.frame++
      requestAnimationFrame(this.displayLoop)
    })
  }
}
