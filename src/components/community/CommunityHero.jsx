import React from 'react';

export default function CommunityHero({ onExplore, onStartDiscussion }) {
  return (
    <section className="cs-comm-hero">
      <div className="cs-comm-hero-media" aria-hidden="true" />
      <div className="cs-comm-wrap">
        <div className="cs-comm-hero-inner">
          <span className="cs-comm-kicker">The Cinematic Society</span>
          <h1>Cinema is better when shared.</h1>
          <p className="lead">Find your people. Share your perspective.</p>
          <p className="desc">
            A space for film lovers to connect, discuss, debate and celebrate cinema beyond the screen.
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
