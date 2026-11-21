import mongoose from 'mongoose';

const communityCommentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true },
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityComment', default: null },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  spoiler: { type: Boolean, default: false },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: {
    clap: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    heart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
}, { timestamps: true });

communityCommentSchema.index({ post: 1, createdAt: 1 });
communityCommentSchema.index({ parent: 1, createdAt: 1 });

export default mongoose.model('CommunityComment', communityCommentSchema);
