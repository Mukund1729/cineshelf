import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL, apiUrl } from '../api/config';

const token = localStorage.getItem('token');
const headers = { Authorization: `Bearer ${token}` };

export default function Chat({ friendId, friendName, friendAvatar, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch existing messages
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`/api/chat/${friendId}`, { headers });
        setMessages(res.data?.messages || []);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    if (friendId) {
      fetchMessages();
    }

    // WebSocket connection for real-time messages
    const wsBaseUrl = API_BASE_URL
      ? API_BASE_URL.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const ws = new WebSocket(`${wsBaseUrl}/?token=${encodeURIComponent(token || '')}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message' && data.senderId === friendId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [friendId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !friendId) return;

    setLoading(true);
    try {
      const res = await axios.post(
        `/api/chat/${friendId}`,
        { text },
        { headers }
      );
      
      setMessages(prev => [...prev, res.data.message]);
      setInput('');
      
      // Send via WebSocket if connected
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'message',
          recipientId: friendId,
          message: res.data.message
        }));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        height: '80vh',
        background: 'var(--vc-bg-card)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--vc-bg-elevated)'
        }}>
          {friendAvatar ? (
            <img 
              src={friendAvatar.startsWith('/') ? apiUrl(friendAvatar) : friendAvatar}
              alt={friendName}
              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--vc-gold), #b8860b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 700, color: '#0a0f1a'
            }}>
              {(friendName || 'U')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: 'var(--vc-cream)' }}>
              {friendName}
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'var(--vc-slate)' }}>
              {socket?.readyState === WebSocket.OPEN ? 'Online' : 'Connecting...'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--vc-slate)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--vc-slate)' }}>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>
                Start a conversation about cinema
              </p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                maxWidth: '70%',
                alignSelf: msg.senderId === friendId ? 'flex-start' : 'flex-end',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: msg.senderId === friendId 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(212,175,55,0.15)',
                border: msg.senderId === friendId 
                  ? '1px solid rgba(255,255,255,0.05)' 
                  : '1px solid rgba(212,175,55,0.3)'
              }}
            >
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {msg.text}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--vc-slate)', marginTop: '0.25rem' }}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} style={{
          padding: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--vc-bg-elevated)'
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'var(--vc-bg-base)',
              color: 'var(--vc-cream)',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: loading || !input.trim() 
                ? 'rgba(212,175,55,0.3)' 
                : 'var(--vc-gold)',
              color: '#0a0f1a',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {loading ? '…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
