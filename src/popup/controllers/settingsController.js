/**
 * Settings Controller Module - Manages Settings Modal, Pomodoro Config & Preferences
 * 
 * Extracted from rulesController.js to separate Settings concerns from Guard/Blacklist.
 */

import { setStorage } from '../services/storageService.js';

export function initSettingsController() {
  const btnSettingsGear = document.getElementById('btn-settings-gear');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');

  const pomodoroWorkInput = document.getElementById('pomodoro-work-input');
  const pomodoroBreakInput = document.getElementById('pomodoro-break-input');
  const floatingPomodoroToggle = document.getElementById('floating-pomodoro-toggle');

  function openSettingsModal() {
    if (settingsModal) settingsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  // --- Event Listeners ---
  if (btnSettingsGear) {
    btnSettingsGear.addEventListener('click', openSettingsModal);
  }

  if (btnCloseSettingsModal) {
    btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
  }

  if (floatingPomodoroToggle) {
    floatingPomodoroToggle.addEventListener('change', () => {
      setStorage({ showFloatingWidget: floatingPomodoroToggle.checked });
    });
  }

  if (pomodoroWorkInput) {
    pomodoroWorkInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(90, parseInt(pomodoroWorkInput.value, 10) || 25));
      pomodoroWorkInput.value = val;
      setStorage({ pomodoroWorkMinutes: val });
    });
  }

  if (pomodoroBreakInput) {
    pomodoroBreakInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(30, parseInt(pomodoroBreakInput.value, 10) || 5));
      pomodoroBreakInput.value = val;
      setStorage({ pomodoroBreakMinutes: val });
    });
  }

  /**
   * Hydrate settings inputs with saved values
   */
  function setInitialSettings({ items }) {
    if (pomodoroWorkInput) pomodoroWorkInput.value = items.pomodoroWorkMinutes || 25;
    if (pomodoroBreakInput) pomodoroBreakInput.value = items.pomodoroBreakMinutes || 5;
    if (floatingPomodoroToggle) floatingPomodoroToggle.checked = items.showFloatingWidget !== false;
  }

  return {
    openSettingsModal,
    closeSettingsModal,
    setInitialSettings
  };
}
