import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BrandLogo from '../components/BrandLogo';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';
import './HomePage.css';

const HeroCanvas = lazy(() => import('../components/HeroCanvas'));

const IMG = (path, size = 'w500') => (path ? tmdbImageUrl(path, size) : null);

const PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0NTAiIGZpbGw9IiMxYTIyMzYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzY0NzQ4YiIgZm9udC1mYW1pbHk9InNlcmlmIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

const VIBE_MOODS = [
  'Romantic',
  'Melancholic',
  'Nostalgic',
  'Mind-bending',
  'Slow-burn',
  'Dreamlike',
  'Existential',
  'Visually stunning',
  'Psychological',
  'Feel-Good',
];

function mediaPath(path, size = 'w500') {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  // Local app assets only — TMDB paths also start with "/" (e.g. /abc.jpg)
  if (
    path.startsWith('/original-films/')
    || path.startsWith('/uploads/')
    || path.startsWith('/api/')
  ) {
    return path;
  }
  return IMG(path, size);
}

function directorFromCredits(movie) {
  const crew = movie?.credits?.crew || [];
  const directors = crew.filter(c => /director/i.test(c.job || '')).map(c => c.name || c.person?.name).filter(Boolean);
  return directors[0] || null;
}

// ─── Poster Card ─────────────────────────────────────────────────────────────
function PosterCard({ movie, size = 'normal', showCaption = false }) {
  const isMovie = !movie.first_air_date;
  const title = movie.title || movie.name || 'Untitled';
  const year = (movie.release_date || movie.first_air_date || movie.releaseYear || '').toString().slice(0, 4);
  const img = mediaPath(movie.poster_path) || PLACEHOLDER;
  const rating = movie.vote_average?.toFixed?.(1);
  const to = movie.source === 'original' && movie.slug
    ? `/movie/${movie.slug}`
    : isMovie
      ? `/movie/${movie.id}`
      : `/tv/${movie.id}`;

  return (
    <Link to={to} className={`vc-home-poster vc-home-poster--${size}`}>
      <div className="vc-home-poster-frame">
        <img
          src={img}
          alt={title}
          loading="lazy"
          onError={e => { e.target.src = PLACEHOLDER; }}
        />
        {rating > 0 && <div className="vc-home-poster-rating">★ {rating}</div>}
        <div className="vc-home-poster-overlay">
          <div className="vc-home-poster-title">{title}</div>
          <div className="vc-home-poster-year">
            {year}{!isMovie ? ' · TV' : ''}
          </div>
        </div>
      </div>
      {showCaption && (
        <div className="vc-home-poster-caption">
          <div className="vc-home-poster-title">{title}</div>
          <div className="vc-home-poster-year">{year}</div>
        </div>
      )}
    </Link>
  );
}

// ─── Horizontal Strip ─────────────────────────────────────────────────────────
function Strip({ title, label, items = [], linkTo, size = 'normal', showCaption = false }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });
  };

  return (
    <section className="vc-home-strip vc-home-section">
      <div className="vc-container">
        <div className="vc-home-section-head vc-strip-heading">
          <div>
            {label && <span className="vc-section-label">{label}</span>}
            <h2>{title}</h2>
          </div>
          <div className="vc-home-strip-controls">
            {linkTo && <Link to={linkTo} className="vc-home-see-all">View all →</Link>}
            <button type="button" className="vc-home-strip-btn vc-strip-scroll-button" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
            <button type="button" className="vc-home-strip-btn vc-strip-scroll-button" onClick={() => scroll(1)} aria-label="Scroll right">›</button>
          </div>
        </div>
      </div>
      <div className="vc-container" style={{ overflow: 'hidden' }}>
        <div ref={scrollRef} className="vc-mobile-grid vc-home-poster-row">
          {items.length === 0
            ? Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="vc-skeleton"
                  style={{
                    width: size === 'large' ? 196 : size === 'small' ? 132 : 168,
                    aspectRatio: '2/3',
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                />
              ))
            : items.map(m => (
                <PosterCard key={`${m.source || 'tmdb'}-${m.id}`} movie={m} size={size} showCaption={showCaption} />
              ))}
        </div>
      </div>
    </section>
  );
}

