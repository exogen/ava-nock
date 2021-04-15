# ava-nock

Drop-in, zero-config HTTP record & replay for
[AVA](https://github.com/avajs/ava)!

Install with npm:

```console
$ npm install ava-nock --save-dev
```

Install with Yarn:

```console
$ yarn add ava-nock --dev
```

## Features

- It just works: call the setup function and you’re good to go, requiring no
  changes to your tests.
- Strict isolation of HTTP calls per test so you can be certain of exactly what
  each test does.
- Recorded fixtures can filter out sensitive values like API keys, auth tokens,
  passwords, etc.
- Compatible with any HTTP client.

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
currently uses the latter approach, so that each test’s requests are completely
isolated from one another.

## Usage

Import and run the `setupTests()` function in any test files that make network
requests. This function will add `beforeEach`, `afterEach`, and
`afterEach.always` hooks that manage Nock fixtures for you.

```js
import test from 'ava';
import fetch from 'isomorphic-fetch';
import { setupTests } from 'ava-nock';

setupTests();

test('using fetch to get JSON', async (t) => {
  const response = await fetch(
    'https://musicbrainz.org/ws/2/artist/c8da2e40-bd28-4d4e-813a-bd2f51958ba8?fmt=json'
  );
  const data = await response.json();
  t.is(data.name, 'Lures');
});
```

Fixtures behave similarly to AVA snapshots: they are stored in a `.nock` file
alongside snapshots, named after the test file that generated them. Within each
fixture, each test’s requests and responses are stored for later playback.

Note that due to the way Nock works by globally intercepting requests to the
`http` and `https` modules, each test in a file that calls `setupTests()` will
effectively be run serially – otherwise there is no way to isolate requests
per-test. The `beforeEach` hook will enforce this for you automatically.
Parallel tests running in different processes are not affected.

## Modes

You can control ava-nock’s behavior using the `NOCK_MODE` environment variable.

| NOCK_MODE |    Network requests?    |     Read fixtures?      |     Write fixtures?     |
| :-------: | :---------------------: | :---------------------: | :---------------------: |
|   live    | :ballot_box_with_check: |                         |                         |
|  preview  | :ballot_box_with_check: | :ballot_box_with_check: |                         |
|  record   | :ballot_box_with_check: |                         | :ballot_box_with_check: |
|   cache   | :ballot_box_with_check: | :ballot_box_with_check: | :ballot_box_with_check: |
|   play    |                         | :ballot_box_with_check: |                         |

- **live** will disable replay and recording completely. All requests will hit
  the network like normal.
- **preview** will replay existing fixtures and send any other requests over the
  network without recording them. This is useful if you are writing new tests
  and want to make sure they pass before recording them.
- **record** will ignore existing fixtures and record new ones. All requests
  will hit the network and be recorded. When you update the requests made in a
  test, you should re-record its fixtures.
- **cache** will replay existing fixtures and record any other requests from the
  network. This is useful if you have written new tests and verified that they
  are correct and ready to be recorded.
- **play** will replay existing fixtures and never hit the network. Any requests
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
with `gzip`, `deflate`, and `br` so that fixtures are more easily inspectable.
If successful, the relevant `Content-Encoding` header will also be removed from
the saved fixture so that clients don’t attempt to decode it again.

Set this to `false` to leave responses encoded.

#### fixtureDir

The directory relative to each test file in which to store Nock fixtures. The
output structure mirrors how AVA’s snapshots work: if your test file is at
`src/file.test.js`, and this is set to `fixtures`, the fixture file will be
`src/fixtures/file.test.js.nock`.

If unset, it will use same directory as snapshots via AVA’s
`meta.snapshotDirectory` value if available, or a default value of `snapshots`
otherwise.

#### headerFilter

An object mapping header names to replacement functions or arrays of arguments
to pass to `.replace()` on the header value. The transformation will be applied
to outgoing fixtures for _both the request headers and response headers_. This
means that the filtered response headers will be used when the test is replayed,
so you should ensure that no part of your test depends on the filtered value of
the headers; otherwise, your test could pass when being recorded and fail when
played back, or vice versa.

If the replacement result is an empty string or null, the header will be removed
from the fixture entirely.

```js
{
  headerFilter: {
    authorization: ['^(Bearer|Basic) .+$', '$1 <secret>'];
  }
}
```

#### pathFilter

A function or array of arguments to pass to Nock’s `filteringPath` method on
each scope. The transformation will be applied to both incoming request paths
and outgoing fixture paths.

For example, the following value will cause any saved fixtures to have
`secretKey` query parameters replaced with `secretKey=<secret>`, and will
likewise cause any requests with a `secretKey` value to match against it. The
replacement value (`<secret>` in this example) is not meaningful, it can be any
value you deem suitable to store in your fixtures. The requests themselves will
be sent with their original, unaltered `secretKey` – but it will be censored in
the fixture. This way you can use sensitive values in your requests but keep
them out of source control.

```js
{
  pathFilter: ['([?&]secretKey=)([^&#]+)', '$1<secret>'];
}
```

#### requestBodyFilter

A function or array of arguments to pass to Nock’s `filteringRequestBody` method
on each scope. The transformation will be applied to both incoming request
bodies and outgoing fixture bodies.

Note that it’s possible for Nock to output the request body as something other
than a string; for example, if it detects that it’s a JSON object. In this case,
ava-nock will call `JSON.stringify` on it first so that `filteringRequestBody`
always receives a string.

#### responseBodyFilter

A function or array of arguments to pass to `.replace()` on the response body
string. The transformation will be applied to outgoing fixture responses,
meaning that the filtered response body will be used when the test is replayed.
This means you should ensure that no part of your test depends on the filtered
part of the response; otherwise, your test could pass when being recorded and
fail when played back, or vice versa.

Note that it’s possible for Nock to output the response body as something other
than a string; for example, if the response is still encoded, or if it detects
that it’s a JSON object. In this case, ava-nock will call `JSON.stringify` on it
first.
