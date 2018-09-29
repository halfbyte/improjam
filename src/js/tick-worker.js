/* global self */
self.onmessage = () => {
  setTimeout(() => {
    self.postMessage('tick')
  }, 10)
}
