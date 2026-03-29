// ═══════════════════════════════════════════════════
//  AUTO CLICKER PRO – Background Service Worker
//  Relays messages between popup and content scripts
// ═══════════════════════════════════════════════════

// Forward status messages from content scripts to any open popups
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'status') {
    // The popup will also receive this directly via its own onMessage listener
    // This handler is here for potential future badge/icon updates

    // Update extension badge to show running state
    if (msg.running) {
      chrome.action.setBadgeText({ text: '●' });
      chrome.action.setBadgeBackgroundColor({ color: '#00ff88' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
  return false;
});

// Initialize badge
chrome.action.setBadgeText({ text: '' });
