fs = require('fs')
path = require('path')

const oldConfig = [
  ['Reverb', 'Echo', 'Filter', null, null, 'Track Vol', 'Send REV', 'Send DEL'], //  1
  ['Select', 'Filter', 'FM', 'Flt Env', null, 'Track Vol', 'Send REV', 'Send DEL'], //  2
  ['Filter', 'Reso', 'Unison', 'Select', null, 'Track Vol', 'Send REV', 'Send DEL'], //  3
  ['Select', 'Filter', null, null, null, 'Track Vol', 'Send REV', 'Send DEL'], //  4
  ['Filter', 'Reso', 'Wavetable', null, null, 'Track Vol', 'Send REV', 'Send DEL'], //  5
  ['Filter', 'Reso', 'SAW > SQ', 'Mod', 'Mod T', 'Track Vol', 'Send REV', 'Send DEL'], //  6
  ['Reverb', 'Echo', null, null, null, 'Track Vol', 'Send REV', 'Send DEL'], //  7
  ['Reverb', 'Echo', null, null, null, 'Track Vol', 'Send REV', 'Send DEL'], //  8
]

oldConfig.forEach(function(config, index) {
  const filename = `ableton_setup_ch${index + 1}.json`
  const fullName = path.join('ctrl_templates', filename)
  const mapping = config.map(function(ctrlName, i) {
    return {name: ctrlName || `Ctrl ${i + 1}`, cc: 71 + i}
  })
  fs.writeFileSync(fullName, JSON.stringify(mapping, null, 2))
})