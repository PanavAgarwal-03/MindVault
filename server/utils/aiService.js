/**
 * Google Gemini AI Service
 * Reusable service for Gemini API integration using Google Generative AI SDK
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini client
let genAI = null;
let model = null;

try {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    console.log('Google Gemini AI client initialized successfully');
  } else {
    console.warn('GEMINI_API_KEY not set. Gemini AI features will be disabled.');
  }
} catch (error) {
  console.error('Error initializing Gemini client:', error);
  console.warn('Gemini AI features will be disabled.');
}

/**
 * Helper function to extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} - Array of extracted keywords
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Try to find keywords in various formats
  const patterns = [
    // Match quoted strings (often used for keywords)
    /"keywords?":\s*\[(.*?)\]/i,
    /keywords?:\s*\[(.*?)\]/i,
    // Match capitalized words or phrases
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    // Match words in quotes
    /"([^"]+)"/g
  ];
  
  const keywords = [];
  
  // First, try to extract from JSON-like structure
  for (const pattern of patterns.slice(0, 2)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Parse array-like strings
      const items = match[1]
        .split(',')
        .map(item => item.trim().replace(/["']/g, ''))
        .filter(item => item.length > 2);
      keywords.push(...items);
    }
  }
  
  // If no keywords found, try to extract capitalized words
  if (keywords.length === 0) {
    const capitalizedWords = text.match(patterns[2]);
    if (capitalizedWords) {
      keywords.push(...capitalizedWords.filter(k => k.length > 2 && k.length < 30));
    }
  }
  
  // Remove duplicates and limit to 5
  return [...new Set(keywords)]
    .filter(k => k && k.trim())
    .slice(0, 5);
}

/**
 * Helper function to extract topic/category from text
 * @param {string} text - Text to extract topic from
 * @returns {string} - Extracted topic
 */
function extractTopic(text) {
  if (!text || typeof text !== 'string') return 'general';
  
  const textLower = text.toLowerCase();
  
  // Product-related
  if (textLower.includes('product') || textLower.includes('shopping') || textLower.includes('buy')) {
    if (textLower.includes('car') || textLower.includes('automobile') || textLower.includes('vehicle') || textLower.includes('audi') || textLower.includes('bmw') || textLower.includes('mercedes')) {
      return 'automobile';
    }
    return 'shopping';
  }
  
  // Technology
  if (textLower.includes('code') || textLower.includes('programming') || textLower.includes('developer') || textLower.includes('software')) {
    return 'development';
  }
  
  // Design
  if (textLower.includes('design') || textLower.includes('ui') || textLower.includes('ux') || textLower.includes('interface')) {
    return 'design';
  }
  
  // AI/ML
  if (textLower.includes('ai') || textLower.includes('machine learning') || textLower.includes('neural') || textLower.includes('algorithm')) {
    return 'AI';
  }
  
  // Architecture
  if (textLower.includes('architecture') || textLower.includes('diagram') || textLower.includes('system design')) {
    return 'architecture';
  }
  
  // Travel
  if (textLower.includes('travel') || textLower.includes('trip') || textLower.includes('vacation') || textLower.includes('destination')) {
    return 'travel';
  }
  
  // Screenshot
  if (textLower.includes('screenshot') || textLower.includes('screen shot')) {
    return 'screenshot';
  }
  
  // Default
  return 'general';
}

/**
 * Helper function to extract type from text
 * @param {string} text - Text to extract type from
 * @returns {string} - Extracted type
 */
function extractType(text) {
  if (!text || typeof text !== 'string') return 'text';
  
  const textLower = text.toLowerCase();
  
  if (textLower.includes('product') || textLower.includes('shopping')) return 'product';
  if (textLower.includes('video') || textLower.includes('youtube')) return 'video';
  if (textLower.includes('image') || textLower.includes('photo') || textLower.includes('picture')) return 'image';
  if (textLower.includes('link') || textLower.includes('url')) return 'link';
  if (textLower.includes('note') || textLower.includes('text')) return 'note';
  
  return 'text';
}

/**
 * Helper function to extract reason from text
 * @param {string} text - Text to extract reason from
 * @returns {string} - Extracted reason
 */
function extractReason(text) {
  if (!text || typeof text !== 'string') return 'to view later';
  
  const textLower = text.toLowerCase();
  
  if (textLower.includes('buy') || textLower.includes('purchase') || textLower.includes('shopping')) {
    return 'to buy later';
  }
  if (textLower.includes('read') || textLower.includes('article') || textLower.includes('blog')) {
    return 'to read later';
  }
  if (textLower.includes('watch') || textLower.includes('video') || textLower.includes('youtube')) {
    return 'to watch later';
  }
  if (textLower.includes('research') || textLower.includes('study')) {
    return 'to research later';
  }
  if (textLower.includes('important') || textLower.includes('reference')) {
    return 'important reference';
  }
  
  return 'to view later';
}

/**
 * Get structured JSON response from Gemini with robust JSON extraction
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} imageUrl - Optional image URL to analyze
 * @returns {Promise<Object>} - Parsed JSON object from Gemini's response
 */
