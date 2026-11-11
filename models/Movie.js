import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema({
  tmdbId: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  overview: String,
  releaseDate: String,
  posterPath: String,
  backdropPath: String,
  genres: [String],
  rating: Number,
  popularity: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Movie = mongoose.model('Movie', movieSchema);

export default Movie;