// ─── Top Rated Grid ───────────────────────────────────────────────────────────
function EditorialGrid({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="vc-home-top-grid vc-film-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="vc-skeleton" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="vc-home-top-grid vc-film-grid">
      {items.slice(0, 12).map((m, idx) => {
        const title = m.title || m.name || 'Untitled';
        const year = (m.release_date || '').slice(0, 4);
        const img = IMG(m.poster_path, 'w342') || PLACEHOLDER;
        const rating = m.vote_average?.toFixed(1);
        return (
          <Link key={m.id} to={`/movie/${m.id}`} className="vc-home-top-card vc-poster-card">
            <img src={img} alt={title} loading="lazy" onError={e => { e.target.src = PLACEHOLDER; }} />
            <div className="vc-home-top-rank">{idx + 1}</div>
            {rating > 0 && <div className="vc-home-poster-rating">★ {rating}</div>}
            <div className="vc-home-top-overlay vc-overlay">
              <div className="title">{title}</div>
              <div className="meta">{year}{rating > 0 ? ` · ★ ${rating}` : ''}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Original Short Films ─────────────────────────────────────────────────────
function OriginalShortFilms({ films = [] }) {
  const [enriched, setEnriched] = useState([]);

  useEffect(() => {
    if (!films.length) {
      setEnriched([]);
      return undefined;
    }
    let active = true;
    (async () => {
      const detailed = await Promise.all(
        films.map(async film => {
          const slug = film.slug || film.id;
          if (!slug) return film;
          try {
            const res = await axios.get(`/api/original-films/${encodeURIComponent(slug)}`);
            return { ...film, ...(res.data?.data || res.data || {}) };
          } catch {
            return film;
          }
        })
      );
      if (active) setEnriched(detailed);
    })();
    return () => { active = false; };
  }, [films]);

  const list = enriched.length ? enriched : films;
  if (!list.length) return null;

  const [featured, ...rest] = list;
  const featuredDirector = directorFromCredits(featured);
  const featuredPoster = mediaPath(featured.poster_path) || PLACEHOLDER;
  const featuredYear = featured.releaseYear || (featured.release_date || '').toString().slice(0, 4);
  const featuredOverview = (featured.overview || featured.tagline || '').slice(0, 220);

  return (
    <section className="vc-home-section">
      <div className="vc-container">
        <div className="vc-home-section-head">
          <div>
            <span className="vc-section-label">Visual Cineaste · Originals</span>
            <h2>Original Short Films</h2>
          </div>
        </div>

        <div className={`vc-home-originals-grid${rest.length ? '' : ' is-single'}`}>
          <div className="vc-home-original-feature">
            <Link to={`/movie/${featured.slug || featured.id}`} className="vc-home-original-feature-poster">
              <img src={featuredPoster} alt={featured.title} loading="lazy" onError={e => { e.target.src = PLACEHOLDER; }} />
            </Link>
            <div className="vc-home-original-feature-body">
              <h3>{featured.title}</h3>
              <div className="vc-home-original-meta">
                {[featuredYear, featuredDirector && `Dir. ${featuredDirector}`, featured.runtimeLabel]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {featuredOverview && <p className="vc-home-original-desc">{featuredOverview}</p>}
              <div className="vc-home-original-actions">
                {featured.watchUrl && (
                  <a
                    href={featured.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vc-btn vc-btn-primary"
                  >
                    Watch Film
                  </a>
                )}
                <Link to={`/movie/${featured.slug || featured.id}`} className="vc-btn vc-btn-outline">
                  Film details
                </Link>
              </div>
            </div>
          </div>

          {rest.length > 0 && (
            <div className="vc-home-original-list">
              {rest.slice(0, 4).map(film => {
                const director = directorFromCredits(film);
                const year = film.releaseYear || (film.release_date || '').toString().slice(0, 4);
                const poster = mediaPath(film.poster_path) || PLACEHOLDER;
                return (
                  <div key={film.id || film.slug} className="vc-home-original-item">
                    <Link to={`/movie/${film.slug || film.id}`}>
                      <img src={poster} alt={film.title} loading="lazy" onError={e => { e.target.src = PLACEHOLDER; }} />
                    </Link>
                    <div>
                      <h4>
                        <Link to={`/movie/${film.slug || film.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {film.title}
                        </Link>
                      </h4>
                      <div className="vc-home-original-meta" style={{ marginBottom: 0 }}>
                        {[year, director && `Dir. ${director}`].filter(Boolean).join(' · ')}
                      </div>
                      {(film.overview || film.tagline) && (
                        <p>{(film.overview || film.tagline || '').slice(0, 120)}</p>
                      )}
                      <div className="vc-home-original-actions">
                        {film.watchUrl && (
                          <a href={film.watchUrl} target="_blank" rel="noopener noreferrer" className="vc-btn vc-btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem' }}>
                            Watch Film
                          </a>
                        )}
                        <Link to={`/movie/${film.slug || film.id}`} className="vc-btn vc-btn-outline" style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem' }}>
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── AI Discover Block ───────────────────────────────────────────────────────
function AIDiscoverBlock() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');

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

      let parsedResults = [];
      try {
        const objectMatch = raw.match(/\{[\s\S]*"movies"[\s\S]*\}/);
        const arrayMatch = raw.match(/\[[\s\S]*\]/);
        if (objectMatch) {
          const obj = JSON.parse(objectMatch[0]);
          parsedResults = Array.isArray(obj.movies) ? obj.movies : [];
        } else if (arrayMatch) {
          const parsed = JSON.parse(arrayMatch[0]);
          parsedResults = Array.isArray(parsed) ? parsed : [];
        }
      } catch {
        parsedResults = [];
      }

      if (parsedResults.length) {
        setResults(parsedResults.map(item => ({
          title: item.title || '',
          year: item.year || '',
          director: item.director || '',
          description: item.description || item.reason || '',
          moodTags: item.moodTags || [],
          visualTags: item.visualTags || [],
          language: item.language || '',
        })));
      } else {
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
    <section className="vc-home-section vc-home-vibe">
      <div className="vc-container">
        <span className="vc-section-label">AI · Cinema Intelligence</span>
        <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, margin: '0 0 0.5rem' }}>
          Discover by Vibe
        </h2>
        <p style={{ fontFamily: 'var(--vc-font-body)', color: 'var(--vc-slate)', fontSize: '0.9rem', marginBottom: '1.35rem', maxWidth: 540 }}>
          Describe a feeling, director, craft, or reference film — or pick a mood and continue on Discover.
        </p>

        <div className="vc-home-mood-chips" role="list" aria-label="Mood shortcuts">
          {VIBE_MOODS.map(mood => (
            <Link
              key={mood}
              to="/discover"
              state={{ mood }}
              className="vc-home-mood-chip"
              role="listitem"
            >
              {mood}
            </Link>
          ))}
        </div>

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

        {!results.length && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                className="vc-home-example-chip"
                onClick={() => { setInput(ex); handleSearch(ex); }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p style={{ color: '#fc8181', fontFamily: 'var(--vc-font-body)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="vc-skeleton" style={{ height: 120, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {results.length > 0 && (
          <>
            {source && (
              <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.7rem', color: 'var(--vc-slate)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
        borderRadius: 8,
        padding: '1.25rem',
        transition: 'all 180ms',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--vc-cream)', lineHeight: 1.3 }}>
            {film.title}
          </div>
          {film.year && film.director && (
            <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.72rem', color: 'var(--vc-slate)', marginTop: 2 }}>
              {film.year} · {film.director}
            </div>
          )}
        </div>
        {film.language && (
          <span className="vc-badge vc-badge-slate" style={{ flexShrink: 0, marginLeft: '0.5rem' }}>{film.language}</span>
        )}
      </div>
      {film.description && (
        <p style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.82rem', color: 'var(--vc-slate)', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
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

// ─── Journal teaser (additive) ────────────────────────────────────────────────
function JournalTeaser() {
  const [articles, setArticles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get('/api/journal', { params: { page: 1, limit: 3, sort: 'newest' } })
      .then(res => {
        if (!active) return;
        setArticles(res.data?.data || []);
      })
      .catch(() => {
        if (active) setArticles([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  if (loaded && articles.length === 0) return null;

  return (
    <section className="vc-home-section">
      <div className="vc-container">
        <div className="vc-home-section-head">
          <div>
            <span className="vc-section-label">From the World of Cinema</span>
            <h2>Journal</h2>
          </div>
          <Link to="/journal" className="vc-home-see-all">Read the Journal →</Link>
        </div>

        {!loaded ? (
          <div className="vc-home-journal-grid">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="vc-skeleton" style={{ height: 280, borderRadius: 12 }} />
            ))}
          </div>
        ) : (
          <div className="vc-home-journal-grid">
            {articles.map(article => (
              <Link key={article._id || article.slug} to={`/journal/${article.slug}`} className="vc-home-journal-card">
                {article.coverImage || article.image ? (
                  <img src={article.coverImage || article.image} alt="" loading="lazy" />
                ) : (
                  <div style={{ height: 160, background: 'linear-gradient(135deg, #17191e, #22262f)' }} />
                )}
                <div className="vc-home-journal-card-body">
                  <h3>{article.title}</h3>
                  <p>{article.excerpt || article.summary || article.subtitle || 'An essay from the Visual Cineaste Journal.'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Hero Featured Card ───────────────────────────────────────────────────────
function HeroFeatured({ movie }) {
  if (!movie) return null;
  const title = movie.title || 'Trending Now';
  const overview = movie.overview?.slice(0, 155);
  const backdrop = movie.backdrop_path ? tmdbImageUrl(movie.backdrop_path, 'w1280') : null;
  const rating = movie.vote_average?.toFixed(1);
  const year = movie.release_date?.slice(0, 4);

  return (
    <Link to={`/movie/${movie.id}`} className="vc-hero-featured">
      <div className="vc-hero-featured-card">
        {backdrop && <img src={backdrop} alt={title} />}
        <div className="vc-hero-featured-body">
          <div className="vc-hero-featured-title">{title}</div>
          <div className="vc-hero-featured-meta">
            {year && <span className="year">{year}</span>}
            {rating > 0 && <span className="rating">★ {rating}</span>}
          </div>
          {overview && <p className="vc-hero-featured-overview">{overview}…</p>}
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [popularTV, setPopularTV] = useState([]);
  const [originalFilms, setOriginalFilms] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchRes, setSearchRes] = useState([]);
  const [heroMovie, setHeroMovie] = useState(null);
  const debounce = useRef(null);

  useEffect(() => {
    axios.get('/api/original-films')
      .then(response => setOriginalFilms(response.data?.results || []))
      .catch(error => console.error('[HomePage] Original film catalog failed:', error.message));

    const fetchAll = async () => {
      try {
        const [tRes, pRes, trRes, tvRes] = await Promise.all([
          tmdbGet('/trending/movie/week'),
          tmdbGet('/movie/popular'),
          tmdbGet('/movie/top_rated'),
          tmdbGet('/tv/popular'),
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

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!searchQ.trim()) { setSearchRes([]); setSearching(false); return; }
    setSearching(true);
    let active = true;
    debounce.current = setTimeout(async () => {
      const [tmdbResult, originalResult] = await Promise.allSettled([
        tmdbGet('/search/multi', { query: searchQ, page: 1 }),
        axios.get('/api/original-films/search', { params: { query: searchQ } }),
      ]);
      if (!active) return;
      const tmdbItems = tmdbResult.status === 'fulfilled' ? tmdbResult.value.results || [] : [];
      const originals = originalResult.status === 'fulfilled' ? originalResult.value.data : {};
      if (!tmdbItems.length && !originals.results?.length && !originals.people?.length) {
        setSearchRes([]);
        return;
      }
      setSearchRes([
        ...(originals.results || []).map(result => ({ ...result, media_type: 'movie' })),
        ...(originals.people || []),
        ...tmdbItems,
      ]);
    }, 350);
    return () => {
      active = false;
      clearTimeout(debounce.current);
    };
  }, [searchQ]);

  return (
    <div className="vc-home" style={{ minHeight: '100vh' }}>
      <Navbar />

      <section className="vc-home-hero">
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>

        {heroMovie?.backdrop_path && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
            <img
              src={tmdbImageUrl(heroMovie.backdrop_path, 'original')}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.12, filter: 'saturate(0.8) contrast(1.08)' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(13,13,15,0.97) 28%, rgba(13,13,15,0.55) 55%, rgba(13,13,15,0.22) 78%, rgba(13,13,15,0.45) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,13,15,0.25) 0%, transparent 38%, rgba(13,13,15,0.88) 100%)' }} />
          </div>
        )}

        <div className="vc-container vc-home-hero-content">
          <div className="vc-home-hero-brand">
            <div className="vc-home-hero-brand-rule" />
            <BrandLogo style={{ width: 180, opacity: 0.9 }} />
          </div>

          <h1 className="vc-home-hero-title">
            Cinema,
            <br />
            <em>rediscovered.</em>
          </h1>

          <p className="vc-home-hero-description">
            Discover films by director, vision, and aesthetic —<br />not just genre. Track, review, and share your cinematic journey.
          </p>

          <div className="vc-home-search">
            <div className="vc-home-search-field">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="vc-input"
                placeholder="Search movies, shows, people…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                aria-label="Search movies, shows, people"
              />
              {searchQ && (
                <button
                  type="button"
                  className="vc-home-search-clear"
                  onClick={() => { setSearchQ(''); setSearchRes([]); setSearching(false); }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {searching && searchRes.length > 0 && (
              <div className="vc-home-search-dropdown">
                {searchRes.slice(0, 10).map(r => {
                  const isTV = r.media_type === 'tv';
                  const isPerson = r.media_type === 'person';
                  const title = r.title || r.name || '';
                  const year = (r.release_date || r.first_air_date || r.releaseYear || '').toString().slice(0, 4);
                  const poster = r.poster_path || r.profile_path
                    ? (String(r.poster_path || r.profile_path).startsWith('/') && !String(r.poster_path || r.profile_path).startsWith('/original')
                      ? IMG(r.poster_path || r.profile_path, 'w92')
                      : mediaPath(r.poster_path || r.profile_path))
                    : null;
                  const to = isPerson
                    ? `/person/${r.id || r.slug}`
                    : r.source === 'original' && r.slug
                      ? `/movie/${r.slug}`
                      : isTV
                        ? `/tv/${r.id}`
                        : `/movie/${r.id}`;
                  return (
                    <Link
                      key={`${r.media_type || 'movie'}-${r.id || r.slug}`}
                      to={to}
                      className="vc-home-search-item"
                      onClick={() => { setSearchQ(''); setSearchRes([]); }}
                    >
                      {poster
                        ? <img src={poster} alt="" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 48, background: 'var(--vc-bg-card)', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🎬</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.875rem', color: 'var(--vc-cream)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                        <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.7rem', color: 'var(--vc-slate)' }}>
                          {year || (isPerson ? 'Person' : '')}{isPerson ? ' · Person' : isTV ? ' · TV' : ' · Film'}
                        </div>
                      </div>
                      {r.vote_average > 0 && (
                        <span style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.72rem', color: 'var(--vc-gold)', fontWeight: 700, flexShrink: 0 }}>
                          ★ {r.vote_average.toFixed(1)}
                        </span>
                      )}
                    </Link>
                  );
                })}
                <Link
                  to="/discover"
                  onClick={() => { setSearchQ(''); setSearchRes([]); }}
                  style={{ display: 'block', padding: '0.6rem 0.875rem', textAlign: 'center', fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem', color: 'var(--vc-gold)', textDecoration: 'none', background: 'rgba(212,175,55,0.05)' }}
                >
                  Advanced search & filters →
                </Link>
              </div>
            )}
          </div>

          <div className="vc-home-hero-actions">
            <Link to="/discover" className="vc-home-cta-primary">Discover Films</Link>
            <Link to="/trending" className="vc-home-cta-secondary">What&apos;s Trending</Link>
          </div>
        </div>

        <div className="hidden-mobile">
          <HeroFeatured movie={heroMovie} />
        </div>
      </section>

      <Strip title="Trending This Week" label="Live" items={trending} linkTo="/trending" size="large" showCaption />

      <OriginalShortFilms films={originalFilms} />

      <section className="vc-home-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container">
          <div className="vc-home-section-head">
            <div>
              <span className="vc-section-label">Charts</span>
              <h2>Top Rated</h2>
            </div>
            <Link to="/top-movies" className="vc-home-see-all">View all →</Link>
          </div>
          <EditorialGrid items={topRated} />
        </div>
      </section>

      <Strip title="Popular Now" label="Movies" items={popular} linkTo="/popular-movies" size="large" showCaption />

      <AIDiscoverBlock />

      <Strip title="Popular on TV" label="Series" items={popularTV} linkTo="/popular-tv" size="normal" showCaption />

      <JournalTeaser />

      <section className="vc-home-footer-cta">
        <div className="vc-container">
          <span className="vc-section-label" style={{ display: 'block', textAlign: 'center', marginBottom: '0.75rem' }}>Your Film Life</span>
          <h2>Track. Review. Discover.</h2>
          <p>Join visual.cineaste and build a record of everything you&apos;ve watched, loved, and want to see.</p>
          <div className="vc-home-footer-cta-actions">
            <Link to="/watchlist" className="vc-btn vc-btn-primary">Start Watchlist</Link>
            <Link to="/cinematic-picks" className="vc-btn vc-btn-outline">Cinematic Picks</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
