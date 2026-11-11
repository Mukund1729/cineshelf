import React from "react";
import { Link } from "react-router-dom";

const CastList = ({ cast }) => {
  if (!cast || cast.length === 0) return <div className="text-gray-400">No cast info.</div>;
  return (
    <div className="flex flex-wrap gap-4 mt-2">
      {cast.slice(0, 12).map((actor) => (
        <Link to={`/person/${actor.id}`} key={actor.id} className="flex flex-col items-center group w-20">
          <img
            src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "/actor-placeholder.jpg"}
            alt={actor.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-cyan-400 group-hover:border-pink-400 transition duration-200 bg-zinc-800"
          />
          <span className="mt-2 text-cyan-200 group-hover:text-pink-300 font-bold text-xs text-center transition font-lato truncate w-full">
            {actor.name}
          </span>
        </Link>
      ))}
    </div>
  );
};

export default CastList;
