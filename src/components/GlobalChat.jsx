import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Chat from './Chat';
import { apiUrl } from '../api/config';
import './GlobalChat.css';

function FriendAvatar({ friend }) {
  const avatar = friend.avatar
    ? (friend.avatar.startsWith('/') ? apiUrl(friend.avatar) : friend.avatar)
    : '';
  const name = friend.username || friend.name || 'User';

  return avatar ? (
    <img className="vc-messages-avatar" src={avatar} alt="" />
  ) : (
    <span className="vc-messages-avatar vc-messages-avatar-fallback" aria-hidden="true">
      {name[0].toUpperCase()}
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
    if (!open || !localStorage.getItem('token')) return undefined;

    const loadFriends = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/people/sakha', {
          headers: { Authorization: `Bearer ${token}` },
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
    return () => { active = false; };
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
          onClose={() => setSelectedFriend(null)}
          docked
        />
      ) : open ? (
        <section className="vc-messages-panel" aria-label="Messages">
          <header className="vc-messages-header">
            <div>
              <h2>Messages</h2>
              <p>Chat with your friends</p>
            </div>
            <button type="button" className="vc-messages-close" onClick={closeInbox} aria-label="Close messages">
              ×
            </button>
          </header>

          {!localStorage.getItem('token') ? (
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
            <p className="vc-messages-state" role="status">Loading friends…</p>
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
              {friends.map(friend => (
                <button
                  type="button"
                  className="vc-messages-friend"
                  key={friend._id}
                  onClick={() => setSelectedFriend(friend)}
                >
                  <FriendAvatar friend={friend} />
                  <span>{friend.username || friend.name || 'User'}</span>
                  <span className="vc-messages-chevron" aria-hidden="true">›</span>
                </button>
              ))}
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
