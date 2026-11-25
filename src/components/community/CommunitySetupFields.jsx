import React, { useRef, useState } from 'react';
import CinemaMarkdown from '../CinemaMarkdown';
import {
  ABOUT_PROMPTS,
  COMMUNITY_CATEGORIES,
  COMMUNITY_IMAGE_TYPES,
  COMMUNITY_LIMITS as LIMITS,
  COMMUNITY_PRIVACY,
  LEGACY_COMMUNITY_CATEGORIES,
  STARTER_RULES,
} from '../../../data/communityOptions.js';

/* Field building blocks shared by the Create Community setup and the
   community settings page, so both edit the same data the same way. */

let ruleKeySeed = 0;
export function newRule(rule = {}) {
  ruleKeySeed += 1;
  return { key: `rule-${Date.now().toString(36)}-${ruleKeySeed}`, title: rule.title || '', body: rule.body || '' };
}

export function validateCommunityImageFile(file) {
  if (!file) return 'Choose an image.';
  if (!COMMUNITY_IMAGE_TYPES.includes(file.type)) return 'Use a JPEG, PNG, WebP or GIF image.';
  if (file.size > LIMITS.imageBytes) {
    return `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${LIMITS.imageBytes / (1024 * 1024)} MB.`;
  }
  return '';
}

export function normalizeTopicInput(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N} &'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function Counter({ value = '', max }) {
  const length = value.length;
  return (
    <span className={`cs-counter${length > max ? ' is-over' : ''}`} aria-live="polite">
      {length}/{max}
    </span>
  );
}

export function Field({ id, label, optional = false, hint, error, counter, children }) {
  return (
    <div className={`cs-field${error ? ' has-error' : ''}`}>
      <div className="cs-field-head">
        <label htmlFor={id}>
          {label}
          {optional && <span className="cs-field-optional">Optional</span>}
        </label>
        {counter}
      </div>
      {children}
      {error
        ? <p className="cs-field-error" id={`${id}-note`} role="alert">{error}</p>
        : hint ? <p className="cs-field-hint" id={`${id}-note`}>{hint}</p> : null}
    </div>
  );
}

