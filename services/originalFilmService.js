import FilmPerson from '../models/FilmPerson.js';
import Movie from '../models/Movie.js';
import {
  getOriginalWatchlistEntries,
  mergeMissingOriginalWatchlistMovies,
  ORIGINAL_FILMS,
  ORIGINAL_PEOPLE,
} from '../data/originalFilms.js';

function toMovieSummary(movie) {
  return {
    id: movie.slug,
    tmdbId: movie.tmdbId,
    source: 'original',
    originalId: movie.slug,
    title: movie.title,
    overview: movie.overview,
    releaseYear: movie.releaseYear,
    release_date: null,
    poster_path: movie.posterPath,
    backdrop_path: movie.backdropPath,
    vote_average: null,
    genres: [],
  };
}

function toPersonCredit(credit) {
  const person = credit.person && typeof credit.person === 'object'
    ? credit.person
    : null;
  return {
    id: person?.slug || credit.personSlug,
    personSlug: person?.slug || credit.personSlug,
    name: person?.name || credit.name,
    job: credit.job || '',
    character: credit.character || '',
    profile_path: person?.profilePath || null,
  };
}

function toOriginalFilm(movie, related = []) {
  const cast = (movie.credits?.cast || []).map(toPersonCredit);
  const crew = (movie.credits?.crew || []).map(toPersonCredit);
  const specialThanks = (movie.credits?.specialThanks || []).map(toPersonCredit);
  const runtimeLabel = movie.runtimeSeconds == null
    ? null
    : `${Math.floor(movie.runtimeSeconds / 60)} min ${movie.runtimeSeconds % 60} sec`;

  return {
    id: movie.tmdbId,
    tmdbId: movie.tmdbId,
    source: 'original',
    slug: movie.slug,
    title: movie.title,
    original_title: movie.title,
    overview: movie.overview,
    tagline: movie.tagline || '',
    quote: movie.quote || null,
    releaseYear: movie.releaseYear || null,
    release_date: null,
    runtimeSeconds: movie.runtimeSeconds ?? null,
    runtimeLabel,
    poster_path: movie.posterPath || null,
    backdrop_path: movie.backdropPath || null,
    vote_average: null,
    vote_count: 0,
    genres: [],
    credits: { cast, crew },
    specialThanks,
    copyrightNotice: movie.copyrightNotice || null,
    watchUrl: movie.watchUrl || null,
    related,
  };
}

