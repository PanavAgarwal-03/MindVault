const express = require('express');
const router = express.Router();
const Thought = require('../models/Thought');
const { generateEmbedding } = require('../utils/embeddings');
const { verifyToken } = require('../middleware/authMiddleware');
const { getGeminiJSON, isGeminiAvailable } = require('../utils/aiService');
const { DEFAULT_REASON } = require('../utils/reasonOptions');

// Helper function to extract price from text using regex
function extractPriceFromText(text) {
  if (!text) return null;
  
  // Match price patterns: ₹ or $ followed by numbers with optional commas/decimals
  // Patterns: "₹1,999", "$29.99", "Price: ₹2999", "Rs. 1999", etc.
  const pricePatterns = [
    /₹\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/,  // ₹1,999 or ₹1999.99 (Indian format: commas for thousands, dot for decimals)
    /₹\s?(\d+(?:\.\d{2})?)/,  // ₹1999 or ₹1999.99 (simple format)
    /\$\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/,  // $1,999 or $1999.99 (US format)
    /\$\s?(\d+(?:\.\d{2})?)/,  // $29.99 (simple format)
    /Rs\.?\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/i,  // Rs. 1999 or Rs. 1,999.99
    /INR\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/i,  // INR 1999 or INR 1,999.99
    /price[:\s]+₹?\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/i,  // Price: ₹1999 or Price: ₹1,999.99
  ];
  
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Remove commas (thousands separator) and keep decimals
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        return Math.round(price); // Round to nearest integer for Indian currency
      }
    }
  }
  
  return null;
}

