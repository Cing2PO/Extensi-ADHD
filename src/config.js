/**
 * Centralized Environment & Configuration Module for ADHD Focus Extension
 * 
 * Provides fallback endpoints for production and local development.
 */

const DEFAULT_CONFIG = {
  // Base Backend API URL
  BACKEND_BASE_URL: 'https://extensi-adhd-backend.vercel.app',
  
  // Specific Endpoint relative/absolute paths
  MAGIC_TODO_PATH: '/api/generate-todos',

  // WebSocket Server Endpoint for cross-platform alerts (Laravel Reverb / Mock)
  REVERB_WS_URL: 'ws://localhost:8000/app/reverb',

  // Network Timeout in MS
  API_TIMEOUT_MS: 8000
};

// Derived helper properties
export const ENV_CONFIG = {
  ...DEFAULT_CONFIG,
  get MAGIC_TODO_URL() {
    const base = this.BACKEND_BASE_URL.replace(/\/+$/, '');
    const path = this.MAGIC_TODO_PATH.startsWith('/') ? this.MAGIC_TODO_PATH : `/${this.MAGIC_TODO_PATH}`;
    return `${base}${path}`;
  }
};

// Attach to global window scope for non-module HTML popup scripts
if (typeof window !== 'undefined') {
  window.ENV_CONFIG = ENV_CONFIG;
}
