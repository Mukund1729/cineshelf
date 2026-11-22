import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { searchMovies, searchPeople, tmdbClient, tmdbImageUrl } from '../api/tmdb';
import EpisodeList from '../components/EpisodeList';
import Navbar from '../components/Navbar';
import { hasAuthSession } from '../api/session';
import './movie-detail.css';

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
  const [showTrailer, setShowTrailer] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const debounceRef = useRef(null);

  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState('');
  const [watchedAt, setWatchedAt] = useState(getTodayDate);
  const [myReviewId, setMyReviewId] = useState(null);
  const [myReviewLoaded, setMyReviewLoaded] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryError, setDiaryError] = useState('');
  const [diaryNotice, setDiaryNotice] = useState('');
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistNotice, setWatchlistNotice] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [ottLinks, setOttLinks] = useState({ byProviderId: {}, byName: {}, preferredUrl: null });
  const [ottLinksLoading, setOttLinksLoading] = useState(false);

  useEffect(() => {
    setShowTrailer(false);
    setOverviewExpanded(false);
  }, [id]);

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
    setMyReviewId(null);
    setMyReviewLoaded(false);
    setReviewText('');
    setReviewRating('');
    setWatchedAt(getTodayDate());
    setDiaryNotice('');
    setReviewError('');
    setDiaryError('');

    axios.get(`/api/review/tv/${id}`)
      .then(response => {
        if (active) setReviews(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(requestError => {
        if (active) setReviewsError(requestError.response?.data?.error || 'Could not load reviews.');
      });

    if (hasAuthSession()) {
      const token = localStorage.getItem('token');
      axios.get(`/api/review/mine/${id}`, {
        params: { mediaType: 'tv' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        withCredentials: true,
      })
        .then(response => {
          if (!active) return;
          const mine = response.data?.data;
          if (mine?._id) {
            setMyReviewId(mine._id);
            if (mine.rating != null && mine.rating !== '') setReviewRating(String(mine.rating));
            setReviewText(typeof mine.review === 'string' ? mine.review : '');
          }
          if (response.data?.watchedAt) setWatchedAt(response.data.watchedAt);
          setMyReviewLoaded(true);
        })
        .catch(() => {
          if (active) setMyReviewLoaded(true);
        });
    } else {
      setMyReviewLoaded(true);
    }

    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!show?.id) {
      setOttLinks({ byProviderId: {}, byName: {}, preferredUrl: null });
      return undefined;
    }
    let active = true;
    setOttLinksLoading(true);
    const year = show.first_air_date ? show.first_air_date.slice(0, 4) : '';
    axios.get(`/api/streaming/ott-links/tv/${show.id}`, {
      params: { title: show.name || show.original_name, year, country: 'IN' },
    })
      .then(({ data }) => {
        if (!active) return;
        setOttLinks({
          byProviderId: data?.byProviderId || {},
          byName: data?.byName || {},
          preferredUrl: data?.preferredUrl || null,
        });
      })
      .catch(() => {
        if (active) setOttLinks({ byProviderId: {}, byName: {}, preferredUrl: null });
      })
      .finally(() => {
        if (active) setOttLinksLoading(false);
      });
    return () => { active = false; };
  }, [show?.id, show?.name, show?.original_name, show?.first_air_date]);

  useEffect(() => {
    if (!showSearchBar || !searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
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
    const bucket = Math.min(10, Math.max(1, Math.round(rating)));
    ratingDistribution[bucket - 1].count += 1;
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
    if (!hasAuthSession()) {
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
      setMyReviewId(savedReview._id);
      if (savedReview.rating != null && savedReview.rating !== '') setReviewRating(String(savedReview.rating));
      setReviewText(typeof savedReview.review === 'string' ? savedReview.review : '');
      setMyReviewLoaded(true);
      setDiaryNotice(myReviewId
        ? 'Your rating/review was updated and remains saved to your account.'
        : 'Rating/review saved to your profile and TV Diary.');
    } catch (requestError) {
      const savedReview = requestError.response?.data?.data;
      if (savedReview?._id) {
        setReviews(current => [savedReview, ...current.filter(item => item._id !== savedReview._id)]);
        setMyReviewId(savedReview._id);
        if (savedReview.rating != null && savedReview.rating !== '') setReviewRating(String(savedReview.rating));
        setReviewText(typeof savedReview.review === 'string' ? savedReview.review : '');
      }
      setReviewError(requestError.response?.data?.error || requestError.message || 'Failed to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDiaryLog = async () => {
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
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
    if (!hasAuthSession()) {
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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: show.name || show.original_name, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareNotice('Link copied.');
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setShareNotice('Could not share this link.');
    }
    window.setTimeout(() => setShareNotice(''), 2500);
  };

  const resolveProviderUrl = provider => {
    const byId = ottLinks.byProviderId?.[provider.provider_id]?.url;
    if (byId) return byId;
    const rawName = String(provider.provider_name || '');
    const nameKey = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (ottLinks.byName?.[nameKey]?.url) return ottLinks.byName[nameKey].url;
    const aliases = [];
    if (/netflix/i.test(rawName)) aliases.push('netflix');
    if (/prime|amazon/i.test(rawName)) aliases.push('amazonprimevideo', 'amazonvideo', 'primevideo');
    if (/hotstar|disney/i.test(rawName)) aliases.push('hotstar', 'disneyplushotstar', 'disneyplus');
    if (/jio/i.test(rawName)) aliases.push('jiocinema');
    if (/sony/i.test(rawName)) aliases.push('sonyliv');
    if (/zee/i.test(rawName)) aliases.push('zee5');
    if (/apple/i.test(rawName)) aliases.push('appletvplus', 'appletv', 'itunes', 'appletvstore');
    for (const alias of aliases) {
      if (ottLinks.byName?.[alias]?.url) return ottLinks.byName[alias].url;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="md-page movie-detail-page">
        <Navbar />
        <div className="md-shell">
          <div className="md-status" aria-live="polite">
            <div className="md-skeleton" style={{ height: 220, marginBottom: 12 }} />
            Loading TV show…
          </div>
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="md-page movie-detail-page">
        <Navbar />
        <div className="md-shell">
          <p className="md-status is-error" role="alert">{error || 'TV show not found.'}</p>
        </div>
      </div>
    );
  }

  const title = show.name || show.original_name || 'Untitled TV show';
  const releaseYear = show.first_air_date ? show.first_air_date.slice(0, 4) : '';
  const runtimeLabel = show.episode_run_time?.[0] > 0 ? `${show.episode_run_time[0]} min / ep` : '';
  const overviewText = show.overview || 'No overview available.';
  const overviewNeedsToggle = overviewText.length > 280;
  const watchRegion = show['watch/providers']?.results?.IN || show['watch/providers']?.results?.US || null;
  const providerList = [
    ...(watchRegion?.flatrate || []),
    ...(watchRegion?.rent || []),
    ...(watchRegion?.buy || []),
  ].filter((provider, index, list) => (
    list.findIndex(item => item.provider_id === provider.provider_id) === index
  ));
  const watchShowUrl = ottLinks.preferredUrl || '';
  const trailer = show.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Trailer')
    || show.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Teaser');
  const creators = show.created_by || [];
  const writers = (show.credits?.crew || []).filter(person => ['Writer', 'Screenplay', 'Teleplay'].includes(person.job));
  const backdropUrl = show.backdrop_path
    ? tmdbImageUrl(show.backdrop_path, 'original')
    : (show.poster_path ? tmdbImageUrl(show.poster_path, 'original') : '');

  return (
    <div className="md-page movie-detail-page">
      {backdropUrl ? (
        <div className="md-backdrop" style={{ backgroundImage: `url(${backdropUrl})` }} aria-hidden="true" />
      ) : null}
      <div className="md-backdrop-shade" aria-hidden="true" />
      <Navbar />

      <button type="button" className="md-search-btn" onClick={() => setShowSearchBar(true)} aria-label="Open search">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
        </svg>
      </button>

      {showSearchBar && (
        <div className="md-search-overlay" onClick={() => setShowSearchBar(false)}>
          <div className="md-search-panel" onClick={event => event.stopPropagation()}>
            <div className="md-search-row">
              <input
                type="text"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search movies, people…"
                autoFocus
              />
              <button
                type="button"
                className="md-btn md-btn-ghost"
                onClick={() => { setShowSearchBar(false); setSearchQuery(''); }}
              >
                Close
              </button>
            </div>
            {searchQuery.trim().length >= 2 && (
              <div className="md-search-results">
                {searchLoading && <div className="md-status">Searching…</div>}
                {searchError && <div className="md-status is-error">{searchError}</div>}
                {!searchLoading && !searchError && !searchResults.length && (
                  <div className="md-status">No results found.</div>
                )}
                {!searchLoading && !searchError && searchResults
                  .filter(result => result.poster_path || result.profile_path || result.source === 'original')
                  .map(result => (
                    <Link
                      key={`${result.media_type}-${result.id}`}
                      to={result.media_type === 'person' ? `/person/${result.id}` : `/movie/${result.id}`}
                      className="md-search-item"
                      onClick={() => { setShowSearchBar(false); setSearchQuery(''); }}
                    >
                      {result.poster_path || result.profile_path ? (
                        <img src={tmdbImageUrl(result.poster_path || result.profile_path, 'w92')} alt="" />
                      ) : (
                        <span className="md-search-fallback">{(result.name || '?')[0]}</span>
                      )}
                      <div>
                        <strong>{result.title || result.name}</strong>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="md-shell movie-detail-content">
        <section className="md-hero" aria-label="TV show introduction">
          <div className="md-poster-col">
            <img
              className="md-poster"
              src={show.poster_path ? tmdbImageUrl(show.poster_path, 'w500') : '/placeholder.jpg'}
              alt={`${title} poster`}
            />

            <div className="md-hero-actions-bar md-poster-actions">
              {(providerList.length > 0 || watchShowUrl || ottLinksLoading || trailer) && (
                <p className="md-watch-label">Where to watch</p>
              )}
              {providerList.length > 0 && (
                <div className="md-providers" aria-label="Where to watch">
                  {providerList.slice(0, 6).map(provider => {
                    const href = resolveProviderUrl(provider) || watchShowUrl || '';
                    return (
                      <a
                        key={provider.provider_id}
                        href={href || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={href ? `Watch on ${provider.provider_name}` : `${provider.provider_name} link loading…`}
                        onClick={event => {
                          if (!href) {
                            event.preventDefault();
                            window.alert(ottLinksLoading
                              ? 'Finding the official watch link… try again in a moment.'
                              : `Direct ${provider.provider_name} link is not available for this title.`);
                          }
                        }}
                      >
                        <img src={tmdbImageUrl(provider.logo_path, 'w45')} alt="" />
                        <span>{provider.provider_name}</span>
                      </a>
                    );
                  })}
                </div>
              )}
              <div className="md-cta-row">
                {(watchShowUrl || ottLinksLoading) && (
                  <a
                    className="md-btn md-btn-accent"
                    href={watchShowUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event => {
                      if (!watchShowUrl) {
                        event.preventDefault();
                        window.alert('Finding the official watch link… try again in a moment.');
                      }
                    }}
                  >
                    {ottLinksLoading && !watchShowUrl ? 'Finding watch link…' : 'Watch now'}
                  </a>
                )}
                {trailer && (
                  <button
                    type="button"
                    className="md-btn md-btn-danger md-btn-trailer"
                    onClick={() => setShowTrailer(current => !current)}
                    aria-expanded={showTrailer}
                  >
                    {showTrailer ? 'Hide Trailer' : 'Play Trailer'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="md-hero-copy">
            <div className="md-hero-intro">
              <h1 className="md-title">
                {title}
                {releaseYear ? <span>({releaseYear})</span> : null}
              </h1>
              {creators.length > 0 && (
                <p className="md-directed">
                  {releaseYear ? <span className="md-directed-year">{releaseYear} · </span> : null}
                  <span className="md-directed-label">Created by </span>
                  {creators.slice(0, 3).map((creator, index) => (
                    <React.Fragment key={creator.id}>
                      {index > 0 && ', '}
                      <Link to={`/person/${creator.id}`}>{creator.name}</Link>
                    </React.Fragment>
                  ))}
                </p>
              )}
              {runtimeLabel ? <p className="md-runtime-mobile">{runtimeLabel}</p> : null}
            </div>

            {show.tagline ? <p className="md-tagline">“{show.tagline}”</p> : null}

            <div className="md-meta">
              {show.vote_average != null && (
                <span><strong>{Number(show.vote_average).toFixed(1)}</strong> /10 TMDB</span>
              )}
              {runtimeLabel ? <span>{runtimeLabel}</span> : null}
              {show.first_air_date ? <span>{new Date(`${show.first_air_date}T00:00:00`).toLocaleDateString()}</span> : null}
              {show.number_of_seasons > 0 && <span>{show.number_of_seasons} season{show.number_of_seasons === 1 ? '' : 's'}</span>}
              {show.number_of_episodes > 0 && <span>{show.number_of_episodes} episodes</span>}
              {show.status ? <span>{show.status}</span> : null}
            </div>

            {show.genres?.length > 0 && (
              <div className="md-genres">
                {show.genres.map(genre => (
                  <span key={genre.id} className="md-chip">{genre.name}</span>
                ))}
              </div>
            )}

            <p className="md-overview-label">Overview</p>
            <p className={`md-overview${overviewNeedsToggle && !overviewExpanded ? ' is-clamped' : ''}`}>
              {overviewText}
            </p>
            {overviewNeedsToggle && (
              <button type="button" className="md-readmore" onClick={() => setOverviewExpanded(current => !current)}>
                {overviewExpanded ? 'Show less' : 'Read more'}
              </button>
            )}

            {(creators.length > 0 || writers.length > 0) && (
              <div className="md-crew">
                <p className="md-section-label">Crew</p>
                {creators.length > 0 && (
                  <div className="md-crew-row">
                    <span className="md-crew-label">Created by</span>
                    {creators.map((creator, index) => (
                      <React.Fragment key={creator.id}>
                        {index > 0 && ', '}
                        <Link to={`/person/${creator.id}`}>{creator.name}</Link>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {writers.length > 0 && (
                  <div className="md-crew-row">
                    <span className="md-crew-label">Written by</span>
                    {writers.slice(0, 6).map((writer, index) => (
                      <React.Fragment key={`${writer.id}-${writer.job}`}>
                        {index > 0 && ', '}
                        <Link to={`/person/${writer.id}`}>{writer.name}</Link>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="md-hero-actions">
              <button
                type="button"
                className="md-btn md-btn-accent"
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist}
              >
                {addingToWatchlist ? 'Adding…' : 'Add to Watchlist'}
              </button>
              <button type="button" className="md-btn md-btn-ghost" onClick={handleShare}>
                Share
              </button>
              {watchlistNotice && <span className="md-toast" role="status">{watchlistNotice}</span>}
              {shareNotice && <span className="md-toast" role="status">{shareNotice}</span>}
            </div>
          </div>
        </section>

        {trailer && showTrailer && (
          <div className="md-trailer-wrap">
            <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden border border-[rgba(245,240,232,0.12)]">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        )}

        {show.credits?.cast?.length > 0 && (
          <section className="md-section" aria-label="Top cast">
            <div className="md-section-head">
              <div>
                <h2>Top Cast</h2>
                <p>Key performances from the series.</p>
              </div>
            </div>
            <div className="md-cast-rail">
              {show.credits.cast.slice(0, 12).map(actor => (
                <Link key={actor.id} to={`/person/${actor.id}`} className="md-cast-card">
                  {actor.profile_path ? (
                    <img src={tmdbImageUrl(actor.profile_path, 'w185')} alt="" loading="lazy" />
                  ) : (
                    <span className="md-cast-fallback">{(actor.name || '?')[0]}</span>
                  )}
                  <div className="md-cast-name">{actor.name}</div>
                  <div className="md-cast-role">{actor.character}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {show.production_companies?.length > 0 && (
          <section className="md-section" aria-label="Production">
            <div className="md-section-head">
              <div>
                <h2>Production</h2>
              </div>
            </div>
            <div className="md-genres">
              {show.production_companies.map(company => (
                <span key={company.id} className="md-chip">{company.name}</span>
              ))}
            </div>
          </section>
        )}

        <section className="md-section" aria-label="Episodes and seasons">
          <div className="md-section-head">
            <div>
              <h2>Episodes & Seasons</h2>
              <p>Browse the full season structure.</p>
            </div>
          </div>
          <div className="md-panel">
            <EpisodeList seasons={show.seasons || []} episodesBySeason={episodesBySeason} />
          </div>
        </section>

        <section className="md-section" aria-label="Ratings and reviews">
          <div className="md-section-head">
            <div>
              <h2>Ratings & Reviews</h2>
              <p>Your score stays on your CineShelf account.</p>
            </div>
          </div>

          <div className="md-reviews">
            <form className="md-panel md-form" onSubmit={handleReviewSubmit}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Your Review</h3>
                {myReviewLoaded && myReviewId && (
                  <span className="md-saved-pill">
                    Saved to your account{reviewRating !== '' ? ` · ${reviewRating}/10` : ''}
                  </span>
                )}
              </div>

              <label>
                Your rating
                <div className="md-rating-row">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={reviewRating}
                    onChange={event => setReviewRating(event.target.value)}
                    placeholder="8"
                    aria-label="Rating out of 10"
                  />
                  <span style={{ color: '#d4af37', fontWeight: 700 }}>★ / 10</span>
                </div>
              </label>

              <label htmlFor="tv-watched-date">
                Watched on
                <input
                  id="tv-watched-date"
                  type="date"
                  value={watchedAt}
                  max={getTodayDate()}
                  onChange={event => setWatchedAt(event.target.value)}
                  required
                />
              </label>

              <label htmlFor="tv-review-text">
                Written review <span style={{ fontWeight: 400 }}>(optional)</span>
                <textarea
                  id="tv-review-text"
                  rows={5}
                  maxLength={2000}
                  placeholder="What stayed with you after the credits?"
                  value={reviewText}
                  onChange={event => setReviewText(event.target.value)}
                />
              </label>

              <div className="md-form-actions">
                <button type="submit" className="md-btn md-btn-accent" disabled={reviewLoading || diaryLoading}>
                  {reviewLoading ? 'Saving…' : (myReviewId ? 'Update Rating / Review' : 'Save Rating / Review')}
                </button>
                <button
                  type="button"
                  className="md-btn md-btn-ghost"
                  onClick={handleDiaryLog}
                  disabled={diaryLoading || reviewLoading}
                >
                  {diaryLoading ? 'Logging…' : 'Log only to Diary'}
                </button>
              </div>
              {reviewError && <p className="md-alert" role="alert">{reviewError}</p>}
              {diaryError && <p className="md-alert" role="alert">{diaryError}</p>}
              {diaryNotice && <p className="md-notice" role="status">{diaryNotice}</p>}
            </form>

            <div className="md-panel">
              <h3>Community Reviews</h3>
              <div className="md-community-score">
                <div>
                  <span className="md-section-label">Community rating</span>
                  <strong>
                    {ratingCount ? averageRating.toFixed(1) : '—'}
                    <span style={{ fontSize: '0.9rem', color: '#94a3b8', marginLeft: 4 }}>/ 10</span>
                  </strong>
                </div>
                <span className="md-empty" style={{ fontStyle: 'normal' }}>
                  {ratingCount} rating{ratingCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="md-bars" aria-label="Community rating summary">
                {[...ratingDistribution].reverse().map(({ rating, count }) => (
                  <div key={rating} className="md-bar-row">
                    <span>{rating}</span>
                    <div
                      className="md-bar-track"
                      role="progressbar"
                      aria-label={`${rating} out of 10 ratings`}
                      aria-valuemin={0}
                      aria-valuemax={largestRatingBucket}
                      aria-valuenow={count}
                    >
                      <div className="md-bar-fill" style={{ width: `${(count / largestRatingBucket) * 100}%` }} />
                    </div>
                    <span>{count}</span>
                  </div>
                ))}
              </div>

              <div className="md-review-list">
                {reviewsError ? (
                  <p className="md-alert">{reviewsError}</p>
                ) : !reviews.length ? (
                  <p className="md-empty">No reviews found.</p>
                ) : (
                  reviews.map((review, index) => (
                    <Link
                      key={review._id || index}
                      to={`/review/${review._id}`}
                      className={`md-review-card${String(review._id) === String(myReviewId) ? ' is-mine' : ''}`}
                      aria-label={`Read ${review.user?.name || review.user?.username || 'member'}'s full review`}
                    >
                      <div className="md-avatar">
                        {(review.user?.name || review.user?.username || 'U')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="md-review-meta">
                          <span className="rating">★ {review.rating}/10</span>
                          <strong>
                            {review.user?.name || (review.user?.username ? `@${review.user.username}` : 'CineShelf member')}
                          </strong>
                          {String(review._id) === String(myReviewId) && (
                            <span className="md-saved-pill">Your review</span>
                          )}
                        </div>
                        <div className="md-review-body">{review.review || 'Rating only'}</div>
                        <div className="md-review-time">
                          {review.createdAt ? new Date(review.createdAt).toLocaleString() : ''}
                          {review.review ? ' · Read full review →' : ''}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {recommendations.length > 0 && (
          <section className="md-section" aria-label="More like this">
            <div className="md-section-head">
              <div>
                <h2>More Like This</h2>
                <p>Similar series you may enjoy.</p>
              </div>
            </div>
            <div className="md-poster-rail">
              {recommendations.filter(item => item.poster_path).slice(0, 20).map(item => (
                <Link key={item.id} to={`/tv/${item.id}`} className="md-poster-card">
                  <img src={tmdbImageUrl(item.poster_path, 'w342')} alt="" loading="lazy" />
                  <strong>{item.name}</strong>
                  <span>
                    {item.first_air_date ? item.first_air_date.slice(0, 4) : '—'}
                    {item.vote_average != null ? ` · ★ ${Number(item.vote_average).toFixed(1)}` : ''}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
