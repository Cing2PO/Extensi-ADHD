/**
 * Auth Service - Handles Authentication & Session Storage for Extensi-ADHD
 */

import { ENV_CONFIG } from '../../config.js';
import { getStorage, setStorage } from './storageService.js';

export const AUTH_STORAGE_KEYS = ['accessToken', 'refreshToken', 'currentUser', 'syncRoomId'];

/**
 * Get current authenticated user session data from local storage
 */
export async function getAuthSession() {
  const data = await getStorage(AUTH_STORAGE_KEYS);
  return {
    accessToken: data.accessToken || null,
    refreshToken: data.refreshToken || null,
    currentUser: data.currentUser || null,
    roomId: data.syncRoomId || null
  };
}

/**
 * Save auth session data to chrome local storage
 */
export async function saveAuthSession({ accessToken, refreshToken, user, roomId }) {
  const payload = {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    currentUser: user || null
  };
  // Only overwrite syncRoomId if a new one was provided
  if (roomId) {
    payload.syncRoomId = roomId;
  }
  await setStorage(payload);
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
  const timeoutMs = ENV_CONFIG.API_TIMEOUT_MS || 35000;

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

    const accessToken = data.accessToken || data.tokens?.accessToken || data.data?.accessToken;
    const refreshToken = data.refreshToken || data.tokens?.refreshToken || data.data?.refreshToken;
    const user = data.user || data.data?.user;
    const roomId = data.roomId || null;

    await saveAuthSession({ accessToken, refreshToken, user, roomId });
    return { user, accessToken, refreshToken, roomId };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi login RTO (Request Timeout). Periksa server backend.');
    }
    if (err.message === 'Failed to fetch' || err instanceof TypeError) {
      throw new Error(`Gagal terhubung ke server backend (${url}). Pastikan server online.`);
    }
    throw err;
  }
}

/**
 * Register new user via backend API
 */
export async function registerUser(name, email, password) {
  const url = ENV_CONFIG.AUTH_REGISTER_URL;
  const timeoutMs = ENV_CONFIG.API_TIMEOUT_MS || 35000;

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

    const accessToken = data.accessToken || data.tokens?.accessToken || data.data?.accessToken;
    const refreshToken = data.refreshToken || data.tokens?.refreshToken || data.data?.refreshToken;
    const user = data.user || data.data?.user;
    const roomId = data.roomId || null;

    await saveAuthSession({ accessToken, refreshToken, user, roomId });
    return { user, accessToken, refreshToken, roomId };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi registrasi RTO (Request Timeout).');
    }
    if (err.message === 'Failed to fetch' || err instanceof TypeError) {
      throw new Error(`Gagal terhubung ke server backend (${url}). Pastikan server online.`);
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
    console.log('[Auth Service] Refreshing access token via:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refreshToken: currentRefreshToken })
    });

    const data = await response.json();
    const accessToken = data.accessToken || data.tokens?.accessToken || data.data?.accessToken;
    const newRefreshToken = data.refreshToken || data.tokens?.refreshToken || data.data?.refreshToken || currentRefreshToken;

    if (!response.ok || !accessToken) {
      await clearAuthSession();
      throw new Error(data.message || data.error || 'Sesi login kedaluwarsa. Silakan login kembali.');
    }

    const { currentUser } = await getAuthSession();

    await saveAuthSession({
      accessToken,
      refreshToken: newRefreshToken,
      user: data.user || currentUser
    });

    console.log('[Auth Service] Token refreshed successfully!');
    return accessToken;
  } catch (err) {
    console.error('[Auth Service] Token refresh failed:', err);
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

/**
 * Generate a one-time QR login token for cross-device pairing.
 * The generated token can be encoded into a QR code for mobile to scan.
 * @returns {Promise<string>} The one-time login token (hex string)
 */
export async function generateQrToken() {
  const { accessToken } = await getAuthSession();
  if (!accessToken) {
    throw new Error('Login diperlukan untuk membuat QR Code.');
  }

  const url = ENV_CONFIG.AUTH_GENERATE_QR_URL;
  const timeoutMs = ENV_CONFIG.API_TIMEOUT_MS || 35000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.message || data.error || `Gagal generate QR token (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    const loginToken = data.loginTokens || data.loginToken || data.token;
    if (!loginToken) {
      throw new Error('Server tidak mengembalikan login token.');
    }

    console.log('[Auth Service] QR login token generated successfully.');
    return loginToken;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Timeout saat membuat QR token.');
    }
    if (err.message === 'Failed to fetch' || err instanceof TypeError) {
      throw new Error(`Gagal terhubung ke server backend (${url}).`);
    }
    throw err;
  }
}
