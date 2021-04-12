import test from 'ava';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { setupTests } from '../src';

setupTests();

test('using axios', (t) => {
  return axios
    .get(
      'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json'
    )
    .then((response) => response.data)
    .then((data) => {
      t.is(data.name, 'Nirvana');
    });
});

test('using axios to get XML', (t) => {
  return axios
    .get(
      'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=xml'
    )
    .then((response) => response.data)
    .then((data) => {
      t.true(data.startsWith('<'));
    });
});

test('making a request with a filtered secret key', (t) => {
  const secretKey = uuid();
  return axios
    .get(
      `https://musicbrainz.org/ws/2/artist/c8da2e40-bd28-4d4e-813a-bd2f51958ba8?secretKey=${secretKey}`
    )
    .then((response) => response.data)
    .then((data) => {
      t.is(data.name, 'Lures');
    });
});
