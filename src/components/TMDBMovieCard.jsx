import React from "react";
import { Link } from "react-router-dom";

export default function TMDBMovieCard({ movie }) {
  return (
    <Link
      to={`/movie/${movie.id}`}
      className="flex w-full max-w-2xl bg-[#18181b] rounded-xl shadow-lg overflow-hidden hover:scale-[1.025] transition-transform duration-150 group"
      style={{ minHeight: 180 }}
    >
      <img
        src={movie.poster}
        alt={movie.title}
        className="w-32 h-48 object-cover bg-gray-800 group-hover:opacity-90 transition-opacity duration-150"
        loading="lazy"
      />
      <div className="flex-1 flex flex-col justify-between p-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{movie.title} <span className="text-sm text-gray-400 font-normal">({movie.year})</span></h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {movie.genres?.map(g => (
              <span key={g} className="text-xs bg-[#b31313] text-white rounded px-2 py-0.5 font-semibold">{g}</span>
            ))}
          </div>
          <div className="text-sm text-gray-300 mb-1">{movie.cast?.slice(0, 3).join(", ")}</div>
          <div className="text-xs text-gray-400">{movie.runtime} min &bull; Rating: {movie.rating}</div>
        </div>
      </div>
    </Link>
  );
}
