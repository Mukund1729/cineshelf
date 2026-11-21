import mongoose from 'mongoose';

const communityMemberSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['owner', 'moderator', 'member'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'banned'],
    default: 'active',
  },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

communityMemberSchema.index({ community: 1, user: 1 }, { unique: true });
communityMemberSchema.index({ user: 1, status: 1, joinedAt: -1 });
communityMemberSchema.index({ community: 1, status: 1, role: 1 });

export default mongoose.model('CommunityMember', communityMemberSchema);
