/**
 * Storage Sync Module - Synchronizes storage state for Content Scripts
 */

import { DEFAULT_BLACKLIST } from './domainMatcher.js';

export function getStorageData(keys) {
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

export function setStorageData(payload) {
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

export function parseBlacklist(storedList) {
  if (storedList && Array.isArray(storedList)) {
    return storedList.map(item => {
      if (typeof item === 'string') return { domain: item, enabled: true };
      return item;
    });
  }
  return DEFAULT_BLACKLIST;
}
