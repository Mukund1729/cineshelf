import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { tmdbImageUrl } from '../api/tmdb';

const START_YEAR = 1980;
const END_YEAR = new Date().getFullYear();
const LANGUAGES = [
  { code: 'all', label: 'All languages' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'en', label: 'English' },
];

function formatAmount(amount, currency) {
  if (!Number.isFinite(Number(amount))) return 'Unavailable';
  const value = Number(amount);
  if (currency === 'INR') {
    return value >= 10_000_000
      ? `₹${(value / 10_000_000).toFixed(2)} Cr`
      : `₹${value.toLocaleString('en-IN')}`;
  }
  if (currency === 'USD') return `$${value.toLocaleString('en-US')}`;
  return `${currency || ''} ${value.toLocaleString()}`.trim();
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function BoxOfficeByYear() {
  const [year, setYear] = useState(END_YEAR);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('all');
  const [sort, setSort] = useState('amount');
  const [coverage, setCoverage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axios.get('/api/boxoffice/yearly', { params: { year } })
      .then(({ data }) => {
        if (!active) return;
        setReports(data.reports || []);
        setCoverage(data.coverage || '');
      })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'Could not load reported box office data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [year]);

  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports
      .filter(report => language === 'all' || report.originalLanguage === language)
      .filter(report => !query || report.movieTitle.toLowerCase().includes(query))
      .slice()
      .sort((left, right) => sort === 'title'
        ? left.movieTitle.localeCompare(right.movieTitle)
        : right.amount - left.amount);
  }, [reports, language, search, sort]);

  const pill = active => ({
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
    <section style={{ paddingTop: '0.5rem', paddingBottom: '2rem' }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--vc-gold-light)' }}>
        Lifetime reports by release year
      </h2>
      <p style={{ color: 'var(--vc-slate)', maxWidth: 700, fontSize: '0.85rem' }}>
        This is a partial, source-attributed set of lifetime collection reports, not a complete annual box-office total. Estimates remain separate by collection type, currency, and provider.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0', justifyContent: 'center' }}>
        {LANGUAGES.map(item => (
          <button key={item.code} type="button" style={pill(language === item.code)} onClick={() => setLanguage(item.code)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="vc-mobile-form-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input className="vc-input" style={{ width: 220 }} placeholder="Search movies…" value={search} onChange={event => setSearch(event.target.value)} />
        <select className="vc-input" style={{ width: 180 }} value={sort} onChange={event => setSort(event.target.value)}>
          <option value="amount">Sort by reported amount</option>
          <option value="title">Sort by title</option>
        </select>
      </div>

      <div className="vc-mobile-wrap" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: 4 }}>
        {range(START_YEAR, END_YEAR).map(value => (
          <button key={value} type="button" style={pill(year === value)} onClick={() => setYear(value)}>{value}</button>
        ))}
      </div>

      {coverage && <p style={{ color: 'var(--vc-slate)', fontSize: '0.8rem' }}>{coverage}</p>}
      {error && <p role="alert" style={{ color: '#fc8181' }}>{error}</p>}

      <div className="vc-mobile-table-wrap" style={{ overflowX: 'auto', borderRadius: 'var(--vc-radius-lg)', border: '1px solid rgba(255,255,255,0.06)', background: 'var(--vc-bg-card)' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--vc-slate)' }}>Loading reports…</p>
        ) : (
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'var(--vc-bg-elevated)', color: 'var(--vc-gold)' }}>
                <th style={{ padding: '0.7rem' }}>#</th>
                <th style={{ padding: '0.7rem', textAlign: 'left' }}>Movie</th>
                <th style={{ padding: '0.7rem' }}>Collection type</th>
                <th style={{ padding: '0.7rem' }}>Language</th>
                <th style={{ padding: '0.7rem', textAlign: 'right' }}>Reported amount</th>
                <th style={{ padding: '0.7rem' }}>Source / status</th>
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((report, index) => (
                <tr key={report.reportKey || report._id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.7rem', color: 'var(--vc-slate)' }}>{index + 1}</td>
                  <td style={{ padding: '0.7rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      {report.posterPath && <img src={tmdbImageUrl(report.posterPath, 'w92')} alt="" loading="lazy" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4 }} />}
                      {report.tmdbId
                        ? <Link to={`/movie/${report.tmdbId}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none' }}>{report.movieTitle}</Link>
                        : <span>{report.movieTitle}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '0.7rem', color: 'var(--vc-slate)' }}>{report.collectionType.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '0.7rem', textAlign: 'center', color: 'var(--vc-slate)' }}>{report.originalLanguage || 'Not reported'}</td>
                  <td style={{ padding: '0.7rem', textAlign: 'right', color: 'var(--vc-gold-light)', fontWeight: 700 }}>{formatAmount(report.amount, report.currency)}</td>
                  <td style={{ padding: '0.7rem' }}>
                    <a href={report.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--vc-slate)' }}>{report.source}</a>
                    <small style={{ display: 'block', marginTop: 3, color: report.isEstimate ? '#e5b946' : 'var(--vc-slate)' }}>
                      {report.isEstimate ? 'Publisher estimate' : report.verificationStatus}
                    </small>
                  </td>
                </tr>
              ))}
              {!visibleReports.length && !error && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--vc-slate)' }}>
                  No source-reported lifetime collections are available for this release year.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
