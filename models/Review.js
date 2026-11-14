
import mongoose from 'mongoose';
const { Schema } = mongoose;

const ReviewSchema = new Schema({
  user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tmdbId:    { type: Number, required: true },
  source:    { type: String, enum: ['tmdb', 'original'], default: 'tmdb' },
  originalId: { type: String },
  title:     { type: String },
  poster:    { type: String },
  overview:  { type: String },
  rating:    { type: Number, min: 0, max: 10 },
  review:    { type: String },
  spoiler:   { type: Boolean, default: false },
  mediaType: { type: String, enum: ['movie', 'tv'], default: 'movie' },
  likes:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, {
  timestamps: true,
});

// One review per user per movie/show
ReviewSchema.index({ user: 1, tmdbId: 1 }, { unique: true });
ReviewSchema.index({ tmdbId: 1, createdAt: -1 });

export default mongoose.model('Review', ReviewSchema);
