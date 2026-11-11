"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from 'react-router-dom';

const GENRES = [
  { name: "Drama", id: 18, color: "from-pink-900 via-pink-700 to-[#232526]", featuredMovieId: 389 }, // 12 Angry Men
  { name: "Sci-Fi", id: 878, color: "from-cyan-900 via-blue-800 to-[#232526]", featuredMovieId: 157336 }, // Interstellar
  { name: "Action", id: 28, color: "from-yellow-900 via-yellow-700 to-[#232526]", featuredMovieId: 155 }, // The Dark Knight
  { name: "Comedy", id: 35, color: "from-green-900 via-green-700 to-[#232526]", featuredMovieId: 2105 }, // American Pie
  { name: "Horror", id: 27, color: "from-purple-900 via-purple-700 to-[#232526]", featuredMovieId: 694 }, // The Shining
  { name: "Romance", id: 10749, color: "from-red-900 via-pink-700 to-[#232526]", featuredMovieId: 76 }, // Before Sunrise
];

const getPoster = (path) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder.jpg";

const marqueeStyle = {
  display: 'flex',
  gap: '1.5rem',
  animation: 'marquee 30s linear infinite',
};
const marqueeKeyframes = `
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
`;

// User-requested, critically acclaimed Comedy Top Rated and Hidden Gems (with correct TMDB IDs)
const CURATED_TOP_RATED = {
  Drama: [278, 238, 103, 424, 389, 13, 550, 496243, 4896, 453], // Shawshank Redemption, The Godfather, Taxi Driver, Schindler’s List, 12 Angry Men, Forrest Gump, Fight Club, Parasite, Good Will Hunting, A Beautiful Mind
  'Sci-Fi': [157336, 27205, 603, 335984, 329865, 11224, 264660, 62, 1891, 49047],
  Action: [245891, 155, 680, 76341, 64690, 278, 500, 500, 24, 949], // John Wick, The Dark Knight, Pulp Fiction, Mad Max: Fury Road, The Raid: Redemption, The Departed, Reservoir Dogs, Kill Bill Vol. 1, Gladiator, Heat
  Comedy: [8363, 120467, 116741, 115, 106646, 77338, 137, 515195, 76203, 55721],
  Horror: [694, 419430, 381288, 948, 447332, 138843, 539, 242224, 270303, 310131],
  Romance: [38, 313369, 289, 639, 76, 80, 416477, 19913, 111, 17245],
};

// Cinephile-curated Hidden Gem movie IDs for each genre
const CURATED_HIDDEN_GEMS = {
  Drama: [168530, 14337, 470878, 8012, 157353, 12651, 582, 866, 59440, 31011],
  'Sci-Fi': [238636, 17431, 474350, 206487, 13811, 500664, 184346, 482321, 77338, 419430],
  Action: [615658, 422297, 480042, 391713, 497582, 505192, 449443, 408648, 427564, 408648], // Nobody, Upgrade, The Night Comes for Us, Atomic Blonde, The Man from Nowhere, Triple Threat, Shadow, Bushwick, Hotel Artemis, The Villainess
  Comedy: [65754, 290250, 80035, 371645, 246741, 22803, 337167, 376660, 116799, 53290],
  Romance: [300668, 122906, 205596, 318846, 399057, 14337, 244786, 57212, 32856, 10329],
  Horror: [397243, 345911, 399035, 397243, 238636, 10027, 265195, 377107, 482373, 489999],
};

