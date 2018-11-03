const m = require('mithril')

class Select {
  constructor (vnode) {
    this.options = vnode.attrs.options
    this.value = vnode.attrs.value
    this.onchange = vnode.attrs.onchange
    this.nullValue = vnode.attrs.nullValue || 'Any'
  }
  view (vnode) {
    const options = vnode.attrs.options
    return m('select', { onchange: (event) => this.change(event) }, options.map((option) => {
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
  view (vnode) {
    return m('select', { multiple: true, size: 8, onchange: (event) => this.change(event) }, this.options.map((option) => {
      const optname = option === -1 ? this.nullValue : option
      return m('option', { value: option, selected: vnode.attrs.value.includes(option) }, optname)
    }))
  }
  change (event) {
    if (this.onchange) {
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
    const matrixView = vnode.attrs.matrixView
    if (matrixView == null) {
      return []
    }
    const nodes = []
    for (var i = 0; i < 64; i++) {
      nodes.push(
        m(MatrixButton, {
          onclick: (index) => matrixView.ledClick(index),
          ledState: matrixView.ledState(i),
          index: i

        })
      )
    }
    return nodes
  }
}

class Settings {
  constructor (vnode) {
    this.system = vnode.attrs.system
  }
  view (vnode) {
    const system = vnode.attrs.system

    if (!system.settingsOpen) { return [] }
    this.allOutputs = Object.keys(system.outputs)
    this.allOutputsPlusAny = [-1].concat(this.allOutputs)
    return [
      m('div', { class: 'settings' },
        [
          m('h2', [
            'Setttings ',
            m('button', { onclick: () => { system.settingsOpen = false } }, 'Close')
          ]),
          m('h3', 'Sync'),
          m(MultiSelect, { options: this.allOutputsPlusAny, nullValue: 'None', value: system.sequencer.syncOuts, onchange (val) { system.sequencer.syncOuts = val } }),
          m('h3', 'Channels'),
          m('div', system.channels.map((channel, i) => {
            let name = `Track ${i}`
            if (system.sequencer) {
              name = system.sequencer.tracks[i].name || name
            }
            return m('div', [
              // m(Select, { options: this.allOutputsPlusAny, value: channel.inputDevice, onchange (val) { channel.inputDevice = val } }),
              // m(ChannelSelector, { showAny: true, value: channel.inputChannel, onchange (val) { channel.inputChannel = val } }),
              // ' > ',
              m('input', { value: name, onchange (e) { system.sequencer.tracks[i].name = this.value } }),
              m(Select, { options: Object.keys(system.outputs), value: channel.outputDevice, onchange (val) { channel.outputDevice = val } }),
              m(ChannelSelector, { value: channel.outputChannel, onchange (val) { channel.outputChannel = val } }),
              ' | ',
              m(Select, { value: channel.sequencerMode, options: ['notes', 'drums', 'drums-circuit', 'drums-volca'], onchange (val) { channel.sequencerMode = val } })
            ])
          }))
        ]
      )
    ]
  }
}

class TemplateLoader {
  constructor (vnode) {
    this.selectedTemplate = null
    this.system = vnode.attrs.system
  }
  view (vnode) {
    if (vnode.attrs.system.availableTemplates != null) {
      this.selectedTemplate = this.selectedTemplate || vnode.attrs.system.availableTemplates[0]
    }
    const tmpl = vnode.attrs.system.availableTemplates
    return [
      m('label', [
        'Templates: ',
        m(Select, { onchange: (val) => { this.selectedTemplate = val }, options: tmpl, value: this.selectedTemplate })
      ]),
      m('button', { onclick: this.load.bind(this) }, 'Load')
    ]
  }
  load (event) {
    if (this.selectedTemplate != null) {
      this.system.loadTemplate(this.selectedTemplate)
    }
  }
}

export default class App {
  constructor (vnode) {
    this.system = vnode.attrs.system
    this.version = require('electron').remote.app.getVersion()
  }
  view (vnode) {
    if (this.system.ui) { this.system.ui.refreshLeds() }
    const scales = (this.system.scaler != null) ? this.system.scaler.SCALES : []
    const notes = (this.system.scaler != null) ? this.system.scaler.NOTES : []
    const octaves = (this.system.scaler != null) ? this.system.scaler.OCTAVES : []

    const currentScale = this.system.scaler && this.system.scaler.currentScale
    const currentRootNote = this.system.scaler && this.system.scaler.currentRootNote
    const currentOctave = this.system.scaler && this.system.scaler.currentOctave

    var system = vnode.attrs.system
    return [
      m('h1', `improjam V${this.version}`),
      m(TemplateLoader, { system: system }),
      m(Settings, { system: system, open: system.settingsOpen }),
      m('div', { class: 'cf' }, m('div', { class: 'matrix' }, m(Matrix, { matrixView: vnode.attrs.system.matrixView }))),

      m('h2', 'Scale'),
      m('div', [
        m('label', [
          ' Scale: ',
          m(Select, { options: scales, value: currentScale, onchange: (val) => { this.system.scaler.currentScale = val } }),
          ' Note: ',
          m(Select, { options: notes, value: currentRootNote, onchange: (val) => { this.system.scaler.currentRootNote = val } }),
          ' Oct: ',
          m(Select, { options: octaves, value: currentOctave, onchange: (val) => { this.system.scaler.currentOctave = val } })
        ])
      ])
    ]
  }
}
