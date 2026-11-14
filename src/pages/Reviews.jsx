import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';
import { hasAuthSession } from '../api/session';

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function ReviewCard({ review, onDelete, onEdit }) {
  const img = review.poster || null;
  const year = review.releaseDate ? review.releaseDate.slice(0, 4) : '';

  return (
    <div style={{
      background: 'var(--vc-bg-card)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'border-color 200ms',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
    >
      <Link to={`/movie/${review.source === 'original' ? review.originalId : review.tmdbId}`} style={{ textDecoration: 'none', display: 'flex', gap: '1rem', padding: '1rem' }}>
        <div style={{ flexShrink: 0 }}>
          {img ? (
            <img
              src={img}
              alt={review.title}
              style={{ width: 70, height: 105, objectFit: 'cover', borderRadius: 8, display: 'block' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: 70, height: 105, borderRadius: 8, background: 'var(--vc-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vc-slate)', fontSize: '1.5rem' }}>🎬</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 700, color: 'var(--vc-cream)', marginBottom: '0.25rem', lineHeight: 1.3 }}>
            {review.title} {year && <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 400, fontSize: '0.8rem', color: 'var(--vc-slate)' }}>({year})</span>}
          </div>
          {review.rating !== undefined && (
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-gold)', marginBottom: '0.35rem' }}>
              {'★'.repeat(Math.round(review.rating / 2))}{'☆'.repeat(5 - Math.round(review.rating / 2))} {review.rating}/10
            </div>
          )}
          {review.review && (
            <p style={{
              fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--vc-slate)',
              lineHeight: 1.5, margin: 0,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {review.spoiler && <span style={{ color: '#fc8181', marginRight: '0.25rem' }}>[Spoilers]</span>}
              {review.review}
            </p>
          )}
        </div>
      </Link>
      <div style={{
        display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <button
          onClick={() => onEdit(review)}
          className="vc-btn vc-btn-ghost"
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(review._id)}
          className="vc-btn vc-btn-danger"
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
        >
          Delete
        </button>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate-dark)', marginLeft: 'auto', alignSelf: 'center' }}>
          {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

export default function Reviews() {
  const [myReviews, setMyReviews] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editReview, setEditReview] = useState(null); // review being edited
  const [editRating, setEditRating] = useState('');
  const [editText, setEditText] = useState('');
  const [editSpoiler, setEditSpoiler] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, withCredentials: true };

  const fetchReviews = () => {
    if (!hasAuthSession()) { setError('Please sign in to view your reviews.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    Promise.all([
      axios.get('/api/review', { headers }),
      axios.get('/api/people/sakha', { headers }),
    ])
      .then(([reviewRes, friendRes]) => {
        const reviews = reviewRes.data?.data || reviewRes.data || [];
        setMyReviews(Array.isArray(reviews) ? reviews : []);
        setFriends(friendRes.data?.data || []);
      })
      .catch(err => {
        if (err.response?.status === 401) setError('Please sign in to view your reviews.');
        else setError('Failed to load reviews.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await axios.delete(`/api/review/${id}`, { headers });
      setMyReviews(prev => prev.filter(r => r._id !== id));
      showToast('Review deleted.');
    } catch {
      showToast('Failed to delete review.');
    }
  };

  const handleEdit = (review) => {
    setEditReview(review);
    setEditRating(review.rating !== undefined ? String(review.rating) : '');
    setEditText(review.review || '');
    setEditSpoiler(review.spoiler || false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editReview) return;
    setSaving(true);
    try {
      const res = await axios.put(`/api/review/${editReview._id}`, {
        rating: editRating !== '' ? Number(editRating) : undefined,
        review: editText,
        spoiler: editSpoiler,
      }, { headers });
      setMyReviews(prev => prev.map(r => r._id === editReview._id ? (res.data?.data || r) : r));
      setEditReview(null);
      showToast('Review updated.');
    } catch {
      showToast('Failed to update review.');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* Header */}
      <section style={{ padding: '4rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container">
          <span className="vc-section-label">Your Diary</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900 }}>
            Reviews
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginTop: '0.5rem' }}>
            Films you've watched and what you thought.
          </p>
        </div>
      </section>

      <div className="vc-container reviews-layout" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', display: 'grid', gridTemplateColumns: friends.length > 0 ? '1fr 280px' : '1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Main reviews */}
        <div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: 'var(--vc-bg-card)', borderRadius: 12, padding: '1rem', display: 'flex', gap: '1rem' }}>
                  <div className="vc-skeleton" style={{ width: 70, height: 105, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="vc-skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                    <div className="vc-skeleton" style={{ height: 12, width: '40%', marginBottom: 8 }} />
                    <div className="vc-skeleton" style={{ height: 12, width: '80%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
              <p style={{ marginBottom: '1.5rem' }}>{error}</p>
              {!hasAuthSession() ? (
                <button className="vc-btn vc-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>Sign In</button>
              ) : (
                <button className="vc-btn vc-btn-outline" onClick={fetchReviews}>Retry</button>
              )}
            </div>
          ) : myReviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--vc-slate)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', color: 'var(--vc-cream)', marginBottom: '0.5rem' }}>No reviews yet.</p>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Go to a movie page and write your first review.
              </p>
              <Link to="/discover" className="vc-btn vc-btn-primary">Discover Films</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', marginBottom: '0.5rem' }}>
                {myReviews.length} review{myReviews.length !== 1 ? 's' : ''}
              </p>
              {myReviews.map(review => (
                <ReviewCard key={review._id} review={review} onDelete={handleDelete} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>

        {/* Friends sidebar */}
        {friends.length > 0 && (
          <aside>
            <div style={{ background: 'var(--vc-bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', marginBottom: '1rem', color: 'var(--vc-cream)' }}>
                Friends
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {friends.slice(0, 8).map(friend => (
                  <div key={friend._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {friend.avatar ? (
                      <img src={friend.avatar.startsWith('/') ? apiUrl(friend.avatar) : friend.avatar} alt={friend.username} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--vc-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#0a0f1a', flexShrink: 0 }}>
                        {(friend.username || friend.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-cream)' }}>{friend.username}</div>
                      {friend.bio && <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)', lineHeight: 1.3 }}>{friend.bio.slice(0, 40)}</div>}
                    </div>
                  </div>
                ))}
                <Link to="/people" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: 'var(--vc-cyan)', textDecoration: 'none', marginTop: '0.25rem' }}>
                  View all friends →
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Edit Modal */}
      {editReview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={(e) => e.target === e.currentTarget && setEditReview(null)}>
          <div style={{ background: 'var(--vc-bg-elevated)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              Edit Review: {editReview.title}
            </h2>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--vc-slate)', display: 'block', marginBottom: '0.4rem' }}>Rating (0–10)</label>
                <input
                  type="number" min="0" max="10" step="0.5"
                  value={editRating}
                  onChange={e => setEditRating(e.target.value)}
                  className="vc-input"
                  placeholder="Your rating"
                />
              </div>
              <div>
                <label style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--vc-slate)', display: 'block', marginBottom: '0.4rem' }}>Review</label>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="vc-input vc-textarea"
                  placeholder="What did you think?"
                  rows={4}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editSpoiler} onChange={e => setEditSpoiler(e.target.checked)} />
                Contains spoilers
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="vc-btn vc-btn-ghost" onClick={() => setEditReview(null)}>Cancel</button>
                <button type="submit" className="vc-btn vc-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="vc-toast">
          <div className="vc-toast-item vc-toast-info">{toast}</div>
        </div>
      )}
    </div>
  );
}
