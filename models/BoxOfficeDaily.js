import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema({
  dailyCollection: Number,
  cumulativeCollection: Number,
  sourceReportedValue: String,
  sourceReportedCumulativeValue: String,
  reportedAt: Date,
}, { _id: false });

const boxOfficeDailySchema = new mongoose.Schema({
  reportKey: { type: String, required: true, unique: true },
  tmdbId: { type: Number, default: null },
  movieTitle: { type: String, required: true, trim: true },
  originalTitle: { type: String, default: null },
  posterPath: { type: String, default: null },
  releaseDate: { type: String, default: null },
  releaseYear: { type: Number, default: null },
  originalLanguage: { type: String, default: null },
  industry: { type: String, default: null },
  reportDate: { type: Date, required: true },
  market: { type: String, required: true },
  territory: { type: String, required: true },
  collectionType: { type: String, required: true },
  dailyCollection: { type: Number, required: true, min: 0 },
  cumulativeCollection: { type: Number, default: null, min: 0 },
  sourceReportedValue: { type: String, default: null },
  sourceReportedCumulativeValue: { type: String, default: null },
  currency: { type: String, required: true },
  rank: { type: Number, default: null, min: 1 },
  source: { type: String, required: true },
  sourceMovieKey: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  reportedAt: { type: Date, required: true },
  isEstimate: { type: Boolean, required: true },
  verificationStatus: { type: String, required: true },
  revisionHistory: { type: [revisionSchema], default: [] },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

boxOfficeDailySchema.index({ reportDate: -1, originalLanguage: 1, tmdbId: 1 });
boxOfficeDailySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('BoxOfficeDaily', boxOfficeDailySchema);
