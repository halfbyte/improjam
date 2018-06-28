



function updateUI() {
  self.postMessage('update-ui')
}
self.onmessage = function(event) {
  if (event.data === 'frame-sent') {
    updateUI()
  }
}
updateUI();
