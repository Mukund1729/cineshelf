import axios from 'axios';

// Use Vite env variable for TMDB API key
const apiKey = import.meta.env.VITE_TMDB_KEY || import.meta.env.VITE_TMDB_API_KEY;

export const getPopularMovies = async (page = 1) => {
  const url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=${page}`;
  try {
    const response = await axios.get(url);
    return response.data.results;
  } catch (error) {
    console.error('Failed to fetch popular movies:', error);
    return [];
  }
};
