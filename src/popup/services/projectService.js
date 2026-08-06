/**
 * Project Service - Handles Project Fetching, Resuming, Mark Done, and Deleting Todos via Backend API
 */

import { ENV_CONFIG } from '../../config.js';
import { getAuthSession, refreshAuthToken } from './authService.js';
import { getStorage } from './storageService.js';

// Mock projects for preview when user is Guest or before GET /api/projects is deployed
export const MOCK_PROJECTS = [
  {
    id: 1,
    name: 'Belajar Machine Learning Dasar',
    totalTodos: 5,
    undoneTodos: 3,
    createdAt: '2026-08-06T10:00:00.000Z'
  },
  {
    id: 2,
    name: 'Pengembangan Fitur Extensi-ADHD',
    totalTodos: 8,
    undoneTodos: 4,
    createdAt: '2026-08-06T12:30:00.000Z'
  }
];

/**
 * Get active projects for preview (Combines local storage projects & mock data)
 */
export async function getSavedProjects() {
  const data = await getStorage(['userProjects', 'magicTaskState']);
  const localProjects = Array.isArray(data.userProjects) ? data.userProjects : [];

  // If active magicTaskState exists and has projectId, make sure it's in the list
  if (data.magicTaskState && data.magicTaskState.projectId) {
    const existingIndex = localProjects.findIndex(p => p.id === data.magicTaskState.projectId);
    const currentProjectObj = {
      id: data.magicTaskState.projectId,
      name: data.magicTaskState.taskName || 'Proyek Aktif',
      totalTodos: data.magicTaskState.steps ? data.magicTaskState.steps.length : 0,
      undoneTodos: data.magicTaskState.steps ? data.magicTaskState.steps.filter(s => !s.completed).length : 0,
      createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      localProjects[existingIndex] = currentProjectObj;
    } else {
      localProjects.unshift(currentProjectObj);
    }
  }

  // Deduplicate and combine with mock projects if empty
  const combined = [...localProjects];
  for (const mockP of MOCK_PROJECTS) {
    if (!combined.some(p => p.id === mockP.id)) {
      combined.push(mockP);
    }
  }

  return combined;
}

/**
 * Resume project based on available effective time via backend API
 * POST /api/projects/:projectId/todos
 */
export async function resumeProject(projectId, availableMinutes, options = {}, isRetry = false) {
  const baseUrl = (window.ENV_CONFIG && window.ENV_CONFIG.BACKEND_BASE_URL) || ENV_CONFIG.BACKEND_BASE_URL;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/projects/${projectId}/todos`;
  const timeoutMs = (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 8000;

  const { accessToken } = await getAuthSession();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({
        availableMinutes: Number(availableMinutes) || 30,
        workMinutes: options.workMinutes || 25,
        breakMinutes: options.breakMinutes || 5
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && !isRetry && accessToken) {
      try {
        await refreshAuthToken();
        return await resumeProject(projectId, availableMinutes, options, true);
      } catch (err) {
        throw new Error('Sesi kedaluwarsa. Silakan login kembali.');
      }
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Gagal memuat sisa to-do proyek (HTTP ${response.status})`);
    }

    const rawTodos = data.todos || [];
    const steps = rawTodos.map(item => ({
      id: item.id,
      text: item.task || item.text,
      minutes: item.estimatedMinutes || item.estimated_minutes || 15,
      completed: !!item.isDone,
      selected: item.selected !== false
    }));

    return {
      projectId: data.projectId || projectId,
      projectName: data.projectName || 'Proyek Lanjutan',
      steps,
      config: data.config,
      schedule: data.schedule
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi RTO saat melanjutkan proyek.');
    }
    throw err;
  }
}

/**
 * Mark a specific todo as done on backend
 * PATCH /api/todos/:todoId/done
 */
export async function markTodoDoneOnBackend(todoId) {
  if (!todoId) return;
  const { accessToken } = await getAuthSession();
  if (!accessToken) return;

  const baseUrl = (window.ENV_CONFIG && window.ENV_CONFIG.BACKEND_BASE_URL) || ENV_CONFIG.BACKEND_BASE_URL;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/todos/${todoId}/done`;

  try {
    await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
  } catch (e) {
    console.warn('[ProjectService] Failed to sync todo done state:', e);
  }
}

/**
 * Delete a specific todo on backend
 * DELETE /api/todos/:todoId
 */
export async function deleteTodoOnBackend(todoId) {
  if (!todoId) return;
  const { accessToken } = await getAuthSession();
  if (!accessToken) return;

  const baseUrl = (window.ENV_CONFIG && window.ENV_CONFIG.BACKEND_BASE_URL) || ENV_CONFIG.BACKEND_BASE_URL;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/todos/${todoId}`;

  try {
    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
  } catch (e) {
    console.warn('[ProjectService] Failed to sync todo deletion:', e);
  }
}
