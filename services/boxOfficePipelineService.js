import { getMovieBoxOfficeReports } from './boxOfficeDataService.js';

export async function syncMovieBoxOffice(tmdbId) {
  const numericId = Number(tmdbId);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error('A positive TMDB ID is required.');
  }
  return getMovieBoxOfficeReports(numericId);
}
