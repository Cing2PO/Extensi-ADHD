/**
 * Magic Steps Renderer Module - Handles DOM rendering of the checklist UI
 * 
 * Extracted from magicTodoController.js for modular separation.
 * Renders each to-do step with checkbox, editable textarea, time badge,
 * resource dropdown hint, focus sync button, and delete action.
 */

import { setStorage } from '../services/storageService.js';
import { markTodoDoneOnBackend, deleteTodoOnBackend } from '../services/projectService.js';
import { toggleStepDropdown } from './resourceRecommendationModule.js';

/**
 * Auto-resize a textarea element to fit its content
 * @param {HTMLTextAreaElement} el
 */
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.max(18, el.scrollHeight)}px`;
}

/**
 * Render all magic to-do steps into the DOM list container
 * 
 * @param {Object} params
 * @param {HTMLElement} params.container - The UL/list element to render into
 * @param {Object} params.magicTaskState - Current magic task state
 * @param {Object} params.callbacks - Action callbacks
 * @param {Function} params.callbacks.onStepCompleted - (index, step, nextStepIndex) => void
 * @param {Function} params.callbacks.onStepUnchecked - (index, step) => void
 * @param {Function} params.callbacks.onStepDeleted - (index, step) => void
 * @param {Function} params.callbacks.onStepFocused - (index, step) => void
 * @param {Function} params.callbacks.onTextChanged - (index, newText) => void
 * @param {HTMLElement|null} params.stepCountLabel - Label element to update count
 */
export function renderMagicSteps({ container, magicTaskState, callbacks, stepCountLabel }) {
  if (!container) return;
  container.innerHTML = '';
  if (!magicTaskState || !magicTaskState.steps) return;

  const activeIndex = typeof magicTaskState.currentStepIndex === 'number' ? magicTaskState.currentStepIndex : -1;

  magicTaskState.steps.forEach((step, index) => {
    const li = document.createElement('li');
    li.className = 'magic-step-item';

    const isCompleted = (activeIndex >= 0 && index < activeIndex) || !!step.isDone || !!step.completed || magicTaskState.completed;
    const isCurrentActive = (activeIndex >= 0 && activeIndex === index && !magicTaskState.completed && !isCompleted);

    if (isCurrentActive) {
      li.classList.add('active-focus-step');
    }
    if (isCompleted) {
      li.classList.add('completed-step');
    }

    // Top Row Container (Checkbox + Textarea + Delete Button)
    const mainRow = document.createElement('div');
    mainRow.className = 'magic-step-main';

    // Custom Checkbox
    const cbWrapper = document.createElement('label');
    cbWrapper.className = 'magic-custom-checkbox-wrapper';
    cbWrapper.title = isCompleted ? 'Tandai belum selesai' : 'Tandai selesai';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'magic-step-checkbox';
    checkbox.checked = isCompleted;

    const cbCustom = document.createElement('span');
    cbCustom.className = 'magic-custom-checkbox';

    cbWrapper.appendChild(checkbox);
    cbWrapper.appendChild(cbCustom);

    // Textarea Container
    const textWrap = document.createElement('div');
    textWrap.className = 'magic-step-text-wrap';

    const textarea = document.createElement('textarea');
    textarea.className = 'magic-step-textarea';
    textarea.spellcheck = false;
    textarea.rows = 1;
    textarea.value = step.text || '';
    textarea.placeholder = 'Tuliskan butir tugas...';

    textWrap.appendChild(textarea);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete-step';
    deleteBtn.title = 'Hapus to-do ini';
    deleteBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    mainRow.appendChild(cbWrapper);
    mainRow.appendChild(textWrap);
    mainRow.appendChild(deleteBtn);

    // Bottom Row Container (Time Badge + Dropdown Hint + Focus Trigger)
    const footerRow = document.createElement('div');
    footerRow.className = 'magic-step-footer';

    const isBreak = step.type === 'break' || (step.text && step.text.toLowerCase().includes('istirahat'));
    const timeBadge = document.createElement('div');
    timeBadge.className = 'magic-step-time-badge';
    if (isBreak) {
      timeBadge.style.cssText = 'background: rgba(255, 193, 7, 0.15); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.3);';
    }
    timeBadge.title = `Estimasi durasi: ${step.minutes || 10} menit`;
    timeBadge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px;">
        <line x1="10" x2="14" y1="2" y2="2"></line>
        <line x1="12" x2="12" y1="14" y2="8"></line>
        <circle cx="12" cy="14" r="8"></circle>
      </svg>
      <span>${isBreak ? 'Istirahat ' : ''}${step.minutes || 10}m</span>
    `;

    const dropdownHint = document.createElement('div');
    dropdownHint.className = 'step-dropdown-hint';
    dropdownHint.title = 'Klik to-do ini untuk melihat referensi materi & tools AI';
    dropdownHint.innerHTML = `
      <span class="step-dropdown-chevron">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </span>
      <span class="step-dropdown-label">Referensi & Tools</span>
    `;

    const syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.className = 'btn-sync-focus';
    if (isCurrentActive) {
      syncBtn.classList.add('is-active');
      syncBtn.innerHTML = '<span class="focus-pulse-dot"></span> Fokus Aktif';
      syncBtn.title = 'Sedang fokus pada tugas ini';
    } else {
      syncBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;margin-right:2px;">
          <polygon points="6 3 20 12 6 21 6 3"></polygon>
        </svg> Fokus
      `;
      syncBtn.title = 'Set sebagai fokus aktif sekarang dan mulai timer';
    }

    footerRow.appendChild(timeBadge);
    footerRow.appendChild(dropdownHint);
    footerRow.appendChild(syncBtn);

    li.appendChild(mainRow);
    li.appendChild(footerRow);
    container.appendChild(li);

    // Make to-do item click toggle the dropdown
    li.classList.add('is-clickable');
    li.addEventListener('click', () => {
      toggleStepDropdown(step, li);
    });

    // Prevent child interactive elements from triggering dropdown toggle
    cbWrapper.addEventListener('click', (e) => e.stopPropagation());
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    textarea.addEventListener('click', (e) => e.stopPropagation());
    deleteBtn.addEventListener('click', (e) => e.stopPropagation());
    syncBtn.addEventListener('click', (e) => e.stopPropagation());

    // Auto-resize on initial render
    setTimeout(() => autoResizeTextarea(textarea), 0);

    // --- Event Listeners ---
    textarea.addEventListener('input', () => {
      magicTaskState.steps[index].text = textarea.value;
      autoResizeTextarea(textarea);
      if (callbacks.onTextChanged) callbacks.onTextChanged(index, textarea.value);
    });

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        step.completed = true;
        step.isDone = true;
        if (step.id) {
          markTodoDoneOnBackend(step.id);
        }
        if (callbacks.onStepCompleted) {
          callbacks.onStepCompleted(index, step, index + 1);
        }
      } else {
        step.completed = false;
        step.isDone = false;
        if (callbacks.onStepUnchecked) {
          callbacks.onStepUnchecked(index, step);
        }
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (step.id) {
        deleteTodoOnBackend(step.id);
      }
      if (callbacks.onStepDeleted) {
        callbacks.onStepDeleted(index, step);
      }
    });

    syncBtn.addEventListener('click', () => {
      if (callbacks.onStepFocused) {
        callbacks.onStepFocused(index, step);
      }
    });
  });

  if (stepCountLabel) {
    stepCountLabel.textContent = `${magicTaskState.steps.length} item`;
  }
}