export async function seedOriginalFilms() {
  const peopleBySlug = new Map();
  for (const person of ORIGINAL_PEOPLE) {
    const set = {
      slug: person.slug,
      name: person.name,
      source: 'original',
      knownForDepartment: person.knownForDepartment,
      professions: person.professions,
    };
    if (person.biography) set.biography = person.biography;
    const savedPerson = await FilmPerson.findOneAndUpdate(
      { normalizedName: person.normalizedName },
      {
        $setOnInsert: { normalizedName: person.normalizedName },
        $set: set,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    peopleBySlug.set(person.slug, savedPerson);
  }

  const toStoredCredit = credit => {
    const person = peopleBySlug.get(credit.personSlug);
    if (!person) throw new Error(`Unknown original film credit: ${credit.personSlug}`);
    return {
      person: person._id,
      personSlug: person.slug,
      name: person.name,
      ...(credit.job ? { job: credit.job } : {}),
      ...(credit.character ? { character: credit.character } : {}),
    };
  };

  for (const film of ORIGINAL_FILMS) {
    const credits = {
      cast: film.credits.cast.map(toStoredCredit),
      crew: film.credits.crew.map(toStoredCredit),
      specialThanks: film.credits.specialThanks.map(personSlug => toStoredCredit({ personSlug, job: 'Special Thanks' })),
    };
    await Movie.updateOne(
      { source: 'original', slug: film.slug },
      {
        $set: {
          tmdbId: film.tmdbId,
          source: 'original',
          slug: film.slug,
          title: film.title,
          overview: film.overview,
          releaseYear: film.releaseYear,
          runtimeSeconds: film.runtimeSeconds,
          tagline: film.tagline,
          posterPath: film.posterPath,
          backdropPath: film.backdropPath,
          watchUrl: film.watchUrl,
          quote: film.quote || '',
          copyrightNotice: film.copyrightNotice || '',
          credits,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  return { movies: ORIGINAL_FILMS.length, people: ORIGINAL_PEOPLE.length };
}

export async function listOriginalFilms() {
  const movies = await Movie.find({ source: 'original' })
    .select('tmdbId slug title overview releaseYear posterPath backdropPath')
    .sort({ releaseYear: -1, title: 1 })
    .lean();
  return movies.map(toMovieSummary);
}

export async function getOriginalFilm(slug) {
  const movie = await Movie.findOne({ source: 'original', slug })
    .populate('credits.cast.person')
    .populate('credits.crew.person')
    .populate('credits.specialThanks.person')
    .lean();
  if (!movie) return null;
  const relatedMovies = await Movie.find({ source: 'original', slug: { $ne: slug } })
    .select('tmdbId slug title overview releaseYear posterPath backdropPath')
    .sort({ releaseYear: -1, title: 1 })
    .lean();
  return toOriginalFilm(movie, relatedMovies.map(toMovieSummary));
}

export async function searchOriginalFilmsAndPeople(query) {
  const value = typeof query === 'string' ? query.trim().slice(0, 80) : '';
  if (value.length < 2) return { results: [], people: [] };
  const matcher = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [movies, people] = await Promise.all([
    Movie.find({
      source: 'original',
      $or: [
        { title: matcher },
        { tagline: matcher },
        { 'credits.cast.name': matcher },
        { 'credits.crew.name': matcher },
        { 'credits.specialThanks.name': matcher },
      ],
    })
      .select('tmdbId slug title overview releaseYear posterPath backdropPath')
      .limit(10)
      .lean(),
    FilmPerson.find({ source: 'original', name: matcher })
      .select('slug name biography knownForDepartment profilePath')
      .limit(10)
      .lean(),
  ]);
  return {
    results: movies.map(toMovieSummary),
    people: people.map(person => ({
      id: person.slug,
      source: 'original',
      media_type: 'person',
      name: person.name,
      profile_path: person.profilePath || null,
      known_for_department: person.knownForDepartment,
      biography: person.biography || '',
    })),
  };
}

export async function getOriginalFilmPerson(slug) {
  const person = await FilmPerson.findOne({ source: 'original', slug }).lean();
  if (!person) return null;
  const movies = await Movie.find({
    source: 'original',
    $or: [
      { 'credits.cast.person': person._id },
      { 'credits.crew.person': person._id },
      { 'credits.specialThanks.person': person._id },
    ],
  })
    .select('slug title releaseYear posterPath backdropPath credits')
    .sort({ releaseYear: -1, title: 1 })
    .lean();

  const filmography = movies.map(movie => {
    const roles = [
      ...(movie.credits?.cast || [])
        .filter(credit => credit.person?.toString() === person._id.toString())
        .map(credit => credit.character || 'Cast'),
      ...(movie.credits?.crew || [])
        .filter(credit => credit.person?.toString() === person._id.toString())
        .map(credit => credit.job),
      ...(movie.credits?.specialThanks || [])
        .filter(credit => credit.person?.toString() === person._id.toString())
        .map(credit => credit.job || 'Special Thanks'),
    ].filter(Boolean);
    return {
      id: movie.slug,
      title: movie.title,
      releaseYear: movie.releaseYear || null,
      release_date: null,
      poster_path: movie.posterPath || null,
      role: [...new Set(roles)].join(', '),
      department: person.knownForDepartment,
      media_type: 'movie',
    };
  });

  return {
    id: person.slug,
    slug: person.slug,
    source: 'original',
    name: person.name,
    biography: person.biography || '',
    known_for_department: person.professions?.join(' · ') || person.knownForDepartment,
    profile_path: person.profilePath || null,
    movie_credits: { cast: filmography, crew: [] },
    filmography,
    professions: person.professions || [],
  };
}

export { getOriginalWatchlistEntries, mergeMissingOriginalWatchlistMovies };
