import React from "react";

const EpisodeList = ({ seasons, episodesBySeason }) => {
  if (!seasons || seasons.length === 0) return <div className="text-gray-400">Not available.</div>;
  return (
    <div className="space-y-6">
      {seasons.map((season) => (
        <details key={season.id} className="bg-zinc-900 rounded-lg p-4 shadow-md">
          <summary className="font-bold text-cyan-300 cursor-pointer text-lg mb-2">
            {season.name} ({season.episode_count} episodes)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {episodesBySeason && episodesBySeason[season.season_number] && episodesBySeason[season.season_number].length > 0 ? (
              episodesBySeason[season.season_number].map((ep) => (
                <div key={ep.id} className="flex gap-4 items-center bg-zinc-800 rounded p-2">
                  <img
                    src={ep.still_path ? `https://image.tmdb.org/t/p/w185${ep.still_path}` : "/placeholder.jpg"}
                    alt={ep.name}
                    className="w-20 h-14 object-cover rounded"
                  />
                  <div>
                    <div className="font-semibold text-white">S{season.season_number}E{ep.episode_number}: {ep.name}</div>
                    <div className="text-xs text-gray-400">{ep.runtime ? `${ep.runtime} min` : "N/A"}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">{ep.overview || "No description."}</div>
                    {ep.air_date && <div className="text-xs text-cyan-300">Air date: {ep.air_date}</div>}
                  </div>
                </div>
              ))
            ) : <div className="text-gray-400">No episodes found.</div>}
          </div>
        </details>
      ))}
    </div>
  );
};

export default EpisodeList;
