import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UploadButton } from '@uploadthing/react';
import { saveThought, REASON_OPTIONS, DEFAULT_REASON } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Upload as UploadIcon, File, X, CheckCircle2, Loader2 } from 'lucide-react';

function Upload() {
  const navigate = useNavigate();
  const [type, setType] = useState('text');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [categories, setCategories] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Handle UploadThing upload completion
  const handleUploadComplete = useCallback(async (res) => {
    try {
      setUploading(false);
      if (!res || !res[0]?.url) {
        throw new Error('Upload failed - no URL returned');
      }

      const uploadedUrl = res[0].url;
      const fileName = res[0].name || 'uploaded-file';
      setFileUrl(uploadedUrl);
      setUploadedFileName(fileName);

      // Auto-detect type from file extension
      const ext = fileName.toLowerCase().split('.').pop();
      let detectedType = 'text';
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        detectedType = 'image';
      } else if (ext === 'gif') {
        detectedType = 'gif';
      } else if (ext === 'pdf') {
        detectedType = 'pdf';
      } else if (['doc', 'docx'].includes(ext)) {
        detectedType = 'doc';
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        detectedType = 'voice';
      }
      setType(detectedType);

      // Auto-fill title if empty
      if (!title) {
        setTitle(fileName.replace(/\.[^/.]+$/, '')); // Remove extension
      }

      // For PDFs, we can't extract text client-side with UploadThing
      // The backend will need to handle this, or we can skip it for now
      // Since the user wants to use UploadThing, we'll let the backend handle PDF processing

      showNotification('File uploaded successfully!', 'success');
    } catch (err) {
      console.error('Upload completion error:', err);
      setError(err.message || 'Failed to process uploaded file');
      setUploading(false);
    }
  }, [title]);

  // Handle UploadThing upload error
  const handleUploadError = useCallback((error) => {
    console.error('UploadThing error:', error);
    setError(`Upload failed: ${error.message || 'Unknown error'}`);
    setUploading(false);
  }, []);

  // Handle UploadThing upload start
  const handleUploadStart = useCallback(() => {
    setUploading(true);
    setError('');
    setSuccess(false);
  }, []);

  // Show notification helper
  const showNotification = (message, type) => {
    // Simple notification - you can replace with toast if needed
    console.log(`${type}: ${message}`);
  };

  // Save metadata to backend after file upload
  const handleSaveMetadata = async () => {
    if (!fileUrl && (type === 'image' || type === 'gif' || type === 'pdf' || type === 'doc' || type === 'voice')) {
      setError('Please upload a file first');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const topicUser = categories.split(',').map(c => c.trim()).filter(c => c);
      const data = {
        title: title || uploadedFileName || 'Untitled',
        description: description,
        reason: reason || DEFAULT_REASON,
        topicUser,
        type,
        url: fileUrl || (type === 'link' ? fileUrl : ''),
        pageText: description // Include description as pageText for AI processing
      };

      // Save metadata to backend
      await saveThought(data);

      // Show success message
      setSuccess(true);
      setError('');

      // Reset form
      setTitle('');
      setDescription('');
      setFileUrl('');
      setReason(DEFAULT_REASON);
      setCategories('');
      setUploadedFileName('');

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // If file was uploaded, save metadata
    if (fileUrl && (type === 'image' || type === 'gif' || type === 'pdf' || type === 'doc' || type === 'voice')) {
      await handleSaveMetadata();
      return;
    }

    // For text and link types, save directly
    if (type === 'text' || type === 'link') {
      await handleSaveMetadata();
      return;
    }

    // If no file uploaded for file types, show error
    setError('Please upload a file first');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="backdrop-blur-lg bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                Upload to MindVault
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <Select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setFileUrl('');
                      setUploadedFileName('');
                    }}
                  >
                    <option value="text">📝 Text</option>
                    <option value="link">🔗 Link</option>
                    <option value="image">🖼️ Image</option>
                    <option value="gif">🎬 GIF</option>
                    <option value="pdf">📄 PDF</option>
                    <option value="doc">📄 Document</option>
                    <option value="voice">🎤 Voice Note</option>
                  </Select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title *
                  </label>
                  <Input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter title"
                  />
                </div>

                {/* UploadThing Upload Button for File Types */}
                {(type === 'image' || type === 'gif' || type === 'voice' || type === 'pdf' || type === 'doc') && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-200 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      {uploading && (
                        <div className="flex flex-col items-center gap-2 mb-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">Uploading file...</p>
                        </div>
                      )}
                      
                      {fileUrl && !uploading && (
                        <div className="flex flex-col items-center gap-2 mb-4">
                          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {uploadedFileName || 'File uploaded successfully'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFileUrl('');
                              setUploadedFileName('');
                            }}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Remove file
                          </button>
                        </div>
                      )}

                      {!fileUrl && !uploading && (
                        <>
                          <UploadIcon className="h-12 w-12 mb-4 text-gray-400" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Upload your file
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Supports: {type === 'image' ? 'Images (JPG, PNG, WebP)' : type === 'pdf' ? 'PDFs' : type === 'doc' ? 'Documents (DOC, DOCX)' : type === 'voice' ? 'Audio files' : 'Files'}
                          </p>
                        </>
                      )}

                      <UploadButton
                        endpoint="fileUpload"
                        onClientUploadComplete={handleUploadComplete}
                        onUploadError={handleUploadError}
                        onUploadBegin={handleUploadStart}
                        appearance={{
                          button: "bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 transition-colors",
                          allowedContent: "text-xs text-gray-500 dark:text-gray-400 mt-2",
                        }}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">OR</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {type === 'voice' ? 'Audio URL' : 
                         type === 'pdf' ? 'PDF URL' :
                         type === 'doc' ? 'Document URL' :
                         'Image URL'}
                      </label>
                      <Input
                        type="url"
                        value={fileUrl}
                        onChange={(e) => setFileUrl(e.target.value)}
                        placeholder={`Enter ${type} URL`}
                      />
                    </div>
                  </div>
                )}

                {/* URL for Links */}
                {type === 'link' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      URL *
                    </label>
                    <Input
                      type="url"
                      required
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="4"
                    placeholder="Enter description or notes"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason
                  </label>
                  <Select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {REASON_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categories (comma-separated)
                  </label>
                  <Input
                    type="text"
                    value={categories}
                    onChange={(e) => setCategories(e.target.value)}
                    placeholder="e.g., AI, programming, design"
                  />
                </div>

                {/* Success Message */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-800 dark:text-green-200 flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Saved successfully to MindVault 🧠</span>
                  </motion.div>
                )}

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || uploading}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700"
                  size="lg"
                >
                  {loading || uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploading ? 'Uploading...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <UploadIcon className="h-4 w-4 mr-2" />
                      Save to MindVault
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default Upload;
