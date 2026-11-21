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

function formatAmount(amount, currency = 'INR') {
  if (!Number.isFinite(Number(amount))) return '—';
  const value = Number(amount);
  if (currency === 'INR') {
    return value >= 10_000_000
      ? `₹${(value / 10_000_000).toFixed(2)} Cr`
      : `₹${value.toLocaleString('en-IN')}`;
  }
  if (currency === 'USD') return `$${value.toLocaleString('en-US')}`;
  return `${currency} ${value.toLocaleString()}`.trim();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function movieKey(row) {
  if (row?.tmdbId) return `tmdb:${row.tmdbId}`;
  if (row?.sourceMovieKey) return `key:${row.sourceMovieKey}`;
  return `title:${row?.movieTitle || row?.title || ''}`;
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

function SectionHeading({ eyebrow, title, note, action }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.9rem', alignItems: 'end' }}>
      <div>
        <span className="vc-section-label">{eyebrow}</span>
        <h2 style={{ margin: '0.2rem 0 0', fontFamily: 'Playfair Display, serif', fontSize: '1.55rem' }}>{title}</h2>
        {note && <p style={{ margin: '0.35rem 0 0', color: 'var(--vc-slate)', fontSize: '0.8rem', maxWidth: 720 }}>{note}</p>}
      </div>
      {action}
    </div>
  );
}

function DaywisePanel({ history, movieTitle }) {
  const indiaRows = [...(history.indiaDaily || [])].sort((a, b) => {
    if (a.day != null && b.day != null) return a.day - b.day;
    return String(a.date).localeCompare(String(b.date));
  });
  const usHistory = history.unitedStates || {};
  const usDaily = [...(usHistory.daily || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const chartRows = indiaRows.map((row, index) => ({
    label: row.day != null ? `Day ${row.day}` : formatDate(row.date),
    date: row.date,
    day: row.day ?? index + 1,
    nett: row.dailyCollection,
    cumulativeNett: row.cumulativeCollection,
  }));
  const usChartRows = usDaily.map((row, index) => ({
    label: row.label || formatDate(row.date) || `Day ${index + 1}`,
    date: row.date,
    gross: row.gross,
    cumulativeGross: row.cumulativeGross,
  }));

  if (!indiaRows.length && !usHistory.lifetimeDomesticGross && !usDaily.length) {
    return <p style={{ color: 'var(--vc-slate)' }}>No day-wise collection history is cached for this title yet.</p>;
  }

  return (
    <div style={{ marginTop: '0.35rem' }}>
      <p style={{ color: 'var(--vc-slate)', fontSize: '0.8rem', marginTop: 0 }}>
        {indiaRows.length
          ? `Day-wise India nett for ${movieTitle} from the earliest reported day through the latest cached day.`
          : `Domestic-region history for ${movieTitle}.`}
        {' '}Worldwide / US totals below are the latest reported figures when available.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        {history.indiaNettTotal && (
          <SummaryCard label="India nett total" value={formatAmount(history.indiaNettTotal.value, history.indiaNettTotal.currency || 'INR')} />
        )}
        {history.worldwideGrossTotal && (
          <SummaryCard label="Worldwide gross total" value={formatAmount(history.worldwideGrossTotal.value, history.worldwideGrossTotal.currency || 'INR')} />
        )}
        {usHistory.lifetimeDomesticGross != null && (
          <SummaryCard label="Domestic (US) gross" value={formatAmount(usHistory.lifetimeDomesticGross, 'USD')} />
        )}
      </div>

      {chartRows.length > 0 && (
        <>
          <div style={{ width: '100%', height: 280, marginBottom: '1rem' }}>
            <ResponsiveContainer>
              <LineChart data={chartRows} margin={{ top: 10, right: 12, bottom: 4, left: 12 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9aa5b7" tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#9aa5b7"
                  tick={{ fontSize: 11 }}
                  tickFormatter={value => `₹${(value / 10_000_000).toFixed(0)}Cr`}
                />
                <Tooltip formatter={value => formatAmount(value, 'INR')} />
                <Legend />
                <Line type="monotone" dataKey="nett" name="Day India nett" stroke="#d4af37" dot={false} />
                <Line type="monotone" dataKey="cumulativeNett" name="Cumulative India nett" stroke="#5bc0be" dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="vc-mobile-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ color: 'var(--vc-gold)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem' }}>Day</th>
                  <th style={{ padding: '0.65rem' }}>Date</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>India nett</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Cumulative nett</th>
                </tr>
              </thead>
              <tbody>
                {indiaRows.map((row, index) => (
                  <tr key={`${row.date}-${index}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.65rem' }}>{row.day != null ? `Day ${row.day}` : `Day ${index + 1}`}</td>
                    <td style={{ padding: '0.65rem' }}>{formatDate(row.date)}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', color: 'var(--vc-gold-light)', fontWeight: 700 }}>
                      {formatAmount(row.dailyCollection, row.currency || 'INR')}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                      {formatAmount(row.cumulativeCollection, row.currency || 'INR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!chartRows.length && usChartRows.length > 0 && (
        <>
          <div style={{ width: '100%', height: 280, marginBottom: '1rem' }}>
            <ResponsiveContainer>
              <LineChart data={usChartRows} margin={{ top: 10, right: 12, bottom: 4, left: 12 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9aa5b7" tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#9aa5b7"
                  tick={{ fontSize: 11 }}
                  tickFormatter={value => `$${(value / 1_000_000).toFixed(0)}M`}
                />
                <Tooltip formatter={value => formatAmount(value, 'USD')} />
                <Legend />
                <Line type="monotone" dataKey="gross" name="US daily gross" stroke="#d4af37" dot={false} />
                <Line type="monotone" dataKey="cumulativeGross" name="US cumulative" stroke="#5bc0be" dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="vc-mobile-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ color: 'var(--vc-gold)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem' }}>Date</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>US gross</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {usDaily.map((row, index) => (
                  <tr key={`${row.date}-${index}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.65rem' }}>{formatDate(row.date)}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', color: 'var(--vc-gold-light)', fontWeight: 700 }}>
                      {formatAmount(row.gross, 'USD')}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                      {formatAmount(row.cumulativeGross, 'USD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MovieTable({
  rows,
  mode,
  selectedKey,
  onOpenDaywise,
  historyLoading,
  movieHistory,
}) {
  if (!rows.length) {
    return <p style={{ padding: '1.5rem', color: 'var(--vc-slate)', textAlign: 'center' }}>No source-reported rows for this section yet.</p>;
  }

  return (
    <div className="vc-mobile-table-wrap" style={{
      overflowX: 'auto',
      borderRadius: 'var(--vc-radius-lg)',
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'var(--vc-bg-card)',
    }}>
      <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ color: 'var(--vc-gold)', background: 'var(--vc-bg-elevated)', textAlign: 'left' }}>
            <th style={{ padding: '0.8rem' }}>#</th>
            <th style={{ padding: '0.8rem' }}>Movie</th>
            <th style={{ padding: '0.8rem' }}>{mode === 'latest' ? 'Day' : mode === 'domestic' ? 'Market' : 'Language'}</th>
            <th style={{ padding: '0.8rem', textAlign: 'right' }}>
              {mode === 'year' ? 'India nett (year)' : mode === 'latest' ? 'Today nett' : 'Domestic gross'}
            </th>
            <th style={{ padding: '0.8rem', textAlign: 'right' }}>{mode === 'latest' ? 'Cumulative nett' : '—'}</th>
            <th style={{ padding: '0.8rem' }}>Day wise</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = movieKey(row);
            const title = row.movieTitle || row.title;
            const poster = row.posterPath ? tmdbImageUrl(row.posterPath, 'w92') : null;
            const amount = mode === 'year' || mode === 'domestic'
              ? row.amount
              : row.dailyCollection;
            const currency = row.currency || (mode === 'domestic' ? 'USD' : 'INR');
            const open = selectedKey === key;
            return (
              <React.Fragment key={key}>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--vc-slate)' }}>{row.rank ?? index + 1}</td>
                  <td style={{ padding: '0.75rem', minWidth: 210 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {poster && <img src={poster} alt="" loading="lazy" style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 4 }} />}
                      <div>
                        {row.tmdbId ? (
                          <Link to={`/movie/${row.tmdbId}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none' }}>{title}</Link>
                        ) : <span>{title}</span>}
                        <div style={{ color: 'var(--vc-slate)', fontSize: '0.7rem', marginTop: 2 }}>
                          {row.releaseDate ? formatDate(row.releaseDate) : row.releaseYear || row.releaseLabel || ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--vc-slate)' }}>
                    {mode === 'latest'
                      ? (row.dayNumber != null ? `Day ${row.dayNumber}` : '—')
                      : mode === 'domestic'
                        ? (row.market || 'Domestic')
                        : (LANGUAGE_NAMES[row.originalLanguage] || row.originalLanguage || '—')}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--vc-gold-light)', fontWeight: 700 }}>
                    {formatAmount(amount, currency)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--vc-slate)' }}>
                    {mode === 'latest' ? formatAmount(row.cumulativeCollection, currency) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => onOpenDaywise(row)}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: 999,
                        border: '1px solid rgba(212,175,55,0.45)',
                        background: open ? 'rgba(212,175,55,0.18)' : 'transparent',
                        color: 'var(--vc-gold)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                      }}
                    >
                      {open ? 'Hide day wise' : 'Day wise'}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} style={{ padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.18)' }}>
                      {historyLoading && <p style={{ color: 'var(--vc-slate)' }}>Loading day-wise collections…</p>}
                      {!historyLoading && movieHistory?.error && (
                        <p style={{ color: 'var(--vc-slate)' }}>No day-wise history is available for this movie yet.</p>
                      )}
                      {!historyLoading && movieHistory && !movieHistory.error && (
                        <DaywisePanel history={movieHistory} movieTitle={title} />
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BoxOfficeIndia() {
  const currentYear = new Date().getFullYear();
  const [overview, setOverview] = useState(null);
  const [year, setYear] = useState(currentYear);
  const [language, setLanguage] = useState('all');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieHistory, setMovieHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [otherMarket, setOtherMarket] = useState('');
  const [otherRows, setOtherRows] = useState([]);
  const [otherLoading, setOtherLoading] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get('/api/boxoffice/overview')
      .then(({ data }) => {
        if (!active) return;
        const stats = data.data;
        setOverview(stats);
        const latestDate = stats?.latestReportDate
          ? new Date(stats.latestReportDate).toISOString().slice(0, 10)
          : '';
        if (latestDate) setDate(latestDate);
      })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'Box office overview is unavailable.');
      });
    return () => { active = false; };
  }, [reloadToken]);

  useEffect(() => {
    let active = true;
    async function loadBoard() {
      setLoading(true);
      setError('');
      try {
        const params = {
          year,
          language,
          date: date || undefined,
        };
        let data;
        try {
          ({ data } = await axios.get('/api/boxoffice/board', { params }));
        } catch (primaryError) {
          if (primaryError.response?.status !== 404) throw primaryError;
          ({ data } = await axios.get('/api/boxoffice/india/board', { params }));
        }
        if (!active) return;
        setBoard(data);
        if (data.date) setDate(current => current || data.date);
      } catch (err) {
        if (!active) return;
        setBoard(null);
        setError(err.response?.data?.message || err.response?.data?.error || 'India box office board unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadBoard();
    return () => { active = false; };
  }, [year, language, date, reloadToken]);

  useEffect(() => {
    let active = true;
    async function loadOther() {
      if (!otherMarket) {
        setOtherRows([]);
        return;
      }
      setOtherLoading(true);
      try {
        if (otherMarket === 'us-yearly') {
          const { data } = await axios.get('/api/boxoffice/history/chart', {
            params: { market: 'us', period: 'yearly', date: `${year}-12-31`, limit: 50 },
          });
          if (!active) return;
          setOtherRows(data.rows || []);
        } else if (otherMarket === 'worldwide') {
          const { data } = await axios.get('/api/boxoffice/worldwide', { params: { page: 1, limit: 50 } });
          if (!active) return;
          setOtherRows(data.reports || []);
        }
      } catch {
        if (active) setOtherRows([]);
      } finally {
        if (active) setOtherLoading(false);
      }
    }
    loadOther();
    return () => { active = false; };
  }, [otherMarket, year]);

  const filterRows = (rows = []) => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row => (row.movieTitle || row.title || '').toLowerCase().includes(query));
  };

  const yearToppers = useMemo(() => filterRows(board?.yearToppers || []), [board, search]);
  const latestPlaying = useMemo(() => filterRows(board?.latestPlaying || []), [board, search]);
  const nonIndianDomestic = useMemo(() => filterRows(board?.nonIndianDomestic || []), [board, search]);

  const refreshLiveData = async () => {
    setSyncing(true);
    setError('');
    try {
      await axios.post('/api/boxoffice/sync');
      setReloadToken(token => token + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Live box office sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const openDaywise = async row => {
    const key = movieKey(row);
    if (selectedMovie && movieKey(selectedMovie) === key) {
      setSelectedMovie(null);
      setMovieHistory(null);
      return;
    }
    setSelectedMovie(row);
    setMovieHistory(null);
    setHistoryLoading(true);
    try {
      const id = row.tmdbId || 0;
      const { data } = await axios.get(`/api/boxoffice/movie/${id}/history`, {
        params: row.sourceMovieKey ? { sourceMovieKey: row.sourceMovieKey } : undefined,
      });
      setMovieHistory(data);
    } catch (err) {
      setMovieHistory({ error: err.response?.data?.error || 'movie_history_unavailable' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const selectedKey = selectedMovie ? movieKey(selectedMovie) : null;
  const topYearMovie = yearToppers[0];

  return (
    <section style={{ paddingTop: '1.5rem', color: 'var(--vc-cream)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <SummaryCard
          label={`${year} highest India nett`}
          value={topYearMovie ? formatAmount(topYearMovie.amount, topYearMovie.currency) : '—'}
          detail={topYearMovie ? topYearMovie.movieTitle : 'Waiting for lifetime reports'}
        />
        <SummaryCard
          label="Latest chart date"
          value={board?.date ? formatDate(board.date) : '—'}
          detail={`${board?.latestPlaying?.length || 0} films on the live chart`}
        />
        <SummaryCard
          label="Tracked matches"
          value={overview ? overview.trackedMovies.toLocaleString() : '—'}
          detail={`${overview?.dailyReports || 0} daily · ${overview?.lifetimeReports || 0} lifetime`}
        />
        <SummaryCard
          label="Last sync"
          value={overview?.lastSuccessfulSyncAt ? formatDate(overview.lastSuccessfulSyncAt) : 'Not synced'}
          detail={overview?.lastSuccessfulSyncAt ? new Date(overview.lastSuccessfulSyncAt).toLocaleTimeString() : 'Use refresh below'}
        />
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'end',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        padding: '1rem',
        borderRadius: 'var(--vc-radius-lg)',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'var(--vc-bg-card)',
      }}>
        <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          Year
          <input
            className="vc-input"
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={event => setYear(Number(event.target.value) || currentYear)}
          />
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          Chart date
          <input
            className="vc-input"
            type="date"
            value={date || ''}
            onChange={event => setDate(event.target.value)}
          />
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          Language
          <select className="vc-input" value={language} onChange={event => setLanguage(event.target.value)}>
            {LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
        </label>
        <input
          className="vc-input"
          style={{ minWidth: 190 }}
          placeholder="Search movies…"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <button
          type="button"
          className="vc-btn vc-btn-primary"
          onClick={refreshLiveData}
          disabled={syncing}
          style={{ opacity: syncing ? 0.7 : 1 }}
        >
          {syncing ? 'Syncing…' : 'Refresh live chart'}
        </button>
      </div>

      {error && (
        <p role="status" style={{ padding: '0.75rem 1rem', color: 'var(--vc-gold-light)', fontSize: '0.82rem' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--vc-slate)' }}>Loading India box office board…</p>
      ) : (
        <>
          <section style={{ marginBottom: '2.25rem' }}>
            <SectionHeading
              eyebrow="Year toppers"
              title={`${year} highest grossing`}
              note={board?.coverage?.yearToppers}
            />
            <MovieTable
              rows={yearToppers}
              mode="year"
              selectedKey={selectedKey}
              onOpenDaywise={openDaywise}
              historyLoading={historyLoading}
              movieHistory={movieHistory}
            />
          </section>

          <section style={{ marginBottom: '2.25rem' }}>
            <SectionHeading
              eyebrow="Now playing"
              title="Latest movies · day wise"
              note={board?.coverage?.latestPlaying || 'Click Day wise for Day 1 → now India nett.'}
            />
            <MovieTable
              rows={latestPlaying}
              mode="latest"
              selectedKey={selectedKey}
              onOpenDaywise={openDaywise}
              historyLoading={historyLoading}
              movieHistory={movieHistory}
            />
          </section>

          <section style={{ marginBottom: '2.25rem' }}>
            <SectionHeading
              eyebrow="Non-Indian"
              title="Domestic region collections"
              note={board?.coverage?.nonIndianDomestic || 'Hollywood / non-Indian titles in their home domestic market.'}
            />
            <MovieTable
              rows={nonIndianDomestic}
              mode="domestic"
              selectedKey={selectedKey}
              onOpenDaywise={openDaywise}
              historyLoading={historyLoading}
              movieHistory={movieHistory}
            />
            {!!board?.nonIndianOnIndiaChart?.length && (
              <p style={{ marginTop: '0.75rem', color: 'var(--vc-slate)', fontSize: '0.78rem' }}>
                Also on India chart today: {board.nonIndianOnIndiaChart.map(row => row.movieTitle).join(', ')}.
              </p>
            )}
          </section>
        </>
      )}

      <section style={{
        marginTop: '1rem',
        padding: '1rem',
        borderRadius: 'var(--vc-radius-lg)',
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'var(--vc-bg-card)',
      }}>
        <SectionHeading
          eyebrow="More markets"
          title="Optional charts"
          note="Extra views without changing the India board above."
          action={(
            <select
              className="vc-input"
              value={otherMarket}
              onChange={event => setOtherMarket(event.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">Hidden</option>
              <option value="us-yearly">US domestic yearly</option>
              <option value="worldwide">Worldwide lifetime</option>
            </select>
          )}
        />
        {otherLoading && <p style={{ color: 'var(--vc-slate)' }}>Loading…</p>}
        {!otherLoading && otherMarket === 'us-yearly' && (
          <ol style={{ color: 'var(--vc-slate)', paddingLeft: '1.2rem' }}>
            {otherRows.slice(0, 15).map((row, index) => (
              <li key={row.tmdbId || row.title || index} style={{ marginBottom: 6 }}>
                {row.title} — {formatAmount(row.dailyCollection ?? row.gross ?? row.total, 'USD')}
              </li>
            ))}
          </ol>
        )}
        {!otherLoading && otherMarket === 'worldwide' && (
          <ol style={{ color: 'var(--vc-slate)', paddingLeft: '1.2rem' }}>
            {otherRows.slice(0, 15).map((row, index) => (
              <li key={row.reportKey || row.movieTitle || index} style={{ marginBottom: 6 }}>
                {row.movieTitle} — {formatAmount(row.amount, row.currency || 'INR')}
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
