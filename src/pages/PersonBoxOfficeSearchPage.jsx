import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function PersonBoxOfficeSearchPage() {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  // Person search handler
  const handleSearchChange = async (e) => {
    setSearch(e.target.value);
    if (e.target.value.length > 1) {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(e.target.value)}`);
      const data = await res.json();
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a1833] via-[#181c24] to-black text-white font-sans relative overflow-x-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center w-full px-8 py-4 bg-gradient-to-b from-black/90 via-[#181c24]/80 to-transparent backdrop-blur-xl border-b border-[#232526]/40 shadow-lg">
        <Link to="/" className="text-2xl font-extrabold tracking-tight font-playfair text-white hover:text-cyan-400 transition-colors select-none">visual.cineaste</Link>
      </div>
      <div className="pt-28 pb-8 flex flex-col items-center justify-center flex-1">
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 font-sans tracking-tight">Search Person Box Office</h1>
        <p className="text-sm text-gray-300 font-normal text-center mb-4 max-w-md mx-auto font-sans">Find any actor, director, or crew and view their box office collection.</p>
        <form className="w-full max-w-xl flex items-center bg-[#181c24] rounded-full shadow-xl border border-[#232526] focus-within:ring-2 focus-within:ring-cyan-400 px-3 py-2 mb-2">
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search person for box office..."
            className="flex-1 bg-transparent outline-none px-2 py-1 text-base font-sans text-white rounded-full placeholder:text-gray-400"
            style={{ fontFamily: 'Inter, Poppins, Source Sans Pro, sans-serif' }}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          <button
            type="submit"
            className="ml-1 text-cyan-400 text-xl p-1 rounded-full hover:bg-[#232526]/60 transition flex items-center justify-center"
            aria-label="Search"
            tabIndex={-1}
            onMouseDown={e => e.preventDefault()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </button>
        </form>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-[#232526] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto border border-cyan-900 w-full max-w-xl mx-auto">
            {suggestions.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-cyan-900/40"
                onMouseDown={() => handleSuggestionClick(s.id)}
              >
                <img src={s.profile_path ? `https://image.tmdb.org/t/p/w45${s.profile_path}` : '/actor-placeholder.jpg'} alt={s.name} className="w-8 h-8 rounded-full object-cover bg-gray-700" />
                <span className="text-white text-sm">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
