import React, { useRef, useState } from "react";

/**
 * Safe YouTube trailer embed with fallback link and cinematic thumbnail.
 * @param {string} trailerUrl - Full YouTube URL (embed or watch) or just the video key.
 * @param {string} movieTitle - Movie title for fallback search.
 */
export default function TrailerEmbed({ trailerUrl, movieTitle }) {
  const [embedError, setEmbedError] = useState(false);
  const iframeRef = useRef(null);

  // Accepts either a full URL or just a YouTube video key
  let videoId = null;
  if (trailerUrl) {
    // If just a key (11 chars), use it directly
    if (/^[\w-]{11}$/.test(trailerUrl)) {
      videoId = trailerUrl;
    } else {
      // Try to extract from URL
      const match = trailerUrl.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{11})/);
      videoId = match ? match[1] : null;
    }
  }

  if (!videoId) {
    return (
      <div>
        <p>No trailer available.{' '}
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(movieTitle + ' trailer')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 underline"
          >
            Search on YouTube
          </a>
        </p>
      </div>
    );
  }

  if (embedError) {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    return (
      <div
        className="relative rounded-xl overflow-hidden shadow-xl border-2 border-cyan-900/40 bg-black/30 backdrop-blur-md group cursor-pointer transition-transform duration-200 hover:scale-105 hover:opacity-90"
        onClick={() => window.open(youtubeUrl, '_blank')}
        tabIndex={0}
        role="button"
        aria-label="Watch Trailer on YouTube"
      >
        <img src={thumbnailUrl} alt="YouTube Trailer Thumbnail" className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white opacity-90 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          <span className="text-white text-lg font-bold bg-black/50 px-4 py-2 rounded-full">Watch Trailer on YouTube</span>
        </div>
      </div>
    );
  }

  return (
    <div className="trailer mb-8">
      <h3 className="text-xl font-semibold mb-2">🎬 Trailer</h3>
      <div className="aspect-video w-full max-w-2xl mb-4">
        <iframe
          ref={iframeRef}
          width="100%"
          height="315"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube trailer"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-presentation"
          className="rounded-xl w-full h-full"
          onError={() => setEmbedError(true)}
        />
      </div>
      <div className="text-xs text-gray-400 mt-2">
        If the trailer does not play,{' '}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 underline"
        >
          watch on YouTube
        </a>.
      </div>
    </div>
  );
}
