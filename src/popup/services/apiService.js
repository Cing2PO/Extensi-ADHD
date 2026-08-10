/**
 * API Service - Handles HTTP requests to the Magic To-Do Backend API
 */

import { ENV_CONFIG } from '../../config.js';
import { getAuthSession, refreshAuthToken } from './authService.js';

export function getApiConfig() {
  return {
    MAGIC_TODO_URL: (window.ENV_CONFIG && window.ENV_CONFIG.MAGIC_TODO_URL) || ENV_CONFIG.MAGIC_TODO_URL,
    PUBLIC_MAGIC_TODO_URL: (window.ENV_CONFIG && window.ENV_CONFIG.PUBLIC_MAGIC_TODO_URL) || ENV_CONFIG.PUBLIC_MAGIC_TODO_URL,
    RECOMMEND_RESOURCES_URL: (window.ENV_CONFIG && window.ENV_CONFIG.RECOMMEND_RESOURCES_URL) || ENV_CONFIG.RECOMMEND_RESOURCES_URL,
    PUBLIC_RECOMMEND_RESOURCES_URL: (window.ENV_CONFIG && window.ENV_CONFIG.PUBLIC_RECOMMEND_RESOURCES_URL) || ENV_CONFIG.PUBLIC_RECOMMEND_RESOURCES_URL,
    TIMEOUT_MS: (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 35000
  };
}

/**
 * Fetch generated Magic To-Do list from public backend API (Guest Mode, No Auth Required)
 */
export async function fetchPublicMagicTodos(taskText, totalMinutes, options = {}) {
  const config = getApiConfig();
  const url = config.PUBLIC_MAGIC_TODO_URL;

  if (!url) {
    throw new Error('URL Backend Public API tidak dikonfigurasi.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_MS || 35000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        prompt: taskText,
        availableMinutes: Number(totalMinutes) || 60,
        workMinutes: options.workMinutes || 25,
        breakMinutes: options.breakMinutes || 5
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.message || `Gagal menghubungi Public API Backend (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    const rawSteps = data.todos || data.steps || data.milestones || data.data;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new Error('API tidak mengembalikan langkah tugas yang valid.');
    }

    const perTaskMinutes = Math.max(5, Math.round(totalMinutes / rawSteps.length));
    return rawSteps.map(item => ({
      id: typeof item === 'object' ? item.id : undefined,
      text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name),
      minutes: typeof item === 'object' ? (item.estimatedMinutes || item.estimated_minutes || item.minutes || perTaskMinutes) : perTaskMinutes
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request ke Public API Backend mengalami RTO (Request Timeout).');
    }
    throw err;
  }
}

/**
 * Fetch generated Magic To-Do list from backend API
 * (Automatically routes to Public API for Guests or Protected API for Logged-in Users)
 */
export async function fetchMagicTodos(taskText, totalMinutes, options = {}, isRetry = false) {
  const config = getApiConfig();

  if (!config.MAGIC_TODO_URL) {
    throw new Error('URL Backend API tidak dikonfigurasi.');
  }

  // Get current Bearer token
  const { accessToken } = await getAuthSession();
  
  // If user is Guest (no token), use Public API endpoint
  if (!accessToken) {
    return await fetchPublicMagicTodos(taskText, totalMinutes, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_MS || 35000);

  try {
    const response = await fetch(config.MAGIC_TODO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        prompt: taskText,
        availableMinutes: Number(totalMinutes) || 60,
        workMinutes: options.workMinutes || 25,
        breakMinutes: options.breakMinutes || 5
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle Token Expiry / 401 Unauthorized with single retry
    if (response.status === 401 && !isRetry) {
      try {
        await refreshAuthToken();
        return await fetchMagicTodos(taskText, totalMinutes, options, true);
      } catch (refreshErr) {
        // Fallback to public endpoint if session refresh fails
        return await fetchPublicMagicTodos(taskText, totalMinutes, options);
      }
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.message || `Gagal menghubungi API Backend (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    const rawSteps = data.todos || data.steps || data.milestones || data.data;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new Error('API tidak mengembalikan langkah tugas yang valid.');
    }

    const perTaskMinutes = Math.max(5, Math.round(totalMinutes / rawSteps.length));
    return rawSteps.map(item => ({
      id: typeof item === 'object' ? item.id : undefined,
      text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name),
      minutes: typeof item === 'object' ? (item.estimatedMinutes || item.estimated_minutes || item.minutes || perTaskMinutes) : perTaskMinutes
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request ke API Backend mengalami RTO (Request Timeout).');
    }
    throw err;
  }
}

/**
 * Fetch recommended learning resources or tools for a specific todo item from Gemini AI
 */
export async function fetchResourceRecommendations(todoText, isRetry = false) {
  const cleanTodo = (todoText || '').trim();
  if (!cleanTodo || cleanTodo.length < 3) {
    throw new Error('Deskripsi to-do minimal 3 karakter untuk rekomendasi.');
  }

  const config = getApiConfig();
  const { accessToken } = await getAuthSession();

  const url = accessToken
    ? (config.RECOMMEND_RESOURCES_URL || ENV_CONFIG.RECOMMEND_RESOURCES_URL)
    : (config.PUBLIC_RECOMMEND_RESOURCES_URL || ENV_CONFIG.PUBLIC_RECOMMEND_RESOURCES_URL);

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_MS || 35000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ todo: cleanTodo }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && accessToken && !isRetry) {
      try {
        await refreshAuthToken();
        return await fetchResourceRecommendations(cleanTodo, true);
      } catch {
        return await fetchPublicResourceRecommendations(cleanTodo);
      }
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.message || `Gagal mengambil rekomendasi (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    return Array.isArray(data.resources) ? data.resources : [];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request rekomendasi AI mengalami batas waktu (timeout).');
    }
    throw err;
  }
}

/**
 * Fetch recommended resources specifically via Public endpoint
 */
export async function fetchPublicResourceRecommendations(todoText) {
  const config = getApiConfig();
  const url = config.PUBLIC_RECOMMEND_RESOURCES_URL || ENV_CONFIG.PUBLIC_RECOMMEND_RESOURCES_URL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_MS || 35000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ todo: (todoText || '').trim() }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Gagal mengambil rekomendasi');
    }

    return Array.isArray(data.resources) ? data.resources : [];
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
