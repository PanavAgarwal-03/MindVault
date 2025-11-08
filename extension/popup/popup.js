// Popup script for MindVault

const API_BASE_URL = 'http://localhost:5000/api';

let currentTab = null;
let screenshotDataUrl = null;
let authToken = null;
let username = null;

// Check authentication status on load
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is logged in
  const storage = await chrome.storage.local.get(['token', 'username']);
  authToken = storage.token;
  username = storage.username;

  // Get current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    currentTab = tabs[0];
  }

  if (authToken) {
    // User is authenticated - show authenticated UI
    showAuthenticatedUI();
    
    // Auto-fill link fields if we have a current tab
    if (currentTab && currentTab.url && !currentTab.url.startsWith('chrome://')) {
      const tabStorage = await chrome.storage.local.get(['currentPageType', 'currentUrl', 'currentTitle']);
      const isPDF = tabStorage.currentPageType === 'pdf' || 
                    (currentTab.url && currentTab.url.toLowerCase().endsWith('.pdf'));
      
      const linkTitleEl = document.getElementById('linkTitle');
      const linkUrlEl = document.getElementById('linkUrl');
      const screenshotTitleEl = document.getElementById('screenshotTitle');
      
      if (isPDF) {
        // Handle PDF - change button text
        if (linkTitleEl) {
          linkTitleEl.value = tabStorage.currentTitle || currentTab.title || currentTab.url.split('/').pop();
        }
        if (linkUrlEl) {
          linkUrlEl.value = tabStorage.currentUrl || currentTab.url;
        }
        // Update button text for PDF
        await updateSaveLinkButton();
      } else {
        // Normal page
        if (linkTitleEl) linkTitleEl.value = currentTab.title || '';
        if (linkUrlEl) linkUrlEl.value = currentTab.url || '';
        if (screenshotTitleEl) screenshotTitleEl.value = currentTab.title || 'Screenshot';
        
        // Ensure button text is correct for links
        const saveLinkBtn = document.getElementById('saveLinkBtn');
        if (saveLinkBtn) {
          saveLinkBtn.textContent = '🔗 Save Link';
        }
        const saveLinkSubmit = document.getElementById('saveLinkSubmit');
        if (saveLinkSubmit) {
          saveLinkSubmit.textContent = 'Save';
        }
      }
    }

    // Check if shortcut was triggered
    // When shortcut is pressed, show main actions (not directly to save link)
    const shortcutStorage = await chrome.storage.local.get(['shortcutTriggered']);
    if (shortcutStorage.shortcutTriggered) {
      await chrome.storage.local.remove(['shortcutTriggered']);
      if (currentTab && currentTab.id) {
        chrome.action.setBadgeText({ text: '', tabId: currentTab.id });
      }
      // Show main actions (user chooses which action to take)
      showMainActions();
    } else {
      // No shortcut triggered - just show main actions normally
      showMainActions();
    }
  } else {
    // User is not authenticated - show login UI
    showLoginUI();
  }
});

// Show login UI
function showLoginUI() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('mainActions').classList.add('hidden');
  document.getElementById('saveLinkSection').classList.add('hidden');
  document.getElementById('saveTextSection').classList.add('hidden');
  document.getElementById('screenshotSection').classList.add('hidden');

  // Login button
  document.getElementById('loginSubmit').addEventListener('click', handleLogin);
  
  // Signup button - opens dashboard signup page
  document.getElementById('openSignup').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/signup' });
    window.close();
  });
}

