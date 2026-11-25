import React from 'react';
import { Link } from 'react-router-dom';
import CommunityCard, { CommunityAvatar, communityCoverStyle } from './CommunityCard';
import { communityCategoryLabel } from '../../../data/communityOptions.js';

/**
 * Image-forward featured rail. The lead community gets a wide still;
 * the rest sit as tall poster cards — no plain black empty boxes.
 */
export default function FeaturedCommunities({ communities = [], onJoin, joiningId, sectionRef }) {
  const [lead, ...rest] = communities;

  return (
    <section className="cs-section cs-featured-section" ref={sectionRef} id="featured-communities">
      <div className="cs-comm-wrap">
        <div className="cs-section-head">
          <div>
            <h2>Featured Communities</h2>
            <p>Three rooms worth walking into.</p>
          </div>
        </div>

        {!communities.length ? (
          <div className="cs-empty">No featured communities yet.</div>
        ) : (
          <div className="cs-featured-stage">
            {lead && (
              <article className="cs-featured-lead">
                <div
                  className={`cs-featured-lead-media${lead.coverImage ? '' : ' is-empty'}`}
                  style={communityCoverStyle(lead)}
                />
                <div className="cs-featured-lead-shade" />
                <div className="cs-featured-lead-body">
                  <div className="cs-card-top">
                    <CommunityAvatar community={lead} size={56} />
                    <span className="cs-chip">
                      {lead.categoryLabel || communityCategoryLabel(lead.category)}
                    </span>
                  </div>
                  <h3>
                    <Link to={`/community/${lead.slug}`}>{lead.name}</Link>
                  </h3>
                  <p>{lead.tagline || lead.summary || lead.description}</p>
                  <div className="cs-meta">
                    <span>{lead.memberCount || 0} members</span>
                    <span>{lead.discussionCount || 0} discussions</span>
                  </div>
                  <div className="cs-comm-actions">
                    <Link className="cs-btn cs-btn-ghost" to={`/community/${lead.slug}`}>
                      Enter
                    </Link>
                    {!lead.joined && lead.membershipStatus !== 'pending' && (
                      <button
                        type="button"
                        className="cs-btn cs-btn-primary"
                        disabled={joiningId === lead._id}
                        onClick={() => onJoin?.(lead)}
                      >
                        {joiningId === lead._id ? 'Joining…' : 'Join'}
                      </button>
                    )}
                    {lead.joined && <span className="cs-btn cs-btn-joined">Joined</span>}
                  </div>
                </div>
              </article>
            )}

            {rest.length > 0 && (
              <div className="cs-featured-side">
                {rest.map(community => (
                  <CommunityCard
                    key={community._id}
                    community={community}
                    onJoin={onJoin}
                    joiningId={joiningId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
