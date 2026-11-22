import { tmdbImageUrl } from '../api/tmdb';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CinemaMarkdown from '../components/CinemaMarkdown';
import { searchMovies } from '../api/tmdb';
import { apiUrl } from '../api/config';
import { hasAuthSession } from '../api/session';
import {
  ASK_FOLLOWUPS,
  ASK_SYSTEM,
  DISCOVER_SYSTEM,
  buildTasteHintFromHistory,
} from '../ai/cinemaPrompts';

const HISTORY_KEY = 'vc-discover-history';
const MAX_HISTORY = 40;

const MOODS = [
  { name: 'Any', desc: 'No mood filter', color: '#6b7280', bgPoster: null, accentColor: '#9ca3af' },
  { name: 'Romantic', desc: 'Intimate, longing, love', color: '#dc2626', bgPoster: '/in-the-mood-for-love.jpeg', accentColor: '#ef4444' },
  { name: 'Melancholic', desc: 'Quiet grief, nostalgia', color: '#f472b6', bgPoster: '/wp2392788.webp', accentColor: '#f9a8d4' },
  { name: 'Intense', desc: 'Pressure, obsession, stakes', color: '#6b7280', bgPoster: '/whiplash.webp', accentColor: '#9ca3af' },
  { name: 'Feel-Good', desc: 'Warmth, hope, joy', color: '#3b82f6', bgPoster: '/wp8872346.webp', accentColor: '#60a5fa' },
  { name: 'Stylish', desc: 'Visual flair, cool tone', color: '#f97316', bgPoster: '/MV5BZjkxNDU3NDktNTcyYi00ZGEyLWI2OWMtYTNkYTgzYzI4MjQ0XkEyXkFqcGdeQVRoaXJkUGFydHlJbmdlc3Rpb25Xb3JrZmxvdw@@._V1_QL75_UX500_CR0,0,500,281_.webp', accentColor: '#fb923c' },
];

const EXAMPLES = [
  'slow burn films like Aftersun',
  'Indian neo-noir with moral ambiguity',
  'movies with the emotional weight of Manchester by the Sea',
  'underrated Malayalam thrillers',
  'films about loneliness and alienation',
  'movies with ambiguous endings',
];

const ASK_EXAMPLES = [
  'Explain the ending of Mulholland Drive',
  'Compare Nolan and Villeneuve',
  'What is the 180-degree rule?',
  'Recommend essential Iranian films',
];

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const prev = loadHistory();
  const next = [{ ...entry, id: Date.now(), at: new Date().toISOString() }, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

function parseMoviesJson(aiText) {
  let jsonStr = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const arrayMatch = jsonStr.match(/\{[\s\S]*"movies"[\s\S]*\}/) || jsonStr.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error('No JSON in AI response');
  jsonStr = arrayMatch[0];
  const parsed = JSON.parse(jsonStr);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.movies)) return parsed.movies;
  const arrKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
  if (arrKey) return parsed[arrKey];
  throw new Error('Invalid movie list');
}

async function enrichOne(item) {
  const titleRaw = typeof item === 'string' ? item : item.title;
  if (!titleRaw) return null;
  const title = titleRaw.replace(/\s*\(\d{4}\).*/, '').trim();
  const yearHint = item.year || (titleRaw.match(/\((\d{4})\)/)?.[1]);
  const yearNum = yearHint ? Number(yearHint) : undefined;
  try {
    const tmdbRes = await searchMovies(
      title,
      Number.isFinite(yearNum) ? { year: yearNum } : undefined
    );
    let best = tmdbRes.results?.[0];
    if (yearHint && tmdbRes.results?.length) {
      best =
        tmdbRes.results.find(
          m => m.release_date && m.release_date.startsWith(String(yearHint))
        ) || best;
    }
    // Year filter can miss remakes / wrong year — one unfiltered retry.
    if (!best?.id && yearNum) {
      const fallback = await searchMovies(title);
      best = fallback.results?.[0] || null;
    }
    if (!best?.id) return null;
    return {
      id: best.id,
      title: best.title,
      year: best.release_date?.slice(0, 4) || yearHint || '',
      posterUrl: best.poster_path ? tmdbImageUrl(best.poster_path, 'w500') : null,
      rating: best.vote_average,
      reason: item.reason || '',
      director: item.director || '',
      genre: item.genre || '',
    };
  } catch {
    return null;
  }
}

