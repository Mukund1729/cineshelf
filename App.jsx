import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './pages/HomePage';
import MovieDetail from './pages/MovieDetails';
import SearchBar from './components/SearchBar';
import { fetchMovieDetails } from './api/tmdb';

function AppWrapper() {
  const [movies, setMovies] = useState([]);
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (movies.length === 1) {
      navigate(`/movie/${movies[0].id}`);
    }
  };

  const handleSearchChange = async (query) => {
    if (!query) {
      setMovies([]);
      return;
    }

    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${query}&api_key=${import.meta.env.VITE_TMDB_KEY}`);
      const data = await res.json();
      setMovies(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setMovies([]);
    }
  };

  return (
    <div>
      <SearchBar
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        results={movies}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movie/:id" element={<MovieDetail />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}
