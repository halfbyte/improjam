const { initPush, sendFrame } = require('ableton-push-canvas-display')

var frame = 0

export default class UI {
  constructor () {
    initPush((err) => {
      if (err) {
        console.error('Error while initializing push', err)
      }
    })
    this.canvas = document.getElementById('push-display-canvas')
    this.ctx = this.canvas.getContext('2d')
    this.updateCanvasUI = this.updateCanvasUI.bind(this)
    this.uiWorker = new Worker('js/ui-worker.js')
    this.uiWorker.onmessage = (event) => {
      if (event.data === 'update-ui') {
        requestAnimationFrame(() => {
          this.updateCanvasUI()
        })
      }
    }
  }
  updateCanvasUI () {
    const ctx = this.ctx
    ctx.lineCap = 'round'
    ctx.clearRect(0, 0, 960, 160)
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.strokeStyle = '#fff'
    ctx.fillRect(0, 0, 960, 160)
    ctx.beginPath()
    ctx.moveTo(80, 80)
    // ctx.lineTo(80,80)
    ctx.arc(80, 80, 40, 0, (frame / 4.0) % (2 * 3.14))
    ctx.fillStyle = 'rgba(255,255,255, 0.4)'
    ctx.lineWidth = 4
    ctx.lineTo(80, 80)
    ctx.stroke()
    ctx.fill()
    sendFrame(ctx, (error) => {
      this.uiWorker.postMessage('frame-sent')
      frame++
    })
  }
}
