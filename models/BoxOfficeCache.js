import mongoose from 'mongoose';

const boxOfficeCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

boxOfficeCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
boxOfficeCacheSchema.index({ fetchedAt: 1 });

export default mongoose.model('BoxOfficeCache', boxOfficeCacheSchema);
