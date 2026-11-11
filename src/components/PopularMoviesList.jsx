import React, { useEffect, useState } from 'react';
import { getPopularMovies } from '../api/tmdb';

const PopularMoviesList = () => {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    getPopularMovies()
      .then(data => {
        console.log('Popular movies response:', data);
        // If getPopularMovies returns an object, use data.results
        setMovies(data.results || data);
      })
      .catch(error => {
        console.error('Failed to fetch popular movies:', error);
      });
  }, []);

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

export default PopularMoviesList;
