import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// GET /api/review — Get current user's reviews
export const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews, count: reviews.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/review/user/:userId — Get a specific user's reviews (public)
export const getReviewsByUser = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.params.userId })
      .populate('user', 'username name avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews, count: reviews.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/review/movie/:tmdbId — Get all reviews for a movie
export const getReviewsByMovie = async (req, res) => {
  try {
    const reviews = await Review.find({ tmdbId: parseInt(req.params.tmdbId) })
      .populate('user', 'username name avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews, count: reviews.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/review — Add or update a review
export const addReview = async (req, res) => {
  try {
    const { tmdbId, title, poster, overview, rating, review, spoiler, mediaType } = req.body;
    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId is required' });

    // Upsert: create or update existing review for this user+movie
    const savedReview = await Review.findOneAndUpdate(
      { user: req.user.id, tmdbId: Number(tmdbId) },
      {
        $set: {
          title,
          poster,
          overview,
          rating: rating !== undefined ? Number(rating) : undefined,
          review: review || '',
          spoiler: spoiler || false,
          mediaType: mediaType || 'movie',
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: savedReview, message: 'Review saved' });
  } catch (err) {
    console.error('Review add error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// PUT /api/review/:id — Update own review
export const updateReview = async (req, res) => {
  try {
    const { rating, review, spoiler } = req.body;
    const updated = await Review.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { rating, review, spoiler } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Review not found' });
    res.json({ success: true, data: updated, message: 'Review updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// DELETE /api/review/:id — Delete own review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/review/:id/like — Like/unlike a review
export const likeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });

    const userId = req.user.id;
    const alreadyLiked = review.likes.some(id => id.toString() === userId);

    if (alreadyLiked) {
      review.likes = review.likes.filter(id => id.toString() !== userId);
    } else {
      review.likes.push(userId);
    }
    await review.save();
    res.json({ success: true, data: { likes: review.likes.length, liked: !alreadyLiked } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
