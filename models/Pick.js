import mongoose from 'mongoose';

const pickSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['editor', 'visual', 'decade', 'director', 'community']
  },
  image: {
    type: String,
    default: null
  },
  movies: [{
    type: String,
    trim: true
  }],
  featured: {
    type: Boolean,
    default: false
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for efficient queries
pickSchema.index({ type: 1, featured: 1 });
pickSchema.index({ creator: 1 });

const Pick = mongoose.model('Pick', pickSchema);

export default Pick; 