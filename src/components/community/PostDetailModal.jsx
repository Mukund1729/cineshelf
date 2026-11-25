import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import SpoilerContent from './SpoilerContent';
import MentionText from '../MentionText';
import MentionComposer from '../MentionComposer';
import { UserLink } from '../EntityLink';
import { apiUrl } from '../../api/config';
import {
  communityAuthHeaders,
  deleteCommunityPost,
  requireCommunityAuth,
  toggleLockPost,
  togglePinPost,
} from '../../api/community';

function avatarUrl(user) {
  if (!user?.avatar) return '';
  return user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar;
}

export default function PostDetailModal({ postId, onClose, onUpdated, onDeleted }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [moderating, setModerating] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!postId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setConfirmDelete(false);
    axios.get(`/api/community/posts/${postId}`, {
      headers: communityAuthHeaders(),
      withCredentials: true,
    })
      .then(({ data: payload }) => {
        if (!cancelled) setData(payload);
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load discussion.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [postId]);

  if (!postId) return null;

  const submitComment = async event => {
    event.preventDefault();
    if (!requireCommunityAuth()) return;
    if (!comment.trim()) return;
    setSaving(true);
    try {
      const { data: payload } = await axios.post(
        `/api/community/posts/${postId}/comments`,
        { body: comment.trim(), parent: replyTo || undefined },
        { headers: communityAuthHeaders(), withCredentials: true }
      );
      setData(current => ({
        ...current,
        comments: [...(current?.comments || []), payload.comment],
        post: {
          ...current.post,
          commentCount: (current.post?.commentCount || 0) + 1,
        },
      }));
      setComment('');
      setReplyTo(null);
      onUpdated?.(payload);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add comment.');
    } finally {
      setSaving(false);
    }
  };

  // Pin, lock and delete. The server decides who may do each of these; the
  // buttons only appear when it says the viewer can.
  const moderate = async action => {
    setModerating(action);
    setError('');
    try {
      if (action === 'delete') {
        await deleteCommunityPost(postId);
        setConfirmDelete(false);
        if (onDeleted) onDeleted(postId);
        else {
          onUpdated?.();
          onClose?.();
        }
        return;
      }
      const patch = action === 'pin'
        ? { isPinned: (await togglePinPost(postId)).isPinned }
        : { isLocked: (await toggleLockPost(postId)).isLocked };
      setData(current => ({ ...current, post: { ...current.post, ...patch } }));
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update this discussion.');
    } finally {
      setModerating('');
    }
  };

  const post = data?.post;
  const viewer = data?.viewer || {};
  const comments = data?.comments || [];
  const roots = comments.filter(item => !item.parent);
  const replies = comments.filter(item => item.parent);

  return (
    <div className="cs-modal-backdrop" onClick={event => event.target === event.currentTarget && onClose?.()}>
      <div className="cs-modal" role="dialog" aria-modal="true" aria-label="Discussion">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{loading ? 'Loading…' : (post?.title || 'Discussion')}</h2>
          <button type="button" className="cs-btn cs-btn-ghost" onClick={onClose}>Close</button>
        </div>

        {loading && <div className="cs-skeleton" style={{ height: 180 }} />}
        {error && <p className="cs-error" role="alert">{error}</p>}

        {!loading && post && (
          <>
            <div className="cs-post-sub" style={{ marginBottom: 10 }}>
              <UserLink user={post.author}>
                {post.author?.name || post.author?.username}
              </UserLink>
              {' · '}
              {post.community?.slug && (
                <Link to={`/community/${post.community.slug}`}>{post.community.name}</Link>
              )}
              {post.isPinned ? ' · Pinned' : ''}
              {post.isLocked ? ' · Locked' : ''}
            </div>
            {(viewer.canModerate || viewer.canDelete) && (
              <div className="cs-mod-bar">
                {viewer.canModerate && (
                  <>
                    <button type="button" className="cs-action" disabled={Boolean(moderating)} onClick={() => moderate('pin')}>
                      {post.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button type="button" className="cs-action" disabled={Boolean(moderating)} onClick={() => moderate('lock')}>
                      {post.isLocked ? 'Unlock comments' : 'Lock comments'}
                    </button>
                  </>
                )}
                {viewer.canDelete && !confirmDelete && (
                  <button type="button" className="cs-action" disabled={Boolean(moderating)} onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )}
                {confirmDelete && (
                  <span className="cs-mod-confirm" role="alert">
                    Delete this discussion and its comments? This cannot be undone.
                    <button type="button" className="cs-action is-danger" disabled={Boolean(moderating)} onClick={() => moderate('delete')}>
                      {moderating === 'delete' ? 'Deleting…' : 'Delete'}
                    </button>
                    <button type="button" className="cs-action" disabled={Boolean(moderating)} onClick={() => setConfirmDelete(false)}>
                      Keep
                    </button>
                  </span>
                )}
              </div>
            )}
            <SpoilerContent active={post.spoiler}>
              <MentionText text={post.body} className="cs-post-body" as="div" />
            </SpoilerContent>

            <h3 style={{ fontFamily: 'var(--vc-font-display)', margin: '1.4rem 0 0.75rem' }}>
              Comments ({comments.length})
            </h3>
            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              {roots.map(item => (
                <div key={item._id} className="cs-panel" style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                    {avatarUrl(item.author) ? (
                      <img className="cs-avatar" src={avatarUrl(item.author)} alt="" />
                    ) : (
                      <span className="cs-avatar cs-avatar-fallback">{(item.author?.username || 'U')[0]}</span>
                    )}
                    <div>
                      <strong>{item.author?.name || item.author?.username}</strong>
                      <div className="cs-post-sub">{new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <SpoilerContent active={item.spoiler}>
                    <MentionText text={item.body} className="cs-post-body" as="div" />
                  </SpoilerContent>
                  <button
                    type="button"
                    className="cs-action"
                    style={{ marginTop: 8 }}
                    onClick={() => setReplyTo(item._id)}
                  >
                    Reply
                  </button>
                  {replies.filter(reply => String(reply.parent) === String(item._id)).map(reply => (
                    <div key={reply._id} style={{ marginLeft: 18, marginTop: 10, paddingLeft: 10, borderLeft: '1px solid rgba(241,237,229,0.12)' }}>
                      <strong>{reply.author?.name || reply.author?.username}</strong>
                      <SpoilerContent active={reply.spoiler}>
                        <MentionText text={reply.body} className="cs-post-body" as="div" />
                      </SpoilerContent>
                    </div>
                  ))}
                </div>
              ))}
              {!roots.length && <div className="cs-empty" style={{ padding: '1rem 0' }}>No comments yet.</div>}
            </div>

            <form className="cs-form-grid" onSubmit={submitComment}>
              {replyTo && (
                <div className="cs-chip">
                  Replying
                  <button type="button" className="cs-action" style={{ marginLeft: 8 }} onClick={() => setReplyTo(null)}>
                    Cancel
                  </button>
                </div>
              )}
              <label>
                Add a comment
                <MentionComposer
                  value={comment}
                  onChange={setComment}
                  rows={3}
                  placeholder="Share your take… type @ to mention someone"
                  required
                  aria-label="Add a comment"
                />
              </label>
              <button type="submit" className="cs-btn cs-btn-primary" disabled={saving}>
                {saving ? 'Posting…' : 'Post comment'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