export default function GenreHighlights() {
  const [activeGenre, setActiveGenre] = useState(null);
  const [loading, setLoading] = useState({}); // loading per genre
  const [movies, setMovies] = useState({});
  const [hiddenGems, setHiddenGems] = useState({});
  const [newArrivals, setNewArrivals] = useState({});
  const [providers, setProviders] = useState({});
  const [featuredPosters, setFeaturedPosters] = useState({}); // genreName -> poster_path
  const [shiftedGenre, setShiftedGenre] = useState(null); // for animation

  // Fetch featured movie posters for each genre on mount
  useEffect(() => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    GENRES.forEach(async (genre) => {
      if (genre.featuredMovieId) {
        try {
          const res = await axios.get(`https://api.themoviedb.org/3/movie/${genre.featuredMovieId}?api_key=${apiKey}`);
          setFeaturedPosters(prev => ({ ...prev, [genre.name]: res.data.poster_path }));
        } catch {}
      }
    });
  }, []);

  const fetchGenreData = async (genre) => {
    setLoading((prev) => ({ ...prev, [genre.name]: true }));
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    // Top Rated (curated)
    let topMovies = [];
    if (CURATED_TOP_RATED[genre.name]) {
      // Fetch each movie by ID
      topMovies = await Promise.all(
        CURATED_TOP_RATED[genre.name].map(async (id) => {
          try {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`);
            return res.data;
          } catch {
            return null;
          }
        })
      );
      topMovies = topMovies.filter(Boolean);
    } else {
      // fallback to discover
      const top = await axios.get(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genre.id}&sort_by=vote_average.desc&vote_count.gte=100`
      );
      topMovies = top.data.results.slice(0, 10);
    }
    // Hidden Gems (curated for Comedy)
    let gems;
    if (CURATED_HIDDEN_GEMS[genre.name]) {
      gems = await Promise.all(
        CURATED_HIDDEN_GEMS[genre.name].map(async (id) => {
          try {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`);
            return res.data;
          } catch {
            return null;
          }
        })
      );
      gems = gems.filter(Boolean);
    } else {
      // fallback to discover
      const gemsRes = await axios.get(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genre.id}&vote_average.gte=6&vote_count.lte=300&sort_by=vote_average.desc`
      );
      gems = gemsRes.data.results.slice(0, 10);
    }
    // New Arrivals (last 6 months, region IN, must be on OTT)
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
    const dateStr = sixMonthsAgo.toISOString().split('T')[0];
    const arrivals = await axios.get(
      `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genre.id}&primary_release_date.gte=${dateStr}&region=IN&sort_by=release_date.desc`
    );
    // Providers for new arrivals (filter only those with OTT in IN)
    const ottMovies = [];
    const provs = {};
    await Promise.all(
      arrivals.data.results.slice(0, 30).map(async (movie) => {
        try {
          const provRes = await axios.get(
            `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`
          );
          const inProviders = provRes.data.results?.IN?.flatrate || [];
          if (inProviders.length > 0) {
            ottMovies.push({ ...movie, ott: inProviders.map((p) => p.provider_name) });
            provs[movie.id] = inProviders.map((p) => p.provider_name);
          }
        } catch {
          provs[movie.id] = [];
        }
      })
    );
    setMovies((prev) => ({ ...prev, [genre.name]: topMovies }));
    setHiddenGems((prev) => ({ ...prev, [genre.name]: gems }));
    setNewArrivals((prev) => ({ ...prev, [genre.name]: ottMovies.slice(0, 10) }));
    setProviders((prev) => ({ ...prev, ...provs }));
    setLoading((prev) => ({ ...prev, [genre.name]: false }));
  };

  const handleGenreClick = async (genre) => {
    if (activeGenre === genre.name) {
      setActiveGenre(null);
      setShiftedGenre(null);
    } else {
      setActiveGenre(genre.name);
      if (!movies[genre.name]) {
        await fetchGenreData(genre);
      }
      // After data is loaded, trigger the shift
      setTimeout(() => setShiftedGenre(genre.name), 10);
    }
  };

  return (
    <section className="container mx-auto px-4 my-20">
      <style>{marqueeKeyframes}</style>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-12">
        {GENRES.map((genre) => {
          // Use the featured movie's poster for this genre
          const topPoster = featuredPosters[genre.name]
            ? getPoster(featuredPosters[genre.name])
            : null;
          const isShifted = shiftedGenre === genre.name && activeGenre === genre.name && !loading[genre.name];
          return (
            <button
              key={genre.name}
              className={`rounded-2xl shadow-xl h-40 flex items-end justify-start bg-gradient-to-br ${genre.color} hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-400/40 relative w-full p-6 ${activeGenre === genre.name ? 'ring-4 ring-cyan-400/60' : ''} ${isShifted ? 'translate-y-[-20px] mb-2' : 'mb-8'} transition-all duration-500`}
              onClick={() => handleGenreClick(genre)}
              aria-expanded={activeGenre === genre.name}
              style={{overflow: 'hidden'}}
            >
              {/* Cinematic background poster with blur and gradient overlay */}
              {topPoster && (
                <>
                  <img
                    src={topPoster}
                    alt={genre.name + ' poster'}
                    className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-60 blur-[2px] scale-110 pointer-events-none select-none z-0 transition-all duration-500"
                    draggable="false"
                  />
                  {/* Gradient overlay for contrast */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
                </>
              )}
              {/* fallback: no poster loaded yet, just gradient */}
              <span className="text-2xl font-bold font-playfair text-white drop-shadow-lg z-20 relative">{genre.name}</span>
            </button>
          );
        })}
      </div>
      {GENRES.map((genre) => (
        activeGenre === genre.name && (
          <div key={genre.name} className="mb-20 animate-fade-in">
            <h3 className="text-2xl font-semibold font-playfair text-cyan-100 mb-6">{genre.name}</h3>
            {loading[genre.name] ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {/* Top Rated */}
                <div className="mb-8">
                  <h4 className="text-lg font-bold text-pink-400 mb-2">Top Rated</h4>
                  <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent">
                    {(movies[genre.name] || []).map((movie, idx) => (
                      <Link
                        to={`/movie/${movie.id}`}
                        key={movie.id}
                        className="min-w-[120px] max-w-[120px] flex-shrink-0 bg-[#181c24] rounded-lg overflow-hidden shadow-md hover:scale-105 hover:shadow-pink-400 transition-transform duration-200 flex flex-col items-center relative"
                      >
                        <img
                          src={getPoster(movie.poster_path)}
                          alt={movie.title}
                          className="w-full h-40 object-cover rounded-t-lg"
                          onError={e => { e.target.onerror = null; e.target.src = '/placeholder.jpg'; }}
                        />
                        <h4 className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{movie.title}</h4>
                        <span className="text-pink-300 font-bold mb-2 text-[10px]">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
                        <span className="absolute top-2 left-2 bg-pink-700/80 text-white text-xs px-2 py-1 rounded font-semibold shadow">Top Rated</span>
                      </Link>
                    ))}
                  </div>
                </div>
                {/* Hidden Gems */}
                <div className="mb-8">
                  <h4 className="text-lg font-bold text-yellow-400 mb-2">Hidden Gems</h4>
                  <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent">
                    {[...(hiddenGems[genre.name] || [])].map((movie, idx) => (
                      <Link
                        to={`/movie/${movie.id}`}
                        key={movie.id + '-' + idx}
                        className="min-w-[120px] max-w-[120px] flex-shrink-0 bg-[#181c24] rounded-lg overflow-hidden shadow-md hover:scale-105 hover:shadow-yellow-400 transition-transform duration-200 flex flex-col items-center relative"
                      >
                        <img
                          src={getPoster(movie.poster_path)}
                          alt={movie.title}
                          className="w-full h-40 object-cover rounded-t-lg"
                          onError={e => { e.target.onerror = null; e.target.src = '/placeholder.jpg'; }}
                        />
                        <h4 className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{movie.title}</h4>
                        <span className="text-yellow-300 font-bold mb-2 text-[10px]">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
                        <span className="absolute top-2 left-2 bg-yellow-700/80 text-white text-xs px-2 py-1 rounded font-semibold shadow">Hidden Gem</span>
                      </Link>
                    ))}
                  </div>
                </div>
                {/* New Arrivals */}
                <div>
                  <h4 className="text-lg font-bold text-green-400 mb-2">New Arrivals</h4>
                  {(newArrivals[genre.name] || []).length === 0 ? (
                    <div className="text-gray-400 italic py-8 text-center">No new arrivals on OTT for this genre right now.</div>
                  ) : (
                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent">
                      {[...(newArrivals[genre.name] || [])].map((movie, idx) => (
                        <Link
                          to={`/movie/${movie.id}`}
                          key={movie.id + '-' + idx}
                          className="min-w-[120px] max-w-[120px] flex-shrink-0 bg-[#181c24] rounded-lg overflow-hidden shadow-md hover:scale-105 hover:shadow-green-400 transition-transform duration-200 flex flex-col items-center relative"
                        >
                          <img
                            src={getPoster(movie.poster_path)}
                            alt={movie.title}
                            className="w-full h-40 object-cover rounded-t-lg"
                            onError={e => { e.target.onerror = null; e.target.src = '/placeholder.jpg'; }}
                          />
                          <h4 className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{movie.title}</h4>
                          <span className="text-green-300 font-bold mb-2 text-[10px]">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
                          {movie.ott && movie.ott.length > 0 && (
                            <span className="absolute top-2 left-2 bg-green-700/80 text-white text-xs px-2 py-1 rounded font-semibold shadow">
                              {movie.ott.join(', ')}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      ))}
    </section>
  );
}
