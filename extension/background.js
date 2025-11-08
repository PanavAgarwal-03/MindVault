// Background service worker for MindVault

chrome.runtime.onInstalled.addListener(() => {
  console.log('MindVault extension installed');
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-page') {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0 && tabs[0].id) {
        const tabId = tabs[0].id;
        const tabUrl = tabs[0].url;
        
        // Skip special Chrome pages
        if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || 
            tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
          console.log('Cannot save from Chrome internal pages');
          return;
        }
        
        // Store context that popup should open with shortcut trigger
        await chrome.storage.local.set({
          shortcutTriggered: true,
          tabId: tabId,
          tabUrl: tabUrl,
          tabTitle: tabs[0].title
        });
        
        // Try to open popup automatically (may not work in all contexts in MV3)
        // This will fail silently if not allowed, which is expected behavior
        try {
          await chrome.action.openPopup();
        } catch (error) {
          // If openPopup fails (common in MV3), show badge as fallback
          console.log('Cannot open popup programmatically, showing badge instead');
          chrome.action.setBadgeText({ text: '!', tabId: tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
        }
      }
    } catch (error) {
      console.error('Error in keyboard shortcut handler:', error);
    }
  } else if (command === 'open-dashboard') {
    // Open dashboard in new tab
    chrome.tabs.create({ url: 'http://localhost:3000' });
  }
});

// Clear badge when popup opens
chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs.length > 0) {
    chrome.action.setBadgeText({ text: '', tabId: tabs[0].id });
  }
});

// Detect PDF URLs and store page type
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url.toLowerCase();
    // Check if URL ends with .pdf or contains application/pdf
    if (url.endsWith('.pdf') || url.includes('application/pdf') || 
        tab.mimeType === 'application/pdf') {
      chrome.storage.local.set({ 
        currentPageType: 'pdf', 
        currentUrl: tab.url,
        currentTitle: tab.title || tab.url.split('/').pop()
      });
      console.log('PDF detected:', tab.url);
    } else {
      chrome.storage.local.set({ 
        currentPageType: 'normal', 
        currentUrl: tab.url,
        currentTitle: tab.title || ''
      });
    }
  }
});

// Also check on tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const url = tab.url.toLowerCase();
      if (url.endsWith('.pdf') || url.includes('application/pdf') || 
          tab.mimeType === 'application/pdf') {
        chrome.storage.local.set({ 
          currentPageType: 'pdf', 
          currentUrl: tab.url,
          currentTitle: tab.title || tab.url.split('/').pop()
        });
      } else {
        chrome.storage.local.set({ 
          currentPageType: 'normal', 
          currentUrl: tab.url,
          currentTitle: tab.title || ''
        });
      }
    }
  } catch (error) {
    console.error('Error detecting PDF on tab activation:', error);
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'getSelectedText') {
      // Forward to content script to get selected text
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedText' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ selectedText: '', error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response || { selectedText: '' });
            }
          });
        } else {
          sendResponse({ selectedText: '' });
        }
      });
      return true; // Keep channel open for async response
    } else if (request.action === 'captureScreenshot') {
      // Capture screenshot
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true, dataUrl: dataUrl });
            }
          });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
      return true; // Keep channel open for async response
    } else if (request.action) {
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true;
});