/**
 * Canonical path builders for CineShelf entities.
 * Always prefer a verified id (user ObjectId, TMDB id, community slug).
 * Never invent a destination from an unverified display name alone.
 */

export function userPath(userOrId) {
  if (!userOrId) return null;
  if (typeof userOrId === 'string' || typeof userOrId === 'number') {
    const id = String(userOrId);
    return /^[a-f\d]{24}$/i.test(id) ? `/people/${id}` : null;
  }
  const id = userOrId._id || userOrId.id;
  return id ? `/people/${id}` : null;
}

/** Soft destination for @username text until the ObjectId is known. */
export function usernamePath(username) {
  const clean = String(username || '').trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(clean)) return null;
  return `/u/${encodeURIComponent(clean)}`;
}

export function mediaPath({ id, tmdbId, originalId, source, mediaType } = {}) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const key = source === 'original'
    ? (originalId || id)
    : (tmdbId || id);
  if (key === undefined || key === null || key === '') return null;
  return `/${type}/${key}`;
}

export function personPath(personOrId) {
  if (!personOrId) return null;
  const id = typeof personOrId === 'object' ? (personOrId.id || personOrId._id) : personOrId;
  if (id === undefined || id === null || id === '') return null;
  return `/person/${id}`;
}

export function communityPath(communityOrSlug, { postId } = {}) {
  const slug = typeof communityOrSlug === 'object'
    ? communityOrSlug?.slug
    : communityOrSlug;
  if (!slug) return null;
  return postId ? `/community/${slug}?post=${postId}` : `/community/${slug}`;
}

export function reviewPath(reviewOrId) {
  const id = typeof reviewOrId === 'object' ? reviewOrId?._id : reviewOrId;
  return id ? `/review/${id}` : null;
}

export function journalPath(articleOrSlug) {
  const slug = typeof articleOrSlug === 'object' ? articleOrSlug?.slug : articleOrSlug;
  return slug ? `/journal/${slug}` : null;
}

export function absoluteUrl(path) {
  if (!path) return typeof window !== 'undefined' ? window.location.origin : '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
