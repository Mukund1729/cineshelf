import React from "react";

// Placeholder for review form
const ReviewForm = ({ movieId }) => (
  <form className="mb-4 bg-gray-900 p-4 rounded-xl">
    <textarea className="w-full p-2 rounded bg-gray-800 text-white mb-2" rows={2} placeholder="Write your review..." disabled />
    <button type="button" className="bg-cyan-500 text-white px-4 py-2 rounded" disabled>Submit (Demo only)</button>
  </form>
);

export default ReviewForm;
