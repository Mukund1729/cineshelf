import { tmdbImageUrl } from '../api/tmdb';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getWeeklyTrendingMovies } from '../api/tmdb';
import LoadingSpinner from '../components/LoadingSpinner';
import Navbar from '../components/Navbar';

function TrendingMovies() {
  const { data, status, error } = useQuery({
    queryKey: ['trending-movies'],
    queryFn: () => getWeeklyTrendingMovies(),
  });

  if (status === 'pending') return <LoadingSpinner />;
  if (status === 'error') return <div className="text-center text-red-400 py-12">Error: {error.message}</div>;

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
          <span className="vc-section-label">🔥 Trending</span>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
          }}>
            Trending Movies
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: 560, marginBottom: '1.5rem' }}>
            The hottest films everyone's watching right now, updated weekly.
          </p>
        </div>
      </section>

      <div className="vc-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {data?.filter(m => m.poster_path).map(movie => (
            <Link key={movie.id} to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
              <div className="vc-poster-card" style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--vc-bg-card)' }}>
                <div style={{ aspectRatio: '2/3', position: 'relative' }}>
                  <img
                    src={tmdbImageUrl(movie.poster_path, 'w500')}
                    alt={movie.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.onerror = null; e.target.src = '/placeholder-movie.jpg'; }}
                  />
                  {movie.vote_average > 0 && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: 4,
                      fontSize: '0.68rem', color: 'var(--vc-gold)', fontWeight: 700,
                    }}>★ {movie.vote_average.toFixed(1)}</span>
                  )}
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.9rem', color: 'var(--vc-cream)', fontWeight: 700 }}>{movie.title}</div>
                  {movie.release_date && <div style={{ fontSize: '0.72rem', color: 'var(--vc-slate)' }}>{movie.release_date.slice(0, 4)}</div>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TrendingMovies;