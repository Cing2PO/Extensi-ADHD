/**
 * Magic To-Do Controller Module - Orchestrates AI Task Breakdown & Checklist
 * 
 * Delegates to:
 * - pomodoroController.js for timer state & rendering
 * - magicStepsRenderer.js for checklist DOM rendering
 */

import { fetchMagicTodos } from '../services/apiService.js';
import { setStorage } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';
import { sendTimerEvent } from '../services/websocketService.js';
import { renderMagicSteps } from '../modules/magicStepsRenderer.js';
import { initPomodoroController } from './pomodoroController.js';

export function initMagicTodoController({ onStartFocusTab, onRequestAuth }) {
  const magicIdleView = document.getElementById('magic-idle-view');
  const magicActiveView = document.getElementById('magic-active-view');

  const btnToggleMagicAccordion = document.getElementById('btn-toggle-magic-accordion');
  const magicAccordionBody = document.getElementById('magic-accordion-body');
  const accordionArrow = document.getElementById('accordion-arrow');

  const magicInputPanel = document.getElementById('magic-input-panel');
  const magicLoadingPanel = document.getElementById('magic-loading-panel');
  const magicResultsPanel = document.getElementById('magic-results-panel');
  const magicCongratsPanel = document.getElementById('magic-congrats-panel');

  const magicTaskInput = document.getElementById('magic-task-input');
  const magicDurationInput = document.getElementById('magic-duration-input');
  const btnNegotiate = document.getElementById('btn-negotiate');
  const magicStepsList = document.getElementById('magic-steps-list');
  const magicStepCountLabel = document.getElementById('magic-step-count-label');
  const btnAddMagicItem = document.getElementById('btn-add-magic-item');
  const btnResetMagic = document.getElementById('btn-reset-magic');
  const btnNewMagic = document.getElementById('btn-new-magic');
  const btnStartMagicFocus = document.getElementById('btn-start-magic-focus');
  const floatingPomodoroToggle = document.getElementById('floating-pomodoro-toggle');

  let magicTaskState = null;

  // Initialize Pomodoro Controller (delegated)
  const pomodoro = initPomodoroController({
    onStartFocusTab,
    getMagicTaskState: () => magicTaskState,
    getDurationInput: () => Number(magicDurationInput?.value) || 60
  });

  // --- ACCORDION TOGGLE ---
  if (btnToggleMagicAccordion) {
    btnToggleMagicAccordion.addEventListener('click', () => {
      if (magicAccordionBody) {
        const isHidden = magicAccordionBody.classList.contains('hidden');
        if (isHidden) {
          magicAccordionBody.classList.remove('hidden');
          if (accordionArrow) accordionArrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>';
        } else {
          magicAccordionBody.classList.add('hidden');
          if (accordionArrow) accordionArrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
        }
      }
    });
  }

  // --- DURATION CHIPS ---
  const durationChips = document.querySelectorAll('.duration-chip');
  if (durationChips.length && magicDurationInput) {
    durationChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.getAttribute('data-min');
        if (val) {
          magicDurationInput.value = val;
          durationChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        }
      });
    });

    magicDurationInput.addEventListener('input', () => {
      const currentVal = String(magicDurationInput.value).trim();
      durationChips.forEach(c => {
        if (c.getAttribute('data-min') === currentVal) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
    });
  }

  // --- STATE UI RENDERING ---
  function renderMagicStateUI() {
    if (magicInputPanel) magicInputPanel.classList.add('hidden');
    if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
    if (magicResultsPanel) magicResultsPanel.classList.add('hidden');
    if (magicCongratsPanel) magicCongratsPanel.classList.add('hidden');

    if (!magicTaskState) {
      if (magicIdleView) magicIdleView.classList.remove('hidden');
      if (magicActiveView) magicActiveView.classList.add('hidden');
      if (magicInputPanel) magicInputPanel.classList.remove('hidden');
      pomodoro.renderPomodoroPanel();
      return;
    }

    if (magicTaskState.completed) {
      if (magicIdleView) magicIdleView.classList.remove('hidden');
      if (magicActiveView) magicActiveView.classList.add('hidden');
      if (magicCongratsPanel) magicCongratsPanel.classList.remove('hidden');
      pomodoro.renderPomodoroPanel();
    } else {
      if (magicIdleView) magicIdleView.classList.add('hidden');
      if (magicActiveView) magicActiveView.classList.remove('hidden');
      if (magicResultsPanel) magicResultsPanel.classList.remove('hidden');
      renderSteps();
      pomodoro.renderPomodoroPanel();
    }
  }

  // --- STEP RENDERING (DELEGATED) ---
  function renderSteps() {
    renderMagicSteps({
      container: magicStepsList,
      magicTaskState,
      stepCountLabel: magicStepCountLabel,
      callbacks: {
        onTextChanged: (index, newText) => {
          setStorage({ magicTaskState });
        },
        onStepCompleted: handleStepCompleted,
        onStepUnchecked: handleStepUnchecked,
        onStepDeleted: handleStepDeleted,
        onStepFocused: handleStepFocused
      }
    });
  }

  function handleStepCompleted(index, step, nextIndex) {
    if (nextIndex < magicTaskState.steps.length) {
      magicTaskState.currentStepIndex = nextIndex;
      magicTaskState.completed = false;
      const nextStepText = magicTaskState.steps[nextIndex].text;
      const nextStepMin = magicTaskState.steps[nextIndex].minutes || 25;
      const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput?.value) || 60;

      const session = pomodoro.createMagicPomodoroSession({
        totalMinutes,
        currentIndex: nextIndex,
        stepMinutes: nextStepMin
      });

      setStorage({
        magicTaskState,
        currentTask: nextStepText,
        pomodoroSession: session,
        showFloatingWidget: true
      }).then(() => {
        pomodoro.startPomodoroTimer();
        if (onStartFocusTab) onStartFocusTab(nextStepText);
        renderMagicStateUI();
      });
    } else {
      magicTaskState.completed = true;
      magicTaskState.currentStepIndex = magicTaskState.steps.length;
      setStorage({
        magicTaskState,
        currentTask: '',
        pomodoroSession: null
      }).then(() => {
        renderMagicStateUI();
      });
    }
  }

  function handleStepUnchecked(index, step) {
    magicTaskState.currentStepIndex = index;
    magicTaskState.completed = false;
    setStorage({
      magicTaskState,
      currentTask: step.text
    }).then(() => {
      renderMagicStateUI();
    });
  }

  function handleStepDeleted(index, step) {
    magicTaskState.steps.splice(index, 1);
    if (magicTaskState.currentStepIndex >= magicTaskState.steps.length) {
      magicTaskState.currentStepIndex = Math.max(0, magicTaskState.steps.length - 1);
    }
    setStorage({ magicTaskState }).then(() => {
      renderMagicStateUI();
    });
  }

  function handleStepFocused(index, step) {
    const stepFocusText = step.text;
    const stepMinutes = step.minutes || 25;
    magicTaskState.currentStepIndex = index;
    magicTaskState.completed = false;

    const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput?.value) || 60;
    const session = pomodoro.createMagicPomodoroSession({
      totalMinutes,
      currentIndex: index,
      stepMinutes
    });

    if (floatingPomodoroToggle) {
      floatingPomodoroToggle.checked = true;
    }

    setStorage({
      magicTaskState,
      currentTask: stepFocusText,
      pomodoroSession: session,
      showFloatingWidget: true
    }).then(() => {
      pomodoro.startPomodoroTimer();
      if (onStartFocusTab) onStartFocusTab(stepFocusText);
      renderMagicStateUI();
    });
  }

  // --- RESET ---
  function resetMagicState() {
    magicTaskState = null;
    if (magicTaskInput) magicTaskInput.value = '';
    if (magicDurationInput) magicDurationInput.value = '60';
    setStorage({ magicTaskState: null, pomodoroSession: null, currentTask: '' }).then(() => {
      pomodoro.setSession(null);
      renderMagicStateUI();
    });
  }

  // --- EVENT LISTENERS ---
  if (btnNegotiate) {
    btnNegotiate.addEventListener('click', async () => {
      const taskText = magicTaskInput.value.trim();
      const totalMinutes = Math.max(15, Number(magicDurationInput.value) || 60);

      if (!taskText) {
        if (window.Swal) {
          window.Swal.fire({
            title: 'Input Kosong',
            text: 'Tuliskan tugas raksasa yang ingin Anda pecah!',
            icon: 'warning',
            ...getSwalTheme()
          });
        }
        return;
      }

      try {
        if (magicInputPanel) magicInputPanel.classList.add('hidden');
        if (magicLoadingPanel) magicLoadingPanel.classList.remove('hidden');

        const generatedSteps = await fetchMagicTodos(taskText, totalMinutes, {
          workMinutes: pomodoro.getWorkMinutes(),
          breakMinutes: pomodoro.getBreakMinutes()
        });

        magicTaskState = {
          taskName: taskText,
          steps: generatedSteps,
          currentStepIndex: -1,
          completed: false,
          totalMinutes: totalMinutes
        };

        await setStorage({ magicTaskState });
        if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
        renderMagicStateUI();
      } catch (err) {
        if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
        if (magicInputPanel) magicInputPanel.classList.remove('hidden');

        if (err.code === 'AUTH_REQUIRED') {
          if (typeof onRequestAuth === 'function') {
            onRequestAuth();
          } else if (window.Swal) {
            window.Swal.fire({
              title: 'Login Diperlukan',
              text: err.message || 'Silakan login terlebih dahulu untuk memuat AI Magic To-Do.',
              icon: 'info',
              ...getSwalTheme()
            });
          }
          return;
        }

        console.error('[Magic To-Do Error]', err);

        if (window.Swal) {
          window.Swal.fire({
            title: 'Gagal Negosiasi AI',
            text: err.message || 'Gagal terhubung ke API backend Gemini.',
            icon: 'error',
            ...getSwalTheme()
          });
        } else {
          alert('Gagal Negosiasi AI: ' + (err.message || 'Gagal terhubung ke API backend Gemini.'));
        }
      }
    });
  }

  if (btnStartMagicFocus) {
    btnStartMagicFocus.addEventListener('click', () => {
      if (!magicTaskState || !magicTaskState.steps?.length) return;

      if (typeof magicTaskState.currentStepIndex !== 'number' || magicTaskState.currentStepIndex < 0) {
        magicTaskState.currentStepIndex = 0;
      }

      const activeIdx = magicTaskState.currentStepIndex;
      const firstTaskText = magicTaskState.steps[activeIdx]?.text || magicTaskState.steps[0].text;
      const stepMin = magicTaskState.steps[activeIdx]?.minutes || 25;
      const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput?.value) || 60;

      const session = pomodoro.createMagicPomodoroSession({
        totalMinutes,
        currentIndex: activeIdx,
        stepMinutes: stepMin
      });

      if (floatingPomodoroToggle) {
        floatingPomodoroToggle.checked = true;
      }

      setStorage({
        magicTaskState,
        currentTask: firstTaskText,
        pomodoroSession: session,
        showFloatingWidget: true
      }).then(() => {
        pomodoro.startPomodoroTimer();
        if (onStartFocusTab) onStartFocusTab(firstTaskText);
        renderMagicStateUI();

        // Emit timer start to WebSocket
        sendTimerEvent({
          type: 'timer_start',
          task: firstTaskText,
          remainingSeconds: stepMin * 60,
          phase: 'work'
        });

        if (window.Swal) {
          window.Swal.fire({
            title: 'Fokus Dimulai!',
            text: `Target: "${firstTaskText}". Floating Timer sekarang aktif di halaman web Anda!`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false,
            ...getSwalTheme()
          });
        }
      });
    });
  }

  if (btnResetMagic) {
    btnResetMagic.addEventListener('click', () => {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Tutup Task Saat Ini?',
          text: 'Tampilan tugas ini akan ditutup agar Anda dapat membuat tugas baru atau berpindah ke proyek lain.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Ya, Tutup Task',
          cancelButtonText: 'Batal',
          ...getSwalTheme()
        }).then((result) => {
          if (result.isConfirmed) {
            resetMagicState();
            window.Swal.fire({
              title: 'Task Ditutup',
              text: 'Silakan buat tugas baru atau pilih proyek tersimpan.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false,
              ...getSwalTheme()
            });
          }
        });
      } else {
        resetMagicState();
      }
    });
  }

  if (btnNewMagic) {
    btnNewMagic.addEventListener('click', () => {
      pomodoro.resetPomodoroSession();
      resetMagicState();
    });
  }

  if (btnAddMagicItem) {
    btnAddMagicItem.addEventListener('click', () => {
      if (!magicTaskState) return;
      magicTaskState.steps.push({ text: 'New To-Do item', minutes: 5 });
      setStorage({ magicTaskState }).then(() => {
        renderMagicStateUI();
      });
    });
  }

  function openCreateAccordion() {
    if (magicAccordionBody) {
      magicAccordionBody.classList.remove('hidden');
      if (accordionArrow) accordionArrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>';
    }
    if (magicTaskInput) {
      setTimeout(() => magicTaskInput.focus(), 100);
    }
  }

  function setInitialStates({ magicState, pomoSession }) {
    magicTaskState = magicState;
    pomodoro.setSession(pomoSession);
    renderMagicStateUI();
    pomodoro.startPomodoroTimer();
  }

  return {
    setInitialStates,
    renderMagicStateUI,
    startNewPomodoroSession: pomodoro.startNewPomodoroSession,
    openCreateAccordion
  };
}
