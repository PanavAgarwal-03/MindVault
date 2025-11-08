import { useState } from 'react';
import { motion } from 'framer-motion';
import ImageModal from './ImageModal';
import { deleteThought } from '../api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { X, ExternalLink } from 'lucide-react';
import '../utils/toast'; // Initialize toast utility

function ThoughtCard({ thought, onUpdate }) {
  const [previewImage, setPreviewImage] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFavicon = (url) => {
    if (!url) return '';
    try {
      const domain = new URL(url).hostname;
      // Use Google's favicon service for reliable favicon fetching
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return '';
    }
  };

  const getFileUrl = () => {
    if (thought.fileUrl) {
      return thought.fileUrl.startsWith('http') 
        ? thought.fileUrl 
        : `http://localhost:5000${thought.fileUrl}`;
    }
    return thought.imageUrl || '';
  };

  const getTypeIcon = (type) => {
    const icons = {
      text: '📝',
      link: '🔗',
      image: '🖼️',
      gif: '🎬',
      voice: '🎤',
      video: '🎥',
      product: '🛍️',
      note: '📄',
      social: '👥',
      pdf: '📄',
      doc: '📄'
    };
    return icons[type] || '📄';
  };

  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent card click
    
    if (!window.confirm('Are you sure you want to delete this thought?')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteThought(thought._id);
      // Show success toast
      if (window.showToast) {
        window.showToast('Thought deleted successfully.', 'success');
      } else {
        alert('Thought deleted successfully.');
      }
      // Notify parent to update list
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting thought:', error);
      if (window.showToast) {
        window.showToast('Failed to delete thought. Please try again.', 'error');
      } else {
        alert('Failed to delete thought. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderContent = () => {
    const type = thought.type || thought.contentType || 'text';
    const fileUrl = getFileUrl();

    switch (type) {
      case 'pdf':
      case 'doc':
        return (
          <div className="space-y-3">
            {thought.url && (
              <a
                href={thought.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm break-all block flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span>📄</span>
                <span>{thought.url}</span>
              </a>
            )}
            {fileUrl && thought.url !== fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm break-all block"
                onClick={(e) => e.stopPropagation()}
              >
                View File
              </a>
            )}
            {(thought.description || thought.selectedText) && (
              <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-3">
                {thought.description || thought.selectedText}
              </p>
            )}
          </div>
        );
      case 'link':
      case 'video':
        return (
          <div className="space-y-3">
            {/* Additional preview image if available and different from URL */}
            {fileUrl && fileUrl !== thought.url && (
              <img
                src={fileUrl}
                alt={thought.title}
                className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setPreviewImage(fileUrl)}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {/* Link URL display */}
            {thought.url && (
              <a
                href={thought.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm break-all block"
                onClick={(e) => e.stopPropagation()}
              >
                {thought.url}
              </a>
            )}
          </div>
        );

      case 'image':
      case 'gif':
        return (
          <div className="space-y-2">
            <div 
              className="cursor-pointer"
              onClick={() => {
                if (fileUrl) {
                  setPreviewImage(fileUrl);
                }
              }}
            >
              {fileUrl ? (
                <img
                  src={fileUrl}
                  alt={thought.title}
                  className="w-full h-48 object-cover rounded-lg hover:opacity-90 transition-opacity"
                  onError={(e) => {
                    e.target.parentElement.innerHTML = '<div class="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center"><span class="text-gray-400">Image not available</span></div>';
                  }}
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">No image</span>
                </div>
              )}
            </div>
            {/* AI-generated summary for images */}
            {thought.summary && (
              <p className="text-gray-500 dark:text-gray-400 text-xs italic px-2">
                "{thought.summary}"
              </p>
            )}
          </div>
        );

      case 'voice':
        return (
          <div className="space-y-2">
            {fileUrl && (
              <audio controls className="w-full" onClick={(e) => e.stopPropagation()}>
                <source src={fileUrl} />
                Your browser does not support the audio element.
              </audio>
            )}
            {thought.description && (
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {thought.description}
              </p>
            )}
          </div>
        );

      case 'text':
      case 'note':
      case 'product':
      case 'social':
      default:
        return (
          <div className="space-y-2">
            {thought.selectedText && (
              <p className="text-gray-700 dark:text-gray-300 line-clamp-3">
                {thought.selectedText}
              </p>
            )}
            {thought.description && !thought.selectedText && (
              <p className="text-gray-700 dark:text-gray-300 line-clamp-3">
                {thought.description}
              </p>
            )}
            {!thought.selectedText && !thought.description && (
              <p className="text-gray-500 dark:text-gray-400 italic">
                No content
              </p>
            )}
          </div>
        );
    }
  };

  const type = thought.type || thought.contentType || 'text';
  const fileUrl = getFileUrl();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="h-full"
      >
        <Card className="backdrop-blur-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 cursor-pointer relative h-full flex flex-col group overflow-hidden">
          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            title="Delete thought"
            aria-label="Delete thought"
          >
            {deleting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>

          {/* Favicon Banner for Links (shown at top of card) */}
          {(type === 'link' || type === 'video') && thought.url && (
            <a
              href={thought.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 flex items-center justify-center h-16 transition-all duration-200 group/link"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={getFavicon(thought.url)}
                alt="favicon"
                className="h-8 w-8 rounded-full"
                onError={(e) => {
                  // Fallback: show first letter of domain
                  e.target.style.display = 'none';
                  const parent = e.target.parentElement;
                  if (!parent.querySelector('.favicon-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'favicon-fallback h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm';
                    try {
                      const domain = new URL(thought.url).hostname;
                      fallback.textContent = domain.charAt(0).toUpperCase();
                    } catch {
                      fallback.textContent = '🔗';
                    }
                    parent.insertBefore(fallback, e.target);
                  }
                }}
              />
              <ExternalLink
                size={18}
                className="absolute right-4 text-gray-300 group-hover/link:text-white transition-colors"
              />
            </a>
          )}

          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2 pr-8">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xl flex-shrink-0">{getTypeIcon(type)}</span>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 truncate">
                  {thought.title}
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col space-y-3">
            {/* Content */}
            <div className="flex-1">
              {renderContent()}
            </div>

            {/* Badges and Metadata */}
            <div className="space-y-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
              {/* Reason Badge */}
              {thought.reason && (
                <Badge variant="secondary" className="text-xs">
                  💭 {thought.reason}
                </Badge>
              )}

              {/* Price */}
              {thought.price && (
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  💰 {typeof thought.price === 'number' ? `₹${thought.price.toLocaleString()}` : thought.price}
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {thought.topicAuto && (
                  <Badge variant="outline" className="text-xs">
                    #{thought.topicAuto}
                  </Badge>
                )}
                {thought.topicUser && thought.topicUser.map((topic, index) => (
                  <Badge key={index} variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-0">
                    {topic}
                  </Badge>
                ))}
                {thought.keywords && thought.keywords.length > 0 && thought.keywords.slice(0, 3).map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    🔑 {keyword}
                  </Badge>
                ))}
              </div>

              {/* Platform */}
              {thought.platform && thought.platform !== 'generic' && (
                <Badge variant="outline" className="text-xs">
                  {thought.platform}
                </Badge>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(thought.createdAt)}
                </span>
                {/* Visit Link */}
                {(type === 'link' || type === 'video' || type === 'pdf' || type === 'doc') && thought.url && (
                  <a
                    href={thought.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
                  >
                    {type === 'pdf' || type === 'doc' ? 'Open' : 'Visit'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImageModal 
          imageUrl={previewImage} 
          onClose={() => setPreviewImage(null)} 
        />
      )}
    </>
  );
}

export default ThoughtCard;