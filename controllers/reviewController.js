import Review from '../models/Review.js';
import ReviewComment from '../models/ReviewComment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import DiaryEntry from '../models/DiaryEntry.js';
import Movie from '../models/Movie.js';

const parseWatchedAt = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
const isValidObjectId = value => /^[a-f\d]{24}$/i.test(value);

async function isOriginalMovieId(tmdbId) {
  return tmdbId < 0 && Boolean(await Movie.exists({ tmdbId, source: 'original' }));
}

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
    if (!Number.isSafeInteger(tmdbId) || (tmdbId <= 0 && !(await isOriginalMovieId(tmdbId)))) {
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

// GET /api/review/tv/:tmdbId — Get all reviews for a TV show
export const getReviewsByTv = async (req, res) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ success: false, error: 'A valid TV show ID is required.' });
    }

    const reviews = await Review.find({ tmdbId, mediaType: 'tv' })
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID.' });
    }

    const review = await Review.findById(req.params.id)
      .populate('user', 'username name avatar');
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });

    const [comments, commentCount] = await Promise.all([
      ReviewComment.find({ review: review._id })
        .populate('user', 'username name avatar')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      ReviewComment.countDocuments({ review: review._id }),
    ]);

    res.json({
      success: true,
      data: { ...review.toObject(), comments, commentCount },
    });
  } catch (err) {
    console.error('Get review error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/review/:id/comments — Add a comment and notify the review owner
export const addReviewComment = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID.' });
    }

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ success: false, error: 'Comment cannot be empty.' });
    if (text.length > 1000) {
      return res.status(400).json({ success: false, error: 'Comment must be 1000 characters or fewer.' });
    }

    const review = await Review.findById(req.params.id).select('user title');
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });

    const comment = await ReviewComment.create({
      review: review._id,
      user: req.user.id,
      text,
    });
    await comment.populate('user', 'username name avatar');

    if (review.user.toString() !== req.user.id) {
      const actor = await User.findById(req.user.id).select('username').lean();
      try {
        await Notification.create({
          user: review.user,
          type: 'review_comment',
          title: 'New comment on your review',
          message: `${actor?.username || 'Someone'} commented on your review of ${review.title || 'a title'}.`,
          data: { reviewId: review._id.toString(), commentId: comment._id.toString() },
          relatedId: review._id,
          fromUser: req.user.id,
          link: `/review/${review._id}`,
        });
      } catch (notificationError) {
        await comment.deleteOne();
        throw notificationError;
      }
    }

    res.status(201).json({
      success: true,
      data: comment,
      commentCount: await ReviewComment.countDocuments({ review: review._id }),
    });
  } catch (err) {
    console.error('Add review comment error:', err);
    res.status(500).json({ success: false, error: 'Could not post comment.' });
  }
};

// POST /api/review — Add or update a review
export const addReview = async (req, res) => {
  try {
    const {
      tmdbId,
      source = 'tmdb',
      originalId,
      title,
      poster = '',
      overview,
      rating,
      review = '',
      spoiler,
      mediaType = 'movie',
    } = req.body;
    const parsedTmdbId = Number(tmdbId);
    const watchedAt = parseWatchedAt(req.body.watchedAt || new Date().toISOString().slice(0, 10));
    const parsedRating = Number(rating);
    const reviewText = typeof review === 'string' ? review.trim() : '';
    if (!Number.isSafeInteger(parsedTmdbId)
      || (source === 'tmdb' && parsedTmdbId <= 0)
      || (source !== 'tmdb' && source !== 'original')) {
      return res.status(400).json({ success: false, error: 'A valid movie or TV show ID is required.' });
    }
    if (source === 'original' && (
      mediaType !== 'movie'
      || !/^[a-z0-9-]{1,80}$/.test(originalId || '')
      || !(await Movie.exists({ tmdbId: parsedTmdbId, source: 'original', slug: originalId }))
    )) {
      return res.status(400).json({ success: false, error: 'A valid original film is required.' });
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

    // Upsert: create or update the user's review for this title
    const savedReview = await Review.findOneAndUpdate(
      { user: req.user.id, tmdbId: parsedTmdbId },
      {
        $set: {
          source,
          originalId: source === 'original' ? originalId : undefined,
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
        source,
        originalId: source === 'original' ? originalId : undefined,
        watchedAt,
        rating: parsedRating,
      };
      if (reviewText) diaryUpdate.note = reviewText;
      const diaryEntry = await DiaryEntry.findOneAndUpdate(
        { user: req.user.id, tmdbId: parsedTmdbId, mediaType, watchedAt },
        { $set: diaryUpdate, $setOnInsert: { user: req.user.id, tmdbId: parsedTmdbId } },
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID.' });
    }

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

    if (!alreadyLiked && review.user.toString() !== userId) {
      const actor = await User.findById(userId).select('username').lean();
      try {
        await Notification.create({
          user: review.user,
          type: 'review_like',
          title: 'Someone liked your review',
          message: `${actor?.username || 'Someone'} liked your review of ${review.title || 'a title'}.`,
          data: { reviewId: review._id.toString() },
          relatedId: review._id,
          fromUser: userId,
          link: `/review/${review._id}`,
        });
      } catch (notificationError) {
        await Review.updateOne({ _id: review._id }, { $pull: { likes: userId } });
        throw notificationError;
      }
    }

    res.json({ success: true, data: { likes: review.likes.length, liked: !alreadyLiked } });
  } catch (err) {
    console.error('Toggle review like error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
