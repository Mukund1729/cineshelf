import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [journalStatus, setJournalStatus] = useState(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalSyncing, setJournalSyncing] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    fetchAdminData();
  }, []);

  useEffect(() => {
    if (tab === 'journal') fetchJournalStatus();
  }, [tab]);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get('/api/admin/stats', { headers }),
        axios.get('/api/admin/users', { headers }),
      ]);
      setStats(statsRes.data?.data || statsRes.data);
      setUsers(usersRes.data?.data || usersRes.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else {
        setError('Failed to load admin data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchJournalStatus = async () => {
    setJournalLoading(true);
    setJournalError('');
    try {
      const response = await axios.get('/api/journal/admin/status', { headers });
      setJournalStatus(response.data?.data || null);
    } catch (requestError) {
      setJournalError(requestError.response?.data?.error || 'Failed to load Journal sync status.');
    } finally {
      setJournalLoading(false);
    }
  };

  const handleJournalSync = async () => {
    setJournalSyncing(true);
    setJournalError('');
    try {
      const response = await axios.post('/api/journal/admin/sync', {}, { headers });
      setJournalStatus(previous => ({ ...previous, ...(response.data?.data || {}) }));
      showToast('Medium RSS synchronization completed.');
      await fetchJournalStatus();
    } catch (requestError) {
      setJournalError(requestError.response?.data?.error || 'Medium synchronization failed.');
      await fetchJournalStatus();
    } finally {
      setJournalSyncing(false);
    }
  };

  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, { isAdmin: !currentIsAdmin }, { headers });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isAdmin: !currentIsAdmin } : u));
      showToast(`Admin status ${!currentIsAdmin ? 'granted' : 'revoked'}.`);
    } catch { showToast('Failed to update user.'); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Permanently delete this user?')) return;
    try {
      await axios.delete(`/api/admin/users/${userId}`, { headers });
      setUsers(prev => prev.filter(u => u._id !== userId));
      showToast('User deleted.');
    } catch { showToast('Failed to delete user.'); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filteredUsers = users.filter(u =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = ['overview', 'users', 'picks', 'journal'];

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <div className="vc-container" style={{ paddingTop: '5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', marginBottom: '1rem' }}>Access Denied</h1>
        <p style={{ color: 'var(--vc-slate)', marginBottom: '2rem' }}>{error}</p>
        <Link to="/" className="vc-btn vc-btn-outline">← Back to Home</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* Admin header */}
      <section style={{ padding: '3rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--vc-bg-surface)' }}>
        <div className="vc-container">
          <span className="vc-section-label">Administration</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 900 }}>
            Admin Dashboard
          </h1>
        </div>
      </section>

      {/* Tabs */}
      <div style={{ background: 'var(--vc-bg-surface)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container" style={{ display: 'flex', gap: '0.25rem' }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem',
                color: tab === t ? 'var(--vc-gold)' : 'var(--vc-slate)',
                fontWeight: tab === t ? 700 : 400,
                padding: '1rem 1.25rem',
                borderBottom: tab === t ? '2px solid var(--vc-gold)' : '2px solid transparent',
                textTransform: 'capitalize',
                transition: 'all 200ms',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="vc-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {[1,2,3,4].map(i => <div key={i} className="vc-skeleton" style={{ height: 100, borderRadius: 12 }} />)}
          </div>
        ) : (
          <>
            {/* Overview */}
            {tab === 'overview' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                  {[
                    { label: 'Total Users', value: stats?.totalUsers ?? users.length, icon: '👤' },
                    { label: 'Admin Users', value: stats?.adminUsers ?? users.filter(u => u.isAdmin).length, icon: '⚙' },
                    { label: 'Reviews', value: stats?.totalReviews ?? '—', icon: '📝' },
                    { label: 'Watchlist Items', value: stats?.totalWatchlistItems ?? '—', icon: '📋' },
                    { label: 'Custom Lists', value: stats?.totalLists ?? '—', icon: '🗂' },
                    { label: 'Blog Posts', value: stats?.totalBlogPosts ?? '—', icon: '📰' },
                  ].map((card, i) => (
                    <div key={i} style={{ background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1.5rem' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{card.icon}</div>
                      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 700, color: 'var(--vc-gold)' }}>{card.value}</div>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', color: 'var(--vc-slate)', marginTop: '0.25rem' }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="vc-btn vc-btn-outline" onClick={() => setTab('users')}>Manage Users →</button>
                  <button className="vc-btn vc-btn-outline" onClick={() => setTab('picks')}>Manage Picks →</button>
                </div>
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="vc-input"
                    placeholder="Search users by username or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ maxWidth: '360px' }}
                  />
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)' }}>
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="vc-mobile-table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="vc-mobile-table-admin" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['User', 'Email', 'Joined', 'Admin', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--vc-slate)', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 200ms' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--vc-bg-card)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--vc-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0a0f1a', flexShrink: 0 }}>
                                {(user.username || 'U')[0].toUpperCase()}
                              </div>
                              <span style={{ color: 'var(--vc-cream)', fontWeight: 500 }}>{user.username}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--vc-slate)' }}>{user.email}</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--vc-slate-dark)' }}>
                            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {user.isAdmin
                              ? <span className="vc-badge vc-badge-gold">Admin</span>
                              : <span className="vc-badge vc-badge-slate">User</span>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="vc-btn vc-btn-ghost"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => handleToggleAdmin(user._id, user.isAdmin)}
                              >
                                {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                              <button
                                className="vc-btn vc-btn-danger"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => handleDeleteUser(user._id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Picks */}
            {tab === 'picks' && (
              <div>
                <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginBottom: '1.5rem' }}>
                  Manage Cinematic Picks — curated collections shown on the Picks page.
                </p>
                <Link to="/cinematic-picks" className="vc-btn vc-btn-outline">
                  View Cinematic Picks →
                </Link>
                <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate-dark)', fontSize: '0.82rem', marginTop: '1rem' }}>
                  Picks CRUD management UI coming soon. Use the API directly for now: POST /api/picks (admin token required).
                </p>
              </div>
            )}

            {tab === 'journal' && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <div>
                    <span className="vc-section-label">MongoDB · Medium · Mukund Mangal</span>
                    <h2 style={{ margin: '0.35rem 0', fontFamily: 'Playfair Display, serif' }}>THE JOURNAL</h2>
                    <p style={{ maxWidth: 700, color: 'var(--vc-slate)', lineHeight: 1.65 }}>
                      New Medium stories are synced from RSS hourly. Review community article submissions in the Blog Studio.
                      The public RSS feed only exposes its latest 10 stories, so it cannot backfill older Medium articles.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
                    <Link to="/journal/write" className="vc-btn vc-btn-outline">Open Blog Studio →</Link>
                    <button className="vc-btn vc-btn-gold" onClick={handleJournalSync} disabled={journalSyncing || journalLoading}>
                      {journalSyncing ? 'Syncing…' : 'Sync Medium now'}
                    </button>
                  </div>
                </div>

                {journalError && (
                  <p role="alert" style={{ padding: '0.9rem 1rem', border: '1px solid rgba(255,100,100,.25)', borderRadius: 10, color: '#ffc8c8' }}>
                    {journalError}
                  </p>
                )}
                {journalLoading ? (
                  <div className="vc-skeleton" style={{ height: 190, borderRadius: 12 }} />
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      {[
                        ['Imported articles', journalStatus?.importedArticleCount ?? 0],
                        ['Discovered this sync', journalStatus?.totalDiscovered ?? 0],
                        ['Added / updated', `${journalStatus?.imported ?? 0} / ${journalStatus?.updated ?? 0}`],
                        ['Unchanged / failed', `${journalStatus?.duplicates ?? 0} / ${journalStatus?.failed ?? 0}`],
                        ['Missing images', journalStatus?.missingImages ?? 0],
                        ['Missing metadata', journalStatus?.missingMetadata ?? 0],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '1rem' }}>
                          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', color: 'var(--vc-gold)' }}>{value}</div>
                          <div style={{ color: 'var(--vc-slate)', fontSize: '.78rem' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '1rem', padding: '1rem 1.2rem', background: 'var(--vc-bg-card)', borderRadius: 12, color: 'var(--vc-slate)', lineHeight: 1.8 }}>
                      <div><strong style={{ color: 'var(--vc-cream)' }}>Status:</strong> {journalStatus?.status || 'Not yet synced'}</div>
                      <div><strong style={{ color: 'var(--vc-cream)' }}>Last successful sync:</strong> {journalStatus?.lastSuccessfulSyncAt ? new Date(journalStatus.lastSuccessfulSyncAt).toLocaleString() : 'Not yet synced'}</div>
                      <div><strong style={{ color: 'var(--vc-cream)' }}>Imported date range:</strong> {journalStatus?.oldestImportedArticleAt ? new Date(journalStatus.oldestImportedArticleAt).toLocaleDateString() : 'Unavailable'} – {journalStatus?.newestImportedArticleAt ? new Date(journalStatus.newestImportedArticleAt).toLocaleDateString() : 'Unavailable'}</div>
                      <div><strong style={{ color: 'var(--vc-cream)' }}>Coverage:</strong> Limited to publicly exposed RSS items; lifetime completeness is not verified.</div>
                      {journalStatus?.message && <div style={{ marginTop: '.4rem' }}>{journalStatus.message}</div>}
                    </div>
                    <Link to="/journal" className="vc-btn vc-btn-outline" style={{ display: 'inline-flex', marginTop: '1rem' }}>View THE JOURNAL →</Link>
                  </>
                )}

              </section>
            )}
          </>
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
