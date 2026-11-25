import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import DiscussionCard from '../components/community/DiscussionCard';
import CreatePostModal from '../components/community/CreatePostModal';
import PostDetailModal from '../components/community/PostDetailModal';
import CommunityHeader from '../components/community/CommunityHeader';
import CommunityAbout from '../components/community/CommunityAbout';
import { ConfirmDialog } from '../components/community/CommunitySetupFields';
import { apiUrl } from '../api/config';
import {
  communityAuthHeaders,
  fetchCommunityDetail,
  joinCommunity,
  leaveCommunity,
  reactToPost,
  requireCommunityAuth,
  toggleBookmark,
  votePoll,
} from '../api/community';
import { COMMUNITY_PRIVACY } from '../../data/communityOptions.js';
import './community.css';

const TABS = [
  { key: 'discussions', label: 'Discussions' },
  { key: 'about', label: 'About' },
  { key: 'members', label: 'Members' },
  { key: 'media', label: 'Media' },
];

const POST_TABS = [
  { key: 'latest', label: 'Latest' },
  { key: 'trending', label: 'Trending' },
  { key: 'questions', label: 'Questions' },
  { key: 'polls', label: 'Polls' },
  { key: 'pinned', label: 'Pinned' },
];

function avatarUrl(user) {
  if (!user?.avatar) return '';
  return user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar;
}

function PersonCard({ user, sub, fallback }) {
  const id = user?._id || user;
  const src = avatarUrl(user);
  return (
    <Link className="cs-member" to={`/people/${id}`}>
      {src
        ? <img className="cs-avatar" src={src} alt="" />
        : <span className="cs-avatar cs-avatar-fallback">{(user?.username || fallback)[0]}</span>}
      <div>
        <strong>{user?.name || user?.username || fallback}</strong>
        <div className="cs-post-sub">{sub}</div>
        {user?.bio && <div className="cs-member-bio">{String(user.bio).slice(0, 90)}</div>}
      </div>
    </Link>
  );
}

