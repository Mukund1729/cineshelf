import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';

const posterUrl = poster => {
  if (!poster) return '';
  if (/^https?:\/\//i.test(poster)) return poster;
  if (poster.startsWith('/uploads/')) return apiUrl(poster);
  return `https://image.tmdb.org/t/p/w342${poster}`;
};

function MediaCard({ item, review }) {
  const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
  const itemLink = item.tmdbId ? `/${mediaType}/${item.tmdbId}` : null;
  const title = item.title || 'Untitled';
  const poster = posterUrl(item.poster || item.posterUrl || item.poster_path);

  return (
    <article style={{
      display: 'flex',
      gap: '1rem',
      padding: '1rem',
      borderRadius: 12,
      background: 'var(--vc-bg-card)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {poster ? (
        <img src={poster} alt="" style={{ width: 64, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
      ) : (
        <div aria-hidden="true" style={{ width: 64, height: 96, borderRadius: 8, background: 'var(--vc-bg-elevated)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>🎬</div>
      )}
      <div style={{ minWidth: 0 }}>
        {itemLink ? (
          <Link to={itemLink} style={{ color: 'var(--vc-cream)', fontWeight: 600, textDecoration: 'none' }}>{title}</Link>
        ) : (
          <div style={{ color: 'var(--vc-cream)', fontWeight: 600 }}>{title}</div>
        )}
        {item.mediaType && (
          <div style={{ marginTop: '0.25rem', color: 'var(--vc-gold)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
            {item.mediaType === 'tv' ? 'TV' : 'Movie'}
          </div>
        )}
        {review?.rating != null && (
          <div style={{ marginTop: '0.35rem', color: 'var(--vc-gold)', fontSize: '0.8rem' }}>★ {review.rating}/10</div>
        )}
        {(review?.review || item.overview) && (
          <p style={{ margin: '0.45rem 0 0', color: 'var(--vc-slate)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            {review?.review || item.overview}
          </p>
        )}
      </div>
    </article>
  );
}

export default function PeopleProfile() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please sign in to view community profiles.');
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`/api/people/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) setData(response.data?.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.error || 'Could not load this profile.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProfile();
    return () => { active = false; };
  }, [userId]);

  const sendRequest = async () => {
    if (!data?.profile?._id) return;
    setRequesting(true);
    setNotice('');
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/people/request', { userId: data.profile._id }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(current => ({ ...current, relation: 'outgoing' }));
      setNotice('Friend request sent.');
    } catch (err) {
      setNotice(err.response?.data?.error || 'Could not send friend request.');
    } finally {
      setRequesting(false);
    }
  };

  const profile = data?.profile;
  const avatar = profile?.avatar
    ? (profile.avatar.startsWith('/') ? apiUrl(profile.avatar) : profile.avatar)
    : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <main className="vc-container" style={{ paddingTop: '3rem', paddingBottom: '4rem', maxWidth: 1040 }}>
        <Link to="/people" style={{ color: 'var(--vc-gold)', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to People</Link>
        {loading ? (
          <div role="status" style={{ padding: '4rem 0', color: 'var(--vc-slate)' }}>Loading profile…</div>
        ) : error ? (
          <section style={{ marginTop: '1.5rem', padding: '2rem', borderRadius: 12, background: 'var(--vc-bg-card)', textAlign: 'center' }}>
            <p style={{ color: 'var(--vc-slate)' }}>{error}</p>
            {error.toLowerCase().includes('sign in') && (
              <button className="vc-btn vc-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>Sign in</button>
            )}
          </section>
        ) : profile ? (
          <>
            <section style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              margin: '1.5rem 0 2rem',
              padding: '1.5rem',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'var(--vc-bg-card)',
            }}>
              {avatar ? (
                <img src={avatar} alt="" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--vc-gold)', color: '#0a0f1a', display: 'grid', placeItems: 'center', fontSize: '2rem', fontWeight: 700, flexShrink: 0 }}>
                  {(profile.username || profile.name || 'U')[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.6rem, 4vw, 2.3rem)' }}>
                  {profile.name || profile.username}
                </h1>
                <div style={{ color: 'var(--vc-slate)', fontSize: '0.9rem', marginTop: '0.25rem' }}>@{profile.username}</div>
                <div style={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.72rem', marginTop: '0.25rem' }}>Member ID: {profile._id}</div>
                {profile.bio && <p style={{ margin: '0.75rem 0 0', color: 'var(--vc-slate)', lineHeight: 1.5 }}>{profile.bio}</p>}
              </div>
              {data.relation === 'self' ? (
                <Link to="/profile" className="vc-btn vc-btn-outline" style={{ textDecoration: 'none', flexShrink: 0 }}>Edit profile</Link>
              ) : data.relation === 'friend' ? (
                <span className="vc-badge vc-badge-slate">Friend</span>
              ) : data.relation === 'outgoing' ? (
                <span className="vc-badge vc-badge-slate">Request sent</span>
              ) : data.relation === 'incoming' ? (
                <Link to="/people" className="vc-btn vc-btn-outline" style={{ textDecoration: 'none', flexShrink: 0 }}>View request</Link>
              ) : (
                <button className="vc-btn vc-btn-primary" disabled={requesting} onClick={sendRequest} style={{ flexShrink: 0 }}>
                  {requesting ? 'Sending…' : '+ Add Friend'}
                </button>
              )}
            </section>

            {notice && <p role="status" style={{ color: 'var(--vc-gold)', marginTop: '-1rem', marginBottom: '1.5rem' }}>{notice}</p>}

            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem' }}>Favourite genres</h2>
              {profile.favouriteGenres?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {profile.favouriteGenres.map(genre => (
                    <span key={genre} className="vc-badge vc-badge-slate">{genre}</span>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--vc-slate)' }}>No favourite genres added yet.</p>}
            </section>

            {!!profile.favouriteMovies?.length && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem' }}>Favourite movies</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {profile.favouriteMovies.map((movie, index) => <MediaCard key={`${movie.tmdbId || movie.title}-${index}`} item={movie} />)}
                </div>
              </section>
            )}

            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem' }}>Watchlist</h2>
              {!data.watchlistVisible ? (
                <p style={{ color: 'var(--vc-slate)' }}>This member keeps their watchlist private.</p>
              ) : data.watchlist.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {data.watchlist.map((movie, index) => <MediaCard key={`${movie.tmdbId || movie.title}-${index}`} item={movie} />)}
                </div>
              ) : <p style={{ color: 'var(--vc-slate)' }}>No watchlist titles to show yet.</p>}
            </section>

            <section>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem' }}>Reviews</h2>
              {!data.reviewsVisible ? (
                <p style={{ color: 'var(--vc-slate)' }}>This member keeps their reviews private.</p>
              ) : data.reviews.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {data.reviews.map(review => (
                    <MediaCard key={review._id} item={review} review={review} />
                  ))}
                </div>
              ) : <p style={{ color: 'var(--vc-slate)' }}>No reviews to show yet.</p>}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
