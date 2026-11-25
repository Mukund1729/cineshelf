import mongoose from 'mongoose';

// Uploaded community avatar / cover, stored the same way as UserAvatar and
// UserCover: one binary document per (community, kind).
const communityImageSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  kind: { type: String, enum: ['avatar', 'cover'], required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
});

communityImageSchema.index({ community: 1, kind: 1 }, { unique: true });

export default mongoose.model('CommunityImage', communityImageSchema);
