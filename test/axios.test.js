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

test('making a request with a filtered password', async (t) => {
  const username = 'hello';

  const response = await axios.post('https://postman-echo.com/post', {
    username,
    // Why are we filtering this if the example password is here in source
    // control anyway? In real tests, this would more likely come from an
    // environment variable, so it wouldn't be in source control. But it would
    // be exposed in the fixtures, so we need to test for filtering it there.
    password: 'world',
  });

  const { data } = response;
  t.is(data.data.username, username);
  // This particular endpoint echoes back the input data, so we actually need to
  // filter the response body too, which affects the actual response in this
  // case. Here we're testing for both the censored value (when the test is
  // played back) and the input value (when the test is recorded).
  t.true(data.data.password === 'world' || data.data.password === '<secret>');
});

test('making a request with filtered headers', async (t) => {
  const response = await axios.get('https://postman-echo.com/get', {
    headers: {
      Authorization: 'Bearer abc123',
    },
  });

  const { data } = response;
  t.true(
    data.headers.authorization === 'Bearer abc123' ||
      data.headers.authorization === '<secret>'
  );
});
