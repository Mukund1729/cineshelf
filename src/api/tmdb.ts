import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export const API_KEY = (import.meta as any).env.VITE_TMDB_KEY || (import.meta as any).env.VITE_TMDB_API_KEY;

// Extend ImportMetaEnv for Vite (do not redeclare ImportMeta!)
interface ImportMetaEnv {
  readonly VITE_TMDB_KEY?: string;
  readonly VITE_TMDB_API_KEY?: string;
  // add other env variables here if needed
}

// Extend the ImportMeta interface to include 'env'
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Type definitions (could also be in separate types.ts file)
interface CrewMember {
  id: number;
  name: string;
  job: string;
  known_for_department: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  popularity?: number;
}

interface VideoResult {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  size: number;
  published_at: string;
}

interface ReleaseDate {
  iso_3166_1: string;
  release_dates: Array<{
    certification: string;
    release_date: string;
  }>;
}

interface Genre {
  id: number;
  name: string;
}

interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

interface TmdbMovieResponse {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  vote_average: number;
  release_date: string;
  runtime: number;
  revenue: number;
  budget: number;
  poster_path: string | null;
  backdrop_path: string | null;
  videos?: {
    results: VideoResult[];
  };
  credits?: {
    crew: CrewMember[];
    cast: CastMember[];
  };
  genres: Genre[];
  release_dates?: {
    results: ReleaseDate[];
  };
  status: string;
  original_language: string;
  popularity: number;
  tagline: string;
  imdb_id?: string;
  homepage?: string;
  production_companies: ProductionCompany[];
}

interface MovieDetail {
  id: number;
  title: string;
  overview: string;
  rating: number;
  releaseDate: string | null;
  runtime: string;
  revenue: string;
  budget: string;
  poster_path: string;
  backdrop_path: string;
  trailer: string | null;
  director: string;
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string;
    popularity?: number;
  }>;
  genres: string[];
  certification: string;
  status: string;
  original_language: string;
  popularity: number;
  tagline: string;
  imdb_id: string | null;
  homepage: string | null;
  production_companies: Array<{
    id: number;
    name: string;
    logo_path: string;
    origin_country: string;
  }>;
}

const BASE_URL = 'https://api.themoviedb.org/3';

if (!API_KEY) {
  throw new Error('TMDB API key missing. Set VITE_TMDB_KEY or VITE_TMDB_API_KEY in .env');
}

// Configure axios instance with better defaults
const tmdbAPI = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // Increased timeout
  params: {
    api_key: API_KEY,
    language: 'en-US',
    region: 'US' // Default region
  },
  headers: {
    'Accept': 'application/json'
  }
});

// Add request interceptor for logging
tmdbAPI.interceptors.request.use((config) => {
  console.debug(`Requesting: ${config.url}`);

  return config;
});

// Add response interceptor for error handling
tmdbAPI.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      console.error('TMDB API Error:', {
        status: error.response.status,
        url: error.config?.url,  // Safe access with optional chaining
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Request made but no response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    return Promise.reject(error);
  }
);

// Helper functions with memoization for better performance
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, fn(...args));
    }
    return cache.get(key)!;
  }) as T;
};

const normalizeRating = memoize((voteAverage: number): number => {
  if (!voteAverage) return 0;
  const normalized = parseFloat((voteAverage / 2).toFixed(1));
  return Math.min(Math.max(normalized, 0), 5);
});

const formatRuntime = memoize((minutes: number): string => {
  if (!minutes) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
return `${hours}h ${mins}m`;
});

const formatRevenue = memoize((amount: number): string => {
  if (!amount) return 'N/A';
  if (amount >= 1_000_000_000) return  `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000)return `$${(amount / 1_000_000).toFixed(1)}M`;

return `$${amount.toLocaleString()}`;
});

const getImagePath = memoize((path: string | null, size: string = 'original'): string => {
  const placeholder = '/placeholder-movie.jpg';
  if (!path) return placeholder;
  
  try {
    new URL(path);
    return path;
  } catch {
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
});

const getDirector = memoize((crew?: CrewMember[]): string => {
  if (!crew) return 'Unknown';
  const director = crew.find(person =>
    ['Director', 'Co-Director'].includes(person.job) ||
    person.known_for_department === 'Directing'
  );
  return director?.name || 'Unknown';
});

const getTopCast = memoize((cast?: CastMember[], limit: number = 5): MovieDetail['cast'] => {
  if (!cast) return [];
  return cast.slice(0, limit).map(actor => ({
    id: actor.id,
    name: actor.name,
    character: actor.character || 'Unknown',
    profile_path: getImagePath(actor.profile_path, 'w185'),
    popularity: actor.popularity || 0
  }));
});

const findTrailer = memoize((videos?: VideoResult[]): string | null => {
  if (!videos?.length) return null;

  const preferredTrailers = videos
    .filter(v => v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type))
    .sort((a, b) => {
      // Prioritize official trailers
      if (a.official !== b.official) return a.official ? -1 : 1;
      // Then by size (HD first)
      if (a.size !== b.size) return b.size - a.size;
      // Then by recency
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    }); // ✅ Correct closing parenthesis here

  return preferredTrailers.length
    ? `https://youtube.com/watch?v=${preferredTrailers[0].key}`
    : null;
}); // ✅ Properly closes memoize



