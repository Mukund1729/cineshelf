import React from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../api/config';
import {
  communityPath,
  mediaPath,
  personPath,
  userPath,
  usernamePath,
} from '../lib/entityPaths';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * User identity → existing /people/:userId profile.
 * Falls back to /u/:username when only a username is known.
 */
export function UserLink({
  user,
  userId,
  username,
  children,
  className = '',
  stopPropagation = false,
  ...rest
}) {
  const byId = userPath(user || userId);
  const byName = !byId ? usernamePath(username || user?.username) : null;
  const to = byId || byName;
  if (!to) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      to={to}
      className={cx('vc-entity-link', className)}
      onClick={event => {
        if (stopPropagation) event.stopPropagation();
        rest.onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function UserAvatarLink({
  user,
  userId,
  size = 36,
  className = '',
  stopPropagation = false,
  alt = '',
}) {
  const person = user || null;
  const id = userId || person?._id || person?.id;
  const name = person?.name || person?.username || 'Member';
  const raw = person?.avatar || '';
  const src = raw ? (raw.startsWith('/') ? apiUrl(raw) : raw) : '';

  const avatar = src ? (
    <img
      src={src}
      alt={alt || name}
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(213, 178, 61, 0.18)',
        color: 'var(--vc-gold, #d5b23d)',
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
    >
      {String(name)[0]?.toUpperCase() || 'U'}
    </span>
  );

  return (
    <UserLink
      user={person}
      userId={id}
      username={person?.username}
      className={cx('vc-entity-avatar-link', className)}
      stopPropagation={stopPropagation}
      aria-label={`Open ${name}'s profile`}
      style={{ display: 'inline-flex', flexShrink: 0, textDecoration: 'none' }}
    >
      {avatar}
    </UserLink>
  );
}

/** Movie / TV → existing detail routes. Never swaps movie and TV ids. */
export function MediaLink({
  media,
  id,
  tmdbId,
  originalId,
  source,
  mediaType = 'movie',
  children,
  className = '',
  ...rest
}) {
  const to = mediaPath(media || { id, tmdbId, originalId, source, mediaType });
  if (!to) return <span className={className}>{children}</span>;
  return (
    <Link to={to} className={cx('vc-entity-link', className)} {...rest}>
      {children}
    </Link>
  );
}

/** TMDB person → /person/:id */
export function PersonLink({ person, personId, children, className = '', ...rest }) {
  const to = personPath(person || personId);
  if (!to) return <span className={className}>{children}</span>;
  return (
    <Link to={to} className={cx('vc-entity-link', className)} {...rest}>
      {children}
    </Link>
  );
}

/** Community → /community/:slug */
export function CommunityLink({ community, slug, postId, children, className = '', ...rest }) {
  const to = communityPath(community || slug, { postId });
  if (!to) return <span className={className}>{children}</span>;
  return (
    <Link to={to} className={cx('vc-entity-link', className)} {...rest}>
      {children}
    </Link>
  );
}
