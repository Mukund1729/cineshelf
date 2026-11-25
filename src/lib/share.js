import { absoluteUrl } from './entityPaths';

/**
 * Native share when available, otherwise copy the link.
 * Returns { method: 'share' | 'clipboard' | 'cancelled' | 'failed', url }.
 */
export async function shareOrCopy({ title, text, path, url } = {}) {
  const shareUrl = url || absoluteUrl(path || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const payload = {
    title: title || (typeof document !== 'undefined' ? document.title : 'CineShelf'),
    text: text || '',
    url: shareUrl,
  };

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(payload);
      return { method: 'share', url: shareUrl };
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { method: 'cancelled', url: shareUrl };
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      return { method: 'clipboard', url: shareUrl };
    }
  } catch {
    /* fall through */
  }

  return { method: 'failed', url: shareUrl };
}
