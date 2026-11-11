import mongoose from 'mongoose';
const { Schema } = mongoose;

const blogPostSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, trim: true },
  content:     { type: String, required: true },
  excerpt:     { type: String, default: '' },
  author:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category:    {
    type: String,
    enum: ['review', 'feature', 'editorial', 'list', 'interview', 'news'],
    default: 'feature',
  },
  coverImage:  { type: String, default: '' },
  tags:        [{ type: String, trim: true }],
  published:   { type: Boolean, default: false },
  publishedAt: { type: Date },
  views:       { type: Number, default: 0 },
}, {
  timestamps: true,
});


blogPostSchema.index({ published: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1, published: 1 });

export default mongoose.model('BlogPost', blogPostSchema);
