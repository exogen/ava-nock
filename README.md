# ava-nock

Install with npm:

```console
$ npm install ava-nock --save-dev
```

Install with Yarn:

```console
$ yarn add ava-nock --dev
```

## How it works

There are generally two approaches to mocking HTTP requests when we don’t
control or can’t manually mock the code that makes the request: either use a
proxy to fulfill requests (this requires starting a server and being able to
change your request code to point to it), or intercept the host language’s
underlying code for sending requests. Libraries like
[yakbak](https://github.com/flickr/yakbak) use the former, while libraries like
[VCR](https://github.com/vcr/vcr), [Nock](https://github.com/node-nock/nock),
and [Sepia](https://github.com/linkedin/sepia) use the latter. As the name
implies, ava-nock uses Nock.

Likewise, there are multiple levels of granularity at which to capture requests.
One approach is to generate a hash for each request and serve the same response
any time a matching request is made throughout the entire test suite. Another
approach is to isolate the specific requests made in each test. This library
currently supports the latter approach (although it was designed with the former
approach in mind – maybe someday).

## Usage

Import and run the `setupTests()` function in any test files that make network
requests. This function will add `beforeEach`, `afterEach`, and
`afterEach.always` hooks that manage Nock fixtures for you.

```js
import test from 'ava'
import fetch from 'isomorphic-fetch'
import { setupTests } from 'ava-nock'

setupTests()

test('using fetch to get JSON', t => {
  return fetch(
    'https://musicbrainz.org/ws/2/artist/c8da2e40-bd28-4d4e-813a-bd2f51958ba8?fmt=json'
  )
    .then(response => response.json())
    .then(data => {
      t.is(data.name, 'Lures')
    })
})
```

Fixtures behave similarly to AVA snapshots: they are stored in a `.nock` file
alongside the test file that generated them (or, like snapshots, an adjacent
`fixtures` or `__fixtures__` directory). Within each fixture, each test’s
requests and responses are stored for later playback.

Note that due to the way Nock works by globally intercepting requests to the
`http` and `https` modules, each test using ava-nock will effectively be run
serially – otherwise there is no way to isolate requests per-test. The
`beforeEach` hook will enforce this for you automatically. (Running tests in
parallel in multiple processes is fine.)

You can control ava-nock’s behavior using the `NOCK_MODE` environment variable.

## Modes

| NOCK_MODE |    Network requests?    |     Read fixtures?      |     Write fixtures?     |
| :-------: | :---------------------: | :---------------------: | :---------------------: |
|   live    | :ballot_box_with_check: |                         |                         |
|  preview  | :ballot_box_with_check: | :ballot_box_with_check: |                         |
|  record   | :ballot_box_with_check: |                         | :ballot_box_with_check: |
|   cache   | :ballot_box_with_check: | :ballot_box_with_check: | :ballot_box_with_check: |
|   play    |                         | :ballot_box_with_check: |                         |

* **live** will disable replay and recording completely. All requests will hit
  the network like normal.
* **preview** will replay existing fixtures and send any other requests over the
  network without recording them. This is useful if you are writing new tests
  and want to make sure they pass before recording them.
* **record** will ignore existing fixtures and record new ones. All requests
  will hit the network and be recorded. When you update the requests made in a
  test, you should re-record its fixtures.
* **cache** will replay existing fixtures and record any other requests from the
  network. This is useful if you have written new tests and verified that they
  are correct and ready to be recorded.
* **play** will replay existing fixtures and never hit the network. Any requests
  that do not have a fixture will result in an error. This is the default
  behavior. It is useful if you are done writing tests and want to verify that
  they all pass. Use this mode in CI environments.

## Configuration

ava-nock can be configured using either an `ava-nock` field in your package.json
file, or by importing and calling `configure()`.

### Options

#### decodeResponse

When Nock outputs a response, it is normally minimally altered from how it
arrived. If the response is compressed, Nock will output an array of encoded
buffers. By default, ava-nock will instead attempt to decode responses encoded
with `gzip` and `deflate` so that fixtures are more easily inspectable. If
successful, the relevant `Content-Encoding` header will also be removed from the
saved fixture so that clients don’t attempt to decode it again.

Set this to `false` to leave responses encoded.

#### pathFilter

A function or array of arguments to pass to Nock’s `filteringPath` method on
each scope. The transformation will be applied to both incoming request paths
and outgoing fixture paths.

For example, the following value will cause any saved fixtures to have
`secretKey` query parameters replaced with `secretKey=*`, and will likewise
cause any requests with a `secretKey` value to match against it.

```js
{
  pathFilter: ['([?&]secretKey=)([^&]*)', '$1*']
}
```
