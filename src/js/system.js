import UI from './ui.js'

const ANY = -1

const DEFAULT_CHANNEL_CONFIG = {
  outputDevice: 'IAC-Treiber Bus 1',
  inputDevice: ANY,
  outputChannel: 0,
  inputChannel: ANY
}


class System {
  constructor() {
    let i;
    this.seqEngine = new Worker('./js/seq-engine.js')
    this.channelConfigs = []
    for(i=0;i<16;i++) {
      this.channelConfigs.push(DEFAULT_CHANNEL_CONFIG)
    }
    console.log(this.channelConfigs);
    this.seqEngine.onmessage = (event) => {
      if (event.data.type === 'send-midi') {
        event.data.midiData.forEach((data) => {
          const msg = this.setOutputChannelForChannel(data.msg)
          this.getOutputDeviceForChannel(data.channel).send(msg, data.time)
        })
      }
    }
  }
  getOutputDevice
}

const system = new System()
const ui = new UI(system)
