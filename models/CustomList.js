import mongoose from 'mongoose';
const { Schema } = mongoose;

const listItemSchema = new Schema({
  tmdbId: { type: Number, required: true },
  title: { type: String, required: true },
  poster: String,
  overview: String,
  releaseDate: String,
  voteAverage: Number,
  mediaType: { type: String, enum: ['movie', 'tv'], default: 'movie' },
  addedAt: { type: Date, default: Date.now },
  order: { type: Number, default: 0 },
  note: { type: String, default: '' },
});

const customListSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  coverImage: { type: String, default: '' },
  isPublic: { type: Boolean, default: true },
  items: [listItemSchema],
  likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, {
  timestamps: true,
});

customListSchema.index({ user: 1, createdAt: -1 });
customListSchema.index({ isPublic: 1, createdAt: -1 });

export default mongoose.model('CustomList', customListSchema);
