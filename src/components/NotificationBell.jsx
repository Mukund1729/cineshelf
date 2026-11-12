import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const unreadCount = notifications.filter(notification => !notification.isRead).length;

  const refreshNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
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
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markRead = async notification => {
    if (!notification.isRead) {
      const token = localStorage.getItem('token');
      try {
        await axios.put(`/api/notifications/${notification._id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` },
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
    navigate(notification.link?.startsWith('/') ? notification.link : '/people');
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.put('/api/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(current => current.map(notification => ({ ...notification, isRead: true })));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark notifications as read.');
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(value => !value);
          if (!open) refreshNotifications();
        }}
        style={{
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          background: open ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)',
          color: 'var(--vc-cream)',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 17,
            height: 17,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--vc-red)',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: 'min(480px, calc(100vh - 90px))',
            overflowY: 'auto',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'var(--vc-bg-elevated)',
            boxShadow: '0 18px 45px rgba(0,0,0,0.55)',
            zIndex: 300,
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <strong style={{ fontFamily: 'Playfair Display, serif' }}>Notifications</strong>
            <button type="button" onClick={markAllRead} disabled={!unreadCount} style={{ background: 'none', border: 0, color: unreadCount ? 'var(--vc-gold)' : 'var(--vc-slate)', cursor: unreadCount ? 'pointer' : 'default', fontSize: '0.75rem' }}>
              Mark all read
            </button>
          </header>
          {error && <p role="alert" style={{ margin: 0, padding: '0.75rem 1rem', color: '#fc8181', fontSize: '0.8rem' }}>{error}</p>}
          {notifications.length === 0 ? (
            <p style={{ margin: 0, padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--vc-slate)', fontSize: '0.85rem' }}>
              No notifications yet.
            </p>
          ) : notifications.map(notification => (
            <button
              type="button"
              key={notification._id}
              onClick={() => markRead(notification)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.85rem 1rem',
                textAlign: 'left',
                background: notification.isRead ? 'transparent' : 'rgba(212,175,55,0.07)',
                border: 0,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: 'var(--vc-cream)',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                {notification.title || 'Notification'}
                {!notification.isRead && <span aria-label="Unread" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vc-gold)', marginTop: 5, flexShrink: 0 }} />}
              </span>
              <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--vc-slate)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                {notification.message}
              </span>
              <time style={{ display: 'block', marginTop: '0.35rem', color: 'rgba(148,163,184,0.65)', fontSize: '0.68rem' }}>
                {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
              </time>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
