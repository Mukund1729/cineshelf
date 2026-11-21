import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  description: { type: String, required: true, trim: true, maxlength: 600 },
  category: {
    type: String,
    required: true,
    enum: [
      'auteur',
      'genre',
      'regional',
      'theory',
      'anime',
      'midnight',
      'general',
    ],
    default: 'general',
  },
  coverImage: { type: String, default: '' },
  avatar: { type: String, default: '' },
  rules: [{ type: String, trim: true, maxlength: 300 }],
  privacy: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public',
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberCount: { type: Number, default: 1, min: 0 },
  discussionCount: { type: Number, default: 0, min: 0 },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

communitySchema.index({ isFeatured: 1, memberCount: -1 });
communitySchema.index({ lastActivityAt: -1 });
communitySchema.index({ category: 1, memberCount: -1 });
communitySchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Community', communitySchema);
