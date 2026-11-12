import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';

// Lazy-load Three.js canvas (not critical for FCP)
const HeroCanvas = lazy(() => import('../components/HeroCanvas'));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const IMG = (path, size = 'w500') =>
  path ? apiUrl(`/api/tmdb/image/${size}${path}`) : null;

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0NTAiIGZpbGw9IiMxYTIyMzYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzY0NzQ4YiIgZm9udC1mYW1pbHk9InNlcmlmIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

// ─── Poster Card ─────────────────────────────────────────────────────────────
function PosterCard({ movie, size = 'normal' }) {
  const [hovered, setHovered] = useState(false);
  const isMovie = !movie.first_air_date;
  const title = movie.title || movie.name || 'Untitled';
  const year  = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const img   = IMG(movie.poster_path, 'w342');
  const rating = movie.vote_average?.toFixed(1);
  const to = isMovie ? `/movie/${movie.id}` : `/tv/${movie.id}`;

  const widths = { small: '120px', normal: '150px', large: '180px' };
  const w = widths[size] || widths.normal;

  return (
    <Link to={to} style={{ textDecoration: 'none', flexShrink: 0, width: w }}>
      <div
        style={{
          position: 'relative',
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--vc-bg-elevated)',
          transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
          transition: 'transform 220ms cubic-bezier(0.25,0.1,0.25,1), box-shadow 220ms',
          boxShadow: hovered ? '0 20px 50px rgba(0,0,0,0.7)' : '0 4px 16px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          aspectRatio: '2/3',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          src={img || PLACEHOLDER}
          alt={title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { e.target.src = PLACEHOLDER; }}
        />
        {/* Rating badge */}
        {rating > 0 && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
            borderRadius: 4, padding: '2px 6px',
            fontFamily: 'Outfit, sans-serif', fontSize: '0.68rem', fontWeight: 700,
            color: rating >= 7 ? '#d4af37' : rating >= 5 ? '#f5f0e8' : '#94a3b8',
          }}>
            ★ {rating}
          </div>
        )}
        {/* Hover reveal */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
          opacity: hovered ? 1 : 0, transition: 'opacity 220ms',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0.75rem',
        }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.82rem', fontWeight: 700, color: '#f5f0e8', lineHeight: 1.3, marginBottom: 2 }}>{title}</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.68rem', color: '#94a3b8' }}>{year}{!isMovie ? ' · TV' : ''}</div>
        </div>
      </div>
    </Link>
  );
}

// ─── Horizontal Strip ─────────────────────────────────────────────────────────
function Strip({ title, label, items = [], linkTo, size = 'normal' }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };
  return (
    <section style={{ marginBottom: '3.5rem' }}>
      <div className="vc-container" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          {label && <span className="vc-section-label">{label}</span>}
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 700, margin: 0 }}>{title}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {linkTo && <Link to={linkTo} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', color: 'var(--vc-gold)', textDecoration: 'none', letterSpacing: '0.08em' }}>See all →</Link>}
          <button onClick={() => scroll(-1)} style={{ background: 'var(--vc-bg-elevated)', border: 'none', borderRadius: 4, color: 'var(--vc-slate)', width: 28, height: 28, cursor: 'pointer', fontSize: '0.8rem' }}>‹</button>
          <button onClick={() => scroll(1)}  style={{ background: 'var(--vc-bg-elevated)', border: 'none', borderRadius: 4, color: 'var(--vc-slate)', width: 28, height: 28, cursor: 'pointer', fontSize: '0.8rem' }}>›</button>
        </div>
      </div>
      <div className="vc-container" style={{ overflowX: 'hidden', position: 'relative' }}>
        <div
          ref={scrollRef}
          style={{
            display: 'flex', gap: '0.75rem', overflowX: 'auto',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
            paddingBottom: '0.5rem',
          }}
        >
          {items.length === 0
            ? Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="vc-skeleton" style={{ width: size === 'large' ? 180 : size === 'small' ? 120 : 150, aspectRatio: '2/3', borderRadius: 6, flexShrink: 0 }} />
              ))
            : items.map(m => <PosterCard key={m.id} movie={m} size={size} />)
          }
        </div>
      </div>
    </section>
  );
}

