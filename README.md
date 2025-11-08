# 🧠 MindVault – The AI-Powered Second Brain

Capture, organize, and recall anything — links, PDFs, ideas, images, or notes — using your AI-powered digital memory.

## ⚙️ Tech Stack

- **React + Tailwind** (Frontend)
- **Chrome Extension** (Instant Capture)
- **Node.js + Express + MongoDB** (Backend)
- **UploadThing** (Cloud File Storage)
- **Google Gemini 2.0 Flash Exp** (AI Categorization + Search)

## ✨ Key Features

- 🧠 **AI Categorization** (Type, Reason, Platform, Price, Keywords)
- 📚 **PDF, Image, Link, Text, Doc, and GIF support**
- ⌨️ **Quick Capture** (Ctrl + Shift + S / V)
- 🔎 **Natural Language Search** ("AI articles last week", "Products under ₹2000")
- 📆 **Date Range Filters**
- 🔐 **Simple Login & JWT Session**
- 🧹 **Clean Upload Dashboard** (manual & auto capture unified)

## 🚀 Run Locally

```bash
# Backend
cd server
npm install
npm start

# Frontend
cd client
npm install
npm run dev

# Extension
Load /extension in Chrome as "Load Unpacked"
```

## 🧩 Environment Variables

Create a `.env` file in the `server` directory:

```env
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
PORT=5000
CLIENT_URL=http://localhost:3000
UPLOADTHING_TOKEN=your_base64_encoded_token
```

**UploadThing Setup:**
1. Get your API key and App ID from [uploadthing.com/dashboard](https://uploadthing.com/dashboard)
2. Run: `cd server && node utils/createUploadThingToken.js`
3. Copy the generated token to `server/.env` as `UPLOADTHING_TOKEN`
4. UploadThing token must be a base64-encoded JSON: `{ apiKey, appId, regions }`

## 📁 Folder Structure

```
MindVault/
├── client/      # React app
├── server/      # Express backend
├── extension/   # Chrome extension
└── uploads/     # Legacy file storage (gitignored, now using UploadThing)
```

## 🎯 Usage

1. **Setup**: Install dependencies for server and client
2. **Configure**: Add your `.env` file in the server directory
3. **Start**: Run server and client in separate terminals
4. **Extension**: Load the extension in Chrome and login
5. **Capture**: Use Ctrl + Shift + S to save, Ctrl + Shift + V to view dashboard

## 📝 Notes

- All uploads go through the same AI classification pipeline
- Files are stored in UploadThing cloud storage (not on Express server)
- PDF text extraction: Backend handles PDF processing after upload
- Search supports natural language queries with date/price filters
- Extension auto-detects PDFs and changes UI accordingly
- Manual uploads use UploadThing for all file types (PDF, images, docs, GIFs)

## 🔧 Development

- Run `node server/utils/createUploadThingToken.js` to generate UploadThing token
- Make sure MongoDB is running before starting the server
- Extension requires reload after code changes (Chrome DevTools → Extensions → Reload)

© 2025 MindVault by Panav Agarwal

