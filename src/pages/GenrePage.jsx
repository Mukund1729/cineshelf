import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const getPoster = (path) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder.jpg";

export default function GenrePage() {
  const { genreId, genreName } = useParams();
  const [topRated, setTopRated] = useState([]);
  const [hiddenGems, setHiddenGems] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [providersByMovie, setProvidersByMovie] = useState({});

  useEffect(() => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    async function fetchAll() {
      // Top Rated
      const top = await axios.get(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=100`
      );
      setTopRated(top.data.results.slice(0, 12));
      // Hidden Gems
      const gems = await axios.get(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=10&vote_count.lte=100`
      );
      setHiddenGems(gems.data.results.slice(0, 12));
      // New Arrivals
      const arrivals = await axios.get(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genreId}&primary_release_date.gte=2024-01-01&sort_by=release_date.desc`
      );
      setNewArrivals(arrivals.data.results.slice(0, 12));
      // Providers for new arrivals
      const provs = {};
      await Promise.all(
        arrivals.data.results.slice(0, 12).map(async (movie) => {
          try {
            const provRes = await axios.get(
              `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`
            );
            const usProviders = provRes.data.results?.US?.flatrate || [];
            provs[movie.id] = usProviders.map((p) => p.provider_name);
          } catch {
            provs[movie.id] = [];
          }
        })
      );
      setProvidersByMovie(provs);
    }
    fetchAll();
  }, [genreId]);

  // Marquee/auto-scroll animation CSS
  const marqueeStyle = {
    display: 'flex',
    gap: '1.5rem',
    animation: 'marquee 30s linear infinite',
  };
  const marqueeKeyframes = `
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  `;

  return (
    <div className="container mx-auto px-4 py-10">
      <style>{marqueeKeyframes}</style>
      <h1 className="text-4xl font-bold font-playfair text-cyan-300 mb-8 text-center">{genreName} Movies</h1>
      {/* Top Rated */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-pink-400 mb-4">Top Rated</h2>
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent">
          {topRated.map((movie) => (
            <Link to={`/movie/${movie.id}`} key={movie.id} className="min-w-[120px] max-w-[120px] flex-shrink-0 bg-[#181c24] rounded-lg overflow-hidden shadow-md hover:scale-105 hover:shadow-pink-400 transition-transform duration-200 flex flex-col items-center relative">
              <img src={getPoster(movie.poster_path)} alt={movie.title} className="w-full h-40 object-cover rounded-t-lg" />
              <h4 className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{movie.title}</h4>
              <span className="text-pink-300 font-bold mb-2 text-[10px]">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
              <span className="absolute top-2 left-2 bg-pink-700/80 text-white text-xs px-2 py-1 rounded font-semibold shadow">Top Rated</span>
            </Link>
          ))}
        </div>
      </section>
      {/* Hidden Gems */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">Hidden Gems</h2>
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent">
          {hiddenGems.map((movie) => (
            <Link to={`/movie/${movie.id}`} key={movie.id} className="min-w-[120px] max-w-[120px] flex-shrink-0 bg-[#181c24] rounded-lg overflow-hidden shadow-md hover:scale-105 hover:shadow-yellow-400 transition-transform duration-200 flex flex-col items-center relative">
              <img src={getPoster(movie.poster_path)} alt={movie.title} className="w-full h-40 object-cover rounded-t-lg" />
              <h4 className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{movie.title}</h4>
              <span className="text-yellow-300 font-bold mb-2 text-[10px]">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
              <span className="absolute top-2 left-2 bg-yellow-700/80 text-white text-xs px-2 py-1 rounded font-semibold shadow">Hidden Gem</span>
            </Link>
          ))}
        </div>
      </section>
      {/* New Arrivals */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-green-400 mb-4">New Arrivals</h2>
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-[#232526] scrollbar-track-transparent">
          {newArrivals.map((movie) => (
            <Link to={`/movie/${movie.id}`} key={movie.id} className="min-w-[120px] max-w-[120px] flex-shrink-0 bg-[#181c24] rounded-lg overflow-hidden shadow-md hover:scale-105 hover:shadow-green-400 transition-transform duration-200 flex flex-col items-center relative">
              <img src={getPoster(movie.poster_path)} alt={movie.title} className="w-full h-40 object-cover rounded-t-lg" />
              <h4 className="text-white font-semibold text-xs text-center p-1 line-clamp-2 font-lato">{movie.title}</h4>
              <span className="text-green-300 font-bold mb-2 text-[10px]">⭐ {movie.vote_average?.toFixed(1) ?? 'N/A'}</span>
              <span className="absolute top-2 left-2 bg-green-700/80 text-white text-xs px-2 py-1 rounded font-semibold shadow">New Arrival</span>
              {providersByMovie[movie.id]?.length > 0 && (
                <div className="mt-1 text-xs text-cyan-200 font-semibold text-center">
                  {providersByMovie[movie.id].join(', ')}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
