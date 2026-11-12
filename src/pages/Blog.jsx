import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { tmdbImageUrl } from '../api/tmdb';

const CATEGORIES = ['all', 'feature', 'review', 'editorial', 'list', 'interview', 'news'];

function PostSkeleton() {
  return (
    <div style={{ background: 'var(--vc-bg-card)', borderRadius: 12, overflow: 'hidden' }}>
      <div className="vc-skeleton" style={{ height: 200 }} />
      <div style={{ padding: '1.25rem' }}>
        <div className="vc-skeleton" style={{ height: 12, width: '60%', marginBottom: 8 }} />
        <div className="vc-skeleton" style={{ height: 18, width: '90%', marginBottom: 8 }} />
        <div className="vc-skeleton" style={{ height: 18, width: '75%', marginBottom: 12 }} />
        <div className="vc-skeleton" style={{ height: 12, width: '40%' }} />
      </div>
    </div>
  );
}

// Editorial posts to seed the page visually until MongoDB has content
const EDITORIAL_POSTS = [
  {
    _id: 'ed1',
    slug: 'the-art-of-slow-cinema',
    title: 'The Art of Slow Cinema: Why Patience is the Point',
    excerpt: 'In an era of algorithmic content, filmmakers like Béla Tarr, Chantal Akerman, and Carlos Reygadas insist on a different relationship with time.',
    category: 'editorial',
    coverImage: tmdbImageUrl('/1E5baAaEse26fej7uHcjOgEE2t2.jpg', 'original'),
    author: { name: 'Visual.Cineaste', username: 'editorial' },
    publishedAt: '2024-12-01',
  },
  {
    _id: 'ed2',
    slug: 'indian-cinema-new-wave',
    title: 'The Quiet Revolution: New Wave Indian Cinema 2010–2024',
    excerpt: 'From Masaan to Article 15, a generation of filmmakers is redefining what Indian cinema can say and how it can say it.',
    category: 'feature',
    coverImage: tmdbImageUrl('/pXRlT7tPVFEGNBmpvSqpNxWdaek.jpg', 'original'),
    author: { name: 'Visual.Cineaste', username: 'editorial' },
    publishedAt: '2024-11-15',
  },
  {
    _id: 'ed3',
    slug: 'nolan-chronology',
    title: 'Every Christopher Nolan Film, Ranked by Emotional Complexity',
    excerpt: 'Beyond the spectacle and the timeline tricks — which of Nolan\'s films actually earns its feeling?',
    category: 'list',
    coverImage: tmdbImageUrl('/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', 'original'),
    author: { name: 'Visual.Cineaste', username: 'editorial' },
    publishedAt: '2024-10-20',
  },
  {
    _id: 'ed4',
    slug: 'villeneuve-atmosphere',
    title: 'Denis Villeneuve and the Cinema of Atmospheric Dread',
    excerpt: 'Why every Villeneuve film feels like it exists in the shadow of something enormous — and why that\'s exactly right.',
    category: 'review',
    coverImage: tmdbImageUrl('/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg', 'original'),
    author: { name: 'Visual.Cineaste', username: 'editorial' },
    publishedAt: '2024-09-05',
  },
  {
    _id: 'ed5',
    slug: 'best-debuts',
    title: 'Ten Debut Films That Announced a Major New Voice',
    excerpt: 'First films that didn\'t feel like first films. From Scorsese\'s Mean Streets to Céline Sciamma\'s Water Lilies.',
    category: 'list',
    coverImage: tmdbImageUrl('/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', 'original'),
    author: { name: 'Visual.Cineaste', username: 'editorial' },
    publishedAt: '2024-08-10',
  },
  {
    _id: 'ed6',
    slug: 'streaming-versus-cinema',
    title: 'The Streaming Dilemma: What We Lose When We Lose the Theatre',
    excerpt: 'Is the theatrical experience a luxury or a necessity? The case for preserving shared darkness.',
    category: 'editorial',
    coverImage: tmdbImageUrl('/gj282Pniaa78ZBfEfHVlRWXxaGq.jpg', 'original'),
    author: { name: 'Visual.Cineaste', username: 'editorial' },
    publishedAt: '2024-07-22',
  },
];

