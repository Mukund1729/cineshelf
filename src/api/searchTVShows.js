// Search TV shows from TMDB
import axios from 'axios';
import { API_KEY } from './tmdb';

const BASE_URL = 'https://api.themoviedb.org/3';

export const searchTVShows = async (query, options) => {
  if (!query.trim()) return { results: [], totalPages: 0 };
  try {
    const response = await axios.get(`${BASE_URL}/search/tv`, {
      params: {
        api_key: API_KEY,
        language: 'en-US',
        region: 'US',
        query,
        page: options && options.page ? options.page : 1,
      },
    });
    return {
      results: response.data.results,
      totalPages: response.data.total_pages,
    };
  } catch (error) {
    console.error('Search TV shows failed:', error);
    return { results: [], totalPages: 0 };
  }
};
