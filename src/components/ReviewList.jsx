import React from "react";
import RatingStars from "./RatingStars";

const ReviewList = ({ reviews }) => {
  if (!reviews || reviews.length === 0) return <div className="text-gray-400">No reviews yet.</div>;
  return (
    <div className="space-y-4">
      {reviews.slice(0, 3).map((review, idx) => (
        <div key={idx} className="bg-[#181c24] rounded-lg p-4 shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-cyan-300">{review.author || "Anonymous"}</span>
            <RatingStars rating={review.rating || review.author_details?.rating || 0} />
          </div>
          <div className="text-gray-200 text-sm">{review.content}</div>
        </div>
      ))}
    </div>
  );
};

export default ReviewList;
