import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';
import './movie-detail.css';
import './person-detail.css';

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const isOriginalPerson = !/^\d+$/.test(id || '');

  useEffect(() => {
    let active = true;
    async function fetchPerson() {
      setLoading(true);
      setError(null);
      setPerson(null);
      setBioExpanded(false);
      try {
        const data = isOriginalPerson
          ? (await axios.get(`/api/original-films/people/${encodeURIComponent(id)}`)).data?.data
          : await tmdbGet(`/person/${id}`, { append_to_response: 'movie_credits,tv_credits,images' });
        if (!active) return;
        if (!data) throw new Error('Person was not found.');
        setPerson(data);
      } catch {
        if (active) setError('Could not load person details.');
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchPerson();
    return () => { active = false; };
  }, [id, isOriginalPerson]);

  const knownFor = (person?.movie_credits?.cast || [])
    .filter(movie => movie.poster_path)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12);

  const biography = person?.biography || 'No biography available.';
  const bioNeedsToggle = biography.length > 420;
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
        {loading && (
          <div className="md-status" aria-live="polite">
            <div className="md-skeleton" style={{ height: 220, marginBottom: 12 }} />
            Loading person…
          </div>
        )}
        {!loading && error && <p className="md-status is-error" role="alert">{error}</p>}

        {!loading && person && (
          <>
            <section className="md-hero" aria-label="Person introduction">
              <div className="md-poster-col">
                <img className="md-poster" src={profileUrl} alt={person.name} />
              </div>

              <div className="md-hero-copy">
                <div className="md-hero-intro">
                  <h1 className="md-title">{person.name}</h1>
                  {person.known_for_department ? (
                    <p className="md-directed">
                      <span className="md-directed-label">Known for </span>
                      {person.known_for_department}
                    </p>
                  ) : null}
                </div>

                {!isOriginalPerson && (person.birthday || person.place_of_birth) && (
                  <div className="md-meta">
                    {person.birthday ? <span>Born {new Date(`${person.birthday}T00:00:00`).toLocaleDateString()}</span> : null}
                    {person.deathday ? <span>Died {new Date(`${person.deathday}T00:00:00`).toLocaleDateString()}</span> : null}
                    {person.place_of_birth ? <span>{person.place_of_birth}</span> : null}
                  </div>
                )}

                <p className={`md-bio${bioNeedsToggle && !bioExpanded ? ' is-clamped' : ''}`}>{biography}</p>
                {bioNeedsToggle && (
                  <button type="button" className="md-readmore" onClick={() => setBioExpanded(current => !current)}>
                    {bioExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}

                <div className="md-hero-actions">
                  {!isOriginalPerson && (
                    <>
                      <Link to={`/person/${id}/filmography`} className="md-btn md-btn-ghost">
                        Full Filmography
                      </Link>
                      <Link to={`/person/${id}/boxoffice`} className="md-btn md-btn-accent">
                        Box Office
                      </Link>
                    </>
                  )}
                  {person.homepage && (
                    <a className="md-btn md-btn-ghost" href={person.homepage} target="_blank" rel="noopener noreferrer">
                      Official site
                    </a>
                  )}
                </div>
              </div>
            </section>

            {knownFor.length > 0 && (
              <section className="md-section" aria-label="Known for">
                <div className="md-section-head">
                  <div>
                    <h2>Known For</h2>
                    <p>Popular titles from their filmography.</p>
                  </div>
                </div>
                <div className="md-poster-rail">
                  {knownFor.map(movie => (
                    <Link key={movie.id} to={`/movie/${movie.id}`} className="md-poster-card">
                      <img src={tmdbImageUrl(movie.poster_path, 'w342')} alt="" loading="lazy" />
                      <strong>{movie.title}</strong>
                      <span>
                        {movie.release_date ? movie.release_date.slice(0, 4) : '—'}
                        {movie.character ? ` · ${movie.character}` : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {isOriginalPerson && person.filmography?.length > 0 && (
              <section className="md-section" aria-label="Filmography">
                <div className="md-section-head">
                  <div>
                    <h2>Filmography</h2>
                    <p>Credits on original Visual.Cineaste titles.</p>
                  </div>
                </div>
                <div className="md-film-list">
                  {person.filmography.map(film => (
                    <Link to={`/movie/${film.id}`} key={film.id} className="md-film-list-item">
                      <img
                        src={film.poster_path ? tmdbImageUrl(film.poster_path, 'w92') : '/placeholder.jpg'}
                        alt=""
                      />
                      <span>
                        <strong>{film.title}</strong>
                        <span>{[film.releaseYear, film.role].filter(Boolean).join(' · ')}</span>
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
}
