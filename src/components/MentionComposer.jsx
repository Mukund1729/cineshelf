import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../api/config';
import { hasAuthSession } from '../api/session';

const MENTION_TRIGGER = /(^|[\s([{])@([a-zA-Z0-9._-]{0,30})$/;

/**
 * Lightweight @username suggestions for textareas.
 * Uses the existing /api/user/search endpoint. Does not change stored text
 * shape — inserts plain @username, which MentionText and the community
 * backend already understand.
 */
export default function MentionComposer({
  value,
  onChange,
  rows = 4,
  placeholder = '',
  className = '',
  id,
  disabled = false,
  required = false,
  maxLength,
  'aria-label': ariaLabel,
}) {
  const textareaRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(null);
  const [error, setError] = useState('');

  const activeQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!open || activeQuery.length < 2 || !hasAuthSession()) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get('/api/user/search', {
          params: { q: activeQuery },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
          signal: controller.signal,
        });
        setSuggestions(data?.data || []);
        setActive(0);
        setError('');
      } catch (err) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError(err.response?.data?.error || '');
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [activeQuery, open]);

  const detectMention = (text, caret) => {
    const before = text.slice(0, caret);
    const match = before.match(MENTION_TRIGGER);
    if (!match) {
      setOpen(false);
      setQuery('');
      setRange(null);
      return;
    }
    setQuery(match[2] || '');
    setRange({ start: caret - (match[2]?.length || 0) - 1, end: caret });
    setOpen(true);
  };

  const insertMention = user => {
    if (!range || !user?.username) return;
    const username = user.username;
    const before = value.slice(0, range.start);
    const after = value.slice(range.end);
    const next = `${before}@${username}${after.startsWith(' ') ? '' : ' '}${after}`;
    onChange(next);
    setOpen(false);
    setSuggestions([]);
    setQuery('');
    setRange(null);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      const pos = before.length + username.length + 2;
      node.focus();
      node.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = event => {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(current => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(current => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertMention(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`vc-mention-composer ${className}`.trim()}>
      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        onChange={event => {
          const next = event.target.value;
          onChange(next);
          detectMention(next, event.target.selectionStart ?? next.length);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Delay so a suggestion click can register.
          window.setTimeout(() => setOpen(false), 150);
        }}
        onClick={event => detectMention(value, event.target.selectionStart ?? value.length)}
        onKeyUp={event => detectMention(value, event.target.selectionStart ?? value.length)}
      />
      {open && suggestions.length > 0 && (
        <ul className="vc-mention-suggestions" role="listbox" aria-label="Mention suggestions">
          {suggestions.map((user, index) => {
            const src = user.avatar
              ? (user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar)
              : '';
            return (
              <li key={user._id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  className={`vc-mention-option${index === active ? ' is-active' : ''}`}
                  onMouseDown={event => {
                    event.preventDefault();
                    insertMention(user);
                  }}
                >
                  {src ? (
                    <img src={src} alt="" width={28} height={28} />
                  ) : (
                    <span className="vc-mention-fallback" aria-hidden="true">
                      {(user.username || user.name || 'U')[0].toUpperCase()}
                    </span>
                  )}
                  <span>
                    <strong>@{user.username}</strong>
                    {user.name && <small>{user.name}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && open && <p className="vc-mention-error">{error}</p>}
    </div>
  );
}
