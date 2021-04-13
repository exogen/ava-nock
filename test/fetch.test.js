import test from 'ava';
import fetch from 'isomorphic-fetch';
import { setupTests } from '../src';

setupTests();

test('using fetch to get JSON', async (t) => {
  const response = await fetch(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json'
  );
  const data = await response.json();
  t.is(data.name, 'Nirvana');
  t.snapshot(data);
});

test('using fetch to get XML', async (t) => {
  const response = await fetch(
    'https://musicbrainz.org/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da'
  );
  const data = await response.text();
  t.true(data.startsWith('<'));
});

test('another test', (t) => {
  t.is('foo', 'foo');
});
