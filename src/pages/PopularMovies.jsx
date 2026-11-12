import { tmdbImageUrl } from '../api/tmdb';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

function PosterCard({ movie }) {
  const img = movie.poster_path
    ? tmdbImageUrl(movie.poster_path, 'w342')
    : null;
  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
  return (
    <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
      <div className="vc-poster-card" style={{ aspectRatio: '2/3' }}>
        {img ? (
          <img src={img} alt={movie.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--vc-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
            {movie.title}
          </div>
        )}
        <div className="vc-overlay">
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem', lineHeight: 1.3 }}>
            {movie.title}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {movie.vote_average > 0 && (
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-gold)' }}>
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}
            {year && <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)' }}>{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid({ count = 20 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="vc-skeleton vc-skeleton-poster" style={{ borderRadius: 8 }} />
      ))}
    </div>
  );
}

export default function PopularMovies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get('/api/tmdb/popular', { params: { page } })
      .then(res => {
        setMovies(res.data?.results || []);
        setTotalPages(Math.min(res.data?.total_pages || 1, 50));
      })
      .catch(() => setError('Failed to load popular movies.'))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <section style={{ padding: '4rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg, #060912 0%, #0a0f1a 50%, #0d1420 100%)' }}>
        <div className="vc-container">
          <span className="vc-section-label">TMDB Charts</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900, marginBottom: '0.5rem' }}>
            Popular Movies
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', fontSize: '0.95rem' }}>
            The films everyone is watching right now.
          </p>
        </div>
      </section>

      <section style={{ padding: '3rem 0' }}>
        <div className="vc-container">
          {loading ? (
            <SkeletonGrid />
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
              <p style={{ marginBottom: '1rem' }}>{error}</p>
              <button className="vc-btn vc-btn-outline" onClick={() => setPage(1)}>Retry</button>
            </div>
          ) : (
            <>
              <div className="vc-film-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {movies.map(movie => <PosterCard key={movie.id} movie={movie} />)}
              </div>
              {/* Pagination */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="vc-btn vc-btn-outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ opacity: page === 1 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', padding: '0 0.5rem' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="vc-btn vc-btn-outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ opacity: page === totalPages ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