const getCertification = memoize((releaseDates?: ReleaseDate[]): string => {
  if (!releaseDates) return 'NR';
  
  const usRelease = releaseDates.find(rd => rd.iso_3166_1 === 'US');
  const certification = usRelease?.release_dates
    ?.sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
    ?.[0]?.certification;
  
  return certification || 'NR';
});

const normalizeMovieData = (data: TmdbMovieResponse): MovieDetail => {
  if (!data) throw new Error('No data provided to normalize');
  
  return {
    id: data.id,
    title: data.title || data.original_title || 'Untitled Movie',
    overview: data.overview || 'No synopsis available.',
    rating: normalizeRating(data.vote_average),
    releaseDate: data.release_date || null,
    runtime: formatRuntime(data.runtime),
    revenue: formatRevenue(data.revenue),
    budget: formatRevenue(data.budget),
    poster_path: getImagePath(data.poster_path, 'w500'),
    backdrop_path: getImagePath(data.backdrop_path),
    trailer: findTrailer(data.videos?.results),
    director: getDirector(data.credits?.crew),
    cast: getTopCast(data.credits?.cast),
    genres: data.genres?.map(g => g.name) || ['Unknown'],
    certification: getCertification(data.release_dates?.results),
    status: data.status || 'Unknown',
    original_language: data.original_language || 'en',
    popularity: data.popularity || 0,
    tagline: data.tagline || '',
    imdb_id: data.imdb_id || null,
    homepage: data.homepage || null,
    production_companies: data.production_companies?.map(c => ({
      id: c.id,
      name: c.name,
      logo_path: getImagePath(c.logo_path),
      origin_country: c.origin_country
    })) || []
  };
};

const getFallbackMovieData = (id: string | number, error: AxiosError): MovieDetail => {
  const statusCode = error.response?.status;
  const isOffline = !navigator.onLine;
  
  return {
    id: typeof id === 'string' ? parseInt(id, 10) : id,
    title: 'Error Loading Movie',
    overview: isOffline
      ? 'You appear to be offline. Please check your internet connection.'
      : statusCode === 404
        ? 'Movie not found in our database.'
        : statusCode === 401
          ? 'Authentication failed. Please check your API key.'
          : 'Failed to load movie details. Please try again later.', // Fixed: replaced semicolon with comma
    rating: 0,
    releaseDate: null,
    runtime: 'N/A',
    revenue: 'N/A',
    budget: 'N/A',
    poster_path: '/placeholder-movie.jpg',
    backdrop_path: '', // changed from null to empty string
    trailer: null,
    director: 'Unknown',
    cast: [],
    genres: ['Error'],
    certification: 'NR',
    status: 'Error',
    original_language: 'en',
    popularity: 0,
    tagline: '',
    imdb_id: null,
    homepage: null,
    production_companies: []
  };
};

// Enhanced cache with TTL and size limit
const MAX_CACHE_SIZE = 100;
const cache = new Map<string, { data: MovieDetail; timestamp: number }>();

const getFromCache = (key: string): MovieDetail | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  
  // Check if cache entry is expired (30 minutes TTL)
  if (Date.now() - cached.timestamp > 30 * 60 * 1000) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
};

const addToCache = (key: string, data: MovieDetail): void => {
  // Prevent cache from growing too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = [...cache.entries()]
      .reduce((oldest, [key, { timestamp }]) => 
        timestamp < oldest.timestamp ? { key, timestamp } : oldest, 
        { key: '', timestamp: Date.now() }).key;
    cache.delete(oldestKey);
  }
  
  cache.set(key, { data, timestamp: Date.now() });
};

