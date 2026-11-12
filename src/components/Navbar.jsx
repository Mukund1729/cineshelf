import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../api/config';
import NotificationBell from './NotificationBell';

const NAV_LINKS = [
  { to: '/',               label: 'Home' },
  { to: '/discover',       label: 'Discover' },
  { to: '/cinematic-picks', label: 'Picks' },
  { to: '/trending',       label: 'Trending' },
  { to: '/popular-movies', label: 'Movies' },
  { to: '/popular-tv',     label: 'TV' },
  { to: '/boxoffice',      label: 'Box Office' },
  { to: '/blog',           label: 'Journal' },
  { to: '/people',         label: 'People' },
  { to: '/about',          label: 'About' },
];

// Ticket icon SVG for the Book Now button
const TicketIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const USER_LINKS = [
  { to: '/my-tickets', label: '🎟 My Tickets' },
  { to: '/watchlist',  label: 'Watchlist' },
  { to: '/lists',      label: 'Lists' },
  { to: '/reviews',    label: 'Reviews' },
  { to: '/diary',      label: 'Movie Diary' },
  { to: '/profile',    label: 'Profile' },
];

export default function Navbar() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
        .then(res => {
          const responseData = res.data?.data || res.data?.user || res.data;
          const nextUser = responseData?.user || responseData;
          setUser(nextUser);
          localStorage.setItem('user', JSON.stringify(nextUser));
        })
        .catch(err => {
          if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        });
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleProfileUpdated = event => {
      const updatedUser = event.detail;
      if (!updatedUser) return;
      setUser(updatedUser);
      setAvatarFailed(false);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    };
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, []);

  useEffect(() => setAvatarFailed(false), [user?.avatar]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUserMenuOpen(false);
    navigate('/');
  };

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: scrolled
          ? 'rgba(7,10,16,0.97)'
          : 'rgba(7,10,16,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        transition: 'background 300ms ease',
      }}
    >
      <div
        className="vc-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '58px',
          gap: '1rem',
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          className="navbar-logo"
          style={{
            fontFamily: 'Playfair Display, serif',
            fontWeight: 700,
            fontSize: '1.15rem',
            color: '#f5f0e8',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span className="logo-full">visual<span style={{ color: 'var(--vc-gold)', margin: '0 1px' }}>.</span>cineaste</span>
          <span className="logo-short" style={{ display: 'none' }}>V<span style={{ color: 'var(--vc-gold)' }}>.</span>C</span>
        </Link>

        {/* Desktop nav */}
        <ul
          style={{
            display: 'flex',
            listStyle: 'none',
            margin: 0,
            padding: 0,
            gap: '0.15rem',
            alignItems: 'center',
            flexWrap: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {NAV_LINKS.map(link => (
            <li key={link.to} className="nav-item-desktop">
              <Link
                to={link.to}
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.82rem',
                  fontWeight: isActive(link.to) ? 600 : 400,
                  color: isActive(link.to) ? 'var(--vc-gold)' : 'rgba(245,240,232,0.75)',
                  textDecoration: 'none',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  transition: 'all 200ms ease',
                  letterSpacing: '0.01em',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!isActive(link.to)) e.currentTarget.style.color = '#f5f0e8';
                }}
                onMouseLeave={e => {
                  if (!isActive(link.to)) e.currentTarget.style.color = 'rgba(245,240,232,0.75)';
                }}
              >
                {link.label}
                {isActive(link.to) && (
                  <span style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '16px',
                    height: '2px',
                    background: 'var(--vc-gold)',
                    borderRadius: '1px',
                  }} />
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* Book Tickets CTA */}
        <Link
          to="/panorama"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.38rem 0.9rem',
            background: 'linear-gradient(135deg, #d4af37 0%, #f5cc50 50%, #d4af37 100%)',
            backgroundSize: '200% 100%',
            border: 'none',
            borderRadius: '999px',
            color: '#0a0f1a',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 700,
            fontSize: '0.78rem',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 0 14px rgba(212,175,55,0.35), 0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 220ms ease',
            animation: 'bookBtnPulse 3s ease-in-out infinite',
          }}
          className="book-tickets-btn navbar-book-tickets"
        >
          <TicketIcon />
          Book Tickets
        </Link>

        {/* Right side: user or auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {user ? (
            <>
            <NotificationBell />
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '999px',
                  padding: '0.3rem 0.75rem 0.3rem 0.3rem',
                  cursor: 'pointer',
                  color: '#f5f0e8',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.82rem',
                  transition: 'all 200ms',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--vc-gold) 0%, #b8860b 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, color: '#0a0f1a',
                    flexShrink: 0, position: 'relative', overflow: 'hidden',
                  }}>
                    {(user.username || user.name || 'U')[0].toUpperCase()}
                  {user.avatar && !avatarFailed && (
                    <img
                      src={user.avatar.startsWith('/') ? apiUrl(user.avatar) : user.avatar}
                      alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      onError={() => setAvatarFailed(true)}
                    />
                  )}
                  </div>
                <span className="navbar-username" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username || user.name}
                </span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  background: 'var(--vc-bg-elevated)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  minWidth: '180px',
                  padding: '0.5rem',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                  zIndex: 200,
                }}>
                  {user.isAdmin && (
                    <>
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        style={dropdownLinkStyle}
                      >
                        ⚙ Admin
                      </Link>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0' }} />
                    </>
                  )}
                  {USER_LINKS.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setUserMenuOpen(false)}
                      style={dropdownLinkStyle}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0' }} />
                  <button onClick={handleLogout} style={{ ...dropdownLinkStyle, width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer', color: '#fc8181' }}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <button
              onClick={() => {
                // Trigger AuthModal via custom event
                window.dispatchEvent(new CustomEvent('open-auth-modal'));
              }}
              className="vc-btn vc-btn-primary"
              data-navbar-signin
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Sign in
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '0.35rem 0.5rem',
              cursor: 'pointer',
              color: '#f5f0e8',
            }}
            className="navbar-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                <path d="M1 1l16 10M17 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                <path d="M0 1h18M0 6h18M0 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: 'var(--vc-bg-deep)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '1rem 1.5rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Link
              to="/panorama"
              onClick={() => setMenuOpen(false)}
              className="book-tickets-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                padding: '0.7rem 1rem',
                background: 'linear-gradient(135deg, #d4af37 0%, #f5cc50 50%, #d4af37 100%)',
                borderRadius: '999px',
                color: '#0a0f1a',
                fontFamily: 'Outfit, sans-serif',
                fontSize: '0.9rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <TicketIcon />
              Book Tickets
            </Link>
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: isActive(link.to) ? 'var(--vc-gold)' : 'rgba(245,240,232,0.8)',
                  textDecoration: 'none',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                {USER_LINKS.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '0.9rem',
                      color: 'rgba(245,240,232,0.6)',
                      textDecoration: 'none',
                      padding: '0.65rem 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  style={{
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '0.9rem',
                    color: '#fc8181',
                    padding: '0.65rem 0',
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('open-auth-modal')); }}
                className="vc-btn vc-btn-primary"
                style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .nav-item-desktop { display: none !important; }
          .navbar-hamburger { display: flex !important; }
          .logo-full { display: none !important; }
          .logo-short { display: inline !important; }
        }
        @media (min-width: 901px) {
          .navbar-hamburger { display: none !important; }
          .logo-full { display: inline !important; }
          .logo-short { display: none !important; }
        }
        @media (max-width: 640px) {
          .nav-item-desktop { display: none !important; }
          .navbar-book-tickets { display: none !important; }
          [data-navbar-signin] { display: none !important; }
          .navbar-username { max-width: 60px !important; }
        }
        @media (max-width: 480px) {
          .vc-container {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }
        }
        @keyframes bookBtnPulse {
          0%, 100% { box-shadow: 0 0 14px rgba(212,175,55,0.35), 0 2px 8px rgba(0,0,0,0.3); }
          50%       { box-shadow: 0 0 24px rgba(212,175,55,0.65), 0 2px 12px rgba(0,0,0,0.4); }
        }
        .book-tickets-btn:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 0 28px rgba(212,175,55,0.7), 0 4px 16px rgba(0,0,0,0.4) !important;
          background-position: 100% 0 !important;
        }
        .book-tickets-btn:active { transform: scale(0.97); }
      `}</style>
    </nav>
  );
}

const dropdownLinkStyle = {
  display: 'block',
  fontFamily: 'Outfit, sans-serif',
  fontSize: '0.85rem',
  color: 'rgba(245,240,232,0.85)',
  textDecoration: 'none',
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  transition: 'all 150ms',
  width: '100%',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};