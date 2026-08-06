/**
 * Project Controller - Manages Active Project Preview Cards & Resume Project Dialogs
 */

import { getSavedProjects, resumeProject } from '../services/projectService.js';
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

  let selectedProjectForResume = null;

  function openResumeModal(project) {
    selectedProjectForResume = project;
    if (resumeModalTitle) {
      resumeModalTitle.textContent = `Lanjutkan: ${project.name}`;
    }
    if (resumeDurationInput) {
      resumeDurationInput.value = '30';
    }
    if (resumeModal) {
      resumeModal.classList.remove('hidden');
    }
  }

  function closeResumeModal() {
    selectedProjectForResume = null;
    if (resumeModal) {
      resumeModal.classList.add('hidden');
    }
  }

  async function handleConfirmResume() {
    if (!selectedProjectForResume) return;

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
        btnConfirmResume.textContent = '▶️ Mulai Sesi Fokus';
      }
    }
  }

  async function renderProjectPreviewList() {
    if (!projectCardsList) return;

    try {
      const projects = await getSavedProjects();
      projectCardsList.innerHTML = '';

      if (!projects || projects.length === 0) {
        if (previewContainer) previewContainer.classList.add('hidden');
        return;
      }

      if (previewContainer) previewContainer.classList.remove('hidden');

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
        projectCardsList.appendChild(card);
      });
    } catch (e) {
      console.warn('[ProjectController] Error rendering preview list:', e);
    }
  }

  // Listeners
  if (btnCloseResumeModal) btnCloseResumeModal.addEventListener('click', closeResumeModal);
  if (btnConfirmResume) btnConfirmResume.addEventListener('click', handleConfirmResume);

  renderProjectPreviewList();

  return {
    renderProjectPreviewList,
    openResumeModal,
    closeResumeModal
  };
}