export const fetchMovieDetails = async (
  id: string | number,
  options?: { appendToResponse?: string; forceRefresh?: boolean }
): Promise<MovieDetail> => {
  const cacheKey = `movie-${id}`;
  
  if (!options?.forceRefresh) {
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return cachedData;
  }

  try {
    const config: AxiosRequestConfig = {
      params: {
        append_to_response: options?.appendToResponse || 'credits,release_dates,videos,images,external_ids'
      }
    };

const response = await tmdbAPI.get<TmdbMovieResponse>(`/movie/${id}`);
    const normalizedData = normalizeMovieData(response.data);
    
    addToCache(cacheKey, normalizedData);
    return normalizedData;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
console.warn(`Movie ${id} not found`);
      } else if (error.response?.status === 401) {
        console.error('Invalid TMDB API key');
      } else if (error.code === 'ECONNABORTED') {
        console.warn('Request timeout');
      }
    }
    
    return getFallbackMovieData(id, error as AxiosError);
  }
};

export const searchMovies = async (
  query: string,
  options?: { page?: number; year?: number; includeAdult?: boolean }
): Promise<{ results: MovieDetail[]; totalPages: number }> => {
  if (!query.trim()) return { results: [], totalPages: 0 };
  
  try {
    const response = await tmdbAPI.get<{
      results: TmdbMovieResponse[];
      total_pages: number;
    }>('/search/movie', {
      params: {
        query,
        page: options?.page || 1,
        year: options?.year,
        include_adult: options?.includeAdult || false
      }
    });
    
    return {
      results: response.data.results.map(normalizeMovieData),
      totalPages: response.data.total_pages
    };
  } catch (error) {
    console.error('Search failed:', error);
    return { results: [], totalPages: 0 };
  }
};

export const fetchWeeklyTrendingMovies = async (): Promise<MovieDetail[]> => {
  try {
    const response = await tmdbAPI.get<{ results: TmdbMovieResponse[] }>('/trending/movie/week');
    return response.data.results.map(normalizeMovieData);
  } catch (error) {
    console.error('Failed to fetch weekly trending movies:', error);
    return [];
  }
};

export const fetchPopularTVShows = async (page = 1) => {
  try {
    const response = await tmdbAPI.get('/tv/popular', { params: { page } });
    return response.data.results;
  } catch (error) {
    console.error('Failed to fetch popular TV shows:', error);
    return [];
  }
};

export const fetchPopularPeople = async (page: number = 1) => {
  try {
    const response = await tmdbAPI.get('/person/popular', { params: { page } });
    console.log('Popular People API response:', response.data); // Debug log
    return response.data.results.map(person => ({
      id: person.id,
      name: person.name,
      profile_path: getImagePath(person.profile_path, 'w300'),
      known_for: person.known_for_department,
      popularity: person.popularity,
      known_for_titles: person.known_for?.map(kf => kf.title || kf.name).filter(Boolean) || []
    }));
  } catch (error) {
    console.error('Failed to fetch popular people:', error);
    return [];
  }
};

export const fetchTopRatedMovies = async (page: number = 1): Promise<MovieDetail[]> => {
  try {
    const response = await tmdbAPI.get<{ results: TmdbMovieResponse[] }>('/movie/top_rated', {
      params: { page }
    });
    // For each movie, fetch details (including videos) and normalize
    const moviePromises = response.data.results.map(async (movie) => {
      try {
const detailResp = await tmdbAPI.get(`/movie/${movie.id}`, {
          params: { append_to_response: 'credits,release_dates,videos,images,external_ids' }
        });
        return normalizeMovieData(detailResp.data);
      } catch (err) {
        return null;
      }
    });
    const movies = await Promise.all(moviePromises);
    return movies.filter((item): item is MovieDetail => Boolean(item));
  } catch (error) {
    console.error('Failed to fetch top rated movies:', error);
    return [];
  }
};

export const fetchTopRatedTVShows = async (page: number = 1): Promise<MovieDetail[]> => {
  try {
    const response = await tmdbAPI.get<{ results: any[] }>('/tv/top_rated', { params: { page } });
    // For each TV show, fetch details (including credits) and normalize
    const tvShowPromises = response.data.results.map(async (show) => {
      try {
const detailResp = await tmdbAPI.get(`/tv/${show.id}`, {
          params: { append_to_response: 'credits,release_dates,videos,images,external_ids' }
        });
        // Map TV show fields to MovieDetail structure
        return {
          id: detailResp.data.id,
          title: detailResp.data.name || detailResp.data.original_name || 'Untitled TV Show',
          overview: detailResp.data.overview || 'No synopsis available.',
          rating: normalizeRating(detailResp.data.vote_average),
          releaseDate: detailResp.data.first_air_date || null,
          runtime: detailResp.data.episode_run_time && detailResp.data.episode_run_time.length > 0 ? formatRuntime(detailResp.data.episode_run_time[0]) : 'N/A',
          revenue: 'N/A',
          budget: 'N/A',
          poster_path: getImagePath(detailResp.data.poster_path, 'w500'),
          backdrop_path: getImagePath(detailResp.data.backdrop_path),
          trailer: findTrailer(detailResp.data.videos?.results),
          director: getDirector(detailResp.data.credits?.crew),
          cast: getTopCast(detailResp.data.credits?.cast),
          genres: detailResp.data.genres?.map(g => g.name) || ['Unknown'],
          certification: 'TV',
          status: detailResp.data.status || 'Unknown',
          original_language: detailResp.data.original_language || 'en',
          popularity: detailResp.data.popularity || 0,
          tagline: detailResp.data.tagline || '',
          imdb_id: detailResp.data.external_ids?.imdb_id || null,
          homepage: detailResp.data.homepage || null,
          production_companies: detailResp.data.production_companies?.map(c => ({
            id: c.id,
            name: c.name,
            logo_path: getImagePath(c.logo_path),
            origin_country: c.origin_country
          })) || []
        };
      } catch (err) {
        return null;
      }
    });
    const tvShows = await Promise.all(tvShowPromises);
    // Filter out nulls and assert type
    return tvShows.filter((item): item is MovieDetail => Boolean(item));
  } catch (error) {
    console.error('Failed to fetch top rated TV shows:', error);
    return [];
  }
};

