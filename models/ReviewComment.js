import mongoose from 'mongoose';

const reviewCommentSchema = new mongoose.Schema({
  review: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 1000 },
}, {
  timestamps: true,
});

reviewCommentSchema.index({ review: 1, createdAt: -1 });

export default mongoose.model('ReviewComment', reviewCommentSchema);
