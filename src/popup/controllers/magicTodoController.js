/**
 * Magic To-Do Controller Module - Handles AI Task Breakdown & Checklist Renders
 */

import { fetchMagicTodos } from '../services/apiService.js';
import { setStorage } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';
import { markTodoDoneOnBackend, deleteTodoOnBackend } from '../services/projectService.js';
import { sendTimerEvent, getConnectionStatus } from '../services/websocketService.js';

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

  const magicPomodoroPanel = document.getElementById('magic-pomodoro-panel');
  const magicPomodoroStatus = document.getElementById('magic-pomodoro-status');
  const magicPomodoroTimer = document.getElementById('magic-pomodoro-timer');
  const btnPausePomodoro = document.getElementById('btn-pause-pomodoro');
  const btnResetPomodoro = document.getElementById('btn-reset-pomodoro');
  const pomodoroWorkInput = document.getElementById('pomodoro-work-input');
  const pomodoroBreakInput = document.getElementById('pomodoro-break-input');
  const floatingPomodoroToggle = document.getElementById('floating-pomodoro-toggle');

  let magicTaskState = null;
  let pomodoroSession = null;
  let pomodoroTimerInterval = null;

  if (btnToggleMagicAccordion) {
    btnToggleMagicAccordion.addEventListener('click', () => {
      if (magicAccordionBody) {
        const isHidden = magicAccordionBody.classList.contains('hidden');
        if (isHidden) {
          magicAccordionBody.classList.remove('hidden');
          if (accordionArrow) accordionArrow.textContent = '▲';
        } else {
          magicAccordionBody.classList.add('hidden');
          if (accordionArrow) accordionArrow.textContent = '▼';
        }
      }
    });
  }

  // Interactive Duration Chips Synchronizer
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

  function buildPomodoroPlan(totalMinutes) {
    const plan = [];
    const workMin = Math.max(1, parseInt(pomodoroWorkInput?.value, 10) || 25);
    const breakMin = Math.max(1, parseInt(pomodoroBreakInput?.value, 10) || 5);
    let remaining = Math.max(workMin, Number(totalMinutes) || 60);

    while (remaining > 0) {
      const workMinutes = Math.min(workMin, remaining);
      plan.push({ type: 'work', minutes: workMinutes });
      remaining -= workMinutes;

      if (remaining <= 0) break;

      const breakMinutes = Math.min(breakMin, remaining);
      if (breakMinutes > 0) {
        plan.push({ type: 'break', minutes: breakMinutes });
        remaining -= breakMinutes;
      }
    }

    return plan;
  }

  function formatPomodoroTime(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const seconds = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function getPomodoroRemainingSeconds(session) {
    if (!session || !session.isActive) return 0;
    if (!session.isRunning) {
      return session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : 0;
    }
    if (!session.targetTimestamp) return 0;
    return Math.max(0, Math.ceil((session.targetTimestamp - Date.now()) / 1000));
  }

  function renderPomodoroPanel() {
    if (!magicPomodoroTimer && !magicPomodoroStatus) return;

    if (!pomodoroSession || !pomodoroSession.isActive) {
      if (magicPomodoroStatus) magicPomodoroStatus.textContent = 'Belum Dimulai';
      if (magicPomodoroTimer) magicPomodoroTimer.textContent = '25:00';
      if (btnPausePomodoro) {
        btnPausePomodoro.textContent = '⏱️ Mulai Sesi Pomodoro';
        btnPausePomodoro.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
        btnPausePomodoro.style.color = '#ffffff';
        btnPausePomodoro.style.fontWeight = 'bold';
      }
      if (btnResetPomodoro) {
        btnResetPomodoro.classList.add('hidden');
      }
      return;
    }

    if (btnResetPomodoro) {
      btnResetPomodoro.classList.remove('hidden');
    }

    const currentBlock = pomodoroSession.plan?.[pomodoroSession.currentIndex] || null;
    const phaseLabel = pomodoroSession.phase === 'break' ? 'Istirahat' : 'Kerja';
    const remSec = getPomodoroRemainingSeconds(pomodoroSession);
    const timerText = formatPomodoroTime(remSec);

    if (magicPomodoroStatus) {
      magicPomodoroStatus.textContent = `${phaseLabel} • ${currentBlock?.minutes || 25} menit`;
    }

    if (magicPomodoroTimer) {
      magicPomodoroTimer.textContent = timerText;
    }

    if (btnPausePomodoro) {
      btnPausePomodoro.textContent = pomodoroSession.isRunning ? 'Pause' : 'Lanjut';
      btnPausePomodoro.style.background = '';
      btnPausePomodoro.style.color = '';
      btnPausePomodoro.style.fontWeight = '';
    }
  }

  function savePomodoroSession() {
    setStorage({ pomodoroSession }).then(() => {
      renderPomodoroPanel();
    });
  }

  function startPomodoroTimer() {
    if (pomodoroTimerInterval) {
      clearInterval(pomodoroTimerInterval);
    }

    pomodoroTimerInterval = setInterval(() => {
      if (!pomodoroSession || !pomodoroSession.isActive) return;

      const remSec = getPomodoroRemainingSeconds(pomodoroSession);
      renderPomodoroPanel();

      if (pomodoroSession.isRunning && remSec <= 0) {
        if (pomodoroSession.currentIndex + 1 < (pomodoroSession.plan || []).length) {
          pomodoroSession.currentIndex += 1;
          const nextBlock = pomodoroSession.plan[pomodoroSession.currentIndex];
          pomodoroSession.phase = nextBlock.type;
          pomodoroSession.targetTimestamp = Date.now() + (nextBlock.minutes * 60 * 1000);
          pomodoroSession.pausedRemainingSeconds = null;
          savePomodoroSession();

          // Emit phase change to WebSocket
          sendTimerEvent({
            type: 'timer_phase_change',
            task: magicTaskState?.steps?.[magicTaskState.currentStepIndex]?.text || 'Sesi Fokus',
            remainingSeconds: nextBlock.minutes * 60,
            phase: nextBlock.type
          });
        } else {
          pomodoroSession.isActive = false;
          pomodoroSession.isRunning = false;
          pomodoroSession.phase = 'done';
          pomodoroSession.targetTimestamp = null;
          pomodoroSession.pausedRemainingSeconds = 0;
          savePomodoroSession();

          // Emit timer stop to WebSocket
          sendTimerEvent({ type: 'timer_stop', phase: 'done' });

          if (window.Swal) {
            window.Swal.fire({
              title: 'Pomodoro selesai!',
              text: 'Sesi fokus Anda telah rampung. Istirahatlah sejenak atau mulai lagi.',
              icon: 'success',
              timer: 1800,
              showConfirmButton: false,
              ...getSwalTheme()
            });
          }
        }
      }
    }, 1000);
  }

  function resetPomodoroSession() {
    if (pomodoroTimerInterval) {
      clearInterval(pomodoroTimerInterval);
      pomodoroTimerInterval = null;
    }
    pomodoroSession = null;

    // Emit timer stop to WebSocket
    sendTimerEvent({ type: 'timer_stop' });

    setStorage({ pomodoroSession: null, currentTask: '' }).then(() => {
      renderPomodoroPanel();
      if (onStartFocusTab) onStartFocusTab('');
    });
  }

  function startNewPomodoroSession() {
    const workM = Math.max(1, parseInt(pomodoroWorkInput?.value, 10) || 25);
    const breakM = Math.max(1, parseInt(pomodoroBreakInput?.value, 10) || 5);

    const plan = [
      { type: 'work', minutes: workM },
      { type: 'break', minutes: breakM },
      { type: 'work', minutes: workM },
      { type: 'break', minutes: breakM }
    ];

    const defaultTask = (magicTaskState && magicTaskState.taskName) || 'Sesi Fokus Mandiri';

    pomodoroSession = {
      isActive: true,
      isRunning: true,
      totalMinutes: workM * 2 + breakM * 2,
      plan,
      currentIndex: 0,
      phase: 'work',
      targetTimestamp: Date.now() + (workM * 60 * 1000),
      pausedRemainingSeconds: null,
      showFloatingWidget: floatingPomodoroToggle ? floatingPomodoroToggle.checked : true
    };

    setStorage({ pomodoroSession, currentTask: defaultTask }).then(() => {
      renderPomodoroPanel();
      startPomodoroTimer();
      if (onStartFocusTab) onStartFocusTab(defaultTask);

      // Emit timer start to WebSocket
      sendTimerEvent({
        type: 'timer_start',
        task: defaultTask,
        remainingSeconds: workM * 60,
        phase: 'work'
      });
    });
  }

  function renderMagicStateUI() {
    if (magicInputPanel) magicInputPanel.classList.add('hidden');
    if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
    if (magicResultsPanel) magicResultsPanel.classList.add('hidden');
    if (magicCongratsPanel) magicCongratsPanel.classList.add('hidden');

    if (!magicTaskState) {
      if (magicIdleView) magicIdleView.classList.remove('hidden');
      if (magicActiveView) magicActiveView.classList.add('hidden');
      if (magicInputPanel) magicInputPanel.classList.remove('hidden');
      renderPomodoroPanel();
      return;
    }

    if (magicTaskState.completed) {
      if (magicIdleView) magicIdleView.classList.remove('hidden');
      if (magicActiveView) magicActiveView.classList.add('hidden');
      if (magicCongratsPanel) magicCongratsPanel.classList.remove('hidden');
      renderPomodoroPanel();
    } else {
      if (magicIdleView) magicIdleView.classList.add('hidden');
      if (magicActiveView) magicActiveView.classList.remove('hidden');
      if (magicResultsPanel) magicResultsPanel.classList.remove('hidden');
      renderMagicSteps();
      renderPomodoroPanel();
    }
  }

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(18, el.scrollHeight)}px`;
  }

  function renderMagicSteps() {
    if (!magicStepsList) return;
    magicStepsList.innerHTML = '';
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

      // Bottom Row Container (Time Badge + Focus Trigger)
      const footerRow = document.createElement('div');
      footerRow.className = 'magic-step-footer';

      const timeBadge = document.createElement('div');
      timeBadge.className = 'magic-step-time-badge';
      timeBadge.title = `Estimasi durasi: ${step.minutes || 10} menit`;
      timeBadge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>${step.minutes || 10}m</span>
      `;

      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'btn-sync-focus';
      if (isCurrentActive) {
        syncBtn.classList.add('is-active');
        syncBtn.innerHTML = '<span class="focus-pulse-dot"></span> Fokus Aktif';
        syncBtn.title = 'Sedang fokus pada tugas ini';
      } else {
        syncBtn.innerHTML = '🎯 Fokus';
        syncBtn.title = 'Set sebagai fokus aktif sekarang dan mulai timer';
      }

      footerRow.appendChild(timeBadge);
      footerRow.appendChild(syncBtn);

      li.appendChild(mainRow);
      li.appendChild(footerRow);
      magicStepsList.appendChild(li);

      // Auto-resize on initial render
      setTimeout(() => autoResizeTextarea(textarea), 0);

      // Listeners
      textarea.addEventListener('input', () => {
        magicTaskState.steps[index].text = textarea.value;
        autoResizeTextarea(textarea);
        setStorage({ magicTaskState });
      });

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          step.completed = true;
          step.isDone = true;
          if (step.id) {
            markTodoDoneOnBackend(step.id);
          }
          const nextIndex = index + 1;
          if (nextIndex < magicTaskState.steps.length) {
            magicTaskState.currentStepIndex = nextIndex;
            magicTaskState.completed = false;
            const nextStepText = magicTaskState.steps[nextIndex].text;
            const nextStepMin = magicTaskState.steps[nextIndex].minutes || 25;

            const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput?.value) || 60;
            const plan = buildPomodoroPlan(totalMinutes);
            pomodoroSession = {
              isActive: true,
              isRunning: true,
              totalMinutes,
              plan,
              currentIndex: nextIndex < plan.length ? nextIndex : 0,
              phase: 'work',
              targetTimestamp: Date.now() + (nextStepMin * 60 * 1000),
              pausedRemainingSeconds: null,
              showFloatingWidget: true
            };

            setStorage({
              magicTaskState,
              currentTask: nextStepText,
              pomodoroSession,
              showFloatingWidget: true
            }).then(() => {
              startPomodoroTimer();
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
        } else {
          step.completed = false;
          step.isDone = false;
          magicTaskState.currentStepIndex = index;
          magicTaskState.completed = false;
          setStorage({
            magicTaskState,
            currentTask: step.text
          }).then(() => {
            renderMagicStateUI();
          });
        }
      });

      deleteBtn.addEventListener('click', () => {
        if (step.id) {
          deleteTodoOnBackend(step.id);
        }
        magicTaskState.steps.splice(index, 1);
        if (magicTaskState.currentStepIndex >= magicTaskState.steps.length) {
          magicTaskState.currentStepIndex = Math.max(0, magicTaskState.steps.length - 1);
        }
        setStorage({ magicTaskState }).then(() => {
          renderMagicStateUI();
        });
      });

      syncBtn.addEventListener('click', () => {
        const stepFocusText = step.text;
        const stepMinutes = step.minutes || 25;
        magicTaskState.currentStepIndex = index;
        magicTaskState.completed = false;

        // Selalu set/reset targetTimestamp agar timer Pomodoro berhitung mundur secara real-time
        const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput?.value) || 60;
        const plan = buildPomodoroPlan(totalMinutes);
        pomodoroSession = {
          isActive: true,
          isRunning: true,
          totalMinutes,
          plan,
          currentIndex: index < plan.length ? index : 0,
          phase: 'work',
          targetTimestamp: Date.now() + (stepMinutes * 60 * 1000),
          pausedRemainingSeconds: null,
          showFloatingWidget: true
        };

        if (floatingPomodoroToggle) {
          floatingPomodoroToggle.checked = true;
        }

        setStorage({
          magicTaskState,
          currentTask: stepFocusText,
          pomodoroSession,
          showFloatingWidget: true
        }).then(() => {
          startPomodoroTimer();
          if (onStartFocusTab) onStartFocusTab(stepFocusText);
          renderMagicStateUI();
        });
      });
    });

    if (magicStepCountLabel) {
      magicStepCountLabel.textContent = `${magicTaskState.steps.length} item`;
    }
  }

  function resetMagicState() {
    magicTaskState = null;
    if (magicTaskInput) magicTaskInput.value = '';
    if (magicDurationInput) magicDurationInput.value = '60';
    setStorage({ magicTaskState: null, pomodoroSession: null, currentTask: '' }).then(() => {
      pomodoroSession = null;
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

        const workMin = parseInt(pomodoroWorkInput?.value, 10) || 25;
        const breakMin = parseInt(pomodoroBreakInput?.value, 10) || 5;

        const generatedSteps = await fetchMagicTodos(taskText, totalMinutes, {
          workMinutes: workMin,
          breakMinutes: breakMin
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

      const plan = buildPomodoroPlan(totalMinutes);
      pomodoroSession = {
        isActive: true,
        isRunning: true,
        totalMinutes,
        plan,
        currentIndex: activeIdx < plan.length ? activeIdx : 0,
        phase: 'work',
        targetTimestamp: Date.now() + (stepMin * 60 * 1000),
        pausedRemainingSeconds: null,
        showFloatingWidget: true
      };

      if (floatingPomodoroToggle) {
        floatingPomodoroToggle.checked = true;
      }

      setStorage({
        magicTaskState,
        currentTask: firstTaskText,
        pomodoroSession: pomodoroSession,
        showFloatingWidget: true
      }).then(() => {
        startPomodoroTimer();
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
            title: 'Fokus Dimulai! 🚀',
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
      resetPomodoroSession();
      resetMagicState();
    });
  }

  if (btnPausePomodoro) {
    btnPausePomodoro.addEventListener('click', () => {
      if (!pomodoroSession || !pomodoroSession.isActive) {
        startNewPomodoroSession();
        return;
      }
      if (pomodoroSession.isRunning) {
        const remSec = getPomodoroRemainingSeconds(pomodoroSession);
        pomodoroSession.isRunning = false;
        pomodoroSession.pausedRemainingSeconds = remSec;
        pomodoroSession.targetTimestamp = null;

        // Emit timer pause to WebSocket
        sendTimerEvent({
          type: 'timer_pause',
          task: magicTaskState?.steps?.[magicTaskState?.currentStepIndex]?.text || 'Sesi Fokus',
          remainingSeconds: remSec,
          phase: pomodoroSession.phase
        });
      } else {
        const remSec = pomodoroSession.pausedRemainingSeconds != null ? pomodoroSession.pausedRemainingSeconds : ((pomodoroSession.plan?.[pomodoroSession.currentIndex]?.minutes || 25) * 60);
        pomodoroSession.isRunning = true;
        pomodoroSession.targetTimestamp = Date.now() + (remSec * 1000);
        pomodoroSession.pausedRemainingSeconds = null;

        // Emit timer resume (start) to WebSocket
        sendTimerEvent({
          type: 'timer_start',
          task: magicTaskState?.steps?.[magicTaskState?.currentStepIndex]?.text || 'Sesi Fokus',
          remainingSeconds: remSec,
          phase: pomodoroSession.phase
        });
      }
      savePomodoroSession();
      startPomodoroTimer();
    });
  }

  if (btnResetPomodoro) {
    btnResetPomodoro.addEventListener('click', () => {
      resetPomodoroSession();
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
      if (accordionArrow) accordionArrow.textContent = '▲';
    }
    if (magicTaskInput) {
      setTimeout(() => magicTaskInput.focus(), 100);
    }
  }

  function setInitialStates({ magicState, pomoSession }) {
    magicTaskState = magicState;
    pomodoroSession = pomoSession;
    renderMagicStateUI();
    startPomodoroTimer();
  }

  return {
    setInitialStates,
    renderMagicStateUI,
    startNewPomodoroSession,
    openCreateAccordion
  };
}
