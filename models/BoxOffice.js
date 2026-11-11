import mongoose from 'mongoose';

const boxOfficeFieldSchema = new mongoose.Schema({
  value: { type: mongoose.Schema.Types.Mixed }, // Number, String, or Array
  currency: { type: String, default: null },
  source: { type: String, default: null },
  sourceUrl: { type: String, default: null },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const boxOfficeSchema = new mongoose.Schema({
  tmdbId: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  openingDay: boxOfficeFieldSchema,
  openingWeekend: boxOfficeFieldSchema,
  daywiseCollection: {
    value: [{
      day: { type: Number },
      date: { type: String },
      amount: { type: Number },
      currency: { type: String },
      source: { type: String }
    }],
    source: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    lastUpdated: { type: Date, default: Date.now }
  },
  indiaNet: boxOfficeFieldSchema,
  indiaGross: boxOfficeFieldSchema,
  overseasGross: boxOfficeFieldSchema,
  worldwideGross: boxOfficeFieldSchema,
  totalCollection: boxOfficeFieldSchema,
  budget: boxOfficeFieldSchema,
  verdict: boxOfficeFieldSchema,
  screens: boxOfficeFieldSchema,
  occupancy: boxOfficeFieldSchema,
  collectionByDate: {
    value: [{
      date: { type: String },
      amount: { type: Number },
      currency: { type: String }
    }],
    source: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    lastUpdated: { type: Date, default: Date.now }
  },
  lifetimeCollection: boxOfficeFieldSchema,
}, { timestamps: true });

const BoxOffice = mongoose.model('BoxOffice', boxOfficeSchema);

export default BoxOffice;
