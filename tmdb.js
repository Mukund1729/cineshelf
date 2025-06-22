import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type {
  VideoResult,
  CrewMember,
  CastMember,
  ReleaseDate,
  Genre,
  TmdbMovieResponse,
  MovieDetail
} from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = import.meta.env.VITE_TMDB_KEY;

// Configure axios instance
const tmdbAPI = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  params: {
    api_key: API_KEY,
    language: 'en-US',
  },
  headers: {
    'Accept-Encoding': 'gzip,deflate,compress',
  },
});

// ========== NEW FUNCTION ==========
// Used by React Query in App.tsx
export const fetchMovies = async (query: string = '') => {
  const endpoint = query
    ? `/search/movie?query=${encodeURIComponent(query)}`
    : '/movie/popular';

  const response = await tmdbAPI.get(endpoint);
  return response.data;
};

// ========== EXISTING MOVIE DETAIL LOGIC ==========
const normalizeRating = (voteAverage: number): number => {
  if (!voteAverage) return 0;
  const normalized = parseFloat((voteAverage / 2).toFixed(1));
  return Math.min(Math.max(normalized, 0), 5);
};

const formatRuntime = (minutes: number): string => {
  if (!minutes) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const formatRevenue = (amount: number): string => {
  if (!amount) return 'N/A';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  return `$${amount.toLocaleString()}`;
};

const getImagePath = (path: string | null, size: string): string => {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : '/placeholder-movie.jpg';
};

const getDirector = (crew?: CrewMember[]): string => {
  if (!crew) return 'Unknown';
  const director = crew.find(person =>
    person.job === 'Director' ||
    person.known_for_department === 'Directing'
  );
  return director?.name || 'Unknown';
};

const getTopCast = (cast?: CastMember[], limit: number = 10): MovieDetail['cast'] => {
  if (!cast) return [];
  return cast.slice(0, limit).map(actor => ({
    id: actor.id,
    name: actor.name,
    character: actor.character || 'Unknown',
    profile_path: getImagePath(actor.profile_path, 'w185')
  }));
};

const findTrailer = (videos?: VideoResult[]): string | null => {
  if (!videos) return null;
  const trailer = videos.find(v =>
    v.type === 'Trailer' &&
    v.site === 'YouTube'
  );
  return trailer ? `https://youtube.com/watch?v=${trailer.key}` : null;
};

const getCertification = (releaseDates?: ReleaseDate[]): string => {
  if (!releaseDates) return 'NR';
  const usRelease = releaseDates.find(rd => rd.iso_3166_1 === 'US');
  return usRelease?.release_dates[0]?.certification || 'NR';
};

const normalizeMovieData = (data: TmdbMovieResponse): MovieDetail => ({
  id: data.id,
  title: data.title || 'Untitled Movie',
  overview: data.overview || 'No synopsis available.',
  rating: normalizeRating(data.vote_average),
  releaseDate: data.release_date || null,
  runtime: formatRuntime(data.runtime),
  revenue: formatRevenue(data.revenue),
  budget: formatRevenue(data.budget),
  poster_path: getImagePath(data.poster_path, 'w500'),
  backdrop_path: getImagePath(data.backdrop_path, 'original'),
  trailer: findTrailer(data.videos?.results),
  director: getDirector(data.credits?.crew),
  cast: getTopCast(data.credits?.cast, 10),
  genres: data.genres?.map(g => g.name) || ['Unknown'],
  certification: getCertification(data.release_dates?.results),
  status: data.status || 'Unknown',
});

const getFallbackMovieData = (id: string | number, error: AxiosError): MovieDetail => ({
  id: typeof id === 'string' ? parseInt(id, 10) : id,
  title: 'Error Loading Movie',
  overview: error.response?.status === 404
    ? 'Movie not found in our database.'
    : 'Failed to load movie details. Please try again later.',
  rating: 0,
  releaseDate: null,
  runtime: 'N/A',
  revenue: 'N/A',
  budget: 'N/A',
  poster_path: '/placeholder-movie.jpg',
  backdrop_path: null,
  trailer: null,
  director: 'Unknown',
  cast: [],
  genres: ['Error'],
  certification: 'NR',
  status: 'Error',
});

const cache = new Map<string, MovieDetail>();

export const fetchMovieDetails = async (id: string | number): Promise<MovieDetail> => {
  const cacheKey = `movie-${id}`;

  try {
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const config: AxiosRequestConfig = {
      params: { append_to_response: 'credits,release_dates,videos' }
    };

    const response = await tmdbAPI.get<TmdbMovieResponse>(`/movie/${id}`, config);
    const normalizedData = normalizeMovieData(response.data);

    cache.set(cacheKey, normalizedData);
    return normalizedData;

  } catch (error) {
    console.error(`TMDB API Error for movie ${id}:`, error);
    return getFallbackMovieData(id, error as AxiosError);
  }
};
