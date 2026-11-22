import React from 'react';
import { Link } from 'react-router-dom';
import { tmdbImageUrl } from '../../api/tmdb';

function posterUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return tmdbImageUrl(path, 'w342');
}

function backdropUrl(path) {
  if (!path) return 'https://image.tmdb.org/t/p/w1280/rAiYTfKGqDCR3uUW01hBObAvzCS.jpg';
  if (path.startsWith('http')) return path;
  return tmdbImageUrl(path, 'w1280');
}

export default function MovieDiscussionSpotlight({ spotlight, posts = [], onStartDiscussion }) {
  if (!spotlight) {
    return (
      <section className="cs-section">
        <div className="cs-comm-wrap">
          <div className="cs-section-head">
            <div>
              <h2>Movie Discussion Spotlight</h2>
              <p>Link a film to a discussion and it will surface here.</p>
            </div>
          </div>
          <div className="cs-empty">No movie-linked discussions yet.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="cs-section">
      <div className="cs-comm-wrap">
        <div className="cs-section-head">
          <div>
            <h2>Movie Discussion Spotlight</h2>
            <p>One film. Many perspectives.</p>
          </div>
        </div>
        <div className="cs-spotlight">
          <div
            className="cs-spotlight-bg"
            style={{ backgroundImage: `url(${backdropUrl(spotlight.backdropPath || spotlight.posterPath)})` }}
          />
          <div className="cs-spotlight-inner">
            {posterUrl(spotlight.posterPath) ? (
              <img src={posterUrl(spotlight.posterPath)} alt="" />
            ) : (
              <div className="cs-skeleton" style={{ width: 120, height: 180 }} />
            )}
            <div>
              <span className="cs-chip">TMDB · {spotlight.tmdbId}</span>
              <h3 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1.8rem', margin: '0.55rem 0 0.25rem' }}>
                <Link to={`/movie/${spotlight.tmdbId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {spotlight.title}
                </Link>
              </h3>
              <p style={{ color: '#a6a09a', margin: '0 0 0.85rem' }}>
                {spotlight.releaseYear || '—'} · {spotlight.discussionCount || 0} discussions
              </p>
              <div style={{ display: 'grid', gap: 6, marginBottom: '1rem' }}>
                {posts.slice(0, 3).map(post => (
                  <Link
                    key={post._id}
                    to={`/community/${post.community?.slug || ''}?post=${post._id}`}
                    style={{ color: '#f1ede5', textDecoration: 'none', fontSize: '0.9rem' }}
                  >
                    {post.title}
                    <span style={{ color: '#a6a09a' }}> · {post.community?.name}</span>
                  </Link>
                ))}
              </div>
              <button type="button" className="cs-btn cs-btn-primary" onClick={() => onStartDiscussion?.(spotlight)}>
                Start Discussion
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
