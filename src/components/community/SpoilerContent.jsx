import React, { useState } from 'react';

export default function SpoilerContent({ children, active = false }) {
  const [revealed, setRevealed] = useState(!active);
  if (!active) return children;
  return (
    <button
      type="button"
      className={`cs-spoiler${revealed ? ' is-revealed' : ''}`}
      onClick={() => setRevealed(true)}
      aria-label={revealed ? 'Spoiler content' : 'Reveal spoiler'}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'inherit' }}
    >
      {children}
      {!revealed && (
        <span style={{ display: 'block', marginTop: 6, color: '#b59a76', fontSize: '0.75rem' }}>
          Spoiler — tap to reveal
        </span>
      )}
    </button>
  );
}
