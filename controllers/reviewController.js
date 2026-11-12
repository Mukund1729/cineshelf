import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import DiaryEntry from '../models/DiaryEntry.js';

const parseWatchedAt = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

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
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ success: false, error: 'A valid movie ID is required.' });
    }

    const reviews = await Review.find({ tmdbId, mediaType: { $ne: 'tv' } })
      .populate('user', 'username name avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews, count: reviews.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/review/:id — Get one public review
export const getReviewById = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID.' });
    }

    const review = await Review.findById(req.params.id)
      .populate('user', 'username name avatar');
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });

    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/review — Add or update a review
export const addReview = async (req, res) => {
  try {
    const { tmdbId, title, poster = '', overview, rating, review = '', spoiler, mediaType = 'movie' } = req.body;
    const watchedAt = parseWatchedAt(req.body.watchedAt || new Date().toISOString().slice(0, 10));
    const parsedRating = Number(rating);
    const reviewText = typeof review === 'string' ? review.trim() : '';
    if (!tmdbId || !Number.isInteger(Number(tmdbId)) || Number(tmdbId) <= 0) {
      return res.status(400).json({ success: false, error: 'A valid movie ID is required.' });
    }
    if (!watchedAt) return res.status(400).json({ success: false, error: 'Enter a valid watched date.' });
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 10) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 10.' });
    }
    if (reviewText.length > 2000) {
      return res.status(400).json({ success: false, error: 'Review must be 2000 characters or fewer.' });
    }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return res.status(400).json({ success: false, error: 'Media type must be movie or tv.' });
    }

    // Upsert: create or update existing review for this user+movie
    const savedReview = await Review.findOneAndUpdate(
      { user: req.user.id, tmdbId: Number(tmdbId) },
      {
        $set: {
          title: typeof title === 'string' ? title.trim() : '',
          poster: typeof poster === 'string' ? poster.slice(0, 500) : '',
          overview: typeof overview === 'string' ? overview : '',
          rating: parsedRating,
          review: reviewText,
          spoiler: Boolean(spoiler),
          mediaType,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );
    await savedReview.populate('user', 'username name avatar');

    try {
      const diaryUpdate = {
        title: typeof title === 'string' ? title.trim() : '',
        poster: typeof poster === 'string' ? poster.slice(0, 500) : '',
        mediaType,
        watchedAt,
        rating: parsedRating,
      };
      if (reviewText) diaryUpdate.note = reviewText;
      const diaryEntry = await DiaryEntry.findOneAndUpdate(
        { user: req.user.id, tmdbId: Number(tmdbId), watchedAt },
        { $set: diaryUpdate, $setOnInsert: { user: req.user.id, tmdbId: Number(tmdbId) } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      res.json({ success: true, data: savedReview, diaryEntry, message: 'Review saved to your profile and diary.' });
    } catch (diaryError) {
      console.error('Diary sync after review failed:', diaryError);
      res.status(500).json({ success: false, error: 'Review was saved, but the diary entry could not be saved.', data: savedReview });
    }
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
