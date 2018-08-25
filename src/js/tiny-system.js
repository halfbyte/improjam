function enumerate(devices) {
  const hash = {}
  devices.forEach((device) => {
    hash[device.name] = device
  })
  return hash
}

const ANY = -1

const DEFAULT_CHANNEL_CONFIG = {
  outputDevice: 'IAC-Treiber Bus 1',
  inputDevice: ANY,
  outputChannel: 0,
  inputChannel: ANY
}

class Channel {
  constructor(config, system) {
    this.system = system;
    this.outputDevice = config.outputDevice
    this.inputDevice = config.inputDevice
    this.inputChannel = config.inputChannel
    this.outputChannel = config.outputChannel
    this.setupListeners()
  }
  setupListeners() {
    this.onmidimessage = this.onmidimessage.bind(this)
    this.attachListeners()
  }
  attachListeners() {
    this.system.remove(this.onmidimessage)
    if (this.inputDevice === ANY) {      
      this.system.on('all-devices-message', this.onmidimessage)
    } else {
      this.system.on(`device-message.${this.inputDevice}`, this.onmidimessage)
    }
  }
  onmidimessage(data, deviceName) {
    if (this.inputChannel === ANY) {
      this.system.channelMessage(this, data, deviceName)
    } else {
      const channel = data[0] & 0x0F
      if (this.inputChannel === channel) {
        this.system.channelMessage(this, data, deviceName)
      }
    }
  }
}

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

class Sequencer {
  constructor(system, numChannels) {
    let i;
    this.system = system
    this.tracks = []
    for(i=0;i<numChannels;i++) {
      this.tracks[i] = {
        // pattern to start at
        firstPattern: 0,
        // pattern to end with
        length: 1,
        // actual pattern data.
        data: [] 
      }
    }
    this.tempo = 120
    this.playing = false
    this.scheduleNextNotes = this.scheduleNextNotes.bind(this)
    this.tickWorker = new Worker('js/tick-worker.js')
    this.tickWorker.onmessage = this.scheduleNextNotes
  }
  start() {
    this.playing = true
    this.timerOffset = performance.now()
    this.nextTime = 0
    this.tick = 0
    this.scheduleNextNotes()
  }
  scheduleNextNotes() {
    let i, t;
    const numTracks = this.tracks.length;
    const currentTime = performance.now()

    const perTick = 60 / (this.tempo * 24 * 4) * 1000
    const perLoop = perTick * (256*24)
    const offsetInLoop = currentTime - this.timerOffset % perLoop
    const tickInLoop = Math.floor(offsetInLoop / perTick)
  
    if (currentTime > this.nextTime - (perTick * 4)) {
      for(i=0;i<48;i++) {
        const time = this.nextTime + (perTick * 4)
        for(t=0;t<numTracks;t++) {
          const track = this.tracks[t]
          const trackOffset = track.firstPattern * (16*24)
          const trackLength = track.length * 16 * 24
          const tick = ((this.tick + i) % trackLength) + trackOffset
          if (track.data[tick]) {
            track.data[tick].forEach((event) => {
              if (event.type === 'note') {
                console.log(time, this.tick + i, tick)
                this.sendNote(t, time, event.note, event.velocity, event.length * perTick)
              }  
            })
            const event = track.data[tick]
          }
        }
    
      }
      console.log("STARTING AT", this.tick, i, this.tick / (16*24))    
      this.tick += i
      this.nextTime += (perTick * 48)
      if (this.tick >= (256*24)) { this.tick = 0 }
    }
    this.tickWorker.postMessage('request-tick')
    //setTimeout(this.scheduleNextNotes, 10)
  }
  sendNote(track, time, note, velocity, length) {
    this.system.sendChannelMessage(
      track, 
      [144, note, velocity],
      time
    )
    this.system.sendChannelMessage(
      track, 
      [128, note, velocity],
      time + length
    )
  }
}

class MIDISystem extends Eventable {
  constructor(midiAccess) {
    super()
    this.inputs = enumerate(midiAccess.inputs)
    this.outputs = enumerate(midiAccess.outputs)
    this.setupChannels()
    this.setupListeners()
    this.sequencer = new Sequencer(this, this.channels.length)
    this.sequencer.tracks[0].data[0] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    },{
      type: 'note',
      note: 48 + 3,
      length: 24, // four quarter notes
      velocity: 100
    },{
      type: 'note',
      note: 48 + 7,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[96] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.tracks[0].data[192] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.start()
    this.sequencer.tracks[0].data[288] = [{
      type: 'note',
      note: 48,
      length: 24, // four quarter notes
      velocity: 100
    }]
    this.sequencer.start()
  }
  setupChannels() {
    let i;
    this.channels = []
    for(i=0;i<16;i++) {
      this.channels[i] = new Channel(DEFAULT_CHANNEL_CONFIG, this)
    }
  }
  setupListeners() {
    this.onMIDIMessage = this.onMIDIMessage.bind(this)
    Object.keys(this.inputs).forEach((key) => {
      this.setupDeviceListener(this.inputs[key])      
    })
  }
  setupDeviceListener(device) {
    device.onmidimessage = this.onMIDIMessage
  }
  onMIDIMessage(event) {
    this.trigger('all-devices-message', event.data, event.target.name)
    this.trigger(`device-message.${event.target.name}`, event.data, event.target.name)
  }
  channelMessage(channel, data, deviceName) {
    // do nothing right now
  }
  sendChannelMessage(track, data, time) {
    this.outputs[this.channels[track].outputDevice].send(data, time)
  }
}

navigator.requestMIDIAccess().then((access) => {
  const midiSystem = new MIDISystem(access)
}).catch( (error) => {
  console.error(error)
})