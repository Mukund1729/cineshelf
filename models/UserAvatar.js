import mongoose from 'mongoose';

const userAvatarSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], required: true },
}, {
  timestamps: true,
});

export default mongoose.model('UserAvatar', userAvatarSchema);
