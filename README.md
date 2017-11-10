# ava-nock

```console
$ npm install ava-nock --save-dev
```

```console
$ yarn add ava-nock --dev
```

## Usage

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
  will hit the network and be recorded. Note that this might leave you with
  fixtures that are no longer used and should be cleaned up – you may wish to
  delete your fixture directory before running in this mode.
* **cache** will replay existing fixtures and record any other requests from the
  network. This is useful if you have written new tests and verified that they
  are correct and ready to be recorded.
* **play** will replay existing fixtures and never hit the network. Any requests
  that do not have a fixture will result in an error. This is the default
  behavior. It is useful if you are done writing tests and want to verify that
  they all pass. Use this mode in CI environments.
