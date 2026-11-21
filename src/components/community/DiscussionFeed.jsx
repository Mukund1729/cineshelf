import React from 'react';
import DiscussionCard from './DiscussionCard';

const FILTERS = [
  { key: 'for-you', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'trending', label: 'Trending' },
  { key: 'latest', label: 'Latest' },
];

export default function DiscussionFeed({
  filter,
  onFilterChange,
  posts = [],
  loading,
  error,
  onReact,
  onBookmark,
  onOpen,
  onVote,
}) {
  return (
    <div>
      <div className="cs-feed-filters" role="tablist" aria-label="Discussion filters">
        {FILTERS.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={`cs-filter${filter === item.key ? ' is-active' : ''}`}
            onClick={() => onFilterChange?.(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="cs-loading">
          <div className="cs-skeleton" style={{ height: 120, marginBottom: 12 }} />
          <div className="cs-skeleton" style={{ height: 120, marginBottom: 12 }} />
          <div className="cs-skeleton" style={{ height: 120 }} />
        </div>
      )}

      {!loading && error && <div className="cs-error" role="alert">{error}</div>}

      {!loading && !error && !posts.length && (
        <div className="cs-empty">No discussions yet. Be the first voice in the room.</div>
      )}

      {!loading && !error && posts.map(post => (
        <DiscussionCard
          key={post._id}
          post={post}
          onReact={onReact}
          onBookmark={onBookmark}
          onOpen={onOpen}
          onVote={onVote}
        />
      ))}
    </div>
  );
}
