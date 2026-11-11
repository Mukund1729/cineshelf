import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const PILLARS = [
  {
    icon: '🎞',
    title: 'Cinematic Discovery',
    body: 'Explore films across languages, eras, and traditions — from Cannes to Bollywood, from arthouse to mainstream. Every film deserves to be found by the right audience.',
  },
  {
    icon: '✍',
    title: 'Honest Reviews',
    body: 'Write reviews that matter. Rate what you\'ve seen, mark spoilers, and build a personal film diary that reflects who you are as a viewer.',
  },
  {
    icon: '📋',
    title: 'Curated Lists',
    body: 'Create themed collections — decade retrospectives, director surveys, mood-based selections. Share them publicly or keep them private.',
  },
  {
    icon: '🤝',
    title: 'A Community of Cinephiles',
    body: 'Connect with people who love cinema as much as you do. See what your people are watching, discover through their eyes.',
  },
  {
    icon: '🧠',
    title: 'AI-Powered Recommendations',
    body: 'Describe what you\'re in the mood for in plain language — "a quiet Japanese film about loneliness" or "films like Masaan" — and let our AI guide you.',
  },
  {
    icon: '📰',
    title: 'Editorial Journal',
    body: 'Long-form writing about cinema: director spotlights, decade retrospectives, industry analysis, and deep dives into the films that matter.',
  },
];

const TEAM_NOTE = `Visual.Cineaste was built for people who believe cinema is more than entertainment — it is a mirror, a window, and occasionally a door into worlds we didn't know we needed.

We grew frustrated with platforms that treat every film the same, that bury slow cinema under algorithm-driven blockbusters, that reduce the experience of watching to a number out of ten. We wanted something more considered.

This is our attempt at building that.`;

export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)' }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        position: 'relative',
        padding: '6rem 0 5rem',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="vc-container" style={{ textAlign: 'center', position: 'relative' }}>
          <span className="vc-section-label">About</span>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em',
          }}>
            For those who watch<br />
            <em style={{ fontStyle: 'italic', color: 'var(--vc-gold)' }}>with intention.</em>
          </h1>
          <p style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: 'var(--vc-slate)',
            maxWidth: '620px',
            margin: '0 auto 2.5rem',
            lineHeight: 1.7,
          }}>
            Visual.Cineaste is a cinematic discovery and social platform built for serious film lovers —
            a space to track, review, discuss, and curate the films that define you.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/discover" className="vc-btn vc-btn-primary">Start Discovering</Link>
            <Link to="/cinematic-picks" className="vc-btn vc-btn-outline">Cinematic Picks</Link>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section style={{ padding: '5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container" style={{ maxWidth: '800px' }}>
          <span className="vc-section-label">Our Approach</span>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', marginBottom: '2rem', lineHeight: 1.2 }}>
            Cinema deserves a better home.
          </h2>
          <div style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.05rem',
            lineHeight: 1.8,
            color: 'rgba(245,240,232,0.8)',
            whiteSpace: 'pre-line',
          }}>
            {TEAM_NOTE}
          </div>

          <div style={{ marginTop: '2.5rem', borderLeft: '3px solid var(--vc-gold)', paddingLeft: '1.5rem' }}>
            <blockquote style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '1.25rem',
              fontStyle: 'italic',
              color: 'var(--vc-cream)',
              margin: 0,
              lineHeight: 1.5,
            }}>
              "Cinema is a matter of what's in the frame and what's out."
            </blockquote>
            <cite style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', marginTop: '0.5rem', display: 'block' }}>
              — Martin Scorsese
            </cite>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section style={{ padding: '5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="vc-container">
          <span className="vc-section-label">What We Offer</span>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', marginBottom: '3rem' }}>
            Everything a cinephile needs.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {PILLARS.map((p, i) => (
              <div key={i} className="vc-card" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{p.icon}</div>
                <h3 style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '1.15rem',
                  marginBottom: '0.75rem',
                  color: 'var(--vc-cream)',
                }}>
                  {p.title}
                </h3>
                <p style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: 'var(--vc-slate)',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '5rem 0', background: 'var(--vc-bg-surface)' }}>
        <div className="vc-container" style={{ textAlign: 'center' }}>
          <span className="vc-section-label">The Platform</span>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', marginBottom: '3rem' }}>
            Built for depth, not scale.
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap' }}>
            {[
              { stat: 'TMDB', label: 'Movie Database' },
              { stat: 'AI', label: 'Powered Recommendations' },
              { stat: '∞', label: 'Curated Lists' },
              { stat: '🎬', label: 'Cinematic Picks' },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.5rem', fontWeight: 900, color: 'var(--vc-gold)', marginBottom: '0.5rem' }}>
                  {item.stat}
                </div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'var(--vc-slate)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 0', textAlign: 'center' }}>
        <div className="vc-container">
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', marginBottom: '1rem' }}>
            Start your film journal.
          </h2>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginBottom: '2rem' }}>
            Track films, write reviews, build lists, and find your cinematic community.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/discover" className="vc-btn vc-btn-primary">Explore Films</Link>
            <Link to="/blog" className="vc-btn vc-btn-outline">Read the Journal</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
