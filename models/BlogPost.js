import mongoose from 'mongoose';
const { Schema } = mongoose;

const blogPostSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, trim: true },
  subtitle:    { type: String, default: '' },
  content:     { type: String, default: '' },
  excerpt:     { type: String, default: '' },
  author:      { type: Schema.Types.ObjectId, ref: 'User' },
  authorName:  { type: String, default: '' },
  category:    {
    type: String,
    enum: ['review', 'feature', 'editorial', 'list', 'interview', 'news', 'essay'],
    default: 'feature',
  },
  coverImage:  { type: String, default: '' },
  tags:        [{ type: String, trim: true }],
  categories:  [{ type: String, trim: true }],
  source:      { type: String, enum: ['local', 'medium'], default: 'local' },
  sourceId:    { type: String, trim: true },
  canonicalUrl:{ type: String, trim: true },
  readingTime: { type: Number, min: 0 },
  contentAvailable: { type: Boolean, default: false },
  lastSyncedAt: { type: Date },
  published:   { type: Boolean, default: false },
  publishedAt: { type: Date },
  views:       { type: Number, default: 0 },
}, {
  timestamps: true,
});


blogPostSchema.index({ published: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1, published: 1 });
blogPostSchema.index(
  { source: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { source: 'medium', sourceId: { $type: 'string' } } }
);
blogPostSchema.index({ source: 1, categories: 1, publishedAt: -1 });

export default mongoose.model('BlogPost', blogPostSchema);
