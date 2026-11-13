import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema({
  amount: Number,
  currency: String,
  sourceReportedValue: String,
  reportedAt: Date,
}, { _id: false });

const boxOfficeLifetimeSchema = new mongoose.Schema({
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
  amount: { type: Number, required: true, min: 0 },
  sourceReportedValue: { type: String, default: null },
  currency: { type: String, required: true },
  source: { type: String, required: true },
  sourceMovieKey: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  reportedAt: { type: Date, required: true },
  isEstimate: { type: Boolean, required: true },
  verificationStatus: { type: String, required: true },
  revisionHistory: { type: [revisionSchema], default: [] },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

boxOfficeLifetimeSchema.index({ collectionType: 1, reportDate: -1, tmdbId: 1 });
boxOfficeLifetimeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('BoxOfficeLifetime', boxOfficeLifetimeSchema);
