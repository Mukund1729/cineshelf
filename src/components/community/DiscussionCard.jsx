import React from 'react';
import { Link } from 'react-router-dom';
import SpoilerContent from './SpoilerContent';
import MentionText from '../MentionText';
import { UserLink } from '../EntityLink';
import { apiUrl } from '../../api/config';
import { tmdbImageUrl } from '../../api/tmdb';
import { mediaPath } from '../../lib/entityPaths';

function avatarUrl(user) {
  if (!user?.avatar) return '';
  return user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar;
}

function timeAgo(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DiscussionCard({
  post,
  onReact,
  onBookmark,
  onOpen,
  onVote,
}) {
  const author = post.author || {};
  const community = post.community || {};
  const src = avatarUrl(author);

  return (
    <article className="cs-post">
      <header className="cs-post-head">
        {src ? (
          <img className="cs-avatar" src={src} alt="" />
        ) : (
          <span className="cs-avatar cs-avatar-fallback">{(author.username || author.name || 'U')[0]}</span>
        )}
        <div>
          <UserLink user={author}>
            {author.name || author.username || 'Member'}
          </UserLink>
          <div className="cs-post-sub">
            {community.slug ? (
              <Link to={`/community/${community.slug}`}>{community.name}</Link>
            ) : community.name}
            {' · '}
            {post.type}
            {' · '}
            {timeAgo(post.createdAt)}
            {post.isPinned ? ' · Pinned' : ''}
          </div>
        </div>
      </header>

      <h3>
        <button
          type="button"
          onClick={() => onOpen?.(post)}
          style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
        >
          {post.title}
        </button>
      </h3>

      <SpoilerContent active={post.spoiler}>
        <MentionText text={post.body} className="cs-post-body" as="div" />
      </SpoilerContent>

      {post.movie?.tmdbId ? (
        <Link
          className="cs-post-movie"
          to={mediaPath({
            tmdbId: post.movie.tmdbId,
            mediaType: post.movie.mediaType === 'tv' ? 'tv' : 'movie',
          }) || `/movie/${post.movie.tmdbId}`}
        >
          {post.movie.posterPath && (
            <img
              src={post.movie.posterPath.startsWith('http')
                ? post.movie.posterPath
                : tmdbImageUrl(post.movie.posterPath, 'w92')}
              alt=""
            />
          )}
          <div>
            <strong>{post.movie.title}</strong>
            <div className="cs-post-sub">
              {post.movie.releaseYear || 'Film'} · TMDB discussion
            </div>
          </div>
        </Link>
      ) : null}

      {post.poll?.options?.length > 0 && (
        <div style={{ marginTop: '0.85rem', display: 'grid', gap: 6 }}>
          {post.poll.options.map(option => (
            <button
              key={option._id}
              type="button"
              className={`cs-action${option.voted ? ' is-on' : ''}`}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
              onClick={() => onVote?.(post, option._id)}
            >
              <span>{option.text}</span>
              <span>{option.voteCount || 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="cs-post-actions">
        {['clap', 'fire', 'think', 'heart'].map(key => (
          <button
            key={key}
            type="button"
            className={`cs-action${post.myReactions?.[key] ? ' is-on' : ''}`}
            onClick={() => onReact?.(post, key)}
          >
            {key} {post.reactionCounts?.[key] || 0}
          </button>
        ))}
        <button type="button" className="cs-action" onClick={() => onOpen?.(post)}>
          {post.commentCount || 0} comments
        </button>
        <button
          type="button"
          className={`cs-action${post.bookmarked ? ' is-on' : ''}`}
          onClick={() => onBookmark?.(post)}
        >
          {post.bookmarked ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          className="cs-action"
          onClick={() => {
            const url = `${window.location.origin}/community/${community.slug || ''}?post=${post._id}`;
            navigator.clipboard?.writeText(url);
          }}
        >
          Share
        </button>
      </div>
    </article>
  );
}