// Show authenticated UI
function showAuthenticatedUI() {
  // Hide login section
  document.getElementById('loginSection').classList.add('hidden');
  
  // Hide all save sections
  document.getElementById('saveLinkSection').classList.add('hidden');
  document.getElementById('saveTextSection').classList.add('hidden');
  document.getElementById('screenshotSection').classList.add('hidden');
  
  // Show main actions
  document.getElementById('mainActions').classList.remove('hidden');

  // Remove existing event listeners by cloning and replacing elements (prevents duplicate listeners)
  // Main action buttons
  const saveLinkBtn = document.getElementById('saveLinkBtn');
  const saveTextBtn = document.getElementById('saveTextBtn');
  const takeScreenshotBtn = document.getElementById('takeScreenshotBtn');
  const viewDashboardBtn = document.getElementById('viewDashboardBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Clone buttons to remove old event listeners
  const newSaveLinkBtn = saveLinkBtn.cloneNode(true);
  const newSaveTextBtn = saveTextBtn.cloneNode(true);
  const newTakeScreenshotBtn = takeScreenshotBtn.cloneNode(true);
  const newViewDashboardBtn = viewDashboardBtn.cloneNode(true);
  const newLogoutBtn = logoutBtn.cloneNode(true);

  saveLinkBtn.parentNode.replaceChild(newSaveLinkBtn, saveLinkBtn);
  saveTextBtn.parentNode.replaceChild(newSaveTextBtn, saveTextBtn);
  takeScreenshotBtn.parentNode.replaceChild(newTakeScreenshotBtn, takeScreenshotBtn);
  viewDashboardBtn.parentNode.replaceChild(newViewDashboardBtn, viewDashboardBtn);
  logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

  // Add fresh event listeners
  newSaveLinkBtn.addEventListener('click', async () => {
    await updateSaveLinkButton();
    showSection('saveLink');
  });
  newSaveTextBtn.addEventListener('click', () => {
    loadSelectedText().then(() => {
      showSection('saveText');
    });
  });
  newTakeScreenshotBtn.addEventListener('click', () => {
    showSection('screenshot');
  });
  newViewDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
    window.close();
  });
  newLogoutBtn.addEventListener('click', handleLogout);

  // Save Link handlers
  const saveLinkSubmit = document.getElementById('saveLinkSubmit');
  const cancelLink = document.getElementById('cancelLink');
  const newSaveLinkSubmit = saveLinkSubmit.cloneNode(true);
  const newCancelLink = cancelLink.cloneNode(true);
  saveLinkSubmit.parentNode.replaceChild(newSaveLinkSubmit, saveLinkSubmit);
  cancelLink.parentNode.replaceChild(newCancelLink, cancelLink);
  newSaveLinkSubmit.addEventListener('click', handleSaveLink);
  newCancelLink.addEventListener('click', () => showMainActions());

  // Save Text handlers
  const saveTextSubmit = document.getElementById('saveTextSubmit');
  const cancelText = document.getElementById('cancelText');
  const newSaveTextSubmit = saveTextSubmit.cloneNode(true);
  const newCancelText = cancelText.cloneNode(true);
  saveTextSubmit.parentNode.replaceChild(newSaveTextSubmit, saveTextSubmit);
  cancelText.parentNode.replaceChild(newCancelText, cancelText);
  newSaveTextSubmit.addEventListener('click', handleSaveText);
  newCancelText.addEventListener('click', () => showMainActions());

  // Screenshot handlers
  const captureScreenshotBtn = document.getElementById('captureScreenshotBtn');
  const saveScreenshotSubmit = document.getElementById('saveScreenshotSubmit');
  const cancelScreenshot = document.getElementById('cancelScreenshot');
  const newCaptureScreenshotBtn = captureScreenshotBtn.cloneNode(true);
  const newSaveScreenshotSubmit = saveScreenshotSubmit.cloneNode(true);
  const newCancelScreenshot = cancelScreenshot.cloneNode(true);
  captureScreenshotBtn.parentNode.replaceChild(newCaptureScreenshotBtn, captureScreenshotBtn);
  saveScreenshotSubmit.parentNode.replaceChild(newSaveScreenshotSubmit, saveScreenshotSubmit);
  cancelScreenshot.parentNode.replaceChild(newCancelScreenshot, cancelScreenshot);
  newCaptureScreenshotBtn.addEventListener('click', captureScreenshot);
  newSaveScreenshotSubmit.addEventListener('click', handleSaveScreenshot);
  newCancelScreenshot.addEventListener('click', () => showMainActions());
}

