import React from 'react';

export default function CommunityHero({ onExplore, onStartDiscussion }) {
  return (
    <section className="cs-comm-hero">
      <div className="cs-comm-hero-media" aria-hidden="true" />
      <div className="cs-comm-wrap">
        <div className="cs-comm-hero-inner">
          <span className="cs-comm-kicker">Community</span>
          <h1>Rooms for people who watch closely.</h1>
          <p className="lead">Discuss films, join societies, keep the argument going after the credits.</p>
          <p className="desc">
            Public groups, private circles, and long threads about craft — connected to the same films and people you already follow on CineShelf.
          </p>
          <div className="cs-comm-actions">
            <button type="button" className="cs-btn cs-btn-primary" onClick={onExplore}>
              Explore Communities
            </button>
            <button type="button" className="cs-btn cs-btn-ghost" onClick={onStartDiscussion}>
              Start a Discussion
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
