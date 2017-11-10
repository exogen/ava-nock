import zlib from 'zlib'
import createLogger from 'debug'

const debug = createLogger('ava-nock:encoding')
const decoders = new Map([['gzip', zlib.gunzip], ['deflate', zlib.inflate]])

function findLastEncoding(headers) {
  const reversedHeaders = headers.slice().reverse()
  const index = reversedHeaders.findIndex(
    (header, index) => header.toLowerCase() === 'content-encoding' && index % 2
  )
  return index === -1 ? -1 : headers.length - index - 1
}

export function decodeResponse(call) {
  if (Array.isArray(call.response)) {
    // Reverse the headers array, because Content-Encoding can appear multiple
    // times and we need to decode the response in the opposite order that it
    // was encoded.
    const encodingIndex = findLastEncoding(call.rawHeaders)
    if (encodingIndex !== -1) {
      const encodingValue = call.rawHeaders[encodingIndex + 1]
      if (decoders.has(encodingValue)) {
        debug(`Found encoding: ${encodingValue}, attempting to decode.`)
        const decode = decoders.get(encodingValue)
        const buffer = Buffer.concat(
          call.response.map(hexString => Buffer.from(hexString, 'hex'))
        )
        return new Promise((resolve, reject) => {
          decode(buffer, (err, outputBuffer) => {
            if (err) {
              reject(err)
            } else {
              // Remove the Content-Encoding that was processed.
              const headers = call.rawHeaders.slice()
              headers.splice(encodingIndex, 2)
              const hasEncoding = findLastEncoding(headers) !== -1
              // If there's another Content-Encoding, leave the response as an
              // array of hex-encoded buffers and call this function again.
              // Otherwise, convert it to a string.
              const outputCall = {
                ...call,
                rawHeaders: headers,
                response: hasEncoding
                  ? [outputBuffer.toString('hex')]
                  : outputBuffer.toString()
              }
              if (hasEncoding) {
                decodeResponse(outputCall).then(resolve, reject)
              } else {
                resolve(outputCall)
              }
            }
          })
        })
      }
    }
  }
  return Promise.resolve(call)
}
