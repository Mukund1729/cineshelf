import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { COMMUNITY_PRIVACY, communityCategoryLabel } from '../../../data/communityOptions.js';

export function CommunityAvatar({ community, size, className = '' }) {
  const [broken, setBroken] = useState(false);
  const style = size ? { width: size, height: size, fontSize: size > 60 ? '1.6rem' : undefined } : undefined;
  const letter = (community.name || 'C').trim()[0] || 'C';
  if (community.avatar && !broken) {
    return (
      <img
        className={`cs-avatar ${className}`}
        style={style}
        src={community.avatar}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`cs-avatar cs-avatar-fallback ${className}`} style={style} aria-hidden="true">
      {letter}
    </span>
  );
}

export function communityCoverStyle(community) {
  if (!community?.coverImage) return undefined;
  // Quote the URL safely for CSS — JSON.stringify wraps the whole value in
  // quotes which breaks some browsers when nested inside url(...).
  const src = String(community.coverImage).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return { backgroundImage: `url("${src}")` };
}

/**
 * Discovery card. `preview` renders the same card without links or actions,
 * so the setup preview is the real card rather than an imitation.
 */
export default function CommunityCard({ community, onJoin, joiningId, preview = false }) {
  const label = community.categoryLabel || communityCategoryLabel(community.category);
  const summary = community.summary ?? community.description;
  const needsApproval = community.privacy && community.privacy !== 'public';
  const pending = community.membershipStatus === 'pending';

  return (
    <article className={`cs-card${preview ? ' is-preview' : ''}`}>
      <div
        className={`cs-card-media${community.coverImage ? '' : ' is-empty'}`}
        style={communityCoverStyle(community)}
      />
      <div className="cs-card-shade" />
      <div className="cs-card-body">
        <div className="cs-card-top">
          <CommunityAvatar community={community} />
          <span className="cs-chip">{label}</span>
          {needsApproval && (
            <span className="cs-chip cs-chip-quiet">{COMMUNITY_PRIVACY[community.privacy]?.label}</span>
          )}
        </div>
        <h3>
          {preview ? (community.name || 'Your community name') : (
            <Link to={`/community/${community.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {community.name}
            </Link>
          )}
        </h3>
        <p>{summary || (preview ? 'Your tagline or the opening of your About text appears here.' : '')}</p>
        {community.topics?.length > 0 && (
          <div className="cs-topic-row">
            {community.topics.slice(0, 3).map(topic => <span key={topic} className="cs-topic">{topic}</span>)}
            {community.topics.length > 3 && <span className="cs-topic">+{community.topics.length - 3}</span>}
          </div>
        )}
        <div className="cs-meta">
          <span>{community.memberCount || 0} {community.memberCount === 1 ? 'member' : 'members'}</span>
          <span>{community.discussionCount || 0} discussions</span>
        </div>
        <div>
          {preview ? (
            <span className="cs-btn cs-btn-primary" aria-hidden="true">
              {needsApproval ? 'Request to join' : 'Join'}
            </span>
          ) : community.joined ? (
            <span className="cs-btn cs-btn-joined">Joined</span>
          ) : pending ? (
            <span className="cs-btn cs-btn-joined">Requested</span>
          ) : (
            <button
              type="button"
              className="cs-btn cs-btn-primary"
              disabled={joiningId === community._id}
              onClick={() => onJoin?.(community)}
            >
              {joiningId === community._id ? 'Joining…' : needsApproval ? 'Request to join' : 'Join'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
