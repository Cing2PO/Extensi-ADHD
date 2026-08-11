/**
 * Shared Constants - Single source of truth for application-wide constants
 * 
 * Used by both popup (storageService.js) and content script (domainMatcher.js, storageSync.js).
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
