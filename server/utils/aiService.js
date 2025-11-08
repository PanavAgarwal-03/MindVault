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
 * Get structured JSON response from Gemini
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
    
    const text = result.response.text();
    
    // Log raw response for debugging
    console.log('Gemini raw:', text);

    // Extract JSON from text (Gemini often adds explanation)
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const json = JSON.parse(match[0]);
        console.log('Gemini parsed JSON:', JSON.stringify(json, null, 2));
        return json;
      } catch (parseError) {
        console.error('Gemini JSON parse error:', parseError);
        console.error('Failed to parse JSON from:', match[0]);
        return {};
      }
    }

    console.warn('Gemini returned no valid JSON.');
    return {};
  } catch (error) {
    console.error('Gemini API error:', error);
    if (error.message) {
      console.error('Gemini error message:', error.message);
    }
    return {};
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