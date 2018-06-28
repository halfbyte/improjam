import UI from './ui.js'



class System {
  constructor() {
    this.seqEngine = new Worker('./js/seq-engine.js')
  }
}

const system = new System()
const ui = new UI(system)
