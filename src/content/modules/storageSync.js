/**
 * Storage Sync Module - Content script re-export of shared storage wrapper
 * 
 * All implementations are now in shared/ modules to eliminate duplication.
 */

import { DEFAULT_BLACKLIST } from '../../shared/constants.js';
export { getStorage as getStorageData, setStorage as setStorageData } from '../../shared/storageWrapper.js';

export function parseBlacklist(storedList) {
  if (storedList && Array.isArray(storedList)) {
    return storedList.map(item => {
      if (typeof item === 'string') return { domain: item, enabled: true };
      return item;
    });
  }
  return DEFAULT_BLACKLIST;
}
