import test from 'ava'
import fetch from 'isomorphic-fetch'
import { setupTests } from '../src'

setupTests()

test('using fetch to get JSON', t => {
  return fetch(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json'
  )
    .then(response => {
      return response.json()
    })
    .then(data => {
      t.is(data.name, 'Nirvana')
    })
})

test('using fetch to get XML', t => {
  return fetch(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da'
  )
    .then(response => {
      return response.text()
    })
    .then(data => {
      t.true(data.startsWith('<'))
    })
})

// Duplicate test title.
test('using fetch to get XML', t => {
  return fetch(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da'
  )
    .then(response => {
      return response.text()
    })
    .then(data => {
      t.true(data.startsWith('<'))
    })
})

test('another test', t => {
  t.is('foo', 'foo')
})

// An anonymous test.
test(t => {
  t.is('bar', 'bar')
})
