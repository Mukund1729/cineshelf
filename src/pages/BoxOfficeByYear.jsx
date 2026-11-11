import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import fallbackData from '../boxoffice_fallback.json';
import Navbar from '../components/Navbar';

const START_YEAR = 1980;
const END_YEAR = new Date().getFullYear();
const LANGUAGES = [
  { code: '', label: '🌍 Global' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ta', label: '🇮🇳 Tamil' },
  { code: 'te', label: '🇮🇳 Telugu' },
  { code: 'ml', label: '🇮🇳 Malayalam' },
  { code: 'kn', label: '🇮🇳 Kannada' },
];
const SORTS = [
  { value: 'revenue.desc', label: 'Revenue' },
  { value: 'popularity.desc', label: 'Popularity' },
  { value: 'vote_average.desc', label: 'Rating' },
];

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function BoxOfficeByYear() {
  const [year, setYear] = useState(END_YEAR);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('revenue.desc');

  useEffect(() => {
    async function fetchMovies() {
      setLoading(true);
      setError(null);
      setMovies([]);
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        let url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=${sort}&primary_release_year=${year}&page=1`;
        if (region) url += `&with_original_language=${region}`;
        if (search) url += `&query=${encodeURIComponent(search)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch movies');
        const data = await res.json();
        let movies = data.results || [];
        // Fallback for Indian languages if revenue is missing
        if (region && ['hi','ta','te','ml','kn'].includes(region)) {
          movies = movies.map(m => {
            if (!m.revenue || m.revenue === 0) {
              const fallback = fallbackData.find(f => f.title.toLowerCase() === m.title.toLowerCase() && f.year === year && f.language === region);
              if (fallback) {
                return { ...m, revenue: fallback.revenue_usd };
              }
            }
            return m;
          });
        }
        setMovies(movies);
      } catch (err) {
        setError('Could not load box office data.');
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, [year, region, sort, search]);

  const pill = (active) => ({
    padding: '0.35rem 0.85rem',
    borderRadius: 'var(--vc-radius-pill)',
    fontFamily: 'Outfit, sans-serif',
    fontSize: '0.78rem',
    fontWeight: 600,
    border: active ? '1px solid var(--vc-gold)' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(212,175,55,0.15)' : 'var(--vc-bg-elevated)',
    color: active ? 'var(--vc-gold-light)' : 'var(--vc-slate)',
    cursor: 'pointer',
  });

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
          <span className="vc-section-label">📅 By Year</span>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
          }}>
            Box Office by Year
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: 560, marginBottom: '1.5rem' }}>
            Explore box office collections by year with regional filters and sorting options.
          </p>
        </div>
      </section>

      <div className="vc-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
          {LANGUAGES.map(l => (
            <button key={l.code} type="button" style={pill(region === l.code)} onClick={() => setRegion(l.code)}>{l.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <input className="vc-input" style={{ width: 220 }} placeholder="Search movies…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="vc-input" style={{ width: 160 }} value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: 4 }}>
          {range(START_YEAR, END_YEAR).map(y => (
            <button key={y} type="button" style={pill(String(year) === String(y))} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--vc-slate)' }}>Loading…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--vc-red)' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 'var(--vc-radius-lg)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--vc-bg-elevated)', color: 'var(--vc-gold)' }}>
                  <th style={{ padding: '0.65rem' }}>#</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Title</th>
                  <th style={{ padding: '0.65rem' }}>Year</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Box Office</th>
                </tr>
              </thead>
              <tbody>
                {movies.map((movie, idx) => (
                  <tr key={movie.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '0.65rem' }}>
                      <Link to={`/movie/${movie.id}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {movie.poster_path && (
                          <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt="" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                        )}
                        <span style={{ fontWeight: 600 }}>{movie.title}</span>
                      </Link>
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>{movie.release_date ? movie.release_date.slice(0, 4) : 'N/A'}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', color: 'var(--vc-gold)', fontWeight: 700 }}>
                      {typeof movie.revenue === 'number' && movie.revenue > 0 ? `$${movie.revenue.toLocaleString()}` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
