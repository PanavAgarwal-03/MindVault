// Content script for capturing page data

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    // Get currently selected text from the page
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    
    // Send response immediately
    sendResponse({ 
      selectedText: selectedText,
      text: selectedText // Also include as 'text' for compatibility
    });
    return true; // Keep message channel open for async response
  }
  return true;
});

// Note: We don't need to store selectedText in a variable anymore
// The selection is always available via window.getSelection()