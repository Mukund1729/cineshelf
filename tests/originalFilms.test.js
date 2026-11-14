import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOriginalWatchlistEntries,
  mergeMissingOriginalWatchlistMovies,
  ORIGINAL_FILMS,
} from '../data/originalFilms.js';

test('original short-film catalog preserves supplied runtimes and direct film URLs', () => {
  const ardha = ORIGINAL_FILMS.find(film => film.slug === 'ardha');
  const hasrat = ORIGINAL_FILMS.find(film => film.slug === 'hasrat');

  assert.equal(ardha.runtimeSeconds, 224);
  assert.equal(ardha.watchUrl, 'https://www.youtube.com/watch?v=ka91IGKrJDw&t=5s');
  assert.equal(hasrat.runtimeSeconds, 356);
  assert.equal(hasrat.watchUrl, 'https://www.youtube.com/watch?v=TWVRimTq0fE');
});

test('watchlist seed migration adds only missing original films', () => {
  const seeds = getOriginalWatchlistEntries();
  const existing = [{ ...seeds[0], title: 'User-edited title', addedAt: new Date('2025-01-01') }];
  const missing = mergeMissingOriginalWatchlistMovies(existing, seeds);

  assert.equal(missing.length, 1);
  assert.equal(missing[0].originalId, 'hasrat');
  assert.equal(existing[0].title, 'User-edited title');
  assert.equal(mergeMissingOriginalWatchlistMovies([...existing, ...missing], seeds).length, 0);
});
