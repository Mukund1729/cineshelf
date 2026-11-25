import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import BoxOfficeChart from '../components/BoxOfficeChart';
import TrailerEmbed from '../components/TrailerEmbed';
import Navbar from '../components/Navbar';
import { UserLink } from '../components/EntityLink';
import usePageTitle from '../hooks/usePageTitle';
import { shareOrCopy } from '../lib/share';
import { hasAuthSession } from '../api/session';
import { searchMovies, searchPeople, tmdbGet, tmdbImageUrl } from '../api/tmdb';
import './movie-detail.css';

const getTodayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const CREW_SECTIONS = [
  { label: 'Directed by', jobs: ['Director'] },
  { label: 'Written by', jobs: ['Writer', 'Screenplay'] },
  { label: 'Produced by', jobs: ['Producer'] },
  { label: 'Director of Photography', jobs: ['Director of Photography'] },
  { label: 'Music by', jobs: ['Original Music Composer', 'Music Composer', 'Music'] },
];

const MovieDetail = () => {
  const { id } = useParams();
  const [showTrailer, setShowTrailer] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  useEffect(() => {
    setShowTrailer(false);
    setOverviewExpanded(false);
  }, [id]);

  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistToast, setWatchlistToast] = useState('');
  const [shareNotice, setShareNotice] = useState('');

  // Review form — hydrated from MongoDB for the signed-in user
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

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef();
  const [showSearchBar, setShowSearchBar] = useState(false);

  useEffect(() => {
    if (!showSearchBar) return undefined;
    if (!searchQuery || searchQuery.trim().length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchError(null);
      return undefined;
    }
    setIsSearching(true);
    setSearchLoading(true);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const [movieRes, peopleRes, originalRes] = await Promise.all([
          searchMovies(searchQuery),
          searchPeople(searchQuery),
          axios.get('/api/original-films/search', { params: { query: searchQuery } })
            .then(response => response.data)
            .catch(() => ({ results: [], people: [] })),
        ]);
        const movieResults = [
          ...(originalRes?.results || []).map(result => ({ ...result, media_type: 'movie' })),
          ...(movieRes?.results || []).map(result => ({ ...result, media_type: 'movie' })),
        ];
        const peopleResults = [
          ...(originalRes?.people || []),
          ...(peopleRes?.results || []).map(result => ({ ...result, media_type: 'person' })),
        ];
        setSearchResults([...movieResults, ...peopleResults]);
        setSearchLoading(false);
      } catch {
        setSearchError('Failed to fetch results.');
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, showSearchBar]);

  const [movie, setMovie] = useState(null);
  usePageTitle(movie?.title);
  const [movieLoading, setMovieLoading] = useState(true);
  const [movieError, setMovieError] = useState('');
  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    setMovie(null);
    setMovieError('');
    setMovieLoading(true);
    const fetchMovie = async () => {
      try {
        let data;
        if (/^\d+$/.test(id)) {
          data = await tmdbGet(`/movie/${id}`, { append_to_response: 'credits,videos' });
          const providersData = await tmdbGet(`/movie/${id}/watch/providers`).catch(() => null);
          data = { ...data, 'watch/providers': providersData };
        } else {
          const response = await axios.get(`/api/original-films/${encodeURIComponent(id)}`);
          data = response.data?.data;
        }
        if (!data) throw new Error('Movie details were not returned.');
        if (active) setMovie(data);
      } catch (error) {
        if (active) setMovieError(error.response?.data?.error || 'Could not load movie details.');
      } finally {
        if (active) setMovieLoading(false);
      }
    };
    fetchMovie();
    return () => { active = false; };
  }, [id]);

  const handleAddToWatchlist = async () => {
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
      setWatchlistToast('Please sign in to add to watchlist.');
      return;
    }
    setAddingToWatchlist(true);
    try {
      await axios.post('/api/watchlist', {
        tmdbId: movie.id,
        source: movie.source || 'tmdb',
        ...(movie.source === 'original' ? { originalId: movie.slug } : {}),
        title: movie.title,
        poster: movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w500') : '',
        posterUrl: movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w500') : '',
        overview: movie.overview,
        releaseDate: movie.release_date,
        voteAverage: movie.vote_average,
        genreIds: movie.genre_ids,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setWatchlistToast('Added to watchlist!');
    } catch (err) {
      console.error('Watchlist add error:', err);
      setWatchlistToast(err.response?.data?.error || 'Failed to add. Try again.');
    } finally {
      setAddingToWatchlist(false);
      setTimeout(() => setWatchlistToast(''), 2000);
    }
  };

  const handleShare = async () => {
    const result = await shareOrCopy({ title: movie?.title, path: `/movie/${movie?.id || id}` });
    if (result.method === 'clipboard') setShareNotice('Link copied.');
    else if (result.method === 'failed') setShareNotice('Could not share this link.');
    if (result.method !== 'share' && result.method !== 'cancelled') {
      setTimeout(() => setShareNotice(''), 2500);
    }
  };

  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState(null);
  useEffect(() => {
    if (!movie?.id) return undefined;
    let active = true;
    setReviews([]);
    setReviewsError(null);
    setMyReviewId(null);
    setMyReviewLoaded(false);
    setReviewText('');
    setReviewRating('');
    setWatchedAt(getTodayDate());
    setDiaryNotice('');
    setReviewError('');
    setDiaryError('');

    axios.get(`/api/review/movie/${movie.id}`)
      .then(response => {
        if (active) setReviews(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(err => {
        if (active) setReviewsError(err.response?.data?.error || 'Could not load reviews.');
      });

    if (hasAuthSession()) {
      const token = localStorage.getItem('token');
      axios.get(`/api/review/mine/${movie.id}`, {
        params: { mediaType: 'movie' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        withCredentials: true,
      })
        .then(response => {
          if (!active) return;
          const mine = response.data?.data;
          if (mine?._id) {
            setMyReviewId(mine._id);
            if (mine.rating != null && mine.rating !== '') {
              setReviewRating(String(mine.rating));
            }
            setReviewText(typeof mine.review === 'string' ? mine.review : '');
          }
          if (response.data?.watchedAt) {
            setWatchedAt(response.data.watchedAt);
          }
          setMyReviewLoaded(true);
        })
        .catch(() => {
          if (active) setMyReviewLoaded(true);
        });
    } else {
      setMyReviewLoaded(true);
    }

    return () => { active = false; };
  }, [movie?.id]);

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

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    setDiaryError('');
    setDiaryNotice('');
    if (Number(reviewRating) < 1 || Number(reviewRating) > 10) {
      setReviewError('Please choose a rating from 1 to 10. A written review is optional.');
      return;
    }
    if (!watchedAt) {
      setReviewError('Please choose the date you watched this movie.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
      setReviewError('Please sign in to submit a review.');
      return;
    }
    setReviewLoading(true);
    try {
      const res = await axios.post('/api/review', {
        tmdbId: movie.id,
        source: movie.source || 'tmdb',
        ...(movie.source === 'original' ? { originalId: movie.slug } : {}),
        title: movie.title,
        poster: movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w500') : '',
        posterUrl: movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w500') : '',
        overview: movie.overview,
        mediaType: 'movie',
        rating: Number(reviewRating),
        review: reviewText.trim(),
        watchedAt,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      const savedReview = res.data?.data;
      if (!savedReview) throw new Error('Review was not returned by the server.');
      setReviews(current => [savedReview, ...current.filter(review => review._id !== savedReview._id)]);
      setMyReviewId(savedReview._id);
      if (savedReview.rating != null && savedReview.rating !== '') {
        setReviewRating(String(savedReview.rating));
      }
      setReviewText(typeof savedReview.review === 'string' ? savedReview.review : '');
      setMyReviewLoaded(true);
      setDiaryNotice(myReviewId
        ? 'Your rating/review was updated and remains saved to your account.'
        : 'Rating/review saved to your profile and Movie Diary.');
      setDiaryError('');
    } catch (err) {
      const savedReview = err.response?.data?.data;
      if (savedReview?._id) {
        setReviews(current => [savedReview, ...current.filter(review => review._id !== savedReview._id)]);
        setMyReviewId(savedReview._id);
        if (savedReview.rating != null && savedReview.rating !== '') {
          setReviewRating(String(savedReview.rating));
        }
        setReviewText(typeof savedReview.review === 'string' ? savedReview.review : '');
      }
      setReviewError(err.response?.data?.error || err.message || 'Failed to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDiaryLog = async () => {
    const token = localStorage.getItem('token');
    if (!hasAuthSession()) {
      setDiaryError('Please sign in to log this movie.');
      return;
    }
    if (!movie || !watchedAt) {
      setDiaryError('Choose a watched date before logging this movie.');
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
        tmdbId: movie.id,
        source: movie.source || 'tmdb',
        ...(movie.source === 'original' ? { originalId: movie.slug } : {}),
        title: movie.title,
        poster: movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w500') : '',
        mediaType: 'movie',
        watchedAt,
        ...(reviewRating !== '' ? { rating: Number(reviewRating) } : {}),
        note: reviewText.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setDiaryNotice(`${movie.title} was logged in your Movie Diary.`);
    } catch (err) {
      setDiaryError(err.response?.data?.error || 'Could not log this movie.');
    } finally {
      setDiaryLoading(false);
    }
  };

  const [boxOffice, setBoxOffice] = useState([]);
  const [rawBoxOfficeData, setRawBoxOfficeData] = useState(null);
  const [boxOfficeError, setBoxOfficeError] = useState(null);

  useEffect(() => {
    setBoxOfficeError(null);
    setBoxOffice([]);
    setRawBoxOfficeData(null);
    if (!movie?.id || movie.source === 'original') return undefined;
    let active = true;
    axios.get(`/api/boxoffice/movie/${movie.id}`)
      .then(res => {
        if (!active) return;
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
              list.push({ name: label, amount: `₹${val}${suffix}`, source: obj.source, sourceUrl: obj.sourceUrl, isEstimate: obj.isEstimate, sourceReportedValue: obj.sourceReportedValue });
            } else if (val >= 1000000) {
              val = (val / 1000000).toFixed(2);
              suffix = ' M';
              list.push({ name: label, amount: `$${val}${suffix}`, source: obj.source, sourceUrl: obj.sourceUrl, isEstimate: obj.isEstimate, sourceReportedValue: obj.sourceReportedValue });
            } else {
              list.push({ name: label, amount: `$${val.toLocaleString()}`, source: obj.source, sourceUrl: obj.sourceUrl, isEstimate: obj.isEstimate, sourceReportedValue: obj.sourceReportedValue });
            }
          } else {
            list.push({ name: label, amount: val, source: obj.source, sourceUrl: obj.sourceUrl, isEstimate: obj.isEstimate });
          }
        };

        if (Array.isArray(data.reports) && data.reports.length) {
          const labels = {
            budget: 'Budget',
            india_nett: 'India nett',
            india_gross: 'India gross',
            domestic_gross: 'Domestic gross',
            international_gross: 'International gross',
            worldwide_gross: 'Worldwide gross',
          };
          data.reports.forEach(report => {
            formatValue({
              value: report.amount,
              currency: report.currency,
              source: report.source,
              sourceUrl: report.sourceUrl,
              isEstimate: report.isEstimate,
              sourceReportedValue: report.sourceReportedValue,
            }, labels[report.collectionType] || report.collectionType);
          });
        } else {
          formatValue(data.budget, 'Budget');
          formatValue(data.openingDay, 'Opening Day');
          formatValue(data.openingWeekend, 'Opening Weekend');
          formatValue(data.indiaNet, 'India Net');
          formatValue(data.indiaGross, 'India Gross');
          formatValue(data.overseasGross, 'Overseas Gross');
          formatValue(data.worldwideGross, 'Worldwide Gross');
          formatValue(data.verdict, 'Verdict');
        }

        setBoxOffice(list);
        setRawBoxOfficeData(data);
      })
      .catch(err => {
        if (!active) return;
        // 404 = no publisher/history/TMDB figures yet — empty state, not an app error.
        if (err.response?.status !== 404) {
          console.warn('Could not load box office:', err.message);
        }
        setBoxOffice([]);
        setRawBoxOfficeData(null);
        setBoxOfficeError(null);
      });
    return () => { active = false; };
  }, [movie?.id, movie?.source]);

  const [recommendations, setRecommendations] = useState([]);
  const [actorMovies, setActorMovies] = useState([]);
  const [ottLinks, setOttLinks] = useState({ byProviderId: {}, byName: {}, preferredUrl: null });
  const [ottLinksLoading, setOttLinksLoading] = useState(false);

  useEffect(() => {
    if (!movie?.id || movie.source === 'original') {
      setOttLinks({ byProviderId: {}, byName: {}, preferredUrl: null });
      return undefined;
    }
    let active = true;
    setOttLinksLoading(true);
    const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
    axios.get(`/api/streaming/ott-links/movie/${movie.id}`, {
      params: { title: movie.title, year, country: 'IN' },
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
  }, [movie?.id, movie?.title, movie?.release_date, movie?.source]);

  useEffect(() => {
    const fetchRecsAndActorMovies = async () => {
      if (!movie) return;
      setActorMovies([]);
      if (movie.source === 'original') {
        setRecommendations(movie.related || []);
        return;
      }
      try {
        const recData = await tmdbGet(`/movie/${movie.id}/recommendations`);
        const recs = (recData.results || []).filter(m => m.poster_path && m.id !== movie.id);
        setRecommendations(recs.slice(0, 20));
      } catch {
        setRecommendations([]);
      }
      if (!movie.credits?.cast?.length) return;
      const actor = movie.credits.cast[0];
      if (!actor?.id) return;
      try {
        const data = await tmdbGet(`/person/${actor.id}/movie_credits`);
        const filtered = (data.cast || []).filter(m => m.poster_path && m.id !== movie.id);
        filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        setActorMovies(filtered.slice(0, 20));
      } catch {
        setActorMovies([]);
      }
    };
    fetchRecsAndActorMovies();
  }, [movie]);

  const crewSections = CREW_SECTIONS
    .map(({ label, jobs }) => ({
      label,
      people: (movie?.credits?.crew || []).filter(credit => jobs.includes(credit.job)),
    }))
    .filter(section => section.people.length > 0);
  const directors = crewSections.find(section => section.label === 'Directed by')?.people || [];
  const trailer = movie?.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Trailer');
  const releaseYear = movie?.release_date
    ? movie.release_date.split('-')[0]
    : (movie?.releaseYear || '');
  const runtimeLabel = movie?.runtimeLabel
    || (movie?.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '');
  const overviewText = movie?.overview || 'No overview available.';
  const overviewNeedsToggle = overviewText.length > 280;
  const leadActor = movie?.credits?.cast?.[0];
  const watchRegion = movie?.['watch/providers']?.results?.IN
    || movie?.['watch/providers']?.results?.US
    || null;
  const providerList = [
    ...(watchRegion?.flatrate || []),
    ...(watchRegion?.rent || []),
    ...(watchRegion?.buy || []),
  ].filter((provider, index, list) => (
    list.findIndex(item => item.provider_id === provider.provider_id) === index
  ));

  const resolveProviderUrl = provider => {
    const byId = ottLinks.byProviderId?.[provider.provider_id]?.url;
    if (byId) return byId;

    const rawName = String(provider.provider_name || '');
    const nameKey = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (ottLinks.byName?.[nameKey]?.url) return ottLinks.byName[nameKey].url;

    // Common TMDB ↔ JustWatch name mismatches
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

  // Prefer real OTT title page (Netflix etc.). Never send users to TMDB.
  const watchMovieUrl = ottLinks.preferredUrl || movie?.watchUrl || '';
  const backdropUrl = movie?.backdrop_path
    ? tmdbImageUrl(movie.backdrop_path, 'original')
    : (movie?.poster_path ? tmdbImageUrl(movie.poster_path, 'original') : '');

  return (
    <div className="md-page movie-detail-page">
      {backdropUrl ? (
        <div
          className="md-backdrop"
          style={{ backgroundImage: `url(${backdropUrl})` }}
          aria-hidden="true"
        />
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
                onClick={() => { setShowSearchBar(false); setSearchQuery(''); setIsSearching(false); }}
              >
                Close
              </button>
            </div>
            {isSearching && searchQuery && (
              <div className="md-search-results">
                {searchLoading && <div className="md-status">Searching…</div>}
                {searchError && <div className="md-status is-error">{searchError}</div>}
                {!searchLoading && !searchError && searchResults.length === 0 && (
                  <div className="md-status">No results found.</div>
                )}
                {!searchLoading && !searchError && searchResults
                  .filter(result => result.poster_path || result.profile_path || result.source === 'original')
                  .map(result => (
                    <Link
                      key={`${result.media_type}-${result.id}`}
                      to={result.media_type === 'person' ? `/person/${result.id}` : result.media_type === 'movie' ? `/movie/${result.id}` : `/tv/${result.id}`}
                      className="md-search-item"
                      onClick={() => { setIsSearching(false); setShowSearchBar(false); setSearchQuery(''); setSearchResults([]); }}
                    >
                      {result.poster_path || result.profile_path ? (
                        <img src={tmdbImageUrl(result.poster_path || result.profile_path, 'w92')} alt="" />
                      ) : (
                        <span className="md-search-fallback">{(result.name || '?')[0]}</span>
                      )}
                      <div>
                        <strong>{result.title || result.name}</strong>
                        {result.vote_average ? <div className="md-review-time">★ {result.vote_average.toFixed(1)}</div> : null}
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="md-shell movie-detail-content">
        {movieLoading && (
          <div className="md-status" aria-live="polite">
            <div className="md-skeleton" style={{ height: 220, marginBottom: 12 }} />
            Loading movie details…
          </div>
        )}
        {!movieLoading && movieError && <p role="alert" className="md-status is-error">{movieError}</p>}

        {movie && (
          <>
            <section className="md-hero" aria-label="Movie introduction">
              <div className="md-poster-col">
                <img
                  className="md-poster"
                  src={movie.poster_path ? tmdbImageUrl(movie.poster_path, 'w500') : '/placeholder.jpg'}
                  alt={movie.title}
                />

                <div className="md-hero-actions-bar md-poster-actions">
                  {(providerList.length > 0 || watchMovieUrl || ottLinksLoading || trailer) && (
                    <p className="md-watch-label">Where to watch</p>
                  )}
                  {providerList.length > 0 && (
                    <div className="md-providers" aria-label="Where to watch">
                      {providerList.slice(0, 6).map(provider => {
                        const href = resolveProviderUrl(provider) || watchMovieUrl || '';
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
                    {(watchMovieUrl || ottLinksLoading) && (
                      <a
                        className="md-btn md-btn-accent"
                        href={watchMovieUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={event => {
                          if (!watchMovieUrl) {
                            event.preventDefault();
                            window.alert('Finding the official watch link… try again in a moment.');
                          }
                        }}
                      >
                        {ottLinksLoading && !watchMovieUrl ? 'Finding watch link…' : 'Watch now'}
                      </a>
                    )}
                    {movie.watchUrl && movie.watchUrl !== watchMovieUrl && (
                      <a className="md-btn md-btn-danger" href={movie.watchUrl} target="_blank" rel="noopener noreferrer">
                        Watch Full Film
                      </a>
                    )}
                    {trailer && (
                      <button
                        type="button"
                        className="md-btn md-btn-danger md-btn-trailer"
                        onClick={() => setShowTrailer(current => !current)}
                        aria-expanded={showTrailer}
                        aria-controls="movie-trailer-player"
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
                    {movie.title}
                    {releaseYear ? <span>({releaseYear})</span> : null}
                  </h1>
                  {directors.length > 0 && (
                    <p className="md-directed">
                      {releaseYear ? <span className="md-directed-year">{releaseYear} · </span> : null}
                      <span className="md-directed-label">Directed by </span>
                      {directors.slice(0, 3).map((person, index) => (
                        <React.Fragment key={person.id}>
                          {index > 0 && ', '}
                          <Link to={`/person/${person.id}`}>{person.name}</Link>
                        </React.Fragment>
                      ))}
                    </p>
                  )}
                  {runtimeLabel ? <p className="md-runtime-mobile">{runtimeLabel}</p> : null}
                </div>

                {movie.tagline ? <p className="md-tagline">“{movie.tagline}”</p> : null}

                <div className="md-meta">
                  {movie.source === 'original' ? (
                    <span><strong>{ratingCount ? averageRating.toFixed(1) : '—'}</strong> /10 community</span>
                  ) : movie.vote_average != null ? (
                    <span><strong>{movie.vote_average.toFixed(1)}</strong> /10 TMDB</span>
                  ) : null}
                  {runtimeLabel ? <span>{runtimeLabel}</span> : null}
                  {movie.release_date ? <span>{new Date(movie.release_date).toLocaleDateString()}</span> : null}
                  {movie.revenue ? <span>${Number(movie.revenue).toLocaleString()}</span> : null}
                </div>

                {Array.isArray(movie.genres) && movie.genres.length > 0 && (
                  <div className="md-genres">
                    {movie.genres.map(genre => (
                      <span key={genre.id || genre.name} className="md-chip">
                        {genre.name}
                      </span>
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

                {movie.quote && (
                  <blockquote className="md-tagline" style={{ marginTop: '1rem' }}>“{movie.quote}”</blockquote>
                )}
                {movie.copyrightNotice && <p className="md-empty" style={{ marginTop: '0.75rem' }}>{movie.copyrightNotice}</p>}

                {crewSections.length > 0 && (
                  <div className="md-crew">
                    <p className="md-section-label">Crew</p>
                    {crewSections.map(({ label, people }) => (
                      <div className="md-crew-row" key={label}>
                        <span className="md-crew-label">{label}</span>
                        {people.map((person, index) => (
                          <React.Fragment key={`${person.id}-${person.job}-${index}`}>
                            <Link to={`/person/${person.id}`}>{person.name}</Link>
                            {index < people.length - 1 ? ', ' : ''}
                          </React.Fragment>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {movie.specialThanks?.length > 0 && (
                  <div className="md-crew">
                    <p className="md-section-label">Special Thanks</p>
                    <div className="md-crew-row">
                      {movie.specialThanks.map((person, index) => (
                        <React.Fragment key={`${person.id}-${index}`}>
                          <Link to={`/person/${person.id}`}>{person.name}</Link>
                          {index < movie.specialThanks.length - 1 ? ', ' : ''}
                        </React.Fragment>
                      ))}
                    </div>
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
                  {watchlistToast && <span className="md-toast" role="status">{watchlistToast}</span>}
                  {shareNotice && <span className="md-toast" role="status">{shareNotice}</span>}
                </div>
              </div>
            </section>

            {trailer && showTrailer && (
              <div id="movie-trailer-player" className="md-trailer-wrap">
                <TrailerEmbed trailerUrl={trailer.key} movieTitle={movie.title} />
              </div>
            )}

            {movie.credits?.cast?.length > 0 && (
              <section className="md-section" aria-label="Top cast">
                <div className="md-section-head">
                  <div>
                    <h2>Top Cast</h2>
                    <p>Performances that define the film.</p>
                  </div>
                </div>
                <div className="md-cast-rail">
                  {movie.credits.cast.slice(0, 12).map(actor => (
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

            {movie.source !== 'original' && (
              <section className="md-section" aria-label="Box office">
                <div className="md-section-head">
                  <div>
                    <h2>Box Office</h2>
                    <p>Figures from available reporting sources.</p>
                  </div>
                </div>
                {boxOfficeError ? (
                  <p className="md-alert">{boxOfficeError}</p>
                ) : boxOffice.length === 0 ? (
                  <p className="md-empty">No box office data available for this title yet.</p>
                ) : (
                  <>
                    <div className="md-bo-grid">
                      {boxOffice.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="md-bo-card">
                          <span>{item.name}</span>
                          <strong>{item.amount}</strong>
                          {item.sourceReportedValue && <small>Provider: {item.sourceReportedValue}</small>}
                          <small>
                            {item.sourceUrl ? (
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer">via {item.source}</a>
                            ) : `via ${item.source}`}
                            {item.isEstimate ? ' · estimate' : ''}
                          </small>
                        </div>
                      ))}
                    </div>
                    {rawBoxOfficeData?.daywiseCollection?.value?.length > 0 && (
                      <div style={{ marginTop: '1.25rem' }}>
                        <BoxOfficeChart
                          data={rawBoxOfficeData.daywiseCollection.value.map(day => ({
                            date: day.date
                              ? new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : `Day ${day.day}`,
                            amount: day.amount,
                          }))}
                        />
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

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
                        onChange={event => setReviewRating(event.target.value === '' ? '' : event.target.value)}
                        placeholder="8"
                        aria-label="Rating out of 10"
                      />
                      <span style={{ color: '#d5b23d', fontWeight: 700 }}>★ / 10</span>
                    </div>
                  </label>

                  <label htmlFor="movie-watched-date">
                    Watched on
                    <input
                      id="movie-watched-date"
                      type="date"
                      value={watchedAt}
                      max={getTodayDate()}
                      onChange={event => setWatchedAt(event.target.value)}
                      required
                    />
                  </label>

                  <label htmlFor="movie-review-text">
                    Written review <span style={{ fontWeight: 400 }}>(optional)</span>
                    <textarea
                      id="movie-review-text"
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
                        <span style={{ fontSize: '0.9rem', color: '#9a958c', marginLeft: 4 }}>/ 10</span>
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
                          <div
                            className="md-bar-fill"
                            style={{ width: `${(count / largestRatingBucket) * 100}%` }}
                          />
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
                        <article
                          key={review._id || review.id || index}
                          className={`md-review-card${String(review._id) === String(myReviewId) ? ' is-mine' : ''}`}
                        >
                          <UserLink user={review.user} className="md-avatar" aria-label={`Open ${(review.user?.name || review.user?.username || 'member')}'s profile`}>
                            {(review.user?.name || review.user?.username || 'U')[0]?.toUpperCase()}
                          </UserLink>
                          <div>
                            <div className="md-review-meta">
                              <span className="rating">★ {review.rating}/10</span>
                              <UserLink user={review.user}>
                                <strong>
                                  {review.user?.name || (review.user?.username ? `@${review.user.username}` : 'CineShelf member')}
                                </strong>
                              </UserLink>
                              {String(review._id) === String(myReviewId) && (
                                <span className="md-saved-pill">Your review</span>
                              )}
                            </div>
                            <div className="md-review-body">{review.review || 'Rating only'}</div>
                            <div className="md-review-time">
                              {review.createdAt ? new Date(review.createdAt).toLocaleString() : ''}
                              {review._id && (
                                <>
                                  {' · '}
                                  <Link to={`/review/${review._id}`}>Read full review →</Link>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
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
                    <p>Nearby titles in tone and craft.</p>
                  </div>
                </div>
                <div className="md-poster-rail">
                  {recommendations.map(item => (
                    <Link key={item.id} to={`/movie/${item.id}`} className="md-poster-card">
                      <img src={tmdbImageUrl(item.poster_path, 'w342')} alt="" loading="lazy" />
                      <strong>{item.title}</strong>
                      <span>
                        {item.release_date ? item.release_date.slice(0, 4) : '—'}
                        {item.vote_average != null ? ` · ★ ${item.vote_average.toFixed(1)}` : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {leadActor && actorMovies.length > 0 && (
              <section className="md-section" aria-label={`More from ${leadActor.name}`}>
                <div className="md-section-head">
                  <div>
                    <h2>More from {leadActor.name}</h2>
                    <p>Further work from the film’s lead.</p>
                  </div>
                </div>
                <div className="md-poster-rail">
                  {actorMovies.map(item => (
                    <Link key={item.id} to={`/movie/${item.id}`} className="md-poster-card">
                      <img src={tmdbImageUrl(item.poster_path, 'w342')} alt="" loading="lazy" />
                      <strong>{item.title}</strong>
                      <span>
                        {item.release_date ? item.release_date.slice(0, 4) : '—'}
                        {item.vote_average != null ? ` · ★ ${item.vote_average.toFixed(1)}` : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MovieDetail;
