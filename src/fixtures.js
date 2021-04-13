import fs from 'fs';
import path from 'path';
import objectHash from 'object-hash';
import parseJSON from 'json-parse-better-errors';
import stringifyJSON from 'json-stable-stringify';
import { ensureDir, move } from 'fs-extra';
import tempWrite from 'temp-write';
import createLogger from 'debug';
import { decodeResponse } from './encoding';
import { permissions } from './modes';

const debug = createLogger('ava-nock:fixtures');

const config = {
  decodeResponse: true,
  fixtureDir: null,
};

let fixturePath;
let fixtureData;

export function configure(options) {
  Object.assign(config, options);
}

function getFixturePath(ava) {
  const testPath = ava.meta.file;
  const testDir = path.dirname(testPath);
  const testName = path.basename(testPath);
  const fixtureName = `${testName}.nock`;

  let fixtureDir;
  if (config.fixtureDir) {
    fixtureDir = path.resolve(testDir, config.fixtureDir);
  } else if (ava.meta.snapshotDirectory) {
    // `meta.snapshotDirectory` was added in AVA v3.7.0, we can support earlier
    // versions by checking for it.
    fixtureDir = ava.meta.snapshotDirectory;
  } else {
    fixtureDir = path.join(testDir, 'snapshots');
  }

  return path.join(fixtureDir, fixtureName);
}

export function initFixtures(ava) {
  fixturePath = getFixturePath(ava);
}

export function readFixture(filename) {
  filename = path.relative(process.cwd(), filename);
  return new Promise((resolve, reject) => {
    debug(`Reading fixture: ${filename}`);
    fs.readFile(filename, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(parseJSON(data));
      }
    });
  });
}

export async function writeFixture(filename, data, options) {
  filename = path.relative(process.cwd(), filename);
  const output = stringifyJSON(data, { space: 2 }) + '\n';
  debug('Writing fixture to temporary file.');
  const tempFile = await tempWrite(output);
  const dirname = path.dirname(filename);
  debug(`Ensuring fixture directory exists: ${dirname}`);
  await ensureDir(dirname);
  debug(`Moving fixture into place: ${filename}`);
  await move(tempFile, filename, options);
}

async function loadFixtures() {
  if (!fixtureData) {
    if (permissions.read) {
      try {
        const data = await readFixture(fixturePath);
        fixtureData = new Map(data);
      } catch (err) {
        if (err.code === 'ENOENT') {
          fixtureData = new Map();
        } else {
          throw err;
        }
      }
    } else {
      fixtureData = new Map();
    }
  }
  return fixtureData;
}

export async function loadFixture(t) {
  const context = t.context.nock;
  if (!permissions.read) {
    return null;
  }
  const fixtures = await loadFixtures();
  return fixtures.get(context.title) || null;
}

async function getOutputCalls(recordedCalls) {
  let outputCalls = recordedCalls;
  if (config.decodeResponse) {
    outputCalls = await Promise.all(outputCalls.map(decodeResponse));
  }
  if (config.pathFilter) {
    outputCalls = outputCalls.map(applyPathFilterToCall);
  }
  return outputCalls;
}

export async function saveFixture(t) {
  const context = t.context.nock;
  if (!context.recordedCalls) {
    return;
  }
  const [fixtures, outputCalls] = await Promise.all([
    loadFixtures(),
    getOutputCalls(context.recordedCalls),
  ]);
  if (
    !context.inputCalls ||
    objectHash(outputCalls) !== objectHash(context.inputCalls)
  ) {
    fixtures.set(context.title, outputCalls);
    const outputData = Array.from(fixtures);
    // Sort fixtures so they don't move around when re-recording.
    outputData.sort((a, b) => {
      if (a[0] < b[0]) {
        return -1;
      } else if (a[0] > b[0]) {
        return 1;
      } else {
        return 0;
      }
    });
    await writeFixture(fixturePath, outputData, { overwrite: true });
  }
}

export function applyPathFilterToScope(scope) {
  const { pathFilter } = config;
  if (typeof pathFilter === 'function') {
    return scope.filteringPath(config.pathFilter);
  } else if (Array.isArray(pathFilter)) {
    const args = [...pathFilter];
    if (typeof args[0] === 'string') {
      args[0] = new RegExp(args[0], 'g');
    }
    return scope.filteringPath(...args);
  } else if (pathFilter != null) {
    throw new Error(`Unknown pathFilter type: ${pathFilter}`);
  }
  return scope;
}

export function applyPathFilterToCall(call) {
  const { pathFilter } = config;
  if (typeof pathFilter === 'function') {
    return {
      ...call,
      path: pathFilter(call.path),
    };
  } else if (Array.isArray(pathFilter)) {
    const args = [...pathFilter];
    if (typeof args[0] === 'string') {
      args[0] = new RegExp(args[0], 'g');
    }
    return {
      ...call,
      path: call.path.replace(...args),
    };
  } else if (pathFilter != null) {
    throw new Error(`Unknown pathFilter type: ${pathFilter}`);
  }
  return call;
}
