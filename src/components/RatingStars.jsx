import React from "react";

// Placeholder for movie rating stars
const RatingStars = ({ movieId }) => (
  <div className="flex items-center gap-1">
    {[1,2,3,4,5].map(n => (
      <span key={n} className="text-yellow-400 text-xl">★</span>
    ))}
    <span className="ml-2 text-gray-400 text-sm">(Demo only)</span>
  </div>
);

export default RatingStars;
