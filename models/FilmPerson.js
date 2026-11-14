import mongoose from 'mongoose';

const filmPersonSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  normalizedName: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  source: { type: String, enum: ['original'], default: 'original' },
  biography: { type: String, default: '' },
  knownForDepartment: { type: String, default: '' },
  professions: [{ type: String }],
  profilePath: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('FilmPerson', filmPersonSchema);
