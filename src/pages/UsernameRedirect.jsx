import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';

/**
 * Soft route for @username mentions: /u/:username → /people/:id.
 * Uses the existing public profile API. Does not invent profiles.
 */
export default function UsernameRedirect() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  usePageTitle(username ? `@${username}` : 'User');

  useEffect(() => {
    let active = true;
    setError('');
    if (!username || !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      setError('That username is not valid.');
      return undefined;
    }
    axios.get(`/api/user/u/${encodeURIComponent(username)}`)
      .then(({ data }) => {
        if (!active) return;
        const id = data?.data?._id;
        if (!id) {
          setError('User not found.');
          return;
        }
        navigate(`/people/${id}`, { replace: true });
      })
      .catch(err => {
        if (!active) return;
        setError(err.response?.status === 404
          ? 'No CineShelf member uses that username.'
          : (err.response?.data?.error || 'Could not open that profile.'));
      });
    return () => { active = false; };
  }, [username, navigate]);

  if (!error) {
    return (
      <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center', background: '#0d0d0f', color: '#a6a09a' }}>
        <p>Opening @{username}…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', color: '#f1ede5' }}>
      <Navbar />
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '6rem 1.25rem' }}>
        <h1 style={{ fontFamily: 'var(--vc-font-display)', marginBottom: '0.75rem' }}>Profile unavailable</h1>
        <p style={{ color: '#a6a09a', lineHeight: 1.55 }} role="alert">{error}</p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link to="/people" className="vc-btn vc-btn-primary">Find people</Link>
          <Link to="/" className="vc-btn vc-btn-ghost">Home</Link>
        </div>
      </main>
    </div>
  );
}
