import pkgConf from 'pkg-conf';
import createLogger from 'debug';
import nockManager from './manager';
import {
  configure,
  initFixtures,
  loadFixture,
  saveFixture,
  applyPathFilterToScope,
} from './fixtures';
import { permissions } from './modes';

const debug = createLogger('ava-nock:index');

configure(pkgConf.sync('ava-nock'));

async function beforeEach(t) {
  const context = {
    title: t.title.replace(/^(beforeEach for|beforeEach hook for) /, ''),
  };
  t.context.nock = context;
  debug(`Starting beforeEach hook: ${context.title}`);
  const release = await nockManager.acquire();
  context.release = release;
  const fixture = await loadFixture(t);
  if (fixture || !permissions.network) {
    nockManager.disableNetwork();
  } else if (permissions.write) {
    nockManager.startRecording({ requestHeaders: true });
  }
  context.inputCalls = fixture;
  if (fixture && fixture.length) {
    context.scopes = nockManager.loadCalls(fixture).map(applyPathFilterToScope);
  } else {
    context.scopes = [];
  }
}

async function afterEach(t) {
  const context = t.context.nock;
  debug(`Starting afterEach hook: ${context.title}`);
  if (nockManager.isRecording()) {
    context.recordedCalls = nockManager.getRecordedCalls();
  }
  nockManager.disable();
  if (context.inputCalls) {
    debug('Checking that expected requests were made.');
    context.scopes.forEach((scope) => {
      if (!scope.isDone()) {
        t.fail(
          `The following requests from the test fixture were not made:\n\n  ${scope
            .pendingMocks()
            .join('\n  ')}\n\nConsider re-recording the test.`
        );
      }
    });
  }
  await saveFixture(t);
}

function afterEachAlways(t) {
  t.context.nock.release();
}

export function setupTests(ava = require(process.env.AVA_PATH || 'ava')) {
  initFixtures(ava);
  ava.beforeEach(beforeEach);
  ava.afterEach(afterEach);
  ava.afterEach.always(afterEachAlways);
}

export { configure };
