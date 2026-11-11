import React from "react";

const CrewList = ({ crew, production }) => {
  const directors = crew.filter(c => c.job === "Director");
  const writers = crew.filter(c => c.job === "Writer" || c.job === "Screenplay");
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div>
        <span className="text-cyan-300 font-semibold">Director:</span>{" "}
        {directors.length > 0 ? directors.map((d, i) => (
          <span key={d.id} className="text-white font-semibold">{d.name}{i < directors.length - 1 && ", "}</span>
        )) : <span className="text-gray-400">Not available</span>}
      </div>
      <div>
        <span className="text-cyan-300 font-semibold">Writers:</span>{" "}
        {writers.length > 0 ? writers.map((w, i) => (
          <span key={w.id} className="text-white font-semibold">{w.name}{i < writers.length - 1 && ", "}</span>
        )) : <span className="text-gray-400">Not available</span>}
      </div>
      <div>
        <span className="text-cyan-300 font-semibold">Production:</span>{" "}
        {production.length > 0 ? production.map((p, i) => (
          <span key={p.id} className="text-white font-semibold">{p.name}{i < production.length - 1 && ", "}</span>
        )) : <span className="text-gray-400">Not available</span>}
      </div>
    </div>
  );
};

export default CrewList;
