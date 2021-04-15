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
  const fixture = fixtures.get(context.title);
  if (!fixture) {
    return null;
  }
  return fixture.map((call) => {
    const { headerFilter } = config;
    if (headerFilter) {
      const filterMap = new Map();
      for (const name in headerFilter) {
        filterMap.set(name.toLowerCase(), headerFilter[name]);
      }
      for (const name in call.reqheaders) {
        const filter = filterMap.get(name.toLowerCase());
        if (Array.isArray(filter)) {
          const args = [...filter];
          if (typeof args[0] === 'string') {
            args[0] = new RegExp(args[0], 'g');
          }
          call.reqheaders[name] = args[0];
        } else if (typeof filter === 'function') {
          call.reqheaders[name] = filter;
        }
      }
    }
    return call;
  });
}

async function getOutputCalls(recordedCalls) {
  let outputCalls = recordedCalls;
  if (config.decodeResponse) {
    outputCalls = await Promise.all(outputCalls.map(decodeResponse));
  }
  outputCalls = outputCalls.map(applyFiltersToCall);
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
    return scope.filteringPath(pathFilter);
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

export function applyRequestBodyFilterToScope(scope) {
  const { requestBodyFilter } = config;
  if (typeof requestBodyFilter === 'function') {
    return scope.filteringRequestBody(requestBodyFilter);
  } else if (Array.isArray(requestBodyFilter)) {
    const args = [...requestBodyFilter];
    if (typeof args[0] === 'string') {
      args[0] = new RegExp(args[0], 'g');
    }
    return scope.filteringRequestBody(...args);
  } else if (requestBodyFilter != null) {
    throw new Error(`Unknown pathFilter type: ${requestBodyFilter}`);
  }
  return scope;
}

export function applyFiltersToScope(scope) {
  scope = applyPathFilterToScope(scope);
  scope = applyRequestBodyFilterToScope(scope);
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
    call = {
      ...call,
      path: call.path.replace(...args),
    };
  } else if (pathFilter != null) {
    throw new Error(`Unknown pathFilter type: ${pathFilter}`);
  }
  return call;
}

export function applyRequestBodyFilterToCall(call) {
  let { requestBodyFilter } = config;
  if (requestBodyFilter) {
    if (Array.isArray(requestBodyFilter)) {
      const args = [...requestBodyFilter];
      if (typeof args[0] === 'string') {
        args[0] = new RegExp(args[0], 'g');
      }
      requestBodyFilter = (body) => body.replace(...args);
    }
    if (typeof requestBodyFilter === 'function') {
      const shouldParseBody =
        call.body != null && typeof call.body !== 'string';
      const bodyString = shouldParseBody
        ? JSON.stringify(call.body)
        : call.body;
      const newBodyString = requestBodyFilter(bodyString);
      const newBody = shouldParseBody
        ? JSON.parse(newBodyString)
        : newBodyString;
      call = {
        ...call,
        body: newBody,
      };
    } else {
      throw new Error(`Unknown requestBodyFilter type: ${requestBodyFilter}`);
    }
  }
  return call;
}

export function applyResponseBodyFilterToCall(call) {
  let { responseBodyFilter } = config;
  if (responseBodyFilter) {
    if (Array.isArray(responseBodyFilter)) {
      const args = [...responseBodyFilter];
      if (typeof args[0] === 'string') {
        args[0] = new RegExp(args[0], 'g');
      }
      responseBodyFilter = (body) => body.replace(...args);
    }
    if (typeof responseBodyFilter === 'function') {
      const shouldParseBody =
        call.response != null && typeof call.response !== 'string';
      const bodyString = shouldParseBody
        ? JSON.stringify(call.response)
        : call.response;
      const newBodyString = responseBodyFilter(bodyString);
      const newBody = shouldParseBody
        ? JSON.parse(newBodyString)
        : newBodyString;
      call = {
        ...call,
        response: newBody,
      };
    } else {
      throw new Error(`Unknown responseBodyFilter type: ${responseBodyFilter}`);
    }
  }
  return call;
}

function getTypeName(value) {
  return Object.prototype.toString.call(value).slice(8, -1);
}

export function applyHeaderFilterToCall(call) {
  const { headerFilter } = config;
  if (headerFilter) {
    if (getTypeName(headerFilter) === 'Object') {
      const headerReplacers = new Map(
        Object.entries(headerFilter).map(([name, value]) => {
          if (Array.isArray(value)) {
            const args = [...value];
            if (typeof args[0] === 'string') {
              args[0] = new RegExp(args[0], 'g');
            }
            value = (str) => str.replace(...args);
          }
          return [name.toLowerCase(), value];
        })
      );
      const newRawHeaders = [];
      for (let i = 0; i < call.rawHeaders.length; i += 2) {
        const name = call.rawHeaders[i];
        const value = call.rawHeaders[i + 1];
        const replacer = headerReplacers.get(name.toLowerCase());
        if (replacer) {
          const newValue = replacer(value);
          if (newValue != null && newValue !== '') {
            newRawHeaders.push(name, newValue);
          }
        } else {
          newRawHeaders.push(name, value);
        }
      }
      const newReqHeaders = {};
      Object.entries(call.reqheaders).forEach(([name, value]) => {
        const replacer = headerReplacers.get(name.toLowerCase());
        if (replacer) {
          if (Array.isArray(value)) {
            const newValue = value
              .map((item) => replacer(item))
              .filter((item) => item != null && item !== '');
            if (newValue.length) {
              newReqHeaders[name] = newValue;
            }
          } else {
            const newValue = replacer(value);
            if (newValue != null && newValue !== '') {
              newReqHeaders[name] = newValue;
            }
          }
        } else {
          newReqHeaders[name] = value;
        }
      });
      call = {
        ...call,
        rawHeaders: newRawHeaders,
        reqheaders: newReqHeaders,
      };
    } else {
      throw new Error(`Unknown headerFilter type: ${headerFilter}`);
    }
  }
  return call;
}

export function applyFiltersToCall(call) {
  call = applyPathFilterToCall(call);
  call = applyHeaderFilterToCall(call);
  call = applyRequestBodyFilterToCall(call);
  call = applyResponseBodyFilterToCall(call);
  return call;
}
