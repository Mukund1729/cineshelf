import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import AuthModal from './components/AuthModal';

// Global auth modal — listens to custom event fired from Navbar / any page
function GlobalAuthModal() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('login');

  useEffect(() => {
    const handler = (e) => {
      setType(e.detail?.type || 'login');
      setOpen(true);
    };
    window.addEventListener('open-auth-modal', handler);
    return () => window.removeEventListener('open-auth-modal', handler);
  }, []);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <AuthModal
        type={type}
        onClose={() => setOpen(false)}
        onSwitch={(t) => setType(t)}
      />
    </div>
  );
}

// Eager-loaded core pages
import HomePage from './pages/HomePage';
import MovieDetail from './pages/MovieDetail';
import TVDetail from './pages/TVDetail';
import PersonDetail from './pages/PersonDetail';

// Lazy-loaded pages
const TrendingMovies  = lazy(() => import('./pages/TrendingMovies').then(m => ({ default: m.TrendingMovies || m.default })));
const PopularMovies   = lazy(() => import('./pages/PopularMovies'));
const PopularTVShows  = lazy(() => import('./pages/PopularTVShows'));
const PopularPeople   = lazy(() => import('./pages/PopularPeople'));
const TVShows         = lazy(() => import('./pages/TVShows'));
const TopMovies       = lazy(() => import('./pages/TopMovies'));
const About           = lazy(() => import('./pages/About'));
const Blog            = lazy(() => import('./pages/Blog'));
const BlogPost        = lazy(() => import('./pages/BlogPost'));
const Discover        = lazy(() => import('./pages/Discover'));
const GenrePage       = lazy(() => import('./pages/GenrePage'));
const ComparePage     = lazy(() => import('./pages/ComparePage'));
const CinematicPicks  = lazy(() => import('./pages/CinematicPicks'));
const Lists           = lazy(() => import('./pages/Lists'));
const Watchlist       = lazy(() => import('./pages/Watchlist'));
const Reviews         = lazy(() => import('./pages/Reviews'));
const People          = lazy(() => import('./pages/People'));
const Profile         = lazy(() => import('./pages/Profile'));
const ChangePassword  = lazy(() => import('./pages/ChangePassword'));
const AdminDashboard  = lazy(() => import('./pages/AdminDashboard'));
const PersonBoxOffice = lazy(() => import('./pages/PersonBoxOffice'));
const FullFilmography = lazy(() => import('./pages/FullFilmography'));
const BoxOfficeTabsPage = lazy(() => import('./pages/BoxOfficeTabsPage'));
const PersonBoxOfficeSearchPage = lazy(() => import('./pages/PersonBoxOfficeSearchPage'));
const TheatreBooking = lazy(() => import('./pages/TheatreBooking'));
const MyTickets = lazy(() => import('./pages/MyTickets'));

function PageFallback() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0f1a',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="vc-skeleton" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 1rem' }} />
        <p style={{ color: '#94a3b8', fontFamily: 'Lato, sans-serif', fontSize: '0.9rem' }}>Loading…</p>
      </div>
    </div>
  );
}

function AppWrapper() {
  return (
    <div className="app">
      <ScrollToTop />
      <GlobalAuthModal />
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Core */}
            <Route path="/" element={<HomePage />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/tv/:id" element={<TVDetail />} />
            <Route path="/person/:id" element={<PersonDetail />} />

            {/* Discovery */}
            <Route path="/trending" element={<TrendingMovies />} />
            <Route path="/popular-movies" element={<PopularMovies />} />
            <Route path="/popular-tv" element={<PopularTVShows />} />
            <Route path="/popular-people" element={<PopularPeople />} />
            <Route path="/tv" element={<TVShows />} />
            <Route path="/top-movies" element={<TopMovies />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/genre/:genreId/:genreName" element={<GenrePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/booking/:movieId" element={<TheatreBooking />} />
            <Route path="/my-tickets" element={<MyTickets />} />

            {/* User Features */}
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/people" element={<People />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/change-password" element={<ChangePassword />} />

            {/* Content */}
            <Route path="/cinematic-picks" element={<CinematicPicks />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />

            {/* Box Office */}
            <Route path="/boxoffice" element={<BoxOfficeTabsPage />} />
            <Route path="/person-boxoffice" element={<PersonBoxOfficeSearchPage />} />
            <Route path="/person/:id/boxoffice" element={<PersonBoxOffice />} />
            <Route path="/person/:id/filmography" element={<FullFilmography />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/*" element={<AdminDashboard />} />

            {/* 404 */}
            <Route path="*" element={
              <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f1a', color: '#fff', gap: '1rem' }}>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '4rem', margin: 0, color: '#ffd700' }}>404</h1>
                <p style={{ color: '#94a3b8', fontFamily: 'Lato, sans-serif' }}>This scene doesn't exist.</p>
                <a href="/" style={{ color: '#01b4e4', textDecoration: 'none', fontFamily: 'Lato, sans-serif', border: '1px solid #01b4e4', padding: '0.5rem 1.5rem', borderRadius: '999px' }}>Back to Home</a>
              </div>
            } />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default AppWrapper;