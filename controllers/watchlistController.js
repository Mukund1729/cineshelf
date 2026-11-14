import Watchlist from '../models/Watchlist.js';
import Movie from '../models/Movie.js';

export const getWatchlist = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({ user: req.user.id });
    res.json(watchlist || { movies: [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const addToWatchlist = async (req, res) => {
  try {
    console.log('Adding to watchlist:', req.body);
    
    let watchlist = await Watchlist.findOne({ user: req.user.id });
    if (!watchlist) {
      watchlist = new Watchlist({ user: req.user.id, movies: [] });
    }
    
    // Check whether this movie or TV show is already saved.
    const mediaType = req.body.mediaType || 'movie';
    if (req.body.source && !['tmdb', 'original'].includes(req.body.source)) {
      return res.status(400).json({ error: 'Invalid movie source.' });
    }
    const source = req.body.source === 'original' ? 'original' : 'tmdb';
    const tmdbId = Number(req.body.tmdbId || req.body.id);
    const originalId = source === 'original' ? String(req.body.originalId || '') : undefined;
    if (!Number.isSafeInteger(tmdbId) || (source === 'tmdb' && tmdbId <= 0)
      || (source === 'original' && mediaType !== 'movie')) {
      return res.status(400).json({ error: 'Invalid movie ID.' });
    }
    if (source === 'original') {
      const originalMovie = await Movie.findOne({
        tmdbId,
        source: 'original',
        slug: originalId,
      }).select('_id').lean();
      if (!originalMovie) return res.status(404).json({ error: 'Original film not found.' });
    }
    const existingMovie = watchlist.movies.find(m => (
      source === 'original'
        ? m.tmdbId === tmdbId || (m.source === 'original' && m.originalId === originalId)
        : m.tmdbId === tmdbId && (m.mediaType || 'movie') === mediaType
    ));
    if (existingMovie) {
      return res.status(400).json({
        error: mediaType === 'tv' ? 'TV show already in watchlist' : 'Movie already in watchlist',
      });
    }
    
    // Normalize movie/TV show data to match schema
    const movieData = {
      tmdbId,
      source,
      ...(originalId ? { originalId } : {}),
      title: req.body.title || req.body.name, // Handle both movie.title and TV show.name
      poster: req.body.poster || req.body.posterUrl || req.body.poster_path,
      posterUrl: req.body.posterUrl || req.body.poster_path || req.body.poster,
      overview: req.body.overview,
      releaseDate: req.body.releaseDate || req.body.release_date || req.body.first_air_date, // Handle TV show first_air_date
      voteAverage: req.body.voteAverage || req.body.vote_average,
      genreIds: req.body.genreIds || req.body.genre_ids,
      mediaType,
      addedAt: new Date()
    };
    
    console.log('Normalized movie data:', movieData);
    watchlist.movies.push(movieData);
    await watchlist.save();
    res.json(watchlist);
  } catch (err) {
    console.error('Watchlist add error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeFromWatchlist = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({ user: req.user.id });
    if (!watchlist) return res.status(404).json({ error: 'Watchlist not found' });
    const key = String(req.params.tmdbId);
    const original = key.match(/^original-([a-z0-9-]{1,80})$/);
    if (original) {
      watchlist.movies = watchlist.movies.filter(movie => !(
        movie.source === 'original' && movie.originalId === original[1]
      ));
    } else {
      const tmdbId = Number(key);
      if (!Number.isSafeInteger(tmdbId)) {
        return res.status(400).json({ error: 'Invalid movie ID.' });
      }
      watchlist.movies = watchlist.movies.filter(movie => movie.tmdbId !== tmdbId);
    }
    await watchlist.save();
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
