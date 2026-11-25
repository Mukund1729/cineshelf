import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';
import { tmdbImageUrl } from '../api/tmdb';
import { hasAuthSession } from '../api/session';
import { buildCinemaTaste } from '../utils/cinemaTaste';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'lists', label: 'Lists' },
  { id: 'communities', label: 'Communities' },
];

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

function getDefaultAvatar(name) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="#1a1a1a"/>
      <circle cx="60" cy="40" r="15" fill="#4a5568"/>
      <path d="M10 100C10 85 22 73 37 73H83C98 73 110 85 110 100V110H10V100Z" fill="#4a5568"/>
      <text x="60" y="65" font-family="Manrope, Helvetica Neue, sans-serif" font-size="24" font-weight="bold" fill="#e2e8f0" text-anchor="middle">${initials}</text>
    </svg>
  `)}`;
}

function Stars({ rating }) {
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  return <span className="vc-profile-rating">★ {Number(rating)}/10</span>;
}

export default function PeopleProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const [data, setData] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState(initialTab);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    const next = searchParams.get('tab');
    if (TABS.some(t => t.id === next) && next !== tab) setTab(next);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      if (!hasAuthSession()) {
        setError('Please sign in to view community profiles.');
        setLoading(false);
        return;
      }
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [response, communitiesRes, listsRes] = await Promise.all([
          axios.get(`/api/people/profile/${userId}`, { headers, withCredentials: true }),
          axios.get(`/api/community/user/${userId}`, { headers, withCredentials: true }).catch(() => null),
          axios.get(`/api/lists/user/${userId}`, { headers, withCredentials: true }).catch(() => null),
        ]);
        if (!active) return;
        const payload = response.data?.data;
        if (payload?.relation === 'self') {
          navigate('/profile', { replace: true });
          return;
        }
        setData(payload);
        setCommunities(communitiesRes?.data?.communities || []);
        setLists(listsRes?.data?.data || []);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Could not load this profile.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProfile();
    return () => { active = false; };
  }, [userId, navigate]);

  const selectTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const sendRequest = async () => {
    if (!data?.profile?._id) return;
    setRequesting(true);
    setNotice('');
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/people/request', { userId: data.profile._id }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setData(current => ({ ...current, relation: 'outgoing' }));
      setNotice('Friend request sent.');
    } catch (err) {
      setNotice(err.response?.data?.error || 'Could not send friend request.');
    } finally {
      setRequesting(false);
    }
  };

  const shareProfile = async () => {
    if (!data?.profile?._id) return;
    const url = `${window.location.origin}/people/${data.profile._id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote('Link copied');
    } catch {
      setShareNote(url);
    }
    setTimeout(() => setShareNote(''), 2500);
  };

  const profile = data?.profile;
  const friends = data?.friends || [];
  const watchlist = data?.watchlistVisible ? (data.watchlist || []) : [];
  const reviews = data?.reviewsVisible ? (data.reviews || []) : [];
  const top4 = (profile?.favouriteMovies || []).slice(0, 4);
  const coverUrl = resolveMediaUrl(profile?.coverImage);
  const joinDate = formatJoinDate(profile?.createdAt);

  const taste = useMemo(
    () => buildCinemaTaste({
      profile,
      reviews,
      diary: [],
      watchlist,
    }),
    [profile, reviews, watchlist]
  );

  const SectionHead = ({ title, action }) => (
    <div className="vc-profile-section-head">
      <h3 className="vc-profile-section-title">{title}</h3>
      {action || null}
    </div>
  );

  const WatchlistGrid = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!data?.watchlistVisible) {
      return <p className="vc-profile-empty">This watchlist is private.</p>;
    }
    if (!list.length) return <p className="vc-profile-empty">Watchlist is empty.</p>;
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
    if (!data?.reviewsVisible) {
      return <p className="vc-profile-empty">Reviews are private.</p>;
    }
    if (!list.length) return <p className="vc-profile-empty">No reviews yet.</p>;
    return (
      <div className="vc-profile-review-list">
        {list.map(review => (
          <article key={review._id} className="vc-profile-review-card">
            <Link
              to={`/${review.mediaType === 'tv' ? 'tv' : 'movie'}/${review.tmdbId}`}
              className="vc-profile-review-poster"
            >
              <img src={posterSrc(review.poster, 'w92')} alt="" loading="lazy" />
            </Link>
            <div className="vc-profile-review-body">
              <div className="vc-profile-review-top">
                <Link
                  to={`/${review.mediaType === 'tv' ? 'tv' : 'movie'}/${review.tmdbId}`}
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

  const ListsGrid = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) return <p className="vc-profile-empty">No public lists yet.</p>;
    return (
      <div className="vc-profile-lists-grid">
        {list.map(listItem => (
          <Link key={listItem._id} to="/lists" className="vc-profile-list-card">
            <div className="vc-profile-list-cover" aria-hidden="true" />
            <div className="vc-profile-list-title">{listItem.name}</div>
            {listItem.description && <p className="vc-profile-muted">{listItem.description}</p>}
            <div className="vc-profile-muted vc-profile-list-meta">
              {listItem.items?.length || 0} titles · Public
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const CommunitiesGrid = ({ items, limit }) => {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) return <p className="vc-profile-empty">No communities yet.</p>;
    return (
      <div className="vc-profile-lists-grid">
        {list.map(community => (
          <Link key={community._id} to={`/community/${community.slug}`} className="vc-profile-list-card">
            <div className="vc-profile-list-title">{community.name}</div>
            <p className="vc-profile-muted">{community.summary ?? community.description}</p>
            <div className="vc-profile-muted vc-profile-list-meta">
              {community.role || 'member'} · {community.memberCount || 0} members
            </div>
          </Link>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="vc-profile-page" style={{ minHeight: '100vh', background: '#0D0D0F', color: 'var(--vc-cream)' }}>
        <Navbar />
        <div className="vc-container" style={{ paddingTop: '6rem' }}>
          <p className="vc-profile-muted">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="vc-profile-page" style={{ minHeight: '100vh', background: '#0D0D0F', color: 'var(--vc-cream)' }}>
        <Navbar />
        <div className="vc-container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
          <p className="vc-profile-muted" style={{ marginBottom: '1rem' }}>{error || 'Profile not found.'}</p>
          <Link to="/people" className="vc-btn vc-btn-outline" style={{ textDecoration: 'none' }}>Back to People</Link>
          {error?.toLowerCase().includes('sign in') && (
            <button
              type="button"
              className="vc-btn vc-btn-primary"
              style={{ marginLeft: '0.5rem' }}
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="vc-profile-page" style={{ minHeight: '100vh', background: '#0D0D0F', color: 'var(--vc-cream)', width: '100%', maxWidth: '100%', overflowX: 'clip' }}>
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
            src={resolveMediaUrl(profile.avatar) || getDefaultAvatar(profile.name || profile.username)}
            alt=""
            onError={e => { e.currentTarget.src = getDefaultAvatar(profile.name || profile.username); }}
          />
          <div className="vc-profile-heading-copy">
            <Link to="/people" className="vc-profile-section-link" style={{ display: 'inline-block', marginBottom: '0.55rem' }}>
              ← People
            </Link>
            <h1 className="vc-profile-name">{displayName(profile.name || profile.username)}</h1>
            {profile.username && <p className="vc-profile-username">@{profile.username}</p>}
            {profile.bio?.trim() && <p className="vc-profile-bio">{profile.bio.trim()}</p>}
            {joinDate && <p className="vc-profile-joined">Joined {joinDate}</p>}

            <div className="vc-profile-actions">
              {data.relation === 'friend' ? (
                <span className="vc-badge vc-badge-slate">Friend</span>
              ) : data.relation === 'outgoing' ? (
                <span className="vc-badge vc-badge-slate">Request sent</span>
              ) : data.relation === 'incoming' ? (
                <Link to="/people" className="vc-btn vc-btn-outline" style={{ textDecoration: 'none' }}>
                  View request
                </Link>
              ) : (
                <button type="button" className="vc-btn vc-btn-primary" disabled={requesting} onClick={sendRequest}>
                  {requesting ? 'Sending…' : 'Add friend'}
                </button>
              )}
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
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('reviews')}>
            <div className="vc-profile-stat-value">{data.reviewsVisible ? reviews.length : '—'}</div>
            <div className="vc-profile-stat-label">Reviews</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('watchlist')}>
            <div className="vc-profile-stat-value">{data.watchlistVisible ? watchlist.length : '—'}</div>
            <div className="vc-profile-stat-label">Watchlist</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('lists')}>
            <div className="vc-profile-stat-value">{lists.length}</div>
            <div className="vc-profile-stat-label">Lists</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('communities')}>
            <div className="vc-profile-stat-value">{communities.length}</div>
            <div className="vc-profile-stat-label">Communities</div>
          </button>
          <button type="button" className="vc-profile-stat" onClick={() => selectTab('overview')}>
            <div className="vc-profile-stat-value">{friends.length}</div>
            <div className="vc-profile-stat-label">Friends</div>
          </button>
        </div>
        {notice && <p role="status" className="vc-profile-activity-error">{notice}</p>}
      </div>

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
                <SectionHead title="Top 4" />
                {top4.length ? (
                  <div className="vc-profile-top4">
                    {top4.map(movie => (
                      <Link key={movie.tmdbId} to={`/movie/${movie.tmdbId}`} className="vc-profile-top4-card">
                        <img src={posterSrc(movie.poster, 'w342')} alt={movie.title} loading="lazy" />
                        <div><strong>{movie.title}</strong></div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="vc-profile-empty">No Top 4 yet.</p>
                )}
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Watchlist" />
                <WatchlistGrid items={watchlist} limit={8} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Reviews" />
                <ReviewsList items={reviews} limit={3} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Lists" />
                <ListsGrid items={lists} limit={4} />
              </section>

              <section className="vc-profile-panel">
                <SectionHead title="Communities" />
                <CommunitiesGrid items={communities} limit={4} />
              </section>
            </div>

            <aside className="vc-profile-side">
              <section className="vc-profile-panel">
                <div className="vc-profile-section-head">
                  <h3 className="vc-profile-section-title">Friends</h3>
                  <Link to="/people" className="vc-profile-section-link">View all</Link>
                </div>
                {friends.length === 0 ? (
                  <p className="vc-profile-empty">No friends yet.</p>
                ) : (
                  <ul className="vc-profile-friends">
                    {friends.slice(0, 8).map((friend, index) => (
                      <li key={friend._id || `friend-${index}`}>
                        <Link to={`/people/${friend._id}`} className="vc-profile-friend">
                          <img
                            src={resolveMediaUrl(friend.avatar) || getDefaultAvatar(friend.name || friend.username)}
                            alt=""
                            onError={e => { e.currentTarget.src = getDefaultAvatar(friend.name || friend.username); }}
                          />
                          <div>
                            <strong>{displayName(friend.name || friend.username)}</strong>
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
                {!taste.hasSignal && !(profile.favouriteGenres || []).length ? (
                  <p className="vc-profile-empty">Not enough public activity yet.</p>
                ) : (
                  <dl className="vc-profile-taste">
                    {taste.averageRating != null && (
                      <>
                        <dt>Avg rating</dt>
                        <dd>{taste.averageRating}/10 · {taste.reviewCount} reviews</dd>
                      </>
                    )}
                    {(profile.favouriteGenres || []).length > 0 && (
                      <>
                        <dt>Genres</dt>
                        <dd>{profile.favouriteGenres.join(', ')}</dd>
                      </>
                    )}
                    {taste.mostWatchedGenres.length > 0 && (
                      <>
                        <dt>Watchlist genres</dt>
                        <dd>{taste.mostWatchedGenres.map(g => g.name).join(', ')}</dd>
                      </>
                    )}
                    {taste.topDecade && (
                      <>
                        <dt>Decade</dt>
                        <dd>{taste.topDecade}</dd>
                      </>
                    )}
                  </dl>
                )}
              </section>
            </aside>
          </div>
        )}

        {tab === 'reviews' && (
          <section className="vc-profile-panel">
            <SectionHead title="Reviews" />
            <ReviewsList items={reviews} />
          </section>
        )}
        {tab === 'watchlist' && (
          <section className="vc-profile-panel">
            <SectionHead title="Watchlist" />
            <WatchlistGrid items={watchlist} />
          </section>
        )}
        {tab === 'lists' && (
          <section className="vc-profile-panel">
            <SectionHead title="Lists" />
            <ListsGrid items={lists} />
          </section>
        )}
        {tab === 'communities' && (
          <section className="vc-profile-panel">
            <SectionHead title="Communities" />
            <CommunitiesGrid items={communities} />
          </section>
        )}
      </div>
    </div>
  );
}
