import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './utils/toast'; // Initialize toast utility

// UploadThing doesn't require a provider - components work directly
// The UploadButton component connects to the server endpoint automatically
// Make sure VITE_UPLOADTHING_APP_ID is set in client/.env for proper configuration

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);