import test from 'ava'
import axios from 'axios'
import { setupTests } from '../src'

setupTests()

test('using axios', t => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 1000)
  }).then(() =>
    axios
      .get(
        'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json'
      )
      .then(response => response.data)
      .then(data => {
        t.is(data.name, 'Nirvana')
      })
  )
})

test('using axios to get XML', t => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 1000)
  }).then(() =>
    axios
      .get(
        'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=xml'
      )
      .then(response => response.data)
      .then(data => {
        t.true(data.startsWith('<'))
      })
  )
})
