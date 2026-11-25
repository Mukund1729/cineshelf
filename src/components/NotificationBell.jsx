import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { hasAuthSession } from '../api/session';
import { UserAvatarLink } from './EntityLink';
import { userPath } from '../lib/entityPaths';
import './NotificationBell.css';

function formatRelativeTime(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function notificationIcon(type) {
  switch (type) {
    case 'new_message':
      return '💬';
    case 'friend_request':
    case 'friend_accepted':
    case 'friend_accept':
      return '👥';
    case 'review_like':
    case 'review_comment':
      return '★';
    case 'community_post':
    case 'community_comment':
    case 'community_mention':
      return '◎';
    case 'list_share':
    case 'watchlist_update':
      return '☰';
    case 'system':
      return '●';
    default:
      return '●';
  }
}

function destinationFor(notification) {
  if (notification?.link?.startsWith('/')) return notification.link;
  const fromId = notification?.fromUser?._id || notification?.data?.fromUserId || notification?.data?.senderId;
  if (fromId) return userPath(fromId) || '/people';
  return '/people';
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const unreadCount = notifications.filter(notification => !notification.isRead).length;

  const refreshNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) return;
    try {
      const response = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      const items = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setNotifications(items);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load notifications.');
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    const intervalId = window.setInterval(refreshNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [refreshNotifications]);

  useEffect(() => {
    const handleOutsideClick = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const handleEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const markRead = async notification => {
    if (!notification.isRead) {
      const token = localStorage.getItem('token');
      try {
        await axios.put(`/api/notifications/${notification._id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        setNotifications(current => current.map(item => (
          item._id === notification._id ? { ...item, isRead: true } : item
        )));
      } catch (err) {
        setError(err.response?.data?.error || 'Could not mark notification as read.');
        return;
      }
    }
    setOpen(false);

    // Open the Messages widget for chat notifications (existing chat system).
    if (notification.type === 'new_message') {
      const friendId = notification.fromUser?._id
        || notification.data?.senderId
        || notification.data?.fromUserId;
      if (friendId) {
        window.dispatchEvent(new CustomEvent('open-messages', { detail: { friendId: String(friendId) } }));
      }
    }

    navigate(destinationFor(notification));
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.put('/api/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setNotifications(current => current.map(notification => ({ ...notification, isRead: true })));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark notifications as read.');
    }
  };

  return (
    <div ref={rootRef} className="vc-notify">
      <button
        type="button"
        className={`vc-notify-bell${open ? ' is-open' : ''}`}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(value => !value);
          if (!open) refreshNotifications();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="vc-notify-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <section className="vc-notify-panel" aria-label="Notifications">
          <header className="vc-notify-header">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p>
            </div>
            <button
              type="button"
              className="vc-notify-mark"
              onClick={markAllRead}
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </header>

          {error && <p role="alert" className="vc-notify-error">{error}</p>}

          <div className="vc-notify-list">
            {notifications.length === 0 ? (
              <p className="vc-notify-empty">No notifications yet.</p>
            ) : notifications.map(notification => {
              const actor = notification.fromUser;
              return (
                <div
                  key={notification._id}
                  className={`vc-notify-item${!notification.isRead ? ' is-unread' : ''}`}
                >
                  {actor?._id ? (
                    <UserAvatarLink user={actor} size={36} stopPropagation className="vc-notify-actor" />
                  ) : (
                    <span className="vc-notify-icon" aria-hidden="true">
                      {notificationIcon(notification.type)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="vc-notify-body-btn"
                    onClick={() => markRead(notification)}
                  >
                    <span className="vc-notify-body">
                      <span className="vc-notify-title-row">
                        <span className="vc-notify-title">{notification.title || 'Notification'}</span>
                        {!notification.isRead && <span className="vc-notify-dot" aria-label="Unread" />}
                      </span>
                      <span className="vc-notify-message">{notification.message}</span>
                      <time className="vc-notify-time" dateTime={notification.createdAt}>
                        {formatRelativeTime(notification.createdAt)}
                      </time>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
