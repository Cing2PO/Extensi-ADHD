/**
 * Focus Controller Module - Manages Focus Tab Active Dashboard & Progress
 */

import { setStorage, getStorage } from '../services/storageService.js';
import { markTodoDoneOnBackend } from '../services/projectService.js';

export function initFocusController({ onGoToMagic, onGoToMagicCreate, onStartPomodoro, onGoToGuard }) {
  const focusIdleView = document.getElementById('focus-idle-view');
  const focusActiveView = document.getElementById('focus-active-view');
  const focusTaskDisplay = document.getElementById('focus-task-display');
  const btnDashboardComplete = document.getElementById('btn-dashboard-complete');
  const btnDashboardCancel = document.getElementById('btn-dashboard-cancel');
  const btnGoToMagicLink = document.getElementById('btn-go-to-magic-link');
  const btnDashboardCreateMagic = document.getElementById('btn-dashboard-create-magic');
  const btnGoToGuardTab = document.getElementById('btn-go-to-guard-tab');
  const btnStartQuickPomodoro = document.getElementById('btn-start-quick-pomodoro');
  const refocusCounter = document.getElementById('refocus-counter');

  if (btnGoToMagicLink && onGoToMagic) {
    btnGoToMagicLink.addEventListener('click', onGoToMagic);
  }

  if (btnDashboardCreateMagic && onGoToMagicCreate) {
    btnDashboardCreateMagic.addEventListener('click', onGoToMagicCreate);
  }

  if (btnGoToGuardTab && onGoToGuard) {
    btnGoToGuardTab.addEventListener('click', onGoToGuard);
  }

  if (btnStartQuickPomodoro && onStartPomodoro) {
    btnStartQuickPomodoro.addEventListener('click', onStartPomodoro);
  }

  if (btnDashboardCancel) {
    btnDashboardCancel.addEventListener('click', () => {
      setStorage({ currentTask: '' }).then(() => {
        renderFocusTab('', null);
        console.log("[Focus Dashboard] Focus skipped.");
      });
    });
  }

  if (btnDashboardComplete) {
    btnDashboardComplete.addEventListener('click', () => {
      getStorage(['magicTaskState', 'pomodoroSession', 'refocusCount', 'pomodoroWorkMinutes', 'pomodoroBreakMinutes', 'currentTask']).then((items) => {
        const state = items.magicTaskState;
        let session = items.pomodoroSession;
        const count = items.refocusCount || 0;

        let nextTaskText = '';
        let nextDurationMinutes = items.pomodoroWorkMinutes || 25;
        let isFinishedAll = false;

        if (state && state.steps && state.steps.length) {
          const curIdx = typeof state.currentStepIndex === 'number' ? Math.max(0, state.currentStepIndex) : 0;
          
          if (state.steps[curIdx]) {
            state.steps[curIdx].completed = true;
            state.steps[curIdx].isDone = true;
            if (state.steps[curIdx].id) {
              markTodoDoneOnBackend(state.steps[curIdx].id);
            }
          }

          const nxtIdx = curIdx + 1;

          if (nxtIdx < state.steps.length) {
            state.currentStepIndex = nxtIdx;
            nextTaskText = state.steps[nxtIdx].text;
            nextDurationMinutes = state.steps[nxtIdx].minutes || items.pomodoroWorkMinutes || 25;
          } else {
            state.completed = true;
            state.currentStepIndex = state.steps.length;
            isFinishedAll = true;
            nextTaskText = '';
          }
        }

        if (session && session.isActive) {
          if (isFinishedAll) {
            const breakM = items.pomodoroBreakMinutes || 5;
            session.phase = 'break';
            session.targetTimestamp = session.isRunning ? (Date.now() + breakM * 60 * 1000) : null;
            session.pausedRemainingSeconds = session.isRunning ? null : (breakM * 60);
          } else {
            session.phase = 'work';
            session.targetTimestamp = session.isRunning ? (Date.now() + nextDurationMinutes * 60 * 1000) : null;
            session.pausedRemainingSeconds = session.isRunning ? null : (nextDurationMinutes * 60);
          }
        }

        const storagePayload = {
          magicTaskState: state,
          refocusCount: count + 1,
          currentTask: nextTaskText,
          pomodoroSession: session
        };

        setStorage(storagePayload).then(() => {
          if (refocusCounter) refocusCounter.textContent = count + 1;
          renderFocusTab(nextTaskText, state);
          if (typeof window.confetti === 'function') {
            window.confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
          }
        });
      });
    });
  }

  function getMagicStepIndexForTask(taskText, magicTaskState) {
    if (!magicTaskState || !magicTaskState.steps?.length) return -1;
    if (typeof magicTaskState.currentStepIndex === 'number' && magicTaskState.steps[magicTaskState.currentStepIndex]?.text === taskText) {
      return magicTaskState.currentStepIndex;
    }
    const matchIndex = magicTaskState.steps.findIndex(step => step.text === taskText);
    if (matchIndex !== -1) return matchIndex;
    return typeof magicTaskState.currentStepIndex === 'number' ? magicTaskState.currentStepIndex : 0;
  }

  function updateFocusProgress(completedCount, totalCount) {
    const fill = document.getElementById('focus-progress-fill');
    const label = document.getElementById('focus-progress-label');
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${completedCount} / ${totalCount}`;
  }

  function renderFocusTab(currentTaskText, magicTaskState) {
    if (!currentTaskText) {
      if (focusIdleView) focusIdleView.classList.remove('hidden');
      if (focusActiveView) focusActiveView.classList.add('hidden');
      updateFocusProgress(0, 0);
      return;
    }

    if (focusIdleView) focusIdleView.classList.add('hidden');
    if (focusActiveView) focusActiveView.classList.remove('hidden');
    if (focusTaskDisplay) focusTaskDisplay.textContent = currentTaskText;

    if (!magicTaskState || !magicTaskState.steps?.length) {
      updateFocusProgress(0, 0);
    } else {
      const total = magicTaskState.steps.length;
      const currentIndex = getMagicStepIndexForTask(currentTaskText, magicTaskState);
      const completed = currentIndex < 0 ? 0 : currentIndex + 1;
      updateFocusProgress(completed, total);
    }
  }

  return {
    renderFocusTab
  };
}
