import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axios.get(`/api/journal/${encodeURIComponent(slug)}`)
      .then(response => {
        if (!active) return;
        const article = response.data?.data;
        setPost(article || null);
        setRelated(article?.related || []);
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.status === 404 ? 'This essay could not be found.' : 'The essay could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!post) return undefined;
    const previousTitle = document.title;
    document.title = `${post.title} | THE JOURNAL — Visual Cineaste`;
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = post.canonicalUrl || window.location.href;
    document.head.appendChild(canonical);
    const structuredData = document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt || post.subtitle || '',
      image: post.coverImage || undefined,
      datePublished: post.publishedAt || undefined,
      author: { '@type': 'Person', name: post.authorName || 'Mukund Mangal' },
      publisher: { '@type': 'Organization', name: 'Visual Cineaste' },
      mainEntityOfPage: post.canonicalUrl || window.location.href,
    }).replace(/</g, '\\u003c');
    document.head.appendChild(structuredData);
    return () => {
      document.title = previousTitle;
      canonical.remove();
      structuredData.remove();
    };
  }, [post]);

  const handleShare = async () => {
    const shareData = { title: post.title, text: post.excerpt || post.subtitle || '', url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Link copied');
        setTimeout(() => setShareMessage(''), 2500);
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setShareMessage('Could not share this link');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)' }}>
        <Navbar />
        <div className="vc-container" style={{ maxWidth: 760, padding: '4rem 0' }}>
          <div className="vc-skeleton" style={{ height: 14, width: '30%', marginBottom: 24 }} />
          <div className="vc-skeleton" style={{ height: 48, width: '80%', marginBottom: 16 }} />
          <div className="vc-skeleton" style={{ height: 320, borderRadius: 14, marginBottom: 32 }} />
          {[1, 2, 3, 4].map(item => <div key={item} className="vc-skeleton" style={{ height: 16, marginBottom: 14, width: item % 2 ? '100%' : '82%' }} />)}
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
        <Navbar />
        <div className="vc-container" style={{ maxWidth: 720, padding: '6rem 0', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--vc-gold)' }}>A page turned.</h1>
          <p style={{ color: 'var(--vc-slate)', marginBottom: '2rem' }}>{error || 'This essay could not be found.'}</p>
          <Link to="/journal" className="vc-btn vc-btn-outline">← Back to THE JOURNAL</Link>
        </div>
      </div>
    );
  }

  const author = post.authorName || post.author?.name || post.author?.username || 'Mukund Mangal';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      {post.coverImage ? (
        <div style={{
          width: '100%',
          height: 'clamp(260px, 48vh, 560px)',
          backgroundImage: `linear-gradient(to bottom, rgba(7,10,16,.12), rgba(7,10,16,.78)), url("${post.coverImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      ) : (
        <div style={{ height: 170, background: 'radial-gradient(ellipse at 70% 0%, rgba(212,175,55,.16), transparent 55%)' }} />
      )}

      <main className="vc-container" style={{ maxWidth: 820, paddingTop: '1.5rem', paddingBottom: '5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <Link to="/journal" style={{ color: 'var(--vc-slate)', fontSize: '0.82rem', textDecoration: 'none' }}>← THE JOURNAL</Link>
          <span style={{ color: 'var(--vc-slate-dark)' }}>·</span>
          <span className="vc-badge vc-badge-gold">{post.categories?.[0] || post.tags?.[0] || 'Essay'}</span>
          <span style={{ color: 'var(--vc-slate-dark)', fontSize: '0.8rem' }}>{formatDate(post.publishedAt)}</span>
          {post.readingTime > 0 && <span style={{ color: 'var(--vc-slate-dark)', fontSize: '0.8rem' }}>{post.readingTime} min read</span>}
        </div>

        <h1 style={{
          margin: 0,
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(2rem, 5vw, 3.8rem)',
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
        }}>{post.title}</h1>
        {post.subtitle && <p style={{ margin: '1rem 0 0', color: 'var(--vc-slate)', fontSize: '1.15rem', lineHeight: 1.7 }}>{post.subtitle}</p>}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '1.5rem 0',
          margin: '1.5rem 0 2rem',
          borderTop: '1px solid rgba(255,255,255,.08)',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}>
          <div>
            <span style={{ display: 'block', color: 'var(--vc-cream)', fontWeight: 600 }}>{author}</span>
            <span style={{ color: 'var(--vc-slate-dark)', fontSize: '0.8rem' }}>Originally published on Medium · {formatDate(post.publishedAt)}</span>
          </div>
          <button type="button" className="vc-btn vc-btn-outline" onClick={handleShare}>Share ↗</button>
        </div>
        {shareMessage && <p role="status" style={{ color: 'var(--vc-gold)', marginTop: '-1rem' }}>{shareMessage}</p>}

        {post.excerpt && (
          <p style={{ marginBottom: '2rem', color: 'var(--vc-cream)', fontSize: '1.12rem', fontWeight: 500, lineHeight: 1.8 }}>
            {post.excerpt}
          </p>
        )}

        {post.contentAvailable && post.content ? (
          <div
            className="journal-article-content"
            style={{ color: 'rgba(245,240,232,.88)', fontSize: '1.05rem', lineHeight: 1.9 }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <p style={{ color: 'var(--vc-slate)', lineHeight: 1.8 }}>
            The full essay is available on Medium. Continue reading there to see the original publication.
          </p>
        )}

        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            {post.tags.map(tag => <span key={tag} className="vc-badge vc-badge-slate">#{tag}</span>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '2.5rem' }}>
          <a href={post.canonicalUrl} target="_blank" rel="noopener noreferrer" className="vc-btn vc-btn-gold">
            Continue Reading on Medium ↗
          </a>
          <Link to="/journal" className="vc-btn vc-btn-outline">More from THE JOURNAL</Link>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: '4rem' }}>
            <span className="vc-section-label">Keep reading</span>
            <h2 style={{ margin: '0.4rem 0 1.25rem', fontFamily: 'Playfair Display, serif', fontSize: '1.8rem' }}>More from the Journal</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
              {related.map(article => (
                <Link key={article._id} to={`/journal/${article.slug}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden', background: 'var(--vc-bg-card)' }}>
                  {article.coverImage && <img src={article.coverImage} alt="" loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />}
                  <span style={{ display: 'block', padding: '1rem', fontFamily: 'Playfair Display, serif', fontWeight: 600, lineHeight: 1.4 }}>{article.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
