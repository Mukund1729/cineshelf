import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import boxofficeFallback from '../boxoffice_fallback.json';
import boxofficeIndia from '../boxoffice_india.json';
import boxofficeDaywise from '../boxoffice_daywise.json';
import BoxOfficeDaywiseChart from '../components/BoxOfficeDaywiseChart';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';

const LANGUAGES = [
  { code: 'all', label: 'All' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'en', label: 'English' },
];
const LANGUAGE_MAP = {
  hi: 'Hindi', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', en: 'English',
};
const FALLBACK_POSTER = null;
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || import.meta.env.VITE_TMDB_KEY;

function parseRevenue(revStr) {
  if (!revStr) return null;
  const digits = String(revStr).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function formatINR(num) {
  if (!num || isNaN(num)) return '₹0';
  if (num >= 1e7) return '₹' + (num / 1e7).toFixed(2) + ' Cr';
  return '₹' + num.toLocaleString('en-IN');
}
function formatUSD(num) {
  if (!num || isNaN(num)) return '$0';
  return '$' + num.toLocaleString('en-US');
}

function getRevenueForMovie(title, year, language) {
  const match = boxofficeFallback.find(
    m => m.title.toLowerCase() === title.toLowerCase() && String(m.year) === String(year) && m.language === language
  );
  return match ? { inr: match.revenue_inr, usd: match.revenue_usd } : null;
}

function getDaywiseDataForMovie(title, year, language) {
  return boxofficeDaywise.find(
    m => m.title.toLowerCase() === title.toLowerCase() && String(m.year) === String(year) && m.language === language
  ) || null;
}

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

export default function BoxOfficeIndia() {
  const [language, setLanguage] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('revenue');
  const [year, setYear] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showDaywise, setShowDaywise] = useState(false);
  const [expandedDaywise, setExpandedDaywise] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/boxoffice/india-live');
        setMeta({ updatedAt: data.updatedAt, sources: data.sources, cached: data.cached });

        let rows = (data.movies || []).map(m => {
          const fb = getRevenueForMovie(m.title, m.year, m.language);
          return {
            title: m.title,
            year: m.year,
            language: m.language || 'hi',
            poster: null,
            revenue_inr: m.revenue_inr || fb?.inr || null,
            revenue_usd: m.revenue_usd || fb?.usd || null,
            source: m.source || 'live',
            sourceUrl: m.sourceUrl,
            tmdbId: null,
            daywiseData: m.daywiseData || null,
          };
        });

        if (TMDB_API_KEY) {
          await Promise.all(
            rows.map(async (row, idx) => {
              try {
                const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(row.title)}&year=${row.year}`;
                const res = await fetch(url);
                const j = await res.json();
                const hit = j.results?.[0];
                if (hit?.poster_path) {
                  rows[idx].poster = apiUrl(`/api/tmdb/image/w500${hit.poster_path}`);
                  rows[idx].tmdbId = hit.id;
                }
              } catch { /* ignore */ }
            })
          );
        }

        setMovies(rows);
      } catch (err) {
        console.error('API error:', err);
        setError('Failed to load box office data. Please make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  let filtered = movies;
  if (language !== 'all') filtered = filtered.filter(m => m.language === language);
  if (year) filtered = filtered.filter(m => String(m.year) === String(year));
  if (search) filtered = filtered.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));

  filtered = filtered.slice().sort((a, b) => {
    if (sort === 'year') return (b.year || 0) - (a.year || 0);
    if (sort === 'title') return a.title.localeCompare(b.title);
    return (b.revenue_inr || 0) - (a.revenue_inr || 0);
  });

  const highest = filtered[0];
  const years = Array.from(new Set(movies.map(m => m.year))).filter(Boolean).sort((a, b) => b - a);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <div className="vc-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        {meta && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>📡</span>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-gold)', margin: 0 }}>
              Live data · Updated {meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : 'recently'}
            </p>
          </div>
        )}
        {usingFallback && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>📊</span>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'orange', margin: 0 }}>
              Using static data · API endpoint not available
            </p>
          </div>
        )}

      {highest && (
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem 2rem',
          borderRadius: 'var(--vc-radius-lg)',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(26,34,54,0.95) 100%)',
          border: '1px solid rgba(212,175,55,0.3)',
          boxShadow: '0 8px 32px rgba(212,175,55,0.1)',
        }}>
          <div style={{ position: 'relative' }}>
            {highest.poster ? (
              <img src={highest.poster} alt={highest.title} style={{ width: 72, height: 108, objectFit: 'cover', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }} />
            ) : (
              <div style={{ width: 72, height: 108, background: 'linear-gradient(135deg, #1a2236 0%, #2a3a5c 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                <span style={{ fontSize: '2rem' }}>🎬</span>
              </div>
            )}
            <div style={{ position: 'absolute', top: -8, right: -8, background: 'var(--vc-gold)', color: '#0a0f1a', padding: '4px 8px', borderRadius: '50%', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(212,175,55,0.4)' }}>👑</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="vc-section-label" style={{ marginBottom: '0.5rem' }}>Top Collection</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{highest.title}</div>
            <div style={{ color: 'var(--vc-slate)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{highest.year} · {LANGUAGE_MAP[highest.language] || highest.language}</div>
            <div style={{ color: 'var(--vc-gold)', fontWeight: 800, fontSize: '1.25rem' }}>
              {currency === 'INR' ? formatINR(highest.revenue_inr) : formatUSD(highest.revenue_usd)}
            </div>
          </div>
          <button type="button" className="vc-btn vc-btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}>
            {currency === 'INR' ? 'Show USD' : 'Show INR'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
        {LANGUAGES.map(l => (
          <button key={l.code} type="button" style={pill(language === l.code)} onClick={() => setLanguage(l.code)}>{l.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input className="vc-input" style={{ width: 220 }} placeholder="Search movies…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="vc-input" style={{ width: 160 }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="revenue">Sort by revenue</option>
          <option value="year">Sort by year</option>
          <option value="title">Sort by title</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: 4 }}>
        {years.map(y => (
          <button key={y} type="button" style={pill(String(year) === String(y))} onClick={() => setYear(String(y) === String(year) ? '' : String(y))}>{y}</button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 'var(--vc-radius-lg)', border: '1px solid rgba(255,255,255,0.06)', background: 'var(--vc-bg-card)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--vc-slate)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
            <p style={{ fontFamily: 'Outfit, sans-serif' }}>Loading live box office data…</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--vc-bg-elevated)', color: 'var(--vc-gold)' }}>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Poster</th>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</th>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lang</th>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Revenue</th>
                <th style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--vc-slate)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎬</div>
                  <p style={{ fontFamily: 'Outfit, sans-serif' }}>No movies found matching your filters.</p>
                </td></tr>
              )}
              {filtered.map((m, i) => {
                const daywiseData = m.daywiseData || getDaywiseDataForMovie(m.title, m.year, m.language);
                const isExpanded = expandedDaywise === `${m.title}-${m.year}`;
                return (
                  <React.Fragment key={`${m.title}-${m.year}-${i}`}>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 200ms' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--vc-slate)', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: '0.85rem', textAlign: 'center' }}>
                        {m.poster ? (
                          <img src={m.poster} alt="" style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <div style={{ width: 44, height: 66, background: 'linear-gradient(135deg, #1a2236 0%, #2a3a5c 100%)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '1rem' }}>🎬</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem', fontWeight: 600 }}>
                        {m.tmdbId ? <Link to={`/movie/${m.tmdbId}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none', transition: 'color 200ms' }} onMouseEnter={e => e.target.style.color = 'var(--vc-gold)'} onMouseLeave={e => e.target.style.color = 'var(--vc-cream)'}>{m.title}</Link> : m.title}
                        {daywiseData && (
                          <button
                            type="button"
                            onClick={() => setExpandedDaywise(isExpanded ? null : `${m.title}-${m.year}`)}
                            style={{ marginLeft: 8, fontSize: '0.65rem', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--vc-gold)', background: isExpanded ? 'rgba(212,175,55,0.25)' : 'transparent', color: 'var(--vc-gold)', cursor: 'pointer', transition: 'all 200ms' }}
                          >
                            {isExpanded ? 'Hide' : 'Daywise'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--vc-slate)' }}>{m.year}</td>
                      <td style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--vc-slate)' }}>{LANGUAGE_MAP[m.language] || m.language}</td>
                      <td style={{ padding: '0.85rem', textAlign: 'right', color: 'var(--vc-gold)', fontWeight: 700 }}>
                        {currency === 'INR' ? formatINR(m.revenue_inr) : formatUSD(m.revenue_usd)}
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.7rem', color: 'var(--vc-slate)' }}>{m.source}</td>
                    </tr>
                    {daywiseData && isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <BoxOfficeDaywiseChart movieData={daywiseData} currency={currency} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showDaywise && selectedMovie && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowDaywise(false)}>
          <div style={{ background: 'var(--vc-bg-card)', borderRadius: 16, maxWidth: 900, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', margin: 0 }}>Daywise · {selectedMovie.title}</h2>
              <button type="button" onClick={() => setShowDaywise(false)} style={{ background: 'none', border: 'none', color: 'var(--vc-slate)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <BoxOfficeDaywiseChart movieData={selectedMovie.daywiseData} currency={currency} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
