import mongoose from 'mongoose';

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 120 },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: true });

const communityPostSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['discussion', 'question', 'theory', 'poll', 'recommendation', 'image', 'announcement'],
    default: 'discussion',
  },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, required: true, trim: true, maxlength: 8000 },
  spoiler: { type: Boolean, default: false },
  images: [{ type: String, trim: true }],
  movie: {
    tmdbId: { type: Number, default: null },
    title: { type: String, default: '' },
    posterPath: { type: String, default: '' },
    backdropPath: { type: String, default: '' },
    releaseYear: { type: Number, default: null },
  },
  poll: {
    question: { type: String, default: '' },
    options: [pollOptionSchema],
    endsAt: { type: Date, default: null },
  },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: {
    clap: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    fire: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    think: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    heart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  commentCount: { type: Number, default: 0, min: 0 },
  bookmarkCount: { type: Number, default: 0, min: 0 },
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
}, { timestamps: true });

communityPostSchema.index({ community: 1, createdAt: -1 });
communityPostSchema.index({ author: 1, createdAt: -1 });
communityPostSchema.index({ 'movie.tmdbId': 1, createdAt: -1 });
communityPostSchema.index({ isPinned: -1, createdAt: -1 });
communityPostSchema.index({ title: 'text', body: 'text' });

export default mongoose.model('CommunityPost', communityPostSchema);
