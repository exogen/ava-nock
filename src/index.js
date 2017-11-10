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
const testPath = path.relative(process.cwd(), getTestFile())
const fixturePath = `${testPath}.nock`
let fixtureData

function getTestFile() {
  const testModule = require.main.children[require.main.children.length - 1]
  return testModule.filename
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
  const prepare = config.decodeResponse
    ? Promise.all(context.recordedCalls.map(decodeResponse)).then(
        decodedCalls => {
          context.recordedCalls = decodedCalls
        }
      )
    : Promise.resolve()
  return prepare.then(() => loadFixtures(t)).then(fixtures => {
    if (
      !context.savedCalls ||
      objectHash(context.recordedCalls) !== objectHash(context.savedCalls)
    ) {
      fixtures.set(context.title, context.recordedCalls)
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
  })
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
      context.savedCalls = fixture
      if (fixture && fixture.length) {
        context.scopes = nockManager.loadCalls(fixture)
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
  if (context.savedCalls) {
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

export function setupTests(ava = require('ava')) {
  ava.beforeEach(beforeEach)
  ava.afterEach(afterEach)
  ava.afterEach.always(afterEachAlways)
}

configure(pkgConf.sync('ava-nock'))
