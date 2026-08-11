/**
 * Shared Storage Wrapper - Universal chrome.storage.local abstraction
 * 
 * Used by both popup (storageService.js) and content scripts (storageSync.js)
 * to eliminate duplicate storage wrapper implementations.
 */

export function getStorage(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, (items) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve({});
        } else {
          resolve(items || {});
        }
      });
    } else {
      resolve({});
    }
  });
}

export function setStorage(payload) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(payload, () => {
        resolve();
      });
    } else {
      resolve({});
    }
  });
}
