import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiClock, FiCalendar, FiDollarSign, FiStar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import BoxOfficeChart from "../components/BoxOfficeChart";
import RatingStars from "../components/RatingStars";
// import ReviewForm from "../components/ReviewForm";
import axios from 'axios';
import TrailerEmbed from '../components/TrailerEmbed';
import JustWatch from 'justwatch-api';
import SearchBar from "../components/SearchBar";
import { searchMovies, searchPeople } from '../api/tmdb';

// Remove StreamingPlatforms component, integrated its logic into MovieDetail

const MovieDetail = () => {
  // Always get id and navigate from params/hooks first so they're available for all hooks
  const { id } = useParams();
  const navigate = useNavigate();
  // Add to Watchlist state
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistToast, setWatchlistToast] = useState('');
  // Review form state
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  // Search bar state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = React.useRef();
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Search effect: triggers search on input
  useEffect(() => {
    if (!showSearchBar) return;
    if (!searchQuery || searchQuery.trim().length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    setSearchLoading(true);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        // Search both movies and people, combine results
        const [movieRes, peopleRes] = await Promise.all([
          searchMovies(searchQuery),
          searchPeople(searchQuery)
        ]);
        let movieResults = (movieRes?.results || []).map(r => ({ ...r, media_type: 'movie' }));
        let peopleResults = (peopleRes?.results || []).map(r => ({ ...r, media_type: 'person' }));
        // Optionally, add TV search here if needed
        setSearchResults([...movieResults, ...peopleResults]);
        setSearchLoading(false);
      } catch (err) {
        setSearchError('Failed to fetch results.');
        setSearchLoading(false);
      }
    }, 400);
    // eslint-disable-next-line
  }, [searchQuery, showSearchBar]);

  // Fetch movie data from TMDb API
  const [movie, setMovie] = useState(null);
  useEffect(() => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!id) return;
    fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&append_to_response=credits,videos`)
      .then(res => res.json())
      .then(async data => {
        // Fetch watch providers and merge into movie object
        const providersRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${apiKey}`);
        const providersData = await providersRes.json();
        setMovie({ ...data, 'watch/providers': providersData });
      });
  }, [id]);

  // Add to Watchlist handler
  const handleAddToWatchlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setWatchlistToast('Please sign in to add to watchlist.');
      return;
    }
    setAddingToWatchlist(true);
    try {
      await axios.post('/api/watchlist', {
        tmdbId: movie.id,
        title: movie.title,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
        posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
        overview: movie.overview,
        releaseDate: movie.release_date,
        voteAverage: movie.vote_average,
        genreIds: movie.genre_ids
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setWatchlistToast('Added to watchlist!');
    } catch (err) {
      console.error('Watchlist add error:', err);
      setWatchlistToast('Failed to add. Try again.');
    } finally {
      setAddingToWatchlist(false);
      setTimeout(() => setWatchlistToast(''), 2000);
    }
  };

  // Submit review handler
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState(null);
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    if (!reviewText.trim() || reviewRating < 1 || reviewRating > 10) {
      setReviewError('Please provide a rating (1-10) and a review.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setReviewError('Please sign in to submit a review.');
      return;
    }
    setReviewLoading(true);
    try {
      const res = await axios.post('/api/review', {
        tmdbId: movie.id,
        title: movie.title,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
        posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
        overview: movie.overview,
        releaseDate: movie.release_date,
        voteAverage: movie.vote_average,
        genreIds: movie.genre_ids,
        rating: reviewRating,
        review: reviewText,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setReviews([res.data, ...reviews]);
      setReviewText('');
      setReviewRating(0);
    } catch (err) {
      setReviewError('Failed to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  // Box office state
  const [boxOffice, setBoxOffice] = useState([]);
  const [rawBoxOfficeData, setRawBoxOfficeData] = useState(null);
  const [boxOfficeError, setBoxOfficeError] = useState(null);
  const [thumbError, setThumbError] = useState(false);

  // Fetch box office from backend
  useEffect(() => {
    if (!id) return;
    setBoxOfficeError(null);
    setBoxOffice([]);
    setRawBoxOfficeData(null);
    axios.get(`/api/boxoffice/movie/${id}`)
      .then(res => {
        const data = res.data;
        if (!data) return;

        const list = [];
        const formatValue = (obj, label) => {
          if (!obj || obj.value === undefined || obj.value === null) return;
          let val = obj.value;
          let suffix = '';
          if (typeof val === 'number') {
            const isINR = obj.currency === 'INR' || label.toLowerCase().includes('india') || label.toLowerCase().includes('opening');
            if (isINR) {
              if (val >= 10000000) {
                val = (val / 10000000).toFixed(2);
                suffix = ' Cr';
              } else if (val >= 100000) {
                val = (val / 100000).toFixed(2);
                suffix = ' Lakh';
              } else {
                val = val.toLocaleString();
              }
              list.push({ name: label, amount: `₹${val}${suffix}`, source: obj.source });
            } else {
              // Assume USD
              if (val >= 1000000) {
                val = (val / 1000000).toFixed(2);
                suffix = ' M';
              } else {
                val = val.toLocaleString();
              }
              list.push({ name: label, amount: `$${val}${suffix}`, source: obj.source });
            }
          } else {
            list.push({ name: label, amount: val, source: obj.source });
          }
        };

        formatValue(data.budget, 'Budget');
        formatValue(data.openingDay, 'Opening Day');
        formatValue(data.openingWeekend, 'Opening Weekend');
        formatValue(data.indiaNet, 'India Net');
        formatValue(data.indiaGross, 'India Gross');
        formatValue(data.overseasGross, 'Overseas Gross');
        formatValue(data.worldwideGross, 'Worldwide Gross');
        formatValue(data.verdict, 'Verdict');

        setBoxOffice(list);
        setRawBoxOfficeData(data);
      })
      .catch(err => {
        console.warn('Could not load box office:', err.message);
      });
  }, [id]);

  // Recommendations and actor movies state
  const [recommendations, setRecommendations] = useState([]);
  const [actorMovies, setActorMovies] = useState([]);

  // Fetch recommendations and actor movies when movie is loaded
  useEffect(() => {
    const fetchRecsAndActorMovies = async () => {
      if (!movie) return;
      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      // Fetch recommendations
      try {
        const recRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/recommendations?api_key=${apiKey}`);
        const recData = await recRes.json();
        const recs = (recData.results || []).filter(m => m.poster_path && m.id !== movie.id);
        setRecommendations(recs.slice(0, 20));
      } catch (e) {
        setRecommendations([]);
      }
      // Fetch actor movies
      if (!movie.credits || !movie.credits.cast || movie.credits.cast.length === 0) return;
      const actor = movie.credits.cast[0];
      if (!actor || !actor.id) return;
      try {
        const res = await fetch(`https://api.themoviedb.org/3/person/${actor.id}/movie_credits?api_key=${apiKey}`);
        const data = await res.json();
        // Filter out movies without poster and the current movie
        const filtered = (data.cast || []).filter(m => m.poster_path && m.id !== movie.id);
        // Sort by popularity or release date
        filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        setActorMovies(filtered.slice(0, 20));
      } catch (e) {
        setActorMovies([]);
      }
    };
    fetchRecsAndActorMovies();
  }, [movie]);
  return (
    <div
      className="relative min-h-screen w-full"
      style={
        movie && movie.backdrop_path
          ? {
              backgroundImage: `url(/api/tmdb/image/original${movie.backdrop_path})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : { backgroundColor: '#10111a' }
      }
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/80 z-0" />
      {/* Sticky Site Name Bar (modern header, TVDetail style) */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between w-full px-4 py-2 bg-gradient-to-b from-black/90 via-[#181c24]/60 to-transparent backdrop-blur-md shadow-sm">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/') }>
          <span className="text-xl font-extrabold tracking-tight font-playfair text-white hover:text-cyan-400 transition-colors select-none">visual.cineaste</span>
        </div>
        <div className="fixed top-3 right-4 z-40">
          <button
            className="bg-[#181c24] p-1.5 rounded-full shadow-lg hover:bg-cyan-700 transition-colors focus:outline-none"
            onClick={() => setShowSearchBar(true)}
            aria-label="Open search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </button>
        </div>
      </div>
      {/* Overlay Search Bar (TVDetail style) */}
      {showSearchBar && (
        <div className="fixed top-0 left-0 w-full h-full z-50 flex items-start justify-end bg-black/40" onClick={() => setShowSearchBar(false)}>
          <div className="mt-8 mr-8 bg-[#181c24] rounded-xl shadow-2xl p-4 w-full max-w-xs flex flex-col relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search movies, people..."
                className="flex-1 bg-transparent outline-none px-2 py-1 text-base text-white placeholder:text-gray-400"
                autoFocus
              />
              <button onClick={() => { setShowSearchBar(false); setSearchQuery(''); setIsSearching(false); }} className="ml-2 text-gray-400 hover:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Results Dropdown - absolutely positioned below bar */}
            {isSearching && searchQuery && (
              <div className="absolute left-0 right-0 top-14 z-50 bg-[#232526] rounded-xl shadow p-2 max-h-80 overflow-y-auto border border-cyan-900/40" style={{minWidth:'100%'}}>
                {searchLoading ? (
                  <div className="text-center text-cyan-300 py-6">Searching...</div>
                ) : searchError ? (
                  <div className="text-center text-red-400 py-6">{searchError}</div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center text-gray-400 py-6">No results found.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {searchResults.filter(r => r.poster_path || r.profile_path).map(result => (
                      <Link
                        key={result.id}
                        to={result.media_type === 'person' ? `/person/${result.id}` : result.media_type === 'movie' ? `/movie/${result.id}` : `/tv/${result.id}`}
                        className="flex items-center gap-3 bg-[#181c24] rounded-lg overflow-hidden shadow hover:scale-105 transition-transform duration-200 p-2"
                        onClick={() => { setIsSearching(false); setShowSearchBar(false); setSearchQuery(''); setSearchResults([]); }}
                      >
                        <img
                          src={`/api/tmdb/image/w92${result.poster_path || result.profile_path}`}
                          alt={result.title || result.name}
                          className="w-10 h-14 object-cover rounded"
                        />
                        <div className="flex-1">
                          <div className="text-white font-semibold text-sm truncate">{result.title || result.name}</div>
                          {result.vote_average && (
                            <div className="text-xs text-yellow-300">⭐ {result.vote_average.toFixed(1)}</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Main Content Container */}
      <div className="relative z-10 pt-28 pb-4 px-1 md:px-0 max-w-5xl mx-auto">
        {/* Main Movie Content with Poster and Info */}
        {movie && (
          <div className="flex flex-col md:flex-row gap-10 items-start p-0 mb-10 mt-2 md:mt-4 bg-gradient-to-br from-[#10111a]/80 via-[#181c24]/70 to-[#10111a]/80 rounded-3xl shadow-2xl border border-cyan-900/50 backdrop-blur-xl mx-auto px-6 py-8" style={{maxWidth:'100%', boxShadow:'0 12px 36px 0 rgba(0,0,0,0.30)'}}>
            {/* Movie Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0 mb-6 md:mb-0 flex flex-col items-center gap-4">
              <div className="relative group rounded-2xl bg-gradient-to-br from-[#181c24]/80 via-[#232526]/60 to-[#10111a]/80 border-2 border-cyan-900/40 shadow-xl transition-all duration-300 hover:shadow-cyan-400/40 hover:border-cyan-400/80 hover:scale-105" style={{padding:'0.5rem', boxShadow:'0 6px 32px 0 rgba(0,255,255,0.08)'}}>
                <img
                  src={movie.poster_path ? `/api/tmdb/image/w400${movie.poster_path}` : '/placeholder.jpg'}
                  alt={movie.title}
                  className="rounded-xl shadow-lg w-44 h-auto object-cover bg-[#232526] border-2 border-cyan-900 group-hover:border-cyan-400 group-hover:shadow-cyan-400/40 transition-all duration-300"
                  style={{ maxHeight: 320 }}
                />
                <div className="absolute inset-0 rounded-xl pointer-events-none group-hover:ring-4 group-hover:ring-cyan-400/30 transition-all duration-300" />
              </div>
              {/* Streaming Platforms & Trailer Button (below poster, grid/wrap) */}
              <div className="w-full flex flex-col items-center mt-3">
                <div className="flex flex-wrap justify-center gap-3 w-full">
                  {movie['watch/providers']?.results?.IN?.flatrate?.map(provider => {
                    // Try to get the direct link to the movie on the provider
                    let providerLink = null;
                    // TMDb sometimes provides a 'link' at the country level, not per provider
                    if (movie['watch/providers']?.results?.IN?.link) {
                      providerLink = movie['watch/providers'].results.IN.link;
                      // For some providers, we can try to deep-link using known URL patterns
                      // Example: Prime Video, Netflix, Hotstar, etc.
                      // You can expand this mapping as needed
                      const providerUrls = {
                        119: 'https://www.primevideo.com/', // Prime Video
                        8: 'https://www.netflix.com/', // Netflix
                        122: 'https://www.hotstar.com/', // Hotstar
                        384: 'https://www.jiocinema.com/', // JioCinema
                        3: 'https://www.youtube.com/', // YouTube
                        2: 'https://www.apple.com/in/apple-tv-plus/', // Apple TV+
                        15: 'https://www.hulu.com/', // Hulu
                        9: 'https://www.amazon.com/Instant-Video/', // Amazon Video
                        350: 'https://www.sonyliv.com/', // Sony LIV
                        531: 'https://www.zee5.com/', // Zee5
                        307: 'https://www.mxplayer.in/', // MX Player
                        387: 'https://erosnow.com/', // Eros Now
                        232: 'https://www.altbalaji.com/', // ALTBalaji
                        188: 'https://www.hoichoi.tv/' // Hoichoi
                      };
                      // If provider_id is in mapping, use their homepage as fallback
                      if (providerUrls[provider.provider_id]) {
                        providerLink = providerUrls[provider.provider_id];
                      }
                    }
                    // If no link, fallback to provider homepage
                    if (!providerLink) {
                      providerLink = '#';
                    }
                    return (
                      <a
                        key={provider.provider_id}
                        href={providerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                        title={provider.provider_name}
                        onClick={e => {
                          if (providerLink === '#') {
                            e.preventDefault();
                            alert('Direct link to this movie on the provider is not available.');
                          }
                        }}
                      >
                        <img
                          src={`/api/tmdb/image/w45${provider.logo_path}`}
                          alt={provider.provider_name}
                          className="w-10 h-10 rounded bg-white/10 border border-cyan-900 hover:scale-110 transition shadow"
                        />
                      </a>
                    );
                  })}
                </div>
                {movie.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer') && (
                  <a
                    href={`https://www.youtube.com/watch?v=${movie.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer').key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 mt-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow text-sm font-bold transition"
                    title="Watch Trailer on YouTube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M21.8 8.001a2.752 2.752 0 0 0-1.936-1.947C18.003 5.5 12 5.5 12 5.5s-6.003 0-7.864.554A2.752 2.752 0 0 0 2.2 8.001 28.434 28.434 0 0 0 2 12a28.434 28.434 0 0 0 .2 3.999 2.752 2.752 0 0 0 1.936 1.947C5.997 18.5 12 18.5 12 18.5s6.003 0 7.864-.554A2.752 2.752 0 0 0 21.8 15.999 28.434 28.434 0 0 0 22 12a28.434 28.434 0 0 0-.2-3.999zM10 15.5v-7l6 3.5-6 3.5z"/></svg>
                    Trailer
                  </a>
                )}
              </div>
            </div>
            {/* Main Details */}
            <div className="flex-1 w-full bg-transparent px-0 md:px-6">
              <h1 className="text-3xl md:text-4xl font-bold font-playfair flex items-center mb-4 text-cyan-200 drop-shadow-lg">
                {movie.title}
                {movie.release_date && (
                  <span className="text-cyan-400 text-lg font-normal ml-2">({movie.release_date.split("-")[0]})</span>
                )}
              </h1>
              <div className="flex flex-wrap gap-4 text-base bg-white/10 p-4 rounded-xl border border-cyan-900/30 mb-5 shadow-inner font-semibold tracking-wide" style={{fontSize:'1.03rem', lineHeight:'1.5'}}>
                <div className="flex items-center gap-1.5">
                  <FiStar className="text-cyan-300 text-lg" />
                  <span>{movie.vote_average?.toFixed(1)}/10</span>
                </div>
                {movie.revenue && (
                  <div className="flex items-center gap-1.5">
                    <FiDollarSign className="text-green-300 text-lg" />
                    <span>{movie.revenue.toLocaleString()}</span>
                  </div>
                )}
                {movie.runtime && (
                  <div className="flex items-center gap-1.5">
                    <FiClock className="text-pink-300 text-lg" />
                    <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
                  </div>
                )}
                {movie.release_date && (
                  <div className="flex items-center gap-1.5">
                    <FiCalendar className="text-yellow-300 text-lg" />
                    <span>{new Date(movie.release_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              {/* Overview */}
              <section className="mb-5">
                <h3 className="text-xs text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-1 pb-0.5 font-semibold">Overview</h3>
                <p className="text-sm md:text-base text-gray-200 leading-normal font-lato" style={{fontSize:'1.01rem', lineHeight:'1.5', letterSpacing:'0.01em', padding:'0.1rem 0.05rem'}}>
                  {movie.overview || 'No overview available.'}
                </p>
              </section>
              {/* Crew Info */}
              <section className="mb-4">
                <h3 className="text-xs text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-1 pb-0.5 font-semibold">Crew</h3>
                <div className="flex flex-col gap-1">
                  {movie.credits?.crew?.filter(c => c.job === 'Director').length > 0 && (
                    <span className="text-sm md:text-base">
                      <span className="text-cyan-300 font-semibold">Directed by</span>{' '}
                      {movie.credits.crew.filter(c => c.job === 'Director').map((d, idx, arr) => (
                        <React.Fragment key={d.id}>
                          <Link
                            to={`/person/${d.id}`}
                            className="text-cyan-200 hover:text-pink-400 underline font-semibold transition-colors"
                          >
                            {d.name}
                          </Link>
                          {idx < arr.length - 1 && ', '}
                        </React.Fragment>
                      ))}
                    </span>
                  )}
                  {movie.credits?.crew?.filter(c => c.job === 'Writer' || c.job === 'Screenplay').length > 0 && (
                    <span className="text-sm md:text-base">
                      <span className="text-cyan-300 font-semibold">Written by</span>{' '}
                      {movie.credits.crew.filter(c => c.job === 'Writer' || c.job === 'Screenplay').map((w, idx, arr) => (
                        <React.Fragment key={w.id}>
                          <Link
                            to={`/person/${w.id}`}
                            className="text-cyan-200 hover:text-pink-400 underline font-semibold transition-colors"
                          >
                            {w.name}
                          </Link>
                          {idx < arr.length - 1 && ', '}
                        </React.Fragment>
                      ))}
                    </span>
                  )}
                </div>
              </section>
              {/* ...existing code... (Cast section removed from here) */}
            </div>
          </div>
        )}
        {/* Top Cast Section (separate, aesthetic card) */}
        {movie && movie.credits && movie.credits.cast && movie.credits.cast.length > 0 && (
          <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto mt-6 mb-8">
            <div className="bg-[#181c24]/95 rounded-2xl shadow-xl border border-cyan-900/30 px-6 py-5">
              <h3 className="text-xl md:text-2xl font-bold text-cyan-300 mb-3 font-playfair tracking-tight flex items-center gap-2 drop-shadow-lg">
                <span className="text-2xl">👥</span> Top Cast
              </h3>
              <div className="flex overflow-x-auto gap-4 pb-1 no-scrollbar">
                {movie.credits.cast.slice(0, 10).map(actor => (
                  <Link
                    key={actor.id}
                    to={`/person/${actor.id}`}
                    className="min-w-[90px] max-w-[90px] flex-shrink-0 bg-[#232526]/80 rounded-xl overflow-hidden shadow-md hover:scale-105 hover:shadow-cyan-400 transition-transform duration-200 flex flex-col items-center border border-cyan-900/30"
                  >
                    <img
                      src={actor.profile_path ? `/api/tmdb/image/w200${actor.profile_path}` : '/actor-placeholder.jpg'}
                      alt={actor.name}
                      className="w-full h-24 object-cover rounded-t-xl bg-[#10111a]"
                    />
                    <span className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{actor.name}</span>
                    <span className="text-cyan-300 font-bold mb-2 text-[10px] truncate">{actor.character}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Box Office Section (now outside the highlight box, always visible) */}
        <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto mt-2 mb-10">
          <h4 className="text-base text-cyan-300 uppercase tracking-wider font-bold mb-2">Box Office</h4>
          {boxOfficeError ? (
            <p className="text-base text-red-400">{boxOfficeError}</p>
          ) : boxOffice.length === 0 ? (
            <p className="text-base text-gray-400 italic">No box office data available.</p>
          ) : (
            <div>
              <div className="flex flex-wrap gap-4 mb-6">
                {boxOffice.map((item, idx) => (
                  <div key={item.name + '-' + idx} className="flex flex-col items-center justify-center min-w-[9rem] max-w-[14rem] bg-[#232526]/80 rounded-xl shadow border border-cyan-900/40 px-4 py-3 hover:scale-105 transition-transform duration-200" title={`Source: ${item.source}`}>
                    <span className="font-bold text-cyan-300 text-xs uppercase tracking-wider mb-1">{item.name}</span>
                    <span className="text-base text-yellow-400 font-extrabold">{item.amount}</span>
                    <span className="text-[10px] text-gray-500 mt-1 capitalize">via {item.source}</span>
                  </div>
                ))}
              </div>

              {rawBoxOfficeData?.daywiseCollection?.value?.length > 0 && (
                <div className="mt-6">
                  <BoxOfficeChart
                    data={rawBoxOfficeData.daywiseCollection.value.map(d => ({
                      date: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Day ${d.day}`,
                      amount: d.amount
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {/* Reviews Section (full width) */}
        <section className="bg-[#181c24]/95 rounded-2xl p-0 mb-8 relative z-20 border border-cyan-900/30 shadow-xl overflow-hidden">
          {/* Add to Watchlist Button - prominent, card style */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-6 bg-gradient-to-r from-[#10111a]/90 via-[#181c24]/80 to-[#10111a]/90 border-b border-cyan-900/20">
            <div className="flex items-center gap-3">
              <button
                className={`px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-full shadow-lg font-bold text-lg tracking-wide transition flex items-center gap-2 border-2 border-cyan-700/40 ${addingToWatchlist ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist}
                style={{boxShadow:'0 2px 12px 0 rgba(0,255,255,0.08)'}}
              >
                {addingToWatchlist ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add to Watchlist
                  </>
                )}
              </button>
              {watchlistToast && <span className="text-cyan-300 text-base font-semibold drop-shadow">{watchlistToast}</span>}
            </div>
            <div className="hidden md:block text-gray-400 text-sm italic font-lato">Keep track of your favorites and never miss a rewatch!</div>
          </div>
          {/* Divider */}
          <div className="w-full h-0.5 bg-gradient-to-r from-cyan-900/0 via-cyan-900/40 to-cyan-900/0 my-0" />
          {/* Review Form and Reviews - side by side on desktop, stacked on mobile */}
          <div className="flex flex-col md:flex-row gap-8 px-6 py-8">
            {/* Review Form */}
            <form onSubmit={handleReviewSubmit} className="flex-1 max-w-lg bg-[#10111a]/80 rounded-xl shadow-md border border-cyan-900/20 p-6 flex flex-col gap-3 mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-cyan-300 text-xl font-bold">Your Review</span>
                <span className="text-gray-400 text-xs font-lato">(out of 10)</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={reviewRating}
                  onChange={e => setReviewRating(Number(e.target.value))}
                  className="w-16 p-2 rounded bg-gray-800 text-cyan-200 text-lg font-bold border-2 border-cyan-700 focus:ring-2 focus:ring-cyan-400 outline-none transition"
                  placeholder="8"
                  required
                />
                <span className="text-yellow-300 text-lg font-bold">★</span>
              </div>
              <textarea
                className="w-full p-3 rounded bg-gray-800 text-white text-base font-lato border border-cyan-700 focus:ring-2 focus:ring-cyan-400 outline-none transition mb-2"
                rows={3}
                placeholder="What did you think? Share your thoughts..."
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                required
              />
              <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-white px-6 py-2 rounded-full font-bold text-base shadow transition mt-2" disabled={reviewLoading}>{reviewLoading ? 'Submitting...' : 'Submit Review'}</button>
              {reviewError && <div className="text-red-400 text-base mt-1">{reviewError}</div>}
            </form>
            {/* Reviews List */}
            <div className="flex-1 flex flex-col gap-4 max-w-2xl mx-auto">
              <div className="text-cyan-200 text-lg font-bold mb-2 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17.75l-6.172 3.245 1.179-6.873L2 9.505l6.908-1.004L12 2.75l3.092 5.751L22 9.505l-5.007 4.617 1.179 6.873z" /></svg> Recent Reviews</div>
              {reviewsError ? (
                <p className="text-base text-red-400">{reviewsError}</p>
              ) : (!Array.isArray(reviews) || reviews.length === 0) ? (
                <p className="text-base text-gray-400 italic">No reviews found.</p>
              ) : (
                reviews.map((review, idx) => (
                  <div key={review._id || review.id || idx} className="flex items-start gap-3 bg-[#181c24]/80 rounded-lg shadow border border-cyan-900/20 p-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-900/40 flex items-center justify-center text-2xl font-bold text-cyan-300 shadow-inner">
                      <span>{review.title ? review.title[0]?.toUpperCase() : 'U'}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-yellow-300 font-bold text-lg">★ {review.rating}/10</span>
                        <span className="text-cyan-200 text-base font-semibold">{review.title}</span>
                      </div>
                      <div className="text-base text-cyan-100 font-lato mb-1">{review.review}</div>
                      <div className="text-gray-500 text-xs font-lato">{review.createdAt ? new Date(review.createdAt).toLocaleString() : ''}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        {/* More Like This Carousel (infinite train/loop, always visible) */}
        {recommendations.length > 0 && (
          <div className="w-full max-w-5xl mx-auto mt-8">
            <h3 className="text-2xl font-bold text-cyan-300 mb-4 font-playfair tracking-tight flex items-center gap-2 drop-shadow-lg">
              <span className="text-3xl">🎬</span> More Like This
            </h3>
            <div className="relative w-full overflow-hidden rounded-lg border border-cyan-900 bg-[#10111a]/60 shadow-inner" style={{height: '11rem'}}>
              <div className="pointer-events-none absolute inset-0 z-10 rounded-lg" style={{background: 'linear-gradient(90deg, #10111a 0%, transparent 8%, transparent 92%, #10111a 100%)'}}></div>
              <div
                className="flex gap-5 absolute left-0 top-0 h-full items-center carousel-row-mlt no-scrollbar"
                style={{
                  width: `${recommendations.length * 2 * 7}rem`,
                  minWidth: `${recommendations.length * 2 * 7}rem`,
                  maxWidth: `${recommendations.length * 2 * 7}rem`,
                  height: '11rem',
                  animation: `carousel-row-mlt 60s linear infinite`,
                  zIndex: 5,
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.animationPlayState = 'paused'; }}
                onMouseLeave={e => { e.currentTarget.style.animationPlayState = 'running'; }}
              >
                {[...recommendations, ...recommendations].map((m, idx) => (
                  <Link
                    key={m.id + '-' + idx}
                    to={`/movie/${m.id}`}
                    className="inline-block align-top w-28 group snap-start"
                    style={{ minWidth: '7rem', maxWidth: '7rem', perspective: '600px' }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.09, rotateY: 8 }}
                      className="rounded-xl overflow-hidden shadow-lg border-2 border-transparent group-hover:border-cyan-400 transition-all duration-200 bg-[#232526] hover:shadow-cyan-400 hover:-translate-y-1 hover:brightness-110"
                      style={{ boxShadow: '0 6px 24px 0 rgba(0,0,0,0.25), 0 1.5px 6px 0 rgba(0,255,255,0.08)' }}
                    >
                      <img
                        src={`/api/tmdb/image/w500${m.poster_path}`}
                        alt={m.title}
                        className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-200"
                        style={{ transform: 'translateZ(0)' }}
                      />
                    </motion.div>
                    <div className="mt-1 text-xs text-center text-gray-200 font-semibold truncate px-1 font-lato">
                      {m.title}
                    </div>
                    <div className="text-xs text-yellow-300 text-center font-lato">⭐ {m.vote_average?.toFixed(1)}</div>
                  </Link>
                ))}
              </div>
              <style>{`
                @keyframes carousel-row-mlt {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-${recommendations.length * 7}rem); }
                }
                .carousel-row-mlt {
                  scrollbar-width: none;
                  -ms-overflow-style: none;
                  overflow-x: hidden !important;
                  min-width: 0;
                  width: 100%;
                  max-width: none;
                  height: 11rem;
                }
                .carousel-row-mlt::-webkit-scrollbar {
                  display: none;
                }
                .no-scrollbar {
                  scrollbar-width: none !important;
                  -ms-overflow-style: none !important;
                }
                .no-scrollbar::-webkit-scrollbar {
                  display: none !important;
                }
              `}</style>
            </div>
          </div>
        )}

        {/* More from [Actor Name] Carousel (infinite train/loop, always visible) */}
        {movie && movie.credits && movie.credits.cast && movie.credits.cast.length > 0 && actorMovies.length > 0 && (
          <div className="w-full max-w-5xl mx-auto mt-8">
            <h3 className="text-2xl font-bold text-pink-300 mb-4 font-playfair tracking-tight flex items-center gap-2 drop-shadow-lg">
              <span className="text-3xl">🌟</span> More from {movie.credits.cast[0].name}
            </h3>
            <div className="relative w-full overflow-hidden rounded-lg border border-pink-900 bg-[#181c24]/60 shadow-inner" style={{height: '11rem'}}>
              <div className="pointer-events-none absolute inset-0 z-10 rounded-lg" style={{background: 'linear-gradient(90deg, #181c24 0%, transparent 8%, transparent 92%, #181c24 100%)'}}></div>
              <div
                className="flex gap-5 absolute left-0 top-0 h-full items-center carousel-row-actor no-scrollbar"
                style={{
                  width: `${actorMovies.length * 2 * 7}rem`,
                  minWidth: `${actorMovies.length * 2 * 7}rem`,
                  maxWidth: `${actorMovies.length * 2 * 7}rem`,
                  height: '11rem',
                  animation: `carousel-row-actor 70s linear infinite`,
                  zIndex: 5,
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.animationPlayState = 'paused'; }}
                onMouseLeave={e => { e.currentTarget.style.animationPlayState = 'running'; }}
              >
                {[...actorMovies, ...actorMovies].map((m, idx) => (
                  <Link
                    key={m.id + '-actor-' + idx}
                    to={`/movie/${m.id}`}
                    className="inline-block align-top w-28 group snap-start"
                    style={{ minWidth: '7rem', maxWidth: '7rem', perspective: '600px' }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.09, rotateY: -8 }}
                      className="rounded-xl overflow-hidden shadow-lg border-2 border-transparent group-hover:border-pink-400 transition-all duration-200 bg-[#232526] hover:shadow-pink-400 hover:-translate-y-1 hover:brightness-110"
                      style={{ boxShadow: '0 6px 24px 0 rgba(0,0,0,0.25), 0 1.5px 6px 0 rgba(255,0,255,0.08)' }}
                    >
                      <img
                        src={`/api/tmdb/image/w500${m.poster_path}`}
                        alt={m.title}
                        className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-200"
                        style={{ transform: 'translateZ(0)' }}
                      />
                    </motion.div>
                    <div className="mt-1 text-xs text-center text-gray-200 font-semibold truncate px-1 font-lato">
                      {m.title}
                    </div>
                    <div className="text-xs text-yellow-300 text-center font-lato">⭐ {m.vote_average?.toFixed(1)}</div>
                  </Link>
                ))}
              </div>
              <style>{`
                @keyframes carousel-row-actor {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-${actorMovies.length * 7}rem); }
                }
                .carousel-row-actor {
                  scrollbar-width: none;
                  -ms-overflow-style: none;
                  overflow-x: hidden !important;
                  min-width: 0;
                  width: 100%;
                  max-width: none;
                  height: 11rem;
                }
                .carousel-row-actor::-webkit-scrollbar {
                  display: none;
                }
                .no-scrollbar {
                  scrollbar-width: none !important;
                  -ms-overflow-style: none !important;
                }
                .no-scrollbar::-webkit-scrollbar {
                  display: none !important;
                }
              `}</style>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieDetail;
