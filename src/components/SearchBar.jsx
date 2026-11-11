import React, { useState, useRef } from "react";

const SearchBar = ({ onSearch, placeholder, className, value, onChange }) => {
  const [internalQuery, setInternalQuery] = useState("");
  const isControlled = typeof value === "string" && typeof onChange === "function";
  const query = isControlled ? value : internalQuery;
  const debounceRef = useRef();

  const handleChange = (e) => {
    const val = e.target.value;
    if (isControlled) {
      onChange(val);
    } else {
      setInternalQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (onSearch) onSearch(val);
      }, 350); // 350ms debounce for smoothness
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className={`mb-8 flex justify-center items-center gap-2 w-full max-w-xl mx-auto ${className || ""}`}>
      <div className="relative flex-1">
        <input
          type="text"
          placeholder={placeholder || "Search movies..."}
          value={query}
          onChange={handleChange}
          className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-[#232526] via-[#181c24] to-[#1a1333] text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-xl placeholder-gray-400 transition-all duration-300 border border-[#232526] text-lg font-lato"
          style={{ boxShadow: '0 4px 24px 0 rgba(31, 38, 135, 0.15)' }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { isControlled ? onChange("") : setInternalQuery(""); if (onSearch) onSearch(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-2xl transition-colors duration-200"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      <button
        type="submit"
        className="px-7 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg hover:from-blue-600 hover:to-cyan-500 transition-all duration-300 flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 align-middle">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
        </svg>
        Search
      </button>
    </form>
  );
};

export default SearchBar;