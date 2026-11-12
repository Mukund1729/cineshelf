import mongoose from 'mongoose';

const diaryEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tmdbId: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  poster: { type: String, default: '' },
  mediaType: { type: String, enum: ['movie', 'tv'], default: 'movie' },
  watchedAt: { type: Date, required: true },
  rating: { type: Number, min: 1, max: 10 },
  note: { type: String, trim: true, maxlength: 2000, default: '' },
}, {
  timestamps: true,
});

diaryEntrySchema.index({ user: 1, watchedAt: -1, createdAt: -1 });

export default mongoose.model('DiaryEntry', diaryEntrySchema);
