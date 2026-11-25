import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import Chat from './Chat';
import { apiUrl } from '../api/config';
import { hasAuthSession } from '../api/session';
import './GlobalChat.css';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function isOnline(lastActive) {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < ONLINE_WINDOW_MS;
}

function formatLastSeen(lastActive) {
  if (!lastActive) return 'Last seen unavailable';
  const then = new Date(lastActive).getTime();
  if (Number.isNaN(then)) return 'Last seen unavailable';
  const diffMs = Date.now() - then;
  if (diffMs < ONLINE_WINDOW_MS) return 'Online';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `Last seen ${minutes < 1 ? 'just now' : `${minutes}m ago`}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${new Date(lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function formatPreviewTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function FriendAvatar({ friend, sizeClass = 'vc-messages-avatar-wrap' }) {
  const [broken, setBroken] = useState(false);
  const avatar = friend.avatar
    ? (friend.avatar.startsWith('/') ? apiUrl(friend.avatar) : friend.avatar)
    : '';
  const name = friend.username || friend.name || 'User';
  const online = isOnline(friend.lastActive);

  return (
    <span className={sizeClass}>
      {avatar && !broken ? (
        <img
          className="vc-messages-avatar"
          src={avatar}
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="vc-messages-avatar-fallback" aria-hidden="true">
          {name[0].toUpperCase()}
        </span>
      )}
      {online && <span className="vc-messages-online-dot" aria-hidden="true" />}
    </span>
  );
}

export default function GlobalChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [pendingChatId, setPendingChatId] = useState('');

  const openInbox = useCallback(() => {
    setOpen(true);
    setSelectedFriend(null);
  }, []);

  const openConversation = useCallback((friendId) => {
    if (!friendId || !hasAuthSession()) return;
    setPendingChatId(String(friendId));
    setOpen(true);
    setLoadVersion(version => version + 1);
  }, []);

  // Notifications and deep links: ?chat=userId or CustomEvent('open-messages')
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('chat');
    if (chatId && /^[a-f\d]{24}$/i.test(chatId)) {
      openConversation(chatId);
      params.delete('chat');
      const next = params.toString();
      navigate(`${location.pathname}${next ? `?${next}` : ''}${location.hash || ''}`, { replace: true });
    }
  }, [location.search, location.pathname, location.hash, navigate, openConversation]);

  useEffect(() => {
    const handler = event => {
      const friendId = event.detail?.friendId;
      if (friendId) openConversation(friendId);
      else openInbox();
    };
    window.addEventListener('open-messages', handler);
    return () => window.removeEventListener('open-messages', handler);
  }, [openConversation, openInbox]);

  // Existing sakha feed powers inbox + activity badge (no new messaging API)
  useEffect(() => {
    if (!hasAuthSession()) {
      setActivityCount(0);
      if (!open) return undefined;
    }

    let active = true;
    const loadFriends = async ({ withSpinner = false } = {}) => {
      if (!hasAuthSession()) return;
      if (withSpinner) {
        setLoading(true);
        setError('');
      }
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/people/sakha', {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        if (!active) return;
        const list = response.data?.data || [];
        setActivityCount(list.filter(friend => friend.lastMessage && !friend.lastMessage.fromMe).length);
        if (open || pendingChatId) setFriends(list);
        if (pendingChatId) {
          const match = list.find(friend => String(friend._id) === String(pendingChatId));
          if (match) {
            setSelectedFriend(match);
            setPendingChatId('');
          }
        }
      } catch (requestError) {
        if (active && open) {
          setError(requestError.response?.data?.error || 'Could not load your friends.');
        }
      } finally {
        if (active && withSpinner) setLoading(false);
      }
    };

    loadFriends({ withSpinner: open });
    const intervalId = window.setInterval(() => loadFriends({ withSpinner: false }), open ? 30000 : 60000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [open, loadVersion, pendingChatId]);

  useEffect(() => {
    // Intentional right-edge swipe only — avoid firing on light carousel scrolls
    const EDGE_ZONE_PX = 28;
    const MIN_SWIPE_PX = 140;
    const HORIZONTAL_RATIO = 2.8;
    let touchStart = null;

    const handleTouchStart = event => {
      if (open || window.innerWidth > 768 || event.touches.length !== 1) {
        touchStart = null;
        return;
      }
      const target = event.target;
      if (
        target instanceof Element
        && target.closest('input, textarea, button, a, [role="button"], .vc-home-poster-row, .vc-mobile-grid, [data-scroll="x"]')
      ) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      // Only begin gesture from the far right edge
      if (touch.clientX < window.innerWidth - EDGE_ZONE_PX) {
        touchStart = null;
        return;
      }
      touchStart = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };

    const handleTouchMove = event => {
      if (!touchStart || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaY = Math.abs(touch.clientY - touchStart.y);
      const deltaX = touchStart.x - touch.clientX;
      // Cancel if user is clearly scrolling vertically
      if (deltaY > 36 && deltaY > deltaX * 0.7) {
        touchStart = null;
      }
    };

    const handleTouchEnd = event => {
      if (!touchStart || event.changedTouches.length !== 1) {
        touchStart = null;
        return;
      }
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      const elapsed = Date.now() - touchStart.t;
      touchStart = null;

      const isLeftSwipe = deltaX <= -MIN_SWIPE_PX;
      const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_RATIO;
      const isDeliberate = elapsed >= 80 && elapsed <= 900;
      if (isLeftSwipe && isMostlyHorizontal && isDeliberate) {
        openInbox();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open, openInbox]);

  const closeInbox = () => {
    setOpen(false);
    setSelectedFriend(null);
  };

  return (
    <div className={`vc-messages-widget${open ? ' is-open' : ''}`}>
      {open && selectedFriend ? (
        <Chat
          friendId={selectedFriend._id}
          friendName={selectedFriend.username || selectedFriend.name}
          friendAvatar={selectedFriend.avatar}
          friendLastActive={selectedFriend.lastActive}
          onClose={() => setSelectedFriend(null)}
          docked
        />
      ) : open ? (
        <section className="vc-messages-panel" aria-label="Messages">
          <header className="vc-messages-header">
            <div className="vc-messages-header-copy">
              <h2>Messages</h2>
              <p>Friends · last seen updates live</p>
            </div>
            <button type="button" className="vc-messages-close" onClick={closeInbox} aria-label="Close messages">
              ×
            </button>
          </header>

          {!hasAuthSession() ? (
            <div className="vc-messages-empty">
              <p>Sign in to chat with your friends.</p>
              <button
                type="button"
                className="vc-btn vc-btn-primary"
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
              >
                Sign in
              </button>
            </div>
          ) : loading ? (
            <p className="vc-messages-state" role="status">Loading chats…</p>
          ) : error ? (
            <div className="vc-messages-empty">
              <p role="alert">{error}</p>
              <button type="button" className="vc-btn vc-btn-outline" onClick={() => setLoadVersion(version => version + 1)}>
                Try again
              </button>
            </div>
          ) : friends.length === 0 ? (
            <p className="vc-messages-state">Add friends to start a conversation.</p>
          ) : (
            <div className="vc-messages-friend-list">
              {friends.map(friend => {
                const preview = friend.lastMessage?.text
                  ? `${friend.lastMessage.fromMe ? 'You: ' : ''}${friend.lastMessage.text}`
                  : 'Say hello about a film…';
                const seenLabel = formatLastSeen(friend.lastActive);
                const online = isOnline(friend.lastActive);
                return (
                  <button
                    type="button"
                    className="vc-messages-friend"
                    key={friend._id}
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <FriendAvatar friend={friend} />
                    <span className="vc-messages-friend-meta">
                      <span className="vc-messages-friend-name">{friend.username || friend.name || 'User'}</span>
                      <span className="vc-messages-friend-preview">{preview}</span>
                      <span className={`vc-messages-friend-seen${online ? ' is-online' : ''}`}>{seenLabel}</span>
                    </span>
                    <span className="vc-messages-friend-side">
                      <span>{formatPreviewTime(friend.lastMessage?.createdAt)}</span>
                      <span aria-hidden="true">›</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <button
        type="button"
        className={`vc-messages-launcher${open ? ' is-open' : ''}${activityCount > 0 && !open ? ' has-activity' : ''}`}
        onClick={() => (open ? closeInbox() : openInbox())}
        aria-label={
          open
            ? 'Close messages'
            : activityCount > 0
              ? `Open messages, ${activityCount} active conversations`
              : 'Open messages'
        }
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 5.5h15v11h-8l-4.5 3v-3h-2.5z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
        <span>Messages</span>
        {activityCount > 0 && !open && (
          <span className="vc-messages-badge" aria-hidden="true">
            {activityCount > 9 ? '9+' : activityCount}
          </span>
        )}
      </button>
    </div>
  );
}
