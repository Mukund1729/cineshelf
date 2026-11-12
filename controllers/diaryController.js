import mongoose from 'mongoose';
import DiaryEntry from '../models/DiaryEntry.js';

const parseWatchedAt = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

export const getDiaryEntries = async (req, res) => {
  try {
    const entries = await DiaryEntry.find({ user: req.user.id })
      .sort({ watchedAt: -1, createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: entries });
  } catch (err) {
    console.error('Get diary entries error:', err);
    res.status(500).json({ success: false, error: 'Could not load diary entries.' });
  }
};

export const createDiaryEntry = async (req, res) => {
  try {
    const {
      tmdbId,
      title,
      poster = '',
      mediaType = 'movie',
      watchedAt,
      rating,
      note = '',
    } = req.body;

    const parsedTmdbId = Number(tmdbId);
    const parsedDate = parseWatchedAt(watchedAt);
    const parsedRating = rating === '' || rating === undefined || rating === null
      ? undefined
      : Number(rating);

    if (!Number.isInteger(parsedTmdbId) || parsedTmdbId <= 0) {
      return res.status(400).json({ success: false, error: 'A valid movie or show is required.' });
    }
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }
    if (!parsedDate) {
      return res.status(400).json({ success: false, error: 'Enter a valid watched date.' });
    }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return res.status(400).json({ success: false, error: 'Media type must be movie or tv.' });
    }
    if (parsedRating !== undefined && (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 10)) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 10.' });
    }
    if (typeof note !== 'string' || note.length > 2000) {
      return res.status(400).json({ success: false, error: 'Note must be 2000 characters or fewer.' });
    }

    const update = {
      title: title.trim(),
      poster: typeof poster === 'string' ? poster.slice(0, 500) : '',
      mediaType,
      watchedAt: parsedDate,
    };
    if (parsedRating !== undefined) update.rating = parsedRating;
    if (note.trim()) update.note = note.trim();

    const entry = await DiaryEntry.findOneAndUpdate(
      { user: req.user.id, tmdbId: parsedTmdbId, watchedAt: parsedDate },
      { $set: update, $setOnInsert: { user: req.user.id, tmdbId: parsedTmdbId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: entry });
  } catch (err) {
    console.error('Create diary entry error:', err);
    res.status(500).json({ success: false, error: 'Could not save diary entry.' });
  }
};

export const deleteDiaryEntry = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid diary entry ID.' });
    }
    const entry = await DiaryEntry.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!entry) return res.status(404).json({ success: false, error: 'Diary entry not found.' });
    res.json({ success: true, message: 'Diary entry deleted.' });
  } catch (err) {
    console.error('Delete diary entry error:', err);
    res.status(500).json({ success: false, error: 'Could not delete diary entry.' });
  }
};
