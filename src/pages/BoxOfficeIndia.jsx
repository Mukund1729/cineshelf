import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tmdbImageUrl } from '../api/tmdb';

const LANGUAGES = [
  { code: 'all', label: 'All languages' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'en', label: 'English' },
];

const LANGUAGE_NAMES = Object.fromEntries(LANGUAGES.map(item => [item.code, item.label]));

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

function formatDate(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function reportAmount(row, market, period) {
  if (market === 'worldwide') return row.amount;
  return period === 'daily' ? row.dailyCollection : row.totalReported;
}

function reportLabel(row, market, period) {
  if (market === 'worldwide') return 'Lifetime worldwide gross';
  if (market === 'us') return 'US domestic daily gross';
  return period === 'daily' ? 'India nett (reported day)' : 'India nett (reported days only)';
}

function HistoryPanel({ history, movieTitle }) {
  const indiaRows = history.indiaDaily || [];
  const weekends = history.unitedStates?.weekends || [];
  const chartRows = indiaRows.length
    ? indiaRows.map(row => ({
      date: row.date,
      daily: row.dailyCollection,
      cumulative: row.cumulativeCollection,
    }))
    : weekends.map(row => ({
      date: row.date,
      daily: row.gross,
      cumulative: row.cumulativeGross,
    }));
  const currency = indiaRows.length ? 'INR' : history.unitedStates?.currency || 'USD';

  if (!chartRows.length) {
    return <p style={{ color: 'var(--vc-slate)' }}>No day-wise or weekend history is available from the connected sources.</p>;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ color: 'var(--vc-slate)', fontSize: '0.8rem' }}>
        Source-reported history for {movieTitle}. Missing dates are not filled; US values are weekend totals.
      </p>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={chartRows} margin={{ top: 10, right: 12, bottom: 4, left: 12 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#9aa5b7" tick={{ fontSize: 11 }} />
            <YAxis
              stroke="#9aa5b7"
              tick={{ fontSize: 11 }}
              tickFormatter={value => currency === 'INR' ? `₹${(value / 10_000_000).toFixed(0)}Cr` : `$${(value / 1_000_000).toFixed(0)}M`}
            />
            <Tooltip formatter={value => formatAmount(value, currency)} />
            <Legend />
            <Line type="monotone" dataKey="daily" name={indiaRows.length ? 'Daily India nett' : 'US weekend gross'} stroke="#d4af37" dot={false} />
            <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#5bc0be" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="vc-mobile-table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ color: 'var(--vc-gold)', textAlign: 'left' }}>
              <th style={{ padding: '0.65rem' }}>Reported date</th>
              <th style={{ padding: '0.65rem', textAlign: 'right' }}>Daily / weekend</th>
              <th style={{ padding: '0.65rem', textAlign: 'right' }}>Cumulative</th>
              <th style={{ padding: '0.65rem' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {(indiaRows.length ? indiaRows : weekends).map((row, index) => (
              <tr key={`${row.date}-${index}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '0.65rem' }}>{formatDate(row.date)}</td>
                <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                  {formatAmount(indiaRows.length ? row.dailyCollection : row.gross, currency)}
                </td>
                <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                  {formatAmount(indiaRows.length ? row.cumulativeCollection : row.cumulativeGross, currency)}
                </td>
                <td style={{ padding: '0.65rem' }}>{row.source || history.unitedStates?.source || 'Source report'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <article style={{
      minWidth: 180,
      flex: '1 1 180px',
      padding: '1rem 1.15rem',
      borderRadius: 'var(--vc-radius-lg)',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'var(--vc-bg-card)',
    }}>
      <div style={{ color: 'var(--vc-slate)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: '0.45rem', color: 'var(--vc-gold-light)', fontWeight: 700, fontSize: '1.15rem' }}>{value}</div>
      {detail && <div style={{ marginTop: '0.3rem', color: 'var(--vc-slate)', fontSize: '0.72rem' }}>{detail}</div>}
    </article>
  );
}

export default function BoxOfficeIndia() {
  const [overview, setOverview] = useState(null);
  const [market, setMarket] = useState('india');
  const [period, setPeriod] = useState('daily');
  const [language, setLanguage] = useState('all');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieHistory, setMovieHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [records, setRecords] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [sourceInfoOpen, setSourceInfoOpen] = useState(false);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    let active = true;
    axios.get('/api/boxoffice/overview')
      .then(({ data }) => {
        if (!active) return;
        const stats = data.data;
        setOverview(stats);
        const latestDate = stats?.latestReportDate
          ? new Date(stats.latestReportDate).toISOString().slice(0, 10)
          : null;
        if (latestDate) setDate(latestDate);
      })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'Box office overview is unavailable.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRows() {
      setLoading(true);
      setError('');
      setRows([]);
      setPagination(null);
      try {
        let response;
        if (market === 'india') {
          response = await axios.get('/api/boxoffice/india', {
            params: { date, period, language, page, limit: 50 },
          });
          if (!active) return;
          setRows(response.data.reports || []);
          setPagination({
            page: response.data.page || 1,
            pages: response.data.pages || 1,
            total: response.data.total || 0,
          });
        } else if (market === 'us' && period === 'daily') {
          response = await axios.get('/api/boxoffice/daily', {
            params: { market: 'us', date, page, limit: 50 },
          });
          if (!active) return;
          setRows(response.data.rows || []);
          setPagination(response.data.pagination || null);
        } else if (market === 'worldwide' && period === 'daily') {
          response = await axios.get('/api/boxoffice/worldwide', { params: { date } });
          if (!active) return;
          setRows(response.data.reports || []);
        } else if (market === 'worldwide') {
          if (!active) return;
          setRows([]);
          setError('No verified weekly or monthly worldwide data source is currently integrated.');
        } else {
          response = await axios.get('/api/boxoffice/weekly', {
            params: { market, date, language },
          });
          if (!active) return;
          setRows(response.data.rows || []);
          if (response.data.coverage) setError(response.data.coverage);
        }
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || err.response?.data?.error || 'Box office reports are unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadRows();
    return () => { active = false; };
  }, [market, period, language, date, page]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row => (row.movieTitle || row.title || '').toLowerCase().includes(query));
  }, [rows, search]);

  const loadMovieHistory = async row => {
    if (!row.tmdbId) return;
    setSelectedMovie(row);
    setMovieHistory(null);
    setHistoryLoading(true);
    try {
      const { data } = await axios.get(`/api/boxoffice/movie/${row.tmdbId}/history`);
      setMovieHistory(data);
    } catch (err) {
      setMovieHistory({ error: err.response?.data?.error || 'movie_history_unavailable' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadRecords = async () => {
    setRecordsOpen(value => !value);
    if (records || recordsLoading) return;
    setRecordsLoading(true);
    try {
      const { data } = await axios.get('/api/boxoffice/records');
      setRecords(data);
    } catch (err) {
      setRecords({ error: err.response?.data?.error || 'records_unavailable' });
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadSources = async () => {
    setSourceInfoOpen(value => !value);
    if (sources.length) return;
    try {
      const { data } = await axios.get('/api/boxoffice/sources');
      setSources(data.sources || []);
    } catch (err) {
      setSources([{ name: 'Source information unavailable', limitation: err.response?.data?.error || err.message }]);
    }
  };

  const todayIndia = overview?.todayIndia;
  const worldwide = overview?.latestWorldwide;

  return (
    <section style={{ paddingTop: '1.5rem', color: 'var(--vc-cream)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <SummaryCard
          label="Latest India nett report"
          value={todayIndia ? formatAmount(todayIndia.amount, todayIndia.currency) : 'Unavailable'}
          detail={todayIndia ? `${todayIndia.title} · ${formatDate(todayIndia.reportDate)}` : 'No authorized report cached yet'}
        />
        <SummaryCard
          label="Latest worldwide gross"
          value={worldwide ? formatAmount(worldwide.amount, worldwide.currency) : 'Unavailable'}
          detail={worldwide ? `${worldwide.title} · ${formatDate(worldwide.reportDate)}` : 'No source-reported total cached yet'}
        />
        <SummaryCard
          label="TMDB matched movies"
          value={overview ? overview.trackedMovies.toLocaleString() : '—'}
          detail={`${overview?.dailyReports || 0} daily and ${overview?.lifetimeReports || 0} cached reports`}
        />
        <SummaryCard
          label="Last successful sync"
          value={overview?.lastSuccessfulSyncAt ? formatDate(overview.lastSuccessfulSyncAt) : 'Not synced'}
          detail={overview?.lastSuccessfulSyncAt ? new Date(overview.lastSuccessfulSyncAt).toLocaleTimeString() : 'Start the Box Office worker'}
        />
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'end',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '1rem',
        borderRadius: 'var(--vc-radius-lg)',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'var(--vc-bg-card)',
      }}>
        <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          Market
          <select className="vc-input" value={market} onChange={event => { setMarket(event.target.value); setPage(1); }}>
            <option value="india">India</option>
            <option value="us">US domestic</option>
            <option value="worldwide">Worldwide lifetime</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          Period
          <select className="vc-input" value={period} onChange={event => { setPeriod(event.target.value); setPage(1); }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (reported days)</option>
            <option value="monthly">Monthly (reported days)</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          Report date
          <input className="vc-input" type="date" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} />
        </label>
        {market !== 'worldwide' && (
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
            Language
            <select className="vc-input" value={language} onChange={event => setLanguage(event.target.value)}>
              {LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
        )}
        <input
          className="vc-input"
          style={{ minWidth: 190 }}
          placeholder="Search reported movies…"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search box office movies"
        />
      </div>

      {overview?.dataCoverage?.india && (
        <p style={{
          margin: '0 0 1rem',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.18)',
          color: 'var(--vc-slate)',
          fontSize: '0.8rem',
        }}>
          Coverage note: {overview.dataCoverage.india} All displayed figures keep their source, currency and estimate status.
        </p>
      )}

      {error && (
        <p role="status" style={{ padding: '0.75rem 1rem', color: 'var(--vc-gold-light)', fontSize: '0.82rem' }}>
          {error}
        </p>
      )}

      <div className="vc-mobile-table-wrap" style={{
        overflowX: 'auto',
        borderRadius: 'var(--vc-radius-lg)',
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'var(--vc-bg-card)',
      }}>
        {loading ? (
          <p style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--vc-slate)' }}>Loading source-reported box office data…</p>
        ) : (
          <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ color: 'var(--vc-gold)', background: 'var(--vc-bg-elevated)', textAlign: 'left' }}>
                <th style={{ padding: '0.8rem' }}>Rank</th>
                <th style={{ padding: '0.8rem' }}>Movie</th>
                <th style={{ padding: '0.8rem' }}>Language</th>
                <th style={{ padding: '0.8rem' }}>Release</th>
                <th style={{ padding: '0.8rem', textAlign: 'right' }}>
                  {market === 'worldwide' ? 'Worldwide gross' : period === 'daily' ? 'Daily collection' : 'Reported total'}
                </th>
                <th style={{ padding: '0.8rem', textAlign: 'right' }}>Cumulative</th>
                <th style={{ padding: '0.8rem' }}>Source / status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const title = row.movieTitle || row.title;
                const amount = reportAmount(row, market, period);
                const currency = row.currency || 'INR';
                const source = row.source || 'box-office-history';
                const poster = row.posterPath ? tmdbImageUrl(row.posterPath, 'w92') : null;
                const cumulative = market === 'worldwide'
                  ? null
                  : (period === 'daily' ? row.cumulativeCollection : row.cumulativeCollection);
                return (
                  <React.Fragment key={row.reportKey || row._id || `${title}-${index}`}>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--vc-slate)' }}>{row.rank ?? index + 1}</td>
                      <td style={{ padding: '0.75rem', minWidth: 210 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          {poster && <img src={poster} alt="" loading="lazy" style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 4 }} />}
                          <div>
                            {row.tmdbId ? (
                              <Link to={`/movie/${row.tmdbId}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none' }}>{title}</Link>
                            ) : <span>{title}</span>}
                            {row.tmdbId && (
                              <button
                                type="button"
                                onClick={() => loadMovieHistory(row)}
                                style={{ display: 'block', marginTop: 4, padding: 0, border: 0, background: 'none', color: 'var(--vc-gold)', cursor: 'pointer', fontSize: '0.7rem' }}
                              >
                                View history
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--vc-slate)' }}>
                        {LANGUAGE_NAMES[row.originalLanguage] || row.originalLanguage || 'Not reported'}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--vc-slate)' }}>{row.releaseDate ? formatDate(row.releaseDate) : 'Not reported'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--vc-gold-light)', fontWeight: 700 }}>
                        {formatAmount(amount, currency)}
                        {period !== 'daily' && market === 'india' && row.reportedDays ? (
                          <small style={{ display: 'block', color: 'var(--vc-slate)', fontWeight: 400 }}>{row.reportedDays} reported day(s)</small>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--vc-slate)' }}>
                        {cumulative == null ? '—' : formatAmount(cumulative, currency)}
                      </td>
                      <td style={{ padding: '0.75rem', minWidth: 150 }}>
                        {row.sourceUrl
                          ? <a href={row.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--vc-slate)' }}>{source}</a>
                          : <span style={{ color: 'var(--vc-slate)' }}>{source}</span>}
                        <small style={{ display: 'block', marginTop: 3, color: row.isEstimate ? '#e5b946' : '#8eb8a1' }}>
                          {row.isEstimate ? 'Publisher estimate' : row.verificationStatus || 'Provider reported'}
                        </small>
                      </td>
                    </tr>
                    {selectedMovie?.tmdbId === row.tmdbId && (
                      <tr>
                        <td colSpan={7} style={{ padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.18)' }}>
                          {historyLoading && <p style={{ color: 'var(--vc-slate)' }}>Loading available history…</p>}
                          {!historyLoading && movieHistory?.error && (
                            <p style={{ color: 'var(--vc-slate)' }}>No authorized history was found for this movie.</p>
                          )}
                          {!historyLoading && movieHistory && !movieHistory.error && (
                            <HistoryPanel history={movieHistory} movieTitle={title} />
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!filteredRows.length && (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--vc-slate)' }}>
                  No source-reported collection is available for these filters. Missing values are not estimated or filled.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="vc-btn vc-btn-secondary" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button>
          <span style={{ color: 'var(--vc-slate)', fontSize: '0.8rem' }}>Page {pagination.page} of {pagination.pages}</span>
          <button type="button" className="vc-btn vc-btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage(current => current + 1)}>Next</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
        <button type="button" className="vc-btn vc-btn-secondary" onClick={loadRecords}>
          {recordsOpen ? 'Hide historical records' : 'Historical records'}
        </button>
        <button type="button" className="vc-btn vc-btn-secondary" onClick={loadSources}>
          {sourceInfoOpen ? 'Hide data sources' : 'Data sources & coverage'}
        </button>
      </div>

      {recordsOpen && (
        <section style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--vc-radius-lg)', background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ marginTop: 0, fontFamily: 'Playfair Display, serif' }}>Historical records</h3>
          {recordsLoading && <p style={{ color: 'var(--vc-slate)' }}>Loading provider records…</p>}
          {records?.error && <p style={{ color: 'var(--vc-slate)' }}>Historical records are unavailable right now.</p>}
          {records?.india && <p style={{ color: 'var(--vc-slate)', fontSize: '0.82rem' }}>{records.india.coverage}</p>}
          {records?.unitedStates?.data && Object.entries(records.unitedStates.data)
            .filter(([, value]) => Array.isArray(value) && value.length)
            .map(([name, values]) => (
              <div key={name} style={{ marginTop: '1rem' }}>
                <h4 style={{ color: 'var(--vc-gold-light)', textTransform: 'capitalize' }}>{name.replace(/([A-Z])/g, ' $1')}</h4>
                <ol style={{ color: 'var(--vc-slate)', paddingLeft: '1.25rem' }}>
                  {values.slice(0, 5).map((record, index) => (
                    <li key={`${record.id || record.title}-${index}`} style={{ marginBottom: 5 }}>
                      {record.title} — {formatAmount(record.gross, 'USD')} · {record.label || record.year || ''}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          <p style={{ color: 'var(--vc-slate)', fontSize: '0.75rem' }}>
            US opening records are attributed to Box Office History. India lifetime reports are a partial publisher feed, not an all-time ranking.
          </p>
        </section>
      )}

      {sourceInfoOpen && (
        <section style={{ marginTop: '1rem', display: 'grid', gap: '0.65rem' }}>
          {sources.map(source => (
            <article key={source.id || source.name} style={{ padding: '0.9rem 1rem', borderRadius: 10, background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
                <strong>{source.name}</strong>
                <span style={{ color: 'var(--vc-gold)', fontSize: '0.75rem' }}>{source.status}</span>
              </div>
              {source.url && <a href={source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--vc-slate)', fontSize: '0.75rem' }}>{source.url}</a>}
              <p style={{ marginBottom: 0, color: 'var(--vc-slate)', fontSize: '0.78rem' }}>{source.coverage || source.limitation}</p>
              {source.limitation && source.coverage && <p style={{ marginBottom: 0, color: 'var(--vc-slate)', fontSize: '0.75rem' }}>{source.limitation}</p>}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
