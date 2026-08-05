/**
 * ADHD Standalone Focus Coach - Popup Main Entry Point (Modular Orchestrator)
 */

import { getStorage } from './popup/services/storageService.js';
import { initThemeManager } from './popup/modules/themeManager.js';
import { initNavigationManager, switchToTab } from './popup/modules/navigationManager.js';
import { initFocusController } from './popup/controllers/focusController.js';
import { initMagicTodoController } from './popup/controllers/magicTodoController.js';
import { initRulesController } from './popup/controllers/rulesController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI navigation
  initNavigationManager();

  // Initialize Controllers
  const focusController = initFocusController({
    onGoToMagic: () => switchToTab('tab-magic-page'),
    onStartPomodoro: () => magicTodoController.startNewPomodoroSession()
  });

  const magicTodoController = initMagicTodoController({
    onStartFocusTab: (taskText) => {
      getStorage(['magicTaskState']).then((items) => {
        focusController.renderFocusTab(taskText, items.magicTaskState || null);
        switchToTab('tab-focus-page');
      });
    }
  });

  const rulesController = initRulesController({
    onStartPomodoro: () => {
      magicTodoController.startNewPomodoroSession();
    }
  });

  // Load Initial Settings & Hydrate Controllers
  getStorage([
    'isProtectionActive',
    'currentTask',
    'sensitivity',
    'blacklist',
    'refocusCount',
    'magicTaskState',
    'pomodoroSession',
    'theme',
    'pomodoroWorkMinutes',
    'pomodoroBreakMinutes',
    'showFloatingWidget'
  ]).then((items) => {
    // 1. Theme Manager
    initThemeManager(items.theme || 'dark');

    // 2. Magic To-Do & Pomodoro Controller
    magicTodoController.setInitialStates({
      magicState: items.magicTaskState || null,
      pomoSession: items.pomodoroSession || null
    });

    // 3. Focus Dashboard Controller
    focusController.renderFocusTab(items.currentTask || '', items.magicTaskState || null);

    // 4. Rules & Blacklist Controller
    rulesController.setInitialRules({ items });

    // Refocus Counter
    const refocusCounter = document.getElementById('refocus-counter');
    if (refocusCounter) {
      refocusCounter.textContent = items.refocusCount || 0;
    }
  });

  // Live Debug Sensor Sync
  function updateDebugSensorUI() {
    getStorage(['debugMetrics']).then((items) => {
      const metrics = items.debugMetrics;
      const domainEl = document.getElementById('debug-active-domain');
      const scrollEl = document.getElementById('debug-scroll-px');

      if (metrics) {
        if (domainEl && metrics.domain) domainEl.textContent = metrics.domain;
        if (scrollEl) {
          if (metrics.isShortVideo) {
            scrollEl.textContent = `🎬 ${metrics.swipeCount || 0} Video (${(metrics.totalScrollPx || 0).toLocaleString()} px)`;
          } else if (metrics.totalScrollPx !== undefined) {
            scrollEl.textContent = `📜 ${(metrics.totalScrollPx || 0).toLocaleString()} px (pos: ${metrics.scrollY || 0}px)`;
          }
        }
      }
    });

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url) {
          try {
            const urlObj = new URL(tabs[0].url);
            const domainEl = document.getElementById('debug-active-domain');
            if (domainEl && urlObj.hostname && urlObj.protocol.startsWith('http')) {
              domainEl.textContent = urlObj.hostname;
            } else if (domainEl && urlObj.protocol.startsWith('chrome')) {
              domainEl.textContent = `${urlObj.hostname} (Halaman Internal Chrome)`;
            }
          } catch (e) {}
        }
      });
    }
  }

  updateDebugSensorUI();

  // Storage Change Sync
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        getStorage(['magicTaskState', 'currentTask', 'pomodoroSession', 'debugMetrics']).then((items) => {
          magicTodoController.setInitialStates({
            magicState: items.magicTaskState || null,
            pomoSession: items.pomodoroSession || null
          });
          focusController.renderFocusTab(items.currentTask || '', items.magicTaskState || null);
          updateDebugSensorUI();
        });
      }
    });
  }
});
