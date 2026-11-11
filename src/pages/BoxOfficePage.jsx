import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const START_YEAR = 1980;
const END_YEAR = new Date().getFullYear();

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function groupByDay(movies) {
  const groups = {};
  for (const movie of movies) {
    const day = movie.release_date || 'Unknown Date';
    if (!groups[day]) groups[day] = [];
    groups[day].push(movie);
  }
  // Sort dates descending
  return Object.entries(groups).sort((a, b) => {
    if (a[0] === 'Unknown Date') return 1;
    if (b[0] === 'Unknown Date') return -1;
    return b[0].localeCompare(a[0]);
  });
}

export default function BoxOfficePage() {
  const [year, setYear] = useState(END_YEAR);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    async function fetchAllMovies() {
      setLoading(true);
      setError(null);
      setMovies([]);
      setProgress({ current: 0, total: 0 });

      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY;

        // Fetch page 1 first to get total_pages
        const firstUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=primary_release_date.desc&primary_release_year=${year}&page=1&vote_count.gte=10`;
        const firstRes = await fetch(firstUrl);
        if (!firstRes.ok) throw new Error('Failed to fetch movies');
        const firstData = await firstRes.json();

        const totalPages = Math.min(firstData.total_pages || 1, 20); // max 20 pages = 400 movies
        setProgress({ current: 1, total: totalPages });

        let allMovies = [...(firstData.results || [])];

        // Fetch remaining pages in parallel (batches of 5)
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const batchSize = 5;

        for (let i = 0; i < remainingPages.length; i += batchSize) {
          const batch = remainingPages.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (page) => {
              const url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=primary_release_date.desc&primary_release_year=${year}&page=${page}&vote_count.gte=10`;
              const res = await fetch(url);
              if (!res.ok) return [];
              const data = await res.json();
              return data.results || [];
            })
          );
          const batchMovies = batchResults.flat();
          allMovies = [...allMovies, ...batchMovies];
          setProgress({ current: Math.min(1 + i + batchSize, totalPages), total: totalPages });
        }

        // Remove duplicates by movie id
        const seen = new Set();
        const unique = allMovies.filter(m => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        // Sort by release date descending
        unique.sort((a, b) => {
          if (!a.release_date) return 1;
          if (!b.release_date) return -1;
          return b.release_date.localeCompare(a.release_date);
        });

        setMovies(unique);
      } catch (err) {
        setError('Could not load box office data.');
      } finally {
        setLoading(false);
      }
    }

    fetchAllMovies();
  }, [year]);

  const dayGroups = groupByDay(movies);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#181c24] to-[#1a1333] text-white font-lato relative overflow-x-hidden">
      {/* Hero Section */}
      <div className="pt-24 pb-8 flex flex-col items-center justify-center">
        <h1 className="text-3xl md:text-4xl font-bold font-playfair text-cyan-300 mb-2 text-center">Box Office by Year</h1>
        <p className="text-gray-300 text-center mb-4 max-w-xl">Explore movies released each year, grouped day by day. Filter by year to see all releases!</p>

        {/* Year Selector */}
        <div className="w-full flex justify-center mb-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent px-2 py-1 rounded-lg bg-[#181c24]/60">
            {range(START_YEAR, END_YEAR).reverse().map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-full font-semibold text-sm transition-all flex-shrink-0 ${year === y ? 'bg-cyan-400 text-black shadow' : 'bg-[#232526] text-cyan-200 hover:bg-cyan-700 hover:text-white'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Movies List */}
      <div className="container mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-52 gap-4">
            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-cyan-400 border-opacity-80"></div>
            {progress.total > 0 && (
              <div className="text-center">
                <div className="text-cyan-300 font-semibold text-sm mb-1">
                  Fetching data... {progress.current}/{progress.total} pages
                </div>
                <div className="w-64 bg-[#232526] rounded-full h-2">
                  <div
                    className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-12">{error}</div>
        ) : movies.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No movies found for {year}.</div>
        ) : (
          <div className="space-y-10">
            {/* Summary */}
            <div className="text-center text-gray-400 text-sm">
              Showing <span className="text-cyan-300 font-bold">{movies.length}</span> movies across <span className="text-cyan-300 font-bold">{dayGroups.length}</span> release days in <span className="text-cyan-300 font-bold">{year}</span>
            </div>

            {dayGroups.map(([day, dayMovies]) => (
              <div key={day}>
                {/* Day Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-cyan-700/60 to-transparent" />
                  <div className="bg-[#1e2533] border border-cyan-700/40 rounded-xl px-5 py-2 text-center">
                    <div className="text-cyan-300 font-bold text-base font-playfair">{formatDate(day)}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{dayMovies.length} movie{dayMovies.length !== 1 ? 's' : ''} released</div>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-cyan-700/60 to-transparent" />
                </div>

                {/* Movies Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {dayMovies.map(movie => (
                    <div
                      key={movie.id}
                      className="bg-[#181c24] rounded-xl shadow-lg overflow-hidden flex flex-col group hover:scale-105 hover:shadow-cyan-400/30 hover:shadow-lg transition-all duration-200 relative"
                    >
                      <Link to={`/movie/${movie.id}`} className="block">
                        <img
                          src={
                            movie.poster_path
                              ? `/api/tmdb/image/w300${movie.poster_path}`
                              : 'https://via.placeholder.com/300x450?text=No+Image'
                          }
                          alt={movie.title}
                          className="w-full h-56 object-cover rounded-t-xl group-hover:opacity-90 transition"
                        />
                      </Link>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <h3 className="text-white font-bold text-sm mb-1 line-clamp-2" title={movie.title}>
                          {movie.title}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-gray-300 mt-auto">
                          <span className="text-yellow-300 font-bold">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
                          <span className="text-gray-500">{movie.vote_count} votes</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
