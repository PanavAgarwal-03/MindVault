const { createUploadthing } = require("uploadthing/express");

// UploadThing requires the token to be available
// It will read from process.env.UPLOADTHING_TOKEN automatically
// Make sure it's set in your .env file and the server has been restarted
const f = createUploadthing();

const fileRouter = {
  fileUpload: f({
    pdf: { maxFileSize: "10MB", maxFileCount: 1 },
    image: { maxFileSize: "10MB", maxFileCount: 1 },
    video: { maxFileSize: "50MB", maxFileCount: 1 },
    audio: { maxFileSize: "10MB", maxFileCount: 1 },
    blob: { maxFileSize: "10MB", maxFileCount: 1 }, // Generic file type for docs
  })
    .middleware(async (req, res) => {
      // Optional: Add authentication middleware here
      // For now, we'll handle auth in the route itself
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      console.log("File uploaded:", file.url);
      return { fileUrl: file.url };
    }),
};

module.exports = { fileRouter };

