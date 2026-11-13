import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { maintainDatabaseIndexes } from './services/databaseIndexMaintenance.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cineshelf';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    try {
      await maintainDatabaseIndexes();
    } catch (indexError) {
      console.error('Database index maintenance failed:', indexError.message);
    }
    console.log('MongoDB connected!');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

export default connectDB;
