import React from "react";
import { Link } from "react-router-dom";

const RecommendationsGrid = ({ shows }) => {
  if (!shows || shows.length === 0) return <div className="text-gray-400">Not available.</div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {shows.map((show) => (
        <Link
          to={`/tv/${show.id}`}
          key={show.id}
          className="bg-[#181c24] rounded-xl overflow-hidden shadow-lg hover:scale-105 hover:shadow-cyan-400 transition-transform duration-200 flex flex-col items-center cursor-pointer"
        >
          <img
            src={show.poster_path ? `https://image.tmdb.org/t/p/w300${show.poster_path}` : "/placeholder.jpg"}
            alt={show.name || show.title}
            className="w-full h-48 object-cover rounded-t-xl"
          />
          <div className="p-2 text-center">
            <div className="text-white font-semibold text-sm truncate">{show.name || show.title}</div>
            {show.vote_average && (
              <div className="text-xs text-yellow-300">⭐ {show.vote_average.toFixed(1)}</div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
};

export default RecommendationsGrid;
