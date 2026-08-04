/**
 * Storage Service - Wrapper for Chrome Local Storage
 */

export const DEFAULT_BLACKLIST = [
  { domain: 'youtube.com', enabled: true },
  { domain: 'x.com', enabled: true },
  { domain: 'twitter.com', enabled: true },
  { domain: 'instagram.com', enabled: true },
  { domain: 'tiktok.com', enabled: true },
  { domain: 'facebook.com', enabled: true }
];

export const SENSITIVITY_STEPS = {
  1: 'lenient',
  2: 'balanced',
  3: 'strict'
};

export const SENSITIVITY_VALUES = {
  'lenient': 1,
  'balanced': 2,
  'strict': 3
};

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
      resolve();
    }
  });
}
