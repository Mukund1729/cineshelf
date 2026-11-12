import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
}, {
  timestamps: true,
});

chatMessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
chatMessageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });

export default mongoose.model('ChatMessage', chatMessageSchema);
