/**
 * API Service - Handles HTTP requests to the Magic To-Do Backend API
 */

import { ENV_CONFIG } from '../../config.js';

export function getApiConfig() {
  return {
    MAGIC_TODO_URL: (window.ENV_CONFIG && window.ENV_CONFIG.MAGIC_TODO_URL) || ENV_CONFIG.MAGIC_TODO_URL,
    TIMEOUT_MS: (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 8000,
    USE_MOCK_FALLBACK: (window.ENV_CONFIG && window.ENV_CONFIG.USE_MOCK_FALLBACK !== undefined) ? window.ENV_CONFIG.USE_MOCK_FALLBACK : true
  };
}

export function generateMockSteps(taskText) {
  const cleanTask = taskText.trim() || "tugas Anda";
  return [
    { text: `Persiapkan ruang kerja & buka aplikasi penunjang untuk "${cleanTask}"`, minutes: 5 },
    { text: `Bikin kerangka outline/konsep kasar isi dari "${cleanTask}"`, minutes: 10 },
    { text: `Fokus penuh kerjakan inti tugas "${cleanTask}" (pasang Brown Noise!)`, minutes: 15 },
    { text: `Merapikan hasil kerja akhir "${cleanTask}" dan simpan progress Anda`, minutes: 5 }
  ];
}

export async function fetchMagicTodos(taskText, totalMinutes) {
  const config = getApiConfig();
  let generatedSteps = null;

  try {
    if (config.MAGIC_TODO_URL) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_MS || 5000);

      const response = await fetch(config.MAGIC_TODO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ prompt: taskText }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const rawSteps = data.todos || data.steps || data.milestones || data.data;
        if (Array.isArray(rawSteps) && rawSteps.length > 0) {
          const perTaskMinutes = Math.max(5, Math.round(totalMinutes / rawSteps.length));
          generatedSteps = rawSteps.map(item => ({
            text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name),
            minutes: typeof item === 'object' ? (item.minutes || item.estimated_minutes || perTaskMinutes) : perTaskMinutes
          }));
        }
      }
    }
  } catch (err) {
    console.warn("[Magic To-Do API Notice] Fallback to local decomposer:", err.message);
  }

  if (!generatedSteps || !generatedSteps.length) {
    generatedSteps = generateMockSteps(taskText);
  }

  return generatedSteps;
}