// Handle login
async function handleLogin() {
  const usernameInput = document.getElementById('loginUsername').value.trim();
  const passwordInput = document.getElementById('loginPassword').value.trim();
  const errorDiv = document.getElementById('loginError');

  if (!usernameInput || !passwordInput) {
    errorDiv.textContent = 'Please enter username and password';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: usernameInput,
        password: passwordInput
      })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      // Store token and username
      authToken = data.token;
      username = data.user.username;
      await chrome.storage.local.set({
        token: authToken,
        username: username
      });

      // Update currentTab if we have it
      if (!currentTab) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          currentTab = tabs[0];
        }
      }

      // Show authenticated UI immediately - this sets up event listeners
      showAuthenticatedUI();
      
      // Auto-fill link fields if we have a current tab (prepare for future use)
      if (currentTab && currentTab.url && !currentTab.url.startsWith('chrome://')) {
        const storage = await chrome.storage.local.get(['currentPageType', 'currentUrl', 'currentTitle']);
        const isPDF = storage.currentPageType === 'pdf' || 
                      (currentTab.url && currentTab.url.toLowerCase().endsWith('.pdf'));
        
        const linkTitleEl = document.getElementById('linkTitle');
        const linkUrlEl = document.getElementById('linkUrl');
        const screenshotTitleEl = document.getElementById('screenshotTitle');
        
        if (isPDF) {
          if (linkTitleEl) {
            linkTitleEl.value = storage.currentTitle || currentTab.title || currentTab.url.split('/').pop();
          }
          if (linkUrlEl) {
            linkUrlEl.value = storage.currentUrl || currentTab.url;
          }
          // Update button text for PDF
          await updateSaveLinkButton();
        } else {
          if (linkTitleEl) linkTitleEl.value = currentTab.title || '';
          if (linkUrlEl) linkUrlEl.value = currentTab.url || '';
          if (screenshotTitleEl) screenshotTitleEl.value = currentTab.title || 'Screenshot';
        }
      }
      
      // Explicitly show main actions (not any specific section)
      // This ensures buttons are properly initialized and visible
      showMainActions();
      
      showNotification('Login successful!', 'success');
    } else {
      errorDiv.textContent = data.error || 'Login failed';
      errorDiv.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'Login failed. Please try again.';
    errorDiv.classList.remove('hidden');
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Call logout endpoint
    if (authToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear storage
    authToken = null;
    username = null;
    await chrome.storage.local.remove(['token', 'username']);
    
    // Show login UI
    showLoginUI();
    showNotification('Logged out successfully', 'success');
  }
}

function showMainActions() {
  // Hide all sections
  document.getElementById('saveLinkSection').classList.add('hidden');
  document.getElementById('saveTextSection').classList.add('hidden');
  document.getElementById('screenshotSection').classList.add('hidden');
  
  // Show main actions
  document.getElementById('mainActions').classList.remove('hidden');
  
  // Reset all main action button styles to secondary (they start as secondary in HTML)
  const saveLinkBtn = document.getElementById('saveLinkBtn');
  const saveTextBtn = document.getElementById('saveTextBtn');
  const takeScreenshotBtn = document.getElementById('takeScreenshotBtn');
  
  if (saveLinkBtn) {
    saveLinkBtn.className = 'btn btn-secondary';
  }
  if (saveTextBtn) {
    saveTextBtn.className = 'btn btn-secondary';
  }
  if (takeScreenshotBtn) {
    takeScreenshotBtn.className = 'btn btn-secondary';
  }
  
  // Update button texts based on current tab state (async)
  updateMainActionButtons();
}

// Update main action button texts based on current tab
async function updateMainActionButtons() {
  const saveLinkBtn = document.getElementById('saveLinkBtn');
  const saveTextBtn = document.getElementById('saveTextBtn');
  const takeScreenshotBtn = document.getElementById('takeScreenshotBtn');
  
  if (saveTextBtn) {
    saveTextBtn.textContent = '📝 Save Selected Text';
  }
  if (takeScreenshotBtn) {
    takeScreenshotBtn.textContent = '📸 Take Screenshot';
  }
  
  // Update save link button based on PDF detection
  if (saveLinkBtn && currentTab) {
    try {
      const storage = await chrome.storage.local.get(['currentPageType']);
      const isPDF = storage.currentPageType === 'pdf' || 
                    (currentTab.url && currentTab.url.toLowerCase().endsWith('.pdf'));
      saveLinkBtn.textContent = isPDF ? '📄 Save PDF' : '🔗 Save Link';
    } catch (error) {
      console.error('Error updating button text:', error);
      saveLinkBtn.textContent = '🔗 Save Link';
    }
  }
}

function showSection(section) {
  // Hide all sections and main actions
  document.getElementById('mainActions').classList.add('hidden');
  document.getElementById('saveLinkSection').classList.add('hidden');
  document.getElementById('saveTextSection').classList.add('hidden');
  document.getElementById('screenshotSection').classList.add('hidden');

  // Show the requested section
  switch (section) {
    case 'saveLink':
      document.getElementById('saveLinkSection').classList.remove('hidden');
      // Check if PDF and update button text
      updateSaveLinkButton();
      break;
    case 'saveText':
      document.getElementById('saveTextSection').classList.remove('hidden');
      break;
    case 'screenshot':
      document.getElementById('screenshotSection').classList.remove('hidden');
      break;
  }
}

