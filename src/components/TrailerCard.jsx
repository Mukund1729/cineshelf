import React, { useState } from "react";

/**
 * TrailerCard component with embed fallback and cinematic thumbnail.
 * @param {string} trailerKey - YouTube video key (from TMDB)
 * @param {string} movieTitle - Movie title (for alt text and accessibility)
 */
export default function TrailerCard({ trailerKey, movieTitle }) {
  const [embedError, setEmbedError] = useState(false);

  if (!trailerKey) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-900 rounded-xl p-6">
        <p className="text-gray-300 mb-2">No trailer available.</p>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
            movieTitle + " trailer"
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 underline"
        >
          Search on YouTube
        </a>
      </div>
    );
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${trailerKey}`;
  const thumbnailUrl = `https://img.youtube.com/vi/${trailerKey}/hqdefault.jpg`;

  if (embedError) {
    return (
      <div
        className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-lg group cursor-pointer transition-transform duration-200 hover:scale-105 hover:opacity-90"
        onClick={() => window.open(youtubeUrl, "_blank")}
        tabIndex={0}
        role="button"
        aria-label={`Watch trailer for ${movieTitle} on YouTube`}
      >
        <img
          src={thumbnailUrl}
          alt={`Trailer thumbnail for ${movieTitle}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            className="drop-shadow-lg mb-3"
          >
            <circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.6)" />
            <polygon points="26,20 50,32 26,44" fill="#fff" />
          </svg>
          <span className="text-white text-lg font-bold bg-black/50 px-4 py-2 rounded-full">
            Watch Trailer on YouTube
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-lg group cursor-pointer">
      <iframe
        src={`https://www.youtube.com/embed/${trailerKey}`}
        title={`Trailer for ${movieTitle}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        frameBorder="0"
        className="w-full h-full rounded-xl"
        onError={() => setEmbedError(true)}
      ></iframe>
    </div>
  );
}
