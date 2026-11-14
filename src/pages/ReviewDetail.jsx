import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { hasAuthSession } from '../api/session';

const getCurrentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return String(user?._id || user?.id || '');
  } catch {
    return '';
  }
};

export default function ReviewDetail() {
  const { reviewId } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relation, setRelation] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [friendNotice, setFriendNotice] = useState('');
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeError, setLikeError] = useState('');

  useEffect(() => {
    let active = true;
    setReview(null);
    setLoading(true);
    setError('');

    axios.get(`/api/review/${reviewId}`)
      .then(response => {
        const loadedReview = response.data?.data || null;
        if (active) {
          setReview(loadedReview);
          setComments(Array.isArray(loadedReview?.comments) ? loadedReview.comments : []);
          setLikeCount(Array.isArray(loadedReview?.likes) ? loadedReview.likes.length : 0);
          const currentUserId = getCurrentUserId();
          setLiked(Boolean(currentUserId && loadedReview?.likes?.some(
            userId => String(userId?._id || userId) === currentUserId
          )));
        }
      })
      .catch(err => {
        if (active) {
          setError(err.response?.status === 404
            ? 'This review could not be found.'
            : err.response?.data?.error || 'Could not load this review.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [reviewId]);

  useEffect(() => {
    const userId = review?.user?._id;
    if (!userId) return undefined;

    setFriendNotice('');
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
      setRelation('signed-out');
      return undefined;
    }

    let active = true;
    setRelation('checking');
    setFriendNotice('');
    axios.get(`/api/people/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => {
        if (active) setRelation(response.data?.data?.relation || 'none');
      })
      .catch(err => {
        if (active) {
          setRelation(err.response?.status === 401 ? 'signed-out' : 'unavailable');
          if (err.response?.status !== 401) {
            setFriendNotice(err.response?.data?.error || 'Could not check friend status.');
          }
        }
      });

    return () => { active = false; };
  }, [review?.user?._id]);

  const sendFriendRequest = async () => {
    const userId = review?.user?._id;
    const token = localStorage.getItem('token');
    if (!userId) return;
    if (!hasAuthSession()) {
      setRelation('signed-out');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    setRequesting(true);
    setFriendNotice('');
    try {
      await axios.post('/api/people/request', { userId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRelation('outgoing');
      setFriendNotice('Friend request sent.');
    } catch (err) {
      setFriendNotice(err.response?.data?.error || 'Could not send friend request.');
    } finally {
      setRequesting(false);
    }
  };

  const toggleLike = async () => {
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    setLikeLoading(true);
    setLikeError('');
    try {
      const response = await axios.post(`/api/review/${review._id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLiked(Boolean(response.data?.data?.liked));
      setLikeCount(Number(response.data?.data?.likes) || 0);
    } catch (err) {
      setLikeError(err.response?.data?.error || 'Could not update your like.');
    } finally {
      setLikeLoading(false);
    }
  };

  const submitComment = async event => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    const text = commentText.trim();
    if (!text) {
      setCommentError('Write a comment before posting.');
      return;
    }

    setCommentPosting(true);
    setCommentError('');
    try {
      const response = await axios.post(`/api/review/${review._id}/comments`, { text }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const savedComment = response.data?.data;
      if (!savedComment?._id) throw new Error('The server did not return the saved comment.');
      setComments(current => [savedComment, ...current]);
      setReview(current => current ? {
        ...current,
        commentCount: response.data.commentCount ?? (current.commentCount || 0) + 1,
      } : current);
      setCommentText('');
    } catch (err) {
      setCommentError(err.response?.data?.error || err.message || 'Could not post comment.');
    } finally {
      setCommentPosting(false);
    }
  };

  const moviePath = review
    ? `/${review.mediaType === 'tv' ? 'tv' : 'movie'}/${review.source === 'original' ? review.originalId : review.tmdbId}`
    : '/';
  const authorName = review?.user?.name
    || (review?.user?.username ? `@${review.user.username}` : 'CineShelf member');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <main className="vc-container" style={{ maxWidth: 920, paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        {review && (
          <Link
            to={moviePath}
            style={{ display: 'inline-block', marginBottom: '1.5rem', color: 'var(--vc-gold)', textDecoration: 'none' }}
          >
            ← Back to {review.title || 'movie'}
          </Link>
        )}

        {loading ? (
          <div role="status" style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--vc-slate)' }}>
            Loading review…
          </div>
        ) : error ? (
          <section role="alert" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem' }}>Review unavailable</h1>
            <p style={{ color: 'var(--vc-slate)' }}>{error}</p>
            <Link to="/" className="vc-btn vc-btn-outline">Back to CineShelf</Link>
          </section>
        ) : review ? (
          <article style={{
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18,
            background: 'var(--vc-bg-card)',
            boxShadow: 'var(--vc-shadow-card)',
          }}>
            <header style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              padding: 'clamp(1.25rem, 4vw, 2rem)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.08), transparent 60%)',
            }}>
              {review.poster && (
                <img
                  src={review.poster}
                  alt={`${review.title || 'Movie'} poster`}
                  style={{ width: 92, height: 138, flex: '0 0 auto', objectFit: 'cover', borderRadius: 10 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <span className="vc-section-label">Community review</span>
                <h1 style={{
                  margin: '0.35rem 0 0.6rem',
                  fontFamily: 'Playfair Display, serif',
                  fontSize: 'clamp(1.5rem, 4vw, 2.4rem)',
                  lineHeight: 1.2,
                }}>
                  {review.title || 'Untitled movie'}
                </h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                  {review.user?._id ? (
                    <Link
                      to={`/people/${review.user._id}`}
                      style={{ color: 'var(--vc-gold)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {authorName}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--vc-slate)' }}>{authorName}</span>
                  )}
                  {relation === 'none' || relation === 'signed-out' || relation === 'unavailable' ? (
                    <button
                      type="button"
                      className="vc-btn vc-btn-primary"
                      disabled={requesting}
                      onClick={sendFriendRequest}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                    >
                      {requesting ? 'Sending…' : relation === 'signed-out' ? '+ Sign in to add friend' : '+ Add Friend'}
                    </button>
                  ) : relation === 'friend' ? (
                    <span className="vc-badge vc-badge-slate">Friend</span>
                  ) : relation === 'outgoing' ? (
                    <span className="vc-badge vc-badge-slate">Request sent</span>
                  ) : relation === 'incoming' ? (
                    <Link to="/people" className="vc-btn vc-btn-outline" style={{ textDecoration: 'none', fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}>
                      View request
                    </Link>
                  ) : relation === 'self' ? (
                    <span className="vc-badge vc-badge-slate">Your review</span>
                  ) : null}
                </div>
                {friendNotice && (
                  <p role="status" style={{ margin: '0.5rem 0 0', color: 'var(--vc-slate)', fontSize: '0.8rem' }}>
                    {friendNotice}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.8rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--vc-gold)', fontWeight: 700 }}>★ {review.rating}/10</span>
                  {review.createdAt && (
                    <time style={{ color: 'var(--vc-slate-dark)', fontSize: '0.8rem' }}>
                      {new Date(review.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  )}
                </div>
              </div>
            </header>

            <div style={{ padding: 'clamp(1.25rem, 5vw, 3rem)' }}>
              {review.spoiler && (
                <p role="note" style={{
                  margin: '0 0 1.25rem',
                  color: '#fc8181',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Contains spoilers
                </p>
              )}
              <div style={{
                color: 'var(--vc-cream)',
                fontFamily: 'Lato, sans-serif',
                fontSize: '1.08rem',
                lineHeight: 1.9,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}>
                {review.review || 'This member shared a rating without a written review.'}
              </div>
              <section style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  className={liked ? 'vc-btn vc-btn-primary' : 'vc-btn vc-btn-outline'}
                  aria-pressed={liked}
                  disabled={likeLoading}
                  onClick={toggleLike}
                >
                  {likeLoading ? 'Saving…' : `${liked ? '♥ Liked' : '♡ Like'} · ${likeCount}`}
                </button>
                {likeError && <p role="alert" style={{ color: '#fc8181', fontSize: '0.85rem' }}>{likeError}</p>}

                <div style={{ marginTop: '2rem' }}>
                  <h2 style={{ margin: '0 0 1rem', fontFamily: 'Playfair Display, serif', fontSize: '1.4rem' }}>
                    Comments ({review.commentCount ?? comments.length})
                  </h2>
                  <form onSubmit={submitComment}>
                    <textarea
                      value={commentText}
                      onChange={event => {
                        setCommentText(event.target.value);
                        setCommentError('');
                      }}
                      maxLength={1000}
                      rows={3}
                      placeholder="Share your thoughts about this review…"
                      aria-label="Write a comment"
                      style={{
                        display: 'block',
                        width: '100%',
                        resize: 'vertical',
                        padding: '0.8rem 1rem',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 10,
                        background: 'var(--vc-bg-deep)',
                        color: 'var(--vc-cream)',
                        font: 'inherit',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.65rem' }}>
                      <span style={{ color: 'var(--vc-slate-dark)', fontSize: '0.75rem' }}>{commentText.length}/1000</span>
                      <button type="submit" className="vc-btn vc-btn-primary" disabled={commentPosting}>
                        {commentPosting ? 'Posting…' : 'Post comment'}
                      </button>
                    </div>
                    {commentError && <p role="alert" style={{ color: '#fc8181', fontSize: '0.85rem' }}>{commentError}</p>}
                  </form>

                  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.25rem' }}>
                    {comments.length === 0 ? (
                      <p style={{ color: 'var(--vc-slate)', margin: 0 }}>No comments yet. Start the conversation.</p>
                    ) : comments.map(comment => (
                      <article
                        key={comment._id}
                        style={{
                          padding: '0.9rem 1rem',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.035)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem 1rem', marginBottom: '0.35rem' }}>
                          {comment.user?._id ? (
                            <Link to={`/people/${comment.user._id}`} style={{ color: 'var(--vc-gold)', fontWeight: 600, textDecoration: 'none' }}>
                              {comment.user.name || `@${comment.user.username}`}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--vc-slate)' }}>CineShelf member</span>
                          )}
                          {comment.createdAt && (
                            <time style={{ color: 'var(--vc-slate-dark)', fontSize: '0.75rem' }}>
                              {new Date(comment.createdAt).toLocaleString()}
                            </time>
                          )}
                        </div>
                        <p style={{ margin: 0, color: 'var(--vc-cream)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {comment.text}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
              <Link
                to={moviePath}
                style={{ display: 'inline-block', marginTop: '2rem', color: 'var(--vc-gold)', textDecoration: 'none' }}
              >
                See more reviews for this title →
              </Link>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}
