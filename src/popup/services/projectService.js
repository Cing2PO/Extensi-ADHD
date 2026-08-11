/**
 * Project Service - Handles Project Fetching, Resuming, Mark Done, and Deleting Todos via Backend API
 */

import { ENV_CONFIG } from '../../config.js';
import { getAuthSession, refreshAuthToken } from './authService.js';
import { getStorage } from './storageService.js';

/**
 * Fetch list of active projects for logged-in user from backend API
 * GET /api/projects
 */
export async function fetchUserProjects(isRetry = false) {
  const projectsUrl = (window.ENV_CONFIG && window.ENV_CONFIG.PROJECTS_URL) || ENV_CONFIG.PROJECTS_URL;
  const timeoutMs = (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 35000;

  const { accessToken } = await getAuthSession();
  if (!accessToken) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && !isRetry) {
      try {
        await refreshAuthToken();
        return await fetchUserProjects(true);
      } catch (err) {
        return [];
      }
    }

    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.projects)) {
      return [];
    }

    return data.projects.map(p => ({
      id: p.id,
      name: p.name,
      userId: p.userId,
      isDone: !!p.isDone,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[ProjectService] Failed to fetch user projects from backend:', err);
    return [];
  }
}

/**
 * Get active projects for preview (Combines real backend projects & local storage state)
 */
export async function getSavedProjects() {
  const data = await getStorage(['userProjects', 'magicTaskState']);
  const localProjects = Array.isArray(data.userProjects) ? data.userProjects : [];

  // Fetch real projects from backend if user is authenticated
  const backendProjects = await fetchUserProjects();

  // Map backend projects to UI cards shape
  const apiProjects = backendProjects.filter(p => !p.isDone).map(p => ({
    id: p.id,
    name: p.name,
    undoneTodos: 'Aktif',
    createdAt: p.createdAt
  }));

  // Combine apiProjects and localProjects
  const combined = [...apiProjects];
  for (const locP of localProjects) {
    if (!combined.some(p => p.id === locP.id)) {
      combined.push(locP);
    }
  }

  // If active magicTaskState exists, make sure it's in the list
  if (data.magicTaskState && data.magicTaskState.taskName) {
    const projId = data.magicTaskState.projectId || 'local-active-task';
    const existingIndex = combined.findIndex(p => p.id === projId);
    const undoneCount = data.magicTaskState.steps ? data.magicTaskState.steps.filter(s => !s.completed).length : 0;
    const currentProjectObj = {
      id: projId,
      name: data.magicTaskState.taskName || 'Proyek Aktif',
      totalTodos: data.magicTaskState.steps ? data.magicTaskState.steps.length : 0,
      undoneTodos: `${undoneCount} sisa to-do`,
      createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      combined[existingIndex] = { ...combined[existingIndex], ...currentProjectObj };
    } else {
      combined.unshift(currentProjectObj);
    }
  }

  return combined;
}

/**
 * Get completed projects (Combines backend projects where isDone === true & local completed projects)
 */
export async function getCompletedProjects() {
  const data = await getStorage(['completedProjects', 'userProjects']);
  const localCompleted = Array.isArray(data.completedProjects) ? data.completedProjects : [];
  const localProjects = Array.isArray(data.userProjects) ? data.userProjects : [];

  // Fetch real projects from backend if authenticated
  const backendProjects = await fetchUserProjects();

  // Filter backend completed projects
  const apiCompleted = backendProjects.filter(p => p.isDone).map(p => ({
    id: p.id,
    name: p.name,
    isDone: true,
    completedAt: p.updatedAt || p.createdAt,
    statusText: 'Selesai'
  }));

  const combined = [...apiCompleted];

  // Also include local projects marked as completed
  for (const locP of localCompleted) {
    if (!combined.some(p => p.id === locP.id)) {
      combined.push({
        id: locP.id || `local-comp-${Date.now()}`,
        name: locP.name || locP.taskName || 'Proyek Selesai',
        isDone: true,
        steps: locP.steps || [],
        completedAt: locP.completedAt || new Date().toISOString(),
        statusText: 'Selesai'
      });
    }
  }

  for (const locP of localProjects) {
    if (locP.isDone && !combined.some(p => p.id === locP.id)) {
      combined.push({
        id: locP.id,
        name: locP.name,
        isDone: true,
        steps: locP.steps || [],
        completedAt: locP.updatedAt || locP.createdAt,
        statusText: 'Selesai'
      });
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
  const timeoutMs = (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 35000;

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

    const rawTodos = data.todos || data.schedule || [];
    const todos = rawTodos.map(item => ({
      id: item.id,
      text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name || item.activity || item.description),
      minutes: typeof item === 'object' ? (item.estimatedMinutes || item.estimated_minutes || item.minutes || item.duration || 15) : 15,
      completed: !!(item.isDone || item.completed),
      isDone: !!(item.isDone || item.completed),
      selected: item.selected !== false
    }));

    const rawSchedule = data.schedule || [];
    const schedule = rawSchedule.map(item => ({
      id: item.id,
      text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name || item.activity || item.description),
      minutes: typeof item === 'object' ? (item.estimatedMinutes || item.estimated_minutes || item.minutes || item.duration || 15) : 15,
      completed: !!(item.isDone || item.completed),
      isDone: !!(item.isDone || item.completed),
      type: item.type || 'work',
      selected: item.selected !== false
    }));

    return {
      projectId: data.projectId || projectId,
      projectName: data.projectName || 'Proyek Lanjutan',
      todos,
      steps: todos,
      schedule,
      config: data.config
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
