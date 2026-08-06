/**
 * Auth Service - Handles Authentication & Session Storage for Extensi-ADHD
 */

import { ENV_CONFIG } from '../../config.js';
import { getStorage, setStorage } from './storageService.js';

export const AUTH_STORAGE_KEYS = ['accessToken', 'refreshToken', 'currentUser'];

/**
 * Get current authenticated user session data from local storage
 */
export async function getAuthSession() {
  const data = await getStorage(AUTH_STORAGE_KEYS);
  return {
    accessToken: data.accessToken || null,
    refreshToken: data.refreshToken || null,
    currentUser: data.currentUser || null
  };
}

/**
 * Save auth session data to chrome local storage
 */
export async function saveAuthSession({ accessToken, refreshToken, user }) {
  await setStorage({
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    currentUser: user || null
  });
}

/**
 * Clear auth session data from storage (Logout cleanup)
 */
export async function clearAuthSession() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(AUTH_STORAGE_KEYS, () => resolve());
    });
  }
  await setStorage({ accessToken: null, refreshToken: null, currentUser: null });
}

/**
 * Login user via backend API
 */
export async function loginUser(email, password) {
  const url = ENV_CONFIG.AUTH_LOGIN_URL;
  const timeoutMs = ENV_CONFIG.API_TIMEOUT_MS || 8000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.message || data.error || `Login gagal (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    const { accessToken, refreshToken } = data.tokens || {};
    const user = data.user;

    await saveAuthSession({ accessToken, refreshToken, user });
    return { user, accessToken, refreshToken };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi login RTO (Request Timeout). Periksa server backend.');
    }
    throw err;
  }
}

/**
 * Register new user via backend API
 */
export async function registerUser(name, email, password) {
  const url = ENV_CONFIG.AUTH_REGISTER_URL;
  const timeoutMs = ENV_CONFIG.API_TIMEOUT_MS || 8000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ name, email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.message || data.error || `Registrasi gagal (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    const { accessToken, refreshToken } = data.tokens || {};
    const user = data.user;

    await saveAuthSession({ accessToken, refreshToken, user });
    return { user, accessToken, refreshToken };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi registrasi RTO (Request Timeout).');
    }
    throw err;
  }
}

/**
 * Silent token refresh
 */
export async function refreshAuthToken() {
  const { refreshToken: currentRefreshToken } = await getAuthSession();

  if (!currentRefreshToken) {
    await clearAuthSession();
    throw new Error('Sesi telah berakhir. Silakan login kembali.');
  }

  const url = ENV_CONFIG.AUTH_REFRESH_URL;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refreshToken: currentRefreshToken })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      await clearAuthSession();
      throw new Error(data.message || 'Sesi login kedaluwarsa.');
    }

    const { accessToken, refreshToken: newRefreshToken } = data.tokens || {};
    const { currentUser } = await getAuthSession();

    await saveAuthSession({
      accessToken,
      refreshToken: newRefreshToken || currentRefreshToken,
      user: currentUser
    });

    return accessToken;
  } catch (err) {
    await clearAuthSession();
    throw err;
  }
}

/**
 * Logout user session
 */
export async function logoutUser() {
  const { accessToken } = await getAuthSession();

  if (accessToken) {
    try {
      await fetch(ENV_CONFIG.AUTH_LOGOUT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
    } catch (e) {
      // Ignore network errors during logout
    }
  }

  await clearAuthSession();
}
