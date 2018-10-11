const m = require('mithril')

class Select {
  constructor (vnode) {
    this.options = vnode.attrs.options
    this.value = vnode.attrs.value
    this.onchange = vnode.attrs.onchange
    this.nullValue = vnode.attrs.nullValue || 'Any'
  }
  view (vnode) {
    return m('select', { onchange: (event) => this.change(event) }, this.options.map((option) => {
      const optname = option === -1 ? this.nullValue : option
      return m('option', { value: option, selected: vnode.attrs.value && option.toString(10) === vnode.attrs.value.toString(10) }, optname)
    }))
  }
  change (event) {
    if (this.onchange) {
      this.onchange(event.target.value)
    }
  }
}
class MultiSelect extends Select {
  constructor (vnode) {
    super(vnode)
  }
  view (vnode) {
    return m('select', { multiple: true, size: 8, onchange: (event) => this.change(event) }, this.options.map((option) => {
      const optname = option === -1 ? this.nullValue : option
      return m('option', { value: option, selected: vnode.attrs.value.includes(option) }, optname)
    }))
  }
  change (event) {
    if (this.onchange) {
      console.log(Array.from(event.target.selectedOptions))
      this.onchange(Array.prototype.map.call(event.target.selectedOptions, (opt) => opt.value))
    }
  }
}

class ChannelSelector {
  constructor (vnode) {
    this.opts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    this.names = this.opts.map((opt) => opt + 1)
    if (vnode.attrs.showAny) {
      this.opts = [-1].concat(this.opts)
      this.names = ['Any'].concat(this.names)
    }
    this.onchange = vnode.attrs.onchange
  }
  view (vnode) {
    return m('select', { onchange: (event) => this.change(event) }, this.opts.map((option, i) => {
      return m('option', { value: option, selected: option === vnode.attrs.value }, this.names[i])
    }))
  }
  change (event) {
    if (this.onchange) {
      this.onchange(parseInt(event.target.value, 10))
    }
  }
}

class MatrixButton {
  constructor (vnode) {
    this.onclick = vnode.attrs.onclick
    this.index = vnode.attrs.index
  }
  view (vnode) {
    return m('button', { class: `matrix-button matrix-button--${vnode.attrs.ledState}`, onclick: () => { this.onclick(this.index) } })
  }
}

class Matrix {
  constructor (vnode) {
    this.matrixView = vnode.attrs.matrixView
  }
  view (vnode) {
    const nodes = []
    for (var i = 0; i < 64; i++) {
      nodes.push(
        m(MatrixButton, {
          onclick: (index) => this.matrixView.ledClick(index),
          ledState: this.matrixView.ledState(i),
          index: i

        })
      )
    }
    return nodes
  }
}

export default class App {
  constructor (vnode) {
    this.system = vnode.attrs.system
    this.allOutputs = Object.keys(this.system.outputs)
    this.allOutputsPlusAny = [-1].concat(this.allOutputs)
  }
  view () {
    this.system.ui.refreshLeds()

    var system = this.system
    return [
      m('div', [
        m('label', [
          'Sync:',
          m(MultiSelect, { options: this.allOutputsPlusAny, nullValue: 'None', value: system.sequencer.syncOuts, onchange (val) { system.sequencer.syncOuts = val } })
        ])
      ]),
      m('h2', 'Channels'),
      m('div', this.system.channels.map((channel, i) => {
        return m('div', [
          m('button', { class: 'channel-name', onclick: (e) => { this.system.ui.selectChannel(i);e.preventDefault(); } }, `${i.toString(16).toUpperCase()}`),
          m(Select, { options: this.allOutputsPlusAny, value: channel.inputDevice, onchange (val) { channel.inputDevice = val } }),
          m(ChannelSelector, { showAny: true, value: channel.inputChannel, onchange (val) { channel.inputChannel = val } }),
          ' > ',
          m(Select, { options: Object.keys(this.system.outputs), channel: channel, onchange (val) { channel.outputDevice = val } }),
          m(ChannelSelector, { value: channel.outputChannel, onchange (val) { channel.outputChannel = val } }),
          ' | ',
          m(Select, { value: channel.sequencerMode, options: ['notes', 'drums', 'drums-circuit', 'drums-volca'], onchange (val) { channel.sequencerMode = val } })
        ])
      })),
      m('h2', 'Matrix'),
      m('div', { class: 'cf' }, m('div', { class: 'matrix' }, m(Matrix, { matrixView: this.system.matrixView }))),

      m('h2', 'Scale'),
      m('div', [
        m('label', [
          ' Scale: ',
          m(Select, { options: this.system.scaler.SCALES, value: this.system.scaler.currentScale, onchange: (val) => { this.system.scaler.currentScale = val } }),
          ' Note: ',
          m(Select, { options: this.system.scaler.NOTES, value: this.system.scaler.currentRootNote, onchange: (val) => { this.system.scaler.currentRootNote = val } }),
          ' Oct: ',
          m(Select, { options: this.system.scaler.OCTAVES, value: this.system.scaler.currentOctave, onchange: (val) => { this.system.scaler.currentOctave = val } })
        ])
      ])
    ]
  }
}
