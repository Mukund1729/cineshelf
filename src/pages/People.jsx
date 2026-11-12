import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Chat from '../components/Chat';
import { apiUrl } from '../api/config';

function FriendCard({ person, onRemove, onRequest, isFriend, isPending, onChat }) {
  const profilePath = `/people/${person._id}`;

  return (
    <div style={{
      background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
      transition: 'border-color 200ms',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
    >
      <Link to={profilePath} aria-label={`View ${person.username || person.name}'s profile`} style={{ flexShrink: 0 }}>
        {person.avatar ? (
          <img src={person.avatar.startsWith('/') ? apiUrl(person.avatar) : person.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--vc-gold), #b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, color: '#0a0f1a' }}>
            {(person.username || person.name || 'U')[0].toUpperCase()}
          </div>
        )}
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={profilePath} style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.95rem', color: 'var(--vc-cream)', textDecoration: 'none' }}>
          {person.username || person.name}
        </Link>
        {person.bio && (
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: 'var(--vc-slate)', lineHeight: 1.4, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.bio}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: '0.5rem' }}>
        {isFriend ? (
          <>
            <button 
              className="vc-btn vc-btn-outline" 
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} 
              onClick={() => onChat(person)}
            >
              Chat
            </button>
            <button className="vc-btn vc-btn-danger" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => onRemove(person._id)}>
              Remove
            </button>
          </>
        ) : isPending ? (
          <span className="vc-badge vc-badge-slate">Pending</span>
        ) : (
          <button className="vc-btn vc-btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => onRequest(person._id)}>
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

function RequestCard({ request, onAccept, onReject }) {
  const person = request.from;
  const profilePath = `/people/${person?._id || ''}`;

  return (
    <div style={{
      background: 'var(--vc-bg-card)', border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <Link to={profilePath} aria-label={`View ${person?.username || 'user'}'s profile`} style={{ flexShrink: 0 }}>
        {person?.avatar ? (
          <img src={person.avatar.startsWith('/') ? apiUrl(person.avatar) : person.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--vc-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: '#0a0f1a' }}>
            {(person?.username || 'U')[0].toUpperCase()}
          </div>
        )}
      </Link>
      <div style={{ flex: 1 }}>
        <Link to={profilePath} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', color: 'var(--vc-cream)', fontWeight: 600, textDecoration: 'none' }}>{person?.username}</Link>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-gold)' }}>Friend request</div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="vc-btn vc-btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => onAccept(request._id)}>Accept</button>
        <button className="vc-btn vc-btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => onReject(request._id)}>Decline</button>
      </div>
    </div>
  );
}

export default function People() {
  const location = useLocation();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');
  const [chatFriend, setChatFriend] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    if (!token) { setError('Please sign in.'); setLoading(false); return; }
    setLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        axios.get('/api/people/sakha', { headers }),
        axios.get('/api/people/requests', { headers }),
      ]);
      setFriends(friendsRes.data?.data || []);
      setRequests(requestsRes.data?.data || []);
    } catch (err) {
      if (err.response?.status === 401) setError('Please sign in to view your people.');
      else setError('Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const requestedChatId = new URLSearchParams(location.search).get('chat');
    if (!requestedChatId || loading) return;
    const friend = friends.find(person => person._id === requestedChatId);
    if (friend) setChatFriend(friend);
  }, [location.search, friends, loading]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get('/api/people/search', { headers, params: { q: searchQuery } });
        setSearchResults(res.data?.data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sendRequest = async (userId) => {
    try {
      await axios.post('/api/people/request', { userId }, { headers });
      showToast('Friend request sent!');
      setSearchResults(prev => prev.map(person => (
        person._id === userId ? { ...person, relation: 'outgoing' } : person
      )));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send request.');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await axios.post(`/api/people/request/${requestId}/accept`, {}, { headers });
      showToast('Request accepted!');
      fetchData();
    } catch { showToast('Failed to accept.'); }
  };

  const rejectRequest = async (requestId) => {
    try {
      await axios.post(`/api/people/request/${requestId}/reject`, {}, { headers });
      setRequests(prev => prev.filter(r => r._id !== requestId));
      showToast('Request declined.');
    } catch { showToast('Failed to decline.'); }
  };

  const removeFriend = async (userId) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await axios.delete(`/api/people/sakha/${userId}`, { headers });
      setFriends(prev => prev.filter(f => f._id !== userId));
      showToast('Friend removed.');
    } catch { showToast('Failed to remove.'); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleChat = (friend) => {
    setChatFriend(friend);
  };

  const closeChat = () => {
    setChatFriend(null);
    if (location.search) navigate('/people', { replace: true });
  };

  const friendIds = friends.map(f => f._id);

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
          <span className="vc-section-label">👥 Community</span>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
          }}>
            Your People
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: 560, marginBottom: '1.5rem' }}>
            Connect with fellow cinephiles, share recommendations, and chat about cinema.
          </p>
        </div>
      </section>

      <div className="vc-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        {error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
            <p style={{ marginBottom: '1.5rem' }}>{error}</p>
            <button className="vc-btn vc-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>Sign In</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
            {/* Left: Friends + Requests */}
            <div>
              {/* Pending requests */}
              {requests.length > 0 && (
                <div style={{ marginBottom: '2.5rem' }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--vc-cream)' }}>
                    Requests <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-gold)' }}>({requests.length})</span>
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {requests.map(req => (
                      <RequestCard key={req._id} request={req} onAccept={acceptRequest} onReject={rejectRequest} />
                    ))}
                  </div>
                </div>
              )}

              {/* Friends */}
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--vc-cream)' }}>
                Friends <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)' }}>({friends.length})</span>
              </h2>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ background: 'var(--vc-bg-card)', borderRadius: 12, padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div className="vc-skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                      <div style={{ flex: 1 }}>
                        <div className="vc-skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                        <div className="vc-skeleton" style={{ height: 12, width: '60%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : friends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--vc-slate)', background: 'var(--vc-bg-card)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎬</div>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>No friends yet. Search for people to connect with.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {friends.map(friend => (
                    <FriendCard key={friend._id} person={friend} isFriend onRemove={removeFriend} onChat={handleChat} />
                  ))}
                </div>
              )}
            </div>

            {/* Right: Search */}
            <aside>
              <div style={{ background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', position: 'sticky', top: '80px' }}>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', marginBottom: '1rem', color: 'var(--vc-cream)' }}>
                  Find People
                </h3>
                <input
                  type="text"
                  className="vc-input"
                  placeholder="Search by username or name…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ marginBottom: '1rem' }}
                />
                {searching && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem' }}>Searching…</div>
                )}
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {searchResults.map(person => (
                      <FriendCard
                        key={person._id}
                        person={person}
                        isFriend={person.relation === 'friend' || friendIds.includes(person._id)}
                        isPending={person.relation === 'outgoing' || person.relation === 'incoming'}
                        onRequest={sendRequest}
                        onRemove={removeFriend}
                        onChat={handleChat}
                      />
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--vc-slate)', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem' }}>
                    No users found for "{searchQuery}"
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      {toast && (
        <div className="vc-toast">
          <div className="vc-toast-item vc-toast-info">{toast}</div>
        </div>
      )}

      {chatFriend && (
        <Chat
          friendId={chatFriend._id}
          friendName={chatFriend.username || chatFriend.name}
          friendAvatar={chatFriend.avatar}
          onClose={closeChat}
        />
      )}
    </div>
  );
}
