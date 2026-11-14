import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { hasAuthSession } from '../api/session';

const INITIAL_FORM = {
  title: '',
  slug: '',
  excerpt: '',
  category: 'essay',
  coverImage: '',
  tags: '',
  publishedAt: new Date().toISOString().slice(0, 10),
  content: '',
};

export default function BlogEditor() {
  const [user, setUser] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [publishingId, setPublishingId] = useState('');
  const [rejectingId, setRejectingId] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!hasAuthSession()) {
      setCheckingUser(false);
      return;
    }

    axios.get('/api/user/profile', { headers })
      .then(response => {
        const profile = response.data?.data || response.data?.user || response.data;
        setUser(profile?.user || profile);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setCheckingUser(false));
  }, []);

  useEffect(() => {
    if (user?.isAdmin) loadSubmissions();
  }, [user?.isAdmin]);

  const loadSubmissions = async () => {
    setQueueLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/blog/admin/posts', {
        params: { page: 1, limit: 50 },
        headers,
      });
      setSubmissions((response.data?.data || []).filter(post => !post.published));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load submissions for review.');
    } finally {
      setQueueLoading(false);
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const isAdmin = Boolean(user?.isAdmin);
      const response = await axios.post(
        isAdmin ? '/api/blog' : '/api/blog/submissions',
        {
          ...form,
          tags: form.tags,
          published: true,
          publishedAt: isAdmin ? form.publishedAt : undefined,
        },
        { headers }
      );
      setNotice(isAdmin
        ? 'Article published in the Journal.'
        : 'Article submitted. It will appear in the Journal after admin approval.');
      setForm({ ...INITIAL_FORM, publishedAt: new Date().toISOString().slice(0, 10) });
      if (isAdmin) await loadSubmissions();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not submit your article.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async postId => {
    setPublishingId(postId);
    setError('');
    try {
      await axios.patch(`/api/blog/admin/posts/${postId}/publish`, {}, { headers });
      setSubmissions(previous => previous.filter(post => post._id !== postId));
      setNotice('Submission approved and published.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not publish this submission.');
    } finally {
      setPublishingId('');
    }
  };

  const handleReject = async postId => {
    if (!window.confirm('Delete this submission? This cannot be undone.')) return;
    setRejectingId(postId);
    setError('');
    try {
      await axios.delete(`/api/blog/${postId}`, { headers });
      setSubmissions(previous => previous.filter(post => post._id !== postId));
      setNotice('Submission rejected and removed.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not remove this submission.');
    } finally {
      setRejectingId('');
    }
  };

  const openAuthModal = type => {
    window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { type } }));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <main className="vc-container" style={{ maxWidth: 900, paddingTop: '3rem', paddingBottom: '5rem' }}>
        <Link to="/journal" style={{ color: 'var(--vc-slate)', textDecoration: 'none' }}>← Back to Journal</Link>
        <span className="vc-section-label" style={{ display: 'block', marginTop: '2rem' }}>Community writing</span>
        <h1 style={{ margin: '.5rem 0', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}>
          Write for the Journal
        </h1>
        <p style={{ maxWidth: 700, color: 'var(--vc-slate)', lineHeight: 1.7 }}>
          Share an essay about cinema, storytelling, or the ideas films leave with us. Community submissions are reviewed before publication.
        </p>

        {checkingUser ? (
          <div className="vc-skeleton" style={{ height: 180, borderRadius: 12, marginTop: '2rem' }} />
        ) : !user ? (
          <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14 }}>
            <p style={{ color: 'var(--vc-slate)' }}>Sign in or create an account to submit an article.</p>
            <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
              <button className="vc-btn vc-btn-gold" onClick={() => openAuthModal('login')}>Sign in</button>
              <button className="vc-btn vc-btn-outline" onClick={() => openAuthModal('signup')}>Create account</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
            {error && <p role="alert" style={{ color: '#ffc8c8' }}>{error}</p>}
            {notice && <p role="status" style={{ color: 'var(--vc-gold)' }}>{notice}</p>}
            <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
              Title *
              <input className="vc-input" required maxLength={200} value={form.title}
                onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
              URL slug (optional)
              <input className="vc-input" maxLength={100} placeholder="Generated from title if left blank" value={form.slug}
                onChange={event => setForm(previous => ({ ...previous, slug: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
              Excerpt
              <textarea className="vc-input" rows={2} maxLength={1000} value={form.excerpt}
                onChange={event => setForm(previous => ({ ...previous, excerpt: event.target.value }))} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
                Category
                <select className="vc-input" value={form.category}
                  onChange={event => setForm(previous => ({ ...previous, category: event.target.value }))}>
                  {['essay', 'editorial', 'review', 'feature', 'list', 'interview', 'news'].map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              {user.isAdmin && (
                <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
                  Publication date
                  <input className="vc-input" type="date" value={form.publishedAt}
                    onChange={event => setForm(previous => ({ ...previous, publishedAt: event.target.value }))} />
                </label>
              )}
            </div>
            <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
              Cover image URL
              <input className="vc-input" type="url" placeholder="https://…" value={form.coverImage}
                onChange={event => setForm(previous => ({ ...previous, coverImage: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
              Tags (comma-separated)
              <input className="vc-input" placeholder="cinema, storytelling" value={form.tags}
                onChange={event => setForm(previous => ({ ...previous, tags: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: '.4rem', color: 'var(--vc-slate)' }}>
              Article content *
              <textarea className="vc-input" required rows={16} value={form.content}
                onChange={event => setForm(previous => ({ ...previous, content: event.target.value }))} />
            </label>
            <div>
              <button className="vc-btn vc-btn-gold" type="submit" disabled={saving}>
                {saving ? 'Submitting…' : user.isAdmin ? 'Publish to Journal' : 'Submit for review'}
              </button>
            </div>
          </form>
        )}

        {user?.isAdmin && (
          <section style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,.08)' }}>
            <span className="vc-section-label">Admin</span>
            <h2 style={{ margin: '.4rem 0 1rem', fontFamily: 'Playfair Display, serif' }}>Community submissions</h2>
            {queueLoading ? (
              <div className="vc-skeleton" style={{ height: 100, borderRadius: 12 }} />
            ) : submissions.length ? (
              <div style={{ display: 'grid', gap: '.8rem' }}>
                {submissions.map(post => (
                  <article key={post._id} style={{ padding: '1rem', background: 'var(--vc-bg-card)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{post.title}</h3>
                        <p style={{ margin: '.35rem 0', color: 'var(--vc-slate)', fontSize: '.85rem' }}>
                          By {post.author?.name || post.author?.username || 'Member'} · Submitted {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                        <button className="vc-btn vc-btn-outline" disabled={publishingId === post._id || rejectingId === post._id}
                          onClick={() => handlePublish(post._id)}>
                          {publishingId === post._id ? 'Publishing…' : 'Approve & publish'}
                        </button>
                        <button className="vc-btn vc-btn-danger" disabled={publishingId === post._id || rejectingId === post._id}
                          onClick={() => handleReject(post._id)}>
                          {rejectingId === post._id ? 'Removing…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                    {post.excerpt && <p style={{ marginBottom: 0, color: 'var(--vc-slate)' }}>{post.excerpt}</p>}
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--vc-slate)' }}>No submissions are waiting for review.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