export default function CommunityDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('discussions');
  const [postTab, setPostTab] = useState('latest');
  const [detail, setDetail] = useState(null);
  const [gate, setGate] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [joining, setJoining] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [postDefaults, setPostDefaults] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [activePostId, setActivePostId] = useState(searchParams.get('post') || null);

  const loadDetail = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await fetchCommunityDetail(slug);
      setDetail(data);
      setGate(null);
    } catch (err) {
      setDetail(null);
      // Members-only community: the API sends a limited preview and nothing else.
      const preview = err.response?.status === 403 ? err.response.data?.preview : null;
      setGate(preview ? { preview, code: err.response.data.code } : null);
      if (!preview) setError(err.response?.data?.error || 'Community not found.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const canRead = Boolean(detail?.community);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const { data } = await axios.get(`/api/community/${slug}/posts`, {
        params: { tab: postTab },
        headers: communityAuthHeaders(),
        withCredentials: true,
      });
      setPosts(data.posts || []);
    } catch (err) {
      setPosts([]);
      setNotice({ tone: 'bad', text: err.response?.data?.error || 'Could not load discussions.' });
    } finally {
      setPostsLoading(false);
    }
  }, [slug, postTab]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (canRead && tab === 'discussions') loadPosts();
  }, [canRead, tab, loadPosts]);

  useEffect(() => {
    setActivePostId(searchParams.get('post'));
  }, [searchParams]);

  const community = detail?.community;
  const viewer = detail?.viewer || {};
  const isOwner = community?.role === 'owner';
  const needsApproval = community && community.privacy !== 'public';
  // Shown once, right after creation, until the first discussion exists.
  const showWelcome = Boolean(
    community && isOwner && searchParams.get('welcome') === '1' && !(community.discussionCount > 0)
  );
  const createdNotices = location.state?.notices || [];

  const dismissWelcome = () => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('welcome');
      return next;
    }, { replace: true, state: null });
  };

  const handleJoin = async target => {
    if (!requireCommunityAuth()) return;
    setJoining(true);
    setNotice(null);
    try {
      const data = await joinCommunity(target.slug);
      if (data?.pending) {
        setNotice({ tone: 'ok', text: 'Request sent. You will get a notification when it is approved.' });
      }
      await loadDetail({ quiet: true });
    } catch (err) {
      setNotice({ tone: 'bad', text: err.response?.data?.error || 'Could not update membership.' });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async target => {
    if (!requireCommunityAuth()) return;
    setConfirmLeave(false);
    setJoining(true);
    setNotice(null);
    try {
      await leaveCommunity(target.slug);
      await loadDetail({ quiet: true });
    } catch (err) {
      setNotice({ tone: 'bad', text: err.response?.data?.error || 'Could not update membership.' });
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/community/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: (community || gate?.preview)?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice({ tone: 'ok', text: 'Link copied.' });
      }
    } catch {
      /* ignore share cancel */
    }
  };

  const openPost = post => {
    setActivePostId(post._id);
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('post', post._id);
      return next;
    });
  };

  const closePost = () => {
    setActivePostId(null);
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('post');
      return next;
    });
  };

  const guarded = action => async (...args) => {
    try {
      return await action(...args);
    } catch (err) {
      setNotice({ tone: 'bad', text: err.response?.data?.error || 'Something went wrong. Please try again.' });
      return null;
    }
  };

  const handleReact = guarded(async (post, reaction) => {
    const data = await reactToPost(post._id, reaction);
    if (!data) return;
    setPosts(current => current.map(item => (
      item._id === post._id
        ? {
          ...item,
          reactionCounts: data.reactionCounts,
          myReactions: { ...item.myReactions, [reaction]: !item.myReactions?.[reaction] },
        }
        : item
    )));
  });

  const handleBookmark = guarded(async post => {
    const data = await toggleBookmark(post._id);
    if (!data) return;
    setPosts(current => current.map(item => (
      item._id === post._id ? { ...item, bookmarked: data.bookmarked } : item
    )));
  });

  const handleVote = guarded(async (post, optionId) => {
    const data = await votePoll(post._id, optionId);
    if (!data) return;
    setPosts(current => current.map(item => (
      item._id === post._id ? { ...item, poll: data.poll } : item
    )));
  });

  const startDiscussion = defaults => {
    if (!requireCommunityAuth()) return;
    if (!community.joined) {
      setNotice({ tone: 'bad', text: 'Join this community to start a discussion.' });
      return;
    }
    setPostDefaults(defaults || null);
    setCreateOpen(true);
  };

  const startWelcomePost = () => startDiscussion({
    type: 'announcement',
    title: `Welcome to ${community.name}`,
    body: `Welcome! This is the first post in ${community.name}.\n\nIntroduce yourself, tell us what you have been watching, and have a look at the rules on the About tab before you post.`,
  });

  const joinButton = target => {
    const pending = target.membershipStatus === 'pending';
    const banned = target.membershipStatus === 'banned';
    const approval = target.privacy !== 'public';
    if (target.role === 'owner') return <span className="cs-btn cs-btn-joined">Owner</span>;
    if (banned) return <span className="cs-btn cs-btn-joined">Not available</span>;
    if (target.joined || pending) {
      return (
        <button
          type="button"
          className="cs-btn cs-btn-joined"
          disabled={joining}
          title={pending ? 'Cancel your request' : 'Leave this community'}
          onClick={() => (approval && target.joined ? setConfirmLeave(true) : handleLeave(target))}
        >
          {joining ? '…' : pending ? 'Requested · Cancel' : 'Joined'}
        </button>
      );
    }
    return (
      <button type="button" className="cs-btn cs-btn-primary" disabled={joining} onClick={() => handleJoin(target)}>
        {joining ? '…' : approval ? 'Request to join' : 'Join'}
      </button>
    );
  };

  const moderators = (community?.moderators || []).filter(mod => (
    String(mod?._id || mod) !== String(community?.owner?._id || community?.owner)
  ));

  return (
    <div className="cs-comm">
      <Navbar />

      {loading && (
        <div className="cs-comm-wrap" style={{ padding: '6rem 0' }}>
          <div className="cs-skeleton" style={{ height: 240, marginBottom: 16 }} />
          <div className="cs-skeleton" style={{ height: 120 }} />
        </div>
      )}

      {!loading && error && !community && !gate && (
        <div className="cs-comm-wrap" style={{ padding: '6rem 0' }}>
          <p className="cs-error" role="alert">{error}</p>
          <Link className="cs-btn cs-btn-ghost" to="/community">Back to Community</Link>
        </div>
      )}

      {!loading && gate && (
        <>
          <CommunityHeader
            community={gate.preview}
            actions={(
              <>
                {joinButton(gate.preview)}
                <button type="button" className="cs-btn cs-btn-ghost" onClick={handleShare}>Share</button>
              </>
            )}
          />
          <div className="cs-comm-wrap">
            {notice && <p className={`cs-notice is-${notice.tone}`} role="status">{notice.text}</p>}
            <div className="cs-panel cs-gate">
              <h2>This community is {gate.preview.privacy === 'private' ? 'private' : 'members-only'}</h2>
              {gate.code === 'BANNED' ? (
                <p>You cannot join this community.</p>
              ) : gate.preview.membershipStatus === 'pending' ? (
                <p>Your request to join is waiting for the owner or a moderator. You will be notified when it is approved.</p>
              ) : (
                <p>
                  Discussions, members and media are visible only to approved members.
                  Request to join and the owner or a moderator will review it.
                </p>
              )}
              <Link className="cs-btn cs-btn-ghost" to="/community">Back to Community</Link>
            </div>
          </div>
        </>
      )}

      {!loading && community && (
        <>
          <CommunityHeader
            community={community}
            actions={(
              <>
                {joinButton(community)}
                <button type="button" className="cs-btn cs-btn-ghost" onClick={handleShare}>
                  Invite / Share
                </button>
                {viewer.canManage && (
                  <Link className="cs-btn cs-btn-ghost" to={`/community/${community.slug}/settings${viewer.pendingRequests ? '?tab=requests' : ''}`}>
                    {viewer.isOwner ? 'Settings' : 'Manage'}
                    {viewer.pendingRequests > 0 && <span className="cs-tab-count">{viewer.pendingRequests}</span>}
                  </Link>
                )}
              </>
            )}
          />

          <div className="cs-comm-wrap">
            {showWelcome && (
              <div className="cs-welcome" role="status">
                <div>
                  <span className="cs-comm-kicker">Community created</span>
                  <h2>{community.name} is live</h2>
                  <p>
                    You are the Owner and its first member.
                    {needsApproval
                      ? ' It is private, so share the link and approve requests as they arrive.'
                      : ' It is public, so it already appears in discovery.'}
                  </p>
                  {createdNotices.map(text => <p key={text} className="cs-welcome-warning">{text}</p>)}
                </div>
                <div className="cs-comm-actions">
                  <button type="button" className="cs-btn cs-btn-gold" onClick={startWelcomePost}>
                    Write a welcome post
                  </button>
                  <Link className="cs-btn cs-btn-ghost" to={`/community/${community.slug}/settings`}>
                    Open settings
                  </Link>
                  <button type="button" className="cs-link-btn" onClick={dismissWelcome}>Not now</button>
                </div>
              </div>
            )}

            {notice && <p className={`cs-notice is-${notice.tone}`} role="status">{notice.text}</p>}

            <div className="cs-tabs" role="tablist">
              {TABS.map(item => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  className={`cs-tab${tab === item.key ? ' is-active' : ''}`}
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'discussions' && (
              <div className="cs-layout" style={{ paddingBottom: '3rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div className="cs-feed-filters" style={{ marginBottom: 0 }}>
                      {POST_TABS.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          className={`cs-filter${postTab === item.key ? ' is-active' : ''}`}
                          onClick={() => setPostTab(item.key)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="cs-btn cs-btn-primary" onClick={() => startDiscussion()}>
                      Start Discussion
                    </button>
                  </div>
                  {postsLoading && <div className="cs-skeleton" style={{ height: 140 }} />}
                  {!postsLoading && !posts.length && <div className="cs-empty">No discussions in this view yet.</div>}
                  {posts.map(post => (
                    <DiscussionCard
                      key={post._id}
                      post={{ ...post, community }}
                      onReact={handleReact}
                      onBookmark={handleBookmark}
                      onOpen={openPost}
                      onVote={handleVote}
                    />
                  ))}
                </div>
                <aside className="cs-side">
                  <div className="cs-panel">
                    <h3>About</h3>
                    <p className="cs-side-summary">{community.summary || community.description}</p>
                    <p className="cs-side-privacy">
                      <strong>{COMMUNITY_PRIVACY[community.privacy]?.label}</strong>
                      {' — '}
                      {COMMUNITY_PRIVACY[community.privacy]?.summary}
                    </p>
                    <button type="button" className="cs-link-btn" onClick={() => setTab('about')}>
                      Read more and see the rules
                    </button>
                  </div>
                </aside>
              </div>
            )}

            {tab === 'about' && (
              <div className="cs-panel" style={{ marginBottom: '3rem' }}>
                <h2 className="cs-about-title">About this society</h2>
                <CommunityAbout community={community} />
                <p className="cs-meta cs-about-meta">
                  <span>Created {community.createdAt ? new Date(community.createdAt).toLocaleDateString() : '—'}</span>
                  <span>{community.categoryLabel || community.category}</span>
                  <span>{COMMUNITY_PRIVACY[community.privacy]?.label}: {COMMUNITY_PRIVACY[community.privacy]?.summary}</span>
                </p>
                <h3 className="cs-about-heading">Leadership</h3>
                <div className="cs-member-grid">
                  {community.owner && <PersonCard user={community.owner} sub="Owner" fallback="Owner" />}
                  {moderators.map(mod => (
                    <PersonCard key={mod._id || mod} user={mod} sub="Moderator" fallback="Moderator" />
                  ))}
                </div>
              </div>
            )}

            {tab === 'members' && (
              <div className="cs-member-grid" style={{ marginBottom: '3rem' }}>
                {(detail.members || []).filter(item => item.user?._id).map(item => (
                  <PersonCard
                    key={item.user._id}
                    user={item.user}
                    sub={`@${item.user.username} · ${item.role}`}
                    fallback="U"
                  />
                ))}
                {!detail.members?.length && <div className="cs-empty">No members to show.</div>}
              </div>
            )}

            {tab === 'media' && (
              <div className="cs-media-grid" style={{ marginBottom: '3rem' }}>
                {(detail.media || []).map(item => (
                  <button
                    key={`${item.postId}-${item.url}`}
                    type="button"
                    onClick={() => openPost({ _id: item.postId })}
                    style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer' }}
                    title={item.title}
                  >
                    <img src={item.url} alt={item.title || ''} loading="lazy" />
                  </button>
                ))}
                {!detail.media?.length && <div className="cs-empty">No shared media yet.</div>}
              </div>
            )}
          </div>
        </>
      )}

      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        communities={community ? [community] : []}
        defaultCommunitySlug={community?.slug}
        defaults={postDefaults}
        onCreated={post => {
          setPosts(current => [post, ...current.filter(item => item._id !== post._id)]);
          // Refreshing the counts also retires the welcome prompt: it is only
          // offered while the community has no discussions.
          loadDetail({ quiet: true });
          openPost(post);
        }}
      />

      <PostDetailModal
        postId={activePostId}
        onClose={closePost}
        onUpdated={loadPosts}
        onDeleted={() => {
          closePost();
          loadPosts();
          loadDetail({ quiet: true });
        }}
      />

      <ConfirmDialog
        open={confirmLeave}
        title={`Leave ${community?.name || 'this community'}?`}
        message="You will lose access to its discussions and will need to be approved again to return."
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onConfirm={() => handleLeave(community)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
