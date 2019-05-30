export default class TempoMatcher {
  constructor (tempo) {
    this.originalTempo = tempo
    this.tempo = tempo
    // const perTick = 60 / (this.tempo * 24) * 1000
    this.times = []
  }
  next (time) {
    this.times.push(time)
    if (this.times.length > 1) {
      const diffs = this.times.map((t, i) => {
        if (this.times[i + 1] != null) {
          return this.times[i + 1] - t
        } else {
          return null
        }
      }).filter(Number)

      const sum = diffs.reduce((sum, num) => sum + num)
      const mean = sum / diffs.length
      this.tempo = 60 / (mean * 24) * 1000
    }
  }
  reset () {
    this.tempo = this.originalTempo
    this.times = []
  }
}
