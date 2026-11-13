import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/visual-cineaste-logo.png';

export default function BrandLogo({ className, style, imageStyle }) {
  return (
    <Link
      to="/"
      aria-label="Visual Cineaste home"
      className={className}
      style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0, ...style }}
    >
      <img
        src={logo}
        alt="Visual Cineaste"
        style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain', ...imageStyle }}
      />
    </Link>
  );
}
