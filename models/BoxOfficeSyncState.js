import mongoose from 'mongoose';

const boxOfficeSyncStateSchema = new mongoose.Schema({
  provider: { type: String, required: true, unique: true },
  lastAttemptAt: { type: Date, required: true },
  lastSuccessfulAt: { type: Date, default: null },
  lastErrorCode: { type: String, default: null },
  reportsImported: { type: Number, default: 0, min: 0 },
  lockOwner: { type: String, default: null },
  lockExpiresAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('BoxOfficeSyncState', boxOfficeSyncStateSchema);
