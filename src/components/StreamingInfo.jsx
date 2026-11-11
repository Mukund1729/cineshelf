import React from "react";

const StreamingInfo = ({ streaming, link }) => (
  <div className="bg-zinc-800 rounded-lg p-4">
    <h4 className="text-cyan-400 font-bold mb-2">Available on</h4>
    {streaming && streaming.length > 0 ? (
      <div className="flex gap-3 items-center flex-wrap">
        {streaming.map(s => (
          <a key={s.provider_id} href={link} target="_blank" rel="noopener noreferrer" title={s.provider_name}>
            <img src={`https://image.tmdb.org/t/p/w45${s.logo_path}`} alt={s.provider_name} className="w-10 h-10 rounded-full border-2 border-cyan-400 bg-white" />
          </a>
        ))}
      </div>
    ) : <div className="text-gray-400">Not available.</div>}
  </div>
);

export default StreamingInfo;
