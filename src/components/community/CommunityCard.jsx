import React from 'react';
import { Link } from 'react-router-dom';

function Avatar({ community }) {
  if (community.avatar) {
    return <img className="cs-avatar" src={community.avatar} alt="" loading="lazy" />;
  }
  return (
    <span className="cs-avatar cs-avatar-fallback" aria-hidden="true">
      {(community.name || 'C')[0]}
    </span>
  );
}

export default function CommunityCard({ community, onJoin, joiningId }) {
  const cover = community.coverImage || 'https://image.tmdb.org/t/p/w780/rAiYTfKGqDCR3uUW01hBObAvzCS.jpg';
  return (
    <article className="cs-card">
      <div className="cs-card-media" style={{ backgroundImage: `url(${cover})` }} />
      <div className="cs-card-shade" />
      <div className="cs-card-body">
        <div className="cs-card-top">
          <Avatar community={community} />
          <span className="cs-chip">{community.category}</span>
        </div>
        <h3>
          <Link to={`/community/${community.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {community.name}
          </Link>
        </h3>
        <p>{community.description}</p>
        <div className="cs-meta">
          <span>{community.memberCount || 0} members</span>
          <span>{community.discussionCount || 0} discussions</span>
        </div>
        <div>
          {community.joined ? (
            <span className="cs-btn cs-btn-joined">Joined</span>
          ) : (
            <button
              type="button"
              className="cs-btn cs-btn-primary"
              disabled={joiningId === community._id}
              onClick={() => onJoin?.(community)}
            >
              {joiningId === community._id ? 'Joining…' : 'Join'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
