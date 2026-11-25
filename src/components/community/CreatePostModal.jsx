import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MentionComposer from '../MentionComposer';
import { communityAuthHeaders, requireCommunityAuth } from '../../api/community';

const TYPES = [
  'discussion',
  'question',
  'theory',
  'poll',
  'recommendation',
  'image',
  'announcement',
];

export default function CreatePostModal({
  open,
  onClose,
  communities = [],
  defaultCommunitySlug = '',
  defaultMovie = null,
  defaults = null,
  onCreated,
}) {
  const [form, setForm] = useState({
    communitySlug: defaultCommunitySlug || communities[0]?.slug || '',
    type: 'discussion',
    title: '',
    body: '',
    spoiler: false,
    imageUrl: '',
    pollOptions: 'Yes\nNo',
    movieTmdbId: defaultMovie?.tmdbId || '',
    movieTitle: defaultMovie?.title || '',
    moviePoster: defaultMovie?.posterPath || '',
    movieYear: defaultMovie?.releaseYear || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The modal stays mounted, so the community and any suggested starting text
  // (for example a welcome post) are applied each time it opens. Text the
  // person already typed is never overwritten.
  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(current => ({
      ...current,
      communitySlug: current.communitySlug || defaultCommunitySlug || communities[0]?.slug || '',
      ...(defaults ? {
        type: defaults.type || current.type,
        title: current.title || defaults.title || '',
        body: current.body || defaults.body || '',
      } : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const update = event => {
    const { name, value, type, checked } = event.target;
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = async event => {
    event.preventDefault();
    if (!requireCommunityAuth()) return;
    if (!form.communitySlug) {
      setError('Choose a community.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        body: form.body.trim(),
        spoiler: form.spoiler,
        images: form.imageUrl ? [form.imageUrl.trim()] : [],
      };
      if (form.movieTmdbId) {
        payload.movie = {
          tmdbId: Number(form.movieTmdbId),
          title: form.movieTitle,
          posterPath: form.moviePoster,
          releaseYear: form.movieYear ? Number(form.movieYear) : null,
        };
      }
      if (form.type === 'poll') {
        payload.poll = {
          question: form.title,
          options: form.pollOptions.split('\n').map(item => item.trim()).filter(Boolean),
        };
      }
      const { data } = await axios.post(`/api/community/${form.communitySlug}/posts`, payload, {
        headers: communityAuthHeaders(),
        withCredentials: true,
      });
      // Clear the text so the next discussion starts empty and a second click
      // cannot publish the same post again.
      setForm(current => ({ ...current, title: '', body: '', imageUrl: '', spoiler: false, type: 'discussion' }));
      onCreated?.(data.post);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create discussion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cs-modal-backdrop" onClick={event => event.target === event.currentTarget && onClose?.()}>
      <div className="cs-modal" role="dialog" aria-modal="true" aria-label="Start a discussion">
        <h2>Start a Discussion</h2>
        <form className="cs-form-grid" onSubmit={submit}>
          <label>
            Community
            <select name="communitySlug" value={form.communitySlug} onChange={update} required>
              <option value="">Select…</option>
              {communities.map(item => (
                <option key={item._id || item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select name="type" value={form.type} onChange={update}>
              {TYPES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Title
            <input name="title" value={form.title} onChange={update} required minLength={4} maxLength={160} />
          </label>
          <label>
            Body
            <MentionComposer
              value={form.body}
              onChange={value => setForm(current => ({ ...current, body: value }))}
              rows={5}
              required
              placeholder="Write the discussion… type @ to mention someone"
              aria-label="Discussion body"
            />
          </label>
          {form.type === 'poll' && (
            <label>
              Poll options (one per line)
              <textarea name="pollOptions" value={form.pollOptions} onChange={update} rows={3} />
            </label>
          )}
          {form.type === 'image' && (
            <label>
              Image URL
              <input name="imageUrl" value={form.imageUrl} onChange={update} />
            </label>
          )}
          <label>
            Movie TMDB ID (optional)
            <input name="movieTmdbId" value={form.movieTmdbId} onChange={update} />
          </label>
          <label>
            Movie title
            <input name="movieTitle" value={form.movieTitle} onChange={update} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f1ede5' }}>
            <input type="checkbox" name="spoiler" checked={form.spoiler} onChange={update} />
            Mark as spoiler
          </label>
          {error && <p className="cs-error" role="alert">{error}</p>}
          <div className="cs-comm-actions">
            <button type="submit" className="cs-btn cs-btn-primary" disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
            <button type="button" className="cs-btn cs-btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
