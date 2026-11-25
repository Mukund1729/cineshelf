import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CommunityHero from '../components/community/CommunityHero';
import CommunityStats from '../components/community/CommunityStats';
import FeaturedCommunities from '../components/community/FeaturedCommunities';
import YourCircle from '../components/community/YourCircle';
import DiscussionFeed from '../components/community/DiscussionFeed';
import TrendingCommunities from '../components/community/TrendingCommunities';
import MovieDiscussionSpotlight from '../components/community/MovieDiscussionSpotlight';
import CommunityBrowser from '../components/community/CommunityBrowser';
import CreatePostModal from '../components/community/CreatePostModal';
import PostDetailModal from '../components/community/PostDetailModal';
import {
  fetchCommunityFeed,
  fetchCommunityHome,
  fetchCommunitySpotlight,
  joinCommunity,
  reactToPost,
  toggleBookmark,
  votePoll,
} from '../api/community';
import { hasAuthSession } from '../api/session';
import './community.css';

export default function CommunityPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const featuredRef = useRef(null);

  const [home, setHome] = useState(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState('');
  const [filter, setFilter] = useState('latest');
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [spotlight, setSpotlight] = useState(null);
  const [spotlightPosts, setSpotlightPosts] = useState([]);
  const [joiningId, setJoiningId] = useState('');
  const [browseKey, setBrowseKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [postOpen, setPostOpen] = useState(false);
  const [defaultMovie, setDefaultMovie] = useState(null);
  const [activePostId, setActivePostId] = useState(searchParams.get('post') || null);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setHomeError('');
    try {
      const data = await fetchCommunityHome();
      setHome(data);
    } catch (err) {
      setHomeError(err.response?.data?.error || 'Could not load the cinematic society.');
    } finally {
      setHomeLoading(false);
    }
  }, []);

  const loadFeed = useCallback(async (nextFilter = filter) => {
    setFeedLoading(true);
    setFeedError('');
    try {
      const data = await fetchCommunityFeed(nextFilter);
      setPosts(data.posts || []);
    } catch (err) {
      setFeedError(err.response?.data?.error || 'Could not load discussions.');
    } finally {
      setFeedLoading(false);
    }
  }, [filter]);

  const loadSpotlight = useCallback(async () => {
    try {
      const data = await fetchCommunitySpotlight();
      setSpotlight(data.spotlight || null);
      setSpotlightPosts(data.posts || []);
    } catch {
      setSpotlight(null);
      setSpotlightPosts([]);
    }
  }, []);

  useEffect(() => {
    loadHome();
    loadSpotlight();
  }, [loadHome, loadSpotlight]);

  useEffect(() => {
    loadFeed(filter);
  }, [filter, loadFeed]);

  useEffect(() => {
    const postId = searchParams.get('post');
    setActivePostId(postId);
  }, [searchParams]);

  const communityChoices = useMemo(() => {
    const map = new Map();
    [...(home?.circle?.joined || []), ...(home?.featured || []), ...(home?.trending || [])]
      .forEach(item => {
        if (item?.slug) map.set(item.slug, item);
      });
    return [...map.values()];
  }, [home]);

  // Opens the multi-step community setup page.
  const openCommunitySetup = () => navigate('/community/new');

  const handleJoin = async community => {
    setJoiningId(community._id);
    setNotice('');
    try {
      const data = await joinCommunity(community.slug);
      if (!data) return;
      if (data.pending) {
        setNotice(`Request sent to ${community.name}. You will be notified when it is approved.`);
      }
      setBrowseKey(current => current + 1);
      await loadHome();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not join community.');
    } finally {
      setJoiningId('');
    }
  };

  const handleReact = async (post, reaction) => {
    try {
      const data = await reactToPost(post._id, reaction);
      if (!data) return;
      setPosts(current => current.map(item => (
        item._id === post._id
          ? {
            ...item,
            reactionCounts: data.reactionCounts,
            myReactions: {
              ...item.myReactions,
              [reaction]: !item.myReactions?.[reaction],
            },
          }
          : item
      )));
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not react.');
    }
  };

  const handleBookmark = async post => {
    try {
      const data = await toggleBookmark(post._id);
      if (!data) return;
      setPosts(current => current.map(item => (
        item._id === post._id ? { ...item, bookmarked: data.bookmarked } : item
      )));
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not save post.');
    }
  };

  const handleVote = async (post, optionId) => {
    try {
      const data = await votePoll(post._id, optionId);
      if (!data) return;
      setPosts(current => current.map(item => (
        item._id === post._id ? { ...item, poll: data.poll } : item
      )));
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not vote.');
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

  const startDiscussion = movie => {
    if (!hasAuthSession()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    if (!communityChoices.length) {
      openCommunitySetup();
      return;
    }
    setDefaultMovie(movie || null);
    setPostOpen(true);
  };

  return (
    <div className="cs-comm">
      <Navbar />
      <CommunityHero
        onExplore={() => featuredRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onStartDiscussion={() => startDiscussion()}
      />

      {homeError && (
        <div className="cs-comm-wrap">
          <p className="cs-error" role="alert">{homeError}</p>
        </div>
      )}

      <CommunityStats stats={home?.stats} loading={homeLoading} />

      <FeaturedCommunities
        sectionRef={featuredRef}
        communities={home?.featured || []}
        onJoin={handleJoin}
        joiningId={joiningId}
      />

      {notice && (
        <div className="cs-comm-wrap">
          <p className="cs-notice is-ok" role="status">{notice}</p>
        </div>
      )}

      <CommunityBrowser
        onJoin={handleJoin}
        joiningId={joiningId}
        refreshKey={browseKey}
        onCreate={openCommunitySetup}
      />

      <YourCircle
        circle={home?.circle}
        onJoin={handleJoin}
        joiningId={joiningId}
        onReact={handleReact}
        onBookmark={handleBookmark}
        onOpen={openPost}
        onSignIn={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
      />

      <section className="cs-section" id="discussion-room">
        <div className="cs-comm-wrap">
          <div className="cs-section-head">
            <div>
              <h2>The Discussion Room</h2>
              <p>Editorial conversations from across the society.</p>
            </div>
            <div className="cs-comm-actions">
              <button type="button" className="cs-btn cs-btn-ghost" onClick={openCommunitySetup}>
                Found a Society
              </button>
              <button type="button" className="cs-btn cs-btn-primary" onClick={() => startDiscussion()}>
                Start a Discussion
              </button>
            </div>
          </div>
          <div className="cs-layout">
            <DiscussionFeed
              filter={filter}
              onFilterChange={setFilter}
              posts={posts}
              loading={feedLoading}
              error={feedError}
              onReact={handleReact}
              onBookmark={handleBookmark}
              onOpen={openPost}
              onVote={handleVote}
            />
            <TrendingCommunities
              trending={home?.trending || []}
              popularPosts={[...posts].sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0))}
              suggested={(home?.featured || []).filter(item => !item.joined)}
            />
          </div>
        </div>
      </section>

      <MovieDiscussionSpotlight
        spotlight={spotlight}
        posts={spotlightPosts}
        onStartDiscussion={startDiscussion}
      />

      <CreatePostModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        communities={communityChoices}
        defaultMovie={defaultMovie}
        onCreated={post => {
          setPosts(current => [post, ...current]);
          loadHome();
          loadSpotlight();
          if (post?._id) openPost(post);
        }}
      />

      <PostDetailModal
        postId={activePostId}
        onClose={closePost}
        onUpdated={() => loadFeed(filter)}
      />
    </div>
  );
}
