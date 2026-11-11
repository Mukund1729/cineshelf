import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWatchProviders } from '../api/tmdb';

function MovieCard({ id, title, rating, image, releaseDate, genres = [] }) {
  // Streaming provider state
  const [providers, setProviders] = useState([]);
  const [ottLink, setOttLink] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchWatchProviders(id, 'IN').then(res => {
      if (!mounted) return;
      if (res.providers && res.providers.length > 0 && res.link) {
        setProviders(res.providers);
        setOttLink(res.link);
      } else {
        setProviders([]);
        setOttLink(null);
      }
    });
    return () => { mounted = false; };
  }, [id]);

  // Convert rating to star display (0-5 stars)
  const renderStars = () => {
    const stars = [];
    const normalizedRating = Math.min(Math.max(parseFloat(rating) / 2, 0), 5);
    const fullStars = Math.floor(normalizedRating);
    const hasHalfStar = normalizedRating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<span key={i} className="text-yellow-400">★</span>);
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<span key={i} className="text-yellow-400">½</span>);
      } else {
        stars.push(<span key={i} className="text-gray-500">★</span>);
      }
    }

    return stars;
  };

  return (
    <Link to={`/movie/${id}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#232526] rounded-xl transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]">
      <div className="relative bg-gradient-to-br from-[#232526] via-[#414345] to-[#181818] rounded-xl overflow-hidden shadow-2xl h-full">
        {/* Movie Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <img 
            src={
              image && image !== 'null' && image !== 'undefined'
                ? image.startsWith('http')
                  ? image
                  : `https://image.tmdb.org/t/p/w500${image}`
                : 'https://via.placeholder.com/300x450?text=No+Image'
            }
            alt={title}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
            onError={e => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300x450?text=No+Image'; }}
          />
          {/* Glassmorphism Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-pink-400/10 to-cyan-400/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        </div>

        {/* Movie Info (Visible on hover) */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="mb-2 flex flex-wrap gap-1">
            {/* Genre tags (placeholder) */}
            {(genres.length ? genres : ['Action', 'Drama']).map((genre, idx) => (
              <span key={idx} className="bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400 text-gray-900 text-xs px-2 py-0.5 rounded-full shadow-sm mr-1 mb-1 font-semibold">
                {genre}
              </span>
            ))}
          </div>
          <h3 className="text-white font-bold text-lg mb-1 line-clamp-2 drop-shadow-lg">{title}</h3>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center">
              {renderStars()}
              <span className="ml-1 text-sm text-yellow-300 font-semibold">{rating}</span>
            </div>
            {releaseDate && (
              <span className="text-pink-300 text-xs ml-3 font-semibold">{new Date(releaseDate).getFullYear()}</span>
            )}
          </div>
        </div>

        {/* Quick Info (Always visible) */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent rounded-b-xl flex items-end justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm line-clamp-1 drop-shadow-md">{title}</h3>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center">
                <span className="text-yellow-400 mr-1 text-sm">★</span>
                <span className="text-white text-xs font-semibold">{rating}</span>
              </div>
              {releaseDate && (
                <span className="text-cyan-200 text-xs">
                  {new Date(releaseDate).getFullYear()}
                </span>
              )}
            </div>
          </div>
          {/* Streaming Provider Pills */}
          {providers && ottLink && providers.length > 0 && (
            <div className="flex gap-2 ml-2">
              {providers.map(p => (
                <a
                  key={p.provider_id}
                  href={ottLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-purple-700 via-fuchsia-700 to-cyan-700 hover:bg-opacity-80 hover:underline text-white text-xs rounded-full px-3 py-1 flex items-center gap-2 shadow-md font-semibold tracking-wide platform-button focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  title={`Watch on ${p.provider_name}`}
                  onClick={e => e.stopPropagation()}
                >
                  {p.logo_path && (
                    <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} className="w-5 h-5 rounded-full bg-white mr-1" />
                  )}
                  {p.provider_name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default MovieCard;