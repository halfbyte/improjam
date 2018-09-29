const { initPush, sendFrame } = require('ableton-push-canvas-display')

export default class PushDisplay {
  constructor() {
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
  initDisplay() {
    this.ctx.clearRect(0,0,960, 160)
    this.ctx.fillStyle = "rgba(255,255,255,0.8)"
    this.ctx.fillText("Hello", 10, 10)
  }
  updateDisplay() {
    const frame = this.frame
    const ctx = this.ctx
    ctx.lineCap = "round"
    ctx.clearRect(0,0,960, 160)
    ctx.fillStyle = "rgba(0,0,0,1)"
    ctx.strokeStyle = "#fff"
    ctx.fillRect(0, 0, 960, 160)
    ctx.beginPath()
    ctx.moveTo(80, 80)
    // ctx.lineTo(80,80)
    ctx.arc(80, 80, 40, 0, (frame / 4.0) % (2*3.14))
    ctx.fillStyle = "rgba(255,255,255, 0.4)"
    ctx.lineWidth = 4
    ctx.lineTo(80, 80)
    ctx.stroke()
    ctx.fill()
    ctx.font = '48px sans-serif'
    ctx.fillText("Hello", 10, 48)

  }
  displayLoop() {
    this.updateDisplay()
    sendFrame(this.ctx, (error) => {
      if (error) { console.log(error) }
    })
    this.frame++
    requestAnimationFrame(this.displayLoop)
  }
}