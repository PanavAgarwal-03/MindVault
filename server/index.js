const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true // Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser()); // Parse cookies

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mindvault';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// UploadThing route (must be before other routes)
const { createRouteHandler } = require("uploadthing/express");
const { fileRouter } = require("./uploadthing");

// Verify UploadThing credentials are loaded
// UploadThing supports both token-based (UPLOADTHING_TOKEN) and app-based (UPLOADTHING_SECRET + UPLOADTHING_APP_ID) auth
const hasToken = process.env.UPLOADTHING_TOKEN;
const hasAppCredentials = process.env.UPLOADTHING_SECRET && process.env.UPLOADTHING_APP_ID;

if (!hasToken && !hasAppCredentials) {
  console.warn('⚠️  WARNING: UploadThing credentials not found');
  console.warn('   Add either UPLOADTHING_TOKEN or UPLOADTHING_SECRET + UPLOADTHING_APP_ID to your .env file');
} else {
  console.log('✅ UploadThing credentials loaded successfully');
}

// UploadThing route handler
// Note: UploadThing reads credentials from process.env automatically
if (!hasToken && !hasAppCredentials) {
  console.error('❌ UploadThing credentials not found! UploadThing will not work.');
  console.error('   Please add credentials to your server/.env file and restart the server');
} else {
  try {
    app.use("/api/uploadthing", createRouteHandler({ 
      router: fileRouter,
    }));
    console.log('✅ UploadThing route handler configured at /api/uploadthing');
  } catch (error) {
    console.error('❌ Error setting up UploadThing:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Routes
app.use('/api', require('./routes/auth')); // Auth routes (login, signup, logout, me)
app.use('/api', require('./routes/save')); // Save and get thoughts (requires auth)
app.use('/api', require('./routes/search')); // Search thoughts (requires auth)
app.use('/api', require('./routes/upload')); // Upload files (requires auth - kept for backward compatibility)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MindVault API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});