export function ImagePicker({ kind, label, hint, src, onPick, onRemove, error, busy = false }) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState('');
  const message = error || localError;

  const handleChange = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = validateCommunityImageFile(file);
    setLocalError(problem);
    if (!problem) onPick(file);
  };

  return (
    <div className={`cs-image-picker cs-image-picker--${kind}${message ? ' has-error' : ''}`}>
      <div className="cs-image-frame" aria-hidden={src ? undefined : 'true'}>
        {src
          ? <img src={src} alt={`${label} preview`} />
          : <span>{kind === 'avatar' ? 'Icon' : 'Banner'}</span>}
      </div>
      <div className="cs-image-meta">
        <div className="cs-field-head">
          <strong>{label}<span className="cs-field-optional">Optional</span></strong>
        </div>
        <p className="cs-field-hint">{hint}</p>
        <div className="cs-image-buttons">
          <button
            type="button"
            className="cs-btn cs-btn-ghost cs-btn-sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Uploading…' : src ? 'Replace' : 'Choose image'}
          </button>
          {src && !busy && (
            <button
              type="button"
              className="cs-link-btn"
              onClick={() => { setLocalError(''); onRemove(); }}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={COMMUNITY_IMAGE_TYPES.join(',')}
          className="cs-visually-hidden"
          aria-label={`Upload ${label.toLowerCase()}`}
          tabIndex={-1}
          onChange={handleChange}
        />
        {message && <p className="cs-field-error" role="alert">{message}</p>}
      </div>
    </div>
  );
}

/* ── About editor ───────────────────────────────────────────────────── */

const LINE_MARKER = /^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/;

function wrapSelection(marker, placeholder) {
  return (value, start, end) => {
    const selected = value.slice(start, end) || placeholder;
    return {
      text: `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`,
      selStart: start + marker.length,
      selEnd: start + marker.length + selected.length,
    };
  };
}

function prefixLines(prefixFor) {
  return (value, start, end) => {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const found = value.indexOf('\n', end);
    const lineEnd = found === -1 ? value.length : found;
    const next = value.slice(lineStart, lineEnd)
      .split('\n')
      .map((line, index) => `${prefixFor(index)}${line.replace(LINE_MARKER, '')}`)
      .join('\n');
    return {
      text: `${value.slice(0, lineStart)}${next}${value.slice(lineEnd)}`,
      selStart: lineStart + next.length,
      selEnd: lineStart + next.length,
    };
  };
}

const FORMATS = [
  { key: 'heading', label: 'Heading', title: 'Heading', run: prefixLines(() => '## ') },
  { key: 'bold', label: 'B', title: 'Bold', run: wrapSelection('**', 'bold text') },
  { key: 'italic', label: 'I', title: 'Italic', run: wrapSelection('*', 'italic text') },
  { key: 'bullets', label: '• List', title: 'Bulleted list', run: prefixLines(() => '- ') },
  { key: 'numbers', label: '1. List', title: 'Numbered list', run: prefixLines(index => `${index + 1}. `) },
];

export function AboutEditor({ id = 'community-about', value, onChange, error }) {
  const textareaRef = useRef(null);
  const [mode, setMode] = useState('write');

  const commit = (text, selStart, selEnd) => {
    onChange(text);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(selStart, selEnd);
    });
  };

  const applyFormat = format => {
    const node = textareaRef.current;
    if (!node) return;
    const result = format.run(value, node.selectionStart ?? value.length, node.selectionEnd ?? value.length);
    commit(result.text, result.selStart, result.selEnd);
  };

  const insertPrompt = prompt => {
    const spacer = value.trim() ? `${value.replace(/\s+$/, '')}\n\n` : '';
    const text = `${spacer}## ${prompt}\n`;
    setMode('write');
    commit(text, text.length, text.length);
  };

  return (
    <Field
      id={id}
      label="About"
      error={error}
      hint={`Required, at least ${LIMITS.descriptionMin} characters. Blank lines make paragraphs.`}
      counter={<Counter value={value} max={LIMITS.descriptionMax} />}
    >
      <div className="cs-editor">
        <div className="cs-editor-bar">
          <div className="cs-editor-tools" role="toolbar" aria-label="Formatting">
            {FORMATS.map(format => (
              <button
                key={format.key}
                type="button"
                className={`cs-editor-tool cs-editor-tool--${format.key}`}
                title={format.title}
                aria-label={format.title}
                disabled={mode !== 'write'}
                onClick={() => applyFormat(format)}
              >
                {format.label}
              </button>
            ))}
          </div>
          <div className="cs-editor-modes" role="tablist" aria-label="Editor view">
            {['write', 'preview'].map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                className={`cs-editor-mode${mode === item ? ' is-active' : ''}`}
                onClick={() => setMode(item)}
              >
                {item === 'write' ? 'Write' : 'Preview'}
              </button>
            ))}
          </div>
        </div>
        {mode === 'write' ? (
          <textarea
            id={id}
            ref={textareaRef}
            value={value}
            rows={11}
            aria-describedby={`${id}-note`}
            aria-invalid={Boolean(error)}
            placeholder={'Tell people what this community is for.\n\nWhat do you watch here? How do you talk about it? What makes someone feel at home?'}
            onChange={event => onChange(event.target.value)}
          />
        ) : (
          <div className="cs-editor-preview cs-about" id={id} tabIndex={0}>
            {value.trim()
              ? <CinemaMarkdown content={value} />
              : <p className="cs-field-hint">Nothing to preview yet.</p>}
          </div>
        )}
      </div>
      <div className="cs-prompts">
        <span>Not sure where to start? Answer one of these:</span>
        <div className="cs-prompt-list">
          {ABOUT_PROMPTS.map(prompt => (
            <button key={prompt} type="button" className="cs-prompt" onClick={() => insertPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </Field>
  );
}

/* ── Category and topics ────────────────────────────────────────────── */

export function CategoryPicker({ value, onChange, error }) {
  // A community created before the redesign may hold an original category.
  // It stays selectable so saving settings never changes it by accident.
  const legacy = LEGACY_COMMUNITY_CATEGORIES.find(item => item.key === value);
  const options = legacy ? [legacy, ...COMMUNITY_CATEGORIES] : COMMUNITY_CATEGORIES;
  return (
    <div className={`cs-field${error ? ' has-error' : ''}`}>
      <div className="cs-field-head">
        <span className="cs-field-label" id="community-category-label">Category</span>
      </div>
      <div className="cs-choice-grid" role="radiogroup" aria-labelledby="community-category-label">
        {options.map(item => (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={value === item.key}
            className={`cs-choice${value === item.key ? ' is-active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error
        ? <p className="cs-field-error" role="alert">{error}</p>
        : <p className="cs-field-hint">Pick the closest fit — it helps people find you. “Other” is fine.</p>}
    </div>
  );
}

export function TopicsInput({ topics, onChange, error }) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const full = topics.length >= LIMITS.topicsMax;

  const add = raw => {
    const pieces = String(raw).split(',').map(normalizeTopicInput).filter(Boolean);
    if (!pieces.length) return;
    const next = [...topics];
    let problem = '';
    for (const topic of pieces) {
      if (topic.length < LIMITS.topicMin || topic.length > LIMITS.topicMax) {
        problem = `Topics are ${LIMITS.topicMin}–${LIMITS.topicMax} characters.`;
      } else if (next.includes(topic)) {
        problem = `“${topic}” is already added.`;
      } else if (next.length >= LIMITS.topicsMax) {
        problem = `You can add up to ${LIMITS.topicsMax} topics.`;
      } else {
        next.push(topic);
      }
    }
    setNote(problem);
    if (next.length !== topics.length) onChange(next);
    setDraft('');
  };

  const handleKeyDown = event => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && topics.length) {
      onChange(topics.slice(0, -1));
      setNote('');
    }
  };

  return (
    <Field
      id="community-topics"
      label="Topics"
      optional
      error={error || note}
      hint="Type a topic and press Enter. For example: neo-noir, kurosawa, long takes."
      counter={<span className="cs-counter">{topics.length}/{LIMITS.topicsMax}</span>}
    >
      <div className="cs-tags">
        {topics.map(topic => (
          <span key={topic} className="cs-tag">
            {topic}
            <button
              type="button"
              aria-label={`Remove topic ${topic}`}
              onClick={() => { onChange(topics.filter(item => item !== topic)); setNote(''); }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="community-topics"
          value={draft}
          disabled={full}
          maxLength={LIMITS.topicMax + 10}
          aria-describedby="community-topics-note"
          placeholder={full ? 'Topic limit reached' : topics.length ? 'Add another' : 'Add a topic'}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
    </Field>
  );
}

/* ── Rules ──────────────────────────────────────────────────────────── */

export function RulesEditor({ rules, onChange, error }) {
  const full = rules.length >= LIMITS.rulesMax;
  const update = (key, changes) => onChange(rules.map(rule => (rule.key === key ? { ...rule, ...changes } : rule)));
  const move = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const used = new Set(rules.map(rule => rule.title.trim().toLowerCase()));
  const suggestions = STARTER_RULES.filter(rule => !used.has(rule.title.toLowerCase()));

  return (
    <div className={`cs-field${error ? ' has-error' : ''}`}>
      <div className="cs-field-head">
        <span className="cs-field-label">
          Community rules
          <span className="cs-field-optional">Optional</span>
        </span>
        <span className="cs-counter">{rules.length}/{LIMITS.rulesMax}</span>
      </div>
      <p className="cs-field-hint">
        A few clear rules set the tone. Members see them in this order on the About tab.
      </p>

      {rules.length > 0 && (
        <ol className="cs-rules-editor">
          {rules.map((rule, index) => (
            <li key={rule.key} className="cs-rule-item">
              <span className="cs-rule-number" aria-hidden="true">{index + 1}</span>
              <div className="cs-rule-fields">
                <input
                  value={rule.title}
                  maxLength={LIMITS.ruleTitleMax}
                  aria-label={`Rule ${index + 1} title`}
                  placeholder="Rule title"
                  onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
                  onChange={event => update(rule.key, { title: event.target.value })}
                />
                <textarea
                  value={rule.body}
                  rows={2}
                  maxLength={LIMITS.ruleBodyMax}
                  aria-label={`Rule ${index + 1} explanation`}
                  placeholder="Short explanation (optional)"
                  onChange={event => update(rule.key, { body: event.target.value })}
                />
              </div>
              <div className="cs-rule-tools">
                <button
                  type="button"
                  aria-label={`Move rule ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move rule ${index + 1} down`}
                  disabled={index === rules.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Delete rule ${index + 1}`}
                  onClick={() => onChange(rules.filter(item => item.key !== rule.key))}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="cs-field-error" role="alert">{error}</p>}

      <button
        type="button"
        className="cs-btn cs-btn-ghost cs-btn-sm"
        disabled={full}
        onClick={() => onChange([...rules, newRule()])}
      >
        + Add a rule
      </button>

      {!full && suggestions.length > 0 && (
        <div className="cs-prompts">
          <span>Common starting points — add any that fit, then edit them:</span>
          <div className="cs-prompt-list">
            {suggestions.map(rule => (
              <button
                key={rule.title}
                type="button"
                className="cs-prompt"
                onClick={() => onChange([...rules, newRule(rule)])}
              >
                + {rule.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Privacy ────────────────────────────────────────────────────────── */

const PRIVACY_DETAILS = {
  public: [
    'Listed in discovery and search',
    'Anyone can read discussions',
    'Anyone can join instantly',
  ],
  private: [
    'Not listed in discovery or search',
    'People with the link see only the name, tagline, category and images',
    'They request to join; you or a moderator approve',
    'Discussions, members and media are visible only to approved members',
  ],
  restricted: [
    'Listed in discovery and search',
    'People request to join; you or a moderator approve',
    'Discussions, members and media are visible only to approved members',
  ],
};

export function PrivacyPicker({ value, onChange, error }) {
  // "Restricted" predates the redesign. It is offered only when a community
  // already uses it, so that setting is never lost by saving.
  const options = value === 'restricted' ? ['public', 'restricted', 'private'] : ['public', 'private'];
  return (
    <div className={`cs-field${error ? ' has-error' : ''}`}>
      <div className="cs-field-head">
        <span className="cs-field-label" id="community-privacy-label">Who can see and join</span>
      </div>
      <div className="cs-privacy-grid" role="radiogroup" aria-labelledby="community-privacy-label">
        {options.map(key => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            className={`cs-privacy${value === key ? ' is-active' : ''}`}
            onClick={() => onChange(key)}
          >
            <span className="cs-privacy-title">
              <span className="cs-privacy-dot" aria-hidden="true" />
              {COMMUNITY_PRIVACY[key].label}
            </span>
            <ul>
              {PRIVACY_DETAILS[key].map(line => <li key={line}>{line}</li>)}
            </ul>
          </button>
        ))}
      </div>
      {error
        ? <p className="cs-field-error" role="alert">{error}</p>
        : <p className="cs-field-hint">You can change this later in settings. Privacy is enforced by the server, not just hidden in the interface.</p>}
    </div>
  );
}

/* ── Confirmation dialog ────────────────────────────────────────────── */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div
      className="cs-modal-backdrop"
      onClick={event => event.target === event.currentTarget && !busy && onCancel?.()}
    >
      <div className="cs-modal cs-confirm" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="cs-comm-actions">
          <button
            type="button"
            className={`cs-btn ${danger ? 'cs-btn-primary' : 'cs-btn-gold'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button type="button" className="cs-btn cs-btn-ghost" disabled={busy} onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
