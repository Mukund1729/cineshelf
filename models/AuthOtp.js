import mongoose from 'mongoose';

const authOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  purpose: { type: String, enum: ['verification', 'login', 'reset'], required: true },
  attempts: { type: Number, default: 0, min: 0, max: 5 },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
});

authOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });
authOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AuthOtp', authOtpSchema);