export const clearCache = (): void => {
  cache.clear();
  console.log('TMDB API cache cleared');
};

// Utility for development
export const mockMovieData = (overrides: Partial<MovieDetail> = {}): MovieDetail => ({
  id: Math.floor(Math.random() * 10000),
  title: 'Sample Movie',
  overview: 'This is a sample movie description.',
  rating: 4.2,
  releaseDate: '2023-01-01',
  runtime: '2h 15m',
  revenue: '$150.5M',
  budget: '$50M',
  poster_path: '/sample-poster.jpg',
  backdrop_path: '/sample-backdrop.jpg',
  trailer: null,
  director: 'Sample Director',
  cast: [],
  genres: ['Action', 'Adventure'],
  certification: 'PG-13',
  status: 'Released',
  original_language: 'en',
  popularity: 75.5,
  tagline: 'This is a sample tagline',
  imdb_id: 'tt1234567',
  homepage: 'https://example.com',
  production_companies: [],
  ...overrides
});

// --- TMDB API: Popular, Trending, TV, People ---
// Utility functions for simple fetches (no normalization)

// Fallback: Return empty popular movies result to avoid import errors
export const getPopularMovies = async (page = 1) => {
  return { results: [], page: 1, total_pages: 1 };
};

// Use backend proxy for popular TV shows (add this export)
export const getPopularTVShows = async () => {
  try {
    // If you add a backend proxy route, use it here (e.g., '/api/tmdb/popular-tv')
    // For now, fetch directly from TMDB as fallback
    const res = await tmdbAPI.get('/tv/popular');
    return res.data.results;
  } catch (error) {
    console.error('Failed to fetch popular TV shows:', error);
    return [];
  }
};

export async function getWeeklyTrendingMovies() {
  const res = await tmdbAPI.get('/trending/movie/week');
  return res.data.results;
}

export async function getPopularPeople() {
  const res = await tmdbAPI.get('/person/popular', {
    params: { language: 'en-US', page: 1 }
  });
  return res.data.results;
}

// Fetch trending movies for a given time window (day or week)
export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week') {
  const res = await tmdbAPI.get(`/trending/movie/${timeWindow}`);
  return res.data.results;
}

// Example usage (for dev):
// getPopularMovies().then(console.log);
// getWeeklyTrendingMovies().then(console.log);
// getPopularTVShows().then(console.log);
// getPopularPeople().then(console.log);

export const searchPeople = async (
  query: string,
  options?: { page?: number }
): Promise<{ results: any[]; totalPages: number }> => {
  if (!query.trim()) return { results: [], totalPages: 0 };
  try {
    const response = await tmdbAPI.get<{ results: any[]; total_pages: number }>(
      '/search/person',
      {
        params: {
          query,
          page: options?.page || 1,
        },
      }
    );
    return {
      results: response.data.results,
      totalPages: response.data.total_pages,
    };
  } catch (error) {
    console.error('Search people failed:', error);
    return { results: [], totalPages: 0 };
  }
};

// Fetch watch providers for a movie (returns region link and flatrate providers)
export const fetchWatchProviders = async (movieId: string | number, region: string = 'IN') => {
  try {
    const response = await tmdbAPI.get(`/movie/${movieId}/watch/providers`);
    const regionData = response.data.results?.[region];
    if (regionData && regionData.flatrate && regionData.flatrate.length > 0 && regionData.link) {
      return {
        link: regionData.link,
        providers: regionData.flatrate
      };
    }
    return { link: null, providers: [] };
  } catch (error) {
    console.error('Failed to fetch watch providers:', error);
    return { link: null, providers: [] };
  }
};