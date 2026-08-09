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
  PUBLIC_MAGIC_TODO_PATH: '/api/public/generate-todos',
  PROJECTS_PATH: '/api/projects',
  AUTH_LOGIN_PATH: '/api/auth/login',
  AUTH_REGISTER_PATH: '/api/auth/register',
  AUTH_REFRESH_PATH: '/api/auth/refresh',
  AUTH_LOGOUT_PATH: '/api/auth/logout',

  // WebSocket Server Endpoint for cross-platform alerts (Laravel Reverb / Mock)
  REVERB_WS_URL: 'ws://localhost:8000/app/reverb',

  // Socket.IO WebSocket Deployment URL for Pomodoro sync
  SOCKET_IO_URL: 'https://extensi-adhd-websocket.onrender.com',

  // Sync Room endpoint (always uses production backend)
  SYNC_BACKEND_BASE_URL: 'https://extensi-adhd-backend.vercel.app',
  SYNC_ROOM_PATH: '/sync/getroomid',

  // Network Timeout in MS (Increased to 35s to allow Gemini AI generation)
  API_TIMEOUT_MS: 35000
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
  get PUBLIC_MAGIC_TODO_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.PUBLIC_MAGIC_TODO_PATH);
  },
  get PROJECTS_URL() {
    return resolveUrl(this.BACKEND_BASE_URL, this.PROJECTS_PATH);
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
  },
  get SYNC_ROOM_URL() {
    return resolveUrl(this.SYNC_BACKEND_BASE_URL, this.SYNC_ROOM_PATH);
  }
};

// Attach to global window scope for non-module HTML popup scripts
if (typeof window !== 'undefined') {
  window.ENV_CONFIG = ENV_CONFIG;
}
