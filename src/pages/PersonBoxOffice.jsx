import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';
import './movie-detail.css';
import './person-detail.css';

function formatUsd(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

export default function PersonBoxOffice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchProgress, setFetchProgress] = useState({ done: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearchChange = async event => {
    const value = event.target.value;
    setSearch(value);
    if (value.trim().length > 1) {
      try {
        const data = await tmdbGet('/search/person', { query: value.trim() });
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = personId => {
    setShowSuggestions(false);
    setSearch('');
    navigate(`/person/${personId}/boxoffice`);
  };

  useEffect(() => {
    let active = true;
    const fetchFilmography = async () => {
      setLoading(true);
      setError(null);
      setMovies([]);
      setPerson(null);
      setFetchProgress({ done: 0, total: 0 });
      try {
        const [personData, creditsData] = await Promise.all([
          tmdbGet(`/person/${id}`),
          tmdbGet(`/person/${id}/combined_credits`),
        ]);
        if (!active) return;
        setPerson(personData);

        let allMovies = [...(creditsData.cast || []), ...(creditsData.crew || [])]
          .filter(item => item.media_type === 'movie' && item.release_date && item.id)
          .reduce((acc, curr) => {
            if (!acc.find(movie => movie.id === curr.id)) acc.push(curr);
            return acc;
          }, [])
          .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        setMovies(allMovies);
        setFetchProgress({ done: 0, total: allMovies.length });
        setLoading(false);

        const results = [];
        for (let i = 0; i < allMovies.length; i += 8) {
          if (!active) return;
          const chunk = allMovies.slice(i, i + 8);
          const chunkResults = await Promise.allSettled(
            chunk.map(async movie => {
              const detail = await tmdbGet(`/movie/${movie.id}`);
              return { ...movie, revenue: detail.revenue || 0, budget: detail.budget || 0 };
            }),
          );
          results.push(...chunkResults.filter(item => item.status === 'fulfilled').map(item => item.value));
          if (!active) return;
          setMovies([...results].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)));
          setFetchProgress({ done: Math.min(i + chunk.length, allMovies.length), total: allMovies.length });
        }
      } catch {
        if (active) {
          setError('Failed to fetch box office data.');
          setLoading(false);
        }
      }
    };
    fetchFilmography();
    return () => { active = false; };
  }, [id]);

  const stats = useMemo(() => {
    const withRevenue = movies.filter(movie => typeof movie.revenue === 'number' && movie.revenue > 0);
    const total = withRevenue.reduce((sum, movie) => sum + movie.revenue, 0);
    const top = withRevenue[0] || null;
    return {
      counted: withRevenue.length,
      total,
      totalLabel: formatUsd(total) || '—',
      topTitle: top?.title || '—',
      topRevenue: formatUsd(top?.revenue) || '—',
      stillLoading: fetchProgress.total > 0 && fetchProgress.done < fetchProgress.total,
    };
  }, [movies, fetchProgress]);

  const topPosters = movies.filter(movie => movie.poster_path && movie.revenue > 0).slice(0, 14);
  const profileUrl = person?.profile_path ? tmdbImageUrl(person.profile_path, 'w500') : '/actor-placeholder.jpg';
  const backdropUrl = person?.profile_path ? tmdbImageUrl(person.profile_path, 'original') : '';

  return (
    <div className="md-page person-page">
      {backdropUrl ? (
        <div className="md-backdrop" style={{ backgroundImage: `url(${backdropUrl})` }} aria-hidden="true" />
      ) : null}
      <div className="md-backdrop-shade" aria-hidden="true" />
      <Navbar />

      <div className="md-shell">
        <div className="md-person-search">
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search another person…"
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            aria-label="Search person for box office"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="md-person-suggest" role="listbox">
              {suggestions.slice(0, 8).map(suggestion => (
                <button
                  key={suggestion.id}
                  type="button"
                  onMouseDown={() => handleSuggestionClick(suggestion.id)}
                >
                  {suggestion.profile_path ? (
                    <img src={tmdbImageUrl(suggestion.profile_path, 'w45')} alt="" />
                  ) : (
                    <span className="md-person-suggest-fallback">{(suggestion.name || '?')[0]}</span>
                  )}
                  <span>{suggestion.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="md-status" aria-live="polite">
            <div className="md-skeleton" style={{ height: 180, marginBottom: 12 }} />
            Loading box office…
          </div>
        )}
        {!loading && error && <p className="md-status is-error" role="alert">{error}</p>}

        {!loading && person && (
          <>
            <section className="md-hero" aria-label="Person box office">
              <div className="md-poster-col">
                <img className="md-poster" src={profileUrl} alt={person.name} />
              </div>
              <div className="md-hero-copy">
                <div className="md-hero-intro">
                  <h1 className="md-title">{person.name}</h1>
                  <p className="md-directed">
                    <span className="md-directed-label">Box office </span>
                    worldwide gross across credited films
                  </p>
                </div>

                <div className="md-person-stats" aria-label="Box office summary">
                  <div className="md-bo-card">
                    <span>Total gross</span>
                    <strong>{stats.totalLabel}</strong>
                    <small>{stats.counted} titles with reported revenue</small>
                  </div>
                  <div className="md-bo-card">
                    <span>Top earner</span>
                    <strong>{stats.topRevenue}</strong>
                    <small>{stats.topTitle}</small>
                  </div>
                  <div className="md-bo-card">
                    <span>Credits tracked</span>
                    <strong>{movies.length}</strong>
                    <small>
                      {stats.stillLoading
                        ? `Fetching ${fetchProgress.done}/${fetchProgress.total}…`
                        : 'TMDB worldwide revenue'}
                    </small>
                  </div>
                </div>

                <div className="md-hero-actions">
                  <Link to={`/person/${id}`} className="md-btn md-btn-ghost">
                    Person profile
                  </Link>
                  <Link to={`/person/${id}/filmography`} className="md-btn md-btn-ghost">
                    Filmography
                  </Link>
                </div>
              </div>
            </section>

            {topPosters.length > 0 && (
              <section className="md-section" aria-label="Highest grossing">
                <div className="md-section-head">
                  <div>
                    <h2>Highest Grossing</h2>
                    <p>Sorted by worldwide box office.</p>
                  </div>
                </div>
                <div className="md-poster-rail">
                  {topPosters.map(movie => (
                    <Link key={movie.id} to={`/movie/${movie.id}`} className="md-poster-card">
                      <img src={tmdbImageUrl(movie.poster_path, 'w342')} alt="" loading="lazy" />
                      <strong>{movie.title}</strong>
                      <span>{formatUsd(movie.revenue) || '—'}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="md-section" aria-label="Full box office list">
              <div className="md-section-head">
                <div>
                  <h2>All Titles</h2>
                  <p>Role and worldwide gross where TMDB reports it.</p>
                </div>
              </div>

              {movies.length === 0 ? (
                <p className="md-empty">No movie credits found.</p>
              ) : (
                <div className="md-bo-table-wrap">
                  <table className="md-bo-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Year</th>
                        <th>Role</th>
                        <th>Box office</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movies.map(movie => {
                        const amount = formatUsd(movie.revenue);
                        return (
                          <tr key={movie.id}>
                            <td>
                              <Link to={`/movie/${movie.id}`}>{movie.title || movie.original_title}</Link>
                            </td>
                            <td>{movie.release_date ? movie.release_date.slice(0, 4) : '—'}</td>
                            <td>{movie.character || movie.job || '—'}</td>
                            <td>
                              {amount ? (
                                <span className="md-bo-amount">{amount}</span>
                              ) : movie.revenue === 0 ? (
                                <span className="md-bo-amount is-pending">Unreported</span>
                              ) : (
                                <span className="md-bo-amount is-pending">Fetching…</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
