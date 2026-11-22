import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import DiscussionCard from '../components/community/DiscussionCard';
import CreatePostModal from '../components/community/CreatePostModal';
import PostDetailModal from '../components/community/PostDetailModal';
import { apiUrl } from '../api/config';
import {
  communityAuthHeaders,
  joinCommunity,
  leaveCommunity,
  reactToPost,
  requireCommunityAuth,
  toggleBookmark,
  votePoll,
} from '../api/community';
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

export default function CommunityDetailPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('discussions');
  const [postTab, setPostTab] = useState('latest');
  const [detail, setDetail] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activePostId, setActivePostId] = useState(searchParams.get('post') || null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`/api/community/${slug}`, {
        headers: communityAuthHeaders(),
        withCredentials: true,
      });
      setDetail(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Community not found.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
      if (!error) setError(err.response?.data?.error || 'Could not load discussions.');
    } finally {
      setPostsLoading(false);
    }
  }, [slug, postTab, error]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (tab === 'discussions') loadPosts();
  }, [tab, loadPosts]);

  useEffect(() => {
    setActivePostId(searchParams.get('post'));
  }, [searchParams]);

  const community = detail?.community;

  const handleJoinToggle = async () => {
    if (!requireCommunityAuth() || !community) return;
    setJoining(true);
    try {
      if (community.joined) await leaveCommunity(community.slug);
      else await joinCommunity(community.slug);
      await loadDetail();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not update membership.');
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/community/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: community?.name, url });
      else await navigator.clipboard.writeText(url);
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

  const handleReact = async (post, reaction) => {
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
  };

  const handleBookmark = async post => {
    const data = await toggleBookmark(post._id);
    if (!data) return;
    setPosts(current => current.map(item => (
      item._id === post._id ? { ...item, bookmarked: data.bookmarked } : item
    )));
  };

  const handleVote = async (post, optionId) => {
    const data = await votePoll(post._id, optionId);
    if (!data) return;
    setPosts(current => current.map(item => (
      item._id === post._id ? { ...item, poll: data.poll } : item
    )));
  };

  const cover = community?.coverImage || 'https://image.tmdb.org/t/p/w1280/rAiYTfKGqDCR3uUW01hBObAvzCS.jpg';

  return (
    <div className="cs-comm">
      <Navbar />

      {loading && (
        <div className="cs-comm-wrap" style={{ padding: '6rem 0' }}>
          <div className="cs-skeleton" style={{ height: 240, marginBottom: 16 }} />
          <div className="cs-skeleton" style={{ height: 120 }} />
        </div>
      )}

      {!loading && error && !community && (
        <div className="cs-comm-wrap" style={{ padding: '6rem 0' }}>
          <p className="cs-error" role="alert">{error}</p>
          <Link className="cs-btn cs-btn-ghost" to="/community">Back to Community</Link>
        </div>
      )}

      {!loading && community && (
        <>
          <header
            className="cs-comm-detail-banner"
            style={{ background: `center/cover no-repeat url(${cover})` }}
          >
            <div className="shade" />
            <div className="cs-comm-wrap">
              <div className="cs-comm-detail-content">
                {community.avatar ? (
                  <img className="cs-avatar" style={{ width: 88, height: 88 }} src={community.avatar} alt="" />
                ) : (
                  <span className="cs-avatar cs-avatar-fallback" style={{ width: 88, height: 88, fontSize: '1.6rem' }}>
                    {community.name[0]}
                  </span>
                )}
                <div>
                  <span className="cs-chip">{community.category} · {community.privacy}</span>
                  <h1 style={{ fontFamily: 'var(--vc-font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '0.4rem 0' }}>
                    {community.name}
                  </h1>
                  <p style={{ color: '#c9c2b8', maxWidth: 620, margin: '0 0 0.6rem' }}>{community.description}</p>
                  <div className="cs-meta">
                    <span>{community.memberCount || 0} members</span>
                    <span>{community.discussionCount || 0} discussions</span>
                    {community.role && <span>Your role: {community.role}</span>}
                  </div>
                </div>
                <div className="cs-comm-actions">
                  <button
                    type="button"
                    className={`cs-btn ${community.joined ? 'cs-btn-joined' : 'cs-btn-primary'}`}
                    disabled={joining}
                    onClick={handleJoinToggle}
                  >
                    {joining ? '…' : community.joined ? 'Joined' : 'Join'}
                  </button>
                  <button type="button" className="cs-btn cs-btn-ghost" onClick={handleShare}>
                    Invite / Share
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="cs-comm-wrap">
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
                    <button
                      type="button"
                      className="cs-btn cs-btn-primary"
                      onClick={() => {
                        if (!requireCommunityAuth()) return;
                        if (!community.joined) {
                          window.alert('Join this community to start a discussion.');
                          return;
                        }
                        setCreateOpen(true);
                      }}
                    >
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
                    <p style={{ color: '#a6a09a', fontSize: '0.88rem', lineHeight: 1.5 }}>{community.description}</p>
                  </div>
                </aside>
              </div>
            )}

            {tab === 'about' && (
              <div className="cs-panel" style={{ marginBottom: '3rem' }}>
                <h2 style={{ fontFamily: 'var(--vc-font-display)', marginTop: 0 }}>About this society</h2>
                <p style={{ color: '#d8d1c7', lineHeight: 1.6 }}>{community.description}</p>
                <p className="cs-meta">
                  <span>Created {community.createdAt ? new Date(community.createdAt).toLocaleDateString() : '—'}</span>
                  <span>Privacy: {community.privacy}</span>
                </p>
                <h3 style={{ fontFamily: 'var(--vc-font-display)' }}>Rules</h3>
                {!community.rules?.length ? (
                  <p className="cs-empty" style={{ padding: 0 }}>No formal rules published.</p>
                ) : (
                  <ol style={{ color: '#d8d1c7', lineHeight: 1.55 }}>
                    {community.rules.map(rule => <li key={rule}>{rule}</li>)}
                  </ol>
                )}
                <h3 style={{ fontFamily: 'var(--vc-font-display)' }}>Leadership</h3>
                <div className="cs-member-grid">
                  {community.owner && (
                    <Link className="cs-member" to={`/people/${community.owner._id || community.owner}`}>
                      {avatarUrl(community.owner) ? (
                        <img className="cs-avatar" src={avatarUrl(community.owner)} alt="" />
                      ) : (
                        <span className="cs-avatar cs-avatar-fallback">{(community.owner.username || 'O')[0]}</span>
                      )}
                      <div>
                        <strong>{community.owner.name || community.owner.username || 'Owner'}</strong>
                        <div className="cs-post-sub">Owner</div>
                      </div>
                    </Link>
                  )}
                  {(community.moderators || []).map(mod => (
                    <Link key={mod._id || mod} className="cs-member" to={`/people/${mod._id || mod}`}>
                      {avatarUrl(mod) ? (
                        <img className="cs-avatar" src={avatarUrl(mod)} alt="" />
                      ) : (
                        <span className="cs-avatar cs-avatar-fallback">{(mod.username || 'M')[0]}</span>
                      )}
                      <div>
                        <strong>{mod.name || mod.username || 'Moderator'}</strong>
                        <div className="cs-post-sub">Moderator</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tab === 'members' && (
              <div className="cs-member-grid" style={{ marginBottom: '3rem' }}>
                {(detail.members || []).map(item => (
                  <Link key={item.user?._id || item.user} className="cs-member" to={`/people/${item.user?._id}`}>
                    {avatarUrl(item.user) ? (
                      <img className="cs-avatar" src={avatarUrl(item.user)} alt="" />
                    ) : (
                      <span className="cs-avatar cs-avatar-fallback">{(item.user?.username || 'U')[0]}</span>
                    )}
                    <div>
                      <strong>{item.user?.name || item.user?.username}</strong>
                      <div className="cs-post-sub">@{item.user?.username} · {item.role}</div>
                      {item.user?.bio && (
                        <div style={{ color: '#a6a09a', fontSize: '0.78rem', marginTop: 4 }}>
                          {String(item.user.bio).slice(0, 90)}
                        </div>
                      )}
                    </div>
                  </Link>
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
        onCreated={post => {
          setPosts(current => [post, ...current]);
          loadDetail();
          openPost(post);
        }}
      />

      <PostDetailModal postId={activePostId} onClose={closePost} onUpdated={loadPosts} />
    </div>
  );
}
