import test from 'ava'
import fetch from 'isomorphic-fetch'

test('using fetch', t => {
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
