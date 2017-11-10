import test from 'ava'
import request from 'request'
import axios from 'axios'

test('using request', t => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      request(
        {
          url:
            'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json',
          headers: {
            'User-Agent': 'ava-vcr/1.0 (+http://brianbeck.com/)'
          }
        },
        (err, response, body) => {
          if (err) {
            reject(err)
          } else {
            resolve(JSON.parse(body))
          }
        }
      )
    }, 1000)
  }).then(data => {
    t.is(data.name, 'Nirvana')
  })
})

test('using axios', t => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 1000)
  }).then(() =>
    axios
      .get(
        'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json'
      )
      .then(response => {
        return response.data
      })
      .then(data => {
        t.is(data.name, 'Nirvana')
      })
  )
})
