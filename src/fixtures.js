import fs from 'fs'
import path from 'path'
import parseJSON from 'json-parse-better-errors'
import stringifyJSON from 'json-stable-stringify'
import { ensureDir, move } from 'fs-extra'
import tempWrite from 'temp-write'
import createLogger from 'debug'

const debug = createLogger('ava-nock:fixtures')

export function readFixture(filename) {
  filename = path.relative(process.cwd(), filename)
  return new Promise((resolve, reject) => {
    debug(`Reading fixture: ${filename}`)
    fs.readFile(filename, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(parseJSON(data))
      }
    })
  })
}

export function writeFixture(filename, data, options) {
  filename = path.relative(process.cwd(), filename)
  const output = stringifyJSON(data, { space: 2 }) + '\n'
  debug(`Writing fixture to temporary file.`)
  return tempWrite(output)
    .then(tempFile => {
      const dirname = path.dirname(filename)
      debug(`Ensuring fixture directory exists: ${dirname}`)
      return ensureDir(dirname).then(() => tempFile)
    })
    .then(tempFile => {
      debug(`Moving fixture into place: ${filename}`)
      return move(tempFile, filename, options)
    })
}
