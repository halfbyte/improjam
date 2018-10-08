const SCALES = ['chromatic',
 'min', 'min-m', 'min-h', 'maj']
const SCALEMAPS = {
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'min': [0, 2, 3, 5, 7, 8, 10],
  'min-h': [0, 2, 3, 5, 7, 8, 11],
  'min-m': [0, 2, 3, 5, 7, 9, 11],
  'maj': [0, 2, 4, 5, 7, 9, 10]
}
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
    // TODO: Build chromatic mode
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const noteInRow = map[pos % 7]
    const extraRow = Math.floor(pos / 7)
    const octaveNote = (this.currentOctave + extraRow + row + 1) * 12
    return octaveNote + rootNote + noteInRow
  }
  rowAndPos (note) {
    // TODO: Build chromatic mode
    const map = this.SCALEMAPS[this.currentScale] || this.SCALEMAPS['chromatic']
    const rootNote = this.NOTES.indexOf(this.currentRootNote)
    const octaveNote = (this.currentOctave + 1) * 12
    const baseNote = note - octaveNote - rootNote

    const row = 1 - Math.floor(baseNote / 12)
    const noteInOct = (note - rootNote) % 12
    return [row, map.indexOf(noteInOct)]
  }
  octaveUp () {
    this.currentOctave++
    if (this.currentOctave > 10) { this.currentOctave = 10 }
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
