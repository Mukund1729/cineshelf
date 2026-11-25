import test from 'node:test';
import assert from 'node:assert/strict';
import {
  communityPath,
  journalPath,
  mediaPath,
  personPath,
  reviewPath,
  userPath,
  usernamePath,
} from '../src/lib/entityPaths.js';

test('user paths require a verified ObjectId', () => {
  assert.equal(userPath('64b7f0c2a1b2c3d4e5f60718'), '/people/64b7f0c2a1b2c3d4e5f60718');
  assert.equal(userPath({ _id: '64b7f0c2a1b2c3d4e5f60718' }), '/people/64b7f0c2a1b2c3d4e5f60718');
  assert.equal(userPath('Display Name'), null);
  assert.equal(userPath(null), null);
});

test('username soft paths are reserved for verified-looking handles', () => {
  assert.equal(usernamePath('cinephile'), '/u/cinephile');
  assert.equal(usernamePath('@cinephile'), '/u/cinephile');
  assert.equal(usernamePath('ab'), null);
  assert.equal(usernamePath('bad name'), null);
});

test('media paths never confuse movie and TV identifiers', () => {
  assert.equal(mediaPath({ tmdbId: 550, mediaType: 'movie' }), '/movie/550');
  assert.equal(mediaPath({ tmdbId: 1396, mediaType: 'tv' }), '/tv/1396');
  assert.equal(mediaPath({ originalId: 'ardha', source: 'original' }), '/movie/ardha');
  assert.equal(mediaPath({ originalId: 'x', source: 'original', mediaType: 'tv' }), '/tv/x');
  assert.equal(mediaPath({}), null);
});

test('person, community, review and journal paths', () => {
  assert.equal(personPath(123), '/person/123');
  assert.equal(communityPath('the-nolanverse'), '/community/the-nolanverse');
  assert.equal(communityPath({ slug: 'indian-frames' }, { postId: 'abc' }), '/community/indian-frames?post=abc');
  assert.equal(reviewPath('64b7f0c2a1b2c3d4e5f60718'), '/review/64b7f0c2a1b2c3d4e5f60718');
  assert.equal(journalPath('slow-cinema'), '/journal/slow-cinema');
});
