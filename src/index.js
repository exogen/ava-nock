const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const parseJSON = require('json-parse-better-errors')
const { ensureDir, move } = require('fs-extra')
const tempWrite = require('temp-write')
const objectHash = require('object-hash')
const requestProtocols = new Map([
  ['http', require('http').request],
  ['https', require('https').request]
])
const nock = require('nock')
const { extendFilter, applyFilter } = require('./filter')
const debug = require('debug')('ava-vcr')

const VCR_MODE = process.env.VCR_MODE || 'play'
const permissions = {
  network: new Set(['live', 'preview', 'record', 'cache']),
  read: new Set(['preview', 'cache', 'play']),
  write: new Set(['record', 'cache'])
}

const config = {
  fixtureDir: path.resolve(process.cwd(), 'fixtures'),
  requestKey: {
    protocol: false,
    headers: false
  },
  requestFixture: {
    protocol: false,
    headers: false
  },
  responseFixture: {}
}

const bodyDecoders = new Map([
  ['gzip', zlib.createGunzip],
  ['deflate', zlib.createInflate]
])
const inflightRequests = new Map()

class Request {
  constructor(protocol, method, request, body) {
    this.protocol = protocol
    this.method = method
    this.request = request
    this.body = body
  }

  getHash() {
    const data = {
      protocol: this.protocol,
      method: this.method,
      host: this.request.headers.host,
      path: this.request.path,
      headers: this.request.headers,
      body: this.body
    }
    const key = applyFilter(data, config.requestKey)
    return typeof key === 'string' ? key : objectHash(key)
  }

  getURL() {
    return `${this.protocol}://${this.request.headers.host}${this.request.path}`
  }

  toJSON() {
    return {
      protocol: this.protocol,
      method: this.method,
      host: this.request.headers.host,
      path: this.request.path,
      headers: this.request.headers,
      body: this.body
    }
  }

  send() {
    return new Promise((resolve, reject) => {
      const url = this.getURL()
      debug(`Sending live network request: ${url}`)
      const send = requestProtocols.get(this.protocol)
      nock.restore()
      const request = send(
        {
          method: this.method,
          host: this.request.headers.host,
          path: this.request.path,
          headers: this.request.headers
        },
        response => {
          debug(`Received live network response: ${response.statusCode}`)
          resolve(new Response(response))
        }
      )
      request.on('error', reject)
      if (this.body) {
        request.write(this.body)
      }
      request.end()
      nock.activate()
    })
  }
}

class Response {
  constructor(response) {
    this.response = response
  }

  getBody() {
    if (this.body) {
      return this.body
    }
    let stream = this.response
    const decoder = bodyDecoders.get(this.response.headers['content-encoding'])
    if (decoder) {
      stream = decoder()
      this.response.pipe(stream)
    }
    let body = Buffer.alloc(0)
    stream.on('data', chunk => {
      body = Buffer.concat([body, chunk])
    })
    this.body = new Promise((resolve, reject) => {
      stream.on('end', () => resolve(body))
      stream.on('error', reject)
    })
    return this.body
  }

  toJSON() {
    return this.getBody().then(body => ({
      statusCode: this.response.statusCode,
      statusMessage: this.response.statusMessage,
      headers: Object.assign({}, this.response.headers, {
        'content-encoding': undefined
      }),
      body: body.toString()
    }))
  }
}

function getNetworkResponse(request) {
  return request.send()
}

function readJSON(filename) {
  return new Promise((resolve, reject) => {
    debug(`Attempting to read fixture: ${filename}`)
    fs.readFile(filename, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        debug(`Parsing fixture: ${filename}`)
        const fixture = parseJSON(data)
        resolve(fixture)
      }
    })
  })
}

function getFixturePath(request) {
  const hash = request.getHash()
  return path.relative(
    process.cwd(),
    path.join(config.fixtureDir, `${hash}.json`)
  )
}

function readFixture(request) {
  const filename = getFixturePath(request)
  return readJSON(filename)
}

function writeFixture(request, response) {
  const filename = getFixturePath(request)
  return Promise.all([request.toJSON(), response.toJSON()])
    .then(([requestJSON, responseJSON]) => {
      const fixture = {
        request: applyFilter(requestJSON, config.requestFixture),
        response: applyFilter(responseJSON, config.responseFixture)
      }
      const data = `${JSON.stringify(fixture, null, 2)}\n`
      debug(`Writing fixture to temporary file…`)
      return tempWrite(data).then(tempFile => ({ fixture, tempFile }))
    })
    .then(({ fixture, tempFile }) => {
      debug(`Ensuring fixture directory exists: ${config.fixtureDir}`)
      return ensureDir(config.fixtureDir).then(() => ({ fixture, tempFile }))
    })
    .then(({ fixture, tempFile }) => {
      debug(`Moving fixture into place: ${filename}`)
      const overwrite = !permissions.read.has(VCR_MODE)
      return move(tempFile, filename, { overwrite }).then(
        () => fixture,
        err => {
          if (err.code === 'EEXIST') {
            debug(`Fixture exists: ${filename}`)
            return readJSON(filename)
          }
          throw err
        }
      )
    })
}

function createReplyHandler(protocol, method) {
  return function(uri, requestBody, callback) {
    const request = new Request(protocol, method, this.req, requestBody)
    const hash = request.getHash()
    let promise = inflightRequests.get(hash)
    if (promise) {
      debug(`Reusing in-flight request: ${hash}`)
    } else {
      if (permissions.read.has(VCR_MODE)) {
        promise = readFixture(request).then(
          fixture => ({
            response: fixture.response,
            source: 'fixture'
          }),
          err => {
            if (permissions.network.has(VCR_MODE)) {
              return getNetworkResponse(request).then(response => ({
                response,
                source: 'network'
              }))
            }
            throw err
          }
        )
      } else if (permissions.network.has(VCR_MODE)) {
        promise = getNetworkResponse(request).then(response => ({
          response,
          source: 'network'
        }))
      } else {
        throw new Error('Mode can neither read fixtures nor make requests.')
      }
      promise = promise.then(({ response, source }) => {
        if (source === 'network') {
          if (permissions.write.has(VCR_MODE)) {
            return writeFixture(request, response).then(
              fixture => fixture.response
            )
          }
          return response.toJSON()
        }
        return response
      })

      debug(`Adding in-flight request to cache: ${hash}`)
      inflightRequests.set(hash, promise)
      const completeRequest = () => {
        debug(`Removing in-flight request from cache: ${hash}`)
        inflightRequests.delete(hash)
      }
      promise.then(completeRequest, completeRequest)
    }
    promise.then(
      response => {
        callback(null, [response.statusCode, response.body, response.headers])
      },
      err => {
        callback(err)
      }
    )
  }
}

function intercept(protocol, method) {
  const handler = createReplyHandler(protocol, method)
  const host = new RegExp(`^${protocol}:.*`)
  const path = /.*/
  return nock(host)
    .intercept(path, method)
    .reply(handler)
}

if (VCR_MODE === 'live') {
  debug(`Entering live mode, no fixtures will be played or recorded.`)
  nock.restore()
} else {
  intercept('http', 'GET')
  intercept('https', 'GET')
}

module.exports = {
  configure(options) {
    if (options.fixtureDir != null) {
      config.fixtureDir = options.fixtureDir
    }
    config.requestKey = extendFilter(config, options.requestKey)
    config.requestFixture = extendFilter(config, options.requestFixture)
    config.responseFixture = extendFilter(config, options.responseFixture)
  }
}
