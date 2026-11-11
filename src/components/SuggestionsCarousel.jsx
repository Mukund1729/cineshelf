import React from "react";
import { Link } from "react-router-dom";

const SuggestionsCarousel = ({ title, items, type }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg">
      <h3 className="text-2xl font-bold text-cyan-400 mb-4 font-playfair">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map(item => (
          <Link
            key={item.id}
            to={type === "actor" ? `/movie/${item.id}` : `/tv/${item.id}`}
            className="flex-shrink-0 w-36 group hover:scale-105 transition-transform duration-200"
          >
            <div className="rounded-lg overflow-hidden shadow-md border-2 border-transparent group-hover:border-cyan-400 bg-zinc-800">
              <img
                src={item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : "/placeholder.jpg"}
                alt={item.title || item.name}
                className="w-full h-52 object-cover"
              />
            </div>
            <div className="mt-2 text-sm text-center text-gray-200 font-semibold truncate px-1 font-lato">
              {item.title || item.name}
            </div>
            {item.first_air_date && (
              <div className="text-xs text-cyan-300 text-center">{item.first_air_date.split("-")[0]}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SuggestionsCarousel;
