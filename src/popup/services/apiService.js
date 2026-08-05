/**
 * API Service - Handles HTTP requests to the Magic To-Do Backend API
 */

import { ENV_CONFIG } from '../../config.js';

export function getApiConfig() {
  return {
    MAGIC_TODO_URL: (window.ENV_CONFIG && window.ENV_CONFIG.MAGIC_TODO_URL) || ENV_CONFIG.MAGIC_TODO_URL,
    TIMEOUT_MS: (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 8000
  };
}

export async function fetchMagicTodos(taskText, totalMinutes, options = {}) {
  const config = getApiConfig();

  if (!config.MAGIC_TODO_URL) {
    throw new Error('URL Backend API tidak dikonfigurasi.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_MS || 8000);

  try {
    const response = await fetch(config.MAGIC_TODO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        userId: options.userId || 1,
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
      const errorMsg = data.message || `Gagal menghubungi API Backend (HTTP ${response.status})`;
      throw new Error(errorMsg);
    }

    const rawSteps = data.todos || data.steps || data.milestones || data.data;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new Error('API tidak mengembalikan langkah tugas yang valid.');
    }

    const perTaskMinutes = Math.max(5, Math.round(totalMinutes / rawSteps.length));
    return rawSteps.map(item => ({
      text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name),
      minutes: typeof item === 'object' ? (item.estimated_minutes || item.minutes || perTaskMinutes) : perTaskMinutes
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request ke API Backend mengalami RTO (Request Timeout).');
    }
    throw err;
  }
}