// ─── Editorial Grid (Now Playing) ────────────────────────────────────────────
function EditorialGrid({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="vc-film-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="vc-skeleton" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 6 }} />
        ))}
      </div>
    );
  }
  return (
    <div className="vc-film-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
      {items.slice(0, 12).map((m, idx) => {
        const title  = m.title || m.name || 'Untitled';
        const year   = (m.release_date || '').slice(0, 4);
        const img    = IMG(m.poster_path, 'w342');
        const rating = m.vote_average?.toFixed(1);
        return (
          <Link key={m.id} to={`/movie/${m.id}`} style={{ textDecoration: 'none' }}>
            <div className="vc-poster-card" style={{ aspectRatio: '2/3' }}>
              <img src={img || PLACEHOLDER} alt={title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = PLACEHOLDER; }} />
              {/* Rank overlay */}
              <div style={{
                position: 'absolute', top: 8, left: 8,
                fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', fontWeight: 800,
                color: 'rgba(0,0,0,0.8)', background: 'var(--vc-gold)',
                borderRadius: 3, padding: '2px 5px', lineHeight: 1,
              }}>{idx + 1}</div>
              {rating > 0 && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
                  borderRadius: 4, padding: '2px 5px',
                  fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', fontWeight: 700,
                  color: rating >= 7 ? '#d4af37' : '#f5f0e8',
                }}>★ {rating}</div>
              )}
              <div className="vc-overlay">
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 2, lineHeight: 1.3 }}>{title}</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'var(--vc-slate)' }}>{year}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── AI Discover Block ───────────────────────────────────────────────────────
function AIDiscoverBlock() {
  const [input, setInput]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [source, setSource]   = useState('');

  const EXAMPLES = [
    'slow melancholic films like Certified Copy',
    'gritty crime dramas in black and white',
    'cosmic horror with beautiful cinematography',
    'Indian films about quiet longing',
    'films where nothing happens but everything changes',
  ];

  const handleSearch = async (q) => {
    const query = typeof q === 'string' ? q : input;
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setError('');

    try {
      const res = await axios.post('/api/gpt', {
        prompt: query.trim(),
        temperature: 0.8,
      });

      const raw = res.data?.reply || '';
      setSource(res.data?.source || '');

      // Parse JSON array from the response
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setResults(Array.isArray(parsed) ? parsed : []);
      } else {
        // Text format fallback
        setResults([{ title: 'Response', description: raw, year: '', director: '', moodTags: [], visualTags: [], language: '' }]);
      }
    } catch (err) {
      setError('AI discovery failed. Check your API key or try again.');
      console.error('[AI discover]', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ padding: '4rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="vc-container">
        <span className="vc-section-label">AI-Powered · GPT-4o</span>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, marginBottom: '0.5rem' }}>
          Discover by Vibe
        </h2>
        <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', fontSize: '0.9rem', marginBottom: '1.75rem', maxWidth: 520 }}>
          Describe a feeling, director, era, or aesthetic — and get cinephile-grade recommendations.
        </p>

        {/* Search bar */}
        <div className="vc-ai-search-form" style={{ display: 'flex', gap: '0.5rem', maxWidth: 640, marginBottom: '1rem' }}>
          <input
            className="vc-input"
            placeholder="e.g. slow burn psychological thrillers with unreliable narrators…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <button
            className="vc-btn vc-btn-primary"
            onClick={() => handleSearch()}
            disabled={loading || !input.trim()}
            style={{ opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {loading ? '···' : 'Discover'}
          </button>
        </div>

        {/* Example prompts */}
        {!results.length && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setInput(ex); handleSearch(ex); }}
                style={{
                  background: 'var(--vc-bg-elevated)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4, padding: '0.35rem 0.75rem',
                  fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-slate)',
                  cursor: 'pointer', transition: 'all 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--vc-gold)'; e.currentTarget.style.color = 'var(--vc-gold)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--vc-slate)'; }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && <p style={{ color: '#fc8181', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="vc-skeleton" style={{ height: 120, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            {source && (
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'var(--vc-slate)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: source === 'openai' ? '#48bb78' : '#d4af37', display: 'inline-block' }} />
                {source === 'openai' ? 'Powered by GPT-4o-mini' : 'Powered by Mistral (fallback)'}
              </div>
            )}
            <div className="vc-ai-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
              {results.map((film, i) => (
                <AIFilmCard key={i} film={film} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AIFilmCard({ film }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        background: hovered ? 'var(--vc-bg-elevated)' : 'var(--vc-bg-surface)',
        border: `1px solid ${hovered ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 8, padding: '1.25rem',
        transition: 'all 180ms', cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 700, color: 'var(--vc-cream)', lineHeight: 1.3 }}>
            {film.title}
          </div>
          {film.year && film.director && (
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)', marginTop: 2 }}>
              {film.year} · {film.director}
            </div>
          )}
        </div>
        {film.language && (
          <span className="vc-badge vc-badge-slate" style={{ flexShrink: 0, marginLeft: '0.5rem' }}>{film.language}</span>
        )}
      </div>
      {film.description && (
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--vc-slate)', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
          {film.description}
        </p>
      )}
      {(film.moodTags?.length > 0 || film.visualTags?.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {film.moodTags?.map((t, i) => <span key={i} className="vc-badge vc-badge-gold" style={{ fontSize: '0.62rem' }}>{t}</span>)}
          {film.visualTags?.map((t, i) => <span key={i} className="vc-badge vc-badge-cyan" style={{ fontSize: '0.62rem' }}>{t}</span>)}
        </div>
      )}
    </div>
  );
}

// ─── Hero Featured Card ───────────────────────────────────────────────────────
function HeroFeatured({ movie }) {
  if (!movie) return null;
  const title    = movie.title || 'Trending Now';
  const overview = movie.overview?.slice(0, 160);
  const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
  const rating   = movie.vote_average?.toFixed(1);
  const year     = movie.release_date?.slice(0, 4);

  return (
    <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none', display: 'block', position: 'absolute', right: '5%', bottom: '12%', width: 'clamp(240px, 22vw, 320px)', zIndex: 5 }}>
      <div style={{
        background: 'rgba(10,15,26,0.88)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        transition: 'transform 200ms, box-shadow 200ms',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 28px 70px rgba(0,0,0,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)'; }}
      >
        {backdrop && <img src={backdrop} alt={title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />}
        <div style={{ padding: '0.875rem' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.95rem', fontWeight: 700, color: 'var(--vc-cream)', marginBottom: '0.25rem', lineHeight: 1.3 }}>{title}</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
            {year && <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'var(--vc-slate)' }}>{year}</span>}
            {rating > 0 && <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'var(--vc-gold)', fontWeight: 700 }}>★ {rating}</span>}
          </div>
          {overview && <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)', lineHeight: 1.55, margin: 0 }}>{overview}…</p>}
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [trending,   setTrending]   = useState([]);
  const [popular,    setPopular]    = useState([]);
  const [topRated,   setTopRated]   = useState([]);
  const [popularTV,  setPopularTV]  = useState([]);
  const [searchQ,    setSearchQ]    = useState('');
  const [searching,  setSearching]  = useState(false);
  const [searchRes,  setSearchRes]  = useState([]);
  const [heroMovie,  setHeroMovie]  = useState(null);
  const debounce = useRef(null);

  // Fetch all sections — direct TMDB API (no proxy timeout)
  useEffect(() => {
    const KEY = import.meta.env.VITE_TMDB_KEY || import.meta.env.VITE_TMDB_API_KEY || '049f46f11e71c08eba866acaefc280df';
    const BASE = 'https://api.themoviedb.org/3';

    const fetchAll = async () => {
      try {
        const [tRes, pRes, trRes, tvRes] = await Promise.all([
          fetch(`${BASE}/trending/movie/week?api_key=${KEY}`).then(r => r.json()),
          fetch(`${BASE}/movie/popular?api_key=${KEY}`).then(r => r.json()),
          fetch(`${BASE}/movie/top_rated?api_key=${KEY}`).then(r => r.json()),
          fetch(`${BASE}/tv/popular?api_key=${KEY}`).then(r => r.json()),
        ]);
        const tMovies = tRes.results || [];
        setTrending(tMovies);
        setPopular(pRes.results || []);
        setTopRated(trRes.results || []);
        setPopularTV(tvRes.results || []);
        setHeroMovie(tMovies.find(m => m.backdrop_path && m.overview) || tMovies[0] || null);
      } catch (err) {
        console.error('[HomePage] Fetch error:', err.message);
      }
    };
    fetchAll();
  }, []);


  // Debounced search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!searchQ.trim()) { setSearchRes([]); setSearching(false); return; }
    setSearching(true);
    const KEY = import.meta.env.VITE_TMDB_KEY || import.meta.env.VITE_TMDB_API_KEY || '049f46f11e71c08eba866acaefc280df';
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${KEY}&query=${encodeURIComponent(searchQ)}&page=1`);
        const data = await res.json();
        setSearchRes(data.results || []);
      } catch { setSearchRes([]); }
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [searchQ]);


  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="vc-home-hero" style={{
        position: 'relative', minHeight: '95vh', display: 'flex', alignItems: 'center',
        overflow: 'hidden', background: 'linear-gradient(135deg, #060912 0%, #0a0f1a 50%, #0d1420 100%)',
      }}>
        {/* Three.js particle canvas */}
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>

        {/* Cinematic backdrop image */}
        {heroMovie?.backdrop_path && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
            <img
              src={`https://image.tmdb.org/t/p/original${heroMovie.backdrop_path}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.14, filter: 'grayscale(0.5) contrast(1.05)' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(6,9,18,0.96) 40%, rgba(6,9,18,0.4) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,9,18,1) 0%, transparent 50%)' }} />
          </div>
        )}

        {/* Hero content */}
        <div className="vc-container vc-home-hero-content" style={{ position: 'relative', zIndex: 10, paddingTop: '6rem', paddingBottom: '4rem' }}>
          {/* Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{ width: 32, height: 2, background: 'linear-gradient(90deg, var(--vc-gold), transparent)' }} />
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--vc-gold)', fontWeight: 700 }}>
              Visual · Cineaste
            </span>
          </div>

          {/* Headline */}
          <h1 className="vc-home-hero-title" style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(3rem, 7vw, 6rem)',
            fontWeight: 900, lineHeight: 1.05, marginBottom: '1.5rem',
            letterSpacing: '-0.03em', maxWidth: 800,
            textShadow: '0 4px 30px rgba(0,0,0,0.5)',
          }}>
            Cinema,
            <br />
            <em style={{ fontStyle: 'italic', color: 'var(--vc-gold)' }}>rediscovered.</em>
          </h1>

          <p className="vc-home-hero-description" style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.1rem, 1.8vw, 1.25rem)',
            color: 'var(--vc-slate)', maxWidth: 520, lineHeight: 1.8, marginBottom: '3rem',
            fontWeight: 400,
          }}>
            Discover films by director, vision, and aesthetic —<br />not just genre. Track, review, and share your cinematic journey.
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 600, marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 16, color: 'var(--vc-slate)', width: 18, height: 18, pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="vc-input"
                style={{ 
                  padding: '1rem 3.5rem 1rem 3rem',
                  fontSize: '1rem', 
                  background: 'rgba(255,255,255,0.08)', 
                  backdropFilter: 'blur(16px)', 
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}
                placeholder="Search movies, shows, people…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searchQ && (
                <button
                  onClick={() => { setSearchQ(''); setSearchRes([]); setSearching(false); }}
                  style={{ position: 'absolute', right: 14, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--vc-slate)', cursor: 'pointer', fontSize: '1.25rem', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >×</button>
              )}
            </div>

            {/* Search results dropdown */}
            {searching && searchRes.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 50,
                background: 'rgba(15, 20, 30, 0.95)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, overflow: 'hidden', 
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                maxHeight: 400, overflowY: 'auto',
              }}>
                {searchRes.filter(r => r.media_type !== 'person').slice(0, 10).map(r => {
                  const isTV   = r.media_type === 'tv';
                  const title  = r.title || r.name || '';
                  const year   = (r.release_date || r.first_air_date || '').slice(0, 4);
                  const poster = r.poster_path ? IMG(r.poster_path, 'w92') : null;
                  return (
                    <Link
                      key={r.id}
                      to={isTV ? `/tv/${r.id}` : `/movie/${r.id}`}
                      onClick={() => { setSearchQ(''); setSearchRes([]); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.6rem 0.875rem', textDecoration: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      {poster
                        ? <img src={poster} alt={title} style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 48, background: 'var(--vc-bg-card)', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🎬</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.875rem', color: 'var(--vc-cream)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'var(--vc-slate)' }}>{year}{isTV ? ' · TV' : ' · Film'}</div>
                      </div>
                      {r.vote_average > 0 && <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-gold)', fontWeight: 700, flexShrink: 0 }}>★ {r.vote_average.toFixed(1)}</span>}
                    </Link>
                  );
                })}
                <Link to="/discover" onClick={() => { setSearchQ(''); setSearchRes([]); }} style={{ display: 'block', padding: '0.6rem 0.875rem', textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: 'var(--vc-gold)', textDecoration: 'none', background: 'rgba(212,175,55,0.05)' }}>
                  Advanced search & filters →
                </Link>
              </div>
            )}
          </div>

          {/* CTA row */}
          <div className="vc-home-hero-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link 
              to="/discover" 
              className="vc-btn vc-btn-primary"
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '50px',
                background: 'linear-gradient(135deg, var(--vc-gold), #c9a227)',
                border: 'none',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(212, 175, 55, 0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 24px rgba(212, 175, 55, 0.3)'; }}
            >
              Discover Films
            </Link>
            <Link 
              to="/trending" 
              className="vc-btn vc-btn-outline"
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '50px',
                background: 'transparent',
                border: '2px solid rgba(255,255,255,0.2)',
                color: 'var(--vc-cream)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            >
              What's Trending
            </Link>
          </div>
        </div>

        {/* Featured card (desktop) */}
        <div className="hidden-mobile">
          <HeroFeatured movie={heroMovie} />
        </div>
      </section>

      {/* ── TRENDING THIS WEEK ─────────────────────────────────── */}
      <div style={{ paddingTop: '4rem' }}>
        <Strip title="Trending This Week" label="🔥 Live" items={trending} linkTo="/trending" size="normal" />
      </div>

      {/* ── NOW PLAYING (editorial grid) ──────────────────────── */}
      <section style={{ paddingBottom: '4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <span className="vc-section-label">🏆 Charts</span>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 2.8vw, 2rem)', fontWeight: 700, margin: 0 }}>Top Rated</h2>
            </div>
            <Link to="/top-movies" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-gold)', textDecoration: 'none', letterSpacing: '0.1em', fontWeight: 600 }}>See all →</Link>
          </div>
          <EditorialGrid items={topRated} />
        </div>
      </section>

      {/* ── POPULAR MOVIES ─────────────────────────────────────── */}
      <div style={{ paddingTop: '4rem' }}>
        <Strip title="Popular Now" label="🎬 Movies" items={popular} linkTo="/popular-movies" size="normal" />
      </div>

      {/* ── AI DISCOVER ────────────────────────────────────────── */}
      <AIDiscoverBlock />

      {/* ── POPULAR TV ─────────────────────────────────────────── */}
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <Strip title="Popular on TV" label="📺 Series" items={popularTV} linkTo="/popular-tv" size="small" />
      </div>

      {/* ── FOOTER CTA ─────────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '5rem 0',
        background: 'linear-gradient(to bottom, var(--vc-bg-base), var(--vc-bg-deep))',
        textAlign: 'center',
      }}>
        <div className="vc-container">
          <span className="vc-section-label" style={{ display: 'block', textAlign: 'center', marginBottom: '0.75rem' }}>Your Film Life</span>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', fontWeight: 800, marginBottom: '1rem' }}>
            Track. Review. Discover.
          </h2>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', fontSize: '0.95rem', marginBottom: '2rem', maxWidth: 400, margin: '0 auto 2rem' }}>
            Join visual.cineaste and build a record of everything you've watched, loved, and want to see.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/watchlist" className="vc-btn vc-btn-primary">Start Watchlist</Link>
            <Link to="/cinematic-picks" className="vc-btn vc-btn-outline">Cinematic Picks</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--vc-bg-deep)', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '2rem 0' }}>
        <div className="vc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 700, color: 'var(--vc-cream)' }}>
            visual<span style={{ color: 'var(--vc-gold)' }}>.</span>cineaste
          </span>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[['Discover', '/discover'], ['Lists', '/lists'], ['People', '/people'], ['Box Office', '/boxoffice'], ['About', '/about']].map(([l, to]) => (
              <Link key={to} to={to} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', color: 'var(--vc-slate)', textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color = 'var(--vc-cream)'}
                onMouseLeave={e => e.target.style.color = 'var(--vc-slate)'}
              >{l}</Link>
            ))}
          </div>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate-dark)' }}>© {new Date().getFullYear()} visual.cineaste</span>
        </div>
      </footer>

      {/* Hide hero featured card on mobile */}
      <style>{`
        @media (max-width: 900px) { .hidden-mobile { display: none !important; } }
        .vc-input:focus { border-color: var(--vc-gold) !important; }
      `}</style>
    </div>
  );
}