const { createUploadthing } = require("uploadthing/express");

// UploadThing requires the token/credentials to be available
// It will read from process.env.UPLOADTHING_TOKEN or UPLOADTHING_SECRET/UPLOADTHING_APP_ID automatically
// Make sure they're set in your .env file and the server has been restarted
const f = createUploadthing();

const fileRouter = {
  fileUpload: f({
    image: { maxFileSize: "10MB", maxFileCount: 1 },
    pdf: { maxFileSize: "20MB", maxFileCount: 1 },
    doc: { maxFileSize: "10MB", maxFileCount: 1 },
    gif: { maxFileSize: "5MB", maxFileCount: 1 },
  })
    .onUploadComplete(async ({ file }) => {
      console.log("✅ File uploaded successfully:", file.url);
      return { fileUrl: file.url };
    }),
};

module.exports = { fileRouter };

