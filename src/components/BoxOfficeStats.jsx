import React from "react";

const BoxOfficeStats = ({ boxOffice, runtime }) => (
  <div className="bg-zinc-800 rounded-lg p-4">
    <h4 className="text-cyan-400 font-bold mb-2">Box Office & Runtime</h4>
    <div className="flex flex-col gap-2">
      <div><span className="font-semibold text-cyan-300">Runtime:</span> {runtime ? `${runtime} min` : "N/A"}</div>
      <div><span className="font-semibold text-cyan-300">Box Office:</span> {boxOffice ? boxOffice : "Not Available"}</div>
    </div>
  </div>
);

export default BoxOfficeStats;
