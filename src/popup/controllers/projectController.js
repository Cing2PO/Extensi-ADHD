/**
 * Project Controller - Manages Active Project Preview Cards & Resume Project Dialogs
 */

import { getSavedProjects, getCompletedProjects, resumeProject } from '../services/projectService.js';
import { setStorage } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';

export function initProjectController(callbacks = {}) {
  const previewContainer = document.getElementById('project-preview-container');
  const projectCardsList = document.getElementById('project-cards-list');

  const resumeModal = document.getElementById('resume-project-modal');
  const btnCloseResumeModal = document.getElementById('btn-close-resume-modal');
  const resumeModalTitle = document.getElementById('resume-modal-title');
  const resumeDurationInput = document.getElementById('resume-duration-input');
  const btnConfirmResume = document.getElementById('btn-confirm-resume');

  const resumeTodosList = document.getElementById('resume-todos-list');
  const resumeTodosCount = document.getElementById('resume-todos-count');

  let selectedProjectForResume = null;

  async function openResumeModal(project) {
    selectedProjectForResume = project;
    const isCompleted = !!project.isDone;

    if (resumeModalTitle) {
      resumeModalTitle.textContent = isCompleted ? `Detail Proyek: ${project.name}` : `Lanjutkan: ${project.name}`;
    }
    if (resumeDurationInput) {
      resumeDurationInput.value = '30';
      const durationGroup = resumeDurationInput.closest('.form-group');
      if (durationGroup) {
        durationGroup.style.display = isCompleted ? 'none' : 'flex';
      }
    }
    if (btnConfirmResume) {
      btnConfirmResume.textContent = isCompleted ? '✓ Tutup Detail Proyek' : '▶️ Lanjutkan Proyek';
      btnConfirmResume.style.background = isCompleted ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
    }
    if (resumeModal) {
      resumeModal.classList.remove('hidden');
    }
    document.body.classList.add('modal-open');

    // Render Preview To-Do List & Status
    renderModalTodosPreview(project);
  }

  async function renderModalTodosPreview(project) {
    if (!resumeTodosList) return;
    resumeTodosList.innerHTML = '<div style="font-size:10px; color:#94a3b8; text-align:center; padding:8px;">Memuat daftar to-do...</div>';
    if (resumeTodosCount) resumeTodosCount.textContent = 'Memuat...';

    let steps = [];

    // Case 1: Local project / active task with steps
    if (project.steps && Array.isArray(project.steps)) {
      steps = project.steps;
    } else {
      // Case 2: Fetch steps from backend
      try {
        const resumedData = await resumeProject(project.id, 999);
        steps = resumedData.steps || [];
      } catch (err) {
        console.warn('[ProjectController] Error loading project todos for preview:', err);
        steps = [
          { text: `Sesi fokus: ${project.name}`, minutes: 15, isDone: !!project.isDone },
          { text: 'Evaluasi & penyelesaian milestone', minutes: 15, isDone: !!project.isDone }
        ];
      }
    }

    resumeTodosList.innerHTML = '';
    if (!steps || steps.length === 0) {
      resumeTodosList.innerHTML = '<div style="font-size:10px; color:#94a3b8; text-align:center; padding:8px;">Tidak ada item to-do.</div>';
      if (resumeTodosCount) resumeTodosCount.textContent = '0 item';
      return;
    }

    const doneCount = steps.filter(s => s.isDone || s.completed).length;
    if (resumeTodosCount) {
      resumeTodosCount.textContent = `${doneCount}/${steps.length} selesai`;
    }

    steps.forEach((step, idx) => {
      const isDone = !!(step.isDone || step.completed || project.isDone);
      const itemRow = document.createElement('div');
      itemRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background: rgba(255, 255, 255, 0.04); border-radius: 8px; font-size: 10px; gap: 8px;';

      const label = document.createElement('span');
      label.style.cssText = `color: #e2e8f0; font-size: 10px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; ${isDone ? 'text-decoration: line-through; opacity: 0.5;' : ''}`;
      label.textContent = `${idx + 1}. ${step.text}`;

      const badge = document.createElement('span');
      badge.style.cssText = `font-size: 9px; padding: 2px 6px; border-radius: 999px; font-weight: 600; white-space: nowrap; ${isDone ? 'background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);' : 'background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);'}`;
      badge.textContent = isDone ? '✓ Selesai' : '⏳ Belum';

      itemRow.appendChild(label);
      itemRow.appendChild(badge);
      resumeTodosList.appendChild(itemRow);
    });
  }

  function closeResumeModal() {
    selectedProjectForResume = null;
    if (resumeModal) {
      resumeModal.classList.add('hidden');
    }
    document.body.classList.remove('modal-open');
  }

  async function handleConfirmResume() {
    if (!selectedProjectForResume) return;

    // If completed project, just close modal
    if (selectedProjectForResume.isDone) {
      closeResumeModal();
      return;
    }

    const durationMin = Math.max(10, parseInt(resumeDurationInput?.value, 10) || 30);
    const project = selectedProjectForResume;

    if (btnConfirmResume) {
      btnConfirmResume.disabled = true;
      btnConfirmResume.textContent = 'Memuat Sisa To-Do...';
    }

    try {
      const resumedData = await resumeProject(project.id, durationMin);

      const magicTaskState = {
        projectId: resumedData.projectId,
        taskName: resumedData.projectName,
        steps: resumedData.steps,
        currentStepIndex: -1,
        completed: false,
        totalMinutes: durationMin
      };

      await setStorage({ magicTaskState });
      closeResumeModal();

      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'Proyek Dilanjutkan!',
          text: `Menyiapkan sesi fokus untuk "${resumedData.projectName}" (${durationMin} menit).`,
          timer: 1800,
          showConfirmButton: false
        });
      }

      if (typeof callbacks.onProjectResumed === 'function') {
        callbacks.onProjectResumed(magicTaskState);
      }
    } catch (err) {
      console.warn('[ProjectController] Fallback local resume for mock project:', err);

      // Fallback local mock resume if backend ID is mock/offline
      const mockSteps = [
        { id: 101, text: `Lanjutkan pembahasan: ${project.name}`, minutes: 15, completed: false },
        { id: 102, text: 'Evaluasi & uji coba hasil langkah mikro', minutes: 15, completed: false }
      ];

      const magicTaskState = {
        projectId: project.id,
        taskName: project.name,
        steps: mockSteps,
        currentStepIndex: -1,
        completed: false,
        totalMinutes: durationMin
      };

      await setStorage({ magicTaskState });
      closeResumeModal();

      if (typeof callbacks.onProjectResumed === 'function') {
        callbacks.onProjectResumed(magicTaskState);
      }
    } finally {
      if (btnConfirmResume) {
        btnConfirmResume.disabled = false;
        btnConfirmResume.textContent = '▶️ Lanjutkan Proyek';
      }
    }
  }

  async function renderProjectPreviewList() {
    const listContainers = document.querySelectorAll('.project-cards-list');
    if (!listContainers || listContainers.length === 0) return;

    try {
      const projects = await getSavedProjects();

      listContainers.forEach(container => {
        container.innerHTML = '';
        const parentCard = container.closest('.card');

        if (!projects || projects.length === 0) {
          if (parentCard) parentCard.classList.add('hidden');
          return;
        }

        if (parentCard) parentCard.classList.remove('hidden');

        projects.forEach((project) => {
          const card = document.createElement('div');
          card.className = 'project-preview-card';

          const titleBox = document.createElement('div');
          titleBox.className = 'project-card-title-box';

          const title = document.createElement('span');
          title.className = 'project-card-title';
          title.textContent = project.name;

          const badge = document.createElement('span');
          badge.className = 'project-card-badge';
          badge.textContent = typeof project.undoneTodos === 'string' && project.undoneTodos.includes('sisa')
            ? project.undoneTodos
            : `${project.undoneTodos || 'Proyek'}`;

          titleBox.appendChild(title);
          titleBox.appendChild(badge);

          const actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'btn-resume-project';
          actionBtn.textContent = '▶️ Lanjutkan';

          card.appendChild(titleBox);
          card.appendChild(actionBtn);

          card.addEventListener('click', () => openResumeModal(project));
          container.appendChild(card);
        });
      });
    } catch (e) {
      console.warn('[ProjectController] Error rendering preview list:', e);
    }
  }

  async function renderCompletedProjectsList() {
    const completedList = document.getElementById('completed-projects-list');
    const completedCount = document.getElementById('completed-projects-count');
    if (!completedList) return;

    try {
      const completed = await getCompletedProjects();
      completedList.innerHTML = '';

      if (completedCount) {
        completedCount.textContent = `${completed.length} selesai`;
      }

      if (!completed || completed.length === 0) {
        completedList.innerHTML = '<div style="font-size: 10px; color: #64748b; text-align: center; padding: 6px 0;">Belum ada proyek selesai</div>';
        return;
      }

      completed.forEach((project) => {
        const card = document.createElement('div');
        card.className = 'project-preview-card completed-project-card';

        const titleBox = document.createElement('div');
        titleBox.className = 'project-card-title-box';

        const title = document.createElement('span');
        title.className = 'project-card-title completed-title';
        title.textContent = project.name;

        const badge = document.createElement('span');
        badge.className = 'project-card-badge completed-badge';
        badge.textContent = '✓ Selesai';

        titleBox.appendChild(title);
        titleBox.appendChild(badge);

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'btn-resume-project btn-view-completed';
        actionBtn.textContent = '👁️ Lihat';

        card.appendChild(titleBox);
        card.appendChild(actionBtn);

        card.addEventListener('click', () => openResumeModal(project));
        completedList.appendChild(card);
      });
    } catch (e) {
      console.warn('[ProjectController] Error rendering completed list:', e);
    }
  }

  async function refreshAllProjects() {
    await renderProjectPreviewList();
    await renderCompletedProjectsList();
  }

  // Listeners
  if (btnCloseResumeModal) btnCloseResumeModal.addEventListener('click', closeResumeModal);
  if (btnConfirmResume) btnConfirmResume.addEventListener('click', handleConfirmResume);

  refreshAllProjects();

  return {
    renderProjectPreviewList,
    renderCompletedProjectsList,
    refreshAllProjects,
    openResumeModal,
    closeResumeModal
  };
}
