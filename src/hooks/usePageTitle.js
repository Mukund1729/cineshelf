import { useEffect } from 'react';

const SITE = 'CineShelf';

/**
 * Sets document.title for the current view and restores the previous title
 * on unmount so browser-back and SPA transitions stay coherent.
 */
export default function usePageTitle(title, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const previous = document.title;
    const next = title ? `${title} | ${SITE}` : SITE;
    document.title = next;
    return () => {
      document.title = previous;
    };
  }, [title, enabled]);
}
