import { tmdbImageUrl } from '../api/tmdb';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

const GENRES = [
  { id: 10759, name: 'Action & Adventure' }, { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' }, { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' }, { id: 10762, name: 'Kids' }, { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' }, { id: 10764, name: 'Reality' }, { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' }, { id: 10767, name: 'Talk' }, { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'first_air_date.desc', label: 'Newest' },
];

function TVCard({ show }) {
  const img = show.poster_path ? tmdbImageUrl(show.poster_path, 'w342') : null;
  const year = show.first_air_date ? show.first_air_date.slice(0, 4) : '';
  return (
    <Link to={`/tv/${show.id}`} style={{ textDecoration: 'none' }}>
      <div className="vc-poster-card" style={{ aspectRatio: '2/3' }}>
        {img ? (
          <img src={img} alt={show.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--vc-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>{show.name}</div>
        )}
        <div className="vc-overlay">
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: '0.2rem', lineHeight: 1.3 }}>{show.name}</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {show.vote_average > 0 && <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-gold)' }}>★ {show.vote_average.toFixed(1)}</span>}
            {year && <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)' }}>{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TVShows() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState('popularity.desc');
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = { type: 'tv', sort_by: sort, page };
    if (genre) params.with_genres = genre;
    axios.get('/api/tmdb/discover', { params })
      .then(res => {
        setShows(res.data?.results || []);
        setTotalPages(Math.min(res.data?.total_pages || 1, 50));
      })
      .catch(() => setError('Failed to load TV shows.'))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, genre, sort]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <section style={{
        paddingTop: '6rem',
        paddingBottom: '3rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, #060912 0%, #0a0f1a 50%, #0d1420 100%)',
      }}>
        <div className="vc-container">
          <span className="vc-section-label">📺 Television</span>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
          }}>
            TV Shows
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: 560, marginBottom: '1.5rem' }}>
            Browse television series by genre, popularity, and rating. Discover your next binge-worthy show.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div style={{ padding: '1.25rem 0', background: 'var(--vc-bg-surface)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="vc-container" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={sort}
            onChange={e => { setSort(e.target.value); setPage(1); }}
            className="vc-input"
            style={{ maxWidth: '200px' }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={genre}
            onChange={e => { setGenre(e.target.value); setPage(1); }}
            className="vc-input"
            style={{ maxWidth: '220px' }}
          >
            <option value="">All Genres</option>
            {GENRES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <section style={{ padding: '3rem 0' }}>
        <div className="vc-container">
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {Array.from({ length: 20 }, (_, i) => <div key={i} className="vc-skeleton vc-skeleton-poster" style={{ borderRadius: 8 }} />)}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
              <p style={{ marginBottom: '1rem' }}>{error}</p>
              <button className="vc-btn vc-btn-outline" onClick={() => setPage(1)}>Retry</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {shows.map(show => <TVCard key={show.id} show={show} />)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                <button className="vc-btn vc-btn-outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', padding: '0 0.5rem' }}>Page {page} of {totalPages}</span>
                <button className="vc-btn vc-btn-outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
