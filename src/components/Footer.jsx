import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

export const SITE_FOOTER_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Pro', to: '/pro' },
  { label: 'News', to: '/news' },
  { label: 'Apps', to: '/apps' },
  { label: 'Help', to: '/help' },
  { label: 'Year in Review', to: '/year-in-review' },
  { label: 'Gifts', to: '/gifts' },
  { label: 'Terms', to: '/terms' },
  { label: 'API', to: '/developer-api' },
  { label: 'Contact', to: '/contact' },
];

export default function Footer() {
  return (
    <footer className="vc-site-footer">
      <div className="vc-container">
        <div className="vc-site-footer-main">
          <BrandLogo className="vc-footer-brand" style={{ width: 'clamp(150px, 18vw, 220px)' }} />
          <nav className="vc-footer-links" aria-label="Footer navigation">
            {SITE_FOOTER_LINKS.map(({ label, to }) => (
              <Link key={to} to={to}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="vc-site-footer-legal">
          <span>© {new Date().getFullYear()} Visual Cineaste. All rights reserved.</span>
          <span>Film information powered by TMDB.</span>
        </div>
      </div>
    </footer>
  );
}
