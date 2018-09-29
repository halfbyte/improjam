export default 
class Eventable {
  constructor() {
    this.listeners = {}
  }
  on(event, callback) {
    if (this.listeners[event] == null) {
      this.listeners[event] = new Set()
    }
    this.listeners[event].add(callback)
  }
  off(event, callback) {
    this.listeners[event].delete(callback)
  }
  /* Remove all instances of this callback */
  remove(callback) {
    Object.keys(this.listeners).forEach((key) => {
      if (this.listeners[key] && this.listeners[key].size > 0) {
        this.listeners[key].delete(callback)
      }
    })
  }
  trigger(event, ...data) {
    if (this.listeners[event] && this.listeners[event].size > 0) {
      this.listeners[event].forEach((callback) => {
        callback(...data)
      })
    }
  }
}