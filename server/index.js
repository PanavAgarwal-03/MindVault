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

// Verify UploadThing token is loaded
if (!process.env.UPLOADTHING_TOKEN) {
  console.warn('⚠️  WARNING: UPLOADTHING_TOKEN not found in environment variables');
  console.warn('   UploadThing uploads will not work. Please add UPLOADTHING_TOKEN to your .env file');
} else {
  console.log('✅ UploadThing token loaded successfully');
}

// UploadThing route handler
// Note: UploadThing reads UPLOADTHING_TOKEN from process.env automatically
// Make sure it's set in your .env file and server is restarted
if (!process.env.UPLOADTHING_TOKEN) {
  console.error('❌ UPLOADTHING_TOKEN not found! UploadThing will not work.');
  console.error('   Please add UPLOADTHING_TOKEN to your server/.env file');
  console.error('   Then restart your server');
} else {
  try {
    app.use("/api/uploadthing", createRouteHandler({ 
      router: fileRouter,
    }));
    console.log('✅ UploadThing route handler configured');
  } catch (error) {
    console.error('❌ Error setting up UploadThing:', error.message);
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