import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';
import BrandLogo from '../components/BrandLogo';


const navLinks = [
  { to: '/', label: 'Discover' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/people', label: 'People' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/lists', label: 'Lists' },
  { to: '/watchlist', label: 'Watchlist' },
];

const PersonBoxOffice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  useEffect(() => {
    const fetchFilmography = async () => {
      try {
        // Fetch person details
        const personData = await tmdbGet(`/person/${id}`);
        setPerson(personData);

        // Fetch combined credits (acting + crew)
        const creditsData = await tmdbGet(`/person/${id}/combined_credits`);
        let allMovies = creditsData.cast.concat(creditsData.crew)
          .filter(m => m.media_type === 'movie' && m.release_date && m.id)
          .reduce((acc, curr) => {
            if (!acc.find(m => m.id === curr.id)) acc.push(curr);
            return acc;
          }, []);
        // Sort by box office revenue descending, then by release date desc
        allMovies = allMovies.sort((a, b) => {
          if (b.revenue !== a.revenue) return (b.revenue || 0) - (a.revenue || 0);
          return new Date(b.release_date) - new Date(a.release_date);
        });
        setMovies(allMovies);

        // Fetch box office for each movie (in parallel, but limit concurrency)
        const fetchBoxOffice = async (movie) => {
          const data = await tmdbGet(`/movie/${movie.id}`);
          return { ...movie, revenue: data.revenue };
        };
        // Use Promise.allSettled for smoother experience and show partial data as it loads
        let results = [];
        for (let i = 0; i < allMovies.length; i += 10) {
          const chunk = allMovies.slice(i, i + 10);
          const chunkResults = await Promise.allSettled(chunk.map(fetchBoxOffice));
          results.push(...chunkResults.filter(r => r.status === 'fulfilled').map(r => r.value));
          setMovies([...results].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)));
        }
        // Final sort
        setMovies([...results].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)));
      } catch (err) {
        setError("Failed to fetch box office data.");
      } finally {
        setLoading(false);
      }
    };
    fetchFilmography();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-cyan-400">Loading box office data...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#181c24] to-[#1a1333] text-white font-lato relative overflow-x-hidden">
      {/* Header with the site logo */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center w-full px-6 py-4 bg-gradient-to-b from-black/80 via-[#181c24]/60 to-transparent backdrop-blur-md">
        <BrandLogo style={{ width: 190 }} />
      </div>
      {/* Search Bar for Person Box Office */}
      <div className="w-full flex justify-center pt-20 pb-2">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            className="w-full px-4 py-2 rounded-lg bg-[#232526] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow"
            placeholder="Search person for box office..."
            value={search}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-[#232526] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto border border-cyan-900">
              {suggestions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-cyan-900/40"
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
      <div className="pt-6 max-w-5xl mx-auto p-6">
        <h1 className="text-3xl md:text-4xl font-bold font-playfair mb-6 text-cyan-200 drop-shadow">{person?.name}'s Box Office Collection</h1>
        {/* Horizontally scrolling movie train */}
        {movies.length > 0 && (
          <div className="relative overflow-x-auto mt-2 mb-8 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent vc-mobile-hide-train"
            style={{ WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)' }}>
            <div
              className="flex gap-4 items-stretch animate-train min-w-[600px] md:min-w-0"
              style={{
                animation: 'train 32s linear infinite',
                '--pause': 'paused',
              }}
              onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
              onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
            >
              {movies.concat(movies).map((movie, idx) => (
                <Link to={`/movie/${movie.id}`} key={movie.id + '-' + idx} className="bg-[#181c24] rounded-lg shadow-md overflow-hidden hover:scale-105 hover:shadow-cyan-400 transition-transform duration-200 group cursor-pointer min-w-[120px] max-w-[120px] flex-shrink-0 relative">
                  <img
                    src={movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w200') : '/placeholder.jpg'}
                    alt={movie.title}
                    className="w-full h-40 object-cover rounded-t-lg group-hover:opacity-90 transition"
                  />
                  <div className="p-2 text-center absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="text-white font-bold text-xs font-lato truncate text-shadow line-clamp-2">{movie.title}</div>
                    <div className="text-green-300 font-bold text-xs">{typeof movie.revenue === 'number' && movie.revenue > 0 ? `$${movie.revenue.toLocaleString()}` : movie.revenue === 0 ? '$0' : 'Fetching...'}</div>
                  </div>
                </Link>
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
        )}
        {/* Table fallback for full details */}
        <div className="overflow-x-auto rounded-2xl shadow-2xl bg-[#181c24] vc-mobile-table-wrap">
          <table className="min-w-full rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-cyan-900/60 text-cyan-200 text-lg">
                <th className="px-6 py-4 text-left font-semibold font-playfair">Title</th>
                <th className="px-6 py-4 text-left font-semibold font-playfair">Year</th>
                <th className="px-6 py-4 text-left font-semibold font-playfair">Role</th>
                <th className="px-6 py-4 text-left font-semibold font-playfair">Box Office</th>
              </tr>
            </thead>
            <tbody>
              {movies.map(movie => (
                <tr key={movie.id} className="border-b border-gray-700 hover:bg-cyan-900/20 transition group">
                  <td className="px-6 py-3">
                    <Link to={`/movie/${movie.id}`} className="text-cyan-300 hover:underline font-semibold font-playfair group-hover:text-pink-300 transition">
                      {movie.title || movie.original_title}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-200">{movie.release_date ? new Date(movie.release_date).getFullYear() : '-'}</td>
                  <td className="px-6 py-3 text-gray-300">{movie.character || movie.job || '-'}</td>
                  <td className="px-6 py-3 text-green-300 font-bold">
                    {typeof movie.revenue === 'number' && movie.revenue > 0
                      ? `$${movie.revenue.toLocaleString()}`
                      : movie.revenue === 0
                        ? '$0'
                        : 'Fetching...'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PersonBoxOffice;