// Update save link button text based on PDF detection
async function updateSaveLinkButton() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    const storage = await chrome.storage.local.get(['currentPageType']);
    const isPDF = storage.currentPageType === 'pdf' || 
                  (tabs[0].url && tabs[0].url.toLowerCase().endsWith('.pdf'));
    
    const saveLinkBtn = document.getElementById('saveLinkBtn');
    const saveLinkSubmit = document.getElementById('saveLinkSubmit');
    
    if (isPDF) {
      if (saveLinkBtn) {
        saveLinkBtn.textContent = '📄 Save PDF';
      }
      if (saveLinkSubmit) {
        saveLinkSubmit.textContent = '📄 Save PDF';
      }
    } else {
      if (saveLinkBtn) {
        saveLinkBtn.textContent = '🔗 Save Link';
      }
      if (saveLinkSubmit) {
        saveLinkSubmit.textContent = 'Save';
      }
    }
  }
}

async function loadSelectedText() {
  return new Promise((resolve) => {
    const textInput = document.getElementById('selectedText');
    textInput.disabled = false;
    textInput.value = 'Loading selected text...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) {
        textInput.value = 'No active tab found.';
        textInput.disabled = true;
        resolve();
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'getSelectedText' },
        (response) => {
          if (chrome.runtime.lastError) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            }).then(() => {
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  { action: 'getSelectedText' },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      textInput.value = 'No text selected. Please select text on the page and try again.';
                      textInput.disabled = true;
                    } else if (response && (response.selectedText || response.text)) {
                      const text = response.selectedText || response.text || '';
                      if (text.trim()) {
                        textInput.value = text;
                      } else {
                        textInput.value = 'No text selected. Please select text on the page and try again.';
                        textInput.disabled = true;
                      }
                    } else {
                      textInput.value = 'No text selected. Please select text on the page and try again.';
                      textInput.disabled = true;
                    }
                    resolve();
                  }
                );
              }, 200);
            }).catch((error) => {
              console.error('Error injecting content script:', error);
              textInput.value = 'Error: Could not access page content. Please refresh the page and try again.';
              textInput.disabled = true;
              resolve();
            });
          } else if (response && (response.selectedText || response.text)) {
            const text = response.selectedText || response.text || '';
            if (text.trim()) {
              textInput.value = text;
            } else {
              textInput.value = 'No text selected. Please select text on the page and try again.';
              textInput.disabled = true;
            }
            resolve();
          } else {
            textInput.value = 'No text selected. Please select text on the page and try again.';
            textInput.disabled = true;
            resolve();
          }
        }
      );
    });
  });
}

async function captureScreenshot() {
  try {
    const preview = document.getElementById('screenshotPreview');
    preview.innerHTML = '<p class="text-center text-gray-500">Capturing screenshot...</p>';

    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
      if (chrome.runtime.lastError) {
        preview.innerHTML = '<p class="text-center text-red-500">Error: ' + chrome.runtime.lastError.message + '</p>';
        return;
      }

      if (response && response.success && response.dataUrl) {
        screenshotDataUrl = response.dataUrl;
        preview.innerHTML = `<img src="${response.dataUrl}" alt="Screenshot">`;
        showNotification('Screenshot captured!', 'success');
      } else {
        preview.innerHTML = '<p class="text-center text-red-500">Error capturing screenshot. Please try again.</p>';
      }
    });
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    document.getElementById('screenshotPreview').innerHTML = '<p class="text-center text-red-500">Error capturing screenshot.</p>';
  }
}

