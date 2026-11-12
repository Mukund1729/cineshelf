const API_ORIGIN = 'https://api.themoviedb.org/3';
const IMAGE_ORIGIN = 'https://image.tmdb.org/t/p';
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_CACHE_ENTRIES = 500;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const cache = new Map();
const inFlight = new Map();
const IMAGE_SIZES = new Set([
  'w45', 'w92', 'w154', 'w185', 'w200', 'w300', 'w342', 'w400', 'w500',
  'w780', 'w1280', 'original',
]);
const QUERY_KEYS = new Set([
  'append_to_response', 'air_date.gte', 'air_date.lte', 'certification',
  'certification_country', 'first_air_date_year', 'include_adult', 'include_null_first_air_dates', 'type',
  'language', 'page', 'primary_release_date.gte', 'primary_release_date.lte',
  'primary_release_year', 'query', 'region', 'sort_by', 'timezone', 'vote_average.gte',
  'vote_average.lte', 'vote_count.gte', 'vote_count.lte', 'watch_region', 'with_cast',
  'with_companies', 'with_crew', 'with_genres', 'with_keywords', 'with_networks',
  'with_original_language', 'with_origin_country', 'with_people', 'with_release_type',
  'with_runtime.gte', 'with_runtime.lte', 'with_watch_monetization_types',
  'with_watch_providers', 'without_genres', 'year',
]);

export class TmdbError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'TmdbError';
    this.status = status;
    this.code = code;
  }
}

function normalizeEndpoint(endpoint, params) {
  let path = String(endpoint || '').replace(/^\/+|\/+$/g, '');
  if (path.includes('..') || path.includes('\\') || path.includes('%') || path.length > 240) {
    throw new TmdbError(400, 'invalid_endpoint');
  }

  const aliases = {
    popular: 'movie/popular',
    'popular-tv': 'tv/popular',
    'popular-people': 'person/popular',
    'trending-movies': 'trending/movie/week',
    'top-rated': 'movie/top_rated',
    'top-rated-tv': 'tv/top_rated',
  };
  path = aliases[path] || path;

  if (path === 'search') {
    const type = params.type || 'multi';
    if (!['movie', 'tv', 'person', 'multi'].includes(String(type))) {
      throw new TmdbError(400, 'invalid_endpoint');
    }
    delete params.type;
    path = `search/${type}`;
  } else if (path === 'discover') {
    const type = params.type || 'movie';
    if (!['movie', 'tv'].includes(String(type))) throw new TmdbError(400, 'invalid_endpoint');
    delete params.type;
    path = `discover/${type}`;
  }

  const id = '[1-9]\\d{0,11}';
  const allowed = [
    new RegExp(`^(movie|tv|person)/${id}(?:/(?:credits|movie_credits|tv_credits|combined_credits|external_ids|images|videos|reviews|recommendations|similar|watch/providers|release_dates))?$`),
    new RegExp(`^tv/${id}/season/\\d{1,3}$`),
    /^search\/(movie|tv|person|multi)$/,
    /^discover\/(movie|tv)$/,
    /^trending\/(movie|tv|person)\/(day|week)$/,
    /^(movie|tv|person)\/(popular|top_rated|now_playing|upcoming|latest|airing_today|on_the_air|week|day)$/,
    /^genre\/(movie|tv)\/list$/,
  ];
  if (!allowed.some(pattern => pattern.test(path))) throw new TmdbError(404, 'endpoint_not_allowed');
  return path;
}

function normalizeParams(input) {
  const params = { ...input };
  for (const [key, value] of Object.entries(params)) {
    if (!QUERY_KEYS.has(key) || key === 'api_key' || key === 'token') {
      throw new TmdbError(400, 'invalid_query');
    }
    if (value === undefined || value === null) {
      delete params[key];
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new TmdbError(400, 'invalid_query');
    }
    if (String(value).length > 500) throw new TmdbError(400, 'invalid_query');
  }
  if (params.page !== undefined && (!/^\d+$/.test(String(params.page)) || Number(params.page) < 1 || Number(params.page) > 500)) {
    throw new TmdbError(400, 'invalid_query');
  }
  if (params.query !== undefined && !String(params.query).trim()) throw new TmdbError(400, 'invalid_query');
  return params;
}

function getToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token || token.length < 20) throw new TmdbError(503, 'tmdb_unavailable');
  return token;
}

function cacheTtl(path) {
  if (/\/(popular|top_rated|week|day)$/.test(path)) return 5 * 60_000;
  return 60_000;
}

function storeCache(key, value, ttl) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export async function fetchTmdb(endpoint, rawParams = {}) {
  const params = normalizeParams(rawParams);
  const path = normalizeEndpoint(endpoint, params);
  const query = new URLSearchParams(
    Object.keys(params).sort().map(key => [key, String(params[key])]),
  ).toString();
  const cacheKey = `${path}?${query}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_ORIGIN}/${path}${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) {
        const status = response.status === 404 ? 404 : response.status === 429 ? 503 : 502;
        throw new TmdbError(status, response.status === 404 ? 'tmdb_not_found' : 'tmdb_upstream_error');
      }
      const data = await response.json();
      storeCache(cacheKey, data, cacheTtl(path));
      return data;
    } catch (error) {
      if (error instanceof TmdbError) throw error;
      throw new TmdbError(error.name === 'AbortError' ? 504 : 502, error.name === 'AbortError' ? 'tmdb_timeout' : 'tmdb_unavailable');
    } finally {
      clearTimeout(timeout);
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, request);
  return request;
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > MAX_IMAGE_BYTES) throw new TmdbError(413, 'image_too_large');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new TmdbError(413, 'image_too_large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function fetchTmdbImage(size, filename) {
  if (!IMAGE_SIZES.has(size) || typeof filename !== 'string' ||
      !/^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(filename)) {
    throw new TmdbError(400, 'invalid_image_path');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${IMAGE_ORIGIN}/${size}/${encodeURIComponent(filename)}`, {
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) throw new TmdbError(response.status === 404 ? 404 : 502, 'image_unavailable');
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      throw new TmdbError(502, 'invalid_image_response');
    }
    return { body: await readBoundedBody(response), contentType };
  } catch (error) {
    if (error instanceof TmdbError) throw error;
    throw new TmdbError(error.name === 'AbortError' ? 504 : 502, 'image_unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
