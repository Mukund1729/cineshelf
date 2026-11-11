import React, { useEffect, useState } from 'react';
import { getPopularMovies } from '../api/tmdb';

const PopularMoviesDebug = () => {
  const [movies, setMovies] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const data = await getPopularMovies();
        console.log('Popular movies response:', data);
        setMovies(data.results || data);
      } catch (err) {
        console.error('Failed to fetch popular movies:', err);
        setError('Failed to load movies');
      }
    };
    fetchMovies();
  }, []);

  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!movies) return <div>Loading popular movies...</div>;

  return (
    <div>
      <h2>Popular Movies</h2>
      <ul>
        {movies.map(movie => (
          <li key={movie.id}>{movie.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default PopularMoviesDebug;