async function handleSaveLink() {
  if (!authToken) {
    showNotification('Please login first', 'error');
    return;
  }

  const title = document.getElementById('linkTitle').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  // Remove reason - AI will determine it automatically
  const categories = document.getElementById('linkCategories').value.split(',').map(c => c.trim()).filter(c => c);

  if (!title) {
    showNotification('Please enter a title', 'error');
    return;
  }

  try {
    // Check if this is a PDF
    const storage = await chrome.storage.local.get(['currentPageType']);
    const isPDF = storage.currentPageType === 'pdf' || (url && url.toLowerCase().endsWith('.pdf'));
    
    let pageText = '';
    let type = 'link';
    
    if (isPDF) {
      type = 'pdf';
      // For PDFs, we'll send the URL to the backend
      // The backend can process it if needed
      // Client-side PDF extraction in extensions is complex due to CORS
      // So we'll just send the URL and let backend handle categorization
      pageText = ''; // Can be filled by user if needed
      showNotification('PDF detected - will be saved with URL', 'info');
    }

    const data = {
      title,
      url,
      type: type,
      // Reason will be auto-detected by AI on backend
      topicUser: categories,
      pageText: pageText || undefined
      // topicAuto and reason will be auto-detected by backend AI
    };

    await saveThought(data);
    showNotification('Saved successfully to MindVault 🧠', 'success');
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    console.error('Error saving link:', error);
    showNotification('Error saving: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Extract text from PDF using pdf.js
// Note: For Chrome extensions, we'll use a simpler approach - just send the PDF URL
// and let the backend handle extraction if needed, or use CDN version
async function extractPDFText(url, arrayBuffer) {
  try {
    // Try to use pdf.js from CDN (may have CORS issues)
    // Alternative: Send PDF URL to backend for processing
    // For now, we'll skip client-side extraction and let backend handle it
    // This avoids CORS and extension complexity
    
    // If you want client-side extraction, you'd need to:
    // 1. Bundle pdf.js with the extension
    // 2. Or use a service worker to fetch and parse
    
    // For simplicity, return empty string - backend can process PDF URL
    console.log('PDF detected, URL will be sent to backend for processing');
    return '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    // Fallback: return empty string, backend can still process the PDF URL
    return '';
  }
}

async function handleSaveText() {
  if (!authToken) {
    showNotification('Please login first', 'error');
    return;
  }

  const selectedText = document.getElementById('selectedText').value.trim();
  const reason = document.getElementById('textReason').value || 'to view later';
  const categories = document.getElementById('textCategories').value.split(',').map(c => c.trim()).filter(c => c);

  if (!selectedText || 
      selectedText === 'No text selected. Please select text on the page and try again.' ||
      selectedText === 'Loading selected text...') {
    showNotification('Please select text on the page first', 'error');
    return;
  }

  try {
    const data = {
      title: selectedText.substring(0, 100) + (selectedText.length > 100 ? '...' : ''),
      description: selectedText,
      selectedText: selectedText,
      url: currentTab ? currentTab.url : '',
      type: 'text',
      reason,
      topicUser: categories
      // topicAuto will be auto-detected by backend based on URL domain
    };

    await saveThought(data);
    showNotification('Saved successfully to MindVault 🧠', 'success');
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    console.error('Error saving text:', error);
    showNotification('Error saving: ' + (error.message || 'Unknown error'), 'error');
  }
}

async function handleSaveScreenshot() {
  if (!authToken) {
    showNotification('Please login first', 'error');
    return;
  }

  if (!screenshotDataUrl) {
    showNotification('Please take a screenshot first', 'error');
    return;
  }

  const title = document.getElementById('screenshotTitle').value.trim() || 'Screenshot';
  const reason = document.getElementById('screenshotReason').value || 'to view later';
  const categories = document.getElementById('screenshotCategories').value.split(',').map(c => c.trim()).filter(c => c);

  try {
    // Convert data URL to blob
    const response = await fetch(screenshotDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'screenshot.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('type', 'image');
    formData.append('reason', reason);
    formData.append('topicUser', JSON.stringify(categories));
    // topicAuto will be auto-detected by backend

    await uploadFile(formData);
    showNotification('Saved successfully to MindVault 🧠', 'success');
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    console.error('Error saving screenshot:', error);
    showNotification('Error saving: ' + (error.message || 'Unknown error'), 'error');
  }
}

async function saveThought(data) {
  const response = await fetch(`${API_BASE_URL}/saveThought`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save thought');
  }

  return await response.json();
}

async function uploadFile(formData) {
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }

  return await response.json();
}

// Domain categorization is now handled by backend
// This function is kept for backwards compatibility but not used
function getDomainCategory(hostname) {
  // Backend will handle domain categorization automatically
  return null; // Let backend decide
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  const bgColor = type === 'success' ? '#10b981' : 
                  type === 'info' ? '#3b82f6' : 
                  '#ef4444';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    font-size: 14px;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, type === 'info' ? 5000 : 3000);
}