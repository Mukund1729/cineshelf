import { tmdbImageUrl } from '../api/tmdb';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

function PersonCard({ person }) {
  const img = person.profile_path ? tmdbImageUrl(person.profile_path, 'w185') : null;
  const knownFor = person.known_for_department || 'Acting';
  const topFilm = person.known_for?.[0]?.title || person.known_for?.[0]?.name || '';
  return (
    <Link to={`/person/${person.id}`} style={{ textDecoration: 'none' }}>
      <div className="vc-poster-card" style={{ aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden' }}>
        {img ? (
          <img src={img} alt={person.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, var(--vc-bg-elevated), var(--vc-bg-card))',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--vc-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#0a0f1a' }}>
              {person.name[0]}
            </div>
          </div>
        )}
        <div className="vc-overlay">
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: '0.2rem' }}>{person.name}</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'var(--vc-slate)' }}>
            {knownFor}{topFilm ? ` · ${topFilm}` : ''}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PopularPeople() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get('/api/tmdb/popular-people', { params: { page } })
      .then(res => {
        setPeople(res.data?.results || []);
        setTotalPages(Math.min(res.data?.total_pages || 1, 50));
      })
      .catch(() => setError('Failed to load people.'))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />
      <section style={{ padding: '4rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container">
          <span className="vc-section-label">People</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900 }}>
            Popular People
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginTop: '0.5rem' }}>Directors, actors, writers, cinematographers.</p>
        </div>
      </section>
      <section style={{ padding: '3rem 0' }}>
        <div className="vc-container">
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {Array.from({ length: 20 }, (_, i) => <div key={i} className="vc-skeleton vc-skeleton-poster" style={{ borderRadius: 12 }} />)}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--vc-slate)' }}>
              <p style={{ marginBottom: '1rem' }}>{error}</p>
              <button className="vc-btn vc-btn-outline" onClick={() => setPage(1)}>Retry</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {people.map(person => <PersonCard key={person.id} person={person} />)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                <button className="vc-btn vc-btn-outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', padding: '0 0.5rem' }}>Page {page} of {totalPages}</span>
                <button className="vc-btn vc-btn-outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
