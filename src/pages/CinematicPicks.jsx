import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { tmdbImageUrl } from '../api/tmdb';

function FilmCard({ film }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111722] shadow-xl transition hover:-translate-y-1 hover:border-cyan-500/40">
      <Link to={`/movie/${film.id}`} className="relative block aspect-[16/10] overflow-hidden">
        <img
          src={tmdbImageUrl(film.poster_path, 'w780')}
          alt={`${film.title} poster`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080b11] via-black/10 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/85 backdrop-blur">
          Visual Cineaste Original
        </span>
        <h3 className="absolute bottom-4 left-5 font-playfair text-3xl font-bold text-white">{film.title}</h3>
      </Link>
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.12em] text-gray-400">
          <span>{film.releaseYear}</span>
          {film.runtimeLabel && <span>{film.runtimeLabel}</span>}
        </div>
        {film.tagline && <p className="font-playfair text-lg italic text-cyan-100">{film.tagline}</p>}
        <p className="line-clamp-4 text-sm leading-7 text-gray-300">{film.overview}</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link to={`/movie/${film.id}`} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
            Film details
          </Link>
          {film.watchUrl && (
            <a href={film.watchUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-red-400/60 hover:text-white">
              Watch on YouTube ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CinematicPicks() {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axios.get('/api/original-films')
      .then(response => {
        if (active) setFilms(Array.isArray(response.data?.results) ? response.data.results : []);
      })
      .catch(() => {
        if (active) setError('Could not load the curated films. Please try again later.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const featuredFilm = films[0];

  return (
    <div className="min-h-screen bg-[#080b11] text-[#f5f0e8]">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden border-b border-white/10">
          {featuredFilm?.backdrop_path && (
            <img
              src={tmdbImageUrl(featuredFilm.backdrop_path, 'w1280')}
              alt=""
              className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25"
            />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#080b11] via-[#080b11]/90 to-[#080b11]/60" />
          <div className="mx-auto flex min-h-[430px] max-w-7xl flex-col justify-end px-5 pb-12 pt-28 md:min-h-[520px] md:px-10 md:pb-16">
            <span className="mb-5 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">A Visual Cineaste collection</span>
            <p className="mb-3 font-playfair text-sm italic tracking-wide text-white/55">Selected with intention</p>
            <h1 className="max-w-3xl font-playfair text-5xl font-bold tracking-tight md:text-7xl">Cinematic Picks</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-gray-300 md:text-lg">
              Original short films by Mukund Mangal. Two intimate stories, gathered here in one place.
            </p>
            {featuredFilm && (
              <Link to={`/movie/${featuredFilm.id}`} className="mt-7 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/50 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300 hover:text-slate-950">
                Explore the featured film <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <div className="pointer-events-none absolute bottom-0 right-[8%] top-0 hidden w-[25%] bg-gradient-to-l from-[#080b11]/70 to-transparent md:block" />
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">The collection</span>
              <h2 className="mt-2 font-playfair text-3xl font-bold md:text-4xl">Stories worth sitting with</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-gray-400">
              Browse each film for its cast, crew, runtime, reviews and viewing link.
            </p>
          </div>

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[0, 1].map(item => <div key={item} className="vc-skeleton aspect-[16/10] rounded-2xl" />)}
            </div>
          ) : error ? (
            <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-5 text-red-200">{error}</p>
          ) : films.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {films.map(film => <FilmCard key={film.id} film={film} />)}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 p-5 text-gray-300">No curated films are available yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
