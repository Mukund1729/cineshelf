import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import BoxOfficeByYear from './BoxOfficeByYear';
import BoxOfficeByPerson from './BoxOfficeByPerson';
import BoxOfficeIndia from './BoxOfficeIndia';

const tabStyle = (active) => ({
  padding: '0.65rem 1.35rem',
  borderRadius: 'var(--vc-radius-pill)',
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 600,
  fontSize: '0.875rem',
  border: active ? '1px solid var(--vc-gold)' : '1px solid rgba(255,255,255,0.12)',
  background: active ? 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))' : 'var(--vc-bg-elevated)',
  color: active ? 'var(--vc-gold-light)' : 'var(--vc-slate)',
  cursor: 'pointer',
  transition: 'var(--vc-transition)',
  boxShadow: active ? 'var(--vc-shadow-gold)' : 'none',
});

export default function BoxOfficeTabsPage() {
  const [tab, setTab] = useState('india');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      <section style={{
        paddingTop: '6rem',
        paddingBottom: '3rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, #060912 0%, #0a0f1a 50%, #0d1420 100%)',
      }}>
        <div className="vc-container">
          <span className="vc-section-label">📊 Box Office</span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '0.75rem' }}>
            Box Office Collections
          </h1>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: 640, marginBottom: '2rem' }}>
            Explore revenue by year, person filmographies, and Indian collections with daywise charts. Track the performance of films across different markets.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" style={tabStyle(tab === 'india')} onClick={() => setTab('india')}>India</button>
            <button type="button" style={tabStyle(tab === 'year')} onClick={() => setTab('year')}>By Year</button>
            <button type="button" style={tabStyle(tab === 'person')} onClick={() => setTab('person')}>By Person</button>
          </div>
        </div>
      </section>

      <div className="vc-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {tab === 'india' && <BoxOfficeIndia />}
        {tab === 'year' && <BoxOfficeByYear />}
        {tab === 'person' && <BoxOfficeByPerson />}
      </div>
    </div>
  );
}
