export default function createLock(createContext) {
  let lock = Promise.resolve()
  return function acquire() {
    let release
    const prevLock = lock
    lock = new Promise(resolve => {
      release = resolve
    })
    return prevLock.then(() => {
      return createContext ? createContext(release) : release
    })
  }
}
