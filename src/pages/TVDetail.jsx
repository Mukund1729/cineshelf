import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiClock, FiCalendar, FiStar } from "react-icons/fi";
import { motion } from "framer-motion";
import { searchMovies, searchPeople } from "../api/tmdb";
import { API_KEY } from "../api/tmdb";
import axios from "axios";
import SearchBar from "../components/SearchBar";
import CastList from "../components/CastList";
import EpisodeList from "../components/EpisodeList";
import ReviewList from "../components/ReviewList";
import RecommendationsGrid from "../components/RecommendationsGrid";
import RatingStars from "../components/RatingStars";

const TVDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [streaming, setStreaming] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [episodesBySeason, setEpisodesBySeason] = useState({}); // {season_number: [episodes]}
  const [showSearchBar, setShowSearchBar] = useState(false);
  const debounceRef = useRef();

  useEffect(() => {
    // Fetch TV show details from TMDB API
    async function fetchShow() {
      setLoading(true);
      setError(null);
      try {
        // Fetch TV show details, credits, reviews, recommendations, and streaming
        const [detailRes, reviewsRes, recsRes] = await Promise.all([
          axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
            params: {
              api_key: API_KEY,
              language: 'en-US',
              append_to_response: 'credits,release_dates,videos,images,external_ids,content_ratings,watch/providers'
            }
          }),
          axios.get(`https://api.themoviedb.org/3/tv/${id}/reviews`, {
            params: { api_key: API_KEY, language: 'en-US' }
          }),
          axios.get(`https://api.themoviedb.org/3/tv/${id}/recommendations`, {
            params: { api_key: API_KEY, language: 'en-US' }
          })
        ]);
        const showData = detailRes.data;
        setShow({
          id: showData.id,
          title: showData.name || showData.original_name || showData.title || 'Untitled TV Show',
          overview: showData.overview || 'No synopsis available.',
          rating: showData.vote_average ? (showData.vote_average / 2) : 0,
          releaseDate: showData.first_air_date || showData.release_date || null,
          runtime: showData.episode_run_time && showData.episode_run_time.length > 0 ? `${showData.episode_run_time[0]} min` : 'N/A',
          poster_path: showData.poster_path,
          genres: Array.isArray(showData.genres) ? showData.genres.map(g => g.name) : [],
          cast: showData.credits?.cast || [],
          crew: showData.credits?.crew || [],
          production_companies: showData.production_companies || [],
          streaming: showData["watch/providers"]?.results?.IN?.flatrate || [],
          streamingLink: showData["watch/providers"]?.results?.IN?.link || null,
          seasons: showData.seasons || [],
        });
        setReviews(reviewsRes.data.results || []);
        setRecommendations(recsRes.data.results || []);
        setSeasons(showData.seasons || []);
        setStreaming(showData["watch/providers"]?.results?.IN?.flatrate || []);

        // Fetch all episodes for each season
        if (showData.seasons && showData.seasons.length > 0) {
          const episodesFetches = showData.seasons.map(async (season) => {
            if (season.season_number === 0) return null; // skip specials
            try {
              const res = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}`, {
                params: { api_key: API_KEY, language: 'en-US' }
              });
              return { season_number: season.season_number, episodes: res.data.episodes };
            } catch {
              return { season_number: season.season_number, episodes: [] };
            }
          });
          const allEpisodes = await Promise.all(episodesFetches);
          const episodesMap = {};
          allEpisodes.forEach((s) => {
            if (s && s.season_number) episodesMap[s.season_number] = s.episodes;
          });
          setEpisodesBySeason(episodesMap);
        }
      } catch (e) {
        setError("Failed to load TV show.");
        setShow(null);
      }
      setLoading(false);
    }
    fetchShow();
  }, [id]);

  // Debounced search handler using TMDB API (movies + people)
  const handleSearchInput = (val) => {
    setSearchQuery(val);
    setIsSearching(!!val && val.length > 0);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const [movieRes, peopleRes] = await Promise.all([
          searchMovies(val, { page: 1 }),
          searchPeople(val, { page: 1 })
        ]);
        const movieResults = (movieRes.results || []).map(m => ({ ...m, media_type: 'movie' }));
        const peopleResults = (peopleRes.results || []).map(p => ({ ...p, media_type: 'person' }));
        setSearchResults([...peopleResults, ...movieResults]);
      } catch (err) {
        setSearchError("Search failed");
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 350);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0e0f1b]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
    </div>
  );
  if (error) return <div className="text-center text-red-400 py-10">{error}</div>;
  if (!show) return <div className="text-center text-gray-400 py-10">TV show not found.</div>;

  return (
    <>
      {/* Sticky Site Name Bar (modern header) */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between w-full px-8 py-4 bg-gradient-to-b from-black/90 via-[#181c24]/60 to-transparent backdrop-blur-md">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/') }>
          <span className="text-2xl font-extrabold tracking-tight font-playfair text-white hover:text-cyan-400 transition-colors select-none">visual.cineaste</span>
        </div>
      </div>
      {/* Main content with modern search bar */}
      <div className="pt-16 min-h-screen bg-[#0e0f1b] bg-gradient-to-br from-[#0e0f1b] via-[#181c24] to-[#1a1333] text-white font-lato">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="max-w-6xl mx-auto px-4 md:px-10 py-6 mt-0"
        >
          {/* Floating Search Icon and Overlay Search Bar */}
          <div className="fixed top-6 right-8 z-40">
            <button
              className="bg-[#181c24] p-2 rounded-full shadow-lg hover:bg-cyan-700 transition-colors focus:outline-none"
              onClick={() => setShowSearchBar(true)}
              aria-label="Open search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
              </svg>
            </button>
          </div>
          {showSearchBar && (
            <div className="fixed top-0 left-0 w-full h-full z-50 flex items-start justify-end bg-black/40" onClick={() => setShowSearchBar(false)}>
              <div className="mt-8 mr-8 bg-[#181c24] rounded-xl shadow-2xl p-4 w-full max-w-xs flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
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
                {isSearching && searchQuery && (
                  <div className="mt-4 bg-[#232526] rounded-xl shadow p-2 max-h-80 overflow-y-auto">
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
                              src={`https://image.tmdb.org/t/p/w92${result.poster_path || result.profile_path}`}
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

          {/* TV Show Header and Details (unchanged) */}
          <div className="flex flex-col md:flex-row gap-10 md:items-start mb-8">
            <img
              src={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "/placeholder.jpg"}
              alt={show.title}
              className="rounded-xl shadow-lg w-64 object-cover aspect-[2/3] border-4 border-[#232526] bg-[#181c24]"
            />
            <div className="flex-1 flex flex-col gap-6 pl-0 md:pl-6">
              <h1 className="text-3xl font-bold font-playfair flex items-center mb-2">{show.title}
                {show.releaseDate && (
                  <span className="text-cyan-400 text-2xl font-normal ml-2">
                    ({show.releaseDate.split("-")[0]})
                  </span>
                )}
              </h1>
              <div className="flex flex-wrap gap-2 text-sm bg-white/5 p-2 rounded border border-gray-800/60 mb-2">
                <div className="flex items-center gap-1">
                  <FiStar className="text-cyan-300" />
                  <span>{show.rating?.toFixed(1)}/5</span>
                </div>
                {show.runtime && (
                  <div className="flex items-center gap-1">
                    <FiClock className="text-pink-300" />
                    <span>{show.runtime}</span>
                  </div>
                )}
                {show.releaseDate && (
                  <div className="flex items-center gap-1">
                    <FiCalendar className="text-yellow-300" />
                    <span>{new Date(show.releaseDate).toLocaleDateString()}</span>
                  </div>
                )}
                {show.genres && show.genres.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-cyan-400">{show.genres.join(", ")}</span>
                  </div>
                )}
              </div>
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Overview</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{show.overview || "No overview available."}</p>
              </section>
              {/* Crew Section */}
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Crew</h3>
                <div className="flex flex-col md:flex-row gap-2 md:gap-6 text-sm">
                  <div>
                    <span className="font-semibold text-cyan-300">Director: </span>
                    {show.crew && show.crew.filter(c => c.job === 'Director').length > 0 ? (
                      show.crew.filter(c => c.job === 'Director').map((d, idx, arr) => (
                        <React.Fragment key={d.id}>
                          <Link to={`/person/${d.id}`} className="text-white font-semibold hover:text-cyan-400 transition-colors">{d.name}</Link>
                          {idx < arr.length - 1 && ', '}
                        </React.Fragment>
                      ))
                    ) : <span className="text-gray-400">Not available.</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-cyan-300">Writers: </span>
                    {show.crew && show.crew.filter(c => c.job === 'Writer' || c.job === 'Screenplay').length > 0 ? (
                      show.crew.filter(c => c.job === 'Writer' || c.job === 'Screenplay').map((w, idx, arr) => (
                        <React.Fragment key={w.id}>
                          <Link to={`/person/${w.id}`} className="text-white font-semibold hover:text-cyan-400 transition-colors">{w.name}</Link>
                          {idx < arr.length - 1 && ', '}
                        </React.Fragment>
                      ))
                    ) : <span className="text-gray-400">Not available.</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-cyan-300">Production: </span>
                    {show.production_companies && show.production_companies.length > 0 ? (
                      show.production_companies.map((c, idx, arr) => (
                        <span key={c.id} className="text-white font-semibold">{c.name}{idx < arr.length - 1 && ', '}</span>
                      ))
                    ) : <span className="text-gray-400">Not available.</span>}
                  </div>
                </div>
              </section>
              {/* Cast Section */}
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Cast</h3>
                <CastList cast={show.cast} />
              </section>
              {/* Streaming Platforms Section */}
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Available on</h3>
                {streaming && streaming.length > 0 ? (
                  <div className="flex gap-3 items-center flex-wrap mb-4">
                    {streaming.map(s => (
                      <a key={s.provider_id} href={show.streamingLink} target="_blank" rel="noopener noreferrer" title={s.provider_name}>
                        <img src={`https://image.tmdb.org/t/p/w45${s.logo_path}`} alt={s.provider_name} className="w-10 h-10 rounded-full border-2 border-cyan-400 bg-white" />
                      </a>
                    ))}
                  </div>
                ) : <div className="text-gray-400">Not available.</div>}
              </section>
              {/* Review Box (moved below streaming) */}
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Reviews</h3>
                <div className="flex flex-col gap-4">
                  {/* User input box for new review */}
                  <form className="bg-[#181c24] rounded-lg p-4 flex flex-col gap-2 mb-4">
                    <textarea
                      className="w-full rounded-lg p-3 bg-zinc-800 text-white border border-zinc-700 focus:ring-2 focus:ring-cyan-400"
                      rows={3}
                      placeholder="Write your review here..."
                    />
                    <button
                      type="submit"
                      className="self-end bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg transition"
                    >
                      Submit
                    </button>
                  </form>
                  {/* Recent reviews list */}
                  <ReviewList reviews={reviews} />
                </div>
              </section>
              {/* Episode List */}
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Episodes</h3>
                <EpisodeList seasons={seasons} episodesBySeason={episodesBySeason} />
              </section>
              {/* Trailer Section */}
              <section>
                <h3 className="text-sm text-cyan-400 uppercase tracking-wider border-b border-gray-700 mb-2 pb-1 font-semibold">Trailer</h3>
                {show.videos && show.videos.results && show.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ? (
                  <div className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-lg group cursor-pointer mx-auto mb-6">
                    <iframe
                      src={`https://www.youtube.com/embed/${show.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer').key}`}
                      title={show.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    ></iframe>
                    <a
                      href={`https://www.youtube.com/watch?v=${show.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer').key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    >
                      <span className="text-white text-lg font-bold bg-black/60 px-4 py-2 rounded-full border-2 border-cyan-400">Watch Trailer on YouTube</span>
                    </a>
                  </div>
                ) : <div className="text-gray-400 text-center py-8">No trailer available.</div>}
              </section>
            </div>
          </div>
          {/* Recommendations */}
          <section className="mt-10">
            <h3 className="text-2xl font-bold font-playfair text-cyan-400 mb-6">More Like This</h3>
            {recommendations && recommendations.length > 0 ? (
              <div className="relative overflow-hidden">
                <div className="flex gap-4 pb-2 whitespace-nowrap train-scroll-row">
                  {/* Duplicate for infinite loop */}
                  {[...recommendations, ...recommendations].map((rec, idx) => (
                    <Link
                      key={rec.id + '-' + idx}
                      to={`/tv/${rec.id}`}
                      className="inline-block align-top w-36 group snap-start"
                      style={{ minWidth: '9rem', maxWidth: '9rem' }}
                    >
                      <div className="rounded-lg overflow-hidden shadow-md border-2 border-transparent group-hover:border-cyan-400 transition-all duration-200 bg-[#232526]">
                        <img
                          src={rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : '/placeholder.jpg'}
                          alt={rec.name}
                          className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="mt-2 text-sm text-center text-gray-200 font-semibold truncate px-1 font-lato">
                        {rec.name}
                      </div>
                      {rec.first_air_date && (
                        <div className="text-xs text-cyan-300 text-center">{rec.first_air_date.split("-")[0]}</div>
                      )}
                    </Link>
                  ))}
                </div>
                <style>{`
                  .train-scroll-row {
                    animation: train-scroll 40s linear infinite;
                  }
                  .train-scroll-row:hover {
                    animation-play-state: paused;
                  }
                  @keyframes train-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                `}</style>
              </div>
            ) : <div className="text-gray-400">No recommendations found.</div>}
          </section>
        </motion.div>
      </div>
    </>
  );
};

export default TVDetail;
