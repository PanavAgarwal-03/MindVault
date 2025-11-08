const mongoose = require('mongoose');

const thoughtSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['text', 'link', 'image', 'gif', 'voice', 'video', 'product', 'note', 'social', 'pdf', 'doc'],
    required: true,
    default: 'text'
  },
  contentType: {
    type: String,
    enum: ['text', 'image', 'video', 'todo', 'product'],
    default: 'text'
  },
  reason: {
    type: String,
    default: ''
  },
  topicUser: {
    type: [String],
    default: []
  },
  topicAuto: {
    type: String,
    default: 'general'
  },
  category: {
    type: String,
    default: 'general'
  },
  platform: {
    type: String,
    default: null
  },
  keywords: {
    type: [String],
    default: []
  },
  imageUrl: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    default: null
  },
  selectedText: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: null
  },
  userToken: {
    type: String,
    required: true,
    index: true
  },
  embedding: {
    type: [Number],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient queries
// Note: Embedding similarity is computed in application code (cosine similarity)
thoughtSchema.index({ userToken: 1, createdAt: -1 });
thoughtSchema.index({ contentType: 1, userToken: 1 });
thoughtSchema.index({ topicAuto: 1, userToken: 1 });
thoughtSchema.index({ category: 1, userToken: 1 }); // Index for category searches
thoughtSchema.index({ platform: 1, userToken: 1 });
thoughtSchema.index({ keywords: 1 }); // Index for keyword searches
thoughtSchema.index({ title: 1 }); // Index for title searches

// Create compound text index for full-text search on title, keywords, topicAuto, category, reason, and summary
// Note: MongoDB only allows one text index per collection, so we create a compound one
try {
  thoughtSchema.index({
    title: 'text',
    keywords: 'text',
    topicAuto: 'text',
    category: 'text',
    reason: 'text',
    summary: 'text'
  }, {
    name: 'text_search_index',
    weights: {
      title: 10,
      keywords: 5,
      summary: 4,
      topicAuto: 3,
      category: 3,
      reason: 2
    }
  });
} catch (error) {
  // Text index might already exist - that's okay
  console.warn('Text index creation note:', error.message);
}

const Thought = mongoose.model('Thought', thoughtSchema);

module.exports = Thought;