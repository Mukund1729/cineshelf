// Search TV shows through the server-side TMDB proxy.
import { tmdbGet } from './tmdb';

export const searchTVShows = async (query, options) => {
  if (!query.trim()) return { results: [], totalPages: 0 };
  try {
    const response = await tmdbGet('/search/tv', {
        language: 'en-US',
        region: 'US',
        query,
        page: options && options.page ? options.page : 1,
    });
    return {
      results: response.results,
      totalPages: response.total_pages,
    };
  } catch (error) {
    console.error('Search TV shows failed:', error);
    return { results: [], totalPages: 0 };
  }
};
