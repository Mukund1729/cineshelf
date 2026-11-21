import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Chat from '../components/Chat';
import { apiUrl } from '../api/config';
import { hasAuthSession } from '../api/session';
import './People.css';

function PersonAvatar({ person, size = 48 }) {
  const [broken, setBroken] = useState(false);
  const src = person?.avatar
    ? (person.avatar.startsWith('/') ? apiUrl(person.avatar) : person.avatar)
    : '';
  const label = person?.username || person?.name || 'U';

  if (src && !broken) {
    return (
      <img
        className="vc-people-avatar"
        src={src}
        alt=""
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className="vc-people-avatar-fallback" style={{ width: size, height: size }} aria-hidden="true">
      {label[0].toUpperCase()}
    </span>
  );
}

function FriendCard({ person, onRemove, onRequest, isFriend, isPending, onChat }) {
  const profilePath = `/people/${person._id}`;
  const displayName = person.name || person.username || 'User';

  return (
    <div className="vc-people-card">
      <Link to={profilePath} aria-label={`View ${displayName}'s profile`}>
        <PersonAvatar person={person} />
      </Link>
      <div className="vc-people-meta">
        <Link to={profilePath} className="vc-people-name">{displayName}</Link>
        {person.username && <div className="vc-people-handle">@{person.username}</div>}
        {person.bio && <div className="vc-people-bio">{person.bio}</div>}
      </div>
      <div className="vc-people-actions">
        {isFriend ? (
          <>
            <button type="button" className="vc-btn vc-btn-outline" onClick={() => onChat(person)}>
              Chat
            </button>
            <button type="button" className="vc-btn vc-btn-danger" onClick={() => onRemove(person._id)}>
              Remove
            </button>
          </>
        ) : isPending ? (
          <span className="vc-badge vc-badge-slate">Pending</span>
        ) : (
          <button type="button" className="vc-btn vc-btn-outline" onClick={() => onRequest(person._id)}>
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
  const displayName = person?.name || person?.username || 'User';

  return (
    <div className="vc-people-card is-request">
      <Link to={profilePath} aria-label={`View ${displayName}'s profile`}>
        <PersonAvatar person={person} size={44} />
      </Link>
      <div className="vc-people-meta">
        <Link to={profilePath} className="vc-people-name">{displayName}</Link>
        {person?.username && <div className="vc-people-handle">@{person.username}</div>}
        <div className="vc-people-request-label">Friend request</div>
      </div>
      <div className="vc-people-actions">
        <button type="button" className="vc-btn vc-btn-primary" onClick={() => onAccept(request._id)}>
          Accept
        </button>
        <button type="button" className="vc-btn vc-btn-ghost" onClick={() => onReject(request._id)}>
          Decline
        </button>
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
    if (!hasAuthSession()) {
      setError('Please sign in.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        axios.get('/api/people/sakha', { headers, withCredentials: true }),
        axios.get('/api/people/requests', { headers, withCredentials: true }),
      ]);
      setFriends(friendsRes.data?.data || []);
      setRequests(requestsRes.data?.data || []);
      setError(null);
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
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get('/api/people/search', {
          headers,
          params: { q: searchQuery },
          withCredentials: true,
        });
        setSearchResults(res.data?.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const sendRequest = async userId => {
    try {
      await axios.post('/api/people/request', { userId }, { headers, withCredentials: true });
      showToast('Friend request sent!');
      setSearchResults(prev => prev.map(person => (
        person._id === userId ? { ...person, relation: 'outgoing' } : person
      )));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send request.');
    }
  };

  const acceptRequest = async requestId => {
    try {
      await axios.post(`/api/people/request/${requestId}/accept`, {}, { headers, withCredentials: true });
      showToast('Request accepted!');
      fetchData();
    } catch {
      showToast('Failed to accept.');
    }
  };

  const rejectRequest = async requestId => {
    try {
      await axios.post(`/api/people/request/${requestId}/reject`, {}, { headers, withCredentials: true });
      setRequests(prev => prev.filter(r => r._id !== requestId));
      showToast('Request declined.');
    } catch {
      showToast('Failed to decline.');
    }
  };

  const removeFriend = async userId => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await axios.delete(`/api/people/sakha/${userId}`, { headers, withCredentials: true });
      setFriends(prev => prev.filter(f => f._id !== userId));
      showToast('Friend removed.');
    } catch {
      showToast('Failed to remove.');
    }
  };

  const handleChat = friend => setChatFriend(friend);

  const closeChat = () => {
    setChatFriend(null);
    if (location.search) navigate('/people', { replace: true });
  };

  const friendIds = friends.map(f => f._id);

  return (
    <div className="vc-people-page">
      <Navbar />

      <section className="vc-people-hero">
        <div className="vc-container">
          <span className="vc-section-label">Community</span>
          <h1>Your People</h1>
          <p>Connect with fellow cinephiles, share recommendations, and chat about cinema.</p>
        </div>
      </section>

      <div className="vc-container vc-people-body">
        {error ? (
          <div className="vc-people-auth">
            <p>{error}</p>
            <button
              type="button"
              className="vc-btn vc-btn-primary"
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="vc-people-layout">
            <div className="vc-people-main">
              {requests.length > 0 && (
                <section style={{ marginBottom: '2.25rem' }}>
                  <h2 className="vc-people-section-title">
                    Requests <span className="is-accent">({requests.length})</span>
                  </h2>
                  <div className="vc-people-stack">
                    {requests.map(req => (
                      <RequestCard
                        key={req._id}
                        request={req}
                        onAccept={acceptRequest}
                        onReject={rejectRequest}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="vc-people-section-title">
                  Friends <span>({friends.length})</span>
                </h2>

                {loading ? (
                  <div className="vc-people-stack">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="vc-people-card">
                        <div className="vc-skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                        <div style={{ flex: 1 }}>
                          <div className="vc-skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                          <div className="vc-skeleton" style={{ height: 12, width: '60%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : friends.length === 0 ? (
                  <div className="vc-people-empty">
                    No friends yet. Search for people to connect with.
                  </div>
                ) : (
                  <div className="vc-people-stack">
                    {friends.map(friend => (
                      <FriendCard
                        key={friend._id}
                        person={friend}
                        isFriend
                        onRemove={removeFriend}
                        onChat={handleChat}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="vc-people-search">
              <h3>Find People</h3>
              <input
                type="search"
                className="vc-input"
                placeholder="Search by username or name…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search people"
              />
              {searching && <div className="vc-people-search-status">Searching…</div>}
              {searchResults.length > 0 && (
                <div className="vc-people-stack">
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
                <div className="vc-people-search-status">
                  No users found for “{searchQuery}”
                </div>
              )}
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
          friendLastActive={chatFriend.lastActive}
          onClose={closeChat}
        />
      )}
    </div>
  );
}
