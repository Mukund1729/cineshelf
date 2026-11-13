/**
 * MyTickets — shows all booked tickets saved in localStorage
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

// ── Minimal QR renderer (same as in TheatreBooking) ───────────────────────────
function generateQR(ticketId) {
  const bits = ticketId.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  const size  = 21;
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bit = bits[(r * size + c) % bits.length];
      cells.push({ r, c, on: bit === '1' || (r < 3 && c < 3) || (r < 3 && c > size - 4) || (r > size - 4 && c < 3) });
    }
  }
  return cells;
}

function QRCode({ ticketId, size = 100 }) {
  const cells = generateQR(ticketId);
  const cell  = size / 21;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background: '#fff', borderRadius: 6, padding: 3 }}>
      {cells.map(({ r, c, on }) =>
        on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0a0f1a" /> : null
      )}
    </svg>
  );
}

export default function MyTickets() {
  const [tickets, setTickets]   = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('cineshelf_tickets');
    setTickets(raw ? JSON.parse(raw) : []);
  }, []);

  const removeTicket = (id) => {
    const next = tickets.filter(t => t.id !== id);
    setTickets(next);
    localStorage.setItem('cineshelf_tickets', JSON.stringify(next));
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium', timeStyle: 'short',
      });
    } catch { return iso; }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: '#f5f0e8', overflowX: 'hidden' }}>
      <style>{`
        @media (max-width: 640px) {
          .my-tickets-inner { padding: 1.25rem 0.75rem !important; }
          .ticket-expanded-body { flex-direction: column !important; align-items: center !important; }
          .ticket-qr svg { max-width: 240px !important; width: 100% !important; height: auto !important; }
        }
      `}</style>
      <Navbar />

      <div style={{ maxWidth: 740, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', margin: 0 }}>
            🎟 My Tickets
          </h1>
          <Link to="/popular-movies" style={{
            padding: '0.45rem 1.1rem',
            background: 'linear-gradient(135deg,#d4af37,#f5cc50)',
            borderRadius: 8, fontFamily: 'Outfit, sans-serif', fontWeight: 700,
            fontSize: '0.8rem', color: '#0a0f1a', textDecoration: 'none',
          }}>
            + Book More
          </Link>
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'rgba(245,240,232,0.45)', marginBottom: '2rem' }}>
          {tickets.length} demo ticket{tickets.length !== 1 ? 's' : ''} saved
        </p>

        <div style={{
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: 10,
          color: 'rgba(245,240,232,0.78)',
          fontFamily: 'Outfit, sans-serif',
          fontSize: '0.8rem',
          lineHeight: 1.5,
        }}>
          Tickets created in CineShelf are demo previews saved only in this browser. They are not real bookings, payments, or valid entry passes.
        </div>

        {tickets.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'rgba(255,255,255,0.03)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎬</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
              No tickets yet
            </div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'rgba(245,240,232,0.45)', marginBottom: '1.5rem' }}>
              Try the cinema demo or find real showtimes on BookMyShow.
            </p>
            <Link to="/popular-movies" style={{
              display: 'inline-flex', padding: '0.6rem 1.5rem',
              background: 'linear-gradient(135deg,#d4af37,#f5cc50)',
              borderRadius: 8, fontFamily: 'Outfit, sans-serif', fontWeight: 700,
              fontSize: '0.85rem', color: '#0a0f1a', textDecoration: 'none',
            }}>
              Browse Movies
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                style={{
                  background: 'linear-gradient(145deg, #0d1628, #12203a)',
                  border: expanded === ticket.id
                    ? '1px solid rgba(212,175,55,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, overflow: 'hidden',
                  transition: 'border-color 300ms',
                }}
              >
                {/* Ticket header (always visible) */}
                <div
                  onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.2rem', cursor: 'pointer',
                  }}
                >
                  {ticket.moviePoster && (
                    <img
                      src={ticket.moviePoster}
                      alt=""
                      style={{ width: 48, aspectRatio: '2/3', objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ticket.movieTitle}
                    </div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'rgba(245,240,232,0.55)', lineHeight: 1.5 }}>
                      {ticket.theatre} · {ticket.city} · {ticket.time} · {ticket.format}<br />
                      Seats: {ticket.seats.join(', ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#d4af37', fontSize: '1rem' }}>
                      ₹{ticket.total}
                    </div>
                    <div style={{
                      fontFamily: 'Outfit, sans-serif', fontSize: '0.68rem',
                      color: 'rgba(245,240,232,0.35)', marginTop: '0.2rem',
                    }}>
                      {formatDate(ticket.bookedAt)}
                    </div>
                  </div>
                  <div style={{ color: 'rgba(245,240,232,0.4)', fontSize: '0.75rem', marginLeft: '0.3rem' }}>
                    {expanded === ticket.id ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === ticket.id && (
                  <>
                    {/* Dashed tear line */}
                    <div style={{
                      borderTop: '2px dashed rgba(212,175,55,0.2)',
                      margin: '0 1.2rem',
                      position: 'relative',
                    }}>
                      <div style={{ position: 'absolute', left: -20, top: -10, width: 20, height: 20, background: '#07090f', borderRadius: '50%' }} />
                      <div style={{ position: 'absolute', right: -20, top: -10, width: 20, height: 20, background: '#07090f', borderRadius: '50%' }} />
                    </div>

                    <div style={{ padding: '1.2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {/* QR */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <QRCode ticketId={ticket.id} size={110} />
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.62rem', color: 'rgba(245,240,232,0.35)', letterSpacing: '0.06em' }}>
                          DEMO ONLY — NOT VALID FOR ENTRY
                        </div>
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <Detail label="Ticket ID"   value={ticket.id} mono />
                        <Detail label="Cinema"      value={`${ticket.theatre}, ${ticket.city}`} />
                        <Detail label="Showtime"    value={`${ticket.time} · ${ticket.format}`} />
                        <Detail label="Seats"       value={ticket.seats.join(', ')} />
                        {ticket.snacks?.length > 0 && (
                          <Detail label="Snacks"    value={ticket.snacks.join(', ')} />
                        )}
                        <Detail label="Total Paid"  value={`₹${ticket.total}`} gold />

                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                          <Link
                            to={`/movie/${ticket.movieId}`}
                            style={{
                              padding: '0.4rem 0.9rem',
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: 6, fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem',
                              color: 'rgba(245,240,232,0.75)', textDecoration: 'none',
                            }}
                          >
                            Movie Details
                          </Link>
                          <button
                            onClick={() => removeTicket(ticket.id)}
                            style={{
                              padding: '0.4rem 0.9rem',
                              background: 'rgba(252,129,129,0.08)',
                              border: '1px solid rgba(252,129,129,0.2)',
                              borderRadius: 6, fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem',
                              color: '#fc8181', cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, gold, mono }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', gap: '1rem',
    }}>
      <span style={{ color: 'rgba(245,240,232,0.45)', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: gold ? '#d4af37' : '#f5f0e8',
        fontWeight: gold ? 700 : 400,
        fontFamily: mono ? 'monospace' : 'Outfit, sans-serif',
        textAlign: 'right', wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}
