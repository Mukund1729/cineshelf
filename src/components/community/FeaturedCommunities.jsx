import React from 'react';
import CommunityCard from './CommunityCard';

export default function FeaturedCommunities({ communities = [], onJoin, joiningId, sectionRef }) {
  return (
    <section className="cs-section" ref={sectionRef} id="featured-communities">
      <div className="cs-comm-wrap">
        <div className="cs-section-head">
          <div>
            <h2>Featured Communities</h2>
            <p>Editorial societies curated for cinephiles.</p>
          </div>
        </div>
        {!communities.length ? (
          <div className="cs-empty">No featured communities yet.</div>
        ) : (
          <div className="cs-featured-grid">
            {communities.map(community => (
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
    </section>
  );
}
