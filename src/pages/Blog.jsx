import React from 'react';
import Navbar from '../components/Navbar';

export default function Blog() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 58px)',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <span className="vc-section-label" style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</span>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '0.75rem' }}>
          Journal
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', fontSize: '1.2rem' }}>
          Coming Soon
        </p>
      </section>
    </div>
  );
}
