import mongoose from 'mongoose';

const mediumJournalSyncSchema = new mongoose.Schema({
  _id: { type: String, default: 'medium-journal' },
  status: { type: String, enum: ['idle', 'running', 'succeeded', 'failed'], default: 'idle' },
  lastAttemptAt: Date,
  lastSuccessfulSyncAt: Date,
  totalDiscovered: { type: Number, default: 0 },
  imported: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  duplicates: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  missingImages: { type: Number, default: 0 },
  missingMetadata: { type: Number, default: 0 },
  oldestArticleAt: Date,
  newestArticleAt: Date,
  continuationAvailable: { type: Boolean, default: false },
  message: { type: String, default: '' },
  leaseToken: String,
  leaseUntil: Date,
}, { timestamps: true, versionKey: false });

export default mongoose.model('MediumJournalSync', mediumJournalSyncSchema);
