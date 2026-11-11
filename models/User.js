import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar:   { type: String, default: '' },
  bio:      { type: String, default: '' },
  socials:  {
    instagram: { type: String, default: '' },
    twitter:   { type: String, default: '' },
    website:   { type: String, default: '' },
  },
  // sakha = friends/connections (Sanskrit for companion)
  sakha: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  preferences: {
    theme:    { type: String, enum: ['light', 'dark', 'auto'], default: 'dark' },
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      push:  { type: Boolean, default: true },
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'private', 'friends'], default: 'public' },
      showWatchlist:     { type: Boolean, default: true },
      showReviews:       { type: Boolean, default: true },
    },
    moviePreferences: {
      preferredGenres:    [{ type: String }],
      preferredLanguages: [{ type: String }],
      includeAdultContent: { type: Boolean, default: false },
    },
  },
  favouriteGenres: [{ type: String }],
  favouriteMovies: [
    {
      tmdbId:  { type: Number },
      title:   { type: String },
      poster:  { type: String },
    }
  ],
  isAdmin:     { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },
  lastActive:  { type: Date, default: Date.now },
  // Password reset (token stored as hash, expires used for validity check)
  resetPasswordToken:   { type: String },
  resetPasswordExpires: { type: Date },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
