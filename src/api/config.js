const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

// Production requests stay on the frontend origin so browsers accept the
// HTTP-only session cookie; the hosting platform proxies /api to the backend.
export const API_BASE_URL = import.meta.env.PROD ? '' : configuredApiBaseUrl;

export function apiUrl(path) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}
