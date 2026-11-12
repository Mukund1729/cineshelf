import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../api/config';

export default function Chat({ friendId, friendName, friendAvatar, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Loading conversation…');
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const loadMessages = async () => {
      if (requestInFlight || !friendId) return;
      requestInFlight = true;
      try {
        const response = await axios.get(`/api/chat/${friendId}`, { headers });
        if (!active) return;
        const incomingMessages = response.data?.messages || [];
        setMessages(current => (
          current.length === incomingMessages.length
            && current.every((message, index) => message._id === incomingMessages[index]._id)
            ? current
            : incomingMessages
        ));
        setSyncStatus('Auto-refreshing');
        setError('');
      } catch (err) {
        if (!active) return;
        setSyncStatus('Unable to sync');
        setError(err.response?.data?.error || 'Could not load messages.');
      } finally {
        requestInFlight = false;
      }
    };

    loadMessages();
    const intervalId = window.setInterval(loadMessages, 4000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [friendId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async event => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !friendId || sending) return;

    setSending(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/chat/${friendId}`, { text }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const message = response.data?.message;
      if (message) {
        setMessages(current => (
          current.some(item => item._id === message._id)
            ? current
            : [...current, message]
        ));
      }
      setInput('');
      setSyncStatus('Auto-refreshing');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const avatar = friendAvatar
    ? (friendAvatar.startsWith('/') ? apiUrl(friendAvatar) : friendAvatar)
    : '';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${friendName}`}
        style={{
          width: '100%',
          maxWidth: '600px',
          height: '80vh',
          background: 'var(--vc-bg-card)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <header style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--vc-bg-elevated)',
        }}>
          {avatar ? (
            <img src={avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--vc-gold), #b8860b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#0a0f1a',
            }}>
              {(friendName || 'U')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: 'var(--vc-cream)' }}>
              {friendName}
            </div>
            <div role="status" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: error ? '#fc8181' : 'var(--vc-slate)' }}>
              {syncStatus}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chat" style={{
            background: 'none',
            border: 'none',
            color: 'var(--vc-slate)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.5rem',
          }}>
            ×
          </button>
        </header>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {messages.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--vc-slate)' }}>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>Start a conversation about cinema</p>
            </div>
          )}
          {messages.map(message => (
            <div
              key={message._id}
              style={{
                maxWidth: '70%',
                alignSelf: message.senderId === friendId ? 'flex-start' : 'flex-end',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: message.senderId === friendId ? 'rgba(255,255,255,0.1)' : 'rgba(212,175,55,0.15)',
                border: message.senderId === friendId ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(212,175,55,0.3)',
              }}
            >
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {message.text}
              </div>
              <time style={{ fontSize: '0.65rem', color: 'var(--vc-slate)', marginTop: '0.25rem', display: 'block' }}>
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
          {error && <p role="alert" style={{ color: '#fc8181', fontSize: '0.82rem', textAlign: 'center' }}>{error}</p>}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} style={{
          padding: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--vc-bg-elevated)',
        }}>
          <input
            type="text"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Type a message..."
            aria-label="Type a message"
            maxLength={2000}
            disabled={sending}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'var(--vc-bg-base)',
              color: 'var(--vc-cream)',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: sending || !input.trim() ? 'rgba(212,175,55,0.3)' : 'var(--vc-gold)',
              color: '#0a0f1a',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
}
