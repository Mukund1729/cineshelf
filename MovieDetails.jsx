import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiCalendar, FiDollarSign, FiStar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchMovieDetails } from '../api/tmdb';

function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { data: movie, isLoading, error } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => fetchMovieDetails(id),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-[#0f1c2d]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen bg-[#0f1c2d]">
      <p className="text-white text-xl">Failed to load movie details</p>
    </div>
  );

  if (!movie) return (
    <div className="flex items-center justify-center h-screen bg-[#0f1c2d]">
      <p className="text-white text-xl">Movie not found</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#0f1c2d] min-h-screen p-4 md:p-8"
    >
      <motion.button 
        onClick={() => navigate(-1)}
        whileHover={{ x: -4 }}
        className="flex items-center text-cyan-400 mb-8 hover:text-cyan-300 transition"
      >
        <FiArrowLeft className="mr-2" /> Back to Movies
      </motion.button>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
        {/* Poster Column */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-1"
        >
          <img 
            src={movie.image || `https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="rounded-xl shadow-2xl w-full object-cover aspect-[2/3]"
            loading="lazy"
          />
        </motion.div>

        {/* Details Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="md:col-span-2 text-white"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{movie.title}</h1>
          
          {/* Rating and Metadata Row */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center bg-cyan-500/20 px-3 py-1 rounded-full">
              <FiStar className="mr-1 text-cyan-400" />
              <span>{movie.rating || movie.vote_average?.toFixed(1)}/10</span>
            </div>
            
            {movie.revenue && (
              <div className="flex items-center text-gray-300">
                <FiDollarSign className="mr-1" />
                <span>{movie.revenue}</span>
              </div>
            )}
            
            {movie.runtime && (
              <div className="flex items-center text-gray-300">
                <FiClock className="mr-1" />
                <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
              </div>
            )}
            
            {movie.releaseDate && (
              <div className="flex items-center text-gray-300">
                <FiCalendar className="mr-1" />
                <span>{new Date(movie.releaseDate).getFullYear()}</span>
              </div>
            )}
          </div>

          {/* Overview */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-2">Overview</h3>
            <p className="text-gray-300 leading-relaxed">
              {movie.overview || 'No overview available.'}
            </p>
          </div>

          {/* Additional Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {movie.genres?.length > 0 && (
              <div>
                <h4 className="text-gray-400 mb-2">Genres</h4>
                <div className="flex flex-wrap gap-2">
                  {movie.genres.map(genre => (
                    <span key={genre} className="px-3 py-1 bg-[#1f3a5f] rounded-full text-sm">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {movie.director && (
              <div>
                <h4 className="text-gray-400 mb-2">Director</h4>
                <p>{movie.director}</p>
              </div>
            )}

            {movie.cast?.length > 0 && (
              <div className="sm:col-span-2">
                <h4 className="text-gray-400 mb-2">Cast</h4>
                <div className="flex flex-wrap gap-4">
                  {movie.cast.slice(0, 5).map(actor => (
                    <div key={actor.id} className="flex items-center">
                      <img 
                        src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : '/actor-placeholder.jpg'} 
                        alt={actor.name}
                        className="w-10 h-10 rounded-full object-cover mr-2"
                      />
                      <span>{actor.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default MovieDetails;