// POST /api/saveThought - Save a captured thought (requires authentication)
router.post('/saveThought', verifyToken, async (req, res) => {
  try {
    const {
      title,
      url,
      type,
      contentType,
      reason,
      topicUser,
      topicAuto,
      imageUrl,
      fileUrl,
      price,
      selectedText,
      description,
      pageText // Additional text from page for context
    } = req.body;

    // Get userToken from authenticated user (req.user is set by verifyToken middleware)
    const userToken = req.userToken || req.user.username;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: title is required'
      });
    }

    // Use Gemini AI to automatically determine type, reason, platform, topicAuto, keywords, and price
    let finalType = type || 'text';
    let finalReason = reason || DEFAULT_REASON;
    let finalTopicAuto = topicAuto || 'general';
    let finalPrice = price !== undefined && price !== null ? price : null;
    let platform = 'generic';
    let keywords = [];

    if (isGeminiAvailable()) {
      try {
        // Ask Gemini to analyze and classify the item
        const prompt = `Analyze this content and respond in valid JSON:

Title: ${title}
URL: ${url || 'N/A'}
Type: ${type || 'not specified'}
Text Content: ${(pageText || selectedText || description || '').slice(0, 800)}

Return JSON:
{
  "type": "link" | "video" | "product" | "image" | "text" | "note" | "social",
  "reason": "to read later" | "to buy later" | "to view later" | "to watch later" | "to research later" | "important reference" | "personal note",
  "platform": "youtube" | "amazon" | "flipkart" | "instagram" | "chatgpt" | "medium" | "github" | "twitter" | "generic",
  "topicAuto": "AI" | "productivity" | "travel" | "development" | "design" | etc.,
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "price": "₹1999" | "1999" | null
}

Rules:
- If URL contains 'amazon' or 'flipkart', this is likely a product. Extract or estimate the price from text content.
- Search for price patterns: '₹' or '$' followed by numbers (e.g., "₹1,999", "$29.99", "Price: ₹2999").
- Extract the numeric price value. Return as string with currency symbol (e.g., "₹1999") or just the number.
- If no price found in product URLs, return null.
- For non-product URLs, always return null for price.
- Keywords: Extract 3-5 meaningful words that describe the item, excluding common words.
- Platform: Detect from URL (amazon, flipkart, youtube, etc.) or infer from content.

Respond with valid JSON only.`;

        const aiData = await getGeminiJSON(prompt);
        console.log('Gemini Save Result:', JSON.stringify(aiData, null, 2));

        // Use AI data to override user-provided values
        if (aiData && Object.keys(aiData).length > 0) {
          // Type - AI determines the correct type
          if (aiData.type) {
            finalType = aiData.type;
          } else if (url) {
            // Fallback: determine type from URL if AI didn't provide it
            const lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo.com')) {
              finalType = 'video';
            } else if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              finalType = 'image';
            } else if (lowerUrl.match(/\.gif$/i)) {
              finalType = 'gif';
            } else if (url) {
              finalType = 'link';
            }
          }

          // Reason - AI determines the correct reason
          if (aiData.reason) {
            finalReason = aiData.reason;
          }

          // TopicAuto - AI determines the category
          if (aiData.topicAuto) {
            finalTopicAuto = aiData.topicAuto;
          }

          // Platform - AI detects the platform
          if (aiData.platform) {
            platform = aiData.platform;
          } else if (url) {
            // Fallback platform detection from URL
            const lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
              platform = 'youtube';
            } else if (lowerUrl.includes('amazon.') || lowerUrl.includes('amazon.com')) {
              platform = 'amazon';
            } else if (lowerUrl.includes('flipkart')) {
              platform = 'flipkart';
            } else if (lowerUrl.includes('instagram.com')) {
              platform = 'instagram';
            } else if (lowerUrl.includes('chat.openai.com') || lowerUrl.includes('chatgpt')) {
              platform = 'chatgpt';
            } else if (lowerUrl.includes('github.com')) {
              platform = 'github';
            } else if (lowerUrl.includes('medium.com')) {
              platform = 'medium';
            } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
              platform = 'twitter';
            } else {
              platform = 'generic';
            }
          }

          // Keywords - AI extracts keywords
          if (aiData.keywords && Array.isArray(aiData.keywords)) {
            keywords = aiData.keywords.filter(k => k && k.trim()).slice(0, 5); // Limit to 5 keywords
          } else if (aiData.keywords && typeof aiData.keywords === 'string') {
            // If keywords come as comma-separated string
            keywords = aiData.keywords.split(',').map(k => k.trim()).filter(k => k).slice(0, 5);
          }

          // Price - AI extracts price with regex fallback
          if (aiData.price && aiData.price !== 'null' && aiData.price !== null) {
            if (typeof aiData.price === 'string') {
              // Extract numeric value from string like "₹999" or "999"
              const priceMatch = aiData.price.match(/₹?\s?(\d+[,.]?\d*)/);
              if (priceMatch) {
                finalPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
              }
            } else if (typeof aiData.price === 'number') {
              finalPrice = aiData.price;
            }
          } else if (price !== undefined && price !== null) {
            // Use user-provided price if AI didn't extract one
            finalPrice = typeof price === 'string' ? parseFloat(price.replace(/[₹,]/g, '')) : price;
          } else {
            // Manual fallback extraction if Gemini misses price (for Amazon/Flipkart URLs)
            const lowerUrl = (url || '').toLowerCase();
            if (lowerUrl.includes('amazon') || lowerUrl.includes('flipkart')) {
              const combinedText = `${pageText || ''} ${selectedText || ''} ${description || ''}`;
              const extractedPrice = extractPriceFromText(combinedText);
              if (extractedPrice) {
                finalPrice = extractedPrice;
                console.log('Price extracted via regex fallback:', finalPrice);
              }
            }
          }

          console.log('Final AI-determined values:', {
            type: finalType,
            reason: finalReason,
            topicAuto: finalTopicAuto,
            platform: platform,
            keywords: keywords,
            price: finalPrice
          });
        } else {
          console.warn('Gemini AI returned empty response, using fallback values');
          // Fallback type detection
          if (url) {
            const lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
              finalType = 'video';
              platform = 'youtube';
              finalReason = 'to watch later';
            } else if (lowerUrl.includes('amazon.') || lowerUrl.includes('amazon.com')) {
              finalType = 'product';
              platform = 'amazon';
              finalReason = 'to buy later';
            } else if (lowerUrl.includes('flipkart')) {
              finalType = 'product';
              platform = 'flipkart';
              finalReason = 'to buy later';
            } else if (url) {
              finalType = 'link';
            }
          }
        }
      } catch (aiError) {
        console.error('Gemini AI categorization error:', aiError);
        // Continue with defaults if AI fails
        if (url) {
          const lowerUrl = url.toLowerCase();
          if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
            finalType = 'video';
            platform = 'youtube';
            finalReason = 'to watch later';
          } else if (lowerUrl.includes('amazon.') || lowerUrl.includes('amazon.com')) {
            finalType = 'product';
            platform = 'amazon';
            finalReason = 'to buy later';
          } else if (url) {
            finalType = 'link';
          }
        }
      }
    } else {
      // Gemini not available, use fallback detection
      if (url) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
          finalType = 'video';
          platform = 'youtube';
          finalReason = 'to watch later';
        } else if (lowerUrl.includes('amazon.') || lowerUrl.includes('amazon.com')) {
          finalType = 'product';
          platform = 'amazon';
          finalReason = 'to buy later';
        } else if (lowerUrl.includes('flipkart')) {
          finalType = 'product';
          platform = 'flipkart';
          finalReason = 'to buy later';
        } else if (url) {
          finalType = 'link';
        }
      }
    }

    // Determine category - unified category field that mirrors topicAuto or main user category
    const category = finalTopicAuto || (topicUser && Array.isArray(topicUser) && topicUser.length > 0 ? topicUser[0] : (topicUser && typeof topicUser === 'string' ? topicUser.split(',')[0].trim() : 'general'));

    // Combine text for embedding generation (include keywords for better semantic search)
    const textForEmbedding = `${title} ${description || ''} ${selectedText || ''} ${finalReason || ''} ${keywords.join(' ')}`.trim();

    // Generate embedding
    const embedding = await generateEmbedding(textForEmbedding);

    // Create thought with AI-determined values
    const thought = new Thought({
      title,
      url: url || '',
      type: finalType,
      contentType: contentType || (finalType === 'link' || finalType === 'video' ? 'text' : finalType === 'product' ? 'product' : finalType),
      reason: finalReason,
      topicUser: topicUser ? (Array.isArray(topicUser) ? topicUser : topicUser.split(',').map(t => t.trim())) : [],
      topicAuto: finalTopicAuto,
      category: category, // Unified category field
      platform: platform,
      keywords: keywords, // AI-extracted keywords
      imageUrl: imageUrl || '',
      fileUrl: fileUrl || '',
      price: finalPrice,
      selectedText: selectedText || '',
      description: description || '',
      userToken: userToken,
      embedding
    });

    await thought.save();
    console.log('Saved Thought:', JSON.stringify(thought.toObject(), null, 2));

    res.status(201).json({
      success: true,
      message: 'Thought saved successfully',
      thought
    });
  } catch (error) {
    console.error('Error saving thought:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save thought',
      details: error.message
    });
  }
});

// GET /api/thoughts - Get all thoughts for authenticated user
router.get('/thoughts', verifyToken, async (req, res) => {
  try {
    // Get userToken from authenticated user
    const userToken = req.userToken || req.user.username;

    const thoughts = await Thought.find({ userToken })
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({
      success: true,
      count: thoughts.length,
      thoughts
    });
  } catch (error) {
    console.error('Error fetching thoughts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch thoughts',
      details: error.message
    });
  }
});

// DELETE /api/thoughts/:id - Delete a thought
router.delete('/thoughts/:id', verifyToken, async (req, res) => {
  try {
    const userToken = req.userToken || req.user.username;
    const thoughtId = req.params.id;

    const deleted = await Thought.findOneAndDelete({ 
      _id: thoughtId, 
      userToken: userToken 
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Thought not found or you do not have permission to delete it'
      });
    }

    res.json({
      success: true,
      message: 'Thought deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting thought:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete thought',
      details: error.message
    });
  }
});

module.exports = router;