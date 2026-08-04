/**
 * Content Script ES Module Loader for Manifest V3
 */
(async () => {
  try {
    const contentScriptUrl = chrome.runtime.getURL('src/content.js');
    await import(contentScriptUrl);
  } catch (err) {
    console.error("[ADHD Focus Coach] Failed to load modular content script:", err);
  }
})();
