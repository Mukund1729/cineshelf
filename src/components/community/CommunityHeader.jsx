import React from 'react';
import { COMMUNITY_PRIVACY, communityCategoryLabel } from '../../../data/communityOptions.js';
import { CommunityAvatar, communityCoverStyle } from './CommunityCard';

/**
 * Community banner: cover, avatar, name, tagline, category, visibility and
 * counts. Used by the community page and by the setup preview, so the preview
 * is rendered by the same component members will see.
 */
export default function CommunityHeader({ community, actions = null, compact = false, headingLevel = 'h1' }) {
  const Heading = headingLevel;
  const label = community.categoryLabel || communityCategoryLabel(community.category);
  const privacy = COMMUNITY_PRIVACY[community.privacy] || COMMUNITY_PRIVACY.public;
  const lead = community.tagline || community.summary || '';

  return (
    <header
      className={`cs-comm-detail-banner${community.coverImage ? '' : ' is-empty'}${compact ? ' is-compact' : ''}`}
      style={communityCoverStyle(community)}
    >
      <div className="shade" />
      <div className="cs-comm-wrap">
        <div className="cs-comm-detail-content">
          <CommunityAvatar community={community} size={compact ? 56 : 88} />
          <div className="cs-comm-detail-text">
            <div className="cs-chip-row">
              <span className="cs-chip">{label}</span>
              <span className={`cs-chip ${community.privacy === 'public' ? 'cs-chip-quiet' : 'cs-chip-lock'}`}>
                {privacy.label}
              </span>
            </div>
            <Heading className="cs-comm-detail-title">{community.name || 'Your community name'}</Heading>
            {lead && <p className="cs-comm-detail-lead">{lead}</p>}
            <div className="cs-meta">
              <span>{community.memberCount || 0} {community.memberCount === 1 ? 'member' : 'members'}</span>
              {community.discussionCount !== undefined && (
                <span>{community.discussionCount || 0} discussions</span>
              )}
              {community.role && <span>Your role: {community.role}</span>}
            </div>
            {community.topics?.length > 0 && (
              <div className="cs-topic-row">
                {community.topics.map(topic => <span key={topic} className="cs-topic">{topic}</span>)}
              </div>
            )}
          </div>
          {actions && <div className="cs-comm-actions">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
