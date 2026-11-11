import React, { useState } from "react";

const ReviewBox = ({ reviews, showId }) => {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // TODO: Implement review submission logic
    setTimeout(() => {
      setSubmitting(false);
      setText("");
    }, 1000);
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg">
      <h3 className="text-cyan-400 font-bold mb-4">Write a Review</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          className="w-full rounded-lg p-3 bg-zinc-800 text-white border border-zinc-700 focus:ring-2 focus:ring-cyan-400"
          rows={4}
          placeholder="Share your thoughts..."
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={submitting}
        />
        <button
          type="submit"
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg transition"
          disabled={submitting || !text.trim()}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {error && <div className="text-red-400 mt-2">{error}</div>}
      </form>
      <div className="mt-6">
        <h4 className="text-cyan-300 font-semibold mb-2">Recent Reviews</h4>
        {reviews && reviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {reviews.slice(0, 3).map(r => (
              <div key={r.id} className="bg-zinc-800 rounded p-3 text-gray-200">
                <div className="text-sm font-semibold text-cyan-200 mb-1">{r.author}</div>
                <div className="text-sm">{r.content}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-gray-400">No reviews yet.</div>}
      </div>
    </div>
  );
};

export default ReviewBox;
