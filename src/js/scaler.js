const SCALES = ['chromatic',
 'min', 'min-m', 'min-h', 'maj']
const SCALEMAPS = {
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'min': [0, 2, 3, 5, 7, 8, 10],
  'min-h': [0, 2, 3, 5, 7, 8, 11],
  'min-m': [0, 2, 3, 5, 7, 9, 11],
  'maj': [0, 2, 4, 5, 7, 9, 10]
}

const CHROMATIC_NOTES = [
  [0, 2, 4, 5, 7, 9, 11, 12],
  [null, 1, 3, null, 6, 8, 10, null],
]
const CHROMATIC_SLOTS = [
  [0, 0], [1, 1], [0, 1], [1, 2],
  [0, 2], [0, 3], [1, 4], [0, 4],
  [1, 5], [0, 5], [1, 6], [0, 6],
  [0, 7], 
]

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const OCTAVES = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]


export default class Scaler {
  constructor () {
    this.SCALES = SCALES
    this.SCALEMAPS = SCALEMAPS
    this.NOTES = NOTES
    this.OCTAVES = OCTAVES
    this.currentScale = 'min'
    this.currentRootNote = 'C'
    this.currentOctave = 3
  }
  note (row, pos) {
    if (this.currentScale === 'chromatic') {
      const keyNote = CHROMATIC_NOTES[row][pos]
      if (keyNote != null) {
        return this.currentOctave * 12  + keyNote  
      }
      return
    }
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const noteInRow = map[pos % 7]
    const extraRow = Math.floor(pos / 7)
    const octaveNote = (this.currentOctave + extraRow + row) * 12
    const finalNote = octaveNote + rootNote + noteInRow
    if (finalNote < 0 || finalNote > 127) { return }
    return octaveNote + rootNote + noteInRow
  }
  rowAndPos (note) {
    if (this.currentScale === 'chromatic') {
      const octaveNote = this.currentOctave * 12
      const baseNote = note - octaveNote
      if (baseNote < 0 || baseNote > 12) { return [null, null] }
      return [1-CHROMATIC_SLOTS[baseNote][0], CHROMATIC_SLOTS[baseNote][1]]
    }
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const octaveNote = (this.currentOctave) * 12
    const baseNote = note - octaveNote - rootNote

    const row = 1 - Math.floor(baseNote / 12)
    const noteInOct = (note - rootNote) % 12
    return [row, map.indexOf(noteInOct)]
  }
  octaveUp () {
    this.currentOctave++
    if (this.currentOctave > 9) { this.currentOctave = 9 }
  }
  octaveDown () {
    this.currentOctave--
    if (this.currentOctave < 0) { this.currentOctave = 0 }
  }
  getConfig () {
    return {
      currentScale: this.currentScale,
      currentRootNote: this.currentRootNote,
      currentOctave: this.currentOctave
    }
  }
  setConfig (config) {
    this.currentScale = config.currentScale || 'min'
    this.currentRootNote = config.currentRootNote || 'C'
    this.currentOctave = config.currentOctave || 3
  }
  editRootNote (inc) {
    const currentIndex = NOTES.indexOf(this.currentRootNote)
    var newIndex = currentIndex + inc
    if (newIndex > (NOTES.length - 1)) {
      newIndex = NOTES.length - 1
    }
    if (newIndex < 0) {
      newIndex = 0
    }
    this.currentRootNote = NOTES[newIndex]
  }
  editScale (inc) {
    const currentIndex = SCALES.indexOf(this.currentScale)
    var newIndex = currentIndex + inc
    if (newIndex > (SCALES.length - 1)) {
      newIndex = SCALES.length - 1
    }
    if (newIndex < 0) {
      newIndex = 0
    }
    this.currentScale = SCALES[newIndex]
  }
}
