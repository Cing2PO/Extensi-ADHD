/**
 * Magic To-Do Controller Module - Handles AI Task Breakdown & Checklist Renders
 */

import { fetchMagicTodos } from '../services/apiService.js';
import { setStorage } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';

export function initMagicTodoController({ onStartFocusTab }) {
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
    if (!magicPomodoroPanel) return;
    if (!pomodoroSession || !pomodoroSession.isActive) {
      magicPomodoroPanel.classList.add('hidden');
      return;
    }

    magicPomodoroPanel.classList.remove('hidden');

    const currentBlock = pomodoroSession.plan?.[pomodoroSession.currentIndex] || null;
    const phaseLabel = pomodoroSession.phase === 'break' ? 'Istirahat' : 'Kerja';
    const remSec = getPomodoroRemainingSeconds(pomodoroSession);
    const timerText = formatPomodoroTime(remSec);

    if (magicPomodoroStatus) {
      magicPomodoroStatus.textContent = `${phaseLabel} • ${currentBlock?.minutes || 0} menit`;
    }

    if (magicPomodoroTimer) {
      magicPomodoroTimer.textContent = timerText;
    }

    if (btnPausePomodoro) {
      btnPausePomodoro.textContent = pomodoroSession.isRunning ? 'Pause' : 'Lanjut';
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
        } else {
          pomodoroSession.isActive = false;
          pomodoroSession.isRunning = false;
          pomodoroSession.phase = 'done';
          pomodoroSession.targetTimestamp = null;
          pomodoroSession.pausedRemainingSeconds = 0;
          savePomodoroSession();
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
    setStorage({ pomodoroSession: null }).then(() => {
      renderPomodoroPanel();
    });
  }

  function renderMagicStateUI() {
    if (magicInputPanel) magicInputPanel.classList.add('hidden');
    if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
    if (magicResultsPanel) magicResultsPanel.classList.add('hidden');
    if (magicCongratsPanel) magicCongratsPanel.classList.add('hidden');

    if (!magicTaskState) {
      if (magicInputPanel) magicInputPanel.classList.remove('hidden');
      renderPomodoroPanel();
      return;
    }

    if (magicTaskState.completed) {
      if (magicCongratsPanel) magicCongratsPanel.classList.remove('hidden');
      renderPomodoroPanel();
    } else {
      if (magicResultsPanel) magicResultsPanel.classList.remove('hidden');
      renderMagicSteps();
      renderPomodoroPanel();
    }
  }

  function renderMagicSteps() {
    if (!magicStepsList) return;
    magicStepsList.innerHTML = '';
    if (!magicTaskState || !magicTaskState.steps) return;

    magicTaskState.steps.forEach((step, index) => {
      const li = document.createElement('li');
      li.className = 'magic-step-item';

      const content = document.createElement('div');
      content.className = 'magic-step-content';

      const textarea = document.createElement('textarea');
      textarea.className = 'magic-step-textarea';
      textarea.spellcheck = false;
      textarea.value = step.text;

      const meta = document.createElement('span');
      meta.className = 'magic-step-meta';
      meta.textContent = `${step.minutes}m`;

      content.appendChild(textarea);
      content.appendChild(meta);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete-step';
      deleteBtn.title = 'Hapus to-do ini';
      deleteBtn.textContent = '×';

      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'btn-sync-focus';
      syncBtn.title = 'Set sebagai fokus aktif sekarang';
      syncBtn.textContent = 'Fokus';

      textarea.addEventListener('input', () => {
        magicTaskState.steps[index].text = textarea.value;
        setStorage({ magicTaskState });
      });

      deleteBtn.addEventListener('click', () => {
        magicTaskState.steps.splice(index, 1);
        setStorage({ magicTaskState }).then(() => {
          renderMagicStateUI();
        });
      });

      syncBtn.addEventListener('click', () => {
        const stepFocusText = step.text;
        magicTaskState.currentStepIndex = index;
        magicTaskState.completed = false;
        setStorage({ magicTaskState, currentTask: stepFocusText }).then(() => {
          syncBtn.textContent = 'Synced! ✓';
          syncBtn.style.color = '#10b981';
          syncBtn.style.borderColor = '#10b981';
          setTimeout(() => {
            syncBtn.textContent = 'Fokus';
            syncBtn.style.color = '';
            syncBtn.style.borderColor = '';
          }, 1500);
        });
      });

      li.appendChild(content);
      li.appendChild(deleteBtn);
      li.appendChild(syncBtn);
      magicStepsList.appendChild(li);
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
          currentStepIndex: 0,
          completed: false,
          totalMinutes: totalMinutes
        };

        await setStorage({ magicTaskState });
        if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
        renderMagicStateUI();
      } catch (err) {
        if (magicLoadingPanel) magicLoadingPanel.classList.add('hidden');
        if (magicInputPanel) magicInputPanel.classList.remove('hidden');

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
      const firstTaskText = magicTaskState.steps[magicTaskState.currentStepIndex || 0]?.text || magicTaskState.steps[0].text;
      const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput?.value) || 60;

      const plan = buildPomodoroPlan(totalMinutes);
      const firstBlockMin = plan[0]?.minutes || 25;
      pomodoroSession = {
        isActive: true,
        isRunning: true,
        totalMinutes,
        plan,
        currentIndex: 0,
        phase: plan[0]?.type || 'work',
        targetTimestamp: Date.now() + (firstBlockMin * 60 * 1000),
        pausedRemainingSeconds: null,
        showFloatingWidget: true
      };

      if (floatingPomodoroToggle) {
        floatingPomodoroToggle.checked = true;
      }

      setStorage({
        currentTask: firstTaskText,
        pomodoroSession: pomodoroSession,
        showFloatingWidget: true
      }).then(() => {
        startPomodoroTimer();
        if (onStartFocusTab) onStartFocusTab(firstTaskText);

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
          title: 'Reset Tugas?',
          text: 'Daftar to-do Anda akan dihapus.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Ya, reset!',
          cancelButtonText: 'Batal',
          ...getSwalTheme()
        }).then((result) => {
          if (result.isConfirmed) {
            resetMagicState();
            window.Swal.fire({
              title: 'Direset!',
              text: 'Daftar to-do baru dapat dibuat.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false,
              ...getSwalTheme()
            });
          }
        });
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
      if (!pomodoroSession) return;
      if (pomodoroSession.isRunning) {
        const remSec = getPomodoroRemainingSeconds(pomodoroSession);
        pomodoroSession.isRunning = false;
        pomodoroSession.pausedRemainingSeconds = remSec;
        pomodoroSession.targetTimestamp = null;
      } else {
        const remSec = pomodoroSession.pausedRemainingSeconds != null ? pomodoroSession.pausedRemainingSeconds : ((pomodoroSession.plan?.[pomodoroSession.currentIndex]?.minutes || 25) * 60);
        pomodoroSession.isRunning = true;
        pomodoroSession.targetTimestamp = Date.now() + (remSec * 1000);
        pomodoroSession.pausedRemainingSeconds = null;
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

  function startNewPomodoroSession() {
    const workM = Math.max(1, parseInt(pomodoroWorkInput?.value, 10) || 25);
    const breakM = Math.max(1, parseInt(pomodoroBreakInput?.value, 10) || 5);

    const plan = [
      { type: 'work', minutes: workM },
      { type: 'break', minutes: breakM },
      { type: 'work', minutes: workM },
      { type: 'break', minutes: breakM }
    ];

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

    setStorage({ pomodoroSession }).then(() => {
      renderPomodoroPanel();
      startPomodoroTimer();
    });
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
    startNewPomodoroSession
  };
}
