import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../db.js';
import BoxOfficeDaily from '../models/BoxOfficeDaily.js';
import { syncIndianBoxOfficeFeed } from '../services/boxOfficeDataService.js';

dotenv.config();

await connectDB();
const result = await syncIndianBoxOfficeFeed();
const latestDate = await BoxOfficeDaily.findOne({ expiresAt: { $gt: new Date() } })
  .sort({ reportDate: -1 })
  .select('reportDate')
  .lean();
const date = latestDate?.reportDate;
const sample = date
  ? await BoxOfficeDaily.find({
    reportDate: date,
    expiresAt: { $gt: new Date() },
  })
    .sort({ dailyCollection: -1 })
    .limit(8)
    .lean()
  : [];

console.log(JSON.stringify({
  result,
  latestDate: date,
  countForLatest: sample.length ? await BoxOfficeDaily.countDocuments({
    reportDate: date,
    expiresAt: { $gt: new Date() },
  }) : 0,
  sample: sample.map(row => ({
    rank: row.rank,
    title: row.movieTitle,
    dailyCr: row.dailyCollection / 1e7,
    tmdbId: row.tmdbId,
  })),
}, null, 2));

await mongoose.disconnect();
