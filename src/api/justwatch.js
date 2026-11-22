/**
 * Client helper — prefers backend-resolved OTT deep links.
 * Direct JustWatch browser calls are avoided (CORS + reliability).
 */
import axios from 'axios';

export async function fetchMovieOttLinks({ tmdbId, title, year, country = 'IN' }) {
  if (!tmdbId) return null;
  const { data } = await axios.get(`/api/streaming/ott-links/movie/${tmdbId}`, {
    params: { title, year, country },
  });
  return data;
}

/** @deprecated Use fetchMovieOttLinks — kept for older imports */
async function fetchDirectOTTLink() {
  return null;
}

export { fetchDirectOTTLink };
