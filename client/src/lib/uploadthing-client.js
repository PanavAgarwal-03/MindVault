// UploadThing client configuration
// This file configures the UploadThing client to connect to your server endpoint

import { generateReactHelpers } from "@uploadthing/react";

// Import the file router from the server (for type safety)
// Note: In a real setup, you'd import from a shared types file
// For now, we'll use the generateReactHelpers without explicit typing

export const { useUploadThing, uploadFiles } = generateReactHelpers();

export const UPLOADTHING_URL = import.meta.env.VITE_UPLOADTHING_URL || 'http://localhost:5000/api/uploadthing';

