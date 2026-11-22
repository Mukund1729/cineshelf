import React from 'react';
import { Link } from 'react-router-dom';
import { hasAuthSession } from '../../api/session';
import DiscussionCard from './DiscussionCard';

export default function YourCircle({
  circle,
  onJoin,
  joiningId,
  onReact,
  onBookmark,
  onOpen,
  onSignIn,
}) {
  if (!hasAuthSession()) {
    return (
      <section className="cs-section">
        <div className="cs-comm-wrap">
          <div className="cs-section-head">
            <div>
              <h2>Your Cinematic Circle</h2>
              <p>Join the society to see communities you follow and recent activity.</p>
            </div>
          </div>
          <div className="cs-panel" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <p style={{ color: '#a6a09a', marginBottom: '1rem' }}>
              Sign in with your CineShelf account to unlock your circle.
            </p>
            <button type="button" className="cs-btn cs-btn-primary" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        </div>
      </section>
    );
  }

  const joined = circle?.joined || [];
  const created = circle?.created || [];
  const posts = circle?.recentPosts || [];

  return (
    <section className="cs-section">
      <div className="cs-comm-wrap">
        <div className="cs-section-head">
          <div>
            <h2>Your Cinematic Circle</h2>
            <p>Communities you belong to, societies you founded, and the latest from your feed.</p>
          </div>
        </div>

        <div className="cs-layout">
          <div>
            <h3 style={{ fontFamily: 'var(--vc-font-display)', marginTop: 0 }}>Recent from your societies</h3>
            {!posts.length ? (
              <div className="cs-empty">Join a community to fill this room with conversation.</div>
            ) : (
              posts.map(post => (
                <DiscussionCard
                  key={post._id}
                  post={post}
                  onReact={onReact}
                  onBookmark={onBookmark}
                  onOpen={onOpen}
                />
              ))
            )}
          </div>
          <aside className="cs-side">
            <div className="cs-panel">
              <h3>Joined</h3>
              {!joined.length ? (
                <p className="cs-empty" style={{ padding: 0 }}>None yet.</p>
              ) : (
                joined.slice(0, 8).map(item => (
                  <Link key={item._id} className="cs-side-item" to={`/community/${item.slug}`}>
                    {item.avatar ? (
                      <img className="cs-avatar" src={item.avatar} alt="" />
                    ) : (
                      <span className="cs-avatar cs-avatar-fallback">{item.name[0]}</span>
                    )}
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.memberCount} members</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="cs-panel">
              <h3>Created by you</h3>
              {!created.length ? (
                <p className="cs-empty" style={{ padding: 0 }}>Found a society to appear here.</p>
              ) : (
                created.map(item => (
                  <Link key={item._id} className="cs-side-item" to={`/community/${item.slug}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.role || 'owner'} · {item.discussionCount} discussions</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
