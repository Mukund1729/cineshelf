import { fetchTmdb, fetchTmdbImage, TmdbError } from '../services/tmdbService.js';

function sendError(res, error) {
  const status = error instanceof TmdbError ? error.status : 502;
  const code = error instanceof TmdbError ? error.code : 'tmdb_unavailable';
  return res.status(status).json({ success: false, error: code });
}

export async function proxyTmdb(req, res) {
  try {
    const endpoint = req.path.replace(/^\/+|\/+$/g, '');
    const data = await fetchTmdb(endpoint, req.query);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function proxyTmdbImage(req, res) {
  try {
    const { body, contentType } = await fetchTmdbImage(req.params.size, req.params.filename);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(body);
  } catch (error) {
    return sendError(res, error);
  }
}
