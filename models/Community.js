import mongoose from 'mongoose';
import { ALL_COMMUNITY_CATEGORY_KEYS, COMMUNITY_LIMITS } from '../data/communityOptions.js';

// Structured rule. `rules` (plain strings) is the original field and is kept in
// sync with the rule titles so older readers keep working.
const communityRuleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: COMMUNITY_LIMITS.ruleTitleMax },
  body: { type: String, trim: true, maxlength: COMMUNITY_LIMITS.ruleBodyMax, default: '' },
});

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
  // Optional one-line pitch shown on cards. Older communities default to ''.
  tagline: { type: String, trim: true, maxlength: COMMUNITY_LIMITS.taglineMax, default: '' },
  // "About" text. Limit raised from 600 so longer descriptions are possible;
  // every existing value remains valid.
  description: { type: String, required: true, trim: true, maxlength: COMMUNITY_LIMITS.descriptionMax },
  category: {
    type: String,
    required: true,
    // Original keys first, followed by the categories added with the setup flow.
    enum: ALL_COMMUNITY_CATEGORY_KEYS,
    default: 'general',
  },
  // Optional topic tags. Older communities default to [].
  topics: [{ type: String, trim: true, lowercase: true, maxlength: COMMUNITY_LIMITS.topicMax }],
  coverImage: { type: String, default: '' },
  avatar: { type: String, default: '' },
  rules: [{ type: String, trim: true, maxlength: 300 }],
  ruleItems: [communityRuleSchema],
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
