// Embedding utilities for semantic search
// Using @xenova/transformers for local embedding generation

let pipeline = null;

// Initialize the embedding pipeline
async function initializeEmbeddings() {
  if (!pipeline) {
    try {
      const { pipeline: pipelineFactory } = await import('@xenova/transformers');
      pipeline = await pipelineFactory(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
      console.log('Embedding model loaded');
    } catch (error) {
      console.error('Error loading embedding model:', error);
      console.log('Using mock embeddings as fallback');
    }
  }
  return pipeline;
}

// Generate embedding for text
async function generateEmbedding(text) {
  try {
    const model = await initializeEmbeddings();
    
    if (!model) {
      // Fallback to mock embeddings for demo
      return generateMockEmbedding(text);
    }

    const result = await model(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(result.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return generateMockEmbedding(text);
  }
}

// Generate mock embedding (384 dimensions, same as all-MiniLM-L6-v2)
function generateMockEmbedding(text) {
  // Simple hash-based embedding for demo purposes
  const hash = hashString(text);
  const embedding = new Array(384).fill(0);
  
  // Create pseudo-random values based on text hash
  for (let i = 0; i < 384; i++) {
    embedding[i] = Math.sin(hash + i) * 0.1;
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

// Simple string hash function
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  initializeEmbeddings
};

