import test from 'ava';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { setupTests } from '../src';

setupTests();

test('using axios', async (t) => {
  const { data } = await axios.get(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json'
  );
  t.is(data.name, 'Nirvana');
  t.snapshot(data);
});

test('using axios to get XML', async (t) => {
  const { data } = await axios.get(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=xml'
  );
  t.true(data.startsWith('<'));
});

test('making a request with a filtered secret key', async (t) => {
  const secretKey = uuid();
  const response = await axios.get(
    `https://musicbrainz.org/ws/2/artist/c8da2e40-bd28-4d4e-813a-bd2f51958ba8?secretKey=${secretKey}`
  );
  const { data } = response;
  t.is(data.name, 'Lures');
  t.snapshot(data);
});
