export default function createLock(createContext) {
  let lock;
  return async function acquire() {
    let release;
    const prevLock = lock;
    lock = new Promise((resolve) => {
      release = resolve;
    });
    await prevLock;
    return createContext ? createContext(release) : release;
  };
}
