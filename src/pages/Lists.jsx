import { tmdbImageUrl } from '../api/tmdb';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { hasAuthSession } from '../api/session';

function ListCard({ list, onSelect, selected }) {
  return (
    <div
      onClick={() => onSelect(list)}
      style={{
        background: selected ? 'var(--vc-bg-elevated)' : 'var(--vc-bg-card)',
        border: `1px solid ${selected ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '10px',
        padding: '1rem 1.25rem',
        cursor: 'pointer',
        transition: 'all 200ms',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: list.coverImage ? `url(${list.coverImage}) center/cover` : 'var(--vc-bg-elevated)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem',
      }}>
        {!list.coverImage && '📋'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 600, color: 'var(--vc-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {list.name}
        </div>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
          {list.items?.length || 0} film{list.items?.length !== 1 ? 's' : ''} · {list.isPublic ? '🌐 Public' : '🔒 Private'}
        </div>
      </div>
    </div>
  );
}

function MoviePosterMini({ item, onRemove }) {
  return (
    <div style={{ position: 'relative', width: '90px' }}>
      <Link to={`/movie/${item.tmdbId}`} style={{ textDecoration: 'none', display: 'block' }}>
        {item.poster ? (
          <img src={tmdbImageUrl(item.poster, 'w185')} alt={item.title} style={{ width: 90, height: 135, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
        ) : (
          <div style={{ width: 90, height: 135, borderRadius: 8, background: 'var(--vc-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎬</div>
        )}
      </Link>
      <button
        onClick={() => onRemove(item.tmdbId)}
        style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(0,0,0,0.7)', border: 'none',
          borderRadius: '50%', width: 20, height: 20,
          color: '#fff', cursor: 'pointer', fontSize: '0.65rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
      <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', color: 'var(--vc-slate)', marginTop: '0.25rem', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.title}
      </div>
    </div>
  );
}

export default function Lists() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPublic, setCreatePublic] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchLists = async () => {
    if (!hasAuthSession()) { setError('Please sign in.'); setLoading(false); return; }
    try {
      const res = await axios.get('/api/lists', { headers });
      const data = res.data?.data || [];
      setLists(data);
      if (data.length > 0 && !selectedList) setSelectedList(data[0]);
    } catch {
      setError('Failed to load lists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLists(); }, []);

  useEffect(() => {
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      axios.get('/api/tmdb/search', { params: { query: searchQ, type: 'multi', page: 1 } })
        .then(res => setSearchResults((res.data?.results || []).slice(0, 8)))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setSaving(true);
    try {
      const res = await axios.post('/api/lists', { name: createName, description: createDesc, isPublic: createPublic }, { headers });
      const newList = res.data?.data;
      setLists(prev => [newList, ...prev]);
      setSelectedList(newList);
      setCreateName(''); setCreateDesc(''); setCreatePublic(true);
      setShowCreate(false);
      showToast('List created!');
    } catch { showToast('Failed to create list.'); }
    finally { setSaving(false); }
  };

  const handleDeleteList = async () => {
    if (!selectedList || !window.confirm(`Delete "${selectedList.name}"?`)) return;
    try {
      await axios.delete(`/api/lists/${selectedList._id}`, { headers });
      const remaining = lists.filter(l => l._id !== selectedList._id);
      setLists(remaining);
      setSelectedList(remaining[0] || null);
      showToast('List deleted.');
    } catch { showToast('Failed to delete.'); }
  };

  const handleAddMovie = async (movie) => {
    if (!selectedList) return;
    setSaving(true);
    try {
      const res = await axios.post(`/api/lists/${selectedList._id}/items`, {
        tmdbId: movie.id,
        title: movie.title || movie.name,
        poster: movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w342') : '',
        overview: movie.overview || '',
        releaseDate: movie.release_date || movie.first_air_date || '',
        voteAverage: movie.vote_average || 0,
        mediaType: movie.media_type || 'movie',
      }, { headers });
      setSelectedList(res.data?.data);
      setLists(prev => prev.map(l => l._id === selectedList._id ? res.data?.data : l));
      setShowAddMovie(false);
      setSearchQ('');
      setSearchResults([]);
      showToast('Added to list!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add.');
    } finally { setSaving(false); }
  };

  const handleRemoveMovie = async (tmdbId) => {
    if (!selectedList) return;
    try {
      const res = await axios.delete(`/api/lists/${selectedList._id}/items/${tmdbId}`, { headers });
      setSelectedList(res.data?.data);
      setLists(prev => prev.map(l => l._id === selectedList._id ? res.data?.data : l));
      showToast('Removed.');
    } catch { showToast('Failed to remove.'); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      <section style={{ padding: '4rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="vc-section-label">Collections</span>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900 }}>Your Lists</h1>
          </div>
          <button className="vc-btn vc-btn-primary" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancel' : '+ New List'}
          </button>
        </div>
      </section>

      {/* Create list form */}
      {showCreate && (
        <div style={{ background: 'var(--vc-bg-surface)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem 0' }}>
          <div className="vc-container" style={{ maxWidth: '560px' }}>
            <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', marginBottom: '0.25rem' }}>Create New List</h3>
              <input className="vc-input" placeholder="List name (required)" value={createName} onChange={e => setCreateName(e.target.value)} required />
              <textarea className="vc-input vc-textarea" style={{ minHeight: 80 }} placeholder="Description (optional)" value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--vc-slate)' }}>
                <input type="checkbox" checked={createPublic} onChange={e => setCreatePublic(e.target.checked)} />
                Public list (visible to others)
              </label>
              <button type="submit" className="vc-btn vc-btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create List'}</button>
            </form>
          </div>
        </div>
      )}

      <div className="vc-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
            <p style={{ marginBottom: '1.5rem' }}>{error}</p>
            <button className="vc-btn vc-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>Sign In</button>
          </div>
        ) : loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1,2,3].map(i => <div key={i} className="vc-skeleton" style={{ height: 72, borderRadius: 10 }} />)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {[1,2,3,4,5,6].map(i => <div key={i} className="vc-skeleton" style={{ width: 90, height: 135, borderRadius: 8 }} />)}
            </div>
          </div>
        ) : lists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--vc-slate)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', color: 'var(--vc-cream)', marginBottom: '0.5rem' }}>No lists yet.</p>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', marginBottom: '2rem' }}>Create your first curated list above.</p>
            <button className="vc-btn vc-btn-primary" onClick={() => setShowCreate(true)}>+ Create a List</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' }}>
            {/* Sidebar: list of lists */}
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lists.map(list => (
                  <ListCard key={list._id} list={list} onSelect={setSelectedList} selected={selectedList?._id === list._id} />
                ))}
              </div>
            </div>

            {/* Main: selected list contents */}
            {selectedList && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', marginBottom: '0.25rem' }}>{selectedList.name}</h2>
                    {selectedList.description && (
                      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', margin: 0 }}>{selectedList.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="vc-badge vc-badge-slate">{selectedList.isPublic ? '🌐 Public' : '🔒 Private'}</span>
                      <span className="vc-badge vc-badge-slate">{selectedList.items?.length || 0} films</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="vc-btn vc-btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }} onClick={() => setShowAddMovie(v => !v)}>
                      + Add Film
                    </button>
                    <button className="vc-btn vc-btn-danger" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }} onClick={handleDeleteList}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Add movie search */}
                {showAddMovie && (
                  <div style={{ background: 'var(--vc-bg-surface)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <input
                      className="vc-input"
                      placeholder="Search for a film to add…"
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      autoFocus
                      style={{ marginBottom: '0.75rem' }}
                    />
                    {searchResults.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
                        {searchResults.map(movie => (
                          <div
                            key={movie.id}
                            onClick={() => handleAddMovie(movie)}
                            style={{ cursor: 'pointer', textAlign: 'center' }}
                          >
                            {movie.poster_path ? (
                              <img src={tmdbImageUrl(movie.poster_path, 'w185')} alt={movie.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 8, border: '2px solid transparent', transition: 'border-color 200ms' }}
                                onMouseEnter={e => e.target.style.borderColor = 'var(--vc-gold)'}
                                onMouseLeave={e => e.target.style.borderColor = 'transparent'}
                              />
                            ) : (
                              <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--vc-bg-elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--vc-slate)', padding: '0.5rem', textAlign: 'center' }}>{movie.title}</div>
                            )}
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', color: 'var(--vc-slate)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {movie.title} {movie.release_date ? `(${movie.release_date.slice(0, 4)})` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Films in list */}
                {!selectedList.items?.length ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--vc-slate)', background: 'var(--vc-bg-card)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>No films in this list yet. Click "+ Add Film" to start.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {selectedList.items.map(item => (
                      <MoviePosterMini key={item.tmdbId} item={item} onRemove={handleRemoveMovie} />
                    ))}
                  </div>
                )}
              </div>
            )}
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
