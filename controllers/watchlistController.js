import Watchlist from '../models/Watchlist.js';

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
    
    // Check if movie already exists
    const existingMovie = watchlist.movies.find(m => m.tmdbId === req.body.tmdbId);
    if (existingMovie) {
      return res.status(400).json({ error: 'Movie already in watchlist' });
    }
    
    // Normalize movie/TV show data to match schema
    const movieData = {
      tmdbId: req.body.tmdbId || req.body.id,
      title: req.body.title || req.body.name, // Handle both movie.title and TV show.name
      poster: req.body.poster || req.body.posterUrl || req.body.poster_path,
      posterUrl: req.body.posterUrl || req.body.poster_path || req.body.poster,
      overview: req.body.overview,
      releaseDate: req.body.releaseDate || req.body.release_date || req.body.first_air_date, // Handle TV show first_air_date
      voteAverage: req.body.voteAverage || req.body.vote_average,
      genreIds: req.body.genreIds || req.body.genre_ids,
      mediaType: req.body.mediaType || 'movie', // Add media type to distinguish movies from TV shows
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
    watchlist.movies = watchlist.movies.filter(m => m.tmdbId != req.params.tmdbId);
    await watchlist.save();
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
