import { tmdbGet } from './tmdb';

export const getPopularMovies = async (page = 1) => {
  try {
    const response = await tmdbGet('/movie/popular', { language: 'en-US', page });
    return response.results;
  } catch (error) {
    console.error('Failed to fetch popular movies:', error);
    return [];
  }
};
