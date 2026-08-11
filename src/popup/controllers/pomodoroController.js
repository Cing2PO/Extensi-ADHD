/**
 * Pomodoro Controller Module - Manages Pomodoro Timer State, Rendering & Actions
 * 
 * Extracted from magicTodoController.js for modular separation.
 */

import { setStorage } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';
import { sendTimerEvent } from '../services/websocketService.js';
import { formatPomodoroTime, getPomodoroRemainingSeconds, buildPomodoroPlan } from '../../shared/pomodoroUtils.js';

/**
 * @param {Object} options
 * @param {Function} options.onStartFocusTab - Callback when a focus session starts
 * @param {Function} options.getMagicTaskState - Getter for current magic task state
 * @param {Function} options.getDurationInput - Getter for total duration input value
 */
export function initPomodoroController({ onStartFocusTab, getMagicTaskState, getDurationInput }) {
  const magicPomodoroStatus = document.getElementById('magic-pomodoro-status');
  const magicPomodoroTimer = document.getElementById('magic-pomodoro-timer');
  const btnPausePomodoro = document.getElementById('btn-pause-pomodoro');
  const btnResetPomodoro = document.getElementById('btn-reset-pomodoro');
  const pomodoroWorkInput = document.getElementById('pomodoro-work-input');
  const pomodoroBreakInput = document.getElementById('pomodoro-break-input');
  const floatingPomodoroToggle = document.getElementById('floating-pomodoro-toggle');

  let pomodoroSession = null;
  let pomodoroTimerInterval = null;

  function getWorkMinutes() {
    return Math.max(1, parseInt(pomodoroWorkInput?.value, 10) || 25);
  }

  function getBreakMinutes() {
    return Math.max(1, parseInt(pomodoroBreakInput?.value, 10) || 5);
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
        const magicTaskState = getMagicTaskState();

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
    const workM = getWorkMinutes();
    const breakM = getBreakMinutes();
    const magicTaskState = getMagicTaskState();

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

  /**
   * Create a new pomodoro session from magic task state parameters
   */
  function createMagicPomodoroSession({ totalMinutes, currentIndex, stepMinutes }) {
    const workM = getWorkMinutes();
    const breakM = getBreakMinutes();
    const plan = buildPomodoroPlan(totalMinutes, workM, breakM);

    pomodoroSession = {
      isActive: true,
      isRunning: true,
      totalMinutes,
      plan,
      currentIndex: currentIndex < plan.length ? currentIndex : 0,
      phase: 'work',
      targetTimestamp: Date.now() + (stepMinutes * 60 * 1000),
      pausedRemainingSeconds: null,
      showFloatingWidget: true
    };

    if (floatingPomodoroToggle) {
      floatingPomodoroToggle.checked = true;
    }

    return pomodoroSession;
  }

  // --- EVENT LISTENERS ---
  if (btnPausePomodoro) {
    btnPausePomodoro.addEventListener('click', () => {
      if (!pomodoroSession || !pomodoroSession.isActive) {
        startNewPomodoroSession();
        return;
      }

      const magicTaskState = getMagicTaskState();

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

  return {
    renderPomodoroPanel,
    savePomodoroSession,
    startPomodoroTimer,
    resetPomodoroSession,
    startNewPomodoroSession,
    createMagicPomodoroSession,
    getSession: () => pomodoroSession,
    setSession: (s) => { pomodoroSession = s; },
    getWorkMinutes,
    getBreakMinutes,
  };
}
