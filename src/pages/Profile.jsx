import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';
import { searchMovies, tmdbImageUrl } from '../api/tmdb';
import { hasAuthSession } from '../api/session';
import { buildCinemaTaste } from '../utils/cinemaTaste';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'diary', label: 'Diary' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'lists', label: 'Lists' },
  { id: 'communities', label: 'Communities' },
];

const emptySocials = { instagram: '', twitter: '', website: '' };

function posterSrc(path, size = 'w185') {
  if (!path) return '/placeholder-movie.jpg';
  return tmdbImageUrl(path, size);
}

function formatJoinDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

function formatWatchedDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function Stars({ rating }) {
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  const score = Number(rating);
  return (
    <span className="vc-profile-rating" title={`${score}/10`}>
      ★ {score}/10
    </span>
  );
}

/** Soften ALL-CAPS names for display only — never mutates saved data. */
function displayName(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
  return trimmed;
}

function resolveMediaUrl(path) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  if (path.startsWith('/')) return apiUrl(path);
  return path;
}

const Profile = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const [profile, setProfile] = useState(null);
  const [sakha, setSakha] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [lists, setLists] = useState([]);
  const [diary, setDiary] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [activityError, setActivityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    bio: '',
    avatar: '',
    coverImage: '',
    socials: { ...emptySocials },
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [clearCoverOnSave, setClearCoverOnSave] = useState(false);
  const [editingTop4, setEditingTop4] = useState(false);
  const [top4Draft, setTop4Draft] = useState([]);
  const [top4Query, setTop4Query] = useState('');
  const [top4Results, setTop4Results] = useState([]);
  const [top4Saving, setTop4Saving] = useState(false);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    const next = searchParams.get('tab');
    if (TABS.some(t => t.id === next) && next !== tab) setTab(next);
  }, [searchParams]);

  const selectTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!hasAuthSession()) {
        setError('Please login to view your profile');
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const profileRes = await axios.get('/api/user/profile', { headers, withCredentials: true });
      const profileData = profileRes.data?.data || profileRes.data;
      const currentProfile = profileData?.user || profileData;
      setProfile(currentProfile);
      setEditForm({
        name: currentProfile?.name || '',
        username: currentProfile?.username || '',
        bio: currentProfile?.bio || '',
        avatar: currentProfile?.avatar || '',
        coverImage: currentProfile?.coverImage || '',
        socials: currentProfile?.socials || { ...emptySocials },
      });
      setTop4Draft((currentProfile?.favouriteMovies || []).slice(0, 4));

      const results = await Promise.allSettled([
        axios.get('/api/watchlist', { headers, withCredentials: true }),
        axios.get('/api/review', { headers, withCredentials: true }),
        axios.get('/api/lists', { headers, withCredentials: true }),
        axios.get('/api/diary', { headers, withCredentials: true }),
        axios.get('/api/people/sakha', { headers, withCredentials: true }),
        axios.get('/api/community/me', { headers, withCredentials: true }),
      ]);

      const [watchlistResult, reviewsResult, listsResult, diaryResult, friendsResult, communitiesResult] = results;
      if (watchlistResult.status === 'fulfilled') {
        setWatchlist(watchlistResult.value.data?.movies || []);
      }
      if (reviewsResult.status === 'fulfilled') {
        setReviews(reviewsResult.value.data?.data || reviewsResult.value.data?.reviews || []);
      }
      if (listsResult.status === 'fulfilled') {
        setLists(listsResult.value.data?.data || []);
      }
      if (diaryResult.status === 'fulfilled') {
        setDiary(diaryResult.value.data?.data || []);
      }
      if (friendsResult.status === 'fulfilled') {
        setSakha(friendsResult.value.data?.data || []);
      }
      if (communitiesResult.status === 'fulfilled') {
        setCommunities(communitiesResult.value.data?.communities || []);
      }
      if (results.some(result => result.status === 'rejected')) {
        setActivityError('Some sections failed to load. Refresh and try again.');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data');
      setLoading(false);
    }
  };

  const taste = useMemo(
    () => buildCinemaTaste({ profile, reviews, diary, watchlist }),
    [profile, reviews, diary, watchlist]
  );

  const uniqueWatched = taste.uniqueWatched;

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('socials.')) {
      const socialKey = name.split('.')[1];
      setEditForm(prev => ({
        ...prev,
        socials: { ...prev.socials, [socialKey]: value },
      }));
      return;
    }
    const nextValue = name === 'username' ? value.replace(/^@+/, '').replace(/\s+/g, '') : value;
    setEditForm(prev => ({ ...prev, [name]: nextValue }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError('Avatar must be under 8 MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    }
    e.target.value = '';
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file for your cover');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError('Cover photo must be under 8 MB');
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setClearCoverOnSave(false);
      setError('');
    }
    e.target.value = '';
  };

  const getAvatarUrl = (avatar) => resolveMediaUrl(avatar);

  const getDefaultAvatar = (name) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="#1a1a1a"/>
        <circle cx="60" cy="40" r="15" fill="#4a5568"/>
        <path d="M10 100C10 85 22 73 37 73H83C98 73 110 85 110 100V110H10V100Z" fill="#4a5568"/>
        <text x="60" y="65" font-family="Manrope, Helvetica Neue, sans-serif" font-size="24" font-weight="bold" fill="#e2e8f0" text-anchor="middle">${initials}</text>
      </svg>
    `)}`;
  };

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const handleSaveProfile = async () => {
    try {
      if (!hasAuthSession()) {
        setError('No authentication token found. Please login again.');
        return;
      }

      const nextName = editForm.name.trim();
      const nextUsername = editForm.username.trim().replace(/^@+/, '');
      if (nextName.length < 2 || nextName.length > 80) {
        setError('Name must be between 2 and 80 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(nextUsername)) {
        setError('Username must be 3–30 letters, numbers, dots, underscores, or hyphens.');
        return;
      }

      const headers = authHeaders();
      let avatarUrl = editForm.avatar;
      let coverUrl = editForm.coverImage;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        try {
          const uploadRes = await axios.post('/api/user/avatar', formData, {
            headers,
            withCredentials: true,
            timeout: 15000,
          });
          const uploadData = uploadRes.data?.data || uploadRes.data;
          avatarUrl = uploadData?.avatarUrl || uploadData?.user?.avatar || editForm.avatar;
        } catch (uploadErr) {
          console.error('Avatar upload failed:', uploadErr);
          setError(`Avatar upload failed: ${uploadErr.response?.data?.error || uploadErr.message}`);
          return;
        }
      }

      if (clearCoverOnSave) {
        try {
          const clearRes = await axios.delete('/api/user/cover', { headers, withCredentials: true });
          const cleared = clearRes.data?.data?.user;
          if (cleared) coverUrl = '';
        } catch (clearErr) {
          setError(clearErr.response?.data?.error || 'Could not remove cover photo');
          return;
        }
      } else if (coverFile) {
        const formData = new FormData();
        formData.append('cover', coverFile);
        try {
          const uploadRes = await axios.post('/api/user/cover', formData, {
            headers,
            withCredentials: true,
            timeout: 20000,
          });
          const uploadData = uploadRes.data?.data || uploadRes.data;
          coverUrl = uploadData?.coverUrl || uploadData?.user?.coverImage || editForm.coverImage;
        } catch (uploadErr) {
          console.error('Cover upload failed:', uploadErr);
          setError(`Cover upload failed: ${uploadErr.response?.data?.error || uploadErr.message}`);
          return;
        }
      }

      const updateData = {
        ...editForm,
        name: nextName,
        username: nextUsername,
        bio: editForm.bio.trim(),
        avatar: avatarUrl,
        coverImage: (coverUrl || '').trim(),
      };

      const profileRes = await axios.put('/api/user/profile', updateData, { headers, withCredentials: true });
      const profileData = profileRes.data?.data || profileRes.data;
      const savedProfile = profileData?.user || profileData;
      setProfile(savedProfile);
      const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...cachedUser, ...savedProfile };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedUser }));
      setMessage('Profile updated');
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview('');
      setCoverFile(null);
      setCoverPreview('');
      setClearCoverOnSave(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update profile');
      setTimeout(() => setError(''), 5000);
    }
  };

  const searchTop4 = async (query) => {
    setTop4Query(query);
    if (!query.trim()) {
      setTop4Results([]);
      return;
    }
    try {
      const res = await searchMovies(query.trim());
      setTop4Results((res.results || []).slice(0, 8));
    } catch {
      setTop4Results([]);
    }
  };

  const addTop4Movie = (movie) => {
    if (!movie?.id) return;
    const rawPoster = movie.poster_path || movie.posterPath || movie.poster || '';
    // Prefer a TMDB relative path when the client already expanded it to a proxy URL.
    const posterMatch = String(rawPoster).match(/\/([^/?]+\.(?:jpg|jpeg|png|webp))(?:\?|$)/i);
    const poster = posterMatch ? `/${posterMatch[1]}` : rawPoster;
    setTop4Draft(prev => {
      if (prev.some(m => Number(m.tmdbId) === Number(movie.id))) return prev;
      if (prev.length >= 4) return prev;
      return [
        ...prev,
        {
          tmdbId: movie.id,
          title: movie.title,
          poster,
        },
      ];
    });
    setTop4Query('');
    setTop4Results([]);
  };

  const removeTop4Movie = (tmdbId) => {
    setTop4Draft(prev => prev.filter(m => Number(m.tmdbId) !== Number(tmdbId)));
  };

  const saveTop4 = async () => {
    if (!hasAuthSession()) return;
    setTop4Saving(true);
    try {
      const headers = authHeaders();
      const profileRes = await axios.put(
        '/api/user/profile',
        { favouriteMovies: top4Draft.slice(0, 4) },
        { headers, withCredentials: true }
      );
      const profileData = profileRes.data?.data || profileRes.data;
      const savedProfile = profileData?.user || profileData;
      setProfile(savedProfile);
      setTop4Draft((savedProfile?.favouriteMovies || []).slice(0, 4));
      setEditingTop4(false);
      setMessage('Top 4 saved.');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save Top 4');
      setTimeout(() => setError(''), 4000);
    } finally {
      setTop4Saving(false);
    }
  };

  const shareProfile = async () => {
    if (!profile?._id) return;
    const url = `${window.location.origin}/people/${profile._id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote('Profile link copied');
    } catch {
      setShareNote(url);
    }
    setTimeout(() => setShareNote(''), 2500);
  };

  const coverUrl = clearCoverOnSave
    ? null
    : (coverPreview || resolveMediaUrl(profile?.coverImage));

  if (loading) {
    return (
      <div className="vc-profile-page" style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--vc-font-body)', color: 'var(--vc-slate)' }}>Loading profile…</p>
      </div>
    );
  }

  if ((error && !profile) || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="vc-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '2rem', color: 'var(--vc-red)', marginBottom: '1rem' }}>
            {error || 'Profile Not Found'}
          </h2>
          <Link to="/" style={{ color: 'var(--vc-gold)', textDecoration: 'none' }}>Go back to home</Link>
        </div>
      </div>
    );
  }

  const top4 = (profile.favouriteMovies || []).slice(0, 4);
  const joinDate = formatJoinDate(profile.createdAt);

  const SectionHead = ({ title, to, actionLabel = 'View all' }) => (
    <div className="vc-profile-section-head">
      <h3 className="vc-profile-section-title">{title}</h3>
      {to && (
        <Link to={to} className="vc-profile-section-link">
          {actionLabel}
        </Link>
      )}
    </div>
  );

  const WatchlistGrid = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) {
      return <p className="vc-profile-empty">Watchlist is empty.</p>;
    }
    return (
      <div className="vc-profile-poster-row">
        {list.map(movie => (
          <Link
            key={`${movie.tmdbId || movie.id}-${movie.mediaType || 'movie'}`}
            to={`/${movie.mediaType === 'tv' ? 'tv' : 'movie'}/${movie.tmdbId || movie.id}`}
            className="vc-profile-poster-card"
          >
            <img src={posterSrc(movie.posterUrl || movie.poster)} alt={movie.title} loading="lazy" />
            <div className="vc-profile-poster-meta">
              <span>{movie.title}</span>
              {movie.releaseDate && <small>{String(movie.releaseDate).slice(0, 4)}</small>}
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const ReviewsList = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) {
      return <p className="vc-profile-empty">No reviews yet.</p>;
    }
    return (
      <div className="vc-profile-review-list">
        {list.map(review => (
          <article key={review._id} className="vc-profile-review-card">
            <Link
              to={`/${review.mediaType === 'tv' ? 'tv' : 'movie'}/${review.source === 'original' ? review.originalId : review.tmdbId}`}
              className="vc-profile-review-poster"
            >
              <img src={posterSrc(review.poster, 'w92')} alt="" loading="lazy" />
            </Link>
            <div className="vc-profile-review-body">
              <div className="vc-profile-review-top">
                <Link
                  to={`/${review.mediaType === 'tv' ? 'tv' : 'movie'}/${review.source === 'original' ? review.originalId : review.tmdbId}`}
                  className="vc-profile-review-title"
                >
                  {review.title || 'Untitled'}
                </Link>
                <Stars rating={review.rating} />
              </div>
              {review.review ? (
                <p className="vc-profile-review-text">{review.review}</p>
              ) : (
                <p className="vc-profile-muted">Rating only</p>
              )}
              <div className="vc-profile-review-foot">
                <span className="vc-profile-muted">
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                </span>
                <Link to={`/review/${review._id}`} className="vc-profile-section-link">Open</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const DiaryTimeline = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) {
      return <p className="vc-profile-empty">No diary entries yet.</p>;
    }
    return (
      <div className="vc-profile-diary-list">
        {list.map(entry => (
          <div key={entry._id} className="vc-profile-diary-item">
            {entry.poster && <img src={posterSrc(entry.poster, 'w92')} alt="" className="vc-profile-diary-poster" loading="lazy" />}
            <div className="vc-profile-diary-body">
              <Link
                to={`/${entry.mediaType === 'tv' ? 'tv' : 'movie'}/${entry.source === 'original' ? entry.originalId : entry.tmdbId}`}
                className="vc-profile-review-title"
              >
                {entry.title}
              </Link>
              <p className="vc-profile-muted">
                Watched {formatWatchedDate(entry.watchedAt)}
                {entry.rating != null && ` · ★ ${entry.rating}/10`}
              </p>
              {entry.note && <p className="vc-profile-note">{entry.note}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ListsGrid = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) {
      return <p className="vc-profile-empty">No lists yet.</p>;
    }
    return (
      <div className="vc-profile-lists-grid">
        {list.map(listItem => (
          <Link key={listItem._id} to="/lists" className="vc-profile-list-card">
            <div className="vc-profile-list-cover" aria-hidden="true" />
            <div className="vc-profile-list-title">{listItem.name}</div>
            {listItem.description && <p className="vc-profile-muted">{listItem.description}</p>}
            <div className="vc-profile-muted vc-profile-list-meta">
              {listItem.items?.length || 0} titles · {listItem.isPublic ? 'Public' : 'Private'}
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const CommunitiesGrid = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) {
      return <p className="vc-profile-empty">No communities yet.</p>;
    }
    return (
      <div className="vc-profile-lists-grid">
        {list.map(community => (
          <Link key={community._id} to={`/community/${community.slug}`} className="vc-profile-list-card">
            <div className="vc-profile-list-title">{community.name}</div>
            <p className="vc-profile-muted">{community.description}</p>
            <div className="vc-profile-muted vc-profile-list-meta">
              {community.role || 'member'} · {community.memberCount || 0} members
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="vc-profile-page" style={{ minHeight: '100vh', background: '#0D0D0F', color: 'var(--vc-cream)' }}>
      <Navbar />

      <header className="vc-profile-cover">
        <div
          className="vc-profile-cover-bg"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          aria-hidden="true"
        />
        <div className="vc-profile-cover-shade" aria-hidden="true" />
        <div className="vc-container vc-profile-cover-inner">
          <img
            className="vc-profile-avatar"
            src={getAvatarUrl(profile.avatar) || getDefaultAvatar(profile.name || profile.username)}
            alt={`${profile.name || profile.username}'s profile`}
            onError={e => { e.currentTarget.src = getDefaultAvatar(profile.name || profile.username); }}
          />
          <div className="vc-profile-heading-copy">
            <h1 className="vc-profile-name">{displayName(profile.name || profile.username)}</h1>
            {profile.username && <p className="vc-profile-username">@{profile.username}</p>}
            {profile.bio?.trim() && (
              <p className="vc-profile-bio">{profile.bio.trim()}</p>
            )}
            {joinDate && <p className="vc-profile-joined">Joined {joinDate}</p>}
            <div className="vc-profile-actions">
              <button type="button" className="vc-btn vc-btn-primary" onClick={() => setEditing(v => !v)}>
                {editing ? 'Cancel' : 'Edit profile'}
              </button>
              <button type="button" className="vc-btn vc-btn-outline" onClick={shareProfile}>
                Share profile
              </button>
              {shareNote && <span className="vc-profile-share-note">{shareNote}</span>}
            </div>
            {(profile.socials?.instagram || profile.socials?.twitter || profile.socials?.website) && (
              <div className="vc-profile-socials">
                {profile.socials?.instagram && (
                  <a href={profile.socials.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
                )}
                {profile.socials?.twitter && (
                  <a href={profile.socials.twitter} target="_blank" rel="noopener noreferrer">Twitter</a>
                )}
                {profile.socials?.website && (
                  <a href={profile.socials.website} target="_blank" rel="noopener noreferrer">Website</a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="vc-container vc-profile-stats-wrap">
        <div className="vc-profile-stats" role="navigation" aria-label="Profile statistics">
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('diary')}>
            <div className="vc-profile-stat-value">{uniqueWatched}</div>
            <div className="vc-profile-stat-label">Watched</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('reviews')}>
            <div className="vc-profile-stat-value">{reviews.length}</div>
            <div className="vc-profile-stat-label">Reviews</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('watchlist')}>
            <div className="vc-profile-stat-value">{watchlist.length}</div>
            <div className="vc-profile-stat-label">Watchlist</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('diary')}>
            <div className="vc-profile-stat-value">{diary.length}</div>
            <div className="vc-profile-stat-label">Diary</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('lists')}>
            <div className="vc-profile-stat-value">{lists.length}</div>
            <div className="vc-profile-stat-label">Lists</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('overview')}>
            <div className="vc-profile-stat-value">{sakha.length}</div>
            <div className="vc-profile-stat-label">Friends</div>
          </button>
        </div>
        {activityError && <p role="status" className="vc-profile-activity-error">{activityError}</p>}
      </div>

      {(message || error) && (
        <div className="vc-container" style={{ marginBottom: '1rem' }}>
          {message && <p className="vc-profile-toast ok">{message}</p>}
          {error && <p className="vc-profile-toast err">{error}</p>}
        </div>
      )}

      {editing && (
        <div className="vc-container mb-8">
          <div className="vc-profile-form vc-card">
            <h3 className="vc-section-heading" style={{ marginBottom: '1.25rem' }}>Edit profile</h3>
            <div className="space-y-4">
              <div className="vc-avatar-picker">
                <img
                  src={avatarPreview || getAvatarUrl(editForm.avatar) || getDefaultAvatar(editForm.name)}
                  alt="Profile preview"
                  className="vc-profile-avatar"
                  onError={e => { e.currentTarget.src = getDefaultAvatar(editForm.name); }}
                />
                <div>
                  <label className="vc-profile-label" htmlFor="profile-avatar">Profile photo</label>
                  <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="vc-input vc-avatar-input" />
                  <p className="vc-profile-hint">JPG, PNG, WebP or GIF · max 8 MB</p>
                </div>
              </div>
              <div className="vc-cover-picker">
                <div
                  className="vc-cover-picker-preview"
                  style={{
                    backgroundImage: `url(${coverPreview || resolveMediaUrl(editForm.coverImage) || ''})`,
                  }}
                >
                  {!coverPreview && !editForm.coverImage && !clearCoverOnSave && (
                    <span>No cover</span>
                  )}
                  {clearCoverOnSave && <span>Cover will be removed</span>}
                </div>
                <div>
                  <label className="vc-profile-label" htmlFor="profile-cover-file">Cover photo</label>
                  <input
                    id="profile-cover-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleCoverUpload}
                    className="vc-input vc-avatar-input"
                  />
                  <p className="vc-profile-hint">Pick a photo from your device · max 8 MB</p>
                  {(editForm.coverImage || coverPreview) && !clearCoverOnSave && (
                    <button
                      type="button"
                      className="vc-profile-section-link"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview('');
                        setClearCoverOnSave(true);
                        setEditForm(prev => ({ ...prev, coverImage: '' }));
                      }}
                    >
                      Remove cover
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="vc-profile-label" htmlFor="profile-name">Full Name</label>
                <input id="profile-name" type="text" name="name" value={editForm.name} onChange={handleEditChange} className="vc-input" />
              </div>
              <div>
                <label className="vc-profile-label" htmlFor="profile-username">Username</label>
                <div className="vc-username-field">
                  <span className="vc-username-prefix" aria-hidden="true">@</span>
                  <input
                    id="profile-username"
                    type="text"
                    name="username"
                    value={editForm.username}
                    onChange={handleEditChange}
                    className="vc-input"
                    maxLength={30}
                  />
                </div>
              </div>
              <div>
                <label className="vc-profile-label" htmlFor="profile-bio">Bio</label>
                <textarea id="profile-bio" name="bio" value={editForm.bio} onChange={handleEditChange} rows={3} className="vc-input vc-textarea" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="vc-profile-label" htmlFor="profile-instagram">Instagram</label>
                  <input id="profile-instagram" type="url" name="socials.instagram" value={editForm.socials.instagram || ''} onChange={handleEditChange} className="vc-input" />
                </div>
                <div>
                  <label className="vc-profile-label" htmlFor="profile-twitter">Twitter</label>
                  <input id="profile-twitter" type="url" name="socials.twitter" value={editForm.socials.twitter || ''} onChange={handleEditChange} className="vc-input" />
                </div>
                <div>
                  <label className="vc-profile-label" htmlFor="profile-website">Website</label>
                  <input id="profile-website" type="url" name="socials.website" value={editForm.socials.website || ''} onChange={handleEditChange} className="vc-input" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={handleSaveProfile} className="vc-btn vc-btn-primary">Save Changes</button>
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  onClick={() => {
                    setEditing(false);
                    setAvatarFile(null);
                    setAvatarPreview('');
                    setCoverFile(null);
                    setCoverPreview('');
                    setClearCoverOnSave(false);
                    setEditForm({
                      name: profile.name || '',
                      username: profile.username || '',
                      bio: profile.bio || '',
                      avatar: profile.avatar || '',
                      coverImage: profile.coverImage || '',
                      socials: profile.socials || { ...emptySocials },
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="vc-container vc-profile-tabs" aria-label="Profile sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`vc-profile-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="vc-container vc-profile-body">
        {tab === 'overview' && (
          <div className="vc-profile-layout">
            <div className="vc-profile-main">
              <section className="vc-profile-panel">
                <div className="vc-profile-section-head">
                  <h3 className="vc-profile-section-title">Top 4</h3>
                  <button
                    type="button"
                    className="vc-profile-section-link"
                    onClick={() => {
                      setTop4Draft((profile.favouriteMovies || []).slice(0, 4));
                      setEditingTop4(v => !v);
                    }}
                  >
                    {editingTop4 ? 'Done' : 'Edit'}
                  </button>
                </div>
                {!editingTop4 && (
                  top4.length ? (
                    <div className="vc-profile-top4">
                      {top4.map(movie => (
                        <Link key={movie.tmdbId} to={`/movie/${movie.tmdbId}`} className="vc-profile-top4-card">
                          <img src={posterSrc(movie.poster, 'w342')} alt={movie.title} loading="lazy" />
                          <div>
                            <strong>{movie.title}</strong>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="vc-profile-empty">Add up to 4 favourite films.</p>
                  )
                )}
                {editingTop4 && (
                  <div className="vc-profile-top4-editor">
                    <div className="vc-profile-top4">
                      {[0, 1, 2, 3].map(slot => {
                        const movie = top4Draft[slot];
                        return (
                          <div key={slot} className="vc-profile-top4-slot">
                            {movie ? (
                              <>
                                <img src={posterSrc(movie.poster, 'w185')} alt={movie.title} />
                                <button type="button" onClick={() => removeTop4Movie(movie.tmdbId)}>Remove</button>
                                <span>{movie.title}</span>
                              </>
                            ) : (
                              <span className="vc-profile-muted">Empty</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {top4Draft.length < 4 && (
                      <div className="vc-profile-top4-search">
                        <input
                          className="vc-input"
                          value={top4Query}
                          onChange={e => searchTop4(e.target.value)}
                          placeholder="Search for a movie…"
                        />
                        {top4Results.length > 0 && (
                          <ul className="vc-profile-top4-results">
                            {top4Results.map(movie => (
                              <li key={movie.id}>
                                <button type="button" onClick={() => addTop4Movie(movie)}>
                                  {movie.title}{movie.release_date ? ` (${String(movie.release_date).slice(0, 4)})` : ''}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <button type="button" className="vc-btn vc-btn-primary" disabled={top4Saving} onClick={saveTop4}>
                      {top4Saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Watchlist" to="/watchlist" />
                <WatchlistGrid items={watchlist} limit={8} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Reviews" to="/reviews" />
                <ReviewsList items={reviews} limit={3} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Diary" to="/diary" actionLabel="View all" />
                <DiaryTimeline items={diary} limit={5} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Lists" to="/lists" />
                <ListsGrid items={lists} limit={4} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Communities" to="/community" actionLabel="Browse" />
                <CommunitiesGrid items={communities} limit={4} />
              </section>
            </div>

            <aside className="vc-profile-side">
              <section className="vc-profile-panel">
                <SectionHead title="Friends" to="/people" actionLabel="View all" />
                {sakha.length === 0 ? (
                  <p className="vc-profile-empty">No friends yet.</p>
                ) : (
                  <ul className="vc-profile-friends">
                    {sakha.slice(0, 8).map((friend, index) => (
                      <li key={friend._id || friend.id || `friend-${index}`}>
                        <Link to={`/people/${friend._id || friend.id}`} className="vc-profile-friend">
                          <img
                            src={getAvatarUrl(friend.avatar) || getDefaultAvatar(friend.name || friend.username)}
                            alt=""
                            onError={e => { e.currentTarget.src = getDefaultAvatar(friend.name || friend.username); }}
                          />
                          <div>
                            <strong>{friend.name || friend.username}</strong>
                            <span>@{friend.username}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="vc-profile-panel">
                <h3 className="vc-profile-section-title">Stats</h3>
                {!taste.hasSignal ? (
                  <p className="vc-profile-empty">
                    Stats show up after you rate films or add diary entries.
                  </p>
                ) : (
                  <dl className="vc-profile-taste">
                    {taste.averageRating != null && (
                      <>
                        <dt>Avg rating</dt>
                        <dd>{taste.averageRating}/10 · {taste.reviewCount} reviews</dd>
                      </>
                    )}
                    {taste.favouriteGenres.length > 0 && (
                      <>
                        <dt>Genres</dt>
                        <dd>{taste.favouriteGenres.join(', ')}</dd>
                      </>
                    )}
                    {taste.mostWatchedGenres.length > 0 && (
                      <>
                        <dt>Watchlist genres</dt>
                        <dd>{taste.mostWatchedGenres.map(g => g.name).join(', ')}</dd>
                      </>
                    )}
                    {taste.favouriteLanguages.length > 0 && (
                      <>
                        <dt>Languages</dt>
                        <dd>{taste.favouriteLanguages.join(', ')}</dd>
                      </>
                    )}
                    {taste.topDecade && (
                      <>
                        <dt>Decade</dt>
                        <dd>{taste.topDecade}</dd>
                      </>
                    )}
                    <dt>Diary</dt>
                    <dd>{taste.uniqueWatched} films · {taste.diaryEntries} entries</dd>
                  </dl>
                )}
              </section>
            </aside>
          </div>
        )}

        {tab === 'reviews' && (
          <section className="vc-profile-panel">
            <SectionHead title="Reviews" to="/reviews" />
            <ReviewsList items={reviews} />
          </section>
        )}
        {tab === 'diary' && (
          <section className="vc-profile-panel">
            <SectionHead title="Diary" to="/diary" actionLabel="View all" />
            <DiaryTimeline items={diary} />
          </section>
        )}
        {tab === 'watchlist' && (
          <section className="vc-profile-panel">
            <SectionHead title="Watchlist" to="/watchlist" />
            <WatchlistGrid items={watchlist} />
          </section>
        )}
        {tab === 'lists' && (
          <section className="vc-profile-panel">
            <SectionHead title="Lists" to="/lists" />
            <ListsGrid items={lists} />
          </section>
        )}
        {tab === 'communities' && (
          <section className="vc-profile-panel">
            <SectionHead title="Communities" to="/community" actionLabel="Browse" />
            <CommunitiesGrid items={communities} />
          </section>
        )}
      </div>
    </div>
  );
};

export default Profile;
