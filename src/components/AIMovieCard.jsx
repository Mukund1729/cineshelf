import React from "react";

export default function AIMovieCard({ movie }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 shadow hover:scale-105 transition">
      <h2 className="text-xl font-bold mb-1">{movie.title}</h2>
      <p className="text-sm text-gray-400 mb-1">Directed by {movie.director} ({movie.year})</p>
      <p className="text-gray-300 text-sm mb-2">{movie.description}</p>
      <p className="text-xs text-cyan-400 mb-1">Moods: {movie.moods?.join(", ")}</p>
      <p className="text-xs text-purple-300">Styles: {movie.visual_styles?.join(", ")}</p>
    </div>
  );
}
