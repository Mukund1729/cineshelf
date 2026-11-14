import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiCalendar, FiClock, FiPlay, FiStar } from 'react-icons/fi';
import axios from 'axios';
import { searchMovies, searchPeople, tmdbClient, tmdbImageUrl } from '../api/tmdb';
import CastList from '../components/CastList';
import EpisodeList from '../components/EpisodeList';
import Navbar from '../components/Navbar';

const getTodayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export default function TVDetail() {
  const { id } = useParams();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const debounceRef = useRef(null);

  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState('');
  const [watchedAt, setWatchedAt] = useState(getTodayDate);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryError, setDiaryError] = useState('');
  const [diaryNotice, setDiaryNotice] = useState('');
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistNotice, setWatchlistNotice] = useState('');

  useEffect(() => {
    let active = true;
    const fetchShow = async () => {
      setLoading(true);
      setError('');
      setShow(null);
      try {
        const [detailResponse, recommendationResponse] = await Promise.all([
          tmdbClient.get(`/tv/${id}`, {
            params: {
              language: 'en-US',
              append_to_response: 'credits,videos,images,external_ids,content_ratings,watch/providers',
            },
          }),
          tmdbClient.get(`/tv/${id}/recommendations`, {
            params: { language: 'en-US' },
          }),
        ]);
        if (!active) return;

        const showData = detailResponse.data;
        setShow(showData);
        setRecommendations(recommendationResponse.data.results || []);

        const seasons = (showData.seasons || []).filter(season => season.season_number > 0);
        const episodeResults = await Promise.all(seasons.map(async season => {
          try {
            const response = await tmdbClient.get(`/tv/${id}/season/${season.season_number}`, {
              params: { language: 'en-US' },
            });
            return [season.season_number, response.data.episodes || []];
          } catch {
            return [season.season_number, []];
          }
        }));
        if (active) setEpisodesBySeason(Object.fromEntries(episodeResults));
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.status_message || 'Failed to load TV show.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchShow();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setReviews([]);
    setReviewsError('');
    axios.get(`/api/review/tv/${id}`)
      .then(response => {
        if (active) setReviews(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(requestError => {
        if (active) setReviewsError(requestError.response?.data?.error || 'Could not load reviews.');
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!showSearchBar || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError('');
      return undefined;
    }

    let active = true;
    setSearchLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const [movies, people, originals] = await Promise.all([
          searchMovies(searchQuery),
          searchPeople(searchQuery),
          axios.get('/api/original-films/search', { params: { query: searchQuery } })
            .then(response => response.data)
            .catch(() => ({ results: [], people: [] })),
        ]);
        if (active) {
          setSearchResults([
            ...(originals?.results || []).map(result => ({ ...result, media_type: 'movie' })),
            ...(originals?.people || []),
            ...(movies?.results || []).map(result => ({ ...result, media_type: 'movie' })),
            ...(people?.results || []).map(result => ({ ...result, media_type: 'person' })),
          ]);
        }
      } catch {
        if (active) {
          setSearchResults([]);
          setSearchError('Could not search right now. Please try again.');
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(debounceRef.current);
    };
  }, [searchQuery, showSearchBar]);

  const ratingDistribution = Array.from({ length: 10 }, (_, index) => ({
    rating: index + 1,
    count: 0,
  }));
  let ratingTotal = 0;
  let ratingCount = 0;
  reviews.forEach(review => {
    const rating = Number(review.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) return;
    ratingTotal += rating;
    ratingCount += 1;
    ratingDistribution[Math.round(rating) - 1].count += 1;
  });
  const averageRating = ratingCount ? ratingTotal / ratingCount : 0;
  const largestRatingBucket = Math.max(1, ...ratingDistribution.map(item => item.count));

  const handleReviewSubmit = async event => {
    event.preventDefault();
    setReviewError('');
    setDiaryError('');
    setDiaryNotice('');
    if (!reviewRating || Number(reviewRating) < 1 || Number(reviewRating) > 10) {
      setReviewError('Please choose a rating from 1 to 10. A written review is optional.');
      return;
    }
    if (!watchedAt) {
      setReviewError('Please choose the date you watched this show.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setReviewError('Please sign in to submit a review.');
      return;
    }

    setReviewLoading(true);
    try {
      const response = await axios.post('/api/review', {
        tmdbId: show.id,
        title: show.name || show.original_name,
        poster: show.poster_path ? tmdbImageUrl(show.poster_path, 'w500') : '',
        overview: show.overview || '',
        mediaType: 'tv',
        rating: Number(reviewRating),
        review: reviewText.trim(),
        watchedAt,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      const savedReview = response.data?.data;
      if (!savedReview) throw new Error('Review was not returned by the server.');
      setReviews(current => [savedReview, ...current.filter(item => item._id !== savedReview._id)]);
      setReviewText('');
      setReviewRating('');
      setDiaryNotice('Rating/review saved to your profile and TV Diary.');
    } catch (requestError) {
      const savedReview = requestError.response?.data?.data;
      if (savedReview?._id) {
        setReviews(current => [savedReview, ...current.filter(item => item._id !== savedReview._id)]);
      }
      setReviewError(requestError.response?.data?.error || requestError.message || 'Failed to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDiaryLog = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setDiaryError('Please sign in to log this show.');
      return;
    }
    if (!show || !watchedAt) {
      setDiaryError('Choose a watched date before logging this show.');
      return;
    }
    if (reviewRating !== '' && (Number(reviewRating) < 1 || Number(reviewRating) > 10)) {
      setDiaryError('Rating must be between 1 and 10.');
      return;
    }

    setDiaryLoading(true);
    setDiaryError('');
    setDiaryNotice('');
    try {
      await axios.post('/api/diary', {
        tmdbId: show.id,
        title: show.name || show.original_name,
        poster: show.poster_path ? tmdbImageUrl(show.poster_path, 'w500') : '',
        mediaType: 'tv',
        watchedAt,
        ...(reviewRating !== '' ? { rating: Number(reviewRating) } : {}),
        note: reviewText.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setDiaryNotice(`${show.name || show.original_name} was logged in your Diary.`);
    } catch (requestError) {
      setDiaryError(requestError.response?.data?.error || 'Could not log this show.');
    } finally {
      setDiaryLoading(false);
    }
  };

  const handleAddToWatchlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setWatchlistNotice('Please sign in to add to your watchlist.');
      return;
    }

    setAddingToWatchlist(true);
    setWatchlistNotice('');
    try {
      await axios.post('/api/watchlist', {
        tmdbId: show.id,
        title: show.name || show.original_name,
        poster: show.poster_path ? tmdbImageUrl(show.poster_path, 'w500') : '',
        overview: show.overview || '',
        releaseDate: show.first_air_date || '',
        voteAverage: show.vote_average,
        genreIds: (show.genres || []).map(genre => genre.id),
        mediaType: 'tv',
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setWatchlistNotice('Added to watchlist!');
    } catch (requestError) {
      setWatchlistNotice(requestError.response?.data?.error || 'Failed to add. Try again.');
    } finally {
      setAddingToWatchlist(false);
      window.setTimeout(() => setWatchlistNotice(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10111a]">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" role="status" aria-label="Loading TV show" />
        </div>
      </div>
    );
  }
  if (error || !show) {
    return (
      <div className="min-h-screen bg-[#10111a] text-center text-red-400">
        <Navbar />
        <p className="py-16">{error || 'TV show not found.'}</p>
      </div>
    );
  }

  const title = show.name || show.original_name || 'Untitled TV show';
  const providers = show['watch/providers']?.results?.IN?.flatrate || [];
  const providerLink = show['watch/providers']?.results?.IN?.link;
  const trailer = show.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Trailer')
    || show.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Teaser');
  const creators = show.created_by || [];
  const writers = (show.credits?.crew || []).filter(person => ['Writer', 'Screenplay', 'Teleplay'].includes(person.job));

  return (
    <div
      className="movie-detail-page relative min-h-screen w-full"
      style={show.backdrop_path ? {
        backgroundImage: `url(${tmdbImageUrl(show.backdrop_path, 'original')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        maxWidth: '100vw',
        overflowX: 'hidden',
      } : { backgroundColor: '#10111a', maxWidth: '100vw', overflowX: 'hidden' }}
    >
      <div className="absolute inset-0 bg-black/80 z-0" />
      <Navbar />
      <button
        className="movie-detail-search vc-btn vc-btn-ghost"
        onClick={() => setShowSearchBar(true)}
        aria-label="Open search"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
        </svg>
      </button>

      {showSearchBar && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 p-4" onClick={() => setShowSearchBar(false)}>
          <div className="relative mt-8 w-full max-w-sm rounded-xl border border-cyan-900/40 bg-[#181c24] p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search movies, people..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-white outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setShowSearchBar(false); setSearchQuery(''); }}
                className="px-2 text-xl text-gray-400 hover:text-white"
                aria-label="Close search"
              >
                ×
              </button>
            </div>
            {searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-cyan-900/40 bg-[#181c24] p-2 shadow-xl">
                {searchLoading ? (
                  <p className="py-5 text-center text-cyan-300">Searching...</p>
                ) : searchError ? (
                  <p role="alert" className="py-5 text-center text-red-400">{searchError}</p>
                ) : searchResults.length ? (
                  searchResults.filter(result => result.poster_path || result.profile_path).map(result => (
                    <Link
                      key={`${result.media_type}-${result.id}`}
                      to={result.media_type === 'person' ? `/person/${result.id}` : `/movie/${result.id}`}
                      onClick={() => { setShowSearchBar(false); setSearchQuery(''); }}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5"
                    >
                      <img src={tmdbImageUrl(result.poster_path || result.profile_path, 'w92')} alt="" className="h-14 w-10 rounded object-cover" />
                      <span className="truncate text-sm text-white">{result.title || result.name}</span>
                    </Link>
                  ))
                ) : (
                  <p className="py-5 text-center text-gray-400">No results found.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="vc-container movie-detail-content relative z-10 pt-10 pb-16">
        <section className="mx-auto mb-10 mt-2 flex max-w-6xl flex-col items-start gap-6 rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#10111a]/90 via-[#181c24]/85 to-[#10111a]/90 px-4 py-6 shadow-2xl backdrop-blur-xl md:mt-4 md:flex-row md:gap-10 md:px-6 md:py-8">
          <div className="mx-auto flex flex-shrink-0 flex-col items-center gap-4 md:mx-0">
            <div className="rounded-2xl border-2 border-cyan-900/40 bg-[#181c24]/80 p-2 shadow-xl">
              <img
                src={show.poster_path ? tmdbImageUrl(show.poster_path, 'w400') : '/placeholder.jpg'}
                alt={`${title} poster`}
                className="h-auto w-36 rounded-xl border-2 border-cyan-900 object-cover md:w-44"
                style={{ maxHeight: 300 }}
              />
            </div>
            {providers.length > 0 && (
              <div className="flex w-full flex-wrap justify-center gap-3">
                {providers.map(provider => (
                  <a
                    key={provider.provider_id}
                    href={providerLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={provider.provider_name}
                    onClick={event => { if (!providerLink) event.preventDefault(); }}
                  >
                    <img src={tmdbImageUrl(provider.logo_path, 'w45')} alt={provider.provider_name} className="h-10 w-10 rounded-full border border-cyan-900 bg-white" />
                  </a>
                ))}
              </div>
            )}
            {trailer && (
              <a
                href={`https://www.youtube.com/watch?v=${trailer.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
              >
                <FiPlay aria-hidden="true" /> Watch Trailer
              </a>
            )}
          </div>

          <div className="w-full flex-1 md:px-4">
            <h1 className="mb-4 text-2xl font-bold text-cyan-200 drop-shadow-lg md:text-4xl">
              {title}
              {show.first_air_date && (
                <span className="ml-2 text-sm font-normal text-cyan-400 md:text-lg">({show.first_air_date.slice(0, 4)})</span>
              )}
            </h1>
            <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-cyan-900/30 bg-white/10 p-3 text-sm font-semibold tracking-wide md:gap-4 md:p-4">
              <div className="flex items-center gap-1.5"><FiStar className="text-cyan-300" /><span>{Number(show.vote_average || 0).toFixed(1)}/10</span></div>
              {show.episode_run_time?.[0] > 0 && <div className="flex items-center gap-1.5"><FiClock className="text-pink-300" /><span>{show.episode_run_time[0]} min / episode</span></div>}
              {show.first_air_date && <div className="flex items-center gap-1.5"><FiCalendar className="text-yellow-300" /><span>{new Date(`${show.first_air_date}T00:00:00`).toLocaleDateString()}</span></div>}
              {show.number_of_seasons > 0 && <span>{show.number_of_seasons} season{show.number_of_seasons === 1 ? '' : 's'}</span>}
              {show.number_of_episodes > 0 && <span>{show.number_of_episodes} episodes</span>}
              {show.status && <span>{show.status}</span>}
            </div>
            {show.tagline && <p className="mb-4 italic text-gray-300">{show.tagline}</p>}
            <section className="mb-5">
              <h2 className="mb-1 border-b border-gray-700 pb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">Overview</h2>
              <p className="text-sm leading-relaxed text-gray-200 md:text-base">{show.overview || 'No overview available.'}</p>
            </section>
            {creators.length > 0 && (
              <section className="mb-4">
                <h2 className="mb-1 border-b border-gray-700 pb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">Created by</h2>
                <p className="text-sm text-white">
                  {creators.map((creator, index) => (
                    <React.Fragment key={creator.id}>
                      {index > 0 && ', '}
                      <Link to={`/person/${creator.id}`} className="font-semibold text-cyan-200 underline hover:text-pink-400">{creator.name}</Link>
                    </React.Fragment>
                  ))}
                </p>
              </section>
            )}
            {writers.length > 0 && (
              <section className="mb-4">
                <h2 className="mb-1 border-b border-gray-700 pb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">Written by</h2>
                <p className="text-sm text-white">
                  {writers.slice(0, 6).map((writer, index) => (
                    <React.Fragment key={`${writer.id}-${writer.job}`}>
                      {index > 0 && ', '}
                      <Link to={`/person/${writer.id}`} className="font-semibold text-cyan-200 underline hover:text-pink-400">{writer.name}</Link>
                    </React.Fragment>
                  ))}
                </p>
              </section>
            )}
            {show.genres?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {show.genres.map(genre => <span key={genre.id} className="rounded-full border border-cyan-900/40 bg-white/5 px-3 py-1 text-xs text-cyan-200">{genre.name}</span>)}
              </div>
            )}
          </div>
        </section>

        {show.credits?.cast?.length > 0 && (
          <section className="mx-auto mb-8 mt-6 max-w-5xl rounded-2xl border border-cyan-900/30 bg-[#181c24]/95 px-4 py-4 shadow-xl md:px-6 md:py-5">
            <h2 className="mb-3 flex items-center gap-2 font-playfair text-lg font-bold text-cyan-300 md:text-2xl">👥 Top Cast</h2>
            <CastList cast={show.credits.cast} />
          </section>
        )}

        {show.production_companies?.length > 0 && (
          <section className="mx-auto mb-8 max-w-5xl rounded-2xl border border-cyan-900/30 bg-[#181c24]/95 p-5 shadow-xl">
            <h2 className="mb-3 text-lg font-bold text-cyan-300">Production</h2>
            <div className="flex flex-wrap gap-3">
              {show.production_companies.map(company => <span key={company.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-200">{company.name}</span>)}
            </div>
          </section>
        )}

        <section className="mx-auto mb-8 max-w-5xl rounded-2xl border border-cyan-900/30 bg-[#181c24]/95 p-4 shadow-xl md:p-6">
          <h2 className="mb-4 font-playfair text-xl font-bold text-cyan-300 md:text-2xl">Episodes & Seasons</h2>
          <EpisodeList seasons={show.seasons || []} episodesBySeason={episodesBySeason} />
        </section>

        <section className="mx-auto mb-8 max-w-5xl rounded-2xl border border-cyan-900/30 bg-[#181c24]/95 p-4 shadow-xl md:p-6">
          <h2 className="mb-4 font-playfair text-xl font-bold text-cyan-300 md:text-2xl">Trailer</h2>
          {trailer ? (
            <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl border border-cyan-900/40 shadow-lg">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : <p className="py-6 text-center text-gray-400">No trailer available.</p>}
        </section>

        <section className="relative z-20 mb-8 overflow-hidden rounded-2xl border border-cyan-900/30 bg-[#181c24]/95 shadow-xl">
          <div className="flex flex-col items-center justify-between gap-4 border-b border-cyan-900/20 bg-gradient-to-r from-[#10111a]/90 via-[#181c24]/80 to-[#10111a]/90 px-5 py-5 md:flex-row md:px-6">
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border-2 border-cyan-700/40 bg-cyan-500 px-6 py-2 text-base font-bold text-white shadow-lg transition hover:bg-cyan-400 disabled:opacity-60 md:text-lg"
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist}
              >
                {addingToWatchlist ? 'Adding…' : '＋ Add to Watchlist'}
              </button>
              {watchlistNotice && <span role="status" className="text-sm font-semibold text-cyan-300">{watchlistNotice}</span>}
            </div>
            <p className="hidden text-sm italic text-gray-400 md:block">Keep track of your favorites and never miss a rewatch!</p>
          </div>

          <div className="flex flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:px-6 md:py-8">
            <form onSubmit={handleReviewSubmit} className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 rounded-xl border border-cyan-900/20 bg-[#10111a]/80 p-4 shadow-md md:p-6">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xl font-bold text-cyan-300">Your Review</h2>
                <span className="text-xs text-gray-400">(review text optional)</span>
              </div>
              <label htmlFor="tv-review-rating" className="text-sm font-semibold text-gray-300">Your rating</label>
              <div className="flex items-center gap-3">
                <input
                  id="tv-review-rating"
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={reviewRating}
                  onChange={event => setReviewRating(event.target.value)}
                  className="w-20 rounded border-2 border-cyan-700 bg-gray-800 p-2 text-lg font-bold text-cyan-200 outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="8"
                  required
                />
                <span className="text-lg font-bold text-yellow-300">★ / 10</span>
              </div>
              <label htmlFor="tv-watched-date" className="text-sm font-semibold text-gray-300">Watched on</label>
              <input
                id="tv-watched-date"
                type="date"
                value={watchedAt}
                max={getTodayDate()}
                onChange={event => setWatchedAt(event.target.value)}
                className="w-full rounded border border-cyan-700 bg-gray-800 p-2 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                required
              />
              <label htmlFor="tv-review-text" className="sr-only">Write your review</label>
              <textarea
                id="tv-review-text"
                maxLength={2000}
                className="mb-2 w-full rounded border border-cyan-700 bg-gray-800 p-3 text-base text-white outline-none transition focus:ring-2 focus:ring-cyan-400"
                rows={4}
                placeholder="What did you think? Share your thoughts... (optional)"
                value={reviewText}
                onChange={event => setReviewText(event.target.value)}
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="rounded-full bg-cyan-500 px-5 py-2 font-bold text-white shadow transition hover:bg-cyan-400 disabled:opacity-60" disabled={reviewLoading || diaryLoading}>
                  {reviewLoading ? 'Saving…' : 'Save Rating / Review'}
                </button>
                <button type="button" onClick={handleDiaryLog} className="rounded-full border border-cyan-600 px-5 py-2 font-bold text-cyan-200 transition hover:bg-cyan-900/30 disabled:opacity-60" disabled={diaryLoading || reviewLoading}>
                  {diaryLoading ? 'Logging…' : 'Log only to Diary'}
                </button>
              </div>
              {reviewError && <p role="alert" className="mt-1 text-sm text-red-400">{reviewError}</p>}
              {diaryError && <p role="alert" className="mt-1 text-sm text-red-400">{diaryError}</p>}
              {diaryNotice && <p role="status" className="mt-1 text-sm text-emerald-300">{diaryNotice}</p>}
            </form>

            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-cyan-200">⭐ Recent Reviews</h2>
              <section aria-label="Community rating summary" className="rounded-xl border border-cyan-900/30 bg-[#10111a]/80 p-4">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Community rating</p>
                    <p className="text-3xl font-bold text-yellow-300">{ratingCount ? averageRating.toFixed(1) : '—'}<span className="ml-1 text-sm font-medium text-gray-400">/ 10</span></p>
                  </div>
                  <p className="text-right text-xs text-gray-400">{ratingCount} rating{ratingCount === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {[...ratingDistribution].reverse().map(({ rating, count }) => (
                    <div key={rating} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-right text-gray-400">{rating}</span>
                      <div role="progressbar" aria-label={`${rating} out of 10 ratings`} aria-valuemin={0} aria-valuemax={largestRatingBucket} aria-valuenow={count} className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${(count / largestRatingBucket) * 100}%` }} />
                      </div>
                      <span className="w-5 text-gray-400">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
              {reviewsError ? (
                <p role="alert" className="text-sm text-red-400">{reviewsError}</p>
              ) : reviews.length === 0 ? (
                <p className="text-sm italic text-gray-400">No reviews yet.</p>
              ) : reviews.map((review, index) => (
                <Link
                  key={review._id || index}
                  to={`/review/${review._id}`}
                  className="flex items-start gap-3 rounded-lg border border-cyan-900/20 bg-[#181c24]/80 p-4 shadow transition-colors hover:border-cyan-700"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  aria-label={`Read ${review.user?.name || review.user?.username || 'member'}'s full review`}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan-900/40 text-xl font-bold text-cyan-300">
                    {(review.user?.name || review.user?.username || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-yellow-300">★ {review.rating}/10</span>
                      <span className="font-semibold text-cyan-200">{review.user?.name || (review.user?.username ? `@${review.user.username}` : 'CineShelf member')}</span>
                    </div>
                    <p className="line-clamp-3 break-words text-sm text-cyan-100">{review.review || 'Rating only'}</p>
                    <time className="mt-1 block text-xs text-gray-500">{review.createdAt ? new Date(review.createdAt).toLocaleString() : ''}</time>
                    {review.review && <span className="mt-2 inline-block text-sm font-semibold text-cyan-300">Read full review →</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {recommendations.length > 0 && (
          <section className="mx-auto mt-8 max-w-5xl">
            <h2 className="mb-4 flex items-center gap-2 font-playfair text-2xl font-bold text-cyan-300">🎬 More Like This</h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {recommendations.filter(item => item.poster_path).slice(0, 20).map(item => (
                <Link key={item.id} to={`/tv/${item.id}`} className="w-36 flex-shrink-0 group">
                  <img src={tmdbImageUrl(item.poster_path, 'w342')} alt={`${item.name} poster`} className="h-52 w-full rounded-lg border-2 border-transparent object-cover transition group-hover:border-cyan-400" />
                  <p className="mt-2 truncate text-center text-sm font-semibold text-gray-200">{item.name}</p>
                  {item.first_air_date && <p className="text-center text-xs text-cyan-300">{item.first_air_date.slice(0, 4)}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
