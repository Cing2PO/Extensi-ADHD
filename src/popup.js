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

  // Storage Change Sync
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        getStorage(['magicTaskState', 'currentTask', 'pomodoroSession']).then((items) => {
          magicTodoController.setInitialStates({
            magicState: items.magicTaskState || null,
            pomoSession: items.pomodoroSession || null
          });
          focusController.renderFocusTab(items.currentTask || '', items.magicTaskState || null);
        });
      }
    });
  }
});
