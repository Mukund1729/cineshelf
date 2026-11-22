import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { hasAuthSession } from '../../api/session';

const CATEGORIES = ['auteur', 'genre', 'regional', 'theory', 'anime', 'midnight', 'general'];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function CreateCommunityModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'general',
    privacy: 'public',
    coverImage: '',
    avatar: '',
    rules: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => ({
    ...form,
    slug: form.slug || slugify(form.name),
    rules: form.rules.split('\n').map(item => item.trim()).filter(Boolean),
  }), [form]);

  if (!open) return null;

  const update = event => {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'name' && !current.slugManual ? { slug: slugify(value) } : {}),
    }));
  };

  const submit = async event => {
    event.preventDefault();
    if (!hasAuthSession()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/community', {
        ...preview,
        rules: preview.rules,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      onCreated?.(data.community);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create community.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cs-modal-backdrop" onClick={event => event.target === event.currentTarget && onClose?.()}>
      <div className="cs-modal" role="dialog" aria-modal="true" aria-label="Create community">
        <h2>Found a Society</h2>
        <form className="cs-form-grid" onSubmit={submit}>
          <label>
            Name
            <input name="name" value={form.name} onChange={update} required minLength={3} maxLength={80} />
          </label>
          <label>
            Slug
            <input
              name="slug"
              value={form.slug}
              onChange={event => setForm(current => ({ ...current, slug: slugify(event.target.value), slugManual: true }))}
              required
            />
          </label>
          <label>
            Description
            <textarea name="description" value={form.description} onChange={update} rows={4} required minLength={20} maxLength={600} />
          </label>
          <label>
            Category
            <select name="category" value={form.category} onChange={update}>
              {CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Privacy
            <select name="privacy" value={form.privacy} onChange={update}>
              <option value="public">Public</option>
              <option value="restricted">Restricted</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            Cover image URL
            <input name="coverImage" value={form.coverImage} onChange={update} placeholder="https://…" />
          </label>
          <label>
            Avatar URL
            <input name="avatar" value={form.avatar} onChange={update} placeholder="https://…" />
          </label>
          <label>
            Rules (one per line)
            <textarea name="rules" value={form.rules} onChange={update} rows={3} />
          </label>

          <div className="cs-preview">
            <div className="cs-chip">{preview.category}</div>
            <h3 style={{ fontFamily: 'var(--vc-font-display)', margin: '0.5rem 0' }}>{preview.name || 'Untitled society'}</h3>
            <p style={{ color: '#a6a09a', margin: 0 }}>{preview.description || 'Your description will appear here.'}</p>
            <p style={{ color: '#b59a76', fontSize: '0.78rem' }}>/community/{preview.slug || 'slug'}</p>
          </div>

          {error && <p className="cs-error" role="alert">{error}</p>}
          <div className="cs-comm-actions">
            <button type="submit" className="cs-btn cs-btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create community'}
            </button>
            <button type="button" className="cs-btn cs-btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