const CATEGORY_LABELS = {
  all: 'All',
  feature: 'Features',
  review: 'Reviews',
  editorial: 'Editorials',
  list: 'Lists',
  interview: 'Interviews',
  news: 'News',
};

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = category !== 'all' ? `?category=${category}` : '';
    axios.get(`/api/blog${params}`)
      .then(res => {
        const data = res.data?.data || [];
        // Merge with editorial posts if DB is empty
        setPosts(data.length > 0 ? data : EDITORIAL_POSTS);
      })
      .catch(() => {
        // If blog API isn't ready yet, show editorial content
        setPosts(EDITORIAL_POSTS.filter(p => category === 'all' || p.category === category));
      })
      .finally(() => setLoading(false));
  }, [category]);

  const displayPosts = posts.filter(p => category === 'all' || p.category === category);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        paddingTop: '6rem',
        paddingBottom: '3rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, #060912 0%, #0a0f1a 50%, #0d1420 100%)',
      }}>
        <div className="vc-container">
          <span className="vc-section-label">📝 Journal</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '0.75rem' }}>
            Writing about cinema that matters.
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: '500px', lineHeight: 1.6 }}>
            Long-form features, reviews, director spotlights, and critical essays on world cinema.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section style={{ padding: '1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'var(--vc-bg-surface)' }}>
        <div className="vc-container">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  background: category === cat ? 'var(--vc-gold)' : 'rgba(255,255,255,0.05)',
                  color: category === cat ? '#0a0f1a' : 'var(--vc-slate)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.4rem 1rem',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.8rem',
                  fontWeight: category === cat ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section style={{ padding: '3rem 0' }}>
        <div className="vc-container">
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {[1,2,3,4,5,6].map(i => <PostSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
              <p>Unable to load articles. Please try again.</p>
              <button className="vc-btn vc-btn-outline" style={{ marginTop: '1rem' }} onClick={() => setCategory('all')}>Retry</button>
            </div>
          ) : displayPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', marginBottom: '0.5rem' }}>No articles yet.</p>
              <p style={{ fontSize: '0.9rem' }}>Check back soon — new writing is coming.</p>
            </div>
          ) : (
            <>
              {/* Featured post (first) */}
              {displayPosts[0] && (
                <Link
                  to={`/blog/${displayPosts[0].slug}`}
                  style={{ textDecoration: 'none', display: 'block', marginBottom: '2.5rem' }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 0,
                    background: 'var(--vc-bg-card)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.06)',
                    minHeight: '320px',
                  }}>
                    <div style={{
                      backgroundImage: `url(${displayPosts[0].coverImage || tmdbImageUrl('/1E5baAaEse26fej7uHcjOgEE2t2.jpg', 'w780')})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      minHeight: '280px',
                    }} />
                    <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span className="vc-badge vc-badge-gold" style={{ width: 'fit-content', marginBottom: '1rem' }}>
                        {CATEGORY_LABELS[displayPosts[0].category] || displayPosts[0].category}
                      </span>
                      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', lineHeight: 1.3, color: 'var(--vc-cream)', marginBottom: '1rem' }}>
                        {displayPosts[0].title}
                      </h2>
                      <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                        {displayPosts[0].excerpt}
                      </p>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: 'var(--vc-slate-dark)' }}>
                        {displayPosts[0].author?.name || displayPosts[0].author?.username} · {formatDate(displayPosts[0].publishedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Rest in grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {displayPosts.slice(1).map(post => (
                  <Link key={post._id || post.slug} to={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                    <article style={{
                      background: 'var(--vc-bg-card)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'transform 200ms, border-color 200ms',
                      height: '100%',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      {post.coverImage && (
                        <div style={{
                          height: '180px',
                          backgroundImage: `url(${post.coverImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }} />
                      )}
                      <div style={{ padding: '1.25rem' }}>
                        <span className="vc-badge vc-badge-slate" style={{ marginBottom: '0.75rem' }}>
                          {CATEGORY_LABELS[post.category] || post.category}
                        </span>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.05rem', lineHeight: 1.35, color: 'var(--vc-cream)', marginBottom: '0.6rem' }}>
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--vc-slate)', lineHeight: 1.5, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {post.excerpt}
                          </p>
                        )}
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-slate-dark)' }}>
                          {post.author?.name || post.author?.username} · {formatDate(post.publishedAt)}
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
