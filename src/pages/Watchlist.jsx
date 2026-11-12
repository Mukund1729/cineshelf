import { tmdbImageUrl } from '../api/tmdb';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

export default function Watchlist() {
  const [movies, setMovies] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchWatchlist = () => {
    if (!token) { setError('Please sign in to view your watchlist.'); setLoading(false); return; }
    setLoading(true);
    axios.get('/api/watchlist', { headers })
      .then(res => {
        const data = res.data?.data || res.data?.movies || [];
        setMovies(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        if (err.response?.status === 401) setError('Please sign in to view your watchlist.');
        else setError('Failed to load watchlist.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWatchlist(); }, []);

  // Search movies via backend proxy (raw TMDB data — poster_path is /xxx not a full URL)
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      axios.get('/api/tmdb/search', { params: { query: search, type: 'multi', page: 1 } })
        .then(res => setSearchResults((res.data?.results || []).filter(m => m.media_type !== 'person').slice(0, 8)))
        .catch(() => setSearchResults([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAddMovie = async (e) => {
    e.preventDefault();
    if (!selectedMovie) return;
    setSaving(true);
    try {
      await axios.post('/api/watchlist', {
        tmdbId: selectedMovie.id,
        title: selectedMovie.title || selectedMovie.name,
        poster: selectedMovie.poster_path ? tmdbImageUrl(selectedMovie.poster_path, 'w500') : '',
        overview: selectedMovie.overview || '',
        releaseDate: selectedMovie.release_date || selectedMovie.first_air_date || '',
        voteAverage: selectedMovie.vote_average || 0,
        mediaType: selectedMovie.media_type || 'movie',
      }, { headers });
      showToast(`"${selectedMovie.title || selectedMovie.name}" added to watchlist!`);
      setShowAdd(false);
      setSearch('');
      setSearchResults([]);
      setSelectedMovie(null);
      fetchWatchlist();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add movie.');
    } finally {
      setSaving(false);
    }
  };

  const removeMovie = async (tmdbId) => {
    try {
      await axios.delete(`/api/watchlist/${tmdbId}`, { headers });
      setMovies(prev => prev.filter(m => (m.tmdbId || m.id) !== tmdbId));
      showToast('Removed from watchlist.');
    } catch {
      showToast('Failed to remove.');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* Header */}
      <section style={{ padding: '4rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="vc-section-label">Your Queue</span>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900 }}>
              Watchlist
            </h1>
            {!loading && !error && (
              <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginTop: '0.4rem', fontSize: '0.9rem' }}>
                {movies.length} film{movies.length !== 1 ? 's' : ''} queued
              </p>
            )}
          </div>
          {token && (
            <button
              className={`vc-btn ${showAdd ? 'vc-btn-ghost' : 'vc-btn-primary'}`}
              onClick={() => { setShowAdd(v => !v); setSelectedMovie(null); setSearch(''); setSearchResults([]); }}
            >
              {showAdd ? '✕ Cancel' : '+ Add Film'}
            </button>
          )}
        </div>
      </section>

      {/* Add film search panel */}
      {showAdd && (
        <div style={{ background: 'var(--vc-bg-surface)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem 0' }}>
          <div className="vc-container" style={{ maxWidth: '560px' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', marginBottom: '0.75rem' }}>Search for a film</h3>
            <div style={{ position: 'relative' }}>
              <input
                className="vc-input"
                placeholder="Type a movie or show name…"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedMovie(null); }}
                autoFocus
              />
              {/* Dropdown results */}
              {searchResults.length > 0 && !selectedMovie && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                  background: 'var(--vc-bg-elevated)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  maxHeight: '280px', overflowY: 'auto',
                }}>
                  {searchResults.map(m => (
                    <div
                      key={m.id}
                      onClick={() => { setSelectedMovie(m); setSearch(m.title || m.name); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem',
                        cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      {m.poster_path ? (
                        <img src={tmdbImageUrl(m.poster_path, 'w92')} alt={m.title || m.name}
                          style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 54, background: 'var(--vc-bg-card)', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🎬</div>
                      )}
                      <div>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', color: 'var(--vc-cream)', fontWeight: 500 }}>
                          {m.title || m.name}
                        </div>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)' }}>
                          {(m.release_date || m.first_air_date || '').slice(0, 4)}
                          {m.vote_average > 0 ? ` · ★ ${m.vote_average.toFixed(1)}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected movie confirm */}
            {selectedMovie && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--vc-bg-card)', borderRadius: '10px', padding: '0.75rem', border: '1px solid rgba(212,175,55,0.2)' }}>
                {selectedMovie.poster_path && (
                  <img src={tmdbImageUrl(selectedMovie.poster_path, 'w92')} alt={selectedMovie.title || selectedMovie.name}
                    style={{ width: 50, height: 75, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.95rem', color: 'var(--vc-cream)', marginBottom: '0.25rem' }}>
                    {selectedMovie.title || selectedMovie.name}
                  </div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
                    {(selectedMovie.release_date || selectedMovie.first_air_date || '').slice(0, 4)}
                  </div>
                </div>
                <button
                  className="vc-btn vc-btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
                  onClick={handleAddMovie}
                  disabled={saving}
                >
                  {saving ? 'Adding…' : 'Add'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Watchlist grid */}
      <div className="vc-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="vc-skeleton vc-skeleton-poster" style={{ borderRadius: 8 }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--vc-slate)' }}>
            <p style={{ marginBottom: '1.5rem' }}>{error}</p>
            <button
              className="vc-btn vc-btn-primary"
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
            >
              Sign In
            </button>
          </div>
        ) : movies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--vc-slate)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', color: 'var(--vc-cream)', marginBottom: '0.5rem' }}>Your watchlist is empty.</p>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Add films you want to watch using the "+ Add Film" button above.
            </p>
            <Link to="/discover" className="vc-btn vc-btn-primary">Discover Films</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {movies.map(movie => {
              const id = movie.tmdbId || movie.id;
              const poster = movie.poster || movie.posterUrl || '';
              const title = movie.title || 'Unknown';
              const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : '';
              return (
                <div key={id} style={{ position: 'relative' }}>
                  <Link to={`/movie/${id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className="vc-poster-card" style={{ aspectRatio: '2/3' }}>
                      {poster ? (
                        <img src={tmdbImageUrl(poster, 'w300')} alt={title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'var(--vc-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', textAlign: 'center', padding: '0.75rem' }}>
                          {title}
                        </div>
                      )}
                      <div className="vc-overlay">
                        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.2rem', lineHeight: 1.3 }}>{title}</div>
                        {year && <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'var(--vc-slate)' }}>{year}</div>}
                      </div>
                    </div>
                  </Link>
                  {/* Remove button */}
                  <button
                    onClick={() => removeMovie(id)}
                    title="Remove from watchlist"
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(0,0,0,0.75)', border: 'none',
                      borderRadius: '50%', width: 24, height: 24,
                      color: '#fc8181', cursor: 'pointer', fontSize: '0.7rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 2, transition: 'background 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(229,62,62,0.8)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.75)'}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="vc-toast">
          <div className="vc-toast-item vc-toast-info">{toast}</div>
        </div>
      )}
    </div>
  );
}
