import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const PAGE_TITLES = {
  pro: 'Pro',
  news: 'News',
  apps: 'Apps',
  help: 'Help',
  'year-in-review': 'Year in Review',
  gifts: 'Gifts',
  terms: 'Terms',
  api: 'API',
  contact: 'Contact',
};

export default function FooterInfoPage({ slug }) {
  const title = PAGE_TITLES[slug];

  return (
    <div className="vc-footer-info-page">
      <Navbar />
      <main className="vc-container vc-footer-info-content">
        <span className="vc-section-label">Visual Cineaste</span>
        <h1>{title}</h1>
        <p>Details for this page will be added soon.</p>
        <Link to="/" className="vc-btn vc-btn-outline">Back to home</Link>
      </main>
      <Footer />
    </div>
  );
}
