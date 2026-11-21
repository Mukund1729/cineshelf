import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
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
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);

  const openInbox = useCallback(() => {
    setOpen(true);
    setSelectedFriend(null);
  }, []);

  useEffect(() => {
    let active = true;
    if (!open || !hasAuthSession()) return undefined;

    const loadFriends = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/people/sakha', {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        if (active) setFriends(response.data?.data || []);
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.error || 'Could not load your friends.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFriends();
    const intervalId = window.setInterval(loadFriends, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [open, loadVersion]);

  useEffect(() => {
    let touchStart = null;
    const handleTouchStart = event => {
      if (window.innerWidth > 768 || event.touches.length !== 1) {
        touchStart = null;
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, button, a, [role="button"]')) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    };
    const handleTouchEnd = event => {
      if (!touchStart || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      if (deltaX < -80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        openInbox();
      }
      touchStart = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [openInbox]);

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
        className={`vc-messages-launcher${open ? ' is-open' : ''}`}
        onClick={() => (open ? closeInbox() : openInbox())}
        aria-label={open ? 'Close messages' : 'Open messages'}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 5.5h15v11h-8l-4.5 3v-3h-2.5z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
        <span>Messages</span>
      </button>
    </div>
  );
}
