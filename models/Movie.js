import mongoose from 'mongoose';
const { Schema } = mongoose;

const creditSchema = new Schema({
  person: { type: Schema.Types.ObjectId, ref: 'FilmPerson' },
  personSlug: String,
  name: String,
  job: String,
  character: String,
}, { _id: false });

const movieSchema = new mongoose.Schema({
  tmdbId: { type: Number, required: true, unique: true },
  source: { type: String, enum: ['tmdb', 'original'], default: 'tmdb', index: true },
  slug: String,
  title: { type: String, required: true },
  overview: String,
  releaseDate: String,
  releaseYear: Number,
  runtimeSeconds: Number,
  tagline: String,
  posterPath: String,
  backdropPath: String,
  watchUrl: String,
  quote: String,
  copyrightNotice: String,
  credits: {
    cast: [creditSchema],
    crew: [creditSchema],
    specialThanks: [creditSchema],
  },
  genres: [String],
  rating: Number,
  popularity: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

movieSchema.index({ slug: 1 }, { unique: true, sparse: true });
movieSchema.index({ source: 1, 'credits.cast.person': 1 });
movieSchema.index({ source: 1, 'credits.crew.person': 1 });

const Movie = mongoose.model('Movie', movieSchema);

export default Movie;
