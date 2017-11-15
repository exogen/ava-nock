import path from 'path'
import objectHash from 'object-hash'
import pkgConf from 'pkg-conf'
import createLogger from 'debug'
import nockManager from './manager'
import { readFixture, writeFixture } from './fixtures'
import { decodeResponse } from './encoding'
import { permissions } from './modes'

const debug = createLogger('ava-nock:index')
const config = {
  decodeResponse: true
}
const fixturePath = getFixturePath()
let fixtureData

function getTestPath() {
  const testModule = require.main.children[require.main.children.length - 1]
  return path.relative(process.cwd(), testModule.filename)
}

function getFixturePath() {
  const testPath = getTestPath()
  const testDir = path.dirname(testPath)
  const testName = path.basename(testPath)
  let fixtureDir = testDir
  const fixtureName = `${testName}.nock`
  const parts = new Set(testDir.split(path.sep))
  if (parts.has('__tests__')) {
    fixtureDir = path.join(testDir, '__fixtures__')
  } else if (parts.has('test') || parts.has('tests')) {
    fixtureDir = path.join(testDir, 'fixtures')
  }
  return path.join(fixtureDir, fixtureName)
}

function applyPathFilterToScope(scope) {
  const { pathFilter } = config
  if (typeof pathFilter === 'function') {
    return scope.filteringPath(config.pathFilter)
  } else if (Array.isArray(pathFilter)) {
    const args = [...pathFilter]
    if (typeof args[0] === 'string') {
      args[0] = new RegExp(args[0], 'g')
    }
    return scope.filteringPath(...args)
  } else if (pathFilter != null) {
    throw new Error(`Unknown pathFilter type: ${pathFilter}`)
  }
  return scope
}

function applyPathFilterToCall(call) {
  const { pathFilter } = config
  if (typeof pathFilter === 'function') {
    return {
      ...call,
      path: pathFilter(call.path)
    }
  } else if (Array.isArray(pathFilter)) {
    const args = [...pathFilter]
    if (typeof args[0] === 'string') {
      args[0] = new RegExp(args[0], 'g')
    }
    return {
      ...call,
      path: call.path.replace(...args)
    }
  } else if (pathFilter != null) {
    throw new Error(`Unknown pathFilter type: ${pathFilter}`)
  }
  return call
}

function loadFixtures(t) {
  if (fixtureData) {
    return Promise.resolve(fixtureData)
  }
  return Promise.resolve(permissions.read ? readFixture(fixturePath) : [])
    .catch(err => {
      if (err.code === 'ENOENT') {
        return []
      }
      throw err
    })
    .then(data => {
      fixtureData = new Map(data)
      return fixtureData
    })
}

function loadFixture(t) {
  const context = t.context.nock
  if (!permissions.read) {
    return Promise.resolve(null)
  }
  return loadFixtures(t).then(fixtures => fixtures.get(context.title) || null)
}

function saveFixture(t) {
  const context = t.context.nock
  if (!context.recordedCalls) {
    return Promise.resolve()
  }
  let outputCalls = Promise.resolve(context.recordedCalls)
  if (config.decodeResponse) {
    outputCalls = outputCalls.then(calls =>
      Promise.all(calls.map(decodeResponse))
    )
  }
  if (config.pathFilter) {
    outputCalls = outputCalls.then(calls => calls.map(applyPathFilterToCall))
  }
  return Promise.all([loadFixtures(t), outputCalls]).then(
    ([fixtures, outputCalls]) => {
      if (
        !context.inputCalls ||
        objectHash(outputCalls) !== objectHash(context.inputCalls)
      ) {
        fixtures.set(context.title, outputCalls)
        const outputData = Array.from(fixtures)
        // Sort fixtures so they don't move around when re-recording.
        outputData.sort((a, b) => {
          if (a[0] < b[0]) {
            return -1
          } else if (a[0] > b[0]) {
            return 1
          } else {
            return 0
          }
        })
        return writeFixture(fixturePath, outputData, { overwrite: true })
      }
    }
  )
}

function beforeEach(t) {
  const context = {
    title: t.title.startsWith('beforeEach for ') ? t.title.slice(15) : t.title
  }
  t.context.nock = context
  debug(`Starting beforeEach hook: ${context.title}`)
  return nockManager.acquire().then(release => {
    context.release = release
    return loadFixture(t).then(fixture => {
      if (fixture || !permissions.network) {
        nockManager.disableNetwork()
      } else if (permissions.write) {
        nockManager.startRecording({ requestHeaders: true })
      }
      context.inputCalls = fixture
      if (fixture && fixture.length) {
        context.scopes = nockManager
          .loadCalls(fixture)
          .map(applyPathFilterToScope)
      } else {
        context.scopes = []
      }
    })
  })
}

function afterEach(t) {
  const context = t.context.nock
  debug(`Starting afterEach hook: ${context.title}`)
  if (nockManager.isRecording()) {
    context.recordedCalls = nockManager.getRecordedCalls()
  }
  nockManager.disable()
  if (context.inputCalls) {
    debug('Checking that expected requests were made.')
    context.scopes.forEach(scope => {
      if (!scope.isDone()) {
        t.fail(
          `The following requests from the test fixture were not made:\n\n  ${scope
            .pendingMocks()
            .join('\n  ')}\n\nConsider re-recording the test.`
        )
      }
    })
  }
  return saveFixture(t)
}

function afterEachAlways(t) {
  t.context.nock.release()
}

export function configure(options) {
  Object.assign(config, options)
}

export function setupTests(ava = require(process.env.AVA_PATH || 'ava')) {
  ava.beforeEach(beforeEach)
  ava.afterEach(afterEach)
  ava.afterEach.always(afterEachAlways)
}

configure(pkgConf.sync('ava-nock'))
