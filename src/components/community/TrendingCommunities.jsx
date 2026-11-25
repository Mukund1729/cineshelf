import React from 'react';
import { Link } from 'react-router-dom';

export default function TrendingCommunities({
  trending = [],
  popularPosts = [],
  suggested = [],
}) {
  return (
    <aside className="cs-side">
      <div className="cs-panel">
        <h3>Trending groups</h3>
        {!trending.length ? (
          <p className="cs-empty" style={{ padding: 0 }}>Gathering activity…</p>
        ) : (
          trending.slice(0, 6).map(item => (
            <Link key={item._id} className="cs-side-item" to={`/community/${item.slug}`}>
              {item.avatar ? (
                <img className="cs-avatar" src={item.avatar} alt="" />
              ) : (
                <span className="cs-avatar cs-avatar-fallback">{(item.name || 'C')[0]}</span>
              )}
              <div>
                <strong>{item.name}</strong>
                <span>{item.memberCount || 0} members · {item.discussionCount || 0} talks</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="cs-panel">
        <h3>Popular discussions</h3>
        {!popularPosts.length ? (
          <p className="cs-empty" style={{ padding: 0 }}>No trending talks yet.</p>
        ) : (
          popularPosts.slice(0, 5).map(post => (
            <Link
              key={post._id}
              className="cs-side-item"
              to={`/community/${post.community?.slug || ''}?post=${post._id}`}
            >
              <div>
                <strong>{post.title}</strong>
                <span>{post.commentCount || 0} comments · {post.community?.name}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="cs-panel">
        <h3>Suggested</h3>
        {!suggested.length ? (
          <p className="cs-empty" style={{ padding: 0 }}>Suggestions appear as the society grows.</p>
        ) : (
          suggested.slice(0, 5).map(item => (
            <Link key={item._id} className="cs-side-item" to={`/community/${item.slug}`}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.categoryLabel || item.category}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}
