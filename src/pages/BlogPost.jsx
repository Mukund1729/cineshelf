import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`/api/blog/${slug}`)
      .then(res => setPost(res.data?.data || null))
      .catch(err => {
        if (err.response?.status === 404) setError('Article not found.');
        else setError('Failed to load article.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)' }}>
      <Navbar />
      <div className="vc-container" style={{ padding: '4rem 0', maxWidth: '700px' }}>
        <div className="vc-skeleton" style={{ height: 14, width: '30%', marginBottom: 24 }} />
        <div className="vc-skeleton" style={{ height: 48, width: '80%', marginBottom: 16 }} />
        <div className="vc-skeleton" style={{ height: 48, width: '60%', marginBottom: 32 }} />
        <div className="vc-skeleton" style={{ height: 360, borderRadius: 12, marginBottom: 32 }} />
        {[1,2,3,4,5].map(i => <div key={i} className="vc-skeleton" style={{ height: 16, marginBottom: 12, width: i % 2 === 0 ? '90%' : '100%' }} />)}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <div className="vc-container" style={{ padding: '6rem 0', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--vc-gold)', marginBottom: '1rem' }}>404</h1>
        <p style={{ color: 'var(--vc-slate)', marginBottom: '2rem' }}>{error}</p>
        <Link to="/blog" className="vc-btn vc-btn-outline">← Back to Journal</Link>
      </div>
    </div>
  );

  if (!post) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* Cover */}
      {post.coverImage && (
        <div style={{
          width: '100%',
          height: 'clamp(300px, 45vh, 500px)',
          backgroundImage: `url(${post.coverImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(7,10,16,0.2) 0%, rgba(7,10,16,0.9) 100%)',
          }} />
        </div>
      )}

      {/* Article */}
      <div className="vc-container" style={{ maxWidth: '720px', paddingTop: post.coverImage ? '2rem' : '4rem', paddingBottom: '5rem' }}>
        {/* Meta */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <Link to="/blog" style={{ color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← Journal
          </Link>
          <span style={{ color: 'var(--vc-slate-dark)' }}>·</span>
          <span className="vc-badge vc-badge-gold">{post.category}</span>
          <span style={{ color: 'var(--vc-slate-dark)', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem' }}>
            {formatDate(post.publishedAt)}
          </span>
        </div>

        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          fontWeight: 900,
          lineHeight: 1.15,
          marginBottom: '1rem',
          letterSpacing: '-0.01em',
        }}>
          {post.title}
        </h1>

        {post.excerpt && (
          <p style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.1rem',
            color: 'var(--vc-slate)',
            lineHeight: 1.7,
            marginBottom: '1.5rem',
          }}>
            {post.excerpt}
          </p>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '2.5rem',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--vc-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700, color: '#0a0f1a',
            flexShrink: 0,
          }}>
            {(post.author?.name || post.author?.username || 'V')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', color: 'var(--vc-cream)' }}>
              {post.author?.name || post.author?.username}
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-slate-dark)' }}>
              {post.views ? `${post.views} views` : ''} · {formatDate(post.publishedAt)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.05rem',
            lineHeight: 1.85,
            color: 'rgba(245,240,232,0.88)',
            whiteSpace: 'pre-line',
          }}
          dangerouslySetInnerHTML={{ __html: post.content?.replace(/\n/g, '<br/>') || '' }}
        />

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div style={{ marginTop: '3rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {post.tags.map(tag => (
              <span key={tag} className="vc-badge vc-badge-slate">#{tag}</span>
            ))}
          </div>
        )}

        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/blog" className="vc-btn vc-btn-outline">← More from the Journal</Link>
        </div>
      </div>
    </div>
  );
}
