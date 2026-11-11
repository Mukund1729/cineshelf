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
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    fetchAdminData();
  }, []);

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

  const TABS = ['overview', 'users', 'picks'];

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

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem' }}>
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
