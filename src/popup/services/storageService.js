/**
 * Storage Service - Popup-side re-export of shared storage wrapper and constants
 * 
 * All implementations are now in shared/ modules to eliminate duplication.
 */

export { getStorage, setStorage } from '../../shared/storageWrapper.js';
export { DEFAULT_BLACKLIST, SENSITIVITY_STEPS, SENSITIVITY_VALUES } from '../../shared/constants.js';
