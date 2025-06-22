import { Link } from 'react-router-dom';

function MovieCard({ id, title, rating, image, releaseDate }) {
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
    <Link to={`/movie/${id}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0f1c2d] rounded-lg transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]">
      <div className="relative bg-[#0f1c2d] rounded-lg overflow-hidden shadow-lg h-full">
        {/* Movie Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <img 
            src={image || 'https://via.placeholder.com/300x450?text=No+Image'}
            alt={title}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Movie Info (Visible on hover) */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white font-bold text-lg mb-1 line-clamp-2">{title}</h3>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center">
              {renderStars()}
              <span className="ml-1 text-sm text-gray-300">{rating}</span>
            </div>
          </div>
          
          {releaseDate && (
            <p className="text-gray-300 text-sm">
              {new Date(releaseDate).getFullYear()}
            </p>
          )}
        </div>

        {/* Quick Info (Always visible) */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
          <h3 className="text-white font-semibold text-sm line-clamp-1">{title}</h3>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center">
              <span className="text-yellow-400 mr-1 text-sm">★</span>
              <span className="text-white text-xs">{rating}</span>
            </div>
            {releaseDate && (
              <span className="text-gray-300 text-xs">
                {new Date(releaseDate).getFullYear()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default MovieCard;