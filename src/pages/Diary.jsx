import { tmdbImageUrl } from '../api/tmdb';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { hasAuthSession } from '../api/session';

const getLocalDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const getPoster = path => path
  ? tmdbImageUrl(path, 'w185')
  : '';

const formatDiaryDate = date => new Date(date).toLocaleDateString(undefined, {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export default function Diary() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [watchedAt, setWatchedAt] = useState(getLocalDate);
  const [rating, setRating] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const loadEntries = async () => {
    if (!hasAuthSession()) {
      setError('Please sign in to keep your movie diary.');
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get('/api/diary', { headers });
      setEntries(response.data?.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your diary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);

  useEffect(() => {
    const query = search.trim();
    if (selectedMovie) {
      setResults([]);
      return undefined;
    }
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const [response, originalResponse] = await Promise.all([
          axios.get('/api/tmdb/search', { params: { query, type: 'multi', page: 1 } }),
          axios.get('/api/original-films/search', { params: { query } })
            .catch(() => ({ data: { results: [] } })),
        ]);
        if (active) {
          setResults([
            ...(originalResponse.data?.results || []).map(item => ({ ...item, media_type: 'movie' })),
            ...(response.data?.results || [])
              .filter(item => item.media_type === 'movie' || item.media_type === 'tv'),
          ].slice(0, 8));
        }
      } catch {
        if (active) {
          setResults([]);
          setSearchError('Could not search titles. Please try again.');
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, selectedMovie]);

  const groupedEntries = useMemo(() => entries.reduce((groups, entry) => {
    const dateKey = new Date(entry.watchedAt).toISOString().slice(0, 10);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(entry);
    return groups;
  }, {}), [entries]);

  const saveEntry = async event => {
    event.preventDefault();
    if (!selectedMovie) {
      setError('Choose a movie or show to log first.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const mediaType = selectedMovie.media_type === 'tv' ? 'tv' : 'movie';
      const response = await axios.post('/api/diary', {
        tmdbId: selectedMovie.tmdbId ?? selectedMovie.id,
        source: selectedMovie.source || 'tmdb',
        ...(selectedMovie.source === 'original' ? { originalId: selectedMovie.originalId || selectedMovie.id } : {}),
        title: selectedMovie.title || selectedMovie.name,
        poster: selectedMovie.poster_path
          ? tmdbImageUrl(selectedMovie.poster_path, 'w342')
          : '',
        mediaType,
        watchedAt,
        ...(rating ? { rating: Number(rating) } : {}),
        note: note.trim(),
      }, { headers });
      const entry = response.data?.data;
      setEntries(current => [entry, ...current].sort((a, b) => (
        new Date(b.watchedAt) - new Date(a.watchedAt) || new Date(b.createdAt) - new Date(a.createdAt)
      )));
      setSelectedMovie(null);
      setSearch('');
      setResults([]);
      setRating('');
      setNote('');
      setWatchedAt(getLocalDate());
      setNotice('Added to your diary.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this diary entry.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async entryId => {
    if (!window.confirm('Remove this diary entry?')) return;
    try {
      await axios.delete(`/api/diary/${entryId}`, { headers });
      setEntries(current => current.filter(entry => entry._id !== entryId));
      setNotice('Diary entry removed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this diary entry.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <section style={{ padding: '4rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container">
          <span className="vc-section-label">Your cinema journal</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '0.5rem 0' }}>Movie Diary</h1>
          <p style={{ color: 'var(--vc-slate)', maxWidth: 620, lineHeight: 1.6 }}>
            Log what you watched and when. Add a rating if you like—writing a review is completely optional.
          </p>
        </div>
      </section>

      <main className="vc-container grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] items-start gap-8" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <section>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', marginTop: 0 }}>Watched by date <span style={{ color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>({entries.length})</span></h2>
          {loading ? (
            <p role="status" style={{ color: 'var(--vc-slate)' }}>Loading your diary…</p>
          ) : error && !entries.length ? (
            <div style={{ padding: '1.5rem', borderRadius: 12, background: 'var(--vc-bg-card)' }}>
              <p role="alert" style={{ color: 'var(--vc-slate)' }}>{error}</p>
              {!hasAuthSession() ? (
                <button className="vc-btn vc-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>Sign in</button>
              ) : (
                <button className="vc-btn vc-btn-outline" onClick={loadEntries}>Try again</button>
              )}
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', borderRadius: 12, background: 'var(--vc-bg-card)', color: 'var(--vc-slate)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎞️</div>
              <p>Your diary is empty. Log a movie or show after watching it.</p>
            </div>
          ) : (
            Object.entries(groupedEntries).map(([date, dayEntries]) => (
              <section key={date} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-gold)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>{formatDiaryDate(date)}</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {dayEntries.map(entry => (
                    <article key={entry._id} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: 12, background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {getPoster(entry.poster) ? (
                        <img src={getPoster(entry.poster)} alt="" style={{ width: 58, height: 86, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 58, height: 86, borderRadius: 7, background: 'var(--vc-bg-elevated)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>🎬</div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link to={`/${entry.mediaType === 'tv' ? 'tv' : 'movie'}/${entry.source === 'original' ? entry.originalId : entry.tmdbId}`} style={{ color: 'var(--vc-cream)', textDecoration: 'none', fontWeight: 600 }}>
                          {entry.title}
                        </Link>
                        <div style={{ marginTop: '0.35rem', color: 'var(--vc-slate)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          {entry.mediaType === 'tv' ? 'TV show' : 'Movie'}
                        </div>
                        {entry.rating != null && <div style={{ marginTop: '0.35rem', color: 'var(--vc-gold)', fontSize: '0.82rem' }}>★ {entry.rating}/10</div>}
                        {entry.note && <p style={{ color: 'var(--vc-slate)', fontSize: '0.82rem', lineHeight: 1.45, margin: '0.4rem 0 0' }}>{entry.note}</p>}
                      </div>
                      <button type="button" className="vc-btn vc-btn-ghost" aria-label={`Remove ${entry.title} from diary`} onClick={() => deleteEntry(entry._id)} style={{ alignSelf: 'flex-start', padding: '0.25rem 0.5rem' }}>×</button>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </section>

        <aside className="lg:sticky lg:top-20" style={{ padding: '1.25rem', borderRadius: 12, background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.15rem', margin: '0 0 0.4rem' }}>Log a watch</h2>
          <p style={{ color: 'var(--vc-slate)', fontSize: '0.8rem', lineHeight: 1.5, marginTop: 0 }}>
            A date and title are enough. Rating and note are optional.
          </p>
          <form onSubmit={saveEntry}>
            <label htmlFor="diary-search" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Movie or show</label>
            <input id="diary-search" className="vc-input" value={search} onChange={event => { setSearch(event.target.value); setSelectedMovie(null); }} placeholder="Search a title…" autoComplete="off" />
            {searching && <p role="status" style={{ color: 'var(--vc-slate)', fontSize: '0.8rem' }}>Searching…</p>}
            {searchError && <p role="alert" style={{ color: '#fc8181', fontSize: '0.8rem' }}>{searchError}</p>}
            {results.length > 0 && !selectedMovie && (
              <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.5rem', maxHeight: 240, overflowY: 'auto' }}>
                {results.map(item => (
                  <button type="button" key={`${item.media_type}-${item.id}`} onClick={() => { setSelectedMovie(item); setSearch(item.title || item.name); setResults([]); }} style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', textAlign: 'left', padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'var(--vc-bg-elevated)', color: 'var(--vc-cream)', cursor: 'pointer' }}>
                    {getPoster(item.poster_path) ? <img src={getPoster(item.poster_path)} alt="" style={{ width: 32, height: 48, borderRadius: 4, objectFit: 'cover' }} /> : <span aria-hidden="true">🎬</span>}
                    <span style={{ fontSize: '0.8rem' }}>{item.title || item.name}<small style={{ display: 'block', color: 'var(--vc-slate)', marginTop: 3 }}>{item.media_type === 'tv' ? 'TV show' : 'Movie'}</small></span>
                  </button>
                ))}
              </div>
            )}
            {selectedMovie && <p style={{ color: 'var(--vc-gold)', fontSize: '0.82rem' }}>Selected: {selectedMovie.title || selectedMovie.name}</p>}

            <label htmlFor="diary-date" style={{ display: 'block', fontSize: '0.8rem', margin: '1rem 0 0.35rem' }}>Watched on</label>
            <input id="diary-date" type="date" className="vc-input" value={watchedAt} max={getLocalDate()} onChange={event => setWatchedAt(event.target.value)} required />

            <label htmlFor="diary-rating" style={{ display: 'block', fontSize: '0.8rem', margin: '1rem 0 0.35rem' }}>Your rating (optional)</label>
            <select id="diary-rating" className="vc-input" value={rating} onChange={event => setRating(event.target.value)}>
              <option value="">Just log it — no rating</option>
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}/10</option>)}
            </select>

            <label htmlFor="diary-note" style={{ display: 'block', fontSize: '0.8rem', margin: '1rem 0 0.35rem' }}>Note or review (optional)</label>
            <textarea id="diary-note" className="vc-input" rows={3} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="What did you think?" />

            {error && <p role="alert" style={{ color: '#fc8181', fontSize: '0.8rem' }}>{error}</p>}
            {notice && <p role="status" style={{ color: 'var(--vc-gold)', fontSize: '0.8rem' }}>{notice}</p>}
            <button type="submit" className="vc-btn vc-btn-primary" disabled={saving || !selectedMovie} style={{ width: '100%', marginTop: '1rem' }}>
              {saving ? 'Saving…' : 'Add to diary'}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
