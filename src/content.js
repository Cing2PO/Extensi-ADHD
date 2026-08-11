/**
 * ADHD Standalone Focus Check - Content Script Main Orchestrator
 */

import { isDomainBlacklisted } from './content/modules/domainMatcher.js';
import { HeuristicsEngine } from './content/modules/heuristicsEngine.js';
import { OverlayManager } from './content/modules/overlayManager.js';
import { getStorageData, setStorageData, parseBlacklist } from './content/modules/storageSync.js';

(function () {
  let isProtectionActive = true;
  let currentTask = "";
  let pomodoroSession = null;
  let pomoTickerIntervalId = null;

  function isContextValid() {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  }

  // --- OVERLAY & HEURISTICS ORCHESTRATION ---
  const overlayManager = new OverlayManager({
    onKeepWorking: () => {
      heuristicsEngine.resetScore();
      if (isContextValid()) {
        getStorageData(['refocusCount']).then(items => {
          const count = items.refocusCount || 0;
          setStorageData({ refocusCount: count + 1 });
        });
      }
    },
    onGetMeOut: () => {
      window.location.href = 'about:blank';
    },
    onPomoAction: handlePomoAction
  });

  const heuristicsEngine = new HeuristicsEngine({
    onThresholdReached: (distractionScore, threshold) => {
      if (!overlayManager.isOverlayVisible()) {
        overlayManager.showOverlay(currentTask);

        if (isContextValid()) {
          console.log(`[Content Script] Distraction threshold reached (${Math.round(distractionScore)} >= ${threshold}). Sending event to background worker...`);
          chrome.runtime.sendMessage({
            action: 'doomscrollDetected',
            domain: window.location.hostname,
            score: Math.round(distractionScore),
            currentTask: currentTask
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn("[Content Script] Message delivery notice:", chrome.runtime.lastError.message);
            }
          });
        }
      }
    },
    onTick: (metrics) => {
      overlayManager.updatePomoFloatingDebug(metrics);
      if (isContextValid()) {
        setStorageData({
          debugMetrics: {
            ...metrics,
            updatedAt: Date.now()
          }
        });
      }
    }
  });

  // --- POMODORO ACTIONS ---
  function handlePomoAction(action) {
    if (!isContextValid()) return;

    getStorageData(['pomodoroSession', 'magicTaskState', 'refocusCount', 'pomodoroWorkMinutes', 'pomodoroBreakMinutes', 'currentTask']).then(items => {
      let session = items.pomodoroSession;
      if (!session && action !== 'done') return;

      if (action === 'toggle') {
        if (session.isRunning) {
          const remSec = overlayManager.getFloatingRemainingSeconds(session);
          session.isRunning = false;
          session.pausedRemainingSeconds = remSec;
          session.targetTimestamp = null;
        } else {
          const remSec = session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : ((session.plan?.[session.currentIndex]?.minutes || 25) * 60);
          session.isRunning = true;
          session.targetTimestamp = Date.now() + (remSec * 1000);
          session.pausedRemainingSeconds = null;
        }
        setStorageData({ pomodoroSession: session }).then(renderPomodoroFloatingState);
      } else if (action === 'skip') {
        const nextIndex = session.currentIndex + 1;
        if (nextIndex < (session.plan || []).length) {
          const nextBlock = session.plan[nextIndex];
          const durationSec = nextBlock.minutes * 60;
          session.currentIndex = nextIndex;
          session.phase = nextBlock.type;
          session.targetTimestamp = session.isRunning ? (Date.now() + durationSec * 1000) : null;
          session.pausedRemainingSeconds = session.isRunning ? null : durationSec;
        } else {
          session.isActive = false;
          session.isRunning = false;
          session.phase = 'done';
          session.targetTimestamp = null;
          session.pausedRemainingSeconds = 0;
        }
        setStorageData({ pomodoroSession: session }).then(renderPomodoroFloatingState);
      } else if (action === 'done') {
        const state = items.magicTaskState;
        const count = items.refocusCount || 0;
        let nextTaskText = '';
        let nextDurationMinutes = items.pomodoroWorkMinutes || 25;
        let isFinishedAll = false;

        if (state && state.steps && state.steps.length) {
          const curIdx = typeof state.currentStepIndex === 'number' ? state.currentStepIndex : 0;
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

        setStorageData({
          magicTaskState: state,
          currentTask: nextTaskText,
          pomodoroSession: session,
          refocusCount: count + 1
        }).then(renderPomodoroFloatingState);
      } else if (action === 'stop') {
        setStorageData({ pomodoroSession: null }).then(renderPomodoroFloatingState);
      }
    });
  }

  function renderPomodoroFloatingState() {
    if (!isContextValid()) return;

    getStorageData(['pomodoroSession', 'showFloatingWidget', 'currentTask', 'isProtectionActive']).then(items => {
      const isProtectionActive = items.isProtectionActive !== false;
      const session = items.pomodoroSession;
      const showWidget = items.showFloatingWidget !== false;

      const shouldDisplay = isProtectionActive && showWidget && session && session.isActive;

      if (!shouldDisplay) {
        overlayManager.removePomodoroWidget();
        if (pomoTickerIntervalId) {
          clearInterval(pomoTickerIntervalId);
          pomoTickerIntervalId = null;
        }
        return;
      }

      overlayManager.injectPomodoroFloatingWidget();
      overlayManager.updatePomoFloatingUI(session, items.currentTask);

      if (!pomoTickerIntervalId) {
        pomoTickerIntervalId = setInterval(() => {
          if (!isContextValid()) {
            if (pomoTickerIntervalId) clearInterval(pomoTickerIntervalId);
            return;
          }
          getStorageData(['pomodoroSession', 'currentTask']).then(tItems => {
            if (tItems.pomodoroSession) {
              overlayManager.updatePomoFloatingUI(tItems.pomodoroSession, tItems.currentTask);
            }
          });
        }, 1000);
      }
    });
  }

  // --- ENGINE EVALUATION ---
  function checkAndSetEngine() {
    if (!isContextValid()) {
      heuristicsEngine.stop();
      overlayManager.removeOverlay();
      return;
    }

    getStorageData(['blacklist', 'isProtectionActive', 'sensitivity', 'currentTask', 'pomodoroSession']).then(items => {
      isProtectionActive = items.isProtectionActive !== false;
      currentTask = items.currentTask || '';
      pomodoroSession = items.pomodoroSession || null;

      heuristicsEngine.setThreshold(items.sensitivity || 'balanced');
      const blacklist = parseBlacklist(items.blacklist);

      const isPomodoroActive = !!(pomodoroSession && pomodoroSession.isActive);
      const isPomodoroBreak = isPomodoroActive && pomodoroSession.phase === 'break';
      const isPomodoroPaused = isPomodoroActive && !pomodoroSession.isRunning && pomodoroSession.phase === 'work';
      const isBlacklisted = isDomainBlacklisted(window.location.hostname, blacklist);

      // Blocker is ACTIVE when:
      // 1. Anti-Doomscroll Shield is ON (isProtectionActive !== false)
      // 2. We are NOT currently in a Pomodoro break phase or paused state
      // 3. Domain is blacklisted / distraction site (or Pomodoro work phase is active)
      const isBreakOrPaused = isPomodoroBreak || isPomodoroPaused;
      const shouldRun = isProtectionActive && !isBreakOrPaused && (isBlacklisted || (isPomodoroActive && pomodoroSession.phase === 'work'));

      if (shouldRun) {
        heuristicsEngine.start();
      } else {
        heuristicsEngine.stop();
        overlayManager.removeOverlay();
      }
    });
  }

  // Initial Run with DOM Readiness Check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      checkAndSetEngine();
      renderPomodoroFloatingState();
    });
  } else {
    checkAndSetEngine();
    renderPomodoroFloatingState();
  }

  // Storage Sync Listener
  if (isContextValid() && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'local') return;

      if (changes.blacklist || changes.isProtectionActive || changes.sensitivity || changes.currentTask || changes.pomodoroSession) {
        checkAndSetEngine();
      }
      if (changes.pomodoroSession || changes.showFloatingWidget || changes.isProtectionActive) {
        renderPomodoroFloatingState();
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'DOOMSCROLL_SERVER_ACK') {
        console.log(`%c[Content Script] Cross-Platform Sync Received for Domain: ${message.domain}`, "color: #10b981; font-weight: bold;");
      }
    });
  }
})();
