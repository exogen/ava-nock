function extendFilter(left, right) {
  if (right == null) {
    return left
  }
  if (typeof right === 'object') {
    return Object.keys(right).reduce((output, key) => {
      const value = right[key]
      if (value != null) {
        output[key] = value
      }
      return output
    }, Object.assign({}, left))
  }
  return right
}

function applyFilter(value, filter) {
  if (filter === true || filter == null) {
    return value
  }
  if (filter === false) {
    return undefined
  }
  if (typeof filter === 'function') {
    return filter(value)
  }
  let output = value
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    output = {}
    Object.keys(value).forEach(key => {
      const keyFilter = filter[key]
      const keyValue = value[key]
      const outputValue = applyFilter(keyValue, keyFilter)
      if (outputValue !== undefined) {
        output[key] = outputValue
      }
    })
  }
  return output
}

module.exports = {
  extendFilter,
  applyFilter
}
