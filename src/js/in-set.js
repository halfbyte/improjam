function maxInSet (set) {
  var max = 0
  set.forEach((entry) => { max = (entry > max) ? entry : max })
  return max
}
function minInSet (set) {
  var min = maxInSet(set)
  set.forEach((entry) => { min = (entry < min) ? entry : min })
  return min
}


export {
  maxInSet,
  minInSet
}