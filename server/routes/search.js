const express = require('express');
const router = express.Router();
const Thought = require('../models/Thought');
const { generateEmbedding, cosineSimilarity } = require('../utils/embeddings');
const { verifyToken } = require('../middleware/authMiddleware');
const { getGeminiJSON, isGeminiAvailable } = require('../utils/aiService');

// GET /api/search - Enhanced search with Gemini AI-powered query parsing and semantic search
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { 
      q, 
      limit = 20,
      type,
      reason,
      topicUser,
      topicAuto,
      category,
      dateRange,
      from, // Date range start (ISO string or date)
      to, // Date range end (ISO string or date)
      sortBy = 'relevance'
    } = req.query;

    // Get userToken from authenticated user
    const userToken = req.userToken || req.user.username;

    // Build base filter - always start with userToken
    let dbQuery = { userToken };
    let hasFilter = false;
    let detectedFilters = [];

    // If query exists, try to parse it with Gemini AI first
    if (q && q.trim() && isGeminiAvailable()) {
      // Get current date for context
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const prompt = `You are helping to filter user-saved data.
Analyze this query and respond ONLY in JSON.

"${q}"

The JSON format must include:
{
  "type": "product | video | text | image | note | link | null",
  "topic": "AI | travel | coding | design | shopping | etc | null",
  "reason": "to read later | to buy later | to watch later | null",
  "priceRange": [min, max] | null,
  "keywords": [string],
  "dateRange": {
    "from": "YYYY-MM-DD" | null,
    "to": "YYYY-MM-DD" | null
  }
}

Rules:
- If query mentions time ("this week", "yesterday", "between 7th and 8th Nov", "last month"), convert it to ISO dates in dateRange.
- DO NOT include dates in keywords.
- "this week" = last 7 days from today (${today})
- "last week" = 7-14 days ago from today
- "this month" = current month from the 1st
- "last month" = previous month
- "yesterday" = yesterday's date
- "today" = today's date (${today})
- For relative dates like "between 7th and 8th Nov", use current year if year not specified.
- Always return valid ISO date strings (YYYY-MM-DD format).
- If no date mentioned, set both "from" and "to" to null.
- Price range: Extract numeric values only (e.g., "under ₹3000" → [0, 3000]).
- Keywords: Extract meaningful search terms, excluding dates and prices.

Respond with valid JSON only.`;

      const filters = await getGeminiJSON(prompt);
      console.log('Gemini filters:', JSON.stringify(filters, null, 2));

      // Apply AI-detected filters
      if (filters.type && filters.type !== 'null') {
        dbQuery.type = filters.type;
        hasFilter = true;
        detectedFilters.push(`Type: ${filters.type}`);
      }

      if (filters.topic && filters.topic !== 'null') {
        // Unified category/topic search - search across topicAuto, topicUser, and category
        dbQuery.$or = [
          { topicAuto: { $regex: filters.topic, $options: 'i' } },
          { topicUser: { $in: [filters.topic] } },
          { category: { $regex: filters.topic, $options: 'i' } }
        ];
        hasFilter = true;
        detectedFilters.push(`Topic: ${filters.topic}`);
      }

      if (filters.reason && filters.reason !== 'null') {
        dbQuery.reason = { $regex: filters.reason, $options: 'i' };
        hasFilter = true;
        detectedFilters.push(`Reason: ${filters.reason}`);
      }

      if (filters.priceRange && Array.isArray(filters.priceRange) && filters.priceRange.length === 2) {
        dbQuery.price = {
          $gte: filters.priceRange[0],
          $lte: filters.priceRange[1]
        };
        hasFilter = true;
        detectedFilters.push(`Price: ₹${filters.priceRange[0]}-${filters.priceRange[1]}`);
      }

      if (filters.keywords && Array.isArray(filters.keywords) && filters.keywords.length > 0) {
        // Use keywords field for search, and also search in title
        dbQuery.$or = dbQuery.$or || [];
        dbQuery.$or.push(
          { keywords: { $in: filters.keywords } },
          { title: { $regex: filters.keywords.join('|'), $options: 'i' } },
          { description: { $regex: filters.keywords.join('|'), $options: 'i' } },
          { selectedText: { $regex: filters.keywords.join('|'), $options: 'i' } }
        );
        hasFilter = true;
        detectedFilters.push(`Keywords: ${filters.keywords.join(', ')}`);
      }

      // ✅ Date range mapping from Gemini (takes precedence over manual filters)
      let geminiDateSet = false;
      if (filters.dateRange && (filters.dateRange.from || filters.dateRange.to)) {
        const geminiFrom = filters.dateRange.from ? new Date(filters.dateRange.from) : null;
        const geminiTo = filters.dateRange.to ? new Date(filters.dateRange.to) : null;
        
        if (geminiFrom && geminiTo) {
          // Set to end of day for 'to' date
          geminiTo.setHours(23, 59, 59, 999);
          dbQuery.createdAt = { $gte: geminiFrom, $lte: geminiTo };
          hasFilter = true;
          geminiDateSet = true;
          detectedFilters.push(`Date: ${geminiFrom.toLocaleDateString()} to ${geminiTo.toLocaleDateString()}`);
        } else if (geminiFrom) {
          dbQuery.createdAt = { $gte: geminiFrom };
          hasFilter = true;
          geminiDateSet = true;
          detectedFilters.push(`Date: From ${geminiFrom.toLocaleDateString()}`);
        } else if (geminiTo) {
          geminiTo.setHours(23, 59, 59, 999);
          dbQuery.createdAt = { $lte: geminiTo };
          hasFilter = true;
          geminiDateSet = true;
          detectedFilters.push(`Date: Until ${geminiTo.toLocaleDateString()}`);
        }
      }
      
      // Store flag to prevent manual date filters from overriding Gemini's date range
      req.geminiDateSet = geminiDateSet;
    }

    // Apply manual filters (override AI filters if provided)
    if (type && type !== 'all') {
      dbQuery.type = type;
      hasFilter = true;
    }

    if (reason && reason !== 'all') {
      dbQuery.reason = { $regex: reason, $options: 'i' };
      hasFilter = true;
    }

    // Unified category/topic filter - search across topicAuto, topicUser, and category
    if (category && category !== 'all') {
      if (dbQuery.$or) {
        dbQuery.$or.push(
          { topicAuto: category },
          { category: category },
          { topicUser: { $in: [category] } }
        );
      } else {
        dbQuery.$or = [
          { topicAuto: category },
          { category: category },
          { topicUser: { $in: [category] } }
        ];
      }
      hasFilter = true;
    }

    if (topicAuto && topicAuto !== 'all') {
      if (dbQuery.$or) {
        dbQuery.$or.push(
          { topicAuto: topicAuto },
          { category: topicAuto }
        );
      } else {
        dbQuery.$or = [
          { topicAuto: topicAuto },
          { category: topicAuto }
        ];
      }
      hasFilter = true;
    }

    if (topicUser && topicUser !== 'all') {
      if (dbQuery.$or) {
        dbQuery.$or.push(
          { topicUser: { $in: [topicUser] } },
          { category: topicUser }
        );
      } else {
        dbQuery.$or = [
          { topicUser: { $in: [topicUser] } },
          { category: topicUser }
        ];
      }
      hasFilter = true;
    }

    // Date range filtering - support both predefined ranges and custom from/to dates
    // Only apply manual date filters if Gemini didn't already set a date range
    if (!req.geminiDateSet) {
      let dateFilter = {};
      
      // Custom date range (from & to) takes precedence over dateRange
      if (from || to) {
        if (from && to) {
          const fromDate = new Date(from);
          const toDate = new Date(to);
          // Set to end of day for 'to' date
          toDate.setHours(23, 59, 59, 999);
          dateFilter = { $gte: fromDate, $lte: toDate };
          hasFilter = true;
          detectedFilters.push(`Date: ${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}`);
        } else if (from) {
          const fromDate = new Date(from);
          dateFilter = { $gte: fromDate };
          hasFilter = true;
          detectedFilters.push(`Date: From ${fromDate.toLocaleDateString()}`);
        } else if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          dateFilter = { $lte: toDate };
          hasFilter = true;
          detectedFilters.push(`Date: Until ${toDate.toLocaleDateString()}`);
        }
      } else if (dateRange && dateRange !== 'all') {
        // Predefined date ranges
        const now = new Date();
        let startDate;
        switch (dateRange) {
          case 'today':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            break;
          case 'year':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 365);
            break;
          default:
            startDate = null;
        }
        if (startDate) {
          dateFilter = { $gte: startDate };
          hasFilter = true;
          detectedFilters.push(`Date: ${dateRange}`);
        }
      }

      // Apply date filter if set (only if Gemini didn't already set one)
      if (Object.keys(dateFilter).length > 0) {
        dbQuery.createdAt = dateFilter;
      }
    }

    // Only perform semantic search if we have a query and filters were extracted
    let results = [];
    
    if (q && q.trim() && hasFilter) {
      // Generate embedding for search query
      const queryEmbedding = await generateEmbedding(q.trim());

      // Get thoughts matching the filter
      const thoughts = await Thought.find(dbQuery)
        .sort({ createdAt: -1 })
        .limit(1000);

      // Calculate similarity scores
      const thoughtsWithSimilarity = thoughts.map(thought => {
        if (thought.embedding && thought.embedding.length > 0) {
          const similarity = cosineSimilarity(queryEmbedding, thought.embedding);
          return {
            ...thought.toObject(),
            similarity
          };
        } else {
          // Fallback to text match if no embedding
          const searchLower = q.toLowerCase();
          const textMatch = (
            thought.title.toLowerCase().includes(searchLower) ||
            (thought.description && thought.description.toLowerCase().includes(searchLower)) ||
            (thought.selectedText && thought.selectedText.toLowerCase().includes(searchLower)) ||
            (thought.keywords && thought.keywords.some(k => k.toLowerCase().includes(searchLower)))
          );
          return {
            ...thought.toObject(),
            similarity: textMatch ? 0.5 : 0.1
          };
        }
      });

      // Sort by similarity (descending)
      thoughtsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

      // Filter out very low similarity results
      const threshold = 0.1;
      results = thoughtsWithSimilarity
        .filter(thought => thought.similarity > threshold)
        .slice(0, parseInt(limit));
    } else if (hasFilter) {
      // No query text but we have filters - just apply filters
      let sortOption = { createdAt: -1 };
      
      if (sortBy === 'title') {
        sortOption = { title: 1 };
      } else if (sortBy === 'date') {
        sortOption = { createdAt: -1 };
      }

      const thoughts = await Thought.find(dbQuery)
        .sort(sortOption)
        .limit(parseInt(limit));

      results = thoughts.map(thought => ({
        ...thought.toObject(),
        similarity: 1.0 // No relevance score when no query
      }));
    } else if (q && q.trim()) {
      // Query but no filters extracted - perform text search including keywords
      const thoughts = await Thought.find({
        userToken,
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { selectedText: { $regex: q, $options: 'i' } },
          { reason: { $regex: q, $options: 'i' } },
          { keywords: { $in: [new RegExp(q, 'i')] } }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

      results = thoughts.map(thought => ({
        ...thought.toObject(),
        similarity: 0.6 // Default similarity for text matches
      }));
    } else {
      // No query and no filters - return limited default results
      const thoughts = await Thought.find({ userToken })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) || 10);

      results = thoughts.map(thought => ({
        ...thought.toObject(),
        similarity: 1.0
      }));
    }

    console.log('Search query:', JSON.stringify(dbQuery, null, 2));
    console.log('Search results count:', results.length);
    console.log('Has filter:', hasFilter);

    res.json({
      success: true,
      query: q || null,
      aiFilters: detectedFilters.length > 0 ? detectedFilters : null,
      filters: {
        type: type || 'all',
        reason: reason || 'all',
        topicUser: topicUser || 'all',
        topicAuto: topicAuto || 'all',
        category: category || 'all',
        dateRange: dateRange || 'all',
        from: from || null,
        to: to || null
      },
      count: results.length,
      results: results
    });
  } catch (error) {
    console.error('Gemini search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search thoughts',
      details: error.message
    });
  }
});

module.exports = router;