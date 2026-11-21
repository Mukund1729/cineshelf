import mongoose from 'mongoose';

const communityBookmarkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true },
}, { timestamps: true });

communityBookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
communityBookmarkSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('CommunityBookmark', communityBookmarkSchema);
