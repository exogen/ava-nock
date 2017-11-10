import createLogger from 'debug'

const debug = createLogger('ava-nock:modes')

export const NOCK_MODE = process.env.NOCK_MODE || 'play'
const modes = new Map([
  [
    'live',
    {
      permissions: { read: false, write: false, network: true },
      description: 'Live mode: no fixtures will be replayed or recorded.'
    }
  ],
  [
    'preview',
    {
      permissions: { read: true, write: false, network: true },
      description:
        'Preview mode: existing fixtures will be replayed, none will be recorded.'
    }
  ],
  [
    'record',
    {
      permissions: { read: false, write: true, network: true },
      description:
        'Record mode: existing fixtures will be ignored, replacements will be recorded.'
    }
  ],
  [
    'cache',
    {
      permissions: { read: true, write: true, network: true },
      description:
        'Cache mode: existing fixtures will be replayed, missing ones will be recorded.'
    }
  ],
  [
    'play',
    {
      permissions: { read: true, write: false, network: false },
      description:
        'Play mode: existing fixtures will be replayed, missing ones will result in an error.'
    }
  ]
])
if (modes.has(NOCK_MODE)) {
  debug(modes.get(NOCK_MODE).description)
} else {
  throw new Error(
    `Unrecognized NOCK_MODE, valid values are: ${[...modes.keys()].join(', ')}`
  )
}
export const permissions = modes.get(NOCK_MODE).permissions
