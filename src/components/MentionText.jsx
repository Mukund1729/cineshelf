import React from 'react';
import { Link } from 'react-router-dom';
import { mediaPath, usernamePath } from '../lib/entityPaths';

const MENTION_RE = /@([a-zA-Z0-9._-]{3,30})/g;
// Explicit film refs only: [[movie:123|Title]] or [[tv:456|Title]] — never guess from plain titles.
const MEDIA_REF_RE = /\[\[(movie|tv):(\d+)\|([^\]]{1,160})\]\]/g;

/**
 * Renders plain text with:
 * - @username → /u/:username (resolves to the real profile)
 * - [[movie:tmdbId|Title]] / [[tv:tmdbId|Title]] → detail pages
 *
 * No HTML is injected. Ambiguous bare titles stay plain text on purpose.
 */
export default function MentionText({ text, className = '', as: Tag = 'span' }) {
  const source = String(text || '');
  if (!source) return null;

  const parts = [];
  const pattern = new RegExp(`${MENTION_RE.source}|${MEDIA_REF_RE.source}`, 'g');
  let last = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) {
      parts.push(<React.Fragment key={`t-${key++}`}>{source.slice(last, match.index)}</React.Fragment>);
    }

    if (match[1]) {
      const username = match[1];
      const to = usernamePath(username);
      parts.push(
        to ? (
          <Link
            key={`m-${key++}`}
            to={to}
            className="vc-mention-link"
            onClick={event => event.stopPropagation()}
          >
            @{username}
          </Link>
        ) : (
          <React.Fragment key={`m-${key++}`}>@{username}</React.Fragment>
        )
      );
    } else {
      const mediaType = match[2];
      const id = match[3];
      const title = match[4];
      const to = mediaPath({ id, mediaType });
      parts.push(
        to ? (
          <Link
            key={`f-${key++}`}
            to={to}
            className="vc-media-ref-link"
            onClick={event => event.stopPropagation()}
          >
            {title}
          </Link>
        ) : (
          <React.Fragment key={`f-${key++}`}>{title}</React.Fragment>
        )
      );
    }

    last = match.index + match[0].length;
  }

  if (last < source.length) {
    parts.push(<React.Fragment key={`t-${key++}`}>{source.slice(last)}</React.Fragment>);
  }

  return <Tag className={className}>{parts}</Tag>;
}

/** Insert a structured media reference at the caret (or append). */
export function formatMediaRef({ mediaType = 'movie', id, title }) {
  const safeTitle = String(title || 'Untitled').replace(/[\[\]]/g, '').slice(0, 160);
  return `[[${mediaType === 'tv' ? 'tv' : 'movie'}:${Number(id)}|${safeTitle}]]`;
}
