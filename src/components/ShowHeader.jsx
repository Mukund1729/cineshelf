import React from "react";
import CrewList from "./CrewList";
import CastList from "./CastList";

const ShowHeader = ({ show }) => {
  if (!show) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start bg-zinc-900 rounded-xl p-6 shadow-lg">
      <div className="md:col-span-1 flex justify-center">
        <img
          src={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "/placeholder.jpg"}
          alt={show.name}
          className="rounded-xl shadow-lg w-64 object-cover aspect-[2/3] border-4 border-zinc-800 bg-zinc-800"
        />
      </div>
      <div className="md:col-span-2 flex flex-col gap-4">
        <h1 className="text-4xl font-bold font-playfair flex items-center mb-2">
          {show.name}
          {show.first_air_date && (
            <span className="text-cyan-400 text-2xl font-normal ml-2">
              ({show.first_air_date.split("-")[0]})
            </span>
          )}
        </h1>
        <div className="flex flex-wrap gap-2 text-sm text-gray-400 mb-2">
          {show.genres && show.genres.map(g => (
            <span key={g.id} className="bg-cyan-900/30 text-cyan-300 px-2 py-1 rounded-full font-semibold">{g.name}</span>
          ))}
          {show.episode_run_time && show.episode_run_time.length > 0 && (
            <span className="ml-2">{show.episode_run_time[0]} min</span>
          )}
          {show.first_air_date && (
            <span className="ml-2">{new Date(show.first_air_date).toLocaleDateString()}</span>
          )}
        </div>
        <p className="text-gray-200 text-base leading-relaxed">{show.overview || "No overview available."}</p>
        <CrewList crew={show.credits?.crew || []} production={show.production_companies || []} />
        <CastList cast={show.credits?.cast || []} />
      </div>
    </div>
  );
};

export default ShowHeader;
