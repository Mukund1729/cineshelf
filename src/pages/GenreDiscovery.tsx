"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";

const GENRES = [
  { name: "Drama", id: 18, color: "from-pink-900 via-pink-700 to-[#232526]" },
  { name: "Sci-Fi", id: 878, color: "from-cyan-900 via-blue-800 to-[#232526]" },
  { name: "Action", id: 28, color: "from-yellow-900 via-yellow-700 to-[#232526]" },
  { name: "Comedy", id: 35, color: "from-green-900 via-green-700 to-[#232526]" },
  { name: "Horror", id: 27, color: "from-purple-900 via-purple-700 to-[#232526]" },
  { name: "Romance", id: 10749, color: "from-red-900 via-pink-700 to-[#232526]" },
];

export default function GenreHighlights() {
  const [moviesByGenre, setMoviesByGenre] = useState({});

  useEffect(() => {
    const fetchGenreMovies = async () => {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;

      try {
        for (const genre of GENRES) {
          const res = await axios.get(
            `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genre.id}&sort_by=vote_average.desc&vote_count.gte=100`
          );

          setMoviesByGenre((prev) => ({
            ...prev,
            [genre.name]: res.data.results.slice(0, 3),
          }));
        }
      } catch (err) {
        console.error("Error fetching genre highlights:", err);
      }
    };

    fetchGenreMovies();
  }, []);

  const getPoster = (path) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder.jpg";

  return (
    <section className="container mx-auto px-4 my-20">
      <h2 className="text-3xl font-bold font-playfair text-cyan-300 mb-10">
        Browse by Genre
      </h2>

      <div className="grid gap-14">
        {GENRES.map((genre) => (
          <div key={genre.name}>
            <h3 className="text-xl font-semibold font-playfair text-cyan-100 mb-3">
              {genre.name}
            </h3>
            <div className="flex overflow-x-auto gap-6 pb-2">
              {(moviesByGenre[genre.name] || []).map((movie, idx) => (
                <div
                  key={idx}
                  className="min-w-[160px] max-w-[160px] bg-[#181c24] rounded-xl overflow-hidden shadow-xl flex flex-col items-center hover:scale-105 transition-transform duration-200 group relative"
                >
                  <img
                    src={getPoster(movie.poster_path)}
                    alt={movie.title}
                    className="w-full h-60 object-cover rounded-t-xl"
                  />
                  <h4 className="text-white font-medium text-sm text-center p-2 font-lato">
                    {movie.title}
                  </h4>
                  <span className="text-cyan-300 font-semibold mb-2 text-sm">
                    ⭐ {movie.vote_average}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
