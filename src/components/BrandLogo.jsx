import React from 'react';
import { Link } from 'react-router-dom';
import logoMark from '../assets/visual-cineaste-mark-clean.png';

export default function BrandLogo({ className, style, imageStyle }) {
  return (
    <Link
      to="/"
      aria-label="Visual Cineaste home"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        flexShrink: 0,
        lineHeight: 1,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <img
        src={logoMark}
        alt=""
        aria-hidden="true"
        style={{ display: 'block', width: '2rem', height: '2rem', objectFit: 'contain', ...imageStyle }}
      />
      <span style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.05rem', fontWeight: 700, color: '#f5f0e8', letterSpacing: '0.01em' }}>
        visual<span style={{ color: 'var(--vc-gold)' }}>.</span>cineaste
      </span>
    </Link>
  );
}
