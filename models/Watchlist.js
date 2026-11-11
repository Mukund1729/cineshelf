
import mongoose from 'mongoose';
const { Schema } = mongoose;

const WatchlistSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  movies: [
    {
      tmdbId: { type: Number, required: true },
      title: String,
      poster: String,
      posterUrl: String, // Alternative field name
      poster_path: String, // TMDB poster path
      overview: String,
      releaseDate: String,
      voteAverage: Number,
      genreIds: [Number],
      mediaType: { type: String, enum: ['movie', 'tv'], default: 'movie' }, // Distinguish between movies and TV shows
      addedAt: { type: Date, default: Date.now },
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Watchlist', WatchlistSchema);