async function getGeminiJSON(prompt, imageUrl = null) {
  if (!model) {
    console.warn('Gemini model not available. Returning empty object.');
    return {};
  }

  try {
    let result;
    
    // If imageUrl is provided, analyze the image
    if (imageUrl) {
      try {
        // Fetch the image
        const fetch = require('node-fetch');
        const imageResponse = await fetch(imageUrl);
        
        if (!imageResponse.ok) {
          console.error(`Failed to fetch image: ${imageResponse.statusText}`);
          // Fallback to text-only analysis
          result = await model.generateContent(prompt);
        } else {
          // Get image data as buffer
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString('base64');
          
          // Determine MIME type from response or URL
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          
          // Use the Google Generative AI SDK's image support
          // The SDK supports base64 images directly
          result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: imageBase64,
                mimeType: contentType
              }
            }
          ]);
        }
      } catch (imageError) {
        console.error('Error fetching/processing image:', imageError);
        // Fallback to text-only analysis
        result = await model.generateContent(prompt);
      }
    } else {
      // Text-only prompt
      result = await model.generateContent(prompt);
    }
    
    const rawText = result.response.text();
    
    // Log raw response for debugging
    console.log('Gemini raw response:', rawText);

    // --- Robust JSON Extraction ---
    let jsonText = rawText;
    let parsed = {};

    // Step 1: Try to find JSON object in the response
    // Match the first complete JSON object (handles nested objects)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
      
      try {
        parsed = JSON.parse(jsonText);
        console.log('Gemini parsed JSON (successful):', JSON.stringify(parsed, null, 2));
      } catch (parseError) {
        console.warn('JSON.parse failed, trying fallback extraction:', parseError.message);
        
        // Fallback: Try to extract individual fields using regex
        parsed = {
          // Try to extract type
          type: extractType(rawText),
          // Try to extract topicAuto
          topicAuto: extractTopic(rawText),
          // Try to extract keywords
          keywords: extractKeywords(rawText),
          // Try to extract reason
          reason: extractReason(rawText),
          // Try to extract summary if present
          summary: rawText.match(/"summary":\s*"([^"]+)"/i)?.[1] || 
                   rawText.match(/summary[:\s]+([^.\n]+)/i)?.[1]?.trim() || 
                   null,
          // Try to extract price if present
          price: rawText.match(/"price":\s*"([^"]+)"/i)?.[1] ||
                 rawText.match(/₹\s?(\d+[,.]?\d*)/)?.[0] ||
                 null,
          // Try to extract platform
          platform: rawText.match(/"platform":\s*"([^"]+)"/i)?.[1] || 'generic',
          // Store raw text for debugging
          rawText: rawText.substring(0, 200) // Limit raw text length
        };
        
        console.log('Gemini parsed JSON (fallback extraction):', JSON.stringify(parsed, null, 2));
      }
    } else {
      // No JSON object found - use fallback extraction
      console.warn('No JSON object found in Gemini response, using fallback extraction');
      parsed = {
        type: extractType(rawText),
        topicAuto: extractTopic(rawText),
        keywords: extractKeywords(rawText),
        reason: extractReason(rawText),
        summary: rawText.match(/summary[:\s]+([^.\n]+)/i)?.[1]?.trim() || null,
        price: rawText.match(/₹\s?(\d+[,.]?\d*)/)?.[0] || null,
        platform: 'generic',
        rawText: rawText.substring(0, 200)
      };
      
      console.log('Gemini parsed JSON (no JSON found, fallback):', JSON.stringify(parsed, null, 2));
    }

    // Ensure critical fields are never null/undefined
    if (!parsed.type || parsed.type === 'null') {
      parsed.type = extractType(rawText);
    }
    if (!parsed.topicAuto || parsed.topicAuto === 'null') {
      parsed.topicAuto = extractTopic(rawText);
    }
    if (!parsed.keywords || !Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      parsed.keywords = extractKeywords(rawText);
    }
    if (!parsed.reason || parsed.reason === 'null') {
      parsed.reason = extractReason(rawText);
    }
    if (!parsed.platform || parsed.platform === 'null') {
      parsed.platform = 'generic';
    }

    // Log final parsed output for development
    console.log('Gemini Parsed Output (final):', JSON.stringify(parsed, null, 2));

    return parsed;
  } catch (error) {
    console.error('Gemini API error:', error);
    if (error.message) {
      console.error('Gemini error message:', error.message);
    }
    // Return fallback object with extracted fields from error context if available
    return {
      type: 'text',
      topicAuto: 'general',
      keywords: [],
      reason: 'to view later',
      platform: 'generic',
      error: 'Gemini JSON parsing failed'
    };
  }
}

/**
 * Check if Gemini is available
 * @returns {boolean} - True if Gemini model is initialized
 */
function isGeminiAvailable() {
  return model !== null;
}

module.exports = {
  getGeminiJSON,
  isGeminiAvailable
};