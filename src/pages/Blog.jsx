import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

const MEDIUM_PROFILE = 'https://medium.com/@mukundmangal2173';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ArticleCard({ article, featured = false }) {
  return (
    <article style={{
      display: 'flex',
      flexDirection: featured ? 'row' : 'column',
      minHeight: featured ? 300 : '100%',
      overflow: 'hidden',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.09)',
      background: 'var(--vc-bg-card)',
    }}>
      <Link
        to={`/journal/${article.slug}`}
        aria-label={`Read ${article.title}`}
        style={{
          display: 'block',
          flex: featured ? '0 0 52%' : 'none',
          minHeight: featured ? 300 : 210,
          background: article.coverImage
            ? `linear-gradient(180deg, transparent 55%, rgba(7,10,16,.55)), url("${article.coverImage}") center/cover`
            : 'radial-gradient(circle at 75% 20%, rgba(212,175,55,.26), transparent 35%), linear-gradient(135deg, #18212d, #0c111a)',
        }}
      />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: featured ? '2rem' : '1.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          <span className="vc-badge vc-badge-gold">{article.categories?.[0] || article.tags?.[0] || 'Essay'}</span>
          <span style={{ color: 'var(--vc-slate-dark)', fontSize: '0.75rem' }}>{formatDate(article.publishedAt)}</span>
        </div>
        <Link to={`/journal/${article.slug}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none' }}>
          <h2 style={{
            margin: 0,
            fontFamily: 'Playfair Display, serif',
            fontSize: featured ? 'clamp(1.7rem, 3vw, 2.45rem)' : '1.35rem',
            lineHeight: 1.2,
          }}>{article.title}</h2>
        </Link>
        {article.subtitle && (
          <p style={{ margin: '0.75rem 0 0', color: 'var(--vc-cream)', opacity: 0.8, lineHeight: 1.6 }}>{article.subtitle}</p>
        )}
        {article.excerpt && (
          <p style={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: featured ? 4 : 3,
            margin: '0.85rem 0 1.25rem',
            color: 'var(--vc-slate)',
            fontSize: '0.92rem',
            lineHeight: 1.7,
          }}>{article.excerpt}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: 'auto' }}>
          <span style={{ color: 'var(--vc-slate-dark)', fontSize: '0.78rem' }}>
            {article.readingTime ? `${article.readingTime} min read` : 'Mukund Mangal'}
          </span>
          <Link to={`/journal/${article.slug}`} className="vc-btn vc-btn-ghost" style={{ whiteSpace: 'nowrap' }}>
            Read essay →
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function Blog() {
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axios.get('/api/journal', { params: { page, limit: 12, search, category, sort } })
      .then(response => {
        if (!active) return;
        const data = response.data?.data || [];
        setArticles(data);
        setPagination(response.data?.pagination || { page: 1, pages: 1, total: data.length });
        setCategories(previous => [...new Set([...previous, ...data.flatMap(item => item.categories || [])])].sort());
      })
      .catch(() => {
        if (active) setError('The Journal could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, search, category, sort]);

  const featuredArticle = useMemo(() => page === 1 && !search && !category && sort === 'newest' ? articles[0] : null, [articles, page, search, category, sort]);
  const remainingArticles = featuredArticle ? articles.slice(1) : articles;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <main>
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(4rem, 10vw, 8rem) 1.25rem 4rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'radial-gradient(ellipse at 75% 35%, rgba(212,175,55,0.13), transparent 42%), linear-gradient(125deg, #0b111a, #111720 60%, #0a0f16)',
        }}>
          <div className="vc-container" style={{ position: 'relative', maxWidth: 1200 }}>
            <span className="vc-section-label">Visual Cineaste · Mukund Mangal</span>
            <h1 style={{
              margin: '1rem 0 0.3rem',
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(3rem, 9vw, 7rem)',
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 1,
            }}>THE JOURNAL<span style={{ color: 'var(--vc-gold)' }}>.</span></h1>
            <p style={{ margin: '1.25rem 0 0', color: 'var(--vc-gold)', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.2rem, 2.5vw, 1.75rem)', fontStyle: 'italic' }}>
              Beyond the Frames.
            </p>
            <p style={{ maxWidth: 650, margin: '0.85rem 0 0', color: 'var(--vc-slate)', fontSize: '1rem', lineHeight: 1.8 }}>
              Essays on cinema, storytelling, life and the thoughts that refuse to stay unwritten.
            </p>
            <a href={MEDIUM_PROFILE} target="_blank" rel="noopener noreferrer" className="vc-btn vc-btn-outline" style={{ display: 'inline-flex', marginTop: '1.5rem' }}>
              Follow on Medium ↗
            </a>
          </div>
        </section>

        <section className="vc-container" style={{ maxWidth: 1200, paddingTop: '2.5rem', paddingBottom: '5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <span className="vc-section-label">The archive</span>
              <h2 style={{ margin: '0.35rem 0 0', fontFamily: 'Playfair Display, serif', fontSize: '2rem' }}>Words, ideas and everything in between.</h2>
            </div>
            <span style={{ color: 'var(--vc-slate)', fontSize: '0.85rem' }}>
              {pagination.total} {pagination.total === 1 ? 'article' : 'articles'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <input
              type="search"
              className="vc-input"
              aria-label="Search Journal"
              placeholder="Search titles, essays or tags"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              style={{ flex: '1 1 260px', maxWidth: 480 }}
            />
            <select className="vc-input" aria-label="Filter by category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select className="vc-input" aria-label="Sort articles" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {error ? (
            <div role="alert" style={{ padding: '1.25rem', border: '1px solid rgba(255,100,100,.25)', borderRadius: 12, color: '#ffc8c8' }}>{error}</div>
          ) : loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
              {[1, 2, 3].map(item => <div key={item} className="vc-skeleton" style={{ height: 330, borderRadius: 16 }} />)}
            </div>
          ) : articles.length ? (
            <>
              {featuredArticle && <div style={{ marginBottom: '1.25rem' }}><ArticleCard article={featuredArticle} featured /></div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
                {remainingArticles.map(article => <ArticleCard key={article._id} article={article} />)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
                <button className="vc-btn vc-btn-outline" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>← Newer</button>
                <span style={{ color: 'var(--vc-slate)', fontSize: '0.85rem' }}>Page {pagination.page} of {Math.max(pagination.pages, 1)}</span>
                <button className="vc-btn vc-btn-outline" disabled={page >= pagination.pages} onClick={() => setPage(current => current + 1)}>Older →</button>
              </div>
            </>
          ) : (
            <div style={{ padding: '3rem 1rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, textAlign: 'center' }}>
              <p style={{ color: 'var(--vc-slate)', marginBottom: '1rem' }}>{search ? 'No essays matched that search.' : 'No articles are available in the imported archive yet.'}</p>
              {!search && <a href={MEDIUM_PROFILE} target="_blank" rel="noopener noreferrer" className="vc-btn vc-btn-outline">Visit Medium ↗</a>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
