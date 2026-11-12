import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';

export default function BoxOfficeByPerson() {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  // Person search handler
  const handleSearchChange = async (e) => {
    setSearch(e.target.value);
    if (e.target.value.length > 1) {
      const data = await tmdbGet('/search/person', { query: e.target.value });
      setSuggestions(data.results || []);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };
  const handleSuggestionClick = (personId) => {
    setShowSuggestions(false);
    setSearch("");
    navigate(`/person/${personId}/boxoffice`);
  };

  return (
    <div className="pt-2 pb-8 flex flex-col items-center justify-center min-h-[300px]">
      <h1 className="text-2xl md:text-3xl font-bold font-playfair text-[#d4af37] mb-2 text-center">Search Person Box Office</h1>
      <p className="text-gray-300 text-center mb-4 max-w-xl">Find any actor, director, or crew and view their box office collection.</p>
      {/* Search Bar for Person Box Office */}
      <div className="w-full flex justify-center mb-2">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            className="w-full px-4 py-2 rounded-lg bg-[#232526] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d4af37] shadow"
            placeholder="Search person for box office..."
            value={search}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-[#232526] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto border border-[#d4af37]/30">
              {suggestions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[#d4af37]/15"
                  onMouseDown={() => handleSuggestionClick(s.id)}
                >
                  <img src={s.profile_path ? tmdbImageUrl(s.profile_path, 'w45') : '/actor-placeholder.jpg'} alt={s.name} className="w-8 h-8 rounded-full object-cover bg-gray-700" />
                  <span className="text-white text-sm">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
