/**
 * Centralized Environment & Configuration Module for ADHD Focus Extension
 * 
 * Provides fallback endpoints for production and local development.
 */

const DEFAULT_CONFIG = {
  // Base Backend API URL
  // BACKEND_BASE_URL: 'https://extensi-adhd-backend.vercel.app',
  BACKEND_BASE_URL: 'http://localhost:3000',

  // Specific Endpoint relative/absolute paths
  MAGIC_TODO_PATH: '/api/generate-todos',
  AUTH_LOGIN_PATH: '/api/auth/login',
  AUTH_REGISTER_PATH: '/api/auth/register',
  AUTH_REFRESH_PATH: '/api/auth/refresh',
  AUTH_LOGOUT_PATH: '/api/auth/logout',

  // WebSocket Server Endpoint for cross-platform alerts (Laravel Reverb / Mock)
  REVERB_WS_URL: 'ws://localhost:8000/app/reverb',

  // Network Timeout in MS
  API_TIMEOUT_MS: 8000
};

// Helper internal for URL resolution
function resolveUrl(baseUrl, relativePath) {
  const base = baseUrl.replace(/\/+$/, '');
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}

// Derived helper properties
export const ENV_CONFIG = {
  ...DEFAULT_CONFIG,
  get MAGIC_TODO_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.MAGIC_TODO_PATH);
  },
  get AUTH_LOGIN_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.AUTH_LOGIN_PATH);
  },
  get AUTH_REGISTER_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.AUTH_REGISTER_PATH);
  },
  get AUTH_REFRESH_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.AUTH_REFRESH_PATH);
  },
  get AUTH_LOGOUT_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.AUTH_LOGOUT_PATH);
  }
};

// Attach to global window scope for non-module HTML popup scripts
if (typeof window !== 'undefined') {
  window.ENV_CONFIG = ENV_CONFIG;
}
