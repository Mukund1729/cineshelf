import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../api/config';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function mergeMessages(current, incoming) {
  const merged = new Map(current.map(message => [message._id, message]));
  incoming.forEach(message => merged.set(message._id, message));
  const ordered = [...merged.values()].sort(
    (left, right) => new Date(left.createdAt) - new Date(right.createdAt) ||
      left._id.localeCompare(right._id)
  );
  if (ordered.length === current.length &&
      ordered.every((message, index) => message._id === current[index]._id)) {
    return current;
  }
  return ordered;
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

export default function Chat({
  friendId,
  friendName,
  friendAvatar,
  friendLastActive = null,
  onClose,
  docked = false,
}) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastActive, setLastActive] = useState(friendLastActive);
  const [error, setError] = useState('');
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    setLastActive(friendLastActive);
    setBrokenAvatar(false);
  }, [friendId, friendLastActive]);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const loadMessages = async () => {
      if (requestInFlight || !friendId) return;
      requestInFlight = true;
      try {
        const container = messagesContainerRef.current;
        const nearBottom = !container ||
          container.scrollHeight - container.scrollTop - container.clientHeight < 80;
        const response = await axios.get(`/api/chat/${friendId}?limit=40`, {
          headers,
          withCredentials: true,
        });
        if (!active) return;
        const incomingMessages = response.data?.messages || [];
        if (nearBottom) autoScrollRef.current = true;
        setMessages(current => mergeMessages(current, incomingMessages));
        setHasMore(Boolean(response.data?.hasMore));
        if (response.data?.friend?.lastActive) {
          setLastActive(response.data.friend.lastActive);
        }
        setError('');
      } catch (err) {
        if (!active) return;
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
    if (!autoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    autoScrollRef.current = false;
  }, [messages]);

  const loadOlderMessages = async () => {
    const oldestMessage = messages[0];
    if (!friendId || !oldestMessage || !hasMore || loadingOlder) return;

    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight || 0;
    const previousTop = container?.scrollTop || 0;
    setLoadingOlder(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/chat/${friendId}?limit=40&before=${encodeURIComponent(oldestMessage._id)}`,
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      const olderMessages = response.data?.messages || [];
      autoScrollRef.current = false;
      setMessages(current => mergeMessages(current, olderMessages));
      setHasMore(Boolean(response.data?.hasMore));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (container) container.scrollTop = previousTop + container.scrollHeight - previousHeight;
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

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
        withCredentials: true,
      });
      const message = response.data?.message;
      if (message) {
        autoScrollRef.current = true;
        setMessages(current => mergeMessages(current, [message]));
      }
      setInput('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const avatar = friendAvatar
    ? (friendAvatar.startsWith('/') ? apiUrl(friendAvatar) : friendAvatar)
    : '';
  const online = lastActive && Date.now() - new Date(lastActive).getTime() < ONLINE_WINDOW_MS;
  const statusLabel = formatLastSeen(lastActive);

  return (
    <div className={`vc-chat-overlay${docked ? ' vc-chat-overlay--docked' : ''}`}>
      <section
        className="vc-chat-window"
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${friendName}`}
      >
        <header className="vc-chat-header">
          {docked && (
            <button type="button" className="vc-chat-back" onClick={onClose} aria-label="Back to chats">
              ‹
            </button>
          )}
          <span className="vc-chat-header-avatar">
            {avatar && !brokenAvatar ? (
              <img
                className="vc-chat-avatar"
                src={avatar}
                alt=""
                onError={() => setBrokenAvatar(true)}
              />
            ) : (
              <span className="vc-chat-avatar-fallback" aria-hidden="true">
                {(friendName || 'U')[0].toUpperCase()}
              </span>
            )}
            {online && <span className="vc-messages-online-dot" aria-hidden="true" />}
          </span>
          <div className="vc-chat-header-copy">
            <div className="vc-chat-header-title">{friendName}</div>
            <div className={`vc-chat-header-status${online ? ' is-online' : ''}`} role="status">
              {statusLabel}
            </div>
          </div>
          {!docked && (
            <button type="button" className="vc-chat-close" onClick={onClose} aria-label="Close chat">
              ×
            </button>
          )}
        </header>

        <div ref={messagesContainerRef} className="vc-chat-body">
          {hasMore && (
            <button
              type="button"
              className="vc-chat-load-older"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
            >
              {loadingOlder ? 'Loading older messages…' : 'Load older messages'}
            </button>
          )}
          {messages.length === 0 && !error && (
            <div className="vc-chat-empty">
              <p>Start a conversation about cinema</p>
            </div>
          )}
          {messages.map(message => {
            const mine = message.senderId !== friendId;
            return (
              <div
                key={message._id}
                className={`vc-chat-bubble${mine ? ' is-mine' : ' is-theirs'}`}
              >
                <div className="vc-chat-bubble-text">{message.text}</div>
                <time className="vc-chat-bubble-time" dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
            );
          })}
          {error && <p role="alert" className="vc-chat-error">{error}</p>}
          <div ref={messagesEndRef} />
        </div>

        <form className="vc-chat-composer" onSubmit={sendMessage}>
          <input
            type="text"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Write a message…"
            aria-label="Type a message"
            maxLength={2000}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            {sending ? '…' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
}
