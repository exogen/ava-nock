/**
 * Due to the way Nock works by globally intercepting requests from the `http`
 * and `https` modules, there's no way to isolate each test's requests when they
 * are run in parallel (which is how some test runners like AVA run tests). So
 * if we want per-test request isolation, we need to force tests using Nock to
 * be serial. This module provides the means to do so: tests (or test hooks
 * like `beforeEach`) can get an exclusive handle on Nock by calling `acquire()`
 * and waiting on the resulting Promise. They will receive an object providing
 * access to various Nock features, along with a `release` method to free the
 * lock. Nock will be automatically enabled (with no interceptors or recordings)
 * when the lock is acquired and disabled (and cleared) when the lock is
 * released.
 */
import nock from 'nock'
import createLogger from 'debug'
import createLock from './lock'

const debug = createLogger('ava-nock:manager')

let isActive = true
let isRecording
disable()

function enable() {
  if (!isActive) {
    debug('Nock enabled.')
    isActive = true
    nock.activate()
  }
}

function disable() {
  if (isActive) {
    debug('Nock disabled.')
    isActive = false
    isRecording = false
    nock.restore()
  }
}

function enableNetwork() {
  debug('Network calls enabled.')
  nock.enableNetConnect()
}

function disableNetwork() {
  debug('Network calls disabled.')
  nock.disableNetConnect()
}

function clear() {
  debug('Clearing Nock interceptors and recordings.')
  nock.cleanAll()
  nock.recorder.clear()
}

function intercept(scope) {
  debug(`Adding interceptor for scope: ${scope}`)
  return nock(scope)
}

function startRecording({ requestHeaders = false } = {}) {
  debug('Started recording.')
  isRecording = true
  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
    enable_reqheaders_recording: requestHeaders
  })
}

function getRecordedCalls() {
  const calls = nock.recorder.play()
  debug(`Stopped recording, captured ${calls.length} network call(s).`)
  return calls
}

function loadCalls(calls) {
  debug(`Loaded ${calls.length} saved network call(s).`)
  return nock.define(calls)
}

export default {
  isActive: () => isActive,
  enable,
  disable,
  enableNetwork,
  disableNetwork,
  clear,
  intercept,
  startRecording,
  getRecordedCalls,
  isRecording: () => isRecording,
  loadCalls,
  acquire: createLock(release => {
    enable()
    return () => {
      enableNetwork()
      disable()
      clear()
      return release()
    }
  })
}
