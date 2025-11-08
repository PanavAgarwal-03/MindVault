const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const Thought = require('../models/Thought');
const { generateEmbedding } = require('../utils/embeddings');
const { verifyToken } = require('../middleware/authMiddleware');
const { getGeminiJSON, isGeminiAvailable } = require('../utils/aiService');
const { DEFAULT_REASON } = require('../utils/reasonOptions');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
fs.ensureDirSync(uploadsDir);

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - allow images, audio, PDFs, and documents
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp3|wav|ogg|m4a|pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || 
                   file.mimetype === 'application/pdf' ||
                   file.mimetype === 'application/msword' ||
                   file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   file.mimetype === 'text/plain';

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, audio, PDFs, and documents are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// POST /api/upload - Upload file (image, GIF, or voice note) (requires authentication)
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const {
      title,
      type,
      reason,
      topicUser,
      topicAuto,
      description,
      pageText // Extracted text from PDFs/documents (from client)
    } = req.body;

    // Get userToken from authenticated user
    const userToken = req.userToken || req.user.username;

    // Validate required fields
    if (!title || !type) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title and type are required'
      });
    }

    // Determine file type from extension
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let detectedType = type;
    
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(fileExt)) {
      detectedType = 'image';
    } else if (fileExt === '.gif') {
      detectedType = 'gif';
    } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(fileExt)) {
      detectedType = 'voice';
    } else if (fileExt === '.pdf') {
      detectedType = 'pdf';
    } else if (['.doc', '.docx', '.txt'].includes(fileExt)) {
      detectedType = 'doc';
    }

    // Generate file URL (in production, upload to cloud storage like Cloudinary)
    const fileUrl = `/uploads/${req.file.filename}`;

    // Use pageText if provided (from client-side PDF extraction), otherwise use description
    const extractedText = pageText || description || '';

    // Use Gemini AI for categorization if available
    let finalReason = reason || DEFAULT_REASON;
    let finalTopicAuto = topicAuto || 'general';
    let platform = 'generic';
    let keywords = [];

    if (isGeminiAvailable()) {
      try {
        const prompt = `Analyze this uploaded file and return structured JSON:

Title: ${title}
File Type: ${detectedType}
Description: ${extractedText || description || 'N/A'}

Based on the file type and content, determine:
- type: "image" | "gif" | "voice" | "pdf" | "doc" | "note"
- reason: "to read later" | "to buy later" | "to view later" | "to watch later" | "to research later" | "important reference" | "personal note"
- platform: "youtube" | "amazon" | "flipkart" | "instagram" | "chatgpt" | "medium" | "generic"
- topicAuto: short category like "AI", "productivity", "travel", "document", etc.
- keywords: top 3-5 words that describe the file (array of strings)

Respond only in valid JSON format:
{
  "type": "${detectedType}",
  "reason": "to read later",
  "platform": "generic",
  "topicAuto": "document",
  "keywords": ["document", "pdf", "reference"]
}`;

        const aiData = await getGeminiJSON(prompt);
        console.log('Gemini upload analysis:', JSON.stringify(aiData, null, 2));
        
        if (aiData && Object.keys(aiData).length > 0) {
          // Use AI-determined type if provided
          if (aiData.type) {
            detectedType = aiData.type;
          }
          
          if (aiData.reason) {
            finalReason = aiData.reason;
          }
          
          if (aiData.topicAuto) {
            finalTopicAuto = aiData.topicAuto;
          }
          
          if (aiData.platform) {
            platform = aiData.platform;
          }

          // Extract keywords
          if (aiData.keywords && Array.isArray(aiData.keywords)) {
            keywords = aiData.keywords.filter(k => k && k.trim()).slice(0, 5);
          } else if (aiData.keywords && typeof aiData.keywords === 'string') {
            keywords = aiData.keywords.split(',').map(k => k.trim()).filter(k => k).slice(0, 5);
          }
        }
      } catch (aiError) {
        console.error('Gemini AI categorization error:', aiError);
        // Continue with defaults if AI fails
      }
    }

    // Determine category - unified category field that mirrors topicAuto or main user category
    const category = finalTopicAuto || (topicUser && Array.isArray(topicUser) && topicUser.length > 0 ? (typeof topicUser === 'string' ? JSON.parse(topicUser)[0] : topicUser[0]) : (topicUser && typeof topicUser === 'string' ? topicUser.split(',')[0].trim() : 'general'));

    // Generate embedding from title, description, extracted text, and keywords
    const textForEmbedding = `${title} ${extractedText || description || ''} ${finalReason || ''} ${keywords.join(' ')}`.trim();
    const embedding = await generateEmbedding(textForEmbedding);

    // Create thought
    const thought = new Thought({
      title,
      url: fileUrl,
      type: detectedType,
      contentType: detectedType === 'voice' ? 'text' : detectedType,
      reason: finalReason,
      topicUser: topicUser ? (Array.isArray(topicUser) ? JSON.parse(topicUser) : topicUser.split(',').map(t => t.trim())) : [],
      topicAuto: finalTopicAuto,
      category: category, // Unified category field
      platform: platform,
      keywords: keywords, // AI-extracted keywords
      fileUrl: fileUrl,
      imageUrl: detectedType === 'image' || detectedType === 'gif' ? fileUrl : '',
      description: description || extractedText || '',
      selectedText: (detectedType === 'pdf' || detectedType === 'doc') ? extractedText : (description || ''),
      pageText: (detectedType === 'pdf' || detectedType === 'doc') ? extractedText : (pageText || ''),
      userToken: userToken,
      embedding
    });

    await thought.save();
    console.log('Saved Thought (upload):', JSON.stringify(thought.toObject(), null, 2));

    res.status(201).json({
      success: true,
      message: 'File uploaded and saved successfully',
      thought,
      fileUrl
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path).catch(err => console.error('Error deleting file:', err));
    }
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// Serve uploaded files (public endpoint - no auth required)
router.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;