import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';
import './movie-detail.css';
import './person-detail.css';

export default function PersonBoxOfficeSearchPage() {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  const handleSearchChange = async event => {
    const value = event.target.value;
    setSearch(value);
    if (value.trim().length > 1) {
      try {
        const data = await tmdbGet('/search/person', { query: value.trim() });
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = personId => {
    setShowSuggestions(false);
    setSearch('');
    navigate(`/person/${personId}/boxoffice`);
  };

  return (
    <div className="md-page person-page">
      <div className="md-backdrop-shade" aria-hidden="true" />
      <Navbar />
      <div className="md-shell">
        <div className="md-search-hero">
          <h1>Person Box Office</h1>
          <p>Find any actor, director, or crew member and open their worldwide gross list.</p>
          <div className="md-person-search">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search person…"
              autoFocus
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              aria-label="Search person for box office"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="md-person-suggest" role="listbox">
                {suggestions.slice(0, 10).map(suggestion => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onMouseDown={() => handleSuggestionClick(suggestion.id)}
                  >
                    {suggestion.profile_path ? (
                      <img src={tmdbImageUrl(suggestion.profile_path, 'w45')} alt="" />
                    ) : (
                      <span className="md-person-suggest-fallback">{(suggestion.name || '?')[0]}</span>
                    )}
                    <span>
                      {suggestion.name}
                      {suggestion.known_for_department ? (
                        <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>
                          {suggestion.known_for_department}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
