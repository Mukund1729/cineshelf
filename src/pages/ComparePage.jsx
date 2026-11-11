import React, { useState, useEffect } from 'react';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const FALLBACK_POSTER = '/actor-placeholder.jpg';

const LANGUAGES = [
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
];

function CompareCard({ data }) {
  if (!data) return null;
  return (
    <div className="bg-[#181c24] rounded-2xl shadow-2xl p-6 w-full max-w-4xl flex flex-col md:flex-row gap-6 items-center md:items-start border border-[#232526] relative">
      <img
        src={data.poster}
        alt={data.title}
        className="w-40 h-60 object-cover rounded-xl shadow-lg mb-4 md:mb-0"
        onError={e => { e.target.onerror = null; e.target.src = FALLBACK_POSTER; }}
      />
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-2xl md:text-3xl font-bold text-cyan-200 font-playfair">{data.title}</span>
          <span className="text-base text-gray-400 font-semibold">({data.year})</span>
          {data.tagline && <span className="italic text-cyan-300 text-sm ml-2">“{data.tagline}”</span>}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-cyan-100 mb-2">
          <span className="bg-[#232526] px-2 py-1 rounded-full">{data.language?.toUpperCase()}</span>
          {data.genres && data.genres.map(g => <span key={g} className="bg-cyan-900 px-2 py-1 rounded-full">{g}</span>)}
          {data.runtime && <span className="bg-[#232526] px-2 py-1 rounded-full">{data.runtime} min</span>}
        </div>
        <div className="text-sm text-gray-200 mb-2 line-clamp-5">{data.overview || 'No overview available.'}</div>
        <div className="flex flex-wrap gap-4 mb-2">
          <span className="text-cyan-300 font-bold">Box Office: <span className="text-white">{data.revenue ? data.revenue : 'N/A'}</span></span>
          <span className="text-cyan-300 font-bold">Rating: <span className="text-white">{data.rating ? data.rating : 'N/A'}</span></span>
          <span className="text-cyan-300 font-bold">Votes: <span className="text-white">{data.vote_count ?? 'N/A'}</span></span>
        </div>
        {data.director && <div className="text-sm text-cyan-200 mb-1">Director: <span className="text-white font-semibold">{data.director}</span></div>}
        {data.cast && data.cast.length > 0 && (
          <div className="text-sm text-cyan-200 mb-1">Cast: <span className="text-white font-semibold">{data.cast.slice(0, 8).join(', ')}</span></div>
        )}
        {data.production && data.production.length > 0 && (
          <div className="text-xs text-gray-400 mt-2">Production: {data.production.join(', ')}</div>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trainMovies, setTrainMovies] = useState([]);
  const [language, setLanguage] = useState('hi');

  // Fetch a set of popular movies for the train on mount or language change
  useEffect(() => {
    async function fetchTrain() {
      const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=${language}&region=IN&sort_by=popularity.desc&page=1`;
      const res = await fetch(url);
      const data = await res.json();
      setTrainMovies(data.results || []);
    }
    fetchTrain();
  }, [language]);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  }

  async function handleSelect(item) {
    // Fetch details for selected movie/TV
    let details = null;
    if (item.media_type === 'movie') {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
      details = await res.json();
    } else if (item.media_type === 'tv') {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
      details = await res.json();
    }
    setSelected(sel => [
      ...sel,
      {
        title: details.title || details.name,
        year: (details.release_date || details.first_air_date || '').slice(0, 4),
        language: details.original_language,
        poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : FALLBACK_POSTER,
        revenue: details.revenue ? `₹${details.revenue.toLocaleString('en-IN')}` : 'N/A',
        rating: details.vote_average,
        vote_count: details.vote_count,
        runtime: details.runtime || details.episode_run_time?.[0],
        genres: details.genres ? details.genres.map(g => g.name) : [],
        overview: details.overview,
        tagline: details.tagline,
        cast: details.credits && details.credits.cast ? details.credits.cast.slice(0, 8).map(c => c.name) : [],
        director: details.credits && details.credits.crew ? (details.credits.crew.find(c => c.job === 'Director')?.name || null) : null,
        production: details.production_companies ? details.production_companies.map(p => p.name) : [],
      }
  ]);
    setResults([]);
    setQuery('');
  }

  function handleRemove(idx) {
    setSelected(sel => sel.filter((_, i) => i !== idx));
  }

  // Add from train
  async function handleTrainSelect(movie) {
    // Fetch details for selected movie
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
    const details = await res.json();
    setSelected(sel => [
      ...sel,
      {
        title: details.title || details.name,
        year: (details.release_date || details.first_air_date || '').slice(0, 4),
        language: details.original_language,
        poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : FALLBACK_POSTER,
        revenue: details.revenue ? `₹${details.revenue.toLocaleString('en-IN')}` : 'N/A',
        rating: details.vote_average,
        vote_count: details.vote_count,
        runtime: details.runtime || details.episode_run_time?.[0],
        genres: details.genres ? details.genres.map(g => g.name) : [],
        overview: details.overview,
        tagline: details.tagline,
        cast: details.credits && details.credits.cast ? details.credits.cast.slice(0, 8).map(c => c.name) : [],
        director: details.credits && details.credits.crew ? (details.credits.crew.find(c => c.job === 'Director')?.name || null) : null,
        production: details.production_companies ? details.production_companies.map(p => p.name) : [],
      }
    ]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#181c24] to-[#1a1333] text-white font-sans p-4">
      {/* Logo and title */}
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-2xl font-extrabold tracking-tight font-playfair text-white hover:text-cyan-400 transition-colors select-none">
          visual.cineaste
        </a>
        <div className="flex-1 flex justify-center">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-cyan-100 font-playfair drop-shadow-lg">Compare Movies & TV Shows</h1>
        </div>
      </div>
      {/* Language filter pills */}
      <div className="flex justify-center gap-2 mb-4">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            className={`px-4 py-1 rounded-full font-semibold text-sm transition-all ${language === l.code ? 'bg-cyan-400 text-black shadow' : 'bg-[#232526] text-cyan-200 hover:bg-cyan-700 hover:text-white'}`}
            onClick={() => setLanguage(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>
      {/* Aesthetic search bar */}
      <form onSubmit={handleSearch} className="w-full max-w-xl mx-auto flex items-center bg-[#181c24] rounded-full shadow-xl border border-[#232526] focus-within:ring-2 focus-within:ring-cyan-400 px-3 py-2 mb-6">
        <input
          className="flex-1 bg-transparent outline-none px-2 py-1 text-base font-sans text-white rounded-full placeholder:text-gray-400"
          style={{ fontFamily: 'Inter, Poppins, Source Sans Pro, sans-serif' }}
          placeholder="Search movie or TV show..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="ml-1 text-cyan-400 text-xl p-1 rounded-full hover:bg-[#232526]/60 transition flex items-center justify-center" aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
        </button>
      </form>
      {/* Horizontal train of movies for quick pick */}
      <div className="relative overflow-x-auto mt-2 mb-8 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent"
        style={{ WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)' }}>
        <div
          className="flex gap-3 md:gap-4 lg:gap-5 items-stretch animate-train min-w-[600px] md:min-w-0"
          style={{
            animation: 'train 32s linear infinite',
            '--pause': 'paused',
          }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {trainMovies.concat(trainMovies).map((movie, idx) => (
            <div
              key={movie.id + '-' + idx}
              className="bg-[#181c24] rounded-lg shadow-md overflow-hidden hover:scale-105 hover:shadow-cyan-400 transition-transform duration-200 group cursor-pointer min-w-[120px] max-w-[120px] flex-shrink-0 relative"
              onClick={() => handleTrainSelect(movie)}
            >
              <img
                src={movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : FALLBACK_POSTER}
                alt={movie.title}
                className="w-full h-40 object-cover rounded-t-lg group-hover:opacity-90 transition"
              />
              <div className="p-2 text-center absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent">
                <div className="text-white font-bold text-xs font-lato truncate text-shadow line-clamp-2">{movie.title}</div>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          @keyframes train {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-train {
            animation-play-state: running;
          }
          .text-shadow {
            text-shadow: 0 2px 8px #000, 0 1px 2px #000;
          }
        `}</style>
      </div>
      {loading && <div className="text-center text-cyan-300">Searching...</div>}
      {results.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {results.map(r => (
            <div key={r.id + r.media_type} className="bg-[#232526] rounded p-2 flex flex-col items-center w-40 cursor-pointer hover:bg-cyan-900/40" onClick={() => handleSelect(r)}>
              <img src={r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : FALLBACK_POSTER} alt={r.title || r.name} className="w-20 h-32 object-cover rounded mb-1" />
              <div className="text-xs text-cyan-100 text-center">{r.title || r.name}</div>
              <div className="text-xs text-cyan-200">{r.media_type === 'movie' ? 'Movie' : 'TV'}</div>
            </div>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-row flex-wrap gap-8 items-start justify-center w-full max-w-full mt-8">
          {selected.map((m, i) => (
            <div key={i} className="relative w-full max-w-4xl flex-1 flex justify-center">
              <CompareCard data={m} />
              <button className="absolute top-2 right-2 bg-cyan-700 text-white rounded-full px-2 py-1 text-xs hover:bg-cyan-900" onClick={() => handleRemove(i)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {selected.length === 0 && <div className="text-center text-cyan-300 mt-12">Select movies or TV shows to compare.</div>}
    </div>
  );
}