async function enrichWithTmdb(items, onPartial) {
  const slice = items.slice(0, 5);
  const slots = new Array(slice.length).fill(null);
  await Promise.all(
    slice.map(async (item, index) => {
      const card = await enrichOne(item);
      slots[index] = card;
      if (onPartial) onPartial(slots.filter(Boolean));
    })
  );
  return slots.filter(Boolean);
}

export default function Discover() {
  const [mode, setMode] = useState('discover');
  const [input, setInput] = useState('');
  const [selectedMood, setSelectedMood] = useState('Any');
  const [movies, setMovies] = useState([]);
  const [askMessages, setAskMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [bgPoster, setBgPoster] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#6b7280');
  const [tasteProfile, setTasteProfile] = useState({ watchlistTitles: [], likedTitles: [] });
  const messagesEndRef = useRef(null);
  const tasteLoadedRef = useRef(false);

  const currentMood = MOODS.find(m => m.name === selectedMood) || MOODS[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [askMessages]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Soft personalization from existing user data (watchlist + high ratings). Opt-in via auth only.
  useEffect(() => {
    if (tasteLoadedRef.current || !hasAuthSession()) return;
    tasteLoadedRef.current = true;
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    let cancelled = false;
    (async () => {
      try {
        const [wlRes, revRes] = await Promise.allSettled([
          fetch(apiUrl('/api/watchlist'), { headers, credentials: 'include' }),
          fetch(apiUrl('/api/review'), { headers, credentials: 'include' }),
        ]);
        let watchlistTitles = [];
        let likedTitles = [];
        if (wlRes.status === 'fulfilled' && wlRes.value.ok) {
          const data = await wlRes.value.json();
          const movies = data?.movies || data?.data || [];
          watchlistTitles = (Array.isArray(movies) ? movies : [])
            .map(m => m.title || m.name)
            .filter(Boolean);
        }
        if (revRes.status === 'fulfilled' && revRes.value.ok) {
          const data = await revRes.value.json();
          const reviews = data?.reviews || data?.data || (Array.isArray(data) ? data : []);
          likedTitles = (Array.isArray(reviews) ? reviews : [])
            .filter(r => {
              const rating = Number(r.rating);
              // Reviews use 0–10; treat 7+ as a strong positive signal.
              return Number.isFinite(rating) && rating >= 7;
            })
            .map(r => r.title || r.movieTitle || r.movie?.title)
            .filter(Boolean);
        }
        if (!cancelled) setTasteProfile({ watchlistTitles, likedTitles });
      } catch {
        /* personalization is optional — ignore failures */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const moodData = MOODS.find(m => m.name === selectedMood);
    if (moodData) {
      setBgPoster(moodData.bgPoster);
      setPrimaryColor(moodData.color);
      document.documentElement.style.setProperty('--primary-color', moodData.color);
      document.documentElement.style.setProperty('--accent-color', moodData.accentColor);
    }
  }, [selectedMood]);

  const callLLM = useCallback(async (messages, temperature = 0.75, maxTokens = 1600, { json = false } = {}) => {
    const res = await fetch(apiUrl('/api/gpt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature, max_tokens: maxTokens, json }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    return data.reply || '';
  }, []);

  async function handleSearch(e, overrideQuery) {
    e?.preventDefault?.();
    const cleaned = (overrideQuery ?? input).replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      setError('Enter a prompt or question.');
      return;
    }
    setError('');
    setLoading(true);
    setMovies([]);

    try {
      if (mode === 'ask') {
        const taste = buildTasteHintFromHistory(loadHistory(), tasteProfile);
        const systemContent = taste
          ? `${ASK_SYSTEM}\n\nSoft personalization context (do not invent watch history):\n${taste}`
          : ASK_SYSTEM;
        // Keep last 16 turns + system so long chats stay contextual without unbounded payloads.
        const prior = askMessages.slice(-16).map(m => ({ role: m.role, content: m.content }));
        const msgs = [
          { role: 'system', content: systemContent },
          ...prior,
          { role: 'user', content: cleaned },
        ];
        const reply = await callLLM(msgs, 0.65, 2200);
        const next = [...askMessages, { role: 'user', content: cleaned }, { role: 'assistant', content: reply }];
        setAskMessages(next);
        setInput('');
        setHistory(saveHistory({ mode: 'ask', query: cleaned, preview: reply.slice(0, 120) }));
        return;
      }

      const tasteHint = buildTasteHintFromHistory(loadHistory(), tasteProfile);
      const messages = [
        { role: 'system', content: DISCOVER_SYSTEM(selectedMood, tasteHint) },
        { role: 'user', content: cleaned },
      ];
      // JSON mode + lower token budget = fewer retries and faster generation.
      let raw = await callLLM(messages, 0.55, 700, { json: true });
      let list;
      try {
        list = parseMoviesJson(raw);
      } catch {
        messages[0].content += '\nReturn ONLY the JSON object with a "movies" array.';
        raw = await callLLM(messages, 0.3, 700, { json: true });
        list = parseMoviesJson(raw);
      }

      // Show AI titles immediately; posters fill in as TMDB resolves (perceived speed).
      const provisional = list.slice(0, 5).map((item, i) => ({
        id: `pending-${i}`,
        title: item.title || 'Film',
        year: item.year || '',
        posterUrl: null,
        rating: 0,
        reason: item.reason || '',
        director: item.director || '',
        genre: item.genre || '',
        pending: true,
      }));
      setMovies(provisional);
      setLoading(false);

      let enriched = await enrichWithTmdb(list, partial => {
        if (partial.length) setMovies(partial);
      });
      if (enriched.length === 0 && selectedMood !== 'Any') {
        const retry = [
          { role: 'system', content: DISCOVER_SYSTEM('Any', tasteHint) },
          { role: 'user', content: cleaned },
        ];
        const raw2 = await callLLM(retry, 0.5, 700, { json: true });
        list = parseMoviesJson(raw2);
        enriched = await enrichWithTmdb(list, partial => {
          if (partial.length) setMovies(partial);
        });
      }

      setMovies(enriched);
      setHistory(
        saveHistory({
          mode: 'discover',
          query: cleaned,
          mood: selectedMood,
          preview: enriched.map(m => m.title).join(', '),
          movieIds: enriched.map(m => m.id),
        })
      );
      if (enriched.length === 0) setError('Could not match titles on TMDB. Try a more specific film or director name.');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function restoreHistory(item) {
    setInput(item.query);
    setMode(item.mode || 'discover');
    if (item.mood) setSelectedMood(item.mood);
    if (item.mode === 'ask') {
      setAskMessages([]);
      setMovies([]);
    } else {
      setMovies([]);
      // Auto-trigger search for discover mode
      if (item.query) {
        handleSearch(null, item.query);
      }
    }
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  const pill = (active) => ({
    padding: '0.45rem 1rem',
    borderRadius: 'var(--vc-radius-pill)',
    border: active ? '1px solid var(--vc-gold)' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(212,175,55,0.15)' : 'var(--vc-bg-elevated)',
    color: active ? 'var(--vc-gold-light)' : 'var(--vc-slate)',
    fontFamily: 'var(--vc-font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--vc-transition)',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)', position: 'relative' }}>
      <Navbar />

      {/* Mood Background - using romantic poster as default */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'url(/in-the-mood-for-love.jpeg) center center / cover no-repeat',
        filter: 'blur(3px) brightness(0.6) saturate(1.1)',
        transition: 'filter 1s',
      }} aria-hidden="true" />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.4) 100%)',
        mixBlendMode: 'multiply', pointerEvents: 'none',
      }} aria-hidden="true" />

      <section style={{
        position: 'relative', zIndex: 10,
        paddingTop: '6rem',
        paddingBottom: '3rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="vc-container">
          <span className="vc-section-label">AI · Cinema Intelligence</span>
          <h1 style={{
            fontFamily: 'var(--vc-font-display)',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
          }}>
            Find films by <em style={{ color: 'var(--vc-gold)', fontStyle: 'italic' }}>feeling</em>
          </h1>
          <p style={{ fontFamily: 'var(--vc-font-body)', color: 'var(--vc-slate)', maxWidth: 620, marginBottom: '1.5rem' }}>
            Discover by mood and craft — or Ask Expert about directors, theory, endings, and filmmaking. Cinema-first intelligence on GPT-4o-mini.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button type="button" style={pill(mode === 'discover')} onClick={() => setMode('discover')}>Discover</button>
            <button type="button" style={pill(mode === 'ask')} onClick={() => setMode('ask')}>Ask expert</button>
          </div>

          {mode === 'discover' && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {MOODS.map(m => (
                  <button key={m.name} type="button" style={pill(selectedMood === m.name)} onClick={() => setSelectedMood(m.name)} title={m.desc}>
                    {m.name}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', maxWidth: 720, marginBottom: '0.75rem' }}>
                <input
                  className="vc-input"
                  style={{ flex: 1 }}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="e.g. gritty 70s crime films with jazz scores…"
                  disabled={loading}
                />
                <button type="submit" className="vc-btn vc-btn-primary" disabled={loading || !input.trim()}>
                  {loading ? '…' : 'Discover'}
                </button>
              </form>
            </>
          )}

          {!movies.length && !loading && mode === 'discover' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => { setInput(ex); handleSearch(null, ex); }}
                  style={{
                    ...pill(false),
                    fontSize: '0.72rem',
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--vc-red)', fontFamily: 'var(--vc-font-body)', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>
          )}
        </div>
      </section>

      <div className="vc-container discover-layout" style={{ display: 'grid', gridTemplateColumns: showHistory ? 'minmax(0,1fr) 280px' : '1fr', gap: '2rem', paddingTop: '2.5rem', paddingBottom: '4rem', position: 'relative', zIndex: 20 }}>
        <div>
          {mode === 'ask' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
              {/* Search input at top */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  className="vc-input"
                  style={{ flex: 1 }}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about movies, directors, or cinema…"
                  disabled={loading}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                />
                <button 
                  type="button" 
                  className="vc-btn vc-btn-primary" 
                  disabled={loading || !input.trim()}
                  onClick={e => handleSearch(e)}
                >
                  {loading ? '…' : 'Ask'}
                </button>
                {askMessages.length > 0 && (
                  <button 
                    type="button" 
                    className="vc-btn vc-btn-outline" 
                    onClick={() => setAskMessages([])}
                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                  >
                    New
                  </button>
                )}
              </div>

              {/* Chat conversation below */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {askMessages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--vc-slate)' }}>
                    <p style={{ fontFamily: 'var(--vc-font-body)', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--vc-cream)' }}>
                      Ask a film scholar
                    </p>
                    <p style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Endings, directors, craft, theory, world cinema — follow-ups keep the same thread.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                      {ASK_EXAMPLES.map(ex => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => { setInput(ex); handleSearch(null, ex); }}
                          style={{ ...pill(false), fontSize: '0.72rem' }}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {askMessages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: '1rem',
                      padding: '1rem 1.25rem',
                      borderRadius: 'var(--vc-radius-lg)',
                      background: m.role === 'user' ? 'rgba(212,175,55,0.08)' : 'var(--vc-bg-card)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginLeft: m.role === 'user' ? '2rem' : '0',
                      marginRight: m.role === 'assistant' ? '2rem' : '0',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vc-gold)', marginBottom: '0.45rem' }}>
                      {m.role === 'user' ? 'You' : 'CineShelf AI'}
                    </div>
                    {m.role === 'assistant' ? (
                      <CinemaMarkdown content={m.content} />
                    ) : (
                      <div style={{ fontFamily: 'var(--vc-font-body)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    )}
                  </div>
                ))}
                {!loading && askMessages.length > 0 && askMessages[askMessages.length - 1]?.role === 'assistant' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', margin: '0.25rem 0 1rem' }}>
                    {ASK_FOLLOWUPS.map(q => (
                      <button
                        key={q}
                        type="button"
                        disabled={loading}
                        onClick={() => handleSearch(null, q)}
                        style={{ ...pill(false), fontSize: '0.7rem' }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {loading && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--vc-slate)' }}>
                    Reading the scene…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {mode === 'discover' && loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--vc-slate)' }}>Finding films…</div>
          )}

          {mode === 'discover' && movies.length > 0 && (
            <>
              <span className="vc-section-label">Results</span>
              <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1.75rem', marginBottom: '1.25rem' }}>Your picks</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                {movies.map(m => {
                  const card = (
                    <div className="vc-poster-card" style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--vc-bg-card)', opacity: m.pending ? 0.72 : 1 }}>
                      <div style={{ aspectRatio: '2/3', position: 'relative', background: 'rgba(255,255,255,0.04)' }}>
                        {m.posterUrl ? (
                          <img
                            src={m.posterUrl}
                            alt={m.title}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.72rem', color: 'var(--vc-slate)', padding: '0.75rem', textAlign: 'center',
                          }}>
                            Matching poster…
                          </div>
                        )}
                        {m.rating > 0 && (
                          <span style={{
                            position: 'absolute', top: 8, right: 8,
                            background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: 4,
                            fontSize: '0.68rem', color: 'var(--vc-gold)', fontWeight: 700,
                          }}>★ {m.rating.toFixed(1)}</span>
                        )}
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ fontFamily: 'var(--vc-font-display)', fontSize: '0.9rem', color: 'var(--vc-cream)', fontWeight: 700 }}>{m.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--vc-slate)', marginTop: 2 }}>
                          {[m.year, m.director, m.genre].filter(Boolean).join(' · ')}
                        </div>
                        {m.reason && <p style={{ fontSize: '0.72rem', color: 'var(--vc-slate)', marginTop: '0.35rem', lineHeight: 1.4 }}>{m.reason}</p>}
                      </div>
                    </div>
                  );
                  if (m.pending || !m.id || String(m.id).startsWith('pending-')) {
                    return <div key={m.id}>{card}</div>;
                  }
                  return (
                    <Link key={m.id} to={`/movie/${m.id}`} style={{ textDecoration: 'none' }}>
                      {card}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside style={{ borderLeft: showHistory ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingLeft: showHistory ? '1rem' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="vc-section-label">History</span>
            <button type="button" onClick={() => setShowHistory(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--vc-slate)', cursor: 'pointer', fontSize: '0.75rem' }}>
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>
          {showHistory && (
            <>
              {history.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--vc-slate)' }}>Past searches and questions appear here.</p>
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '70vh', overflowY: 'auto' }}>
                {history.map(h => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => restoreHistory(h)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '0.65rem 0',
                        background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer', color: 'var(--vc-cream)',
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: 'var(--vc-gold)', textTransform: 'uppercase' }}>{h.mode} {h.mood && h.mood !== 'Any' ? `· ${h.mood}` : ''}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, marginTop: 2 }}>{h.query}</div>
                      {h.preview && <div style={{ fontSize: '0.7rem', color: 'var(--vc-slate)', marginTop: 2 }}>{h.preview}</div>}
                    </button>
                  </li>
                ))}
              </ul>
              {history.length > 0 && (
                <button type="button" onClick={clearHistory} style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--vc-slate)', fontSize: '0.75rem', cursor: 'pointer' }}>
                  Clear history
                </button>
              )}
            </>
          )}
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .discover-